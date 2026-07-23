import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { InvitesService } from './invites.service';

class AcceptInviteDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(6) password: string;
}

/**
 * Endpoints PÚBLICOS (sem guard) do fluxo de convite — consumidos pela tela
 * pública de aceite. O endpoint de CRIAÇÃO do convite (protegido) vive no
 * módulo professionals: POST /professionals/:id/invite.
 */
@Controller('invites')
export class InvitesController {
  constructor(private readonly service: InvitesService) {}

  // Dados básicos do convite para a tela pública renderizar.
  @Get(':token')
  view(@Param('token') token: string) {
    return this.service.publicView(token);
  }

  // Aceite do convite: cria a conta staff e vincula o profissional.
  @Post(':token/accept')
  @HttpCode(200)
  accept(@Param('token') token: string, @Body() dto: AcceptInviteDto) {
    return this.service.accept(token, dto);
  }
}
