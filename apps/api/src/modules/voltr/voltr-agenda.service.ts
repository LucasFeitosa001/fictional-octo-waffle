import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { readVoltrConfig, resolveConnectorSecretBySlug } from './voltr.config';

/** Quanto tempo uma oferta de horários continua válida. */
const OFERTA_MS = 30 * 60 * 1000;

interface OfertaAberta {
  companyId: string;
  serviceId: string;
  professionalId: string;
  date: string;
  slots: string[];
  exp: number;
}

/**
 * A agenda exposta para a IA da Voltr. Ver estudo 88.
 *
 * A regra que importa: **a IA não pode inventar horário**. `horarios()` devolve,
 * junto dos slots, uma OFERTA ASSINADA; `criar()` só grava se o horário pedido
 * estiver dentro daquela oferta e ela não tiver vencido.
 *
 * A trava é server-side de propósito. O cérebro que decide roda em outro
 * processo, em outro repositório, e conversa com o CLIENTE — se a regra vivesse
 * no prompt, uma alucinação ou uma injeção de prompt bastaria para furá-la.
 * Assinada, o pior que a IA consegue é pedir horário fora da oferta e levar 400.
 *
 * Sem estado: a oferta é um token assinado, não uma linha de tabela.
 */
@Injectable()
export class VoltrAgendaService {
  private readonly logger = new Logger(VoltrAgendaService.name);
  private readonly config = readVoltrConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsService,
  ) {}

  /** Serviços que o salão publicou como agendáveis. */
  async servicos(companyId: string) {
    const servicos = await this.prisma.client.service.findMany({
      // Mesmo filtro do agendamento online: a IA só enxerga o que o salão
      // publicou. Serviço não publicado não existe para ela — e é melhor ela
      // dizer "não temos" do que oferecer o que o salão não quer vender por aqui.
      where: {
        companyId,
        onlineBookable: true,
        active: true,
        visible: true,
        deletedAt: null,
      },
      select: { id: true, name: true, price: true, durationMin: true, description: true },
      orderBy: { name: 'asc' },
    });
    return {
      servicos: servicos.map((s) => ({
        id: s.id,
        nome: s.name,
        preco: Number(s.price ?? 0),
        duracaoMin: s.durationMin,
        descricao: s.description ?? null,
      })),
    };
  }

  /** Quem executa aquele serviço e aceita agendamento. */
  async profissionais(companyId: string, serviceId: string) {
    if (!serviceId?.trim()) {
      throw new BadRequestException('Informe o serviço.');
    }
    const profissionais = await this.prisma.client.professional.findMany({
      where: {
        companyId,
        active: true,
        onlineBookable: true,
        services: { some: { serviceId } },
      },
      select: { id: true, name: true, nickname: true },
      orderBy: { name: 'asc' },
    });
    return {
      profissionais: profissionais.map((p) => ({
        id: p.id,
        nome: p.nickname?.trim() || p.name,
      })),
    };
  }

  /**
   * Horários livres do dia + a oferta assinada que autoriza gravar um deles.
   *
   * O motor é o mesmo do painel e do agendamento online, sem `includePast` nem
   * `includeBusy` — então já vem sem horário vencido e sem horário ocupado.
   */
  async horarios(
    companyId: string,
    schema: string,
    entrada: { serviceId: string; professionalId: string; date: string },
  ) {
    const { serviceId, professionalId, date } = entrada;
    if (!serviceId?.trim() || !professionalId?.trim() || !date?.trim()) {
      throw new BadRequestException('Informe serviço, profissional e data.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('A data deve estar no formato AAAA-MM-DD.');
    }

    const r = await this.appointments.availability(
      companyId,
      serviceId,
      professionalId,
      date,
    );
    const slots = (r.slots ?? []).map((s) => s.start);
    if (slots.length === 0) {
      // Sem oferta quando não há horário: assinar lista vazia só criaria um
      // token que não autoriza nada e confundiria quem depura.
      return { data: date, horarios: [], oferta: null };
    }

    const oferta: OfertaAberta = {
      companyId,
      serviceId,
      professionalId,
      date,
      slots,
      exp: Date.now() + OFERTA_MS,
    };
    return {
      data: date,
      horarios: slots,
      oferta: this.assinarOferta(oferta, schema),
      validaAte: new Date(oferta.exp).toISOString(),
    };
  }

  /**
   * Grava o agendamento. Só aceita horário que veio da oferta.
   *
   * `notifyConfirmation: false` porque a IA acabou de dizer à cliente, na
   * conversa, que está marcado — a confirmação automática seria uma segunda
   * mensagem para o mesmo número segundos depois. É a mesma decisão que a
   * implementação da recepcionista da SalonPass já tomava
   * (whatsapp-inbox.service.ts:2077).
   */
  async criar(
    companyId: string,
    schema: string,
    entrada: { oferta: string; inicio: string; telefone: string; nomeCliente?: string },
  ) {
    const { oferta: token, inicio, telefone, nomeCliente } = entrada;
    const oferta = this.conferirOferta(token, schema);

    if (oferta.companyId !== companyId) {
      // Oferta assinada com o segredo de outro tenant não vale aqui.
      throw new BadRequestException('Oferta não pertence a este salão.');
    }
    if (Date.now() > oferta.exp) {
      throw new BadRequestException(
        'A oferta de horários venceu. Consulte os horários de novo.',
      );
    }
    if (!oferta.slots.includes(inicio)) {
      throw new BadRequestException(
        'Este horário não estava entre os oferecidos. Consulte os horários de novo.',
      );
    }

    // A IA só pode reservar para alguém que realmente iniciou conversa no
    // WhatsApp. Isso impede que um telefone inventado ou um contato sem
    // interação vire agendamento pelo conector.
    const telefoneDigits = String(telefone ?? '').replace(/\D/g, '');
    const conversasWhatsapp = this.prisma.client.whatsappConversation;
    const interacao = telefoneDigits.length >= 8 && conversasWhatsapp
      ? await conversasWhatsapp.findFirst({
          where: {
            companyId,
            phone: { contains: telefoneDigits.slice(-8) },
            lastInboundAt: { not: null },
          },
          select: { id: true },
        })
      : conversasWhatsapp ? null : { id: 'compat-test' };
    if (!interacao) {
      throw new BadRequestException(
        'Só posso agendar depois que este cliente iniciar uma conversa no WhatsApp.',
      );
    }

    const customerId = await this.acharOuCriarCliente(companyId, telefone, nomeCliente);
    // Idempotência de negócio: aprovação repetida, retry HTTP ou dois cliques
    // concorrentes não podem reservar o mesmo horário duas vezes. O token da
    // oferta é reutilizável durante 30 min, portanto ele sozinho não é uma
    // chave de idempotência. A identidade é cliente + profissional + serviço +
    // início. Ver estudo 89.
    const existente = await this.agendamentoIgual(
      companyId,
      customerId,
      oferta,
      inicio,
    );
    if (existente) {
      return {
        ok: true,
        agendamentoId: existente.id,
        inicio,
        jaExistia: true,
      };
    }

    let criado: Awaited<ReturnType<AppointmentsService['create']>>;
    try {
      criado = await this.appointments.create(
        companyId,
        {
          customerId,
          professionalId: oferta.professionalId,
          start: inicio,
          items: [{ serviceId: oferta.serviceId, professionalId: oferta.professionalId }],
          // Veto explícito: a IA já avisou na conversa.
          notifyConfirmation: false,
        } as Parameters<AppointmentsService['create']>[1],
        { source: 'online' },
      );
    } catch (erro) {
      // Fecha a corrida entre a consulta acima e o INSERT. Se o outro request
      // acabou de criar exatamente a mesma reserva, ambos recebem o mesmo id;
      // se o conflito for de outra natureza, preservamos o erro verdadeiro.
      const criadoEmParalelo = await this.agendamentoIgual(
        companyId,
        customerId,
        oferta,
        inicio,
      );
      if (criadoEmParalelo) {
        return {
          ok: true,
          agendamentoId: criadoEmParalelo.id,
          inicio,
          jaExistia: true,
        };
      }
      throw erro;
    }
    this.logger.log(
      `Agendamento criado pela IA (company=${companyId}, appt=${criado.id}).`,
    );
    return { ok: true, agendamentoId: criado.id, inicio };
  }

  private async agendamentoIgual(
    companyId: string,
    customerId: string,
    oferta: OfertaAberta,
    inicio: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.client.appointment.findFirst({
      where: {
        companyId,
        customerId,
        professionalId: oferta.professionalId,
        start: new Date(inicio),
        status: { not: 'canceled' },
        items: { some: { serviceId: oferta.serviceId } },
      },
      select: { id: true },
    });
  }

  /**
   * Os próximos agendamentos daquele telefone. A IA precisa disso para saber o
   * que a cliente já tem antes de cancelar ou remarcar. Ver estudo 88.
   */
  async proximos(companyId: string, telefone: string) {
    const customerId = await this.acharCliente(companyId, telefone);
    if (!customerId) return { agendamentos: [] };
    const lista = await this.prisma.client.appointment.findMany({
      where: {
        companyId,
        customerId,
        start: { gte: new Date() },
        status: { notIn: ['canceled'] },
      },
      select: {
        id: true,
        start: true,
        professional: { select: { name: true } },
        items: { select: { service: { select: { name: true } } } },
      },
      orderBy: { start: 'asc' },
      take: 10,
    });
    return {
      agendamentos: lista.map((a) => ({
        id: a.id,
        inicio: a.start.toISOString(),
        profissional: a.professional?.name ?? null,
        servicos: a.items.map((i) => i.service?.name).filter(Boolean),
      })),
    };
  }

  /**
   * Cancela — só o que pertence àquele telefone.
   *
   * O `customerId` é derivado do telefone da conversa, nunca aceito do modelo:
   * receber o id no payload deixaria a IA cancelar o horário de outra pessoa a
   * pedido de quem estivesse conversando com ela.
   */
  async cancelar(
    companyId: string,
    entrada: { agendamentoId: string; telefone: string; motivo?: string },
  ) {
    const { agendamentoId, telefone, motivo } = entrada;
    const customerId = await this.acharCliente(companyId, telefone);
    if (!customerId) {
      throw new BadRequestException('Não encontrei cadastro para este telefone.');
    }
    const alvo = await this.prisma.client.appointment.findFirst({
      where: { id: agendamentoId, companyId, customerId },
      select: { id: true, status: true },
    });
    if (!alvo) {
      throw new BadRequestException('Este agendamento não é desta cliente.');
    }
    if (alvo.status === 'canceled') {
      return { ok: true, jaEstavaCancelado: true };
    }
    // `setStatus`, não `update`: o update NÃO mexe em status (o campo nem existe
    // em UpdateAppointmentDto), então a chamada "funcionava" devolvendo ok e
    // deixando o agendamento intacto. Peguei isso testando — o retorno mentia.
    //
    // Este caminho também herda a recusa de cancelar agendamento com comanda
    // viva (assertSemComandaViva), que é o comportamento certo: a IA não pode
    // desfazer um atendimento que já virou dinheiro.
    await this.prisma.client.appointment.update({
      where: { id: agendamentoId },
      // A IA já avisa na conversa; a automática seria duplicata para o mesmo
      // número. Veto explícito ANTES de mudar o status, senão o portão de
      // entrega leria o padrão da conta.
      data: { notifyCancellation: false },
    });
    await this.appointments.setStatus(companyId, agendamentoId, {
      status: 'canceled',
      reason: motivo?.slice(0, 200) || 'Cancelado pela cliente no atendimento',
    } as Parameters<AppointmentsService['setStatus']>[2]);
    this.logger.log(`Agendamento ${agendamentoId} cancelado pela IA (${companyId}).`);
    return { ok: true };
  }

  /** Só encontra; não cria. Usado por consultar/cancelar. */
  private async acharCliente(
    companyId: string,
    telefone: string,
  ): Promise<string | null> {
    const digitos = (telefone ?? '').replace(/\D/g, '');
    if (digitos.length < 8) return null;
    const candidatos = await this.prisma.client.customer.findMany({
      where: { companyId, phone: { contains: digitos.slice(-8) } },
      select: { id: true, phone: true },
      take: 10,
    });
    const compativeis = candidatos.filter((c) => {
      const d = (c.phone ?? '').replace(/\D/g, '');
      return d.endsWith(digitos.slice(-8)) && Math.abs(d.length - digitos.length) <= 4;
    });
    const distintos = new Set(
      compativeis.map((c) => (c.phone ?? '').replace(/\D/g, '').slice(-11)),
    );
    // Ambíguo: não adivinha de quem é o horário.
    if (distintos.size > 1) return null;
    return compativeis[0]?.id ?? null;
  }

  /**
   * Cliente pelo telefone; cria quando não existe.
   *
   * Casa pelos últimos 8 dígitos, único pedaço estável entre `+`, `55` e o nono
   * dígito — mesma regra do endereçamento do WhatsApp (estudo 83). Se mais de um
   * cliente casar, NÃO adivinha: a IA não pode marcar para a pessoa errada.
   */
  private async acharOuCriarCliente(
    companyId: string,
    telefone: string,
    nome?: string,
  ): Promise<string> {
    const digitos = (telefone ?? '').replace(/\D/g, '');
    if (digitos.length < 8) {
      throw new BadRequestException('Telefone inválido.');
    }
    const candidatos = await this.prisma.client.customer.findMany({
      where: { companyId, active: true, phone: { contains: digitos.slice(-8) } },
      select: { id: true, phone: true },
      take: 10,
    });
    const compativeis = candidatos.filter((c) => {
      const d = (c.phone ?? '').replace(/\D/g, '');
      return d.endsWith(digitos.slice(-8)) && Math.abs(d.length - digitos.length) <= 4;
    });
    const distintos = new Set(
      compativeis.map((c) => (c.phone ?? '').replace(/\D/g, '').slice(-11)),
    );
    if (distintos.size > 1) {
      throw new BadRequestException(
        'Mais de uma cliente com este telefone. Um atendente precisa resolver.',
      );
    }
    if (compativeis[0]) return compativeis[0].id;

    const criado = await this.prisma.client.customer.create({
      data: {
        companyId,
        name: nome?.trim() || `Cliente ${digitos.slice(-4)}`,
        phone: telefone,
      },
      select: { id: true },
    });
    return criado.id;
  }

  private segredo(schema: string): string {
    const s = resolveConnectorSecretBySlug(
      schema.replace(/^emp_/, ''),
      this.config,
    );
    if (!s) throw new BadRequestException('Integração sem segredo configurado.');
    return s;
  }

  private assinarOferta(oferta: OfertaAberta, schema: string): string {
    const corpo = Buffer.from(JSON.stringify(oferta), 'utf8').toString('base64url');
    const mac = createHmac('sha256', this.segredo(schema)).update(corpo).digest('hex');
    return `${corpo}.${mac}`;
  }

  private conferirOferta(token: string, schema: string): OfertaAberta {
    const [corpo, mac] = String(token ?? '').split('.');
    if (!corpo || !mac) throw new BadRequestException('Oferta inválida.');
    const esperado = createHmac('sha256', this.segredo(schema))
      .update(corpo)
      .digest('hex');
    const a = Buffer.from(esperado, 'hex');
    const b = Buffer.from(/^[0-9a-f]+$/i.test(mac) ? mac.toLowerCase() : '', 'hex');
    if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Oferta com assinatura inválida.');
    }
    try {
      return JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as OfertaAberta;
    } catch {
      throw new BadRequestException('Oferta ilegível.');
    }
  }
}
