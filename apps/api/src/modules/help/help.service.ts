import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { PrismaService } from '../../prisma/prisma.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface HelpFrontmatter {
  slug?: string;
  title?: string;
  category?: string;
  tags?: string[];
  excerpt?: string;
  icon?: string | null;
  faq?: boolean;
}

/**
 * Central de Ajuda — Belasis Etapa 2.
 *
 * - Artigos vivem em `docs/help/*.md` com frontmatter YAML e são carregados
 *   no boot (OnModuleInit) via upsert por slug, para que edição de um .md
 *   se reflita em prod sem migration.
 * - Chat usa Claude Haiku (ANTHROPIC_API_KEY). Sem chave, retorna fallback
 *   apontando para a Base de Conhecimento.
 */
@Injectable()
export class HelpService implements OnModuleInit {
  private readonly logger = new Logger(HelpService.name);
  private static readonly CHAT_MODEL = 'claude-haiku-4-5-20251001';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      const count = await this.loadArticlesFromDisk();
      this.logger.log(`Help articles carregados: ${count}`);
    } catch (err) {
      this.logger.warn(`Falha ao carregar artigos: ${(err as Error).message}`);
    }
  }

  /**
   * Localiza docs/help/ subindo até a raiz do monorepo. Retorna null se não
   * existir (ex.: ambiente onde os .md não foram publicados ainda).
   */
  private resolveDocsDir(): string | null {
    const candidates: string[] = [];
    let cur = process.cwd();
    for (let i = 0; i < 6; i++) {
      candidates.push(join(cur, 'docs', 'help'));
      const parent = resolve(cur, '..');
      if (parent === cur) break;
      cur = parent;
    }
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  }

  /**
   * Lê docs/help/*.md, parseia frontmatter e faz upsert por slug.
   * Retorna número de artigos processados.
   */
  async loadArticlesFromDisk(): Promise<number> {
    const dir = this.resolveDocsDir();
    if (!dir) {
      this.logger.warn('docs/help/ não encontrado — nenhum artigo carregado.');
      return 0;
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    let loaded = 0;
    for (const file of files) {
      try {
        const raw = readFileSync(join(dir, file), 'utf8');
        const parsed = matter(raw);
        const fm = parsed.data as HelpFrontmatter;
        const slug = fm.slug ?? file.replace(/\.md$/, '');
        const title = fm.title ?? slug;
        const category = fm.category ?? 'geral';
        const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : [];
        const excerpt = fm.excerpt ?? this.deriveExcerpt(parsed.content);
        const icon = fm.icon ?? null;
        const faq = fm.faq === true;
        const body = parsed.content.trim();

        await this.prisma.client.helpArticle.upsert({
          where: { slug },
          create: { slug, title, category, tags, excerpt, icon, faq, body, updatedAt: new Date() },
          update: { title, category, tags, excerpt, icon, faq, body, updatedAt: new Date() },
        });
        loaded++;
      } catch (err) {
        this.logger.warn(`Ignorando ${file}: ${(err as Error).message}`);
      }
    }
    return loaded;
  }

  private deriveExcerpt(body: string): string {
    const clean = body.replace(/^#.*$/gm, '').replace(/\n{2,}/g, '\n').trim();
    return clean.slice(0, 180);
  }

  /**
   * Lista artigos (opcional filtro por categoria), FAQ primeiro depois título.
   */
  async list(category?: string) {
    return this.prisma.client.helpArticle.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ faq: 'desc' }, { title: 'asc' }],
    });
  }

  async listFaq(limit = 6) {
    const take = Math.min(Math.max(limit, 1), 50);
    return this.prisma.client.helpArticle.findMany({
      where: { faq: true },
      orderBy: { title: 'asc' },
      take,
    });
  }

  async getBySlug(slug: string) {
    return this.prisma.client.helpArticle.findUnique({ where: { slug } });
  }

  /**
   * Busca ILIKE em título/body/tags. Usa `contains` para title/body e `has`
   * para tags. Ordena FAQ primeiro para ranqueamento simples.
   */
  async search(q: string, limit = 20) {
    const query = (q ?? '').trim();
    const take = Math.min(Math.max(limit, 1), 50);
    if (!query) return [];
    return this.prisma.client.helpArticle.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
        ],
      },
      orderBy: [{ faq: 'desc' }, { title: 'asc' }],
      take,
    });
  }

  /**
   * Chat com Claude Haiku, ancorado nos 3 artigos mais relevantes à pergunta.
   * Sem ANTHROPIC_API_KEY, retorna fallback determinístico.
   */
  async chat(
    message: string,
    history: ChatMessage[] = [],
  ): Promise<{ reply: string; fallback?: boolean }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        reply: 'A IA não está configurada. Consulte a Base de Conhecimento →',
        fallback: true,
      };
    }
    const msg = (message ?? '').trim();
    if (!msg) {
      return { reply: 'Envie uma pergunta sobre o SalonPass.', fallback: true };
    }

    const relevant = await this.search(msg, 3);
    const context = relevant
      .map((a) => `## ${a.title}\n${a.body}`)
      .join('\n\n---\n\n');

    const system =
      'Você é o assistente do SalonPass, ERP para salões de beleza. Responda em português. ' +
      'Base seu conhecimento nestes artigos:\n\n' +
      (context || '(sem artigos relevantes indexados)');

    const messages = [
      ...history
        .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: msg },
    ];

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: HelpService.CHAT_MODEL,
          max_tokens: 1024,
          system,
          messages,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.logger.warn(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
        return {
          reply: 'Não consegui responder agora. Consulte a Base de Conhecimento →',
          fallback: true,
        };
      }
      const json = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const reply =
        json.content
          ?.filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('\n')
          .trim() || 'Sem resposta.';
      return { reply };
    } catch (err) {
      this.logger.warn(`chat() falhou: ${(err as Error).message}`);
      return {
        reply: 'Não consegui responder agora. Consulte a Base de Conhecimento →',
        fallback: true,
      };
    }
  }
}
