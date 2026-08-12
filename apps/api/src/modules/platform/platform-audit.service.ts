import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ACOES_COM_JUSTIFICATIVA,
  JUSTIFICATIVA_MINIMA,
  type PlatformAction,
} from './platform.constants';

/** Quem agiu — vem do guard, já validado. */
export type AtorAuditoria = {
  staffId: string | null;
  staffEmail: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type RegistroAuditoria = {
  action: PlatformAction;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  companyId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
};

/**
 * Campos que NUNCA entram na trilha, em qualquer profundidade.
 *
 * A auditoria é lida por mais gente do que o banco — é a tela mais aberta do
 * console. Copiar um hash de senha ou um token de sessão para dentro dela
 * transformaria o registro do incidente no próprio incidente.
 */
const CAMPOS_PROIBIDOS = new Set([
  'password',
  'passwordhash',
  'senha',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'clientsecret',
  'authorization',
  'cookie',
  'temporarypassword',
  'senhatemporaria',
]);

/** Teto de profundidade: um objeto ciclado ou gigante não pode travar o log. */
const PROFUNDIDADE_MAXIMA = 6;

/**
 * Remove campo sensível recursivamente e devolve algo serializável em JSON.
 * Valor omitido vira o literal '[omitido]' — some o conteúdo, fica o rastro de
 * que o campo existia, que é o que importa para entender a mudança.
 */
export function sanitizar(valor: unknown, profundidade = 0): unknown {
  if (valor === null || valor === undefined) return null;
  if (profundidade > PROFUNDIDADE_MAXIMA) return '[profundo demais]';

  if (valor instanceof Date) return valor.toISOString();

  const tipo = typeof valor;
  if (tipo === 'string' || tipo === 'number' || tipo === 'boolean') return valor;
  if (tipo === 'bigint') return (valor as bigint).toString();
  if (tipo === 'function' || tipo === 'symbol') return undefined;

  if (Array.isArray(valor)) {
    return valor.slice(0, 200).map((item) => sanitizar(item, profundidade + 1));
  }

  if (tipo === 'object') {
    // Objeto que NÃO é literal (Decimal do Prisma e afins) sabe se serializar
    // melhor do que campo a campo: um Decimal percorrido com Object.entries
    // vira {s,e,d} — os internos do decimal.js — em vez do número.
    //
    // O teste é o protótipo, não `instanceof Object`: TODO objeto é instância
    // de Object, então aquela comparação seria sempre verdadeira e o ramo,
    // morto. (Foi exatamente o erro da primeira versão deste arquivo.)
    const proto = Object.getPrototypeOf(valor);
    const ehLiteral = proto === Object.prototype || proto === null;
    const comToJSON = valor as { toJSON?: () => unknown };
    if (!ehLiteral && typeof comToJSON.toJSON === 'function') {
      try {
        return sanitizar(comToJSON.toJSON(), profundidade + 1);
      } catch {
        return String(valor);
      }
    }
    const saida: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
      if (CAMPOS_PROIBIDOS.has(chave.toLowerCase())) {
        saida[chave] = '[omitido]';
        continue;
      }
      const limpo = sanitizar(item, profundidade + 1);
      if (limpo !== undefined) saida[chave] = limpo;
    }
    return saida;
  }

  return String(valor);
}

@Injectable()
export class PlatformAuditService {
  private readonly log = new Logger('PlatformAudit');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida a justificativa exigida pela ação. Chamado ANTES de executar o
   * efeito — recusar depois de já ter trocado a senha não adianta nada.
   */
  exigirJustificativa(action: PlatformAction, reason?: string | null): string | null {
    if (!ACOES_COM_JUSTIFICATIVA.has(action)) return reason?.trim() || null;

    const limpo = (reason ?? '').trim();
    if (limpo.length < JUSTIFICATIVA_MINIMA) {
      throw new BadRequestException(
        `Descreva o motivo desta ação com pelo menos ${JUSTIFICATIVA_MINIMA} caracteres — ele fica registrado na auditoria.`,
      );
    }
    return limpo;
  }

  /**
   * Grava a trilha.
   *
   * NUNCA lança: uma falha ao auditar não pode desfazer nem esconder um efeito
   * que já aconteceu. O erro vai para o log do servidor, alto, para não sumir.
   * (A ordem correta é sempre: valida → executa → audita.)
   */
  async registrar(ator: AtorAuditoria, registro: RegistroAuditoria): Promise<void> {
    try {
      await this.prisma.client.platformAuditLog.create({
        data: {
          staffId: ator.staffId,
          staffEmail: ator.staffEmail,
          action: registro.action,
          targetType: registro.targetType,
          targetId: registro.targetId ?? null,
          targetLabel: registro.targetLabel ?? null,
          companyId: registro.companyId ?? null,
          reason: registro.reason ?? null,
          beforeJson: (sanitizar(registro.before) ?? undefined) as Prisma.InputJsonValue,
          afterJson: (sanitizar(registro.after) ?? undefined) as Prisma.InputJsonValue,
          ipAddress: ator.ip ?? null,
          userAgent: ator.userAgent?.slice(0, 500) ?? null,
        },
      });
    } catch (erro) {
      this.log.error(
        `FALHA AO AUDITAR ${registro.action} sobre ${registro.targetType}:${registro.targetId ?? '-'} por ${ator.staffEmail}`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  /** Consulta paginada da trilha, com filtros. */
  async listar(filtros: {
    staffId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    companyId?: string;
    busca?: string;
    de?: string;
    ate?: string;
    pagina?: number;
    porPagina?: number;
  }) {
    const pagina = Math.max(1, filtros.pagina ?? 1);
    const porPagina = Math.min(200, Math.max(1, filtros.porPagina ?? 50));

    const where: Prisma.PlatformAuditLogWhereInput = {};
    if (filtros.staffId) where.staffId = filtros.staffId;
    if (filtros.action) where.action = filtros.action;
    if (filtros.targetType) where.targetType = filtros.targetType;
    if (filtros.targetId) where.targetId = filtros.targetId;
    if (filtros.companyId) where.companyId = filtros.companyId;
    // Data ilegível é IGNORADA, não repassada ao Prisma: `new Date('abc')` gera
    // um Invalid Date que só estoura lá dentro, virando 500 numa tela de
    // consulta. Filtro inválido não é erro do operador, é filtro que não existe.
    const comoData = (valor?: string): Date | undefined => {
      if (!valor) return undefined;
      const d = new Date(valor);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    const de = comoData(filtros.de);
    const ate = comoData(filtros.ate);
    if (de || ate) {
      where.at = {};
      if (de) where.at.gte = de;
      if (ate) where.at.lte = ate;
    }
    if (filtros.busca?.trim()) {
      const termo = filtros.busca.trim();
      where.OR = [
        { staffEmail: { contains: termo, mode: 'insensitive' } },
        { targetLabel: { contains: termo, mode: 'insensitive' } },
        { targetId: termo },
        { reason: { contains: termo, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.platformAuditLog.findMany({
        where,
        orderBy: { at: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.client.platformAuditLog.count({ where }),
    ]);

    return { data, pagina, porPagina, total };
  }

  /** Verbos distintos já gravados — alimenta o filtro da tela sem lista fixa. */
  async acoesUsadas(): Promise<string[]> {
    const linhas = await this.prisma.client.platformAuditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return linhas.map((l) => l.action);
  }
}
