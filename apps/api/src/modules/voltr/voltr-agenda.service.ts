import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AVAILABILITY_EMPTY_REASON_TEXT,
  AppointmentsService,
} from '../appointments/appointments.service';
import { readVoltrConfig, resolveConnectorSecretBySlug } from './voltr.config';

/** Quanto tempo uma oferta de horários continua válida. */
const OFERTA_MS = 30 * 60 * 1000;

/**
 * Etiqueta de origem gravada em `Appointment.legacySource`.
 *
 * `AppointmentSource` só tem `admin` e `online`: sem isto, um agendamento feito
 * pela IA fica indistinguível de um feito no formulário público do site. Ver
 * estudo 99 e o comentário de `originTag` em appointments.service.ts.
 */
const ORIGEM_IA = 'voltr-ia';

/** Quantos candidatos a "mesmo telefone" o pré-filtro do banco traz por vez. */
const LIMITE_CANDIDATOS = 200;

/** A linha de cadastro que basta para decidir identidade. */
interface ClienteBruto {
  id: string;
  name: string | null;
  phone: string | null;
}

interface OfertaAberta {
  companyId: string;
  serviceId: string;
  professionalId: string;
  date: string;
  slots: string[];
  exp: number;
}

/** Só os dígitos. O banco tem 22% dos telefones com máscara. */
function digitosDe(valor?: string | null): string {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Nome utilizável, ou vazio.
 *
 * O pushName do WhatsApp chega com emoji ("Paulo 🔥"), com espaço sobrando e às
 * vezes só com símbolo. Tiramos o que não é nome e PRESERVAMOS acento, cedilha,
 * hífen e apóstrofo — "Conceição", "D'Ávila" e "Ana-Clara" são nomes legítimos.
 * Sem letra suficiente, devolve vazio para o chamador cair no fallback: inventar
 * nome é pior do que assumir que não sabemos.
 */
function limparNome(bruto?: string | null): string {
  const limpo = String(bruto ?? '')
    .normalize('NFC')
    // Fora emoji, pictograma, seletor de variação (FE0F), junção zero-width
    // (200D) e a tampa de teclado numérico (20E3).
    .replace(/[\p{Extended_Pictographic}\u200D\uFE0F\u20E3]/gu, ' ')
    // Fora o resto do que não é letra/marca/dígito/pontuação de nome.
    .replace(/[^\p{L}\p{M}\p{Nd}\s'’.\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
  // Precisa de pelo menos duas letras seguidas — "🔥", ".", "12" não são nome.
  return /\p{L}\p{L}/u.test(limpo) ? limpo : '';
}

/** Exposto só para os testes de unidade. */
export const _internoAgenda = { digitosDe, limparNome };

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
      //
      // O MOTIVO viaja junto. Sem ele a IA lia qualquer lista vazia como "dia
      // sem vaga" e dizia isso à cliente — foi assim que ela respondeu "não
      // encontrei horário livre" num dia com 33 horários livres, porque o id do
      // serviço é que estava errado. Ver estudo 99.
      return {
        data: date,
        horarios: [],
        oferta: null,
        motivo: r.motivo ?? 'sem_vaga',
        motivoTexto: r.motivoTexto ?? AVAILABILITY_EMPTY_REASON_TEXT.sem_vaga,
      };
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
    entrada: {
      oferta: string;
      inicio: string;
      telefone: string;
      /** pushName do WhatsApp — vem sujo, pode não ser o nome da pessoa. */
      nomeCliente?: string;
      /**
       * Nome que a CLIENTE disse na conversa, quando a IA perguntou. Tem
       * preferência sobre o pushName: um é resposta, o outro é apelido de perfil.
       */
      nomeInformado?: string;
      /**
       * Identidade que a Voltr guardou de um atendimento anterior. Evita
       * re-resolver pelo telefone toda vez. NÃO é confiança cega: só vale se o
       * cliente for DESTA empresa e o telefone bater. Ver `resolverCliente`.
       */
      customerId?: string;
    },
  ): Promise<{
    ok: true;
    agendamentoId: string;
    inicio: string;
    /** Só quando a reserva já existia (idempotência). */
    jaExistia?: boolean;
    /** Identidade resolvida — a ponte guarda isto e para de re-resolver. */
    customerId: string;
    customerName: string;
    /** `true` = nasceu cadastro novo agora. É o contador de duplicata. */
    customerCreated: boolean;
  }> {
    const {
      oferta: token,
      inicio,
      telefone,
      nomeCliente,
      nomeInformado,
      customerId: customerIdInformado,
    } = entrada;
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

    // Horário no passado. A oferta vale 30 min e a lista guarda o horário
    // enquanto o atendimento dele ainda não terminou — então, dentro da janela,
    // dava para gravar um começo que já passou. Pertencer à oferta não basta.
    const inicioMs = new Date(inicio).getTime();
    if (Number.isNaN(inicioMs)) {
      throw new BadRequestException('Horário inválido.');
    }
    if (inicioMs <= Date.now()) {
      throw new BadRequestException(
        'Este horário já passou. Consulte os horários de novo.',
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

    // O nome que a cliente DISSE vence o pushName do perfil; os dois passam
    // pela limpeza antes de virar cadastro.
    const cliente = await this.resolverCliente(companyId, telefone, {
      customerId: customerIdInformado,
      nome: limparNome(nomeInformado) || limparNome(nomeCliente),
    });
    const customerId = cliente.id;
    // A identidade resolvida volta SEMPRE, inclusive nos retornos idempotentes:
    // é com ela que a ponte guarda quem é a cliente e para de re-resolver pelo
    // telefone. `customerCreated` é o que deixa o dono auditar duplicata.
    const identidade = {
      customerId: cliente.id,
      customerName: cliente.nome,
      customerCreated: cliente.criado,
    };
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
        ...identidade,
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
        // `source: 'online'` continua (é o que o enum tem); `originTag` é o que
        // separa a IA do formulário público do site. Ver estudo 99.
        { source: 'online', originTag: ORIGEM_IA },
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
          ...identidade,
        };
      }
      throw erro;
    }
    this.logger.log(
      `Agendamento criado pela IA (company=${companyId}, appt=${criado.id}, ` +
        `cliente=${cliente.id}${cliente.criado ? ' NOVO' : ''}).`,
    );
    return { ok: true, agendamentoId: criado.id, inicio, ...identidade };
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
    const cliente = await this.acharCliente(companyId, telefone);
    // Este é o "resolver cliente" que a ponte já tinha: devolve a identidade
    // junto, para a Voltr guardar quem é a pessoa ANTES de tentar agendar. Ele
    // nunca cria ninguém — por isso não há `customerCreated` aqui.
    if (!cliente) {
      return { agendamentos: [], customerId: null, customerName: null };
    }
    const customerId = cliente.id;
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
      customerId: cliente.id,
      customerName: cliente.nome,
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
    const cliente = await this.acharCliente(companyId, telefone);
    if (!cliente) {
      throw new BadRequestException('Não encontrei cadastro para este telefone.');
    }
    const customerId = cliente.id;
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

  /**
   * Clientes cujo telefone é o MESMO número, comparando só dígitos.
   *
   * O casamento é pelos últimos 8 dígitos dos DOIS lados — único pedaço estável
   * entre `+`, `55`, DDD e o nono dígito (estudo 83).
   *
   * O pré-filtro do banco usa os últimos 4 dígitos, não os 8. Motivo: `contains`
   * roda na string CRUA e 22% dos telefones do banco estão com máscara —
   * `(89) 98121-7434` não contém "81217434", porque a máscara corta bem no meio
   * dos 8. Os últimos 4 nunca são cortados (toda máscara brasileira quebra ANTES
   * deles), então o pré-filtro passa a achar mascarado e cru.
   *
   * Não normalizei na query (regexp_replace em SQL cru) porque isso obrigaria a
   * varrer a tabela sem índice e a escapar do Prisma no meio de um caminho
   * multi-tenant. Com o filtro por 4 dígitos, o banco devolve uma mão-cheia de
   * linhas (~1/10.000 por posição) e a comparação exata acontece em memória.
   * Nenhuma linha entra sem passar pela conferência dos 8 dígitos.
   */
  private async candidatosPorTelefone(
    companyId: string,
    digitos: string,
    extra: { active?: boolean } = {},
  ): Promise<ClienteBruto[]> {
    const chave = digitos.slice(-8);
    const linhas = await this.prisma.client.customer.findMany({
      where: { companyId, ...extra, phone: { contains: digitos.slice(-4) } },
      select: { id: true, name: true, phone: true },
      take: LIMITE_CANDIDATOS,
    });
    return linhas.filter((c: ClienteBruto) => {
      const d = digitosDe(c.phone);
      return d.endsWith(chave) && Math.abs(d.length - digitos.length) <= 4;
    });
  }

  /** Mais de um número DIFERENTE casou: a IA não pode adivinhar de quem é. */
  private ambiguo(compativeis: { phone?: string | null }[]): boolean {
    const distintos = new Set(
      compativeis.map((c) => digitosDe(c.phone).slice(-11)),
    );
    return distintos.size > 1;
  }

  /** Só encontra; não cria. Usado por consultar/cancelar. */
  private async acharCliente(
    companyId: string,
    telefone: string,
  ): Promise<{ id: string; nome: string } | null> {
    const digitos = digitosDe(telefone);
    if (digitos.length < 8) return null;
    const compativeis = await this.candidatosPorTelefone(companyId, digitos);
    // Ambíguo: não adivinha de quem é o horário.
    if (this.ambiguo(compativeis)) return null;
    const achado = compativeis[0];
    return achado ? { id: achado.id, nome: achado.name ?? '' } : null;
  }

  /**
   * A identidade da cliente para este agendamento.
   *
   * Ordem: id que a Voltr guardou (se sobreviver à conferência) → busca por
   * telefone → cadastro novo. Devolve `criado` para a ponte saber se nasceu
   * gente nova — é esse número que denuncia duplicata.
   *
   * O id do payload NÃO é confiança cega. Ele passa por duas portas:
   *  1. tem de ser da MESMA empresa da requisição — buscar sem o `companyId` no
   *     WHERE deixaria a IA de um salão puxar a cliente de outro;
   *  2. o telefone do cadastro tem de ser o mesmo do payload. Se o id aponta
   *     para OUTRA pessoa (conversa trocada, cache velho da ponte), o telefone
   *     manda — ele é quem provou a conversa no WhatsApp, o id não provou nada.
   * Falhando qualquer uma, o id é IGNORADO em silêncio e a busca por telefone
   * assume. Recusar a requisição só faria a ponte perder o agendamento por um
   * cache velho dela.
   */
  private async resolverCliente(
    companyId: string,
    telefone: string,
    opts: { customerId?: string; nome?: string },
  ): Promise<{ id: string; nome: string; criado: boolean }> {
    const digitos = digitosDe(telefone);
    if (digitos.length < 8) {
      throw new BadRequestException('Telefone inválido.');
    }

    const idInformado = String(opts.customerId ?? '').trim();
    if (idInformado) {
      const guardado: ClienteBruto | null =
        await this.prisma.client.customer.findFirst({
          // `companyId` no WHERE é o isolamento: id de outro salão não existe aqui.
          where: { id: idInformado, companyId },
          select: { id: true, name: true, phone: true },
        });
      const telefoneBate =
        !!guardado && digitosDe(guardado.phone).endsWith(digitos.slice(-8));
      if (guardado && telefoneBate) {
        return { id: guardado.id, nome: guardado.name ?? '', criado: false };
      }
      this.logger.warn(
        `customerId ${idInformado} recusado (company=${companyId}, ` +
          `${guardado ? 'telefone não confere' : 'não é desta empresa'}); ` +
          'caindo na busca por telefone.',
      );
    }

    const compativeis = await this.candidatosPorTelefone(companyId, digitos, {
      active: true,
    });
    if (this.ambiguo(compativeis)) {
      throw new BadRequestException(
        'Mais de uma cliente com este telefone. Um atendente precisa resolver.',
      );
    }
    const achado = compativeis[0];
    if (achado) {
      return { id: achado.id, nome: achado.name ?? '', criado: false };
    }

    // Último recurso. Quem deveria perguntar o nome é a IA, na conversa; aqui só
    // limpamos o que chegou. Sem nome utilizável fica "Cliente 7434" — feio, mas
    // honesto: melhor do que gravar um emoji ou inventar um nome no cadastro.
    const nome = limparNome(opts.nome) || `Cliente ${digitos.slice(-4)}`;
    const criado = await this.prisma.client.customer.create({
      data: { companyId, name: nome, phone: telefone },
      select: { id: true },
    });
    return { id: criado.id, nome, criado: true };
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
