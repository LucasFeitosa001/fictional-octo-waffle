import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader } from '../components/PageHeader';
import { MobileBackHeader } from '../components/MobileBackHeader';
import { LoadingState } from '../components/States';
import { Button } from '@heroui/react';
import { useCustomers } from '../lib/queries';
import {
  useGerarDocumento,
  useModelosDeDocumento,
  useSalvarModelosDeDocumento,
  useVariaveisDeDocumento,
  type DocumentoGerado,
  type ModeloDeDocumento,
  type TipoDeDocumento,
} from '../lib/queries/documentos';

/**
 * MÓDULO "GERADOR DE DOCUMENTOS" — ver estudo 124.
 *
 * Duas metades: GERAR (escolher modelo + cliente e imprimir) e MODELOS (editar o
 * texto). A geração usa os dados vivos do cadastro; nada é guardado depois de
 * impresso.
 *
 * A impressão reaproveita o mecanismo do recibo da comanda: um nó irmão do
 * `#root` (`#sp-print-root`) que o `@media print` do index.css deixa visível
 * enquanto esconde a aplicação. `window.open` + `document.write` morre em
 * bloqueador de pop-up e no PWA do iOS. Ver estudo 49.
 */

const TIPOS: { valor: TipoDeDocumento; rotulo: string }[] = [
  { valor: 'contrato', rotulo: 'Contrato' },
  { valor: 'termo', rotulo: 'Termo' },
  { valor: 'recibo', rotulo: 'Recibo' },
  { valor: 'outro', rotulo: 'Outro' },
];

function Impressao({
  documento,
  onDone,
}: {
  documento: DocumentoGerado | null;
  onDone: () => void;
}) {
  const jaImprimiu = useRef(false);

  useEffect(() => {
    if (!documento) {
      jaImprimiu.current = false;
      return;
    }
    if (jaImprimiu.current) return;
    jaImprimiu.current = true;
    const encerra = () => onDone();
    window.addEventListener('afterprint', encerra, { once: true });
    // Dois frames: o primeiro monta o portal, o segundo garante que o texto já
    // entrou no layout antes de o diálogo capturar a página.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print()),
    );
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', encerra);
    };
  }, [documento, onDone]);

  const raiz = useMemo(() => {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById('sp-print-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sp-print-root';
      document.body.appendChild(el);
    }
    return el;
  }, []);

  if (!documento || !raiz) return null;

  return createPortal(
    <>
      <style>{`@page { size: A4; margin: 18mm 16mm; }`}</style>
      <div
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '12pt',
          lineHeight: 1.6,
          color: '#000',
          whiteSpace: 'pre-wrap',
        }}
      >
        {documento.texto}
      </div>
    </>,
    raiz,
  );
}

export function DocumentosPage() {
  const modelosQuery = useModelosDeDocumento();
  const variaveis = useVariaveisDeDocumento();
  const salvarModelos = useSalvarModelosDeDocumento();
  const gerar = useGerarDocumento();

  const [aba, setAba] = useState<'gerar' | 'modelos'>('gerar');
  const [modeloId, setModeloId] = useState('');
  const [busca, setBusca] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [documento, setDocumento] = useState<DocumentoGerado | null>(null);
  const [imprimindo, setImprimindo] = useState<DocumentoGerado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<ModeloDeDocumento[] | null>(null);

  const clientes = useCustomers(busca, 1, 8);
  const modelos = modelosQuery.data ?? [];
  const emEdicao = rascunho ?? modelos;

  const clienteEscolhido = (clientes.data?.data ?? []).find((c) => c.id === clienteId);

  async function gerarAgora() {
    setErro(null);
    setDocumento(null);
    if (!modeloId || !clienteId) {
      setErro('Escolha o modelo e o cliente.');
      return;
    }
    try {
      setDocumento(await gerar.mutateAsync({ modeloId, customerId: clienteId }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o documento.');
    }
  }

  return (
    <>
      <MobileBackHeader title="Documentos" onBack={() => window.history.back()} />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <PageHeader
          title="Documentos"
          subtitle="Contratos, termos e recibos preenchidos com os dados do cliente."
        />

        <div className="flex gap-1 rounded-xl bg-canvas p-1">
          {(['gerar', 'modelos'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                aba === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-ink'
              }`}
            >
              {id === 'gerar' ? 'Gerar documento' : 'Modelos'}
            </button>
          ))}
        </div>

        {modelosQuery.isLoading ? (
          <LoadingState label="Carregando modelos…" />
        ) : aba === 'gerar' ? (
          <section className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-ink">Modelo</span>
              <select
                value={modeloId}
                onChange={(e) => setModeloId(e.target.value)}
                className="rounded-lg border border-line bg-card p-2.5 text-sm"
              >
                <option value="">Escolha o modelo…</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-ink">Cliente</span>
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setClienteId('');
                }}
                placeholder="Buscar pelo nome…"
                className="rounded-lg border border-line bg-card p-2.5 text-sm"
              />
            </label>

            {busca && !clienteId && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {(clientes.data?.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setClienteId(c.id);
                        setBusca(c.name);
                      }}
                      className="w-full rounded-lg border border-line bg-card p-2.5 text-left text-sm hover:border-primary"
                    >
                      {c.name}
                      {c.phone ? <span className="text-muted-ink"> · {c.phone}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {erro && (
              <p className="m-0 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                {erro}
              </p>
            )}

            <div>
              <Button
                variant="primary"
                isDisabled={gerar.isPending || !modeloId || !clienteId}
                onClick={() => void gerarAgora()}
              >
                {gerar.isPending ? 'Gerando…' : 'Gerar'}
              </Button>
            </div>

            {documento && (
              <div className="flex flex-col gap-3">
                {/* O aviso vem ANTES da prévia: é o que evita imprimir um termo
                    com o CPF em branco e só descobrir na hora de assinar. */}
                {documento.faltando.length > 0 && (
                  <p className="m-0 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                    Sem preenchimento no cadastro
                    {clienteEscolhido ? ` de ${clienteEscolhido.name}` : ''}:{' '}
                    <strong>{documento.faltando.join(', ')}</strong>. O documento sai com
                    esses espaços em branco.
                  </p>
                )}
                <div className="whitespace-pre-wrap rounded-2xl border border-line bg-card p-5 font-serif text-sm leading-relaxed text-foreground">
                  {documento.texto}
                </div>
                <div>
                  <Button variant="primary" onClick={() => setImprimindo(documento)}>
                    Imprimir ou salvar em PDF
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <p className="m-0 text-sm text-muted-ink">
              Use as variáveis entre chaves — elas são trocadas pelos dados reais na
              hora de gerar:{' '}
              {(variaveis.data ?? []).map((v) => (
                <code
                  key={v.chave}
                  title={v.descricao}
                  className="mr-1 rounded bg-canvas px-1.5 py-0.5 text-xs"
                >
                  {`{${v.chave}}`}
                </code>
              ))}
            </p>

            {emEdicao.map((m, i) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={m.nome}
                    onChange={(e) => {
                      const copia = [...emEdicao];
                      copia[i] = { ...m, nome: e.target.value };
                      setRascunho(copia);
                    }}
                    className="flex-1 rounded-lg border border-line bg-canvas p-2 text-sm font-semibold"
                  />
                  <select
                    value={m.tipo}
                    onChange={(e) => {
                      const copia = [...emEdicao];
                      copia[i] = { ...m, tipo: e.target.value as TipoDeDocumento };
                      setRascunho(copia);
                    }}
                    className="rounded-lg border border-line bg-canvas p-2 text-sm"
                  >
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={m.corpo}
                  rows={10}
                  onChange={(e) => {
                    const copia = [...emEdicao];
                    copia[i] = { ...m, corpo: e.target.value };
                    setRascunho(copia);
                  }}
                  className="w-full rounded-lg border border-line bg-canvas p-3 font-mono text-xs leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setRascunho(emEdicao.filter((_, j) => j !== i))}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setRascunho([
                    ...emEdicao,
                    {
                      id: `doc-${Date.now().toString(36)}`,
                      nome: 'Novo documento',
                      tipo: 'outro',
                      corpo: '',
                    },
                  ])
                }
              >
                Novo modelo
              </Button>
              <Button
                variant="primary"
                isDisabled={!rascunho || salvarModelos.isPending}
                onClick={async () => {
                  if (!rascunho) return;
                  await salvarModelos.mutateAsync(rascunho);
                  setRascunho(null);
                }}
              >
                {salvarModelos.isPending ? 'Salvando…' : 'Salvar modelos'}
              </Button>
            </div>
          </section>
        )}
      </div>

      <Impressao documento={imprimindo} onDone={() => setImprimindo(null)} />
    </>
  );
}
