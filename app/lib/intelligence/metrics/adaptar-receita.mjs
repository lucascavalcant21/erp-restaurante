// ADAPTAR A RECEITA AO QUE TEM (pedido do dono, 08/11/2026): "a receita pede
// 2 L de leite de coco e eu só tenho 1 L" → o sistema refaz a receita para
// a metade, com todas as quantidades e o rendimento novos.
//
// Conta determinística, sem modelo de linguagem: o ingrediente que mais falta
// limita a receita inteira (fator = menor "tenho ÷ preciso"). Ingrediente que
// não tem nada não entra no fator: a receita sai SEM ele e a tela avisa (a
// sugestão de substituto, se pedida, vem marcada como sugestão).
// Funções puras: usadas na tela (FolhaFicha) e testadas em __tests__/adaptar-receita.test.mjs.

const arred = (n, casas = 3) => Math.round(n * 10 ** casas) / 10 ** casas;
const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Unidade em que a pessoa digita o que tem: g/ml para quantidades pequenas em kg/L. */
export function unidadeDeTela(unidade, qtd) {
  const u = String(unidade || "un").trim().toLowerCase();
  if (u === "kg" && Number(qtd) < 1) return { rotulo: "g", mult: 1000 };
  if (u === "l" && Number(qtd) < 1) return { rotulo: "ml", mult: 1000 };
  return { rotulo: u === "l" ? "L" : String(unidade || "un").trim(), mult: 1 };
}

/** Quantidade legível na unidade de tela ("0,5 kg" → "500 g"). */
export function qtdLegivel(qtd, unidade) {
  const n = Number(qtd);
  if (!Number.isFinite(n)) return "—";
  const t = unidadeDeTela(unidade, n);
  return `${fmt(arred(n * t.mult, t.mult > 1 ? 1 : 3))} ${t.rotulo}`;
}

/**
 * @param {{ nome: string, qtd: number|null, unidade: string }[]} ingredientes  (qtd na unidade do cadastro)
 * @param {Record<number, { estado: "tem"|"pouco"|"nao", qtd?: number }>} disponivel  qtd do "pouco" na unidade do cadastro
 * @param {{ multiplicar?: number, rendimentoQtd?: number|null, rendimentoUnidade?: string|null }} [op]
 * @returns {{ fator: number, limitante: string|null, faltando: string[], semConta: string[], ingredientes: object[], rendimento: string|null, possivel: boolean }}
 */
export function adaptarReceita(ingredientes = [], disponivel = {}, { multiplicar = 1, rendimentoQtd = null, rendimentoUnidade = null } = {}) {
  let fator = Number(multiplicar) > 0 ? Number(multiplicar) : 1;
  let limitante = null;
  const faltando = [];
  const semConta = [];
  ingredientes.forEach((ing, i) => {
    const d = disponivel[i];
    if (!d || d.estado === "tem") return;
    if (d.estado === "nao") { faltando.push(ing.nome); return; }
    const precisa = Number(ing.qtd);
    const tem = Number(d.qtd);
    if (!(precisa > 0) || !Number.isFinite(tem) || tem < 0) { semConta.push(ing.nome); return; }
    const f = tem / precisa;
    if (f < fator) { fator = f; limitante = ing.nome; }
  });
  fator = arred(fator, 4);
  const lista = ingredientes.map((ing, i) => {
    const sem = disponivel[i]?.estado === "nao";
    const q = Number(ing.qtd) > 0 ? arred(Number(ing.qtd) * fator, 4) : null;
    return { nome: ing.nome, falta: sem, qtd: sem ? 0 : q, quantidade: sem ? "não tem" : q == null ? ing.quantidade || "—" : qtdLegivel(q, ing.unidade) };
  });
  const rendimento = Number(rendimentoQtd) > 0 ? `${fmt(arred(Number(rendimentoQtd) * fator, 2))} ${rendimentoUnidade || "porções"}` : null;
  return { fator, limitante, faltando, semConta, ingredientes: lista, rendimento, possivel: fator > 0 };
}

/** "50% da receita", "2× a receita", "a receita inteira". */
export function rotuloDoFator(fator) {
  if (Math.abs(fator - 1) < 0.001) return "a receita inteira";
  if (fator > 1) return `${fmt(arred(fator, 2))}× a receita`;
  return `${fmt(Math.round(fator * 100))}% da receita`;
}
