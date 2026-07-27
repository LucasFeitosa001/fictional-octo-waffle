import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';

import { ClienteBlocosLaterais } from './ClienteBlocosLaterais';
import { CustomerAvatar } from './CustomerPickerDrawer';
import { IconChevron, IconWhatsApp } from './icons';
import { formatPhone } from '../lib/format';
import { useCustomer, useCreateNote } from '../lib/queries/clientes';
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
  onSelecionarCliente,
}: {
  /** Cliente do pacote. Sem id o Belasis mostra só o avatar vazio (f_0153). */
  customerId: string | null | undefined;
  /** Nome já conhecido pelo chamador — evita a coluna piscar enquanto o GET do cliente sobe. */
  nome?: string | null;
  /** Idem telefone/avatar: o "Novo pacote" já os tem do picker e não precisa esperar nada. */
  telefone?: string | null;
  avatarUrl?: string | null;
  /** Sem cliente: abre o seletor. Sem callback o botão não aparece (drawer de visualização). */
  onSelecionarCliente?: () => void;
}) {
  const id = customerId ?? null;
  // O detalhe do pacote só traz `{ id, name }` (packages.service.ts:117), então telefone e foto
  // vêm daqui. `enabled: Boolean(id)` no hook: sem cliente nenhuma request sai.
  const clienteQ = useCustomer(id);
  const { can } = useCan();

  const [adicionandoNota, setAdicionandoNota] = useState(false);
  // Trocar de pacote/cliente com a caixa aberta deixaria um rascunho apontando para o cliente
  // errado — fecha na troca.
  useEffect(() => setAdicionandoNota(false), [id]);

  const cliente = clienteQ.data;
  const nomeFinal = nome ?? cliente?.name ?? null;
  const telefoneFinal = telefone ?? cliente?.phone ?? null;
  const fotoFinal = avatarUrl ?? cliente?.avatarUrl ?? null;

  return (
    <aside className="flex shrink-0 flex-col gap-4 lg:w-[260px]">
      {/* Cabeçalho: avatar grande, nome e telefone com a pílula "Conversar" ao lado (f_0148). */}
      <div className="flex flex-col items-center gap-2 text-center">
        <CustomerAvatar name={nomeFinal ?? ''} avatarUrl={fotoFinal} size={96} />
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
        blocos={['pacotes', 'anotacoes']}
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

/**
 * "+ Adicionar" das Anotações. O vídeo mostra o link mas nunca o clica, então em vez de inventar
 * um fluxo é o mínimo do par listar/criar da ficha do cliente — mesma caixa inline do drawer de
 * comanda (ComandaDrawer.tsx:666), e não um sub-drawer, para não empilhar portal sobre portal.
 */
function NovaAnotacaoInline({
  customerId,
  onDone,
}: {
  customerId: string;
  onDone: () => void;
}) {
  const create = useCreateNote(customerId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Digite uma anotação.');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({ text: trimmed });
      // A mutação invalida ['customer-notes', id]: o bloco acima se atualiza sozinho.
      setText('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar a anotação.');
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-soft-border)] bg-white p-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Escreva uma anotação…"
        aria-label="Nova anotação"
        className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-ink focus:border-primary"
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setText('');
            setError(null);
            onDone();
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          isDisabled={create.isPending || !text.trim()}
          onClick={handleAdd}
        >
          {create.isPending ? 'Salvando…' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}
