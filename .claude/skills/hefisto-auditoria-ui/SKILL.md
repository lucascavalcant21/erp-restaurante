---
name: hefisto-auditoria-ui
description: Auditoria e padrão visual das telas do Héfisto (paleta clara hf-*, mobile-first em 390 px e tablet 820 px, permissões de rota, navegação). Use ao criar ou revisar uma tela, mexer em cores/Tailwind/globals.css, navegação (TopNavigation, navigation-registry) ou validar uma tela no navegador.
---

# Auditoria de interface

Para testar e publicar, siga `hefisto-entrega`.

## Padrão visual

- **Design system branco e dourado (decisão do dono, 31/10/2026).** Use só os tokens `hf-*` (`app/globals.css` + `tailwind.config.js`):
  - fundo e cards brancos: `bg-hf-bg`, `bg-hf-surface`, `bg-hf-elevated` (#F7F7F8);
  - texto e borda: `text-hf-text`, `text-hf-muted`, `border-hf-border`;
  - dourado principal `bg-hf-accent`, com texto `text-hf-accent-fg` (escuro). `text-hf-accent` já sai no dourado escuro legível;
  - menu grafite `bg-hf-menu`;
  - estados: `hf-success` (verde, só positivo), `hf-warning`, `hf-danger`.
- `emerald-*` no código é a escala DOURADA (identidade). Para positivo use `hf-success`. Não use cor solta (hex), azul/índigo/violeta nem fundo escuro fora do menu.
- O menu (`app/lib/menu-principal.mjs`) é a fonte única: tela nova entra lá, não em painel paralelo.
- **Mobile-first:**
  - 390 px (iPhone) e 820 px (tablet) sem rolagem lateral;
  - ação principal com pelo menos 44–48 px de altura;
  - a primeira coisa da tela é a ação que o funcionário veio fazer.
- Linguagem do funcionário: "24 garrafas", não "7920 ml"; "Não conferido", não "OK" quando não se sabe.

## Toda tela nova

1. Entrada em `app/lib/permissions-catalog.mjs`. A trava `node app/lib/permissions-catalog.test.mjs` falha sem ela. A regra mais específica por prefixo de rota vence.
2. Link no `app/lib/navigation-registry.mjs` (`node scripts/test-navigation-registry.mjs`).
3. Valor sem dado: **DADOS INSUFICIENTES**, nunca zero inventado.

## Como validar

- Local: Playwright (`npx playwright`).
- Produção (`app.hefisto.com.br`): só leitura. Abra a tela, meça pelo DOM (`scrollWidth` ≤ largura, altura dos botões, cor de fundo computada). Com pouca memória, use iframes da mesma origem em 390 e 820 px.
- **Não confirme formulário em produção** para "testar": preencha e pare antes de salvar.
- Relate o que foi simulado. Largura de 390 px no Chrome não é teste em iPhone de verdade.

## Codemod de paleta

Troca de cor em lote: faça por arquivo, revise o diff e rode o build. Nunca troque cores semânticas (perigo/aviso) por engano.
