# Como usar este pacote no Claude Code

Este pacote é o **design aprovado** do cardápio digital (tablet, QR da mesa,
delivery/retirada, KDS e painel) + a **especificação**.

## O que tem aqui
- `cardapio-digital-spec.md`: regras de negócio, telas, modelo de dados (SQL)
  e decisões. **É a fonte da verdade** para comportamento.
- `telas/*.dc.html`: cada tela do protótipo. O HTML/CSS dentro é o visual
  exato (cores, tamanhos, sombras, animações). A parte `class Component`
  no fim de cada arquivo tem a lógica de exemplo (dados fictícios).
- `telas/canvas.json`: lista de telas e como se ligam.
- `assets/`: imagens usadas (foto do Tacacá é só para protótipo).

## Prompt sugerido para o Claude Code
> Leia `cardapio-digital-spec.md` inteiro e os arquivos em `telas/`.
> Implemente a tela `<NomeDaTela>` no nosso projeto (stack: <sua stack>),
> reproduzindo exatamente o visual do arquivo `.dc.html` correspondente
> (mesmas cores, espaçamentos, raios, sombras, fontes Outfit/Inter e
> animações). Antes, crie os tokens de design da seção 9L (cores, sombras,
> botões, banner animado) como variáveis/tema reutilizáveis.
> Dados reais vêm do banco (seções de SQL do spec) e da ficha técnica do F2;
> ignore os dados fictícios do protótipo.
> Ao final, rode o app, tire um print da tela e compare com o protótipo;
> ajuste até ficar igual.

## Dicas
- Faça **uma tela por vez**, começando pelos tokens (9L) e componentes
  (botão, card, chip, selo, banner).
- Ordem sugerida: seção 10 do spec.
- Sintaxe do protótipo: `{{valor}}` = dado; `<sc-for>` = lista;
  `<sc-if>` = mostrar se verdadeiro. Traduzir para o equivalente da stack
  (ex.: React `map` e `&&`).
