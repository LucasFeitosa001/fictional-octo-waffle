import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { HelpService, ChatMessage } from './help.service';

/**
 * Central de Ajuda (Belasis Etapa 2).
 *
 * Endpoints públicos (sem JwtAuthGuard): a base de conhecimento é global
 * do produto e o widget de ajuda pode ser aberto antes/depois do login.
 */
@Controller('help')
export class HelpController {
  constructor(private readonly service: HelpService) {}

  @Get('articles')
  list(@Query('category') category?: string) {
    return this.service.list(category);
  }

  @Get('articles/faq')
  listFaq(@Query('limit') limit?: string) {
    return this.service.listFaq(limit ? Number(limit) : undefined);
  }

  @Get('articles/:slug')
  async getBySlug(@Param('slug') slug: string) {
    const article = await this.service.getBySlug(slug);
    if (!article) throw new NotFoundException(`Artigo "${slug}" não encontrado`);
    return article;
  }

  @Get('search')
  search(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.service.search(q ?? '', limit ? Number(limit) : undefined);
  }

  @Post('chat')
  chat(@Body() body: { message?: string; history?: ChatMessage[] }) {
    return this.service.chat(body?.message ?? '', body?.history ?? []);
  }
}
