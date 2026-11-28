// OSCILAÇÃO DO CUSTO DO PRATO (pedido do dono, 28/11/2026): "na ficha ela vai
// mostrar a oscilação que ela tem também: o prato no início do ano custava
// R$ 10, agora está custando 18; logo a precificação precisa ser ajustada".
//
// Não há tabela de custo de prato por data, e não precisa: o custo do prato
// numa data é a MESMA conta de hoje (resumoFinanceiroDaFicha) com o preço que
// cada ingrediente tinha naquela data, tirado de insumos_precos_historico.
// A receita (quantidades, porções, embalagem) é a de hoje: o gráfico mostra o
// efeito dos PREÇOS, não de mudanças na receita.
//
// Correção de cadastro não é variação de preço: um salto de mais de 3 vezes
// entre dois registros é tratado como troca de unidade (g ↔ kg) e os valores
// anteriores a ele não são usados. Antes do primeiro preço conhecido de um
// ingrediente, vale o primeiro preço conhecido (HIPÓTESE), e o ponto diz que
// parte do custo veio de preço conhecido (cobertura).

import { precoNormalizadoDoInsumo } from "./ingredientes-utils.mjs";
import { resumoFinanceiroDaFicha } from "./ficha-financeiro.mjs";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// Preço de comida raramente triplica de verdade; no histórico real (jul–out/2026)
// os saltos maiores são correções da implantação: preço provisório de R$ 1.000,
// g ↔ kg, valor digitado errado e desfeito depois.
export const SALTO_DE_CORRECAO = 3;
const salto = (a, b) => a > 0 && b > 0 && (a / b > SALTO_DE_CORRECAO || b / a > SALTO_DE_CORRECAO);

/* Eventos de preço de cada ingrediente, já sem o que vem antes de uma
 * correção de cadastro. Map insumoId → [{ t, anterior, novo }] em ordem. */
export function eventosDePreco(historico = []) {
  const por = new Map();
  for (const h of historico || []) {
    if (!h?.insumo_id) continue;
    const t = new Date(h.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    const lista = por.get(h.insumo_id) || [];
    lista.push({ t, anterior: num(h.preco_normalizado_anterior), novo: num(h.preco_normalizado_novo) });
    por.set(h.insumo_id, lista);
  }
  for (const [id, lista] of por) {
    lista.sort((a, b) => a.t - b.t);
    // corta tudo antes da última correção de cadastro
    let corte = 0;
    let ultimo = 0;
    lista.forEach((e, i) => {
      if (salto(e.anterior, e.novo) || salto(ultimo, e.anterior || e.novo)) corte = i;
      if (e.novo > 0) ultimo = e.novo;
    });
    const validos = lista.slice(corte).map((e, i) => (i === 0 && salto(e.anterior, e.novo) ? { ...e, anterior: 0 } : e));
    por.set(id, validos.filter((e) => e.novo > 0 || e.anterior > 0));
  }
  return por;
}

/* Preço normalizado de um ingrediente na data t. { valor, conhecido }. */
export function precoNaData(eventos = [], atual, t) {
  const hoje = num(atual);
  if (!eventos.length) return { valor: hoje, conhecido: hoje > 0 };
  let valor = 0;
  for (const e of eventos) {
    if (e.t <= t && e.novo > 0) valor = e.novo;
  }
  if (valor > 0) {
    // depois do último evento, o preço é o de hoje (o cadastro manda)
    const ultimo = eventos[eventos.length - 1];
    return { valor: t >= ultimo.t && hoje > 0 ? hoje : valor, conhecido: true };
  }
  const primeiro = eventos[0];
  if (primeiro.anterior > 0) return { valor: primeiro.anterior, conhecido: true };
  const primeiroConhecido = eventos.find((e) => e.novo > 0)?.novo || hoje;
  return { valor: primeiroConhecido, conhecido: false };
}

/** Datas do gráfico: dia 1 de cada mês desde o primeiro evento, e hoje. */
export function datasDoGrafico(eventosUsados = [], hoje = new Date()) {
  const ts = eventosUsados.map((e) => e.t).filter(Number.isFinite);
  const fim = new Date(hoje);
  if (!ts.length) return [fim];
  const ini = new Date(Math.min(...ts));
  const datas = [];
  for (let d = new Date(ini.getFullYear(), ini.getMonth(), 1); d < fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    datas.push(d);
    if (datas.length > 36) break;
  }
  datas.push(fim);
  return datas;
}

function insumosDaFicha(ficha, fichas, guard = new Set()) {
  if (!ficha || guard.has(ficha.id)) return [];
  guard.add(ficha.id);
  const out = [];
  for (const fi of ficha.fichas_ingredientes || []) {
    if (fi.insumos?.id) out.push(fi.insumos.id);
    else if (fi.subficha_id) out.push(...insumosDaFicha((fichas || []).find((x) => x.id === fi.subficha_id), fichas, guard));
  }
  return out;
}

/* Custo por porção (CMV) do prato em cada data, com a mesma conta de hoje.
 * Devolve { pontos: [{ data, cmv, cobertura }], variacaoPct, temHistorico }. */
export function custoDoPratoNoTempo({ ficha, fichas = [], produtos = [], params = {}, historico = [], hoje = new Date() }) {
  const eventos = eventosDePreco(historico);
  const ids = [...new Set(insumosDaFicha(ficha, fichas))];
  const usados = ids.flatMap((id) => eventos.get(id) || []);
  const datas = datasDoGrafico(usados, hoje);

  // Só a ficha e as bases que ela usa entram na conta de cada data.
  const relevantes = new Set();
  const marcar = (f) => {
    if (!f || relevantes.has(f.id)) return;
    relevantes.add(f.id);
    for (const fi of f.fichas_ingredientes || []) if (fi.subficha_id) marcar((fichas || []).find((x) => x.id === fi.subficha_id));
  };
  marcar(ficha);
  const atualDe = new Map();
  for (const f of [ficha, ...(fichas || []).filter((x) => relevantes.has(x.id))]) {
    for (const fi of f.fichas_ingredientes || []) if (fi.insumos?.id) atualDe.set(fi.insumos.id, precoNormalizadoDoInsumo(fi.insumos));
  }

  const pontos = datas.map((d) => {
    const t = d.getTime();
    const precos = new Map(ids.map((id) => [id, precoNaData(eventos.get(id) || [], atualDe.get(id), t)]));
    const trocar = (f) => ({
      ...f,
      fichas_ingredientes: (f.fichas_ingredientes || []).map((fi) => {
        const p = fi.insumos ? precos.get(fi.insumos.id) : null;
        return p && p.valor > 0 ? { ...fi, insumos: { ...fi.insumos, preco_normalizado: p.valor } } : fi;
      }),
    });
    const fichasNaData = (fichas || []).filter((x) => relevantes.has(x.id)).map(trocar);
    const fichaNaData = fichasNaData.find((x) => x.id === ficha.id) || trocar(ficha);
    const r = resumoFinanceiroDaFicha(fichaNaData, { fichas: fichasNaData, produtos, params });
    const conhecidos = [...precos.values()].filter((p) => p.conhecido).length;
    return { data: d.toISOString(), cmv: Math.round(r.cmvValor * 100) / 100, cobertura: ids.length ? (conhecidos / ids.length) * 100 : 100 };
  });
  const primeiro = pontos[0]?.cmv || 0;
  const ultimo = pontos[pontos.length - 1]?.cmv || 0;
  return {
    pontos,
    temHistorico: usados.length > 0 && pontos.length > 1,
    variacaoPct: primeiro > 0 && pontos.length > 1 ? ((ultimo - primeiro) / primeiro) * 100 : null,
    desde: pontos[0]?.data || null,
  };
}
