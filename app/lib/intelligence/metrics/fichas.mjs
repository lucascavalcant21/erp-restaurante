// FICHA TÉCNICA — "como faz o vatapá?", "ficha do risoto", "ingredientes da caipirinha".
//
// Lê a ficha cadastrada (fichas_tecnicas), os ingredientes (fichas_ingredientes,
// só da ficha já conferida desta unidade — regra "pai" do banco escopado), os
// nomes dos produtos (insumos) e as etapas do preparo (fichas_etapas). Mostra
// o que está cadastrado, sem custo: quem vê a ficha vê como faz. Nada é
// inventado — campo vazio na ficha aparece como "não cadastrado".

import { metrica, insuficiente, CONFIANCA, NATUREZA } from "../core/contratos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { candidatosDoTermo, fmtQtd } from "./produtos.mjs";
import { medir, fonte } from "./base.mjs";

const CAMPOS_FICHA = "id, nome_receita, nome_comercial, nome_interno, departamento, categoria, rendimento_porcoes, rendimento_unidade, peso_porcao_g, modo_preparo, tempo_preparo, tempo_coccao_min, temperatura_preparo, temperatura_servico, validade_dias, observacoes, status, ativo, eh_base, metodo_bar, copo, guarnicao, tipo_gelo";

/** Quantidade na unidade do cadastro, legível: 0,25 kg → "250 g"; 1,5 L → "1,5 L". */
export function quantidadeLegivel(q, unidade) {
  const n = Number(q);
  const u = String(unidade || "un").trim();
  if (!Number.isFinite(n)) return "não cadastrado";
  const ul = u.toLowerCase();
  if (ul === "kg" && n < 1) return `${fmtQtd(Math.round(n * 1000 * 10) / 10)} g`;
  if (ul === "l" && n < 1) return `${fmtQtd(Math.round(n * 1000 * 10) / 10)} ml`;
  return `${fmtQtd(n)} ${ul === "l" ? "L" : u}`;
}

export function fichaDoPrato(amb, { termo } = {}) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: "cadastro atual" };
  return medir(amb, { id: "ficha_tecnica", capacidade: "fichas", periodo }, async (consultas) => {
    const fontes = [fonte("fichas_tecnicas", "Ficha cadastrada"), fonte("fichas_ingredientes", "Ingredientes da ficha"), fonte("fichas_etapas", "Etapas do preparo")];
    const todas = ((await ler(amb.dbe.from("fichas_tecnicas").select(CAMPOS_FICHA), "fichas_tecnicas")) || []).filter((f) => f.ativo !== false && f.status !== "arquivada");
    const comNome = todas.map((f) => ({ ...f, nome: f.nome_receita || f.nome_comercial, nome_interno: f.nome_interno || f.nome_comercial }));
    const achadas = candidatosDoTermo(comNome, termo || "");
    if (!achadas.length) {
      return insuficiente({ metrica: "ficha_tecnica", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `Não há ficha técnica cadastrada com o nome "${termo}" nesta unidade.`, faltando: ["ficha técnica do prato"] });
    }
    const ficha = achadas[0];
    const ings = (await ler(amb.dbe.from("fichas_ingredientes").select("ficha_id, insumo_id, subficha_id, quantidade").eq("ficha_id", ficha.id), "fichas_ingredientes")) || [];
    const idsInsumo = [...new Set(ings.map((i) => i.insumo_id).filter(Boolean))];
    const insumos = idsInsumo.length ? new Map(((await ler(amb.dbe.from("insumos").select("id, nome, unidade_medida").in("id", idsInsumo), "insumos")) || []).map((i) => [i.id, i])) : new Map();
    const porId = new Map(todas.map((f) => [f.id, f]));
    const ingredientes = ings.map((i) => {
      if (i.subficha_id) {
        const b = porId.get(i.subficha_id);
        return { nome: b ? `${b.nome_receita} (base da casa)` : "Base (não encontrada)", quantidade: quantidadeLegivel(i.quantidade, b?.rendimento_unidade || "un") };
      }
      const ins = insumos.get(i.insumo_id);
      return { nome: ins?.nome || "Produto não encontrado no cadastro", quantidade: quantidadeLegivel(i.quantidade, ins?.unidade_medida) };
    });
    let etapas = [];
    try {
      etapas = ((await ler(amb.dbe.from("fichas_etapas").select("ficha_id, ordem, titulo, instrucao, tempo_min, temperatura, equipamento").eq("ficha_id", ficha.id).order("ordem"), "fichas_etapas")) || [])
        .map((e) => ({ titulo: e.titulo || null, instrucao: e.instrucao || "", tempoMin: e.tempo_min ?? null, temperatura: e.temperatura || null, equipamento: e.equipamento || null }));
    } catch (e) {
      if (!e.ausente) throw e;
    }
    const semPreparo = !etapas.length && !String(ficha.modo_preparo || "").trim();
    const observacoes = [];
    if (semPreparo) observacoes.push("A ficha não tem modo de preparo nem etapas cadastradas.");
    if (!ingredientes.length) observacoes.push("A ficha não tem ingredientes cadastrados.");
    return metrica({
      metrica: "ficha_tecnica", valor: ingredientes.length, unidade: "ingredientes", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: semPreparo || !ingredientes.length ? 0.5 : 1, confianca: semPreparo ? CONFIANCA.MEDIA : CONFIANCA.ALTA, natureza: NATUREZA.REAL,
      apuradoEm: amb.apuradoEm, observacoes: observacoes.length ? observacoes : ["Conforme a ficha técnica cadastrada."],
      detalhes: {
        ficha: {
          id: ficha.id, nome: ficha.nome_receita, departamento: ficha.departamento || null,
          rendimento: ficha.rendimento_porcoes ? `${fmtQtd(ficha.rendimento_porcoes)} ${ficha.rendimento_unidade || "porção(ões)"}` : null,
          porcaoG: ficha.peso_porcao_g ?? null, tempoPreparo: ficha.tempo_preparo ?? null, tempoCoccao: ficha.tempo_coccao_min ?? null,
          temperatura: ficha.temperatura_preparo || null, servico: ficha.temperatura_servico || null, validadeDias: ficha.validade_dias ?? null,
          modoPreparo: String(ficha.modo_preparo || "").trim() || null, observacoes: ficha.observacoes || null,
          bar: ficha.departamento === "bar" ? { metodo: ficha.metodo_bar || null, copo: ficha.copo || null, gelo: ficha.tipo_gelo || null, guarnicao: ficha.guarnicao || null } : null,
        },
        ingredientes, etapas,
        outras: achadas.slice(1, 5).map((f) => f.nome_receita),
      },
    });
  });
}
