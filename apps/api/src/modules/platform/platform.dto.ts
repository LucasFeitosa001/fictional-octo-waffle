import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JUSTIFICATIVA_MINIMA, SENHA_MINIMA } from './platform.constants';

const PAPEIS = ['support', 'engineer', 'owner'] as const;

/**
 * Justificativa. A validação de OBRIGATORIEDADE não mora aqui — mora em
 * `PlatformAuditService.exigirJustificativa`, junto da lista de ações que a
 * exigem. Deixar os dois lados juntos evita o caso de alguém acrescentar uma
 * ação destrutiva nova e esquecer de tornar o campo obrigatório no DTO.
 */
class ComJustificativa {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Informe a senha.' })
  senha: string;
}

export class TrocarPropriaSenhaDto {
  @IsString() senhaAtual: string;

  @IsString()
  @MinLength(SENHA_MINIMA)
  senhaNova: string;
}

// =====================================================================
// Usuários de salão
// =====================================================================

export class BuscarUsuariosDto {
  @IsOptional() @IsString() @MaxLength(200) busca?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsIn(['staff', 'customer']) accountType?: string;
  @IsOptional() @IsIn(['true', 'false']) ativo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) porPagina?: number;
}

export class AlterarEmailDto extends ComJustificativa {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;
}

export class ResetarSenhaDto extends ComJustificativa {
  /**
   * Ausente ⇒ a API gera uma temporária e devolve UMA única vez. É o caminho
   * recomendado: senha escolhida por técnico costuma ser fraca e, pior, costuma
   * ser reaproveitada entre clientes.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  senha?: string;

  /**
   * Encerra as sessões abertas do usuário junto com o reset. Padrão TRUE: se o
   * reset é por suspeita de invasão, deixar a sessão do invasor viva não
   * resolve nada.
   */
  @IsOptional() @IsBoolean() encerrarSessoes?: boolean;
}

export class AlternarAtivoDto extends ComJustificativa {
  @IsBoolean() ativo: boolean;
}

export class SoJustificativaDto extends ComJustificativa {}

export class DesvincularOauthDto extends ComJustificativa {
  @IsString() @MinLength(2) providerId: string;
}

export class PersonificarDto extends ComJustificativa {
  /** Empresa em que a sessão vai nascer. Sem isto o alvo cai na "principal". */
  @IsOptional() @IsString() companyId?: string;
}

// =====================================================================
// Salões
// =====================================================================

export class BuscarSaloesDto {
  @IsOptional() @IsString() @MaxLength(200) busca?: string;
  @IsOptional() @IsIn(['true', 'false']) ativo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) porPagina?: number;
}

// =====================================================================
// Técnicos
// =====================================================================

export class CriarTecnicoDto {
  @IsString() @MinLength(2) @MaxLength(120) nome: string;
  @IsEmail() email: string;
  @IsIn(PAPEIS) papel: (typeof PAPEIS)[number];

  /** Ausente ⇒ a API gera uma temporária e devolve uma única vez. */
  @IsOptional() @IsString() @MinLength(SENHA_MINIMA) senha?: string;
}

export class AlterarTecnicoDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nome?: string;
  @IsOptional() @IsIn(PAPEIS) papel?: (typeof PAPEIS)[number];
}

export class AlternarTecnicoAtivoDto {
  @IsBoolean() ativo: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// =====================================================================
// Auditoria
// =====================================================================

export class ConsultarAuditoriaDto {
  @IsOptional() @IsString() staffId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() targetType?: string;
  @IsOptional() @IsString() targetId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() @MaxLength(200) busca?: string;
  @IsOptional() @IsString() de?: string;
  @IsOptional() @IsString() ate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) porPagina?: number;
}

export const MENSAGEM_JUSTIFICATIVA = `Descreva o motivo com pelo menos ${JUSTIFICATIVA_MINIMA} caracteres.`;
