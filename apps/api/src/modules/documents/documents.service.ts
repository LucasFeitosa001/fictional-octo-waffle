import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * MÓDULO "GERADOR DE DOCUMENTOS" (`documents`).
 *
 * "Contratos, termos e recibos preenchidos com os dados do cliente e do
 * atendimento" — o texto que o dono publicou na tela de Adicionais. Ver estudo
 * 124.
 *
 * SEM TABELA NOVA: os modelos moram em `Setting` (companyId + key + valueJson),
 * que já existe e já é por empresa. Uma lista de modelos de texto não justifica
 * migração, ainda mais com o histórico de migrations divergente no banco local.
 *
 * O documento gerado NÃO é persistido. Ele é montado na hora, dos dados vivos do
 * cliente e do atendimento, e vai para a tela — imprimir ou salvar em PDF é o
 * navegador que faz. Guardar uma cópia congelada criaria uma segunda verdade
 * sobre o mesmo atendimento.
 */

/** Chave única em `Setting` onde a lista de modelos da empresa vive. */
const CHAVE = 'documents.templates';

const TIPOS = ['contrato', 'termo', 'recibo', 'outro'] as const;
export type TipoDeDocumento = (typeof TIPOS)[number];

export interface ModeloDeDocumento {
  id: string;
  nome: string;
  tipo: TipoDeDocumento;
  /** Texto com as variáveis entre chaves: "Eu, {cliente}, autorizo...". */
  corpo: string;
}

/**
 * As variáveis que o salão pode usar. A tela mostra esta lista; o que não está
 * aqui NÃO é substituído e sai escrito como está — erro visível é melhor que
 * espaço em branco num contrato.
 */
export const VARIAVEIS_DE_DOCUMENTO: { chave: string; descricao: string }[] = [
  { chave: 'cliente', descricao: 'Nome do cliente' },
  { chave: 'cpf', descricao: 'CPF do cliente, como está no cadastro' },
  { chave: 'rg', descricao: 'RG do cliente' },
  { chave: 'telefone', descricao: 'Telefone do cliente' },
  { chave: 'email', descricao: 'E-mail do cliente' },
  { chave: 'endereco', descricao: 'Endereço do cliente' },
  { chave: 'nascimento', descricao: 'Data de nascimento do cliente' },
  { chave: 'servico', descricao: 'Serviços do atendimento escolhido' },
  { chave: 'profissional', descricao: 'Quem atende' },
  { chave: 'data', descricao: 'Data do atendimento' },
  { chave: 'hora', descricao: 'Hora do atendimento' },
  { chave: 'valor', descricao: 'Valor do atendimento' },
  { chave: 'salao', descricao: 'Nome do seu salão' },
  { chave: 'hoje', descricao: 'Data de hoje, por extenso' },
];

const MODELOS_INICIAIS: ModeloDeDocumento[] = [
  {
    id: 'termo-consentimento',
    nome: 'Termo de consentimento',
    tipo: 'termo',
    corpo: `TERMO DE CONSENTIMENTO

Eu, {cliente}, CPF {cpf}, declaro que fui informado(a) sobre o procedimento {servico}, realizado por {profissional} em {data}, às {hora}, no estabelecimento {salao}.

Declaro estar ciente dos cuidados necessários antes e depois do procedimento, e que tive minhas dúvidas esclarecidas.

{hoje}


_______________________________
{cliente}`,
  },
  {
    id: 'recibo-atendimento',
    nome: 'Recibo de atendimento',
    tipo: 'recibo',
    corpo: `RECIBO

Recebi de {cliente} a quantia de {valor}, referente a {servico}, atendimento realizado por {profissional} em {data}.

{salao}
{hoje}


_______________________________
Assinatura`,
  },
];

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Modelos da empresa. Conta que nunca salvou recebe os dois exemplos em
   * MEMÓRIA — nada é gravado até o salão salvar, para ninguém herdar texto que
   * não escolheu ter.
   */
  async listar(companyId: string): Promise<ModeloDeDocumento[]> {
    const linha = await this.prisma.client.setting.findUnique({
      where: { companyId_key: { companyId, key: CHAVE } },
      select: { valueJson: true },
    });
    return this.ler(linha?.valueJson) ?? MODELOS_INICIAIS;
  }

  async salvar(
    companyId: string,
    modelos: ModeloDeDocumento[],
  ): Promise<ModeloDeDocumento[]> {
    const limpos = (Array.isArray(modelos) ? modelos : [])
      .filter((m) => m?.nome?.trim() && m?.corpo?.trim())
      .map((m) => ({
        id: (m.id || '').trim() || `doc-${Math.random().toString(36).slice(2, 10)}`,
        nome: m.nome.trim().slice(0, 120),
        tipo: TIPOS.includes(m.tipo) ? m.tipo : ('outro' as TipoDeDocumento),
        corpo: m.corpo.slice(0, 20_000),
      }));
    // Id repetido faria a tela editar dois modelos de uma vez.
    const vistos = new Set<string>();
    for (const m of limpos) {
      if (vistos.has(m.id)) m.id = `${m.id}-${vistos.size}`;
      vistos.add(m.id);
    }
    await this.prisma.client.setting.upsert({
      where: { companyId_key: { companyId, key: CHAVE } },
      create: { companyId, key: CHAVE, valueJson: limpos },
      update: { valueJson: limpos },
    });
    return limpos;
  }

  /**
   * Monta o documento com os dados REAIS.
   *
   * `appointmentId` é opcional de propósito: contrato e termo costumam sair
   * antes de existir atendimento. Sem ele, serviço/profissional/data/valor ficam
   * em branco — e entram na lista `faltando`, em vez de virar texto inventado.
   */
  async gerar(
    companyId: string,
    entrada: { modeloId: string; customerId: string; appointmentId?: string },
  ): Promise<{ nome: string; texto: string; faltando: string[] }> {
    const modelos = await this.listar(companyId);
    const modelo = modelos.find((m) => m.id === entrada.modeloId);
    if (!modelo) throw new BadRequestException('Modelo de documento não encontrado.');

    const cliente = await this.prisma.client.customer.findFirst({
      where: { id: entrada.customerId, companyId },
      select: {
        name: true,
        cpf: true,
        rg: true,
        phone: true,
        email: true,
        birthday: true,
        // Endereço é RELAÇÃO (`CustomerAddress`), não campo do cliente.
        addresses: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: {
            street: true,
            number: true,
            district: true,
            city: true,
            state: true,
            zip: true,
          },
        },
      },
    });
    if (!cliente) throw new BadRequestException('Cliente não encontrado nesta empresa.');

    const empresa = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { name: true, timezone: true },
    });
    const fuso = empresa?.timezone || 'America/Sao_Paulo';

    const agendamento = entrada.appointmentId
      ? await this.prisma.client.appointment.findFirst({
          where: { id: entrada.appointmentId, companyId },
          select: {
            start: true,
            professional: { select: { name: true } },
            items: { select: { price: true, service: { select: { name: true } } } },
          },
        })
      : null;

    const dinheiro = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const dia = (d: Date | null | undefined) =>
      d ? new Intl.DateTimeFormat('pt-BR', { timeZone: fuso }).format(d) : '';
    const hora = (d: Date | null | undefined) =>
      d
        ? new Intl.DateTimeFormat('pt-BR', {
            timeZone: fuso,
            hour: '2-digit',
            minute: '2-digit',
          }).format(d)
        : '';

    const end = cliente.addresses[0];
    const endereco = end
      ? [
          [end.street, end.number].filter(Boolean).join(', '),
          end.district,
          [end.city, end.state].filter(Boolean).join('/'),
          end.zip,
        ]
          .filter((parte) => parte && String(parte).trim())
          .join(' — ')
      : '';

    const total = (agendamento?.items ?? []).reduce(
      (soma, i) => soma + Number(i.price ?? 0),
      0,
    );

    const valores: Record<string, string> = {
      cliente: cliente.name ?? '',
      cpf: cliente.cpf ?? '',
      rg: cliente.rg ?? '',
      telefone: cliente.phone ?? '',
      email: cliente.email ?? '',
      endereco,
      nascimento: dia(cliente.birthday),
      servico: (agendamento?.items ?? [])
        .map((i) => i.service?.name)
        .filter((n): n is string => Boolean(n))
        .join(', '),
      profissional: agendamento?.professional?.name ?? '',
      data: dia(agendamento?.start),
      hora: hora(agendamento?.start),
      valor: total > 0 ? dinheiro.format(total) : '',
      salao: empresa?.name ?? '',
      hoje: new Intl.DateTimeFormat('pt-BR', {
        timeZone: fuso,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    };

    // O que o modelo PEDE e o cadastro não tem. A tela avisa antes de imprimir:
    // um termo com o CPF em branco só é descoberto na hora de assinar.
    const faltando = VARIAVEIS_DE_DOCUMENTO.map((v) => v.chave)
      .filter((chave) => modelo.corpo.includes(`{${chave}}`))
      .filter((chave) => !valores[chave]?.trim());

    const texto = Object.entries(valores).reduce(
      (acc, [chave, valor]) => acc.replace(new RegExp(`\\{${chave}\\}`, 'g'), valor),
      modelo.corpo,
    );

    return { nome: modelo.nome, texto, faltando };
  }

  private ler(valor: unknown): ModeloDeDocumento[] | null {
    if (!Array.isArray(valor)) return null;
    const lista = valor.filter(
      (m): m is ModeloDeDocumento =>
        Boolean(m) &&
        typeof (m as ModeloDeDocumento).id === 'string' &&
        typeof (m as ModeloDeDocumento).nome === 'string' &&
        typeof (m as ModeloDeDocumento).corpo === 'string',
    );
    return lista.length > 0 ? lista : null;
  }
}
