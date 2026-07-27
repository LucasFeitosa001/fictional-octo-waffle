-- Personalização visual agora é da EMPRESA (compartilhada por todos os logins),
-- não mais por-usuário. Guarda tema, formato dos botões, sidebar, botão fechar
-- e atalho do CRM em JSON. A antiga User.appearancePreferences permanece intacta
-- (retrocompatibilidade), mas o app passa a ler/gravar esta coluna.
ALTER TABLE "Company"
ADD COLUMN "appearancePreferences" JSONB;
