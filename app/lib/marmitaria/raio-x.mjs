// RAIO-X DO PREÇO (pedido do dono, 16/11/2026): "essa marmita de R$ 30, a
// gente tá tirando isso: o funcionário leva tanto, o pró-labore isso, o
// aluguel isso, a energia isso, de óleo isso. Tá sobrando 10%, R$ 3. Qual é o
// componente mais caro? É pra gente reajustar."
//
// Do preço que o cliente paga num app, quanto vai para cada coisa:
// cada ingrediente e pré-preparo, cada embalagem, o app, o imposto, a equipe,
// cada conta fixa, cada custo variável e, no fim, o lucro. Conta
// determinística (as mesmas funções da Precificação: custoDaMarmita,
// resultadoPorCanal, custosEmbutidos). Ingrediente, embalagem e taxa: REAL do
// cadastro; equipe e contas fixas por marmita: ESTIMATIVA (dividido pelas
// marmitas do mês). Faltou um pedaço: diz qual e não inventa.
// Módulo puro, testado em raio-x.test.mjs.

import { normalizarCanal, r2, resultadoPorCanal } from "./nucleo.mjs";

const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctTxt = (v) => `${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Preço da marmita no app: o do app; sem ele, o preço geral. */
export function precoNoCanal(marmita, canal) {
  const p = pos(marmita?.precos?.[canal?.id]);
  return p || pos(marmita?.preco_venda) || 0;
}

/** O app da conversa: o citado na frase; senão o primeiro ativo em que a marmita tem preço. */
export function canalDaPergunta(canais = [], texto = "", marmita = null) {
  const ativos = canais.map(normalizarCanal).filter((c) => c.ativo !== false);
  const f = String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const citado = ativos.find((c) => {
    const nome = String(c.nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(" · ")[0].trim();
    return (nome.length >= 3 && f.includes(nome)) || f.includes(c.id);
  });
  if (citado) return citado;
  return ativos.find((c) => pos(marmita?.precos?.[c.id]) > 0) || ativos[0] || null;
}

/**
 * @param {{ marmita, custo, canal, tributosPct, embutidos, pessoasEquipe }} d
 *   custo: custoDaMarmita(); embutidos: custosEmbutidos()
 */
export function raioXDaMarmita({ marmita, custo, canal, tributosPct = null, embutidos = null, pessoasEquipe = null } = {}) {
  const nome = marmita?.nome_receita || marmita?.nome || "Marmita";
  const c = normalizarCanal(canal || {});
  const preco = precoNoCanal(marmita, c);
  const faltando = [];
  if (!(preco > 0)) return { valido: false, nome, motivo: `${nome} está sem preço${c.nome ? ` no ${c.nome}` : ""}.`, faltando: ["preço de venda"] };
  if (!custo?.linhas?.length) return { valido: false, nome, motivo: `${nome} está sem ficha técnica (o que vai e quanto).`, faltando: ["ficha técnica"] };

  const r = resultadoPorCanal({ preco, custoTecnico: custo.total, canal: c, tributosPct });
  const pct = (v) => r2((v / preco) * 100);
  const linhas = [];
  const add = (grupo, rotulo, valor, natureza = "REAL", extra = {}) => { if (valor > 0) linhas.push({ grupo, rotulo, valor: r2(valor), pct: pct(valor), natureza, ...extra }); };

  for (const l of custo.linhas) add("ingrediente", l.nome || "Ingrediente", pos(l.custo), "REAL", { semCusto: l.custo == null });
  for (const e of custo.linhasEmbalagens || []) add("embalagem", e.nome || "Embalagem", pos(e.custo));
  if (custo.pendencias?.length) faltando.push(...custo.pendencias);

  add("app", `${c.nome || "App"} (comissão e pagamento)`, (r.comissao || 0) + (r.taxaPagamento || 0) + (r.taxaFixa || 0));
  add("app", `${c.nome || "App"} (entrega)`, r.entrega || 0);
  add("app", "Promoção", r.promocao || 0);
  if (r.avisos?.some((a) => /Taxas do canal/.test(a))) faltando.push(`taxas do ${c.nome || "app"}`);
  add("imposto", "Imposto", r.tributos || 0);
  const mei = tributosPct === 0;
  if (tributosPct === null || tributosPct === undefined || tributosPct === "") faltando.push("imposto");

  const e = embutidos || {};
  if (e.cmoPorMarmita != null) add("equipe", pessoasEquipe ? `Equipe (${pessoasEquipe} ${pessoasEquipe === 1 ? "pessoa" : "pessoas"})` : "Equipe", e.cmoPorMarmita, "ESTIMATIVA");
  const mm = pos(e.marmitasMes);
  if (mm && e.fixosLinhas?.length) for (const f of e.fixosLinhas) add("fixo", f.nome, pos(f.valor) / mm, "ESTIMATIVA");
  else if (e.fixosPorMarmita != null) add("fixo", "Custos fixos", e.fixosPorMarmita, "ESTIMATIVA");
  for (const v of e.variaveisLinhas || []) add("variavel", v.nome, pos(v.valor));
  for (const x of e.faltando || []) faltando.push(x);

  const gasto = linhas.reduce((t, l) => t + l.valor, 0);
  const lucro = r2(preco - gasto);
  const componentes = linhas.filter((l) => l.grupo === "ingrediente").sort((a, b) => b.valor - a.valor);
  const somaGrupo = (g) => r2(linhas.filter((l) => l.grupo === g).reduce((t, l) => t + l.valor, 0));
  return {
    valido: true, nome, canal: c.nome || null, preco: r2(preco), linhas,
    grupos: { ingredientes: somaGrupo("ingrediente"), embalagens: somaGrupo("embalagem"), app: somaGrupo("app"), imposto: somaGrupo("imposto"), equipe: somaGrupo("equipe"), fixos: somaGrupo("fixo"), variaveis: somaGrupo("variavel") },
    lucro, lucroPct: pct(lucro), mei,
    maisCaro: componentes[0] || null, componentes,
    faltando: [...new Set(faltando)],
    // Com equipe ou fixos por marmita, o lucro é ESTIMATIVA; sem eles, "lucro antes de…".
    natureza: linhas.some((l) => l.natureza === "ESTIMATIVA") ? "ESTIMATIVA" : "REAL",
    completo: faltando.length === 0,
  };
}

/** A frase do raio-x, do jeito que o dono falou. */
export function textoDoRaioX(rx) {
  if (!rx?.valido) return `DADOS INSUFICIENTES: ${rx?.motivo || "não consegui montar o raio-x."}`;
  const g = rx.grupos;
  const partes = [];
  if (g.ingredientes) partes.push(`ingredientes ${brl(g.ingredientes)} (${pctTxt((g.ingredientes / rx.preco) * 100)})`);
  if (g.embalagens) partes.push(`embalagem ${brl(g.embalagens)}`);
  if (g.app) partes.push(`${rx.canal || "o app"} fica com ${brl(g.app)}`);
  if (g.imposto) partes.push(`imposto ${brl(g.imposto)}`);
  const eq = rx.linhas.find((l) => l.grupo === "equipe");
  if (eq) partes.push(`${eq.rotulo.toLowerCase()} leva ${brl(eq.valor)} (${pctTxt(eq.pct)})`);
  for (const l of rx.linhas.filter((x) => x.grupo === "fixo")) partes.push(`${l.rotulo.toLowerCase()} ${brl(l.valor)}`);
  for (const l of rx.linhas.filter((x) => x.grupo === "variavel")) partes.push(`${l.rotulo.toLowerCase()} ${brl(l.valor)}`);
  const sobra = rx.lucro >= 0 ? `Sobram ${brl(rx.lucro)} de lucro (${pctTxt(rx.lucroPct)}).` : `Está dando PREJUÍZO de ${brl(-rx.lucro)} por marmita.`;
  const caro = rx.maisCaro ? ` O componente mais caro é ${rx.maisCaro.rotulo}: ${brl(rx.maisCaro.valor)} (${pctTxt(rx.maisCaro.pct)} do preço).` : "";
  const falta = rx.faltando.length ? ` Ainda falta: ${rx.faltando.join("; ")}${/equipe|custos fixos|marmitas por m/.test(rx.faltando.join(" ")) ? ", então o lucro está maior do que o real" : ""}.` : "";
  return `${rx.nome} a ${brl(rx.preco)}${rx.canal ? ` no ${rx.canal}` : ""}: ${partes.join(", ")}. ${sobra}${caro}${falta}`;
}

/** Linhas para a tela da conversa (bloco "lista"). */
export function itensDoRaioX(rx) {
  if (!rx?.valido) return [];
  return [
    ...rx.linhas.map((l) => ({ rotulo: l.rotulo, detalhe: `${pctTxt(l.pct)} do preço${l.natureza === "ESTIMATIVA" ? " · ESTIMATIVA" : ""}`, valor: brl(l.valor) })),
    { rotulo: rx.lucro >= 0 ? "Lucro" : "Prejuízo", detalhe: `${pctTxt(rx.lucroPct)} do preço`, valor: brl(rx.lucro) },
  ];
}

/** "Como são nossas marmitas?": uma linha por marmita, da que mais sobra para a que menos. */
export function resumoDasMarmitas(lista = []) {
  const validas = lista.filter((x) => x?.valido).sort((a, b) => b.lucroPct - a.lucroPct);
  const invalidas = lista.filter((x) => x && !x.valido);
  const itens = validas.map((rx) => ({ rotulo: rx.nome, detalhe: `${brl(rx.preco)}${rx.canal ? ` no ${rx.canal}` : ""} · mais caro: ${rx.maisCaro?.rotulo || "—"}`, valor: `${brl(rx.lucro)} (${pctTxt(rx.lucroPct)})` }));
  const neg = validas.filter((x) => x.lucro < 0);
  let texto;
  if (!validas.length) texto = `DADOS INSUFICIENTES: nenhuma marmita com ficha técnica e preço${invalidas.length ? ` (${invalidas.map((x) => x.motivo).slice(0, 3).join(" ")})` : ""}.`;
  else {
    const melhor = validas[0], pior = validas[validas.length - 1];
    texto = `${validas.length} ${validas.length === 1 ? "marmita" : "marmitas"} com preço e ficha. A que mais deixa lucro é ${melhor.nome}: ${brl(melhor.lucro)} (${pctTxt(melhor.lucroPct)}).`;
    if (validas.length > 1) texto += ` A que menos deixa é ${pior.nome}: ${brl(pior.lucro)} (${pctTxt(pior.lucroPct)}).`;
    if (neg.length) texto += ` ${neg.length === 1 ? "Uma está" : `${neg.length} estão`} dando prejuízo: ${neg.map((x) => x.nome).join(", ")}.`;
    if (invalidas.length) texto += ` ${invalidas.length} sem preço ou ficha ficaram de fora.`;
    const falta = [...new Set(validas.flatMap((x) => x.faltando))];
    if (falta.length) texto += ` Falta cadastrar: ${falta.slice(0, 4).join("; ")}, então o lucro pode estar maior do que o real.`;
  }
  return { texto, itens, natureza: validas.some((x) => x.natureza === "ESTIMATIVA") ? "ESTIMATIVA" : "REAL" };
}
