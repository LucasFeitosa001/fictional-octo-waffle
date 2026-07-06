# Silvia Hair ERP — Desktop (Tauri + React + Tailwind)

App desktop de gestão do salão: dashboard, agenda, clientes, profissionais,
serviços, produtos, fornecedores, grupos, estoque, caixa/comandas, financeiro,
relatórios, consultas, configurações e suporte.

- **Dados:** mockados/persistidos em `localStorage` via repositórios do
  `@silvia/core` (`packages/core`). Trocar por API real = novo adapter.
- **UI:** Tailwind CSS v4 (tokens em `src/index.css`), lucide-react,
  react-router (HashRouter, compatível com o bundle Tauri).

## Rodar

```bash
pnpm install                              # na raiz do monorepo

# Frontend no navegador (rápido, sem Rust)
pnpm --filter silvia-hair-erp dev         # http://localhost:1420

# App desktop nativo (requer Rust: https://rustup.rs)
pnpm --filter silvia-hair-erp tauri dev
pnpm --filter silvia-hair-erp tauri build # gera instalador
```

## Checagens

```bash
pnpm --filter silvia-hair-erp typecheck
pnpm --filter silvia-hair-erp build       # tsc + vite build
```
