/**
 * Inbox/IA do WhatsApp — regressão ponta a ponta com Nest + Postgres reais.
 *
 * O WhatsApp fica desligado: nenhuma mensagem externa é enviada. Injetamos os
 * mesmos eventos normalizados que o Baileys entrega, validamos persistência,
 * resposta da IA local, consulta de agenda, criação de agendamento, takeover
 * humano, outbox e os endpoints consumidos pela tela.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  for (const file of ['.env', join('..', '..', 'packages', 'db', '.env')]) {
    try {
      const raw = readFileSync(join(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const match = line.match(
          /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i,
        );
        if (!match || process.env[match[1]] !== undefined) continue;
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
      }
    } catch {
      // Arquivo opcional.
    }
  }
}
loadEnv();

const PORT = Number(process.env.WHATSAPP_INBOX_TEST_PORT ?? 4604);
process.env.BETTER_AUTH_URL = `http://localhost:${PORT}`;
process.env.WHATSAPP_ENABLED = 'false';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GROQ_API_KEY;
const BASE = `http://localhost:${PORT}/api/v1`;

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean) {
  if (condition) passed += 1;
  else {
    failures.push(label);
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${label}`);
  }
}

async function api(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: `http://localhost:${PORT}`,
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
    },
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: response.status,
    body,
    token: response.headers.get('set-auth-token'),
  };
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 6500,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

function tomorrowYmd() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

async function run() {
  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const expressModule = await import('express');
  const express = (expressModule as any).default ?? expressModule;
  const { toNodeHandler } = await import('better-auth/node');
  const { AppModule } = await import('../app.module.js');
  const { auth } = await import('../auth/better-auth.js');
  const { WhatsappInboxService } = await import(
    '../modules/whatsapp-inbox/whatsapp-inbox.service.js'
  );
  const { WhatsappService, whatsappParticipantIdentity } = await import(
    '../modules/whatsapp/whatsapp.service.js'
  );
  const { WhatsappReminderPollerService } = await import(
    '../modules/notifications/whatsapp-reminder-poller.service.js'
  );
  const { prisma } = await import('@beautypass/db');

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api/v1');
  const instance = app.getHttpAdapter().getInstance();
  instance.all(/^\/api\/v1\/auth\/.*/, toNodeHandler(auth));
  instance.use(express.json());
  instance.use(express.urlencoded({ extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  await app.listen(PORT);

  let companyId = '';
  let secondCompanyId = '';
  try {
    const lidIdentity = whatsappParticipantIdentity(
      '123456789012345@lid',
      false,
      '5585991234567@s.whatsapp.net',
    );
    check('listener aceita chat individual LID', lidIdentity.individual);
    check(
      'listener usa senderPn em vez dos dígitos opacos do LID',
      lidIdentity.phoneDigits === '5585991234567',
    );
    check(
      'listener continua rejeitando grupos',
      !whatsappParticipantIdentity('123456@g.us', false).individual,
    );

    const email = `wa-inbox-${Date.now()}@test.local`;
    const signup = await api('POST', '/auth/sign-up/email', {
      body: {
        name: 'Salão Inbox Teste',
        email,
        password: 'whatsapp-inbox-test-123',
      },
    });
    let token = signup.token;
    if (!token) {
      token = (
        await api('POST', '/auth/sign-in/email', {
          body: { email, password: 'whatsapp-inbox-test-123' },
        })
      ).token;
    }
    check('cadastro fornece token', Boolean(token));

    for (let attempt = 0; attempt < 20 && !companyId; attempt += 1) {
      const company = await api('GET', '/companies/current', {
        token: token ?? undefined,
      });
      companyId = company.body?.id ?? '';
      if (!companyId)
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    check('empresa de teste provisionada', Boolean(companyId));

    const initialConfig = await api('GET', '/whatsapp/inbox/config', {
      token: token ?? undefined,
    });
    check('GET config responde 200', initialConfig.status === 200);
    check('IA nasce pausada por segurança', initialConfig.body?.enabled === false);
    check(
      'canal da tela é a conexão real',
      initialConfig.body?.channel?.status === 'disabled',
    );
    check(
      'sem Anthropic expõe fallback local',
      initialConfig.body?.aiAvailable === false,
    );

    const savedConfig = await api('PATCH', '/whatsapp/inbox/config', {
      token: token ?? undefined,
      body: {
        enabled: true,
        agentName: 'Lia',
        greeting: 'Olá! Eu sou a Lia. Como posso ajudar?',
        tone: 'simpatico',
        autoReply: true,
        bookingViaChat: true,
        handoffEnabled: true,
        knowledgeBase: 'Aceitamos Pix e cartão.',
        faq: [
          {
            question: 'Aceita Pix?',
            answer: 'Sim, aceitamos Pix.',
          },
        ],
      },
    });
    check('PATCH config responde 200', savedConfig.status === 200);
    check('persona persistida', savedConfig.body?.agentName === 'Lia');
    check('FAQ persistida', savedConfig.body?.faq?.length === 1);

    const service = await prisma.service.create({
      data: {
        companyId,
        name: 'Corte',
        price: 70,
        durationMin: 30,
        active: true,
        visible: true,
        onlineBookable: true,
      },
    });
    const professional = await prisma.professional.create({
      data: {
        companyId,
        name: 'Paula',
        active: true,
        onlineBookable: true,
      },
    });
    await prisma.professionalService.create({
      data: {
        professionalId: professional.id,
        serviceId: service.id,
      },
    });
    const tomorrow = tomorrowYmd();
    const weekday = new Date(`${tomorrow}T12:00:00-03:00`).getDay();
    await prisma.professionalSchedule.create({
      data: {
        professionalId: professional.id,
        weekday,
        startTime: '09:00',
        endTime: '17:00',
      },
    });

    // O gestor pode criar o login diretamente, sem o profissional abrir um
    // convite. A senha gerada volta uma única vez e precisa autenticar de
    // verdade pelo Account(provider=credential) do Better Auth.
    const directAccessEmail = `direct-access-${Date.now()}@test.local`;
    const directAccess = await api(
      'POST',
      `/users/professional/${professional.id}`,
      {
        token: token ?? undefined,
        body: {
          email: directAccessEmail,
          generatePassword: true,
        },
      },
    );
    const temporaryPassword = directAccess.body?.temporaryPassword as
      | string
      | undefined;
    check('gestor cria acesso sem convite', directAccess.status === 201);
    check(
      'senha temporária forte retorna uma única vez',
      Boolean(
        temporaryPassword &&
          temporaryPassword.length >= 12 &&
          /[a-z]/.test(temporaryPassword) &&
          /[A-Z]/.test(temporaryPassword) &&
          /\d/.test(temporaryPassword) &&
          /[^a-zA-Z0-9]/.test(temporaryPassword),
      ),
    );
    const directSignIn = await api('POST', '/auth/sign-in/email', {
      body: {
        email: directAccessEmail,
        password: temporaryPassword,
      },
    });
    check('senha gerada autentica no Better Auth', Boolean(directSignIn.token));
    const directCompany = await api('GET', '/session/companies', {
      token: directSignIn.token ?? undefined,
    });
    check(
      'novo acesso abre a empresa correta, sem empresa temporária',
      directCompany.body?.data?.length === 1 &&
        directCompany.body.data[0]?.company?.id === companyId &&
        directCompany.body.data[0]?.active === true,
    );
    const linkedProfessional = await prisma.professional.findUnique({
      where: { id: professional.id },
      select: {
        userId: true,
        user: {
          select: {
            accounts: {
              where: { providerId: 'credential' },
              select: { id: true },
            },
          },
        },
      },
    });
    check(
      'profissional ficou ligado à credencial real',
      Boolean(
        linkedProfessional?.userId &&
          linkedProfessional.user?.accounts.length === 1,
      ),
    );

    const inbox = app.get(WhatsappInboxService) as any;
    const whatsapp = app.get(WhatsappService);
    const phone = '5585991234567';
    const remoteJid = `${phone}@s.whatsapp.net`;
    await inbox.captureWhatsappMessage({
      companyId,
      fromDigits: phone,
      remoteJid,
      fromMe: false,
      pushName: 'Maria WhatsApp',
      messageId: `incoming-${Date.now()}`,
      timestamp: new Date(),
      text: 'Quero agendar Corte amanhã',
    });

    const offered = await waitFor(async () => {
      const count = await prisma.whatsappInboxMessage.count({
        where: { companyId, sender: 'ai', kind: 'ai_availability' },
      });
      return count === 1;
    });
    check('IA respondeu à mensagem real persistida', offered);

    const conversation = await prisma.whatsappConversation.findFirst({
      where: { companyId, remoteJid },
    });
    check('conversa foi criada com nome do push', conversation?.displayName === 'Maria WhatsApp');
    check('não lida foi incrementada', conversation?.unreadCount === 1);

    const availabilityReply =
      await prisma.whatsappInboxMessage.findFirst({
        where: { companyId, sender: 'ai', kind: 'ai_availability' },
        orderBy: { createdAt: 'desc' },
      });
    const offeredTime = availabilityReply?.text.match(/\b(\d{2}:\d{2})\b/)?.[1];
    check('resposta trouxe horário real da agenda', Boolean(offeredTime));
    check(
      'resposta da IA entrou na outbox durável',
      (await prisma.whatsappOutbox.count({
        where: { inboxMessageId: availabilityReply?.id },
      })) === 1,
    );

    await inbox.captureWhatsappMessage({
      companyId,
      fromDigits: phone,
      remoteJid,
      fromMe: false,
      pushName: 'Maria WhatsApp',
      messageId: `incoming-confirm-${Date.now()}`,
      timestamp: new Date(),
      text: `Pode ser às ${offeredTime}`,
    });
    const booked = await waitFor(async () => {
      return (
        (await prisma.appointment.count({
          where: {
            companyId,
            source: 'online',
            status: 'confirmed',
          },
        })) === 1
      );
    });
    check('IA criou agendamento real após confirmação', booked);

    const bookingMessage =
      await prisma.whatsappInboxMessage.findFirst({
        where: { companyId, kind: 'ai_booking' },
      });
    check('confirmação da IA registrada no histórico', Boolean(bookingMessage));
    check(
      'cliente do WhatsApp foi criado e vinculado',
      Boolean(
        (
          await prisma.whatsappConversation.findFirst({
            where: { companyId, remoteJid },
          })
        )?.customerId,
      ),
    );

    // Simula uma notificação antiga, criada antes da integração do inbox. O
    // primeiro GET da lista precisa retrovincular essa outbox à conversa real.
    const linkedConversation =
      await prisma.whatsappConversation.findFirstOrThrow({
        where: { companyId, remoteJid },
      });
    const legacyOutbox = await prisma.whatsappOutbox.create({
      data: {
        companyId,
        customerId: linkedConversation.customerId,
        toPhone: phone,
        text: 'Seu agendamento está confirmado. ✅',
        kind: 'confirmation',
        status: 'sent',
        attempts: 1,
        sentAt: new Date(),
      },
    });

    const list = await api('GET', '/whatsapp/inbox/conversations', {
      token: token ?? undefined,
    });
    check('lista real responde 200', list.status === 200);
    check('lista contém conversa capturada', list.body?.data?.length === 1);
    const legacyLinked = await prisma.whatsappOutbox.findUnique({
      where: { id: legacyOutbox.id },
      include: { inboxMessage: true },
    });
    check(
      'outbox antiga foi recuperada para o inbox',
      legacyLinked?.inboxMessage?.sender === 'system' &&
        legacyLinked.inboxMessage.status === 'sent',
    );

    const id = list.body?.data?.[0]?.id as string;
    const history = await api(
      'GET',
      `/whatsapp/inbox/conversations/${id}/messages`,
      { token: token ?? undefined },
    );
    check('histórico real responde 200', history.status === 200);
    check(
      'histórico contém cliente, IA e automação',
      history.body?.data?.length >= 5 &&
        history.body.data.some((item: any) => item.sender === 'system'),
    );

    // Toda NOVA automação passa pelo observer da outbox e aparece imediatamente
    // como pending, mesmo com o transporte desligado neste teste.
    await whatsapp.enqueueText(phone, 'Lembrete de teste', {
      companyId,
      customerId: linkedConversation.customerId ?? undefined,
      kind: 'reminder',
    });
    const reminderMirrored = await waitFor(async () => {
      return (
        (await prisma.whatsappInboxMessage.count({
          where: {
            companyId,
            conversationId: id,
            sender: 'system',
            kind: 'reminder',
            text: 'Lembrete de teste',
            status: 'pending',
          },
        })) === 1
      );
    });
    check('nova automação aparece no inbox antes do envio', reminderMirrored);
    const reminderOutbox = await prisma.whatsappOutbox.findFirst({
      where: { companyId, text: 'Lembrete de teste' },
      orderBy: { createdAt: 'desc' },
    });
    check(
      'automação e outbox ficaram ligadas',
      Boolean(reminderOutbox?.inboxMessageId),
    );

    // Mensagens administrativas (gestor/profissional) continuam fora da caixa
    // de clientes.
    await whatsapp.enqueueText('5511900000099', 'Aviso interno', {
      companyId,
      kind: 'manager',
    });
    const managerOutbox = await prisma.whatsappOutbox.findFirst({
      where: { companyId, text: 'Aviso interno' },
      orderBy: { createdAt: 'desc' },
    });
    check(
      'aviso interno não polui o inbox de clientes',
      managerOutbox?.inboxMessageId === null,
    );

    await inbox.captureWhatsappMessage({
      companyId,
      fromDigits: phone,
      remoteJid,
      fromMe: false,
      pushName: 'Maria WhatsApp',
      messageId: `incoming-cancel-${Date.now()}`,
      timestamp: new Date(),
      text: 'Quero cancelar meu horário',
    });
    const handedOff = await waitFor(async () => {
      const current = await prisma.whatsappConversation.findFirst({
        where: { companyId, remoteJid },
        select: { handledByAi: true },
      });
      return current?.handledByAi === false;
    });
    check('cancelamento é transferido para atendimento humano', handedOff);
    check(
      'IA não cancela nem duplica agendamento sem validação humana',
      (await prisma.appointment.count({ where: { companyId } })) === 1,
    );

    const returnToAi = await api(
      'PATCH',
      `/whatsapp/inbox/conversations/${id}`,
      {
        token: token ?? undefined,
        body: { handledByAi: true },
      },
    );
    check('conversa pode voltar para IA', returnToAi.body?.handledByAi === true);

    const takeover = await api(
      'PATCH',
      `/whatsapp/inbox/conversations/${id}`,
      {
        token: token ?? undefined,
        body: { handledByAi: false, read: true },
      },
    );
    check('takeover humano responde 200', takeover.status === 200);
    check('takeover pausa IA da conversa', takeover.body?.handledByAi === false);
    check('marcar lida zera contador', takeover.body?.unreadCount === 0);

    // O WhatsApp atual pode identificar a conversa por LID. Ela deve fundir com
    // a conversa do mesmo cliente, preservar o número alternativo e usar o JID
    // observado nas próximas respostas.
    const lidJid = `987654321${Date.now()}@lid`;
    await inbox.captureWhatsappMessage({
      companyId,
      fromDigits: phone,
      remoteJid: lidJid,
      fromMe: false,
      pushName: 'Maria WhatsApp',
      messageId: `incoming-lid-${Date.now()}`,
      timestamp: new Date(),
      text: 'Mensagem recebida por LID',
      metadata: { lid: true, phoneKnown: true },
    });
    const lidConversation = await prisma.whatsappConversation.findUnique({
      where: { id },
    });
    check('chat LID fundiu sem duplicar conversa', lidConversation?.remoteJid === lidJid);
    check(
      'chat LID manteve uma conversa por cliente',
      (await prisma.whatsappConversation.count({
        where: { companyId, customerId: linkedConversation.customerId },
      })) === 1,
    );

    const manual = await api(
      'POST',
      `/whatsapp/inbox/conversations/${id}/messages`,
      {
        token: token ?? undefined,
        body: { text: 'Olá, aqui é a atendente humana.' },
      },
    );
    check('envio humano responde 201', manual.status === 201);
    check('balão humano nasce pending', manual.body?.status === 'pending');
    check(
      'envio humano entrou na outbox ligado ao balão',
      (await prisma.whatsappOutbox.count({
        where: { inboxMessageId: manual.body?.id },
      })) === 1,
    );
    const manualOutbox = await prisma.whatsappOutbox.findUnique({
      where: { inboxMessageId: manual.body?.id },
    });
    check(
      'resposta ao chat LID preserva o destinatário real',
      manualOutbox?.toJid === lidJid,
    );

    const stats = await api('GET', '/whatsapp/inbox/stats', {
      token: token ?? undefined,
    });
    check('métricas reais respondem 200', stats.status === 200);
    check('métricas contam conversa de hoje', stats.body?.conversationsToday === 1);
    check('métricas contam agendamento da IA', stats.body?.bookingsViaAi === 1);

    // A página também inicia conversa manual com um cliente que ainda nunca
    // escreveu para o salão.
    const proactiveCustomer = await prisma.customer.create({
      data: {
        companyId,
        name: 'Joana Proativa',
        phone: '5585997654321',
        notificationsEnabled: true,
        whatsappOptIn: true,
      },
    });
    const proactive = await api('POST', '/whatsapp/inbox/conversations', {
      token: token ?? undefined,
      body: {
        customerId: proactiveCustomer.id,
        text: 'Olá, Joana! Como podemos ajudar?',
      },
    });
    check('nova conversa manual responde 201', proactive.status === 201);
    check(
      'nova conversa manual cria balão e outbox',
      proactive.body?.message?.sender === 'agent' &&
        Boolean(
          await prisma.whatsappOutbox.findUnique({
            where: { inboxMessageId: proactive.body?.message?.id },
          }),
        ),
    );

    // Produção opera sem workers Redis. O fallback no banco precisa localizar
    // horários próximos, criar um claim único, enfileirar no outbox/inbox e não
    // repetir no próximo tick. O transporte externo continua desligado neste
    // teste; habilitamos somente a decisão de enqueue do poller in-process.
    const reminderPoller = app.get(WhatsappReminderPollerService) as any;
    reminderPoller.mode = {
      mode: 'live',
      isLive: true,
      whatsappEnabled: true,
      canSendWhatsapp: true,
    };
    const dueStart = new Date(Date.now() + 90 * 60 * 1000);
    const reminderAppointment = await prisma.appointment.create({
      data: {
        companyId,
        customerId: proactiveCustomer.id,
        professionalId: professional.id,
        status: 'scheduled',
        start: dueStart,
        end: new Date(dueStart.getTime() + 30 * 60 * 1000),
        remindClient: true,
        items: {
          create: {
            serviceId: service.id,
            professionalId: professional.id,
            durationMin: 30,
            price: 70,
          },
        },
      },
    });
    const reminderOutboxBefore = await prisma.whatsappOutbox.count({
      where: {
        companyId,
        customerId: proactiveCustomer.id,
        kind: 'reminder',
      },
    });
    await reminderPoller.runOnce(new Date());
    const reminderMarker =
      await prisma.appointmentNotification.findUnique({
        where: {
          appointmentId_type_channel: {
            appointmentId: reminderAppointment.id,
            type: 'reminder_2h',
            channel: 'whatsapp',
          },
        },
      });
    check(
      'fallback persistente criou marcador de lembrete 2h',
      Boolean(reminderMarker?.sentAt),
    );
    const reminderOutboxAfter = await prisma.whatsappOutbox.count({
      where: {
        companyId,
        customerId: proactiveCustomer.id,
        kind: 'reminder',
      },
    });
    check(
      'fallback sem Redis colocou lembrete no outbox/inbox',
      reminderOutboxAfter === reminderOutboxBefore + 1,
    );
    await reminderPoller.runOnce(new Date());
    check(
      'claim único impede lembrete duplicado no tick seguinte',
      (await prisma.whatsappOutbox.count({
        where: {
          companyId,
          customerId: proactiveCustomer.id,
          kind: 'reminder',
        },
      })) === reminderOutboxAfter,
    );

    // Isolamento multiempresa: o mesmo telefone em outro salão cria conversa,
    // outbox e histórico totalmente separados.
    const secondEmail = `wa-inbox-tenant-${Date.now()}@test.local`;
    const secondSignup = await api('POST', '/auth/sign-up/email', {
      body: {
        name: 'Segundo Salão Inbox',
        email: secondEmail,
        password: 'whatsapp-inbox-test-456',
      },
    });
    let secondToken = secondSignup.token;
    if (!secondToken) {
      secondToken = (
        await api('POST', '/auth/sign-in/email', {
          body: {
            email: secondEmail,
            password: 'whatsapp-inbox-test-456',
          },
        })
      ).token;
    }
    for (let attempt = 0; attempt < 20 && !secondCompanyId; attempt += 1) {
      const company = await api('GET', '/companies/current', {
        token: secondToken ?? undefined,
      });
      secondCompanyId = company.body?.id ?? '';
      if (!secondCompanyId)
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    check('segunda empresa provisionada', Boolean(secondCompanyId));
    const secondCustomer = await prisma.customer.create({
      data: {
        companyId: secondCompanyId,
        name: 'Maria Outro Salão',
        phone,
        notificationsEnabled: true,
        whatsappOptIn: true,
      },
    });
    await whatsapp.enqueueText(phone, 'Confirmação do segundo salão', {
      companyId: secondCompanyId,
      customerId: secondCustomer.id,
      kind: 'confirmation',
    });
    const isolated = await waitFor(async () => {
      return (
        (await prisma.whatsappInboxMessage.count({
          where: {
            companyId: secondCompanyId,
            text: 'Confirmação do segundo salão',
          },
        })) === 1
      );
    });
    check('segunda empresa recebeu sua própria automação', isolated);
    check(
      'mensagem da segunda empresa não vazou na primeira',
      (await prisma.whatsappInboxMessage.count({
        where: {
          companyId,
          text: 'Confirmação do segundo salão',
        },
      })) === 0,
    );
  } finally {
    if (secondCompanyId) {
      await prisma.whatsappOutbox
        .deleteMany({ where: { companyId: secondCompanyId } })
        .catch(() => undefined);
      await prisma.company
        .delete({ where: { id: secondCompanyId } })
        .catch(() => undefined);
    }
    if (companyId) {
      await prisma.whatsappOutbox
        .deleteMany({ where: { companyId } })
        .catch(() => undefined);
      await prisma.appointmentItem
        .deleteMany({ where: { appointment: { companyId } } })
        .catch(() => undefined);
      await prisma.appointment
        .deleteMany({ where: { companyId } })
        .catch(() => undefined);
      await prisma.company
        .delete({ where: { id: companyId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  }

  const total = passed + failures.length;
  // eslint-disable-next-line no-console
  console.log(
    `\nWhatsApp inbox/IA: ${passed}/${total} assertions passed${
      failures.length ? `, ${failures.length} FAILED` : ''
    }`,
  );
  if (failures.length) {
    throw new Error(`Falhas:\n- ${failures.join('\n- ')}`);
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
