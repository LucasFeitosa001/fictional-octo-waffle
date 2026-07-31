/**
 * Certificação das TRAVAS DE ENVIO do WhatsApp (estudo 60).
 *
 * Cada teste aqui corresponde a algo que já aconteceu ou quase aconteceu com o
 * número do dono:
 *  - fila enchendo com o canal desconectado e drenando tudo no reconnect;
 *  - "lembrete" chegando depois do atendimento;
 *  - mensagem saindo com o aviso já desligado, porque a decisão ficou congelada
 *    no momento em que a linha entrou na fila;
 *  - envio que uma PESSOA autorizou sendo tratado como automação (ou o
 *    contrário, que é pior).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  autorizacaoAindaVale,
  expirouNaFila,
  isAutomationKind,
  podeEnfileirar,
  type AutomacaoDaConta,
} from '../whatsapp/outbox-policy';

const AGORA = new Date('2026-07-29T18:00:00.000Z');
const DESLIGADO: AutomacaoDaConta = {
  confirmation: false,
  cancellation: false,
  reminder: false,
  followUp: false,
};
const TUDO_LIGADO: AutomacaoDaConta = {
  confirmation: true,
  cancellation: true,
  reminder: true,
  followUp: true,
};

function agendamento(over: Record<string, unknown> = {}) {
  return {
    status: 'scheduled',
    start: new Date('2026-07-30T14:00:00.000Z'), // amanhã
    remindClient: null,
    notifyConfirmation: null,
    notifyCancellation: null,
    ...over,
  } as any;
}

describe('Travas de envio do WhatsApp (estudo 60)', () => {
  // ───────────────────────── trava 1: não enfileirar desconectado

  it('1) automação com o canal FECHADO não entra na fila', () => {
    for (const kind of ['confirmation', 'cancellation', 'reminder', 'followup', 'campaign']) {
      const d = podeEnfileirar(kind, false);
      assert.equal(d.ok, false, `${kind} deveria ser barrada`);
      assert.match(d.motivo ?? '', /desconectado/i);
    }
  });

  it('2) com o canal ABERTO a automação entra normalmente', () => {
    for (const kind of ['confirmation', 'cancellation', 'reminder', 'followup', 'campaign']) {
      assert.equal(podeEnfileirar(kind, true).ok, true);
    }
  });

  it('3) manual, inbox/IA e envio autorizado por pessoa entram mesmo desconectado', () => {
    assert.equal(podeEnfileirar('manual', false).ok, true);
    assert.equal(podeEnfileirar('manager', false).ok, true);
    assert.equal(podeEnfileirar('invite', false).ok, true);
    assert.equal(podeEnfileirar('ai', false, { doInbox: true }).ok, true);
    assert.equal(
      podeEnfileirar('confirmation', false, { autorizadaPorPessoa: true }).ok,
      true,
      'o botão "Enviar confirmação" é ação humana — precisa entrar e mostrar "na fila"',
    );
  });

  it('4) kind desconhecido não é tratado como automação', () => {
    assert.equal(isAutomationKind('coisa-nova'), false);
    assert.equal(isAutomationKind(null), false);
    assert.equal(podeEnfileirar(null, false).ok, true);
  });

  // ───────────────────────── trava 2: prazo de validade

  it('5) lembrete vence em 1h; confirmação aguenta 2h', () => {
    const hMenos3 = new Date(AGORA.getTime() - 3 * 3_600_000);
    const hMenos90min = new Date(AGORA.getTime() - 90 * 60_000);

    assert.equal(expirouNaFila('reminder', hMenos90min, AGORA).ok, false);
    assert.equal(expirouNaFila('confirmation', hMenos90min, AGORA).ok, true);
    assert.equal(expirouNaFila('confirmation', hMenos3, AGORA).ok, false);
    assert.match(expirouNaFila('reminder', hMenos3, AGORA).motivo ?? '', /Expirada na fila: 3h/);
  });

  it('6) a fila parada de 27 a 29/07 não sobrevive ao reconnect', () => {
    const doDia27 = new Date('2026-07-27T12:00:00.000Z');
    for (const kind of ['confirmation', 'cancellation', 'reminder', 'followup', 'campaign']) {
      assert.equal(
        expirouNaFila(kind, doDia27, AGORA).ok,
        false,
        `${kind} de 2 dias atrás jamais deveria sair`,
      );
    }
  });

  it('7) follow-up tem prazo de 24h (é mensagem de dias, mas não de semanas)', () => {
    assert.equal(expirouNaFila('followup', new Date(AGORA.getTime() - 20 * 3_600_000), AGORA).ok, true);
    assert.equal(expirouNaFila('followup', new Date(AGORA.getTime() - 30 * 3_600_000), AGORA).ok, false);
  });

  it('8) mensagem que não é automação não expira (manual/gestor/inbox)', () => {
    const antiga = new Date('2026-07-01T00:00:00.000Z');
    assert.equal(expirouNaFila('manual', antiga, AGORA).ok, true);
    assert.equal(expirouNaFila('manager', antiga, AGORA).ok, true);
    assert.equal(expirouNaFila(null, antiga, AGORA).ok, true);
  });

  // ───────────────────────── trava 3: revalidar na entrega

  it('9) padrão da conta desligado e sem toggle: não sai', () => {
    const d = autorizacaoAindaVale({
      kind: 'confirmation',
      agendamento: agendamento(),
      automacao: DESLIGADO,
      agora: AGORA,
    });
    assert.equal(d.ok, false);
    assert.match(d.motivo ?? '', /desligado/i);
  });

  it('10) toggle do agendamento NÃO autoriza sozinho — a conta desligada veta', () => {
    // Contrato invertido no estudo 77. O toggle vem congelado do padrão da conta
    // no momento da criação (appointments.service.ts:551), então deixá-lo
    // autorizar sozinho tornava o interruptor da conta incapaz de alcançar
    // qualquer agendamento já existente. Agora ele só RESTRINGE.
    assert.equal(
      autorizacaoAindaVale({
        kind: 'confirmation',
        agendamento: agendamento({ notifyConfirmation: true }),
        automacao: DESLIGADO,
        agora: AGORA,
      }).ok,
      false,
    );
  });

  it('11) toggle desligado no agendamento vence o padrão ligado da conta', () => {
    assert.equal(
      autorizacaoAindaVale({
        kind: 'reminder',
        agendamento: agendamento({ remindClient: false }),
        automacao: TUDO_LIGADO,
        agora: AGORA,
      }).ok,
      false,
    );
  });

  it('12) horário que já passou não recebe aviso — foi o caso do cliente real', () => {
    const d = autorizacaoAindaVale({
      kind: 'reminder',
      agendamento: agendamento({ start: new Date('2026-07-28T14:00:00.000Z') }),
      automacao: TUDO_LIGADO,
      agora: AGORA,
    });
    assert.equal(d.ok, false);
    assert.match(d.motivo ?? '', /já passou/);
  });

  it('13) agendamento cancelado depois: confirmação e lembrete são descartados', () => {
    for (const kind of ['confirmation', 'reminder']) {
      const d = autorizacaoAindaVale({
        kind,
        agendamento: agendamento({ status: 'canceled' }),
        automacao: TUDO_LIGADO,
        agora: AGORA,
      });
      assert.equal(d.ok, false, kind);
      assert.match(d.motivo ?? '', /cancelado/i);
    }
    // o aviso DE cancelamento é justamente o que precisa sair
    assert.equal(
      autorizacaoAindaVale({
        kind: 'cancellation',
        agendamento: agendamento({ status: 'canceled', start: new Date('2026-07-30T14:00:00.000Z') }),
        automacao: TUDO_LIGADO,
        agora: AGORA,
      }).ok,
      true,
    );
  });

  it('14) agendamento apagado: nada a avisar', () => {
    const d = autorizacaoAindaVale({
      kind: 'confirmation',
      agendamento: null,
      automacao: TUDO_LIGADO,
      agora: AGORA,
    });
    assert.equal(d.ok, false);
    assert.match(d.motivo ?? '', /não existe/i);
  });

  it('15) opt-out do cliente barra qualquer automação', () => {
    for (const cliente of [
      { notificationsEnabled: false, whatsappOptIn: true },
      { notificationsEnabled: true, whatsappOptIn: false },
    ]) {
      const d = autorizacaoAindaVale({
        kind: 'confirmation',
        agendamento: agendamento({ notifyConfirmation: true }),
        automacao: TUDO_LIGADO,
        cliente,
        agora: AGORA,
      });
      assert.equal(d.ok, false);
      assert.match(d.motivo ?? '', /não receber/i);
    }
  });

  it('16) follow-up e campanha: sem agendamento, valem o padrão da conta', () => {
    assert.equal(
      autorizacaoAindaVale({ kind: 'followup', automacao: DESLIGADO, agora: AGORA }).ok,
      false,
    );
    assert.equal(
      autorizacaoAindaVale({ kind: 'followup', automacao: TUDO_LIGADO, agora: AGORA }).ok,
      true,
    );
    // campanha é disparo explícito do salão, não tem switch de conta
    assert.equal(
      autorizacaoAindaVale({ kind: 'campaign', automacao: DESLIGADO, agora: AGORA }).ok,
      true,
    );
  });

  it('17) mensagem que não é automação passa sem revalidação', () => {
    assert.equal(
      autorizacaoAindaVale({ kind: 'manager', automacao: DESLIGADO, agora: AGORA }).ok,
      true,
    );
    assert.equal(
      autorizacaoAindaVale({ kind: 'manual', automacao: DESLIGADO, agora: AGORA }).ok,
      true,
    );
  });

  it('18) automação SEM agendamento verificável não sai, nem com o padrão da conta ligado', () => {
    // O buraco do estudo 73: `undefined` (linha sem appointmentId) escorregava
    // para o padrão da conta e pulava a trava do "horário já passou".
    const tudoLigado = {
      reminder: true,
      cancellation: true,
      confirmation: true,
      followUp: true,
    };
    for (const kind of ['confirmation', 'cancellation', 'reminder'] as const) {
      const d = autorizacaoAindaVale({
        kind,
        agendamento: undefined,
        automacao: tudoLigado,
      });
      assert.equal(d.ok, false, `${kind} não pode sair sem agendamento conferível`);
      assert.match(d.motivo ?? '', /verificar o agendamento/);
    }
  });

  it('19) followup e campanha seguem valendo — não têm agendamento por natureza', () => {
    const automacao = {
      reminder: false,
      cancellation: false,
      confirmation: false,
      followUp: true,
    };
    assert.equal(
      autorizacaoAindaVale({ kind: 'followup', agendamento: undefined, automacao }).ok,
      true,
      'followup depende do próprio switch, não de agendamento',
    );
    assert.equal(
      autorizacaoAindaVale({ kind: 'campaign', agendamento: undefined, automacao }).ok,
      true,
      'campanha é disparo explícito do salão',
    );
  });

  it('20) o padrão da conta VETA o valor congelado no agendamento (estudo 77)', () => {
    // appointments.service.ts:551 congela o padrão dentro do agendamento na
    // criação. Com `doAgendamento ?? padraoDaConta`, desligar a conta não
    // alcançava nada já criado — o dono desligou 13:27 e saiu lembrete 13:30.
    const contaDesligada = {
      reminder: false,
      cancellation: false,
      confirmation: false,
      followUp: false,
    };
    const d = autorizacaoAindaVale({
      kind: 'reminder',
      agendamento: agendamento({ remindClient: true }),
      automacao: contaDesligada,
      agora: AGORA, // sem isto o fixture cai no passado e o teste passa por outro motivo
    });
    assert.equal(d.ok, false, 'conta desligada tem que vetar mesmo com o agendamento marcado');
  });

  it('21) com a conta ligada, o agendamento só pode RESTRINGIR', () => {
    const contaLigada = {
      reminder: true,
      cancellation: true,
      confirmation: true,
      followUp: true,
    };
    assert.equal(
      autorizacaoAindaVale({
        kind: 'reminder',
        agendamento: agendamento({ remindClient: false }),
        automacao: contaLigada,
        agora: AGORA,
      }).ok,
      false,
      'agendamento marcado como false continua bloqueando',
    );
    assert.equal(
      autorizacaoAindaVale({
        kind: 'reminder',
        agendamento: agendamento({ remindClient: null }),
        automacao: contaLigada,
        agora: AGORA,
      }).ok,
      true,
      'sem opinião no agendamento, vale o padrão da conta',
    );
  });
});
