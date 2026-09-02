/**/
# Estudo 168 — servidor MCP do SalonPass (dados 100% reais)

Pedido do dono:

> "Integrar MCP pra puxar dados 100% reais"

Escolha dele entre as opções: um **servidor MCP do SalonPass**, expondo os
dados reais (comandas, agendamentos, clientes, comissões, estoque) como
ferramentas que qualquer cliente MCP — Claude Code, Claude Desktop, a IA do
Voltr no futuro — pode consultar.

## Arquivos tocados

- `tools/mcp-salonpass/package.json` (novo)
- `tools/mcp-salonpass/servidor.mjs` (novo)
- `.mcp.json` (novo, raiz do repo)

## Decisões de arquitetura

**Fala com a API, nunca com o banco.** O servidor autentica como um usuário
real (`POST /auth/sign-in/email` → bearer) e chama os mesmos endpoints do
painel. Isso preserva as três coisas que acesso direto ao banco destruiria:
o escopo multi-tenant (cada token enxerga só a empresa dele), as permissões
por papel, e as regras de negócio das consultas (estorno fora dos totais,
período com fim-de-dia, etc). "Dados 100% reais" também significa "os mesmos
números que a tela mostra" — e isso só a API garante.

**Somente leitura.** Nenhuma ferramenta de escrita nesta primeira versão.
Escrever via MCP significa uma IA criando comanda/agendamento sozinha — isso
merece conversa própria sobre travas, não um brinde escondido na integração.

**Credenciais por ambiente** (`SALONPASS_EMAIL` / `SALONPASS_PASSWORD` /
`SALONPASS_API_URL`), nunca no código nem no `.mcp.json` versionado — o
`.mcp.json` referencia as variáveis, e cada máquina configura as suas. Token
renovado sozinho quando expira (relogin em 401).

**Datas em pt-BR e valores em R$** nas respostas: quem consome é um modelo
conversando com gente do salão.

## Ferramentas expostas (verificadas contra os controllers reais)

| ferramenta | endpoint | evidência |
|---|---|---|
| `listar_comandas` | `GET /orders` | `orders.controller.ts` (listagem usada pelo painel; devolve number/date/customer/status/netTotal — visto em `ComandasPage` nesta sessão) |
| `listar_agendamentos` | `GET /appointments?from&to` | `appointments.service.ts:172-184` (findMany com include customer/professional/items/order) |
| `buscar_clientes` | `GET /customers?search=` | `customers.controller.ts:82-205` (rotas GET/POST); filtro `search` confirmado em runtime nesta sessão (o `?q=` não filtra, `?search=` sim) |
| `listar_servicos` | `GET /services` | `services.controller.ts:57` (`@Post('services')` ao lado do GET homônimo) |
| `listar_produtos` | `GET /products?search=` | `products.service.ts:48-53` (findMany com include; devolve stock/minStock/trackStock — confirmado em runtime: "campos: stock, minStock, trackStock") |
| `resumo_comissoes` | `GET /commissions/summary?from&to` | `commissions.controller.ts:63` |
| `pagamentos_de_comissao` | `GET /commission-payments` | `commissions.controller.ts:171`; `paymentMethodName` incluído no estudo 165 (`commissions.service.ts:912-939`) |
| `visao_geral` | `GET /reports/overview?from&to` | `reports.controller.ts:21` (`@Get('overview')`); shape em `reports.service.ts:39-230` (salesTotal, topServices, topProfessionals, paymentsByMethod) |

O corpo do servidor vive em `tools/mcp-salonpass/servidor.mjs`, com o registro
de cada ferramenta na ordem da tabela acima.

## SDK

`@modelcontextprotocol/sdk@1.30.0` (verificado no npm em 20/08/2026; exige
Node ≥18). API sondada no pacote instalado: `McpServer.registerTool` +
`StdioServerTransport` — não confiei na memória, os exports foram listados em
runtime antes de escrever.
