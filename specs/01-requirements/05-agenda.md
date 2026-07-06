# 05 — Agenda

## User Stories
- Como admin, quero ver e gerenciar a agenda por dia/semana/mês.
- Como admin, quero criar, editar, confirmar, cancelar e marcar agendamentos como atendidos.

## Critérios de Aceite
- O SISTEMA DEVE exibir calendário com visões dia, semana e mês.
- A visão mês DEVE mostrar chips de agendamento e indicador "+N more" quando houver muitos no dia.
- Cada agendamento DEVE mostrar horário, cliente, serviço, profissional e status (cor por status).
- Status suportados: agendado, confirmado, não confirmado, aguardando, em andamento, atendido, finalizado, cancelado.
- O SISTEMA DEVE permitir CRUD de agendamento e múltiplos serviços por agendamento.
- O SISTEMA DEVE filtrar por profissional, serviço, status e data.
- QUANDO se cria/edita um agendamento, O SISTEMA NÃO DEVE permitir colisão com horário ocupado do profissional.
- O SISTEMA DEVE respeitar o horário de atendimento (`professional_schedules`) e a duração do serviço.
- QUANDO o status muda, O SISTEMA DEVE registrar histórico (`appointment_status_history`).
- `GET /availability` DEVE retornar apenas horários livres considerando ocupação + horário + duração.

## Integrações
A agenda alimenta: comandas, relatórios, ocupação de profissionais, comissões.
