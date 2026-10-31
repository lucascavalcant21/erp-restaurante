---
id: HDEV-010
titulo: Design system branco e dourado: componentes padrão (botão, card, campo, tabela, simulador) e passagem tela a tela
status: IN_PROGRESS
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-31
---

# HDEV-010 — Design system branco e dourado: componentes padrão (botão, card, campo, tabela, simulador) e passagem tela a tela

## Objetivo (pedido do dono, 31/10/2026: "quero meu app todo assim")

Padrão visual oficial do Héfisto inteiro:
- fundo branco, cards com profundidade (borda #E5E7EB + sombra), blocos internos #F7F7F8, texto #252525;
- menu grafite #202124 e dourado #C5A15A como cor principal (decisão do dono na mesma data: menu escuro e dourado como principal);
- simuladores que recalculam na hora, sem botão "calcular";
- só os indicadores importantes nos cards, o resto em seções que abrem;
- operações rápidas, nada de cinco telas para o que cabe em uma.

## Feito (etapa 1 — base, sem mudar funcionamento)

- Tokens hf-* e variáveis antigas (--accent) no novo padrão (globals.css).
  - `text-hf-accent` usa o dourado escuro #7A5C1E (contraste 5,9:1).
  - Botão dourado com texto escuro, inclusive nos antigos "bg-hf-accent text-white".
- A escala `emerald` (verde de identidade usado em ~1.000 lugares) virou a escala dourada no tailwind.config.js.
  - Verde de estado positivo fica em hf-success / green-*.
  - Painel inicial: positivos voltaram para hf-success.
- Hubs dos módulos e gráfico do painel em dourado; Green Dot em grafite e dourado.
- Menu como fonte única (app/lib/menu-principal.mjs). O "voltar" das telas e os antigos painéis /dashboard/modulo/* levam às páginas do menu (pedido: "é uma tela que não está no meu menu").
- TESTADO EM MOCK: painel, estoque, eventos, RH, cozinha e Green Dot em 1366 e 390 px, sem rolagem lateral.

## Próximas etapas

- [ ] Componentes padrão em app/components/ui: Botão, Card, Campo, Tabela, Seletor, Simulador (resultado ao vivo), Indicador, Janela.
- [ ] Passar tela a tela, por módulo, trocando cor solta (hex verde, teal) e verde de identidade que sobrou.
  - Revisar estados "pago/entrada/confirmado" que eram emerald e devem voltar a hf-success.
- [ ] Simuladores: Resultado do mês, CMV, CMO, preço do delivery, montagem do evento.
