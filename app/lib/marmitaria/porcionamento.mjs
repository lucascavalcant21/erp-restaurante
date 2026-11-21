// FICHA DE PORCIONAMENTO (pedido do dono, 21/11/2026). O produto chega em peça
// ou pacote (5 kg de peito de frango), é limpo (perde aparas e gordura) e
// cortado em porções iguais (150 g) que vão para o estoque.
//   peso limpo = bruto − perda na limpeza
//   porções    = peso limpo ÷ peso da porção (só porções inteiras)
//   custo da porção = custo do bruto ÷ porções (a sobra e a perda ficam no custo)
// Grava como subproduto (pré-preparo) que rende N unidades de X g: a produção,
// o estoque, o custo da marmita e a etiqueta usam o que já existe.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

export const CATEGORIA_PORCIONAMENTO = "Porcionamento";
export const ehPorcionamento = (f) => String(f?.categoria || "") === CATEGORIA_PORCIONAMENTO;

const PARA_G = { g: 1, kg: 1000, ml: 1, l: 1000 };

/**
 * @param brutoQtd, brutoUn  quanto entra (5 kg)
 * @param perda              { modo: "g" | "pct", valor } perda na limpeza
 * @param porcaoG            peso de cada porção limpa (g ou ml)
 * @param custoPorUnidadeCadastro  R$ por unidade do cadastro do produto (R$/kg)
 * @param unidadeCadastro    unidade do cadastro (kg, g, l, ml)
 */
export function calcularPorcionamento({ brutoQtd, brutoUn = "kg", perda = { modo: "pct", valor: 0 }, porcaoG, custoPorUnidadeCadastro = null, unidadeCadastro = "kg" } = {}) {
  const fator = PARA_G[String(brutoUn).toLowerCase()];
  const brutoG = Number(brutoQtd) > 0 && fator ? Number(brutoQtd) * fator : null;
  const motivos = [];
  if (!brutoG) motivos.push("Informe quanto entra do produto (em g, kg, ml ou L).");
  const p = Number(porcaoG);
  if (!(p > 0)) motivos.push("Informe o peso de cada porção.");
  const pv = Number(perda?.valor) || 0;
  const perdaG = brutoG ? (perda?.modo === "g" ? pv : (brutoG * pv) / 100) : null;
  if (brutoG && perdaG >= brutoG) motivos.push("A perda na limpeza não pode ser igual ou maior que o peso bruto.");
  if (motivos.length) return { ok: false, motivos };

  const limpoG = brutoG - perdaG;
  const porcoes = Math.floor(limpoG / p + 1e-9);
  if (!(porcoes > 0)) return { ok: false, motivos: ["O peso limpo não dá nem uma porção desse tamanho."] };
  const sobraG = r1(limpoG - porcoes * p);
  const fatorCad = PARA_G[String(unidadeCadastro).toLowerCase()];
  const custoTotal = custoPorUnidadeCadastro > 0 && fatorCad ? r2((brutoG / fatorCad) * custoPorUnidadeCadastro) : null;
  return {
    ok: true, motivos: [],
    brutoG: r1(brutoG), perdaG: r1(perdaG), perdaPct: r1((perdaG / brutoG) * 100),
    limpoG: r1(limpoG), aproveitamentoPct: r1((limpoG / brutoG) * 100),
    porcaoG: p, porcoes, sobraG,
    custoTotal,
    custoPorcao: custoTotal !== null ? r2(custoTotal / porcoes) : null,
    custoKgLimpo: custoTotal !== null ? r2(custoTotal / (limpoG / 1000)) : null,
    // quantidade gravada na ficha, na unidade do cadastro do produto
    quantidadeCadastro: fatorCad ? Math.round((brutoG / fatorCad) * 1e6) / 1e6 : null,
  };
}

/** Passo a passo impresso junto da ficha. */
export function passosDoPorcionamento({ nomeProduto, calc, embalagem = "", armazenamento = "", validadeDias = null }) {
  if (!calc?.ok) return "";
  const kg = (g) => (g >= 1000 ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg` : `${g.toLocaleString("pt-BR")} g`);
  const passos = [
    `Pese ${kg(calc.brutoG)} de ${nomeProduto || "produto"}.`,
    calc.perdaG > 0 ? `Limpe: tire aparas, gordura e partes sem uso (perda esperada de ${kg(calc.perdaG)}, ${calc.perdaPct.toLocaleString("pt-BR")}%). Deve sobrar ${kg(calc.limpoG)} limpo.` : `Confira o peso limpo: ${kg(calc.limpoG)}.`,
    `Corte em ${calc.porcoes} porções de ${calc.porcaoG.toLocaleString("pt-BR")} g, pesando cada uma na balança.`,
    calc.sobraG > 0 ? `Sobra de ${kg(calc.sobraG)}: use em outra preparação ou registre como perda.` : null,
    `Embale${embalagem ? ` em ${embalagem}` : " cada porção"} e etiquete com nome, data e validade${validadeDias ? ` (${validadeDias} dia${validadeDias > 1 ? "s" : ""})` : ""}.`,
    armazenamento ? `Guarde: ${armazenamento}.` : null,
  ].filter(Boolean);
  return passos.map((t, i) => `${i + 1}. ${t}`).join("\n");
}
