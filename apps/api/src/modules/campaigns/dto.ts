import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CampaignChannel, CampaignStatus } from '@beautypass/db';

/**
 * Supported segment kinds for `Campaign.segmentJson`. Start small and real:
 *  - `birthday_today`: customers whose birthday is today (aniversariantes).
 *  - `inactive`: customers with no appointment in the last `inactiveDays` days
 *    (reconquista / clientes inativos).
 *  - `all`: every active customer with a phone (broadcast).
 */
export type SegmentKind = 'birthday_today' | 'inactive' | 'all';

export interface CampaignSegment {
  kind: SegmentKind;
  /** Only for kind = 'inactive'. Defaults to 90 when omitted. */
  inactiveDays?: number;
}

export class CreateCampaignDto {
  @IsString() @MinLength(2) name: string;
  @IsEnum(CampaignChannel) channel: CampaignChannel;
  /** Free-form segment definition; validated/normalized in the service. */
  @IsOptional() @IsObject() segmentJson?: CampaignSegment;
  /** Message body. `%NOME%` and `%ESTABELECIMENTO%` are substituted per customer. */
  @IsOptional() @IsString() message?: string;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(CampaignChannel) channel?: CampaignChannel;
  @IsOptional() @IsObject() segmentJson?: CampaignSegment;
  @IsOptional() @IsString() message?: string;
  /**
   * Pausar/retomar uma automação. A UI só alterna entre `draft` (pausada) e
   * `sent` (ativa) — o daily sweep de aniversário só age em campanhas em
   * `sent`/`sending`, então flipar o status é como o estúdio liga/desliga a
   * automação sem re-disparar. O disparo manual continua sendo o endpoint
   * dedicado /:id/dispatch.
   */
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
}

/** Ad-hoc preview of how many customers a segment currently matches. */
export class PreviewSegmentDto {
  @IsString() kind: SegmentKind;
  @IsOptional() @IsInt() @Min(1) inactiveDays?: number;
}
