#!/usr/bin/env bash
# pixel-refine-vm.sh — fan-out headless na VM 32GB.
# Uso (depois que belasis-reference/pixel/ foi capturado LOCAL + rsync'd pra VM):
#   ssh ubuntu@VM 'bash /home/ubuntu/beautypass/belasis-reference/pixel-refine-vm.sh'
# Refina cada rota em paralelo (MAX=4) usando as capturas dinâmicas + spec + código atual.
set +e
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"
REPO=/home/ubuntu/beautypass
REF=$REPO/belasis-reference
WEB=$REPO/apps/web
PIXEL=$REF/pixel
MAX=${MAX:-4}
mkdir -p /home/ubuntu/pixel-logs

ROUTES=(
  "calendar|src/pages/AgendaPage.tsx|Agenda"
  "sales|src/pages/ComandasPage.tsx|Comandas"
  "clients|src/pages/ClientesPage.tsx|Clientes"
  "employees|src/pages/ProfissionaisPage.tsx|Profissionais"
  "products|src/pages/ProdutosPage.tsx|Produtos"
  "services|src/pages/ServicosPage.tsx|Serviços"
  "packages|src/pages/PacotesPage.tsx|Pacotes"
  "subscriptions|src/pages/AssinaturasPage.tsx|Vendas por Assinatura"
  "vendors|src/pages/FornecedoresPage.tsx|Fornecedores"
  "brands|src/pages/MarcasPage.tsx|Marcas"
  "finance-transactions|src/pages/financeiro/TransacoesPage.tsx|Financeiro/Transações"
  "finance-accounts|src/pages/financeiro/ContasPage.tsx|Financeiro/Cadastros"
  "purchases|src/pages/controle/ComprasPage.tsx|Compras"
  "package-templates|src/pages/controle/PacotesPredefinidosPage.tsx|Pacotes Predefinidos"
)

refine_one() {
  local slug="$1" target="$2" mod="$3"
  local safe="${target//\//_}"
  local log=/home/ubuntu/pixel-logs/${slug}.log
  local pdir=$PIXEL/desktop/$slug
  local mdir=$PIXEL/mobile/$slug
  cp "$WEB/$target" "$WEB/$target.pre-pixel-bak" 2>/dev/null

  local pickers_list=$(ls "$pdir"/pickers/*/overlay.html 2>/dev/null | head -20 | tr '\n' ' ')
  local prompt="RAM: grep sempre com caminho de arquivo explícito. Nunca recursivo.

REFINE ${mod} (${target}) para 1:1 com o Belasis usando as CAPTURAS DINÂMICAS reais:
- Base desktop: $pdir/page.html + $pdir/page.png + $pdir/page.css.json (CSS computed)
- Drawer Novo: $pdir/new-open.html + $pdir/new-open.png + $pdir/new-open.css.json  (leia transitionDuration/transitionTimingFunction pra pegar animação REAL)
- Pickers: $pickers_list  — cada overlay.html + css.json mostra o comportamento REAL do dropdown/autocomplete/date/drawer-mobile
- Mobile drawer (se existir): $mdir/new-open.html
- Modal excluir (se existir): $pdir/delete-confirm.html + .css.json

REGRAS:
1) Header + botões na ORDEM real do page.html (Buscar/Filtrar/Novo/…).
2) Colunas da tabela idênticas ao HTML real (nomes + ordem).
3) Drawer com largura REAL do rect (css.json __rect.w) e as tabs internas do HTML.
4) Cada picker: use EntityPicker se autocomplete/select; datepicker antd-like; drawer bottom no mobile — pegue as durações de animação do CSS computed.
5) Cores: pra tokens themeable (bg-primary etc.) SEMPRE que possível; cores literais só se semânticas (status) OU se aparecerem hardcoded no CSS computed do Belasis.
6) Mobile: filtros/ações via useSetPageActions (BottomNav). Excluir: useConfirm() do ConfirmDialog global.
7) PRESERVE data-wiring (hooks/queries/rotas). NÃO edite chrome global.
8) cd $WEB && npx tsc --noEmit até limpar. NÃO rode vite build.

Responda: mudanças aplicadas + 'TSC LIMPO'."

  echo \"=== \$(date +%T) START pixel-refine \$slug ===\" | tee -a \"\$log\"
  RC=1
  for att in 1 2 3; do
    timeout 2400 claude -p \"\$prompt\" --dangerously-skip-permissions < /dev/null >> \"\$log\" 2>&1
    RC=\$?
    echo \"=== \$(date +%T) END pixel-refine \$slug att=\$att rc=\$RC ===\" | tee -a \"\$log\"
    [ \"\$RC\" -eq 0 ] && break
    sleep 30
  done
}
export -f refine_one
export PIXEL WEB

echo "$(date +%T) PIXEL REFINE BATCH START MAX=$MAX" > /home/ubuntu/pixel-logs/_batch.log
for entry in "${ROUTES[@]}"; do
  IFS='|' read -r slug target mod <<< "$entry"
  while [ "$(jobs -rp | wc -l)" -ge "$MAX" ]; do sleep 5; done
  echo "$(date +%T) LAUNCH $slug -> $target" >> /home/ubuntu/pixel-logs/_batch.log
  ( refine_one "$slug" "$target" "$mod" < /dev/null ) &
  sleep 3
done
wait
echo "$(date +%T) PIXEL REFINE BATCH DONE" >> /home/ubuntu/pixel-logs/_batch.log

echo "=== TSC final ==="
cd $WEB && npx tsc --noEmit 2>&1 | grep -c "error TS"
