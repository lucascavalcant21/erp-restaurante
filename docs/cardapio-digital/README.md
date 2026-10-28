# Cardápio digital — material do design

- `cardapio-digital-spec.md`: especificação (fonte da verdade do comportamento).
- `telas/*.dc.html`: protótipo aprovado de cada tela (visual exato). O bloco
  `class Component` no fim é só lógica de exemplo com dados fictícios.
- `telas/canvas.json`: lista das telas e como uma leva à outra.

As imagens do protótipo (`assets/`: foto do Tacacá, foto do menu degustação,
QR do Wi-Fi) não entram no Git porque o repositório é público. Elas ficam na
pasta `cardapio-digital-handoff/` do dono.

## Print de referência das telas

Os `.dc.html` precisam de um runtime (`support.js`) que não veio no pacote.
`scripts/cardapio-digital/renderizar-prototipo.mjs` aplica o `renderVals()` de
cada tela no template (`{{valor}}`, `<sc-for>`, `<sc-if>`) e gera um HTML
estático; `scripts/cardapio-digital/print-prototipo.mjs` tira o print no
tamanho da prancheta (canvas.json):

```bash
node scripts/cardapio-digital/print-prototipo.mjs --assets "<pasta>/assets" --saida "<pasta de saída>" Main TabletDetalhe
```
