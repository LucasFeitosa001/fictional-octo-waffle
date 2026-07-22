# GAP EXTRA — Áreas que escaparam do relatório principal

> Consolidação das áreas Belasis que **não entraram** no relatório de gaps principal.
> Cada área foi reauditada contra o código atual do SalonPass (`apps/web` + `apps/api`).
> Data: 2026-07-21 · Branch: `feat/belasis-etapa2`

São **9 áreas**. Resumo: a maioria **já tem casca visual** no SalonPass (rota + UI), mas a
paridade real cai porque falta **persistência/backend** ou porque a UI é **placeholder/estado local**.
Duas áreas são praticamente inexistentes (Belasis Pay/Transferências e a Assinatura pública).

---

## Tabela resumo

| Área | Existe | Paridade % | Prioridade | Top missing (o gap central) |
|------|:------:|:----------:|:----------:|------------------------------|
| **Anamnese / fichas** | Sim | 45% | Média | Persistir modelos (`AnamnesisTemplate` + CRUD) e o núcleo clínico: editor de respostas por ficha + assinatura + editar/excluir. UI de modelos ~1:1, mas roda 100% em estado local (`SEED_TEMPLATES`). |
| **Metas / Goals** | Sim | 72% | Média | Dimensão **por profissional**: filtro e coluna "Profissional" estão chumbados em "Todos"; `Goal` não tem `employeeId`/escopo por funcionário — é o que define a meta no Belasis. |
| **Caixa (abrir/fechar/sangria)** | Sim | 90% | Baixa | Enriquecimento de backend: Total a receber, anotação de fechamento e responsável pelo fechamento (todos já marcados como `TODO(backend)`). Nenhum fluxo central falta. |
| **Belasis Pay / Transferências** | **Não** | 5% | Baixa | A tela Transferências (e todo o Belasis Pay Painel/Transações) não existe; só há um form de onboarding stub. Exige infra de conta digital/gateway (saldo, KYC, PIX, saques). |
| **Relatórios (fin./estoque/clientes/msg)** | Sim | 30% | Média | ~16 sub-relatórios não registrados no router + **links mortos** no sidebar (`/reports/...` sem rota). O hub existe e 8 relatórios rodam; falta profundidade e navegação. |
| **Nota fiscal de serviço (NFS-e)** | Sim | 20% | Média | Emissão real via provedor fiscal/prefeitura (certificado A1, ISS, código de serviço). Página existe mas é shell bloqueado por `UpsellModal`, `allRows` vazio, sem backend fiscal em `apps/api`. |
| **Cliente — sub-abas (Msg/Arquivos/Assinatura/Cashback)** | Sim | 20% | Média | Mensagens, Imagens e Arquivos e Vendas por Assinatura são **placeholders** (só `EmptyState`). Apenas Cashback é real — e read-only (sem gerar/resgatar/ajustar). |
| **Cashback (programa)** | Sim | 30% | Média | Programa **global** não existe: config (ativar, valor padrão R$/%, permitir resgate, mínimo), fluxo de resgate e saldo por cliente. As abas Clientes/Configurações são placeholders. Regras por escopo (%) funcionam. |
| **Assinatura pública (link online)** | Sim | 5% | Média | Página pública `/subscription` (storefront) + link/copiar + switch Visível + descrição + gate de pagamento online. Aba Configurações é placeholder "em breve"; sem rota pública. |

---

## O que precisa **backend** vs **só-UI (frontend)**

### Só-UI / quick wins (needsBackend = false)
Podem ser feitos reaproveitando o que já existe, sem mexer no schema/serviços:

- **Anamnese** — Seletor de modelo ao criar a ficha do cliente (o `POST /customers/:id/anamneses` já aceita `templateId`; a UI envia vazio).
- **Metas** — Botão/dropdown **"Ações"** para operações em lote sobre metas selecionadas.
- **Belasis Pay** — Sub-navegação com abas **Painel / Transações / Transferências** (casca de navegação).
- **Relatórios** — Fluxo de Caixa / Movimentações de caixa (reaproveita transações/caixa existentes).
- **Relatórios** — Extrato de Contas (sobre `transactions`/`accounts` já existentes).
- **Relatórios** — Extrato de Movimentações.
- **Relatórios** — Histórico de caixa como relatório (já há `CaixaHistoricoPage`).
- **Relatórios** — Relatório de Notas Fiscais (já há `NotasFiscaisPage`).
- **Relatórios** — Estoque: Lista de Produtos e Serviços com filtros ativos/inativos + categoria + produto/serviço (catálogo já existe).
- **Relatórios** — Estoque: Sugestão de compra como relatório dedicado (hoje é só coluna em Estoque atual).
- **Relatórios** — **Registrar as rotas `/reports/...`** hoje mortas no sidebar (navegação quebrada entre sub-relatórios).
- **Caixa** — Impressão/comprovante da conferência (sinal fraco, só inferido pelo CSS `no-print`; sem botão "Imprimir" visível).

### Precisa backend (needsBackend = true)
Exigem schema novo, novos endpoints ou agregações:

- **Anamnese** — Model `AnamnesisTemplate` + CRUD de modelos; editor de perguntas persistido; editor de respostas por ficha (`answersJson`); assinar ficha (`signedAt` + `PATCH`); editar/excluir `CustomerAnamnesis`; lista global de fichas preenchidas.
- **Metas** — Escopo **por profissional** (`employeeId` no `Goal` + service + progresso por profissional); linhas expansíveis com breakdown por meta.
- **Caixa** — Total a receber no card; anotação de fechamento; responsável pelo fechamento distinto da abertura.
- **Belasis Pay** — Tela Transferências (listagem de saques/transferências); tabela (Solicitação, Transferência, Operação, Status, Nome, CPF/CNPJ, Valor); filtro por período; paginação; lista mobile infinite scroll; **backend de conta digital/gateway** (saldo, saque, status, KYC/PIX).
- **Relatórios** — Resultado Líquido de Produtos; Projeção de Faturamento; Recebimentos (aging); Despesas; Estoque: Movimentação/Compras/Produtos consumidos; Clientes: Inativos dedicado, Pendentes/Inadimplentes, Ranking de clientes (por valor gasto), Retornos para hoje; Relatórios Favoritos.
- **NFS-e** — Emissão real via provedor fiscal (certificado A1, RPS/série, código de serviço, ISS); emissão vinculada à comanda; download XML + PDF (DANFSE); ciclo de vida/cancelamento; config fiscal do estabelecimento e por item (NCM/CFOP/ISS); importação de XML de NF-e de fornecedor.
- **Cliente — sub-abas** — Mensagens (chat WhatsApp/SMS + templates); Imagens e Arquivos (upload/galeria/download/exclusão, storage); Vendas por Assinatura (planos, cobrança recorrente, status); Cashback com ações (gerar/resgatar/ajustar).
- **Cashback (programa)** — Config global (`cashback_active`, valor padrão + `value_type` R$/%, `can_redeem_cashback`, `cashback_minimum_value_cents`); fluxo de resgate; saldo por cliente (model `CustomerCashback` existe, sem endpoint/UI); cashback por item em R$ + toggle + ação em massa.
- **Assinatura pública** — Link público (subdomain/`site_config`); switch Visível (`subscription_template_visible`); gate `has_online_payment`; descrição (`subscription_template_description`); `saveSalonConfiguration`; **página pública `/subscription` (storefront)**.

---

## Features **NOVAS inteiras** (construir end-to-end, não é polish)

Áreas/sub-features onde não há implementação funcional — precisam ser construídas do zero:

1. **Belasis Pay / Transferências** — inexistente (só um form de onboarding stub). Requer toda a infra de instituição de pagamento/conta digital: saldo, KYC, PIX, saques, status de operação, além da tela de listagem + filtros + paginação.
2. **Assinatura pública / storefront online (`/subscription`)** — página pública de contratação não existe; a aba Configurações é placeholder "em breve". Depende de infra de pagamento online + `site_config`/subdomain.
3. **Cliente › Mensagens (chat WhatsApp/SMS + templates)** — placeholder `EmptyState`. Requer mensageria/WhatsApp, histórico de conversa e modelos de mensagem.
4. **Cliente › Imagens e Arquivos** — placeholder `EmptyState`. Requer storage (upload S3), galeria + lista, download e exclusão.
5. **Cliente › Vendas por Assinatura** — placeholder `EmptyState`. Requer assinaturas/vendas recorrentes por cliente (planos, cobrança recorrente, status).
6. **NFS-e — emissão fiscal real** — não há **nenhum** backend fiscal em `apps/api`. Requer integração com provedor fiscal por município, certificado digital A1, ISS/código de serviço, ciclo de vida da nota + importação de XML de fornecedor.
7. **Cashback — programa global** — a camada de regras por escopo (%) funciona, mas o **programa** (config global + fluxo de resgate + saldo por cliente) está 0%; é um módulo novo apoiado no model `CustomerCashback` existente.
8. **Anamnese — núcleo clínico + persistência de modelos** — a casca visual existe, mas nada persiste. Requer `AnamnesisTemplate` + CRUD e o editor de respostas/assinatura/edição das fichas do cliente (feature funcional nova apesar da UI pronta).

> **Nota de captura:** `belasis-reference/anamnesis/desktop.html` está **vazio (0 bytes)** — a aba "Anamneses" preenchida do Belasis não pôde ser inspecionada; a lista global de fichas é inferida da existência da aba.
