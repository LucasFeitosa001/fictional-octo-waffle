# Belasis /calendar vs SalonPass /agenda — Gaps

Comparativo mobile (iPhone 13) entre Belasis `/calendar` (referência) e SalonPass `/agenda` (implementação atual). Base de evidências: scrapes autenticados em `_out/agenda-belasis-scrape/`.

---

## Login Belasis

- **Task:** Testar login em https://belasis.app com `franciscoffdc14@gmail.com` / `jafa1014@&`
- **Status:** done
- **Resumo:** Login OK. Fluxo funcional: `/login-by-phone` é o default; clicar "Login with email" leva a `/login` (form email/senha); enviar por Enter no campo password autentica e redireciona para `https://belasis.app/calendar`.
- **Storage state:** `/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/belasis-auth.json` (reutilizável nas próximas raspagens).
- **Artefatos:** `post-login.png`, `login.js` no mesmo diretório.
- **Observação:** o botão `button[type=submit]` no DOM está com atributo `hidden` — Playwright bloqueia click; solução usada foi `passBox.press('Enter')`. Auth do app roda via Firebase/Cognito (token de sessão fica em `sessionStorage` do próprio site — não em cookie do backend Belasis).

---

## Scrape /calendar

- **Task:** Scrape `/calendar` Belasis mobile
- **Status:** done
- **Resumo:** Scrape do `/calendar` em viewport iPhone 13 concluído com sessão autenticada. URL final permaneceu em `https://belasis.app/calendar` (não bounçou para `/login`). **124 event/appointment cards** detectados. Header capturou banner de "pagamento não identificado" da própria conta Belasis (não erro do scrape).
- **Arquivos gerados:**
  - `/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/calendar.html` (340KB)
  - `/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/calendar.png` (240KB fullPage)
  - `/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/calendar.info.json`
  - `/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/scrape.js`

---

## Comparação SalonPass /agenda vs Belasis /calendar

- **Task:** Playwright SalonPass `/agenda` mobile scrape + comparação com Belasis `/calendar`
- **Status:** done
- **Screenshot SP:** `/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/salonpass-agenda.png`

### SalonPass /agenda (iPhone 13) — estado atual
- **Header:** "Julho, 2026" com `< >` laranjas + botão play/hoje (▶ circular laranja no canto superior direito).
- **Visualização:** month grid (dom→sáb), semanas empilhadas verticalmente, cards de evento **verdes** com hora + NOME + SERVIÇO truncados; overflow "+N more" em laranja.
- **H1/topbar:** ausente na página (título só na aba do browser: "Salonpass Gestão").
- **BottomNav** (drawer/pill preto flutuante): `Menu | Calendário | Filtros | Criar | Ações`.
- **FAB extra:** bolha amarela flutuante com ícone chat/mensagem (canto inf. direito, acima da BottomNav) — provavelmente WhatsApp/suporte.
- **Sidebar (via drawer Menu):** Principal (Painel, Agenda, Comandas, Pacotes, Vendas por Assinatura), Financeiro, Comissões, Cadastros, Controle, Relatórios, Marketing, Ajuda, Configurações — completo.

### Belasis /calendar mobile (referência `calendar.png`)
- **Header idêntico:** "Julho, 2026" `< >` + botão play circular (roxo/azul).
- **Mesmo month grid** com cards; cards em **cinza-azulado** (não verde uniforme — parece colorir por status/tipo).
- **BottomNav:** `Menu | Calendário | Filtros | Ações | Criar` (**Criar por ÚLTIMO**, com ícone `+`).
- **Sem FAB de chat.**
- **Banner vermelho de billing** "Lamentamos a interrupção" no topo (não é feature, ignorar).

### Conclusão
`/agenda` mobile SP está **~95% pareado** com Belasis `/calendar`. Restam ajustes cosméticos elencados abaixo.

---

## Gaps identificados (prioridade)

### 🔴 High

- **Ordem da BottomNav divergente** — Belasis termina em `[Ações, Criar]` (Criar por último, como CTA primário com `+`). SalonPass termina em `[Criar, Ações]`.
  **Ação:** reordenar a BottomNav mobile em `/agenda` para `Menu | Calendário | Filtros | Ações | Criar`.

- **Cor uniforme dos cards de evento** — SalonPass renderiza todos os cards verdes; Belasis usa tom cinza-azulado (aparentemente tokenizado por status/tipo), perdendo diferenciação visual no month grid.
  **Ação:** tokenizar `--sp-event-bg` por status (agendado/confirmado/concluído/cancelado) em vez de cor única verde.

### 🟡 Medium

- **FAB amarelo de chat flutuante sobre o calendário** — não existe em Belasis `/calendar` e compete visualmente com a BottomNav.
  **Ação:** ocultar/mover o FAB de chat na rota `/agenda` (ou reduzir opacidade quando o scroll está no grid).

- **Semântica do botão play (▶) no header** — ambos têm o botão, mas Belasis pode usá-lo como "modo apresentação/próximo evento" enquanto SalonPass mapeou só como "hoje".
  **Ação:** validar comportamento no Belasis e alinhar semântica; hoje o SP faz apenas jump-to-today.

### 🟢 Low

- **Ausência de H1/topbar** na página `/agenda` (título aparece só na aba do browser). Belasis também não exibe H1, então é paridade — mas convém confirmar se o padrão do design system SP exige título.
  **Ação:** revisar se há regra global de H1 por rota; se sim, adicionar visualmente oculto para acessibilidade.

- **Banner de billing** (Belasis exibe faixa vermelha de cobrança). Não é feature — ignorar.
  **Ação:** nenhuma.
