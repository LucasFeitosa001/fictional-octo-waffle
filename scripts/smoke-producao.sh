#!/usr/bin/env bash
# Smoke de ESCRITA contra Postgres REAL.
#
# Existe porque a suíte do projeto usa um Prisma falso: SQL cru nunca é
# executado, então um lock inválido passa verde e só quebra em produção (foi o
# que derrubou o pagamento de comissão por 4 dias). Aqui cada passo bate no
# banco de verdade.
set -u
API="http://localhost:3334/api/v1"
ORIG="Origin: http://localhost:5173"
EMP="cms4ulnqm000h0h4t8xlgnzch"
ROLE="cms4ulnuu001j0h4t19ya6eee"
PGPASSWORD=$(grep -E "^DATABASE_URL" /home/lucssfeitosa/beautypass/beautypass/packages/db/.env | sed -E 's|.*://[^:]+:([^@]*)@.*|\1|')
export PGPASSWORD
psql() { command psql -h localhost -p 5434 -U beautypass -d beautypass "$@"; }

ok=0; falhou=0
passo() { # nome, http, esperado
  if [ "$2" = "$3" ]; then printf "  OK   %-46s %s\n" "$1" "$2"; ok=$((ok+1));
  else printf "  FALHA %-45s %s (esperado %s)\n" "$1" "$2" "$3"; falhou=$((falhou+1)); fi
}

EMAIL="smoke-$(date +%s)@local.test"
curl -s -X POST "$API/auth/sign-up/email" -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"SenhaForte#2026\"}" -o /dev/null
psql -tAc "update \"User\" set \"companyId\"='$EMP' where email='$EMAIL';
  insert into \"UserCompany\" (id,\"userId\",\"companyId\",\"roleId\")
  select gen_random_uuid()::text,u.id,'$EMP','$ROLE' from \"User\" u where u.email='$EMAIL'
  on conflict do nothing;" >/dev/null 2>&1

C=$(curl -s -o /tmp/s_login.json -w "%{http_code}" -X POST "$API/auth/sign-in/email" \
  -H "Content-Type: application/json" -H "$ORIG" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SenhaForte#2026\"}")
passo "login (email+senha)" "$C" "200"
TOK=$(python3 -c "import json;print(json.load(open('/tmp/s_login.json')).get('token',''))" 2>/dev/null)
AUTH=(-H "Authorization: Bearer $TOK" -H "$ORIG" -H "Content-Type: application/json")

C=$(curl -s -o /tmp/s_sess.json -w "%{http_code}" "${AUTH[@]}" "$API/auth/get-session")
passo "ler sessão (a coluna que faltava)" "$C" "200"

# ── cliente ──────────────────────────────────────────────────────────────────
C=$(curl -s -o /tmp/s_cli.json -w "%{http_code}" -X POST "$API/customers" "${AUTH[@]}" \
  -d '{"name":"Cliente Smoke","phone":"5511999998888"}')
passo "criar cliente" "$C" "201"
CLI=$(python3 -c "import json;print(json.load(open('/tmp/s_cli.json')).get('id',''))" 2>/dev/null)

C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$API/customers/$CLI" "${AUTH[@]}" \
  -d '{"name":"Cliente Smoke Editado"}')
passo "editar cliente" "$C" "200"

# ── comanda (o caminho do dinheiro) ──────────────────────────────────────────
SVC=$(psql -tAc "select id from \"Service\" where \"companyId\"='$EMP' limit 1;" | tr -d ' ')
PRO=$(psql -tAc "select id from \"Professional\" where \"companyId\"='$EMP' limit 1;" | tr -d ' ')
C=$(curl -s -o /tmp/s_ord.json -w "%{http_code}" -X POST "$API/orders" "${AUTH[@]}" \
  -d "{\"customerId\":\"$CLI\",\"professionalId\":\"$PRO\"}")
passo "criar comanda (advisory lock de orders)" "$C" "201"
ORD=$(python3 -c "import json;print(json.load(open('/tmp/s_ord.json')).get('id',''))" 2>/dev/null)

C=$(curl -s -o /tmp/s_item.json -w "%{http_code}" -X POST "$API/orders/$ORD/items" "${AUTH[@]}" \
  -d "{\"kind\":\"service\",\"refId\":\"$SVC\",\"quantity\":1,\"professionalId\":\"$PRO\"}")
passo "adicionar item na comanda" "$C" "201"

# o teto novo do desconto de item precisa RECUSAR
ITEM=$(psql -tAc "select id from \"OrderItem\" where \"orderId\"='$ORD' limit 1;" | tr -d ' ')
C=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$API/orders/$ORD/items/$ITEM" "${AUTH[@]}" \
  -d '{"discount":999999}')
passo "desconto maior que o item é RECUSADO" "$C" "400"

# ── comissão (o que estava quebrado desde 05/08) ─────────────────────────────
PROC=$(psql -tAc "select \"professionalId\" from \"CommissionEntry\" where \"companyId\"='$EMP' and status='open' limit 1;" | tr -d ' ')
if [ -n "$PROC" ]; then
  C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/commission-payments" "${AUTH[@]}" \
    -d "{\"professionalId\":\"$PROC\"}")
  passo "pagar comissão (advisory lock)" "$C" "201"
else
  printf "  --   pagar comissão: sem entry aberta no banco local\n"
fi

# ── limpeza ──────────────────────────────────────────────────────────────────
[ -n "$ORD" ] && psql -tAc "delete from \"OrderItem\" where \"orderId\"='$ORD'; delete from \"Order\" where id='$ORD';" >/dev/null 2>&1
[ -n "$CLI" ] && psql -tAc "delete from \"Customer\" where id='$CLI';" >/dev/null 2>&1
psql -tAc "delete from \"UserCompany\" where \"userId\" in (select id from \"User\" where email='$EMAIL');
  delete from \"Session\" where \"userId\" in (select id from \"User\" where email='$EMAIL');
  delete from \"Account\" where \"userId\" in (select id from \"User\" where email='$EMAIL');
  delete from \"User\" where email='$EMAIL';" >/dev/null 2>&1

echo
echo "  ---------------------------------------------"
printf "  %d passaram, %d falharam\n" "$ok" "$falhou"
exit $([ "$falhou" -eq 0 ] && echo 0 || echo 1)
