# Regressões

Registro de regressões encontradas e das travas criadas para não voltarem.

| Data | Regressão | Trava |
|---|---|---|
| set/2026 | `dashboard.overview.view` abria folha, DRE e a tela de usuários, porque `/dashboard` é prefixo de tudo | `app/lib/permissions-catalog.test.mjs`: nenhuma tela pode cair na entrada genérica |
| 07/10/2026 | Telas de eventos novas sem entrada no catálogo (a trava acusou na `main`) | Corrigido em `73b4643`; os casos estão no mesmo teste |
| 29/09/2026 | `globals.css` reescrito perdeu as variáveis do tailwind (cores do sistema sumiram) | Corrigido na `main` (`95ff0c4`). Sem teste visual automático ainda (HDEV-001: Playwright) |
| 07/10/2026 | Editor antigo de fichas gravava g/ml como kg (18 g virava 0,018 g) | Corrigido na `main` (`da1c350`, `c3d45cb`) |
