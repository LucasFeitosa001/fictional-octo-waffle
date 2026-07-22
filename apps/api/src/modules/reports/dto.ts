import { IsOptional, IsString } from 'class-validator';

// Query padrão dos relatórios: janela opcional de datas (ISO ou YYYY-MM-DD).
// `to` no formato de data pura é esticado até o fim do dia no service.
export class ReportRangeQueryDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
