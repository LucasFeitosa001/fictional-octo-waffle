'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErroApi, api } from './api';
import type { Capacidade, Tecnico } from './types';

/**
 * Sessão do console. Ver estudo 135.
 *
 * Não guarda nada em localStorage de propósito: a única prova de sessão é o
 * cookie httpOnly, que o JavaScript não lê. Espelhar o estado em localStorage
 * criaria uma segunda verdade que fica velha — a tela mostraria "logado" depois
 * de a sessão já ter caído no servidor.
 */
export type EstadoSessao =
  | { estado: 'carregando' }
  | { estado: 'anonimo' }
  | { estado: 'autenticado'; tecnico: Tecnico };

export function useSessao() {
  const [sessao, setSessao] = useState<EstadoSessao>({ estado: 'carregando' });

  const recarregar = useCallback(async () => {
    try {
      const tecnico = await api.get<Tecnico>('/platform/auth/me');
      setSessao({ estado: 'autenticado', tecnico });
    } catch (erro) {
      if (erro instanceof ErroApi && (erro.expirou || erro.semPermissao)) {
        setSessao({ estado: 'anonimo' });
        return;
      }
      setSessao({ estado: 'anonimo' });
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { sessao, recarregar };
}

/** Um técnico só vê o que pode fazer. O guard da API é quem decide de verdade. */
export function pode(tecnico: Tecnico | null | undefined, capacidade: Capacidade): boolean {
  return Boolean(tecnico?.capacidades?.includes(capacidade));
}

export function formatarData(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarDataCurta(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

/** Rótulo legível para os verbos de auditoria. */
export function rotuloAcao(action: string): string {
  const mapa: Record<string, string> = {
    'sessao.login': 'Entrou no console',
    'sessao.login_recusado': 'Login recusado',
    'sessao.logout': 'Saiu do console',
    'sessao.senha_alterada': 'Trocou a própria senha',
    'usuario.email_alterado': 'Alterou e-mail',
    'usuario.senha_resetada': 'Resetou senha',
    'usuario.sessoes_encerradas': 'Encerrou sessões',
    'usuario.desativado': 'Desativou conta',
    'usuario.reativado': 'Reativou conta',
    'usuario.oauth_desvinculado': 'Desvinculou login social',
    'usuario.personificado': 'Entrou como usuário',
    'salao.desativado': 'Desativou salão',
    'salao.reativado': 'Reativou salão',
    'tecnico.criado': 'Criou técnico',
    'tecnico.alterado': 'Alterou técnico',
    'tecnico.desativado': 'Desativou técnico',
    'tecnico.reativado': 'Reativou técnico',
    'tecnico.senha_resetada': 'Resetou senha de técnico',
    'tecnico.sessoes_encerradas': 'Encerrou sessões de técnico',
  };
  return mapa[action] ?? action;
}

/** Ações que mudaram algo do cliente ganham destaque na trilha. */
export function acaoSensivel(action: string): boolean {
  return (
    action.startsWith('usuario.') ||
    action.startsWith('salao.') ||
    action === 'sessao.login_recusado'
  );
}
