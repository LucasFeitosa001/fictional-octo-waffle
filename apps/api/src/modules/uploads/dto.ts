import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const KINDS = ['logo', 'professional', 'product', 'service', 'customer', 'misc'] as const;
export type UploadKind = (typeof KINDS)[number];

export class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contentType!: string;

  @IsOptional()
  @IsIn(KINDS)
  kind?: UploadKind;
}
