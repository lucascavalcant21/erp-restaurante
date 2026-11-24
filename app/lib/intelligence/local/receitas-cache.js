// Fichas guardadas no aparelho para a receita rápida (receitas-locais.mjs):
// responde na hora e sem internet (pedido do dono, 22/11/2026).
//
// Lê pelo login de quem usa (as regras do banco valem: só a unidade dela) e
// guarda só o que a receita precisa: nome, tipo, rendimento, ingredientes
// (nome, quantidade, unidade) e modo de preparo. Sem custo, preço ou foto.

import { supabase } from "../../supabase";

const VERSAO = 3; // 2: janta da equipe (22/11/2026) · 3: posicionamento (23/11/2026)
const VALIDADE_MS = 10 * 60 * 1000; // atualiza em segundo plano depois de 10 min
const chave = (u) => `hefisto:receitas:v${VERSAO}:${u || "-"}`;
const LOTE = 150;

export function lerReceitasGuardadas(unidadeId) {
  if (typeof window === "undefined" || !unidadeId) return null;
  try {
    const s = window.localStorage.getItem(chave(unidadeId));
    const c = s ? JSON.parse(s) : null;
    return c?.versao === VERSAO && Array.isArray(c.fichas) ? c : null;
  } catch {
    return null;
  }
}

function guardar(unidadeId, dados) {
  try { window.localStorage.setItem(chave(unidadeId), JSON.stringify(dados)); } catch { /* aparelho sem espaço: segue sem guardar */ }
}

export const precisaAtualizar = (c) => !c || Date.now() - (c.em || 0) > VALIDADE_MS;

async function emLotes(ids, consulta) {
  const out = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await consulta(ids.slice(i, i + LOTE));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

/** Baixa as fichas da unidade e guarda no aparelho. Sem internet: devolve o que já tinha. */
export async function atualizarReceitas(unidadeId) {
  if (!unidadeId || !supabase) return lerReceitasGuardadas(unidadeId);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return lerReceitasGuardadas(unidadeId);
  try {
    const { data: fichas, error } = await supabase.from("fichas_tecnicas")
      .select("id, nome_receita, nome_comercial, departamento, eh_base, ativo, status, rendimento_porcoes, rendimento_unidade, peso_porcao_g, tempo_preparo, validade_dias, modo_preparo")
      .eq("unidade_id", unidadeId);
    if (error) throw error;
    const ativas = (fichas || []).filter((f) => f.ativo !== false && f.status !== "arquivada" && String(f.nome_receita || f.nome_comercial || "").trim());
    const ids = ativas.map((f) => f.id);
    const ings = ids.length ? await emLotes(ids, (l) => supabase.from("fichas_ingredientes").select("ficha_id, insumo_id, subficha_id, quantidade").in("ficha_id", l)) : [];
    const idsInsumo = [...new Set(ings.map((i) => i.insumo_id).filter(Boolean))];
    const insumos = new Map((idsInsumo.length ? await emLotes(idsInsumo, (l) => supabase.from("insumos").select("id, nome, unidade_medida").in("id", l)) : []).map((i) => [i.id, i]));
    let etapas = [];
    try {
      etapas = ids.length ? await emLotes(ids, (l) => supabase.from("fichas_etapas").select("ficha_id, ordem, titulo, instrucao").in("ficha_id", l)) : [];
    } catch { etapas = []; } // tabela opcional
    const porFicha = new Map(ativas.map((f) => [f.id, f]));
    const ingsDe = new Map();
    for (const i of ings) {
      const lista = ingsDe.get(i.ficha_id) || [];
      if (i.subficha_id) {
        const b = porFicha.get(i.subficha_id);
        lista.push({ nome: b ? String(b.nome_receita || b.nome_comercial).trim() : "Pré-preparo", qtd: Number(i.quantidade), unidade: b?.rendimento_unidade || "un", base: true });
      } else {
        const ins = insumos.get(i.insumo_id);
        lista.push({ nome: ins?.nome || "Produto sem cadastro", qtd: Number(i.quantidade), unidade: ins?.unidade_medida || "un", base: false });
      }
      ingsDe.set(i.ficha_id, lista);
    }
    const etapasDe = new Map();
    for (const e of [...etapas].sort((a, b) => Number(a.ordem) - Number(b.ordem))) {
      etapasDe.set(e.ficha_id, [...(etapasDe.get(e.ficha_id) || []), { titulo: e.titulo || null, instrucao: e.instrucao || "" }]);
    }
    // Janta da equipe (config_sistema.params.janta_funcionarios): para "janta" responder sem internet.
    // Posicionamento (params.posicionamento): "posicionamento" responde sem internet.
    let janta = null;
    let posicionamento = null;
    try {
      const { data: cfg } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
      const j = cfg?.[0]?.params?.janta_funcionarios;
      janta = j && typeof j === "object" ? j : null;
      const p = cfg?.[0]?.params?.posicionamento;
      posicionamento = p && typeof p === "object" ? p : null;
    } catch { janta = null; posicionamento = null; }
    const dados = {
      versao: VERSAO, em: Date.now(), unidadeId, janta, posicionamento,
      fichas: ativas.map((f) => ({
        id: f.id,
        nome: String(f.nome_receita || f.nome_comercial).trim(),
        base: !!f.eh_base,
        departamento: f.departamento || null,
        rendQtd: Number(f.rendimento_porcoes) > 0 ? Number(f.rendimento_porcoes) : null,
        rendUn: f.rendimento_unidade || null,
        porcaoG: Number(f.peso_porcao_g) > 0 ? Number(f.peso_porcao_g) : null,
        tempoMin: Number(f.tempo_preparo) > 0 ? Number(f.tempo_preparo) : null,
        validadeDias: Number(f.validade_dias) > 0 ? Number(f.validade_dias) : null,
        modoPreparo: String(f.modo_preparo || "").trim() || null,
        etapas: etapasDe.get(f.id) || [],
        ingredientes: ingsDe.get(f.id) || [],
      })),
    };
    guardar(unidadeId, dados);
    return dados;
  } catch {
    return lerReceitasGuardadas(unidadeId);
  }
}
