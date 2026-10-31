// JANTA DOS FUNCIONÁRIOS (pedido do dono, 30/10/2026): "dividir por dia da
// semana, o que será servido, como fazer o cardápio do dia, todo o preparo e
// a quantidade conforme o número de pessoas — eu só ponho a base de quantas
// gramas por pessoa de cada coisa do prato do dia".
//
// Guardado em config_sistema.params.janta_funcionarios:
//   { pessoas_padrao, dias: { seg: { pessoas, fora: [colaborador_id], extras,
//     pratos: [{ id, nome, preparo, itens: [{ id, nome, insumo_id, g_pessoa }] }] }, … } }
//
// Quantas pessoas jantam no dia (31/10/2026: "conforme o número de funcionários
// que vão jantar naquele dia a ficha muda"): vem da ESCALA DA JANTA — quem
// trabalha no dia pelo cadastro e pelas folgas (app/lib/escala-dia.mjs), menos
// quem tem "janta" desligada no cadastro, menos quem o dono tirou do dia
// (fora), mais os extras (visitas, freelas). Número digitado no dia vence tudo.
// A conta é determinística: total = gramas por pessoa × pessoas. Custo só
// com produto ligado ao cadastro e com preço (senão DADOS INSUFICIENTES).

import { precoNormalizadoDoInsumo } from "./ingredientes-utils.mjs";
import { montarEscala } from "./escala-dia.mjs";

export const DIAS_SEMANA = [
  { id: "seg", rotulo: "Segunda" }, { id: "ter", rotulo: "Terça" }, { id: "qua", rotulo: "Quarta" },
  { id: "qui", rotulo: "Quinta" }, { id: "sex", rotulo: "Sexta" }, { id: "sab", rotulo: "Sábado" }, { id: "dom", rotulo: "Domingo" },
];
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const r2 = (v) => Math.round(v * 100) / 100;
export const novoIdJanta = (p = "j") => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function jantaVazia() {
  return { pessoas_padrao: "", dias: Object.fromEntries(DIAS_SEMANA.map((d) => [d.id, { pessoas: "", fora: [], extras: "", pratos: [] }])) };
}

/** Lê o que veio do banco sem quebrar com dado velho ou incompleto. */
export function normalizarJanta(salvo) {
  const base = jantaVazia();
  if (!salvo || typeof salvo !== "object") return base;
  const dias = {};
  for (const d of DIAS_SEMANA) {
    const x = salvo.dias?.[d.id] || {};
    dias[d.id] = {
      pessoas: x.pessoas ?? "",
      fora: Array.isArray(x.fora) ? x.fora.map(String) : [],
      extras: x.extras ?? "",
      pratos: (Array.isArray(x.pratos) ? x.pratos : []).map((p) => ({
        id: p.id || novoIdJanta("p"), nome: String(p.nome || ""), preparo: String(p.preparo || ""),
        itens: (Array.isArray(p.itens) ? p.itens : []).map((i) => ({ id: i.id || novoIdJanta("i"), nome: String(i.nome || ""), insumo_id: i.insumo_id || null, g_pessoa: i.g_pessoa ?? "" })),
      })),
    };
  }
  return { pessoas_padrao: salvo.pessoas_padrao ?? "", dias };
}

export const pessoasDoDia = (janta, diaId) => n(janta?.dias?.[diaId]?.pessoas) || n(janta?.pessoas_padrao);

const ID_DO_DIA = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

/** Próxima data (hoje inclusive) daquele dia da semana: a escala é a dessa data. */
export function dataDoDia(diaId, hojeIso) {
  const [a, m, d] = String(hojeIso).slice(0, 10).split("-").map(Number);
  const hoje = new Date(Date.UTC(a, m - 1, d));
  const passos = (ID_DO_DIA[diaId] - hoje.getUTCDay() + 7) % 7;
  return new Date(hoje.getTime() + passos * 86400000).toISOString().slice(0, 10);
}

/**
 * Escala da janta de um dia.
 * → { data, jantam: [...], tirados: [...], semJanta: [...], folgas: [...], semHorario, extras }
 */
export function escalaDaJanta(janta, diaId, { colaboradores = [], folgas = [], hojeIso }) {
  const data = dataDoDia(diaId, hojeIso);
  const esc = montarEscala({ colaboradores, folgas, data });
  const fora = new Set(janta?.dias?.[diaId]?.fora || []);
  const comJanta = esc.trabalham.filter((p) => p.janta);
  return {
    data,
    jantam: comJanta.filter((p) => !fora.has(String(p.id))),
    tirados: comJanta.filter((p) => fora.has(String(p.id))),
    semJanta: esc.trabalham.filter((p) => !p.janta),
    folgas: esc.folgas,
    semHorario: esc.semHorario,
    extras: n(janta?.dias?.[diaId]?.extras),
  };
}

/**
 * Pessoas do dia e de onde veio o número: o digitado no dia vence; senão a
 * escala da janta (+ extras); sem escala, o padrão. 0 = DADOS INSUFICIENTES.
 */
export function pessoasDaJanta(janta, diaId, escala = null) {
  const manual = n(janta?.dias?.[diaId]?.pessoas);
  if (manual) return { total: manual, origem: "manual" };
  const daEscala = escala ? escala.jantam.length + escala.extras : 0;
  if (daEscala) return { total: daEscala, origem: "escala" };
  const padrao = n(janta?.pessoas_padrao);
  if (padrao) return { total: padrao, origem: "padrao" };
  return { total: 0, origem: "sem_dado" };
}

/** "1,2 kg" ou "720 g". */
export function rotuloPeso(g) {
  if (!(g > 0)) return "—";
  return g >= 1000 ? `${(Math.round(g / 10) / 100).toLocaleString("pt-BR")} kg` : `${Math.round(g).toLocaleString("pt-BR")} g`;
}

/** Custo de `gramas` do produto (preço por kg ou por L do cadastro; L conta 1 g = 1 ml). */
export function custoDasGramas(insumo, gramas) {
  if (!insumo || !(gramas > 0)) return null;
  const base = String(insumo.unidade_medida || "").toLowerCase();
  const preco = precoNormalizadoDoInsumo(insumo);
  if (!(preco > 0)) return null;
  if (["kg", "g", "l", "ml"].includes(base)) return r2((gramas / 1000) * preco);
  const pesoUn = n(insumo.peso_peca_g) || n(insumo.peso_medio_g);
  if (base === "un" && pesoUn) return r2((gramas / pesoUn) * preco);
  return null;
}

/**
 * Quantidades e custo do dia para `pessoas` (quando não vier, as do dia).
 * insumos: Map(id → insumo) do cadastro.
 */
export function cardapioDoDia(janta, diaId, { pessoas = null, insumos = new Map() } = {}) {
  const dia = janta?.dias?.[diaId] || { pratos: [] };
  const p = n(pessoas) || pessoasDoDia(janta, diaId);
  let custo = 0; let semCusto = 0;
  const pratos = dia.pratos.map((prato) => {
    const itens = prato.itens.filter((i) => i.nome || i.insumo_id).map((i) => {
      const gp = n(i.g_pessoa);
      const total = gp * p;
      const ins = i.insumo_id ? insumos.get(i.insumo_id) : null;
      const c = custoDasGramas(ins, total);
      if (c == null) { if (total > 0) semCusto += 1; } else custo += c;
      return { ...i, nome: i.nome || ins?.nome || "", gPessoa: gp, totalG: total, rotulo: rotuloPeso(total), custo: c };
    });
    return { ...prato, itens, totalG: itens.reduce((t, x) => t + x.totalG, 0) };
  });
  return {
    pessoas: p, pratos, custo: r2(custo), semCusto,
    custoPorPessoa: p > 0 && custo > 0 ? r2(custo / p) : null,
    natureza: semCusto ? "ESTIMATIVA" : "REAL",
  };
}
