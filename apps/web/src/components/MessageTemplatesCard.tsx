import { useEffect, useMemo, useState } from 'react';
import { Button, Input, TextArea, TextField } from '@heroui/react';
import { LoadingState, ErrorState } from './States';
import { useConfirm } from './ConfirmDialog';
import { apiErrorMessage } from '../lib/toast';
import { useCan } from '../lib/queries/permissions';
import {
  MESSAGE_TEMPLATE_KINDS,
  MESSAGE_TEMPLATE_META,
  renderTemplateSample,
  useMessageTemplates,
  useSaveMessageTemplates,
  type MessageTemplateKind,
} from '../lib/queries/messageTemplates';

/**
 * "Modelos de mensagem" — o texto de cada aviso automático de WhatsApp.
 *
 * Existe porque o dono cobrou: *"Tem que ter personalizacao"*. Antes só a
 * confirmação tinha modelo, escondido dentro do drawer do agendamento, e o
 * aviso AUTOMÁTICO ignorava esse modelo (mandava uma linha fixa do código).
 * Cancelamento e lembretes não tinham editor nenhum. Ver estudo 61.
 *
 * Modelo é TEXTO, não autorização: ligar/desligar envio é o card de cima
 * (padrão da conta) ou o toggle dentro do agendamento.
 */
export function MessageTemplatesCard() {
  const [kind, setKind] = useState<MessageTemplateKind>('confirmation');
  const { can } = useCan();
  const podeEditar = can('config:manage');
  const confirm = useConfirm();
  const query = useMessageTemplates(kind);
  const save = useSaveMessageTemplates(kind);
  const meta = MESSAGE_TEMPLATE_META[kind];

  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);

  const cfg = query.data;
  const selecionado = cfg?.templates.find((t) => t.id === selectedId) ?? null;

  // Carrega o modelo padrão ao abrir cada tipo (uma vez por tipo, para não
  // atropelar o que o dono está digitando).
  useEffect(() => {
    if (!cfg || carregadoPara === kind) return;
    const padrao =
      cfg.templates.find((t) => t.id === cfg.defaultTemplateId) ??
      cfg.templates[0];
    setSelectedId(padrao?.id ?? '');
    setMessage(padrao?.message ?? '');
    setNovoNome('');
    setErro(null);
    setCarregadoPara(kind);
  }, [cfg, carregadoPara, kind]);

  const preview = useMemo(
    () => renderTemplateSample(kind, message),
    [kind, message],
  );
  const alterado = Boolean(selecionado) && selecionado?.message !== message;

  function escolher(id: string) {
    setSelectedId(id);
    const escolhido = cfg?.templates.find((t) => t.id === id);
    setMessage(escolhido?.message ?? '');
    setErro(null);
  }

  /** Lista de customizados atual (o servidor nunca grava os embutidos). */
  function customizados() {
    return (cfg?.templates ?? [])
      .filter((t) => !t.builtIn)
      .map(({ id, label, message: texto }) => ({ id, label, message: texto }));
  }

  async function gravar(
    templates: Array<{ id: string; label: string; message: string }>,
    defaultTemplateId: string,
    onOk?: (novoId: string) => void,
  ) {
    setErro(null);
    try {
      await save.mutateAsync({ defaultTemplateId, templates });
      onOk?.(defaultTemplateId);
    } catch (err) {
      setErro(apiErrorMessage(err));
    }
  }

  async function salvarComoNovo() {
    const nome = novoNome.trim();
    if (!nome) {
      setErro('Dê um nome ao modelo (ex.: "Carinhoso curto").');
      return;
    }
    if (!message.trim()) {
      setErro('Escreva a mensagem antes de salvar.');
      return;
    }
    const id = `custom-${crypto.randomUUID()}`;
    await gravar(
      [...customizados(), { id, label: nome, message: message.trim() }],
      id,
      (novoId) => {
        setSelectedId(novoId);
        setNovoNome('');
      },
    );
  }

  async function salvarAlteracao() {
    if (!selecionado || selecionado.builtIn) return;
    if (!message.trim()) {
      setErro('A mensagem não pode ficar vazia.');
      return;
    }
    await gravar(
      customizados().map((t) =>
        t.id === selecionado.id ? { ...t, message: message.trim() } : t,
      ),
      cfg?.defaultTemplateId ?? selecionado.id,
    );
  }

  async function definirPadrao() {
    if (!selecionado) return;
    await gravar(customizados(), selecionado.id);
  }

  async function excluir() {
    if (!selecionado || selecionado.builtIn) return;
    const ok = await confirm({
      title: `Excluir o modelo "${selecionado.label}"?`,
      message:
        'O texto será apagado. Se ele era o padrão, o modelo nativo volta a valer.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    const restantes = customizados().filter((t) => t.id !== selecionado.id);
    const novoPadrao =
      cfg?.defaultTemplateId === selecionado.id
        ? ''
        : (cfg?.defaultTemplateId ?? '');
    await gravar(restantes, novoPadrao, () => setCarregadoPara(null));
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">
          Modelos de mensagem (WhatsApp)
        </h2>
        <p className="text-sm text-muted-ink">
          O texto de cada aviso. É este modelo — o marcado como padrão — que sai
          nas mensagens automáticas e no botão “Enviar confirmação” do
          agendamento. <strong>Escolher o texto não liga o envio</strong>: isso
          continua sendo o card acima ou o toggle dentro do agendamento.
        </p>
      </div>

      {/* Tipos: 2x2 no celular, 4 colunas no desktop */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 sm:grid-cols-4">
        {MESSAGE_TEMPLATE_KINDS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setKind(item);
              setCarregadoPara(null);
            }}
            className={[
              'min-h-10 rounded-lg px-2 text-xs font-semibold transition-colors sm:text-sm',
              kind === item
                ? 'bg-card text-ink shadow-sm'
                : 'text-muted-ink hover:text-ink',
            ].join(' ')}
          >
            {MESSAGE_TEMPLATE_META[item].short}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="mt-5">
          <LoadingState />
        </div>
      ) : query.isError || !cfg ? (
        <div className="mt-5">
          <ErrorState onRetry={() => query.refetch()} />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-ink">{meta.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-ink">
              {meta.description}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="text-xs font-semibold uppercase tracking-wide text-muted-ink"
              htmlFor={`modelo-${kind}`}
            >
              Modelo
            </label>
            <select
              id={`modelo-${kind}`}
              value={selectedId}
              onChange={(event) => escolher(event.target.value)}
              className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm text-ink outline-none focus:border-primary/50"
            >
              {cfg.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                  {template.builtIn ? ' · nativo' : ''}
                  {template.id === cfg.defaultTemplateId ? ' — em uso' : ''}
                </option>
              ))}
            </select>
            {selecionado?.builtIn && (
              <p className="text-xs text-muted-ink">
                Modelo nativo: o texto não é sobrescrito. Edite abaixo e salve
                como um modelo novo.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="text-xs font-semibold uppercase tracking-wide text-muted-ink"
              htmlFor={`texto-${kind}`}
            >
              Mensagem
            </label>
            <TextField
              value={message}
              onChange={setMessage}
              isDisabled={!podeEditar}
              aria-label={`Mensagem de ${meta.short}`}
            >
              <TextArea id={`texto-${kind}`} rows={7} />
            </TextField>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-ink">Variáveis:</span>
              {meta.variables.map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  title={variable.label}
                  disabled={!podeEditar}
                  onClick={() => setMessage((m) => `${m}${variable.token}`)}
                  className="rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {variable.token}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Como a cliente vê
            </span>
            <div className="whitespace-pre-wrap rounded-xl border border-line bg-canvas px-4 py-3 text-sm leading-relaxed text-ink">
              {preview || 'Escreva a mensagem para ver o exemplo.'}
            </div>
          </div>

          {erro && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {erro}
            </p>
          )}

          {podeEditar ? (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {selecionado && !selecionado.builtIn && (
                  <Button
                    variant="primary"
                    size="sm"
                    isDisabled={!alterado || save.isPending}
                    onPress={() => void salvarAlteracao()}
                  >
                    {save.isPending ? 'Salvando…' : 'Salvar alterações'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={
                    !selecionado ||
                    selecionado.id === cfg.defaultTemplateId ||
                    save.isPending
                  }
                  onPress={() => void definirPadrao()}
                >
                  Usar como padrão
                </Button>
                {selecionado && !selecionado.builtIn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={save.isPending}
                    onPress={() => void excluir()}
                  >
                    Excluir modelo
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    className="text-xs font-semibold uppercase tracking-wide text-muted-ink"
                    htmlFor={`novo-nome-${kind}`}
                  >
                    Salvar o texto acima como um modelo novo
                  </label>
                  <TextField
                    value={novoNome}
                    onChange={setNovoNome}
                    aria-label="Nome do novo modelo"
                  >
                    <Input
                      id={`novo-nome-${kind}`}
                      placeholder="Nome do modelo"
                    />
                  </TextField>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  isDisabled={save.isPending || !novoNome.trim()}
                  onPress={() => void salvarComoNovo()}
                >
                  Salvar como novo
                </Button>
              </div>
            </div>
          ) : (
            <p
              className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-muted-ink"
              role="note"
            >
              Os modelos valem para <strong>toda a empresa</strong>. Só
              administradores podem alterá-los — acima é somente leitura.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
