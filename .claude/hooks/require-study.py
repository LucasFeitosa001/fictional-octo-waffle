#!/usr/bin/env python3
"""
Hook PreToolUse: "estudar antes de codificar".

Bloqueia Edit/Write/NotebookEdit em arquivo de CÓDIGO enquanto não existir um
estudo documentado que cite aquele arquivo. O estudo é um .md em .claude/studies/
contendo o caminho do arquivo (repo-relative) e evidências no formato arquivo:linha.

Por que existe: já quebramos produção mais de uma vez por editar antes de entender
(ex.: contar `appointment.status === 'finished'` num painel cujo import deixa tudo
em "confirmed"; trocar $queryRaw por advisory lock que retorna void). O estudo
força ler o código real e registrar a evidência antes de tocar nele.

Como liberar um arquivo: crie/atualize .claude/studies/<assunto>.md citando o
caminho do arquivo e as linhas relevantes. Depois edite.

Saída: JSON de PreToolUse (permissionDecision deny) quando falta estudo.
"""
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STUDY_DIR = os.path.join(REPO, ".claude", "studies")

# Só exigimos estudo para código de verdade.
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".prisma", ".sql", ".rs", ".py"}

# Caminhos livres: a própria documentação/config do processo e artefatos descartáveis.
FREE_PREFIXES = (
    ".claude/",
    "docs/",
    "belasis-reference/",
    "scripts/",
    "specs/",
)


def allow():
    sys.exit(0)


def deny(reason: str):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        allow()  # sem payload legível → não atrapalha

    path = (payload.get("tool_input") or {}).get("file_path") or ""
    if not path:
        allow()

    abs_path = os.path.abspath(path)
    rel = os.path.relpath(abs_path, REPO).replace(os.sep, "/")

    # Fora do repo → não é nosso código.
    if rel.startswith(".."):
        allow()

    if any(rel.startswith(p) for p in FREE_PREFIXES):
        allow()

    ext = os.path.splitext(rel)[1].lower()
    if ext not in CODE_EXT:
        allow()

    # Arquivo novo (ainda não existe) também exige estudo — é onde mais se erra.
    studies = []
    if os.path.isdir(STUDY_DIR):
        for name in os.listdir(STUDY_DIR):
            if name.endswith(".md"):
                try:
                    with open(os.path.join(STUDY_DIR, name), encoding="utf-8", errors="replace") as fh:
                        studies.append((name, fh.read()))
                except OSError:
                    pass

    base = os.path.basename(rel)
    for name, text in studies:
        if rel in text:
            # Exige pelo menos uma evidência arquivo:linha no estudo.
            if re.search(r"\.(ts|tsx|js|jsx|prisma|sql|py|rs):\d+", text):
                allow()
            deny(
                f"O estudo '{name}' cita {rel} mas NÃO tem evidência no formato arquivo:linha. "
                "Acrescente as linhas concretas que você leu (ex.: apps/api/src/x.ts:120) e edite de novo."
            )

    deny(
        f"ESTUDO OBRIGATÓRIO ANTES DE CODIFICAR — nenhum estudo cobre {rel}.\n"
        f"1) Leia o código real que você vai mexer (e quem o chama).\n"
        f"2) Escreva .claude/studies/<assunto>.md contendo o caminho '{rel}' e evidências arquivo:linha "
        f"(o que a função faz hoje, quem chama, qual o comportamento observado).\n"
        f"3) Só então edite. (Arquivo tocado: {base})"
    )


if __name__ == "__main__":
    main()
