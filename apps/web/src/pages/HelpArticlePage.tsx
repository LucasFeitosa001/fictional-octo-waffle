import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Card } from '@heroui/react';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { IconChevron, IconInfo, IconMessage } from '../components/icons';
import { useHelpArticle } from '../hooks/useHelpArticles';

/**
 * Artigo individual da Central de Ajuda.
 *
 * Rota: /ajuda/artigo/:slug — renderiza o corpo (markdown) do artigo
 * retornado por GET /help/articles/:slug. Cabeçalho tem breadcrumb pra
 * voltar pra /ajuda e o rodapé oferece o chat de ajuda como escape.
 *
 * O chat propriamente dito ainda é um MVP; por ora o botão só volta pra
 * central; quando o widget de chat estiver plugado, este handler abre ele.
 */
export function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const article = useHelpArticle(slug);

  function goBack() {
    navigate('/ajuda');
  }

  return (
    <div className="max-w-3xl">
      <button
        type="button"
        onClick={goBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <IconChevron size={16} className="rotate-90" /> Voltar para a central
      </button>

      {article.isLoading ? (
        <LoadingState />
      ) : article.isError ? (
        <ErrorState
          message="Não foi possível carregar este artigo."
          onRetry={() => article.refetch()}
        />
      ) : !article.data ? (
        <EmptyState
          icon={<IconInfo size={28} />}
          title="Artigo não encontrado"
          description="Ele pode ter sido removido ou o link está incorreto."
          action={
            <Button variant="primary" onClick={goBack}>
              Voltar para a central
            </Button>
          }
        />
      ) : (
        <>
          <Card className="border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
            <Card.Content className="p-6 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                  {article.data.category}
                </span>
                {article.data.faq && (
                  <span className="rounded-full border border-[var(--color-soft-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    FAQ
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {article.data.title}
              </h1>
              {article.data.excerpt && (
                <p className="mt-2 text-sm text-muted">{article.data.excerpt}</p>
              )}

              <div className="prose prose-sm mt-6 max-w-none text-foreground prose-headings:font-semibold prose-headings:text-foreground prose-p:leading-relaxed prose-p:text-foreground prose-strong:text-foreground prose-a:text-gold-strong prose-a:no-underline hover:prose-a:underline prose-li:text-foreground prose-code:rounded prose-code:bg-[var(--color-soft-border)]/40 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {article.data.body}
                </ReactMarkdown>
              </div>
            </Card.Content>
          </Card>

          {/* CTA de chat */}
          <Card className="mt-4 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
            <Card.Content className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-strong">
                  <IconMessage size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Ainda com dúvidas?
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Abra o chat de ajuda e converse com o assistente do SalonPass.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  // Placeholder: o widget de chat vive no shell (dispararemos
                  // um evento custom quando ele estiver plugado). Por ora
                  // levamos o usuário pra central pra usar a busca.
                  goBack();
                }}
              >
                Abrir o chat
              </Button>
            </Card.Content>
          </Card>
        </>
      )}
    </div>
  );
}
