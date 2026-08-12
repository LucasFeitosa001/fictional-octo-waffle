import { SetMetadata } from '@nestjs/common';

/**
 * O que uma rota do conector da Voltr exige do tenant. Ver estudo 88.
 *
 * Existe porque o guard de assinatura, sozinho, é passe livre: ele prova QUEM
 * está chamando, não O QUE pode fazer — quem tem o segredo do tenant chamaria
 * qualquer rota que use o guard. Mandar mensagem e gravar na agenda de um
 * profissional não podem ter o mesmo peso.
 *
 * Rota sem escopo declarado continua valendo, para não quebrar o
 * `/voltr/whatsapp/send` que já existia.
 */
export type VoltrEscopo = 'mensagem' | 'agenda';

export const VOLTR_ESCOPO_KEY = 'voltrEscopo';

export const EscopoVoltr = (escopo: VoltrEscopo) =>
  SetMetadata(VOLTR_ESCOPO_KEY, escopo);
