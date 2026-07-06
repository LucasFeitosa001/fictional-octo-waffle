# 01 — Auth & Empresa

## User Stories
- Como dona do salão, quero criar minha conta e meu estabelecimento para começar a usar.
- Como admin, quero entrar com email/senha, Google, Apple ou telefone.
- Como cliente, quero um login rápido no agendamento público.
- Como admin, quero definir permissões por usuário.

## Critérios de Aceite
- QUANDO um novo usuário se cadastra, O SISTEMA DEVE criar `company` + `user` admin + plano grátis/trial e retornar tokens.
- QUANDO o admin faz login com credenciais válidas, O SISTEMA DEVE retornar accessToken (JWT) + refreshToken + dados do usuário.
- QUANDO o token expira, O SISTEMA DEVE permitir renovar via refresh.
- QUANDO há login por telefone, O SISTEMA DEVE validar via OTP.
- O SISTEMA DEVE escopar todo acesso por `companyId` derivado do token (multi-tenant).
- QUANDO um usuário sem permissão acessa um módulo, O SISTEMA DEVE negar (403).
- O SISTEMA DEVE expor `GET /auth/me` e `GET /auth/permissions`.

## Telas (mobile)
- Login (login rápido, Google, Apple, telefone), Cadastro, Perfil ("Olá, NOME"), sininho de notificações com contador, versão no rodapé.

## Fora de escopo (fase 1)
- SSO corporativo, 2FA por app autenticador.
