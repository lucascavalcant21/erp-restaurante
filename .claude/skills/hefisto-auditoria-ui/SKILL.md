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
  - **botão de ação e aba/filtro selecionado: preto (grafite) com letra branca** — `bg-hf-menu text-white` (pedido do dono, 07/11/2026). Uma regra no `globals.css` já pinta de preto qualquer botão com fundo dourado (`bg-hf-accent`, `bg-accent`, `bg-emerald-500…800`); para manter um dourado de propósito, classe `hf-manter-dourado`;
  - dourado `hf-accent` fica para a marca: anel de foco, selos, contadores, bordas de destaque. `text-hf-accent` já sai no dourado escuro legível;
  - menu grafite `bg-hf-menu`;
  - estados: `hf-success` (verde, só positivo), `hf-warning`, `hf-danger`.
- **Cores de módulo (07/11/2026, visual do Nina):** o quadradinho do ícone de uma tela ou área usa `<IconeModulo item={…} />` (`app/components/ui/IconeModulo.js`), com a cor de `app/lib/cores-modulo.mjs` (tokens `hf-tile-*`). Junto com as cores do WhatsApp na tela do Assistente Héfisto, é a única exceção ao "sem azul/violeta": nunca em botão, texto, fundo ou estado. Card novo no menu com ícone novo: dê a cor em `cores-modulo.mjs` (a trava `cores-modulo.test.mjs` cobra).
- **Cabeçalho de tela:** use `<CabecalhoTela titulo subtitulo>` (`app/components/ui/CabecalhoTela.js`) ou `PageHeader`, que já usa ele. Ele monta a trilha "Unidade / Área / Tela", o ícone colorido e a data a partir do menu (`telaDaRota`); ações vão como filhos. `embutido` quando a tela já tem coluna com margem; `voltarPara` para um endereço fixo. Não crie cabeçalho próprio com `h1` solto. Abas e áreas: faixa de pílulas (`rounded-full`, ativa `bg-hf-menu text-white`), rolando de lado no celular.
- Fonte do app: Inter (`--font-app`). Títulos `font-semibold tracking-tight`; rótulo de seção `text-[13px] font-medium text-hf-muted`.
- `emerald-*` no código é a escala DOURADA (identidade). Para positivo use `hf-success`. Não use cor solta (hex), azul/índigo/violeta nem fundo escuro fora do menu.
- O menu (`app/lib/menu-principal.mjs`) é a fonte única: tela nova entra lá, não em painel paralelo.
- **Mobile-first:**
  - 390 px (iPhone) e 820 px (tablet) sem rolagem lateral;
  - ação principal com pelo menos 44–48 px de altura;
  - a primeira coisa da tela é a ação que o funcionário veio fazer.
- Linguagem do funcionário: "24 garrafas", não "7920 ml"; "Não conferido", não "OK" quando não se sabe.

## Toda tela nova

- Nomes de módulos, abas e títulos são profissionais, como em um ERP: "Diagnóstico de lucro", nunca "Cadê o lucro?"; "Produção do dia", nunca "Do dia". Sem abreviação nem linguagem informal. Na dúvida, pesquise o termo usado no mercado.

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
