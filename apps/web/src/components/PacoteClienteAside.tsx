import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ClienteBlocosLaterais,
  COLUNA_CLIENTE_W,
  NovaAnotacaoInline,
} from './ClienteBlocosLaterais';
import { IconChevron, IconUser, IconWhatsApp } from './icons';
import { formatPhone } from '../lib/format';
import { useCustomer } from '../lib/queries/clientes';
import { useCan } from '../lib/queries/permissions';

/**
 * Coluna esquerda dos DOIS drawers de pacote — "Visualizando pacote #N" (f_0148) e
 * "Novo pacote" (f_0153).
 *
 * É um arquivo só porque o Belasis desenha a mesma coluna nas duas telas; duas cópias
 * divergiriam no primeiro ajuste de texto. Só Pacotes e Anotações aparecem aqui: o bloco
 * "Assinaturas" é exclusivo do drawer de agendamento, e "Pacotes" nesta superfície NÃO tem
 * "+ Adicionar" (f_0148 mostra só o link em Anotações).
 *
 * Estudo: `.claude/studies/28-coluna-cliente-drawers-de-pacote.md`.
 */
export function PacoteClienteAside({
  customerId,
  nome,
  telefone,
  avatarUrl,
  buscarContato = true,
  onSelecionarCliente,
}: {
  /** Cliente do pacote. Sem id o Belasis mostra só o avatar vazio (f_0153). */
  customerId: string | null | undefined;
  /** Nome já conhecido pelo chamador — evita a coluna piscar enquanto o GET do cliente sobe. */
  nome?: string | null;
  /** Idem telefone/avatar, quando o chamador já os tem. */
  telefone?: string | null;
  avatarUrl?: string | null;
  /**
   * Buscar telefone/foto em `GET /customers/:id`. O detalhe do pacote não traz nenhum dos dois
   * (packages.service.ts:117 só seleciona id+name), então lá é obrigatório; o "Novo pacote"
   * recebe tudo do picker e passa `false` para não gastar a request.
   */
  buscarContato?: boolean;
  /** Sem cliente: abre o seletor. Sem callback o botão não aparece (drawer de visualização). */
  onSelecionarCliente?: () => void;
}) {
  const id = customerId ?? null;
  // `enabled: Boolean(id)` no hook: passar null aqui não dispara request nenhuma.
  const clienteQ = useCustomer(buscarContato ? id : null);
  const { can } = useCan();

  const navigate = useNavigate();
  const [adicionandoNota, setAdicionandoNota] = useState(false);
  // Trocar de pacote/cliente com a caixa aberta deixaria um rascunho apontando para o cliente
  // errado — fecha na troca.
  useEffect(() => setAdicionandoNota(false), [id]);

  const cliente = clienteQ.data;
  const nomeFinal = nome ?? cliente?.name ?? null;
  const telefoneFinal = telefone ?? cliente?.phone ?? null;
  const fotoFinal = avatarUrl ?? cliente?.avatarUrl ?? null;

  return (
    // `order-2 … lg:order-1`: no MOBILE a coluna do cliente vai para DEPOIS do
    // conteúdo do pacote, igual ao ComandaDrawer.tsx:362. Estes drawers abrem em
    // FullDrawer sem `widthClass` (PacotePerfilModal.tsx:92), então no celular são
    // bottom-sheet de tela cheia e o scroll começava por 96px de avatar + "Não há
    // pacotes disponíveis". Os dois chamadores marcam a própria coluna de conteúdo
    // com `order-1 lg:order-2` (PacotePerfilModal.tsx:207, PacotesPage.tsx:1360);
    // o DOM segue com o cliente antes, que é o contexto para leitor de tela.
    <aside className={`order-2 flex shrink-0 flex-col gap-4 lg:order-1 ${COLUNA_CLIENTE_W}`}>
      {/* Cabeçalho: avatar grande, nome e telefone com a pílula "Conversar" ao lado (f_0148). */}
      <div className="flex flex-col items-center gap-2 text-center">
        {/* Avatar de 96px desenhado aqui, e não com <CustomerAvatar>: as iniciais dele são fixas
            em 13px e ficariam perdidas num círculo desse tamanho. O Belasis usa o boneco genérico
            quando não há foto (f_0148 e f_0153), que é o que este ramo faz. */}
        {fotoFinal ? (
          <img src={fotoFinal} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <span
            className="grid h-24 w-24 place-items-center rounded-full bg-cream text-primary/70"
            aria-hidden
          >
            <IconUser size={44} />
          </span>
        )}
        {nomeFinal && (
          <div className="w-full truncate text-base font-semibold text-foreground">{nomeFinal}</div>
        )}
        {telefoneFinal && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-ink">{formatPhone(telefoneFinal)}</span>
            <a
              href={`https://wa.me/${telefoneFinal.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success transition-colors hover:bg-success/25"
            >
              <IconWhatsApp size={12} /> Conversar
            </a>
          </div>
        )}
        {!id && onSelecionarCliente && (
          // f_0153: sem cliente a coluna tem só o avatar vazio e o seletor. É o MESMO picker do
          // campo "Cliente" do formulário, não um fluxo paralelo.
          <button
            type="button"
            onClick={onSelecionarCliente}
            className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 text-left text-xs text-muted-ink"
          >
            <span>Busque por um cliente</span>
            <IconChevron size={14} className="shrink-0 text-muted-ink" />
          </button>
        )}
      </div>

      {/* Pacotes / Anotações — some sozinho enquanto não há cliente (o componente devolve null). */}
      <ClienteBlocosLaterais
        customerId={id}
        // f_0148: o drawer de pacote mostra Informações e Pacotes, mas NÃO Assinaturas.
        blocos={['informacoes', 'pacotes', 'anotacoes']}
        onAbrirFicha={(aba) => navigate(`/clientes/${id}?tab=${aba}`)}
        // POST /customers/:id/notes exige `clientes:manage`; sem a permissão nem o link aparece.
        onAdicionarAnotacao={can('clientes:manage') ? () => setAdicionandoNota(true) : undefined}
      />
      {adicionandoNota && id && (
        // Anotações é o último bloco, então a caixa nasce colada nele.
        <NovaAnotacaoInline customerId={id} onDone={() => setAdicionandoNota(false)} />
      )}
    </aside>
  );
}

