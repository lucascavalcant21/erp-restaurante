// O QUE FALTA PARA OS NÚMEROS ESTAREM CERTOS
//
// O custo de um prato depende de quatro coisas ligadas entre si, e elas moram
// em três telas diferentes: o insumo precisa de preço (Ingredientes), a ficha
// precisa de ingredientes e rendimento (Fichas Técnicas), e o produto do
// cardápio precisa de preço E de estar LIGADO a uma ficha (Produtos).
//
// O quarto é o que ninguém adivinha. Um produto sem `ficha_id` nem
// `composicao` não entra na conta do CMV: não dá erro, não aparece em lugar
// nenhum, só some da média. Aí o painel mostra "CMV médio 34,2%" sem dizer que
// é a média de 34 pratos num cardápio de 101 — e o dono decide preço em cima
// de um número que cobre um terço da casa.
//
// Este módulo não calcula custo. Ele responde uma pergunta só: o que está
// faltando, e em qual tela se resolve.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const temPreco = (produto) => num(produto?.preco_venda) > 0;

// As duas formas de ligar produto e ficha que o sistema aceita: `composicao`
// (um produto feito de várias fichas) ou `ficha_id` (o caminho antigo, uma
// ficha só). Qualquer uma serve.
export function fichasDoProduto(produto) {
  const comp = Array.isArray(produto?.composicao) ? produto.composicao : [];
  if (comp.length) return comp.map((c) => c?.ficha_id).filter(Boolean);
  return produto?.ficha_id ? [produto.ficha_id] : [];
}

// Custo do insumo como o cálculo de verdade o enxerga. Espelha a ordem de
// `custoUnitarioEfetivoInsumo` em ficha-calculos.mjs de propósito: se aqui
// dissesse que o insumo tem preço e lá o custo saísse zero, o aviso mentiria.
const insumoTemPreco = (insumo) =>
  num(insumo?.preco_normalizado) > 0
  || num(insumo?.custo_unitario) > 0
  || num(insumo?.custo_compra) > 0;

// Produto pronto é vendido como vem do fornecedor — o próprio formulário diz
// que não exige ingredientes. Cobrar ingrediente dele seria alarme falso.
const exigeIngredientes = (ficha) => !ficha?.produto_pronto;

export function lacunasDoCusto({ fichas = [], produtos = [] } = {}) {
  const fichasPorId = new Map((fichas || []).map((f) => [f.id, f]));

  const comPreco = (produtos || []).filter(temPreco);
  const produtosSemFicha = [];
  const produtosComFichaQuebrada = [];

  for (const p of comPreco) {
    const ids = fichasDoProduto(p);
    if (!ids.length) {
      produtosSemFicha.push({ id: p.id, nome: p.nome_produto || p.nome || "Produto", preco: num(p.preco_venda) });
      continue;
    }
    // Ligado a uma ficha que não existe mais: o produto parece configurado e
    // custa zero. É pior que não ligado, porque não parece faltar nada.
    if (ids.some((id) => !fichasPorId.has(id))) {
      produtosComFichaQuebrada.push({ id: p.id, nome: p.nome_produto || p.nome || "Produto", preco: num(p.preco_venda) });
    }
  }

  // Produto ligado a ficha mas sem preço: dá para custear e não dá para saber
  // se o preço cobre o custo.
  const produtosSemPreco = (produtos || [])
    .filter((p) => !temPreco(p) && fichasDoProduto(p).length)
    .map((p) => ({ id: p.id, nome: p.nome_produto || p.nome || "Produto" }));

  const fichasSemIngrediente = [];
  const fichasSemRendimento = [];
  const semPrecoPorInsumo = new Map();

  for (const f of fichas || []) {
    const itens = Array.isArray(f.fichas_ingredientes) ? f.fichas_ingredientes : [];
    if (exigeIngredientes(f) && itens.length === 0) {
      fichasSemIngrediente.push({ id: f.id, nome: f.nome_receita || "Ficha", departamento: f.departamento || "" });
    }
    if (num(f.rendimento_porcoes) <= 0) {
      fichasSemRendimento.push({ id: f.id, nome: f.nome_receita || "Ficha", departamento: f.departamento || "" });
    }
    for (const item of itens) {
      const insumo = item?.insumos;
      if (!insumo || insumoTemPreco(insumo)) continue;
      const atual = semPrecoPorInsumo.get(insumo.id) || { id: insumo.id, nome: insumo.nome || "Insumo", fichas: 0 };
      atual.fichas += 1;
      semPrecoPorInsumo.set(insumo.id, atual);
    }
  }

  // O insumo que aparece em mais fichas primeiro: arrumar o preço dele conserta
  // mais pratos de uma vez.
  const ingredientesSemPreco = [...semPrecoPorInsumo.values()].sort((a, b) => b.fichas - a.fichas);

  const totalComPreco = comPreco.length;
  const cobertos = totalComPreco - produtosSemFicha.length - produtosComFichaQuebrada.length;

  return {
    produtosSemFicha,
    produtosComFichaQuebrada,
    produtosSemPreco,
    fichasSemIngrediente,
    fichasSemRendimento,
    ingredientesSemPreco,
    // Quanto do cardápio com preço realmente entra na conta do CMV. É este
    // número que diz se a média do painel vale alguma coisa.
    cobertura: {
      cobertos: Math.max(0, cobertos),
      total: totalComPreco,
      pct: totalComPreco > 0 ? (Math.max(0, cobertos) / totalComPreco) * 100 : 0,
    },
    pendencias:
      produtosSemFicha.length + produtosComFichaQuebrada.length + produtosSemPreco.length
      + fichasSemIngrediente.length + fichasSemRendimento.length + ingredientesSemPreco.length,
  };
}
