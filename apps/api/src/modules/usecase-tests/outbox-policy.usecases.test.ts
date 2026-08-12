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
import { expirouEsperandoConexao } from '../whatsapp/outbox-policy';
import { escolherJidConhecido } from '../whatsapp/jid-escolha';

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

  it('1) automação com o canal FECHADO ADIA, não é mais recusada (estudo 85)', () => {
    // Contrato invertido: a recusa cega engolia calada toda mensagem da janela
    // de reinício da API (~10 min). Agora a linha nasce e sai quando conectar;
    // quem descarta o que ficou velho é o teto de espera + o prazo por tipo.
    for (const kind of ['confirmation', 'cancellation', 'reminder', 'followup', 'campaign']) {
      assert.equal(podeEnfileirar(kind, false).ok, true, `${kind} deveria entrar`);
    }
  });

  it('1b) o teto de espera pela conexão descarta só quem NUNCA foi tentado', () => {
    const criada = new Date(AGORA.getTime() - 45 * 60 * 1000); // 45 min parada
    const recente = new Date(AGORA.getTime() - 10 * 60 * 1000); // 10 min parada
    assert.equal(
      expirouEsperandoConexao('confirmation', recente, 0, AGORA).ok,
      true,
      'reinício de 10 min tem que sair quando a conexão volta',
    );
    const velha = expirouEsperandoConexao('confirmation', criada, 0, AGORA);
    assert.equal(velha.ok, false, '45 min esperando conexão é descarte');
    assert.match(velha.motivo ?? '', /esperou a conexão/i);
    assert.equal(
      expirouEsperandoConexao('confirmation', criada, 2, AGORA).ok,
      true,
      'com tentativa feita o teto não vale — quem manda é o prazo do tipo',
    );
    assert.equal(
      expirouEsperandoConexao('manual', criada, 0, AGORA).ok,
      true,
      'o que não é automação não é descartado por este teto',
    );
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

  it('10) toggle do agendamento AUTORIZA sozinho — é o "ou" da regra do projeto', () => {
    // Contrato invertido no estudo 77 e restaurado no 81. O 77 fez o toggle só
    // RESTRINGIR porque ele vinha congelado do padrão da conta na criação, e
    // assim desligar a conta não alcançava agendamento já existente. Consertada
    // a causa (o serviço não congela mais; sem decisão explícita fica NULL), o
    // toggle volta a significar autorização — e o dono volta a conseguir mandar
    // o aviso de um agendamento específico com a automação geral desligada.
    assert.equal(
      autorizacaoAindaVale({
        kind: 'confirmation',
        agendamento: agendamento({ notifyConfirmation: true }),
        automacao: DESLIGADO,
        agora: AGORA,
      }).ok,
      true,
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

  // ───────────────────────── estudo 81: o "ou" da regra do projeto
  //
  // CLAUDE.md: "só pode sair se a empresa ativou o padrão da conta OU se o
  // envio foi autorizado especificamente naquele agendamento." Três estados:
  // null = ninguém mexeu (vale a conta); true = pessoa autorizou; false = pessoa
  // vetou. O estudo 77 tinha trocado isso por um E, porque o serviço congelava o
  // padrão dentro da linha; agora que não congela mais, o `??` volta a valer.

  it('20) agendamento AUTORIZADO sai mesmo com a conta desligada (estudo 81)', () => {
    for (const [kind, campo] of [
      ['reminder', 'remindClient'],
      ['confirmation', 'notifyConfirmation'],
      ['cancellation', 'notifyCancellation'],
    ] as const) {
      const d = autorizacaoAindaVale({
        kind,
        agendamento: agendamento({ [campo]: true }),
        automacao: DESLIGADO,
        agora: AGORA,
      });
      assert.equal(d.ok, true, `${kind}: autorização explícita tem que valer`);
    }
  });

  it('21) sem opinião no agendamento (NULL), quem manda é o padrão da conta', () => {
    // É isto que faz desligar a conta alcançar o que já está criado — o
    // incidente do estudo 77 (desligou 13:27, saiu lembrete 13:30). Só funciona
    // porque appointments.service.ts parou de congelar o padrão na linha.
    assert.equal(
      autorizacaoAindaVale({
        kind: 'reminder',
        agendamento: agendamento({ remindClient: null }),
        automacao: DESLIGADO,
        agora: AGORA,
      }).ok,
      false,
      'conta desligada + agendamento sem opinião: não sai',
    );
    assert.equal(
      autorizacaoAindaVale({
        kind: 'reminder',
        agendamento: agendamento({ remindClient: null }),
        automacao: TUDO_LIGADO,
        agora: AGORA,
      }).ok,
      true,
      'conta ligada + agendamento sem opinião: sai',
    );
  });

  it('22) VETO no agendamento bloqueia mesmo com a conta ligada', () => {
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

  it('23) cancelamento de horário JÁ PASSADO sai; lembrete e confirmação não', () => {
    // O caso do dono: agendamento das 15h30, cancelado 15h34. A mensagem foi
    // escrita, entrou na fila e morreu com "O horário já passou" — trava que eu
    // tinha escrito para o lembrete e apliquei aos três tipos. Estudo 81.
    const jaPassou = agendamento({
      start: new Date(AGORA.getTime() - 5 * 60 * 1000),
      notifyCancellation: true,
      notifyConfirmation: true,
      remindClient: true,
    });
    assert.equal(
      autorizacaoAindaVale({
        kind: 'cancellation',
        agendamento: jaPassou,
        automacao: TUDO_LIGADO,
        agora: AGORA,
      }).ok,
      true,
      'cancelar horário que já começou é rotina — o cliente precisa saber',
    );
    for (const kind of ['reminder', 'confirmation'] as const) {
      const d = autorizacaoAindaVale({
        kind,
        agendamento: jaPassou,
        automacao: TUDO_LIGADO,
        agora: AGORA,
      });
      assert.equal(d.ok, false, `${kind} de horário vencido continua barrado`);
      assert.match(d.motivo ?? '', /já passou/i);
    }
  });

  it('24) cancelamento de horário passado ainda respeita o veto e o opt-out', () => {
    // A exceção do 23 abre a porta do TEMPO, não das outras travas.
    const jaPassou = agendamento({
      start: new Date(AGORA.getTime() - 5 * 60 * 1000),
      notifyCancellation: false,
    });
    assert.equal(
      autorizacaoAindaVale({
        kind: 'cancellation',
        agendamento: jaPassou,
        automacao: TUDO_LIGADO,
        agora: AGORA,
      }).ok,
      false,
      'veto no agendamento continua valendo',
    );
    assert.equal(
      autorizacaoAindaVale({
        kind: 'cancellation',
        agendamento: agendamento({
          start: new Date(AGORA.getTime() - 5 * 60 * 1000),
          notifyCancellation: true,
        }),
        automacao: TUDO_LIGADO,
        cliente: { notificationsEnabled: true, whatsappOptIn: false },
        agora: AGORA,
      }).ok,
      false,
      'opt-out do cliente continua valendo',
    );
  });
});

// ─────────────────────── estudo 83: para QUEM a mensagem é cifrada
//
// O dono viu "Aguardando mensagem" no próprio WhatsApp. Causa: a automação
// nascia sem JID e endereçava `<telefone>@s.whatsapp.net`, enquanto o chat vivo
// do contato é `@lid` — endereço Signal diferente, que os outros aparelhos da
// conta não abrem. Provado em produção: 5 mensagens, só a endereçada por
// telefone falhou.
describe('Escolha do endereço de envio (estudo 83)', () => {
  const PAULO = [
    { remoteJid: '19182384714@s.whatsapp.net', phone: '+19182384714' },
    { remoteJid: '49040423161879@lid', phone: '19182384714' },
  ];

  it('1) com as duas formas gravadas, prefere o @lid', () => {
    assert.equal(escolherJidConhecido('+19182384714', PAULO), '49040423161879@lid');
  });

  it('2) só a forma por telefone: usa ela mesma', () => {
    assert.equal(
      escolherJidConhecido('+19182384714', [PAULO[0]]),
      '19182384714@s.whatsapp.net',
    );
  });

  it('3) telefone brasileiro com e sem o nono dígito e com e sem 55', () => {
    const conversas = [{ remoteJid: '5589981217434@lid', phone: '5589981217434' }];
    for (const alvo of ['+55 89 98121-7434', '8981217434', '5589981217434']) {
      assert.equal(escolherJidConhecido(alvo, conversas), '5589981217434@lid', alvo);
    }
  });

  it('4) AMBÍGUO não adivinha: dois números distintos batendo devolve null', () => {
    // O casamento é pelos últimos 8 dígitos; se dois números diferentes casarem,
    // escolher um mandaria a mensagem para a pessoa errada.
    const colisao = [
      { remoteJid: '5511981217434@lid', phone: '5511981217434' },
      { remoteJid: '5589981217434@lid', phone: '5589981217434' },
    ];
    assert.equal(escolherJidConhecido('981217434', colisao), null);
  });

  it('5) sem conversa conhecida, ou número curto demais, devolve null', () => {
    assert.equal(escolherJidConhecido('+5589999990000', PAULO), null);
    assert.equal(escolherJidConhecido('1234', PAULO), null);
    assert.equal(escolherJidConhecido('', PAULO), null);
  });

  it('6) JID inválido no banco não é usado como destino', () => {
    assert.equal(
      escolherJidConhecido('+19182384714', [
        { remoteJid: 'status@broadcast', phone: '+19182384714' },
      ]),
      null,
    );
  });
});
