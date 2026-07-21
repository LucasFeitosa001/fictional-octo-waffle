import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Central de Ajuda — hooks compartilhados.
 *
 * Backend: apps/api/src/modules/help/help.controller.ts (rotas públicas).
 * Todos os artigos vêm de `docs/help/*.md` via upsert no boot do NestJS.
 */

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
  icon: string | null;
  faq: boolean;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /help/articles/faq — cards da seção "Perguntas frequentes". */
export function useHelpFaq(limit?: number) {
  return useQuery({
    queryKey: ['help', 'faq', limit ?? null],
    queryFn: () =>
      api.get<HelpArticle[]>('/help/articles/faq', {
        limit: limit ? String(limit) : undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * GET /help/search?q=… — resultados do dropdown de busca.
 * `enabled` só dispara quando `q` tem 2+ caracteres pra evitar chamadas ruidosas
 * enquanto o usuário digita; o debounce fica por conta do consumidor.
 */
export function useHelpSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ['help', 'search', query],
    queryFn: () => api.get<HelpArticle[]>('/help/search', { q: query }),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  });
}

/** GET /help/articles/:slug — artigo completo (body em markdown). */
export function useHelpArticle(slug: string | undefined) {
  return useQuery({
    queryKey: ['help', 'article', slug ?? null],
    queryFn: () => api.get<HelpArticle>(`/help/articles/${slug}`),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * GET /help/articles?category=… — lista filtrada por categoria.
 * Sem categoria ⇒ lista completa (útil pra "todos os artigos" de uma seção).
 */
export function useHelpCategoryList(category: string | undefined) {
  return useQuery({
    queryKey: ['help', 'category', category ?? null],
    queryFn: () =>
      api.get<HelpArticle[]>('/help/articles', {
        category: category || undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });
}
