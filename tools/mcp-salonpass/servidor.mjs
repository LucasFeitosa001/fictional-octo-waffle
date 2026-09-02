#!/usr/bin/env node
/**
 * Servidor MCP do SalonPass — dados 100% reais, somente leitura (estudo 168).
 *
 * Fala com a API oficial, nunca com o banco: autentica como um usuário real e
 * herda o escopo multi-tenant, as permissões e as regras de negócio das
 * consultas. "Dados reais" também significa "os mesmos números que a tela
 * mostra" — e isso só a API garante.
 *
 * Credenciais por ambiente (nunca no código):
 *   SALONPASS_API_URL   ex.: https://mfgudjvzp2.us-east-1.awsapprunner.com/api/v1
 *   SALONPASS_EMAIL     login do salão
 *   SALONPASS_PASSWORD  senha
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Credenciais também podem vir de um `.env` AO LADO deste arquivo (gitignorado)
// — mais simples de configurar por máquina do que exportar variáveis no shell.
// O ambiente do processo tem prioridade sobre o arquivo.
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
  for (const linha of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  // sem .env — segue só com o ambiente
}

const API = (process.env.SALONPASS_API_URL ?? '').trim().replace(/\/+$/, '');
const EMAIL = (process.env.SALONPASS_EMAIL ?? '').trim();
const SENHA = process.env.SALONPASS_PASSWORD ?? '';

if (!API || !EMAIL || !SENHA) {
  console.error(
    'mcp-salonpass: defina SALONPASS_API_URL, SALONPASS_EMAIL e SALONPASS_PASSWORD.',
  );
  process.exit(1);
}

// ── autenticação ────────────────────────────────────────────────────────────
let token = null;

/**
 * Origin explícito no login: o fetch do Node manda `Origin: null` em POST, e o
 * Better Auth recusa origin nula (`MISSING_OR_NULL_ORIGIN`) — o curl passa
 * porque não manda Origin nenhum. Enviamos o origin do próprio painel, que é
 * confiável para o servidor. Descoberto em runtime no estudo 168.
 */
const ORIGIN = process.env.SALONPASS_ORIGIN ?? 'https://app.salonpass.com.br';

async function login() {
  const r = await fetch(`${API}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  if (!r.ok) throw new Error(`Login recusado (${r.status}). Confira as credenciais.`);
  const j = await r.json();
  if (!j.token) throw new Error('Login não devolveu token.');
  token = j.token;
}

/** GET autenticado com relogin automático em 401 (token expira). */
async function apiGet(path) {
  if (!token) await login();
  let r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) {
    await login();
    r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!r.ok) {
    const corpo = await r.text();
    throw new Error(`${path} devolveu ${r.status}: ${corpo.slice(0, 300)}`);
  }
  return r.json();
}

// ── formatação: quem consome é um modelo conversando com gente do salão ─────
const dinheiro = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const dataBr = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dataHoraBr = (iso) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Fortaleza',
      })
    : '—';

const texto = (s) => ({ content: [{ type: 'text', text: s }] });

/** Query string sem chaves vazias. */
function qs(params) {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${new URLSearchParams(Object.fromEntries(p))}` : '';
}

// ── servidor e ferramentas ──────────────────────────────────────────────────
const server = new McpServer({ name: 'salonpass', version: '0.1.0' });

server.registerTool(
  'listar_comandas',
  {
    description:
      'Lista as comandas do salão (ticket, data, cliente, status, valor). Dados reais da API.',
    inputSchema: {
      status: z.enum(['open', 'finished', 'canceled']).optional()
        .describe('Filtra por status: open (aberta), finished (finalizada) ou canceled.'),
      limite: z.number().int().min(1).max(200).optional().describe('Máximo de linhas (padrão 30).'),
    },
  },
  async ({ status, limite }) => {
    const j = await apiGet(`/orders${qs({ limit: limite ?? 30 })}`);
    let rows = j.data ?? j ?? [];
    if (status) rows = rows.filter((o) => o.status === status);
    if (!rows.length) return texto('Nenhuma comanda encontrada.');
    const linhas = rows.map((o) =>
      `#${o.number} · ${dataBr(o.date)} · ${o.customer?.name ?? 'sem cliente'} · ` +
      `${o.status === 'finished' ? 'Finalizada' : o.status === 'canceled' ? 'Cancelada' : 'Em aberto'} · ${dinheiro(o.netTotal)}`,
    );
    return texto(`${rows.length} comanda(s):\n${linhas.join('\n')}`);
  },
);

server.registerTool(
  'listar_agendamentos',
  {
    description:
      'Lista os agendamentos num período (cliente, profissional, início e status). Datas no formato AAAA-MM-DD.',
    inputSchema: {
      de: z.string().optional().describe('Data inicial AAAA-MM-DD.'),
      ate: z.string().optional().describe('Data final AAAA-MM-DD.'),
    },
  },
  async ({ de, ate }) => {
    const j = await apiGet(`/appointments${qs({ from: de, to: ate })}`);
    const rows = j.data ?? j ?? [];
    if (!rows.length) return texto('Nenhum agendamento no período.');
    const nomeStatus = {
      scheduled: 'Agendado', unconfirmed: 'Não confirmado', confirmed: 'Confirmado',
      waiting: 'Aguardando', in_progress: 'Em atendimento', done: 'Concluído',
      finished: 'Finalizado', canceled: 'Cancelado',
    };
    const linhas = rows.slice(0, 100).map((a) =>
      `${dataHoraBr(a.start)} · ${a.customer?.name ?? 'sem cliente'} · ` +
      `${a.professional?.name ?? 'sem profissional'} · ${nomeStatus[a.status] ?? a.status}`,
    );
    return texto(`${rows.length} agendamento(s):\n${linhas.join('\n')}`);
  },
);

server.registerTool(
  'buscar_clientes',
  {
    description: 'Busca clientes por nome ou telefone.',
    inputSchema: { busca: z.string().describe('Nome (ou parte) ou telefone do cliente.') },
  },
  async ({ busca }) => {
    const j = await apiGet(`/customers${qs({ search: busca })}`);
    const rows = j.data ?? j ?? [];
    if (!rows.length) return texto(`Nenhum cliente encontrado para "${busca}".`);
    const linhas = rows.slice(0, 50).map((c) => `${c.name} · ${c.phone ?? 'sem telefone'}`);
    return texto(`${rows.length} cliente(s):\n${linhas.join('\n')}`);
  },
);

server.registerTool(
  'listar_servicos',
  { description: 'Lista os serviços do catálogo com preço e duração.', inputSchema: {} },
  async () => {
    const j = await apiGet('/services');
    const rows = (j.data ?? j ?? []).filter((s) => s.active !== false);
    if (!rows.length) return texto('Nenhum serviço cadastrado.');
    const linhas = rows.map((s) => `${s.name} · ${dinheiro(s.price)} · ${s.durationMin ?? '?'} min`);
    return texto(`${rows.length} serviço(s):\n${linhas.join('\n')}`);
  },
);

server.registerTool(
  'listar_produtos',
  {
    description:
      'Lista produtos com preço e estoque. Produtos com controle de estoque ligado mostram o saldo real.',
    inputSchema: { busca: z.string().optional().describe('Nome (ou parte) do produto.') },
  },
  async ({ busca }) => {
    const j = await apiGet(`/products${qs({ search: busca })}`);
    const rows = (j.data ?? j ?? []).filter((p) => p.active !== false);
    if (!rows.length) return texto('Nenhum produto encontrado.');
    const linhas = rows.slice(0, 100).map((p) => {
      const estoque = p.trackStock
        ? `estoque ${Number(p.stock)}${Number(p.stock) <= 0 ? ' (ESGOTADO)' : ''}`
        : 'estoque não controlado';
      return `${p.name} · ${dinheiro(p.salePrice)} · ${estoque}`;
    });
    return texto(`${rows.length} produto(s):\n${linhas.join('\n')}`);
  },
);

server.registerTool(
  'resumo_comissoes',
  {
    description:
      'Resumo de comissões por profissional num período: comissão, vales, bônus e líquido a pagar.',
    inputSchema: {
      de: z.string().optional().describe('Data inicial AAAA-MM-DD.'),
      ate: z.string().optional().describe('Data final AAAA-MM-DD.'),
    },
  },
  async ({ de, ate }) => {
    const j = await apiGet(`/commissions/summary${qs({ from: de, to: ate })}`);
    const rows = j.data ?? [];
    if (!rows.length) return texto('Nenhuma comissão no período.');
    const linhas = rows.map((r) =>
      `${r.professionalName} · comissão ${dinheiro(r.comissao)} · vales ${dinheiro(r.vales)} · ` +
      `líquido ${dinheiro(r.liquido)} · ${r.openCount} lançamento(s) em aberto`,
    );
    return texto(`${rows.length} profissional(is):\n${linhas.join('\n')}`);
  },
);

server.registerTool(
  'pagamentos_de_comissao',
  {
    description: 'Pagamentos de comissão já feitos: quem recebeu, quanto, quando e por qual forma.',
    inputSchema: {
      de: z.string().optional().describe('Data inicial AAAA-MM-DD.'),
      ate: z.string().optional().describe('Data final AAAA-MM-DD.'),
    },
  },
  async ({ de, ate }) => {
    const j = await apiGet(`/commission-payments${qs({ from: de, to: ate })}`);
    const rows = j.data ?? j ?? [];
    if (!rows.length) return texto('Nenhum pagamento de comissão no período.');
    const linhas = rows.slice(0, 100).map((p) =>
      `${dataBr(p.paidAt)} · ${p.professional?.name} · ${dinheiro(p.amount)} · ` +
      `${p.paymentMethodName ?? 'forma não informada'}`,
    );
    return texto(`${rows.length} pagamento(s):\n${linhas.join('\n')}`);
  },
);

server.registerTool(
  'visao_geral',
  {
    description:
      'Visão geral do período: vendas, serviços mais vendidos, faturamento por profissional e formas de pagamento.',
    inputSchema: {
      de: z.string().optional().describe('Data inicial AAAA-MM-DD.'),
      ate: z.string().optional().describe('Data final AAAA-MM-DD.'),
    },
  },
  async ({ de, ate }) => {
    const j = await apiGet(`/reports/overview${qs({ from: de, to: ate })}`);
    const partes = [];
    partes.push(`Vendas no período: ${dinheiro(j.salesTotal ?? 0)}`);
    if (j.topServices?.length) {
      partes.push('\nServiços mais vendidos:');
      for (const s of j.topServices.slice(0, 5)) partes.push(`- ${s.name}: ${s.count}x · ${dinheiro(s.total)}`);
    }
    if (j.topProfessionals?.length) {
      partes.push('\nFaturamento por profissional:');
      for (const p of j.topProfessionals.slice(0, 5)) partes.push(`- ${p.name}: ${dinheiro(p.total)}`);
    }
    if (j.paymentsByMethod?.length) {
      partes.push('\nPor forma de pagamento:');
      for (const m of j.paymentsByMethod) partes.push(`- ${m.name}: ${dinheiro(m.total)}`);
    }
    return texto(partes.join('\n'));
  },
);

// ── transporte ──────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`mcp-salonpass conectado (${EMAIL} → ${API}).`);
