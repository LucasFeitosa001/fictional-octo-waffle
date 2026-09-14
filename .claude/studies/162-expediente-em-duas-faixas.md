/**/
# Estudo 162 — expediente com pausa para almoço

## Sintoma

O cadastro de profissional aceitava apenas uma faixa por dia. Isso impedia
registrar corretamente um expediente dividido, como 08:00–12:00 e 14:00–20:00,
e deixava o intervalo de almoço disponível para agendamento.

## Arquivos tocados

- `apps/web/src/pages/ProfissionaisPage.tsx`

## Correção

O editor agrupa as linhas de expediente do mesmo dia, permite adicionar ou
remover uma segunda faixa e envia todas as janelas ao endpoint existente. A
hidratação preserva faixas já gravadas; a primeira faixa mantém os horários
atuais por compatibilidade. O salvamento valida início antes do fim e impede
faixas sobrepostas.

## Verificação

O typecheck do aplicativo web passou. O backend já aceitava várias linhas para o
mesmo dia, portanto não foi necessária migração de banco.
