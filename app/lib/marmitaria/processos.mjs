// PROCESSOS DE MONTAGEM (pedido do dono, 05/11/2026): como cada marmita é
// montada, cozida, fechada e levada ao motoboy, e quais embalagens servem para
// ela. Funções puras (testes em processos.test.mjs).

import { quantidadeParaTela, unidadeDoItem } from "./formulario.mjs";

export const ETAPAS = [
  // Montagem: os atalhos de verdade vêm da ficha técnica (componentesDaFicha); estes só valem sem ficha.
  { id: "montagem", rotulo: "Montagem", atalhos: ["Arroz", "Batata", "Frango", "Molho (por cima ou por baixo)", "Queijo", "Gratinar"] },
  { id: "finalizacao", rotulo: "Finalização", atalhos: ["Salsinha por cima", "Cebolinha por cima", "Sem finalização"] },
  { id: "coccao", rotulo: "Fritura e forno", tempo: true, atalhos: ["Fritura", "Forno", "Descanso"] },
  { id: "fechamento", rotulo: "Fechamento", atalhos: ["Tampa", "Fita", "Papel filme"] },
  { id: "entrega", rotulo: "Embalagem e entrega", atalhos: ["Saco kraft", "Grampos", "Grampear a folha do pedido", "Levar ao motoboy"] },
];

export function processoVazio() {
  return { embalagens: [], etapas: [], recipiente: "", compartimentos: null };
}

// Dono, 21/11/2026: "essa marmita tem 3 compartimentos: nos menores vai isso,
// no maior vai esse". Os compartimentos dependem de quantos a marmita tem.
export function compartimentosDe(n) {
  const q = Number(n);
  if (q === 1) return [{ id: "unico", rotulo: "Único" }];
  if (q === 2) return [{ id: "maior", rotulo: "Maior" }, { id: "menor", rotulo: "Menor" }];
  if (q === 3) return [{ id: "maior", rotulo: "Maior" }, { id: "medio", rotulo: "Médio" }, { id: "menor", rotulo: "Menor" }];
  return [];
}
const ROTULO_COMPARTIMENTO = { unico: "único", maior: "maior", medio: "médio", menor: "menor" };

export function normalizarProcesso(p = {}) {
  return {
    embalagens: Array.isArray(p.embalagens) ? [...new Set(p.embalagens.filter(Boolean))] : [],
    recipiente: typeof p.recipiente === "string" ? p.recipiente : "",
    compartimentos: [1, 2, 3].includes(Number(p.compartimentos)) ? Number(p.compartimentos) : null,
    etapas: (Array.isArray(p.etapas) ? p.etapas : []).filter((e) => ETAPAS.some((x) => x.id === e?.grupo)).map((e) => ({
      id: String(e.id), grupo: e.grupo, titulo: String(e.titulo || ""), texto: String(e.texto || ""), minutos: e.minutos ?? "", graus: e.graus ?? "", foto: e.foto || "",
      quantidade: String(e.quantidade || ""), compartimento: ROTULO_COMPARTIMENTO[e.compartimento] ? e.compartimento : "",
    })),
  };
}

/** Etapa só de título, sem instrução, não conta: é o que falta escrever. */
export function resumoDoProcesso(p) {
  const n = normalizarProcesso(p);
  const escritas = n.etapas.filter((e) => e.texto.trim() || e.minutos !== "" || e.graus !== "").length;
  return { etapas: n.etapas.length, escritas, embalagens: n.embalagens.length, grupos: ETAPAS.filter((g) => g.id !== "finalizacao" && !n.etapas.some((e) => e.grupo === g.id)).map((g) => g.rotulo) };
}

/** A outra ponta: esta embalagem serve para quais marmitas. */
export function marmitasDaEmbalagem(processos = {}, embalagemId, marmitas = []) {
  return marmitas.filter((m) => (processos?.[m.id]?.embalagens || []).includes(embalagemId)).map((m) => m.nome_receita);
}

export function moverEtapa(etapas, id, direcao) {
  const lista = [...etapas];
  const i = lista.findIndex((e) => e.id === id);
  if (i < 0) return lista;
  const grupo = lista[i].grupo;
  let j = i + direcao;
  while (j >= 0 && j < lista.length && lista[j].grupo !== grupo) j += direcao;
  if (j < 0 || j >= lista.length) return lista;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista;
}

// ─── Guia de montagem impresso (dono, 16/11/2026) ────────────────────────────
// Uma folha por marmita para ficar na bancada: foto, o que vai e quanto (da
// ficha técnica, a mesma conta do custo), embalagens e o passo a passo. Nada
// é inventado: o que falta aparece em `faltando`.

const UN_TEXTO = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un" };

/** O que vai na marmita e quanto, da ficha técnica (a mesma conta do custo). */
export function componentesDaFicha({ marmita, insumos = new Map(), fichas = [] } = {}) {
  const ctx = { insumos, fichas };
  return (marmita?.itens || []).filter((it) => Number(it.quantidade) > 0).map((it) => {
    const t = quantidadeParaTela(it.quantidade, unidadeDoItem(it, ctx));
    const nome = it.subficha_id ? fichas.find((f) => f.id === it.subficha_id)?.nome_receita : insumos.get(it.insumo_id)?.nome;
    return { nome: nome || "Item sem cadastro", quantidade: `${t.qtd} ${UN_TEXTO[t.un] || t.un}` };
  });
}

/** "Montar pela ficha": um passo de montagem por item da ficha que ainda não está lá, com a quantidade. */
export function montarPelaFicha(processo, componentes = [], novoId = () => Math.random().toString(36).slice(2)) {
  const p = normalizarProcesso(processo);
  const ja = new Set(p.etapas.filter((e) => e.grupo === "montagem").map((e) => e.titulo.trim().toLowerCase()));
  const novos = componentes.filter((c) => !ja.has(c.nome.trim().toLowerCase()))
    .map((c) => ({ id: novoId(), grupo: "montagem", titulo: c.nome, texto: "", minutos: "", graus: "", foto: "", quantidade: c.quantidade, compartimento: "" }));
  return { ...p, etapas: [...p.etapas, ...novos] };
}

export function guiaDeMontagem({ marmita, processo, insumos = new Map(), fichas = [] } = {}) {
  if (!marmita) return null;
  const componentes = componentesDaFicha({ marmita, insumos, fichas });
  const embalagens = (marmita.embalagens || []).map((e) => ({ nome: insumos.get(e.insumo_id)?.nome || "Embalagem", quantidade: Number(e.quantidade) || 1 }));
  const p = normalizarProcesso(processo);
  const etapas = ETAPAS.map((g) => ({ rotulo: g.rotulo, itens: p.etapas.filter((e) => e.grupo === g.id && (e.titulo.trim() || e.texto.trim()))
    .map((e) => ({ ...e, onde: e.compartimento ? `compartimento ${ROTULO_COMPARTIMENTO[e.compartimento]}` : "" })) }))
    .filter((g) => g.itens.length);
  const recipiente = p.recipiente ? insumos.get(p.recipiente)?.nome || "" : "";
  const faltando = [];
  if (!componentes.length) faltando.push("a ficha técnica (o que vai e quanto)");
  if (!etapas.length) faltando.push("o passo a passo da montagem");
  if (!embalagens.length) faltando.push("as embalagens");
  return {
    nome: marmita.nome_receita || "Marmita", codigo: marmita.codigo || "", foto: marmita.imagem || "", descricao: marmita.descricao_comercial || marmita.descricao || "",
    peso: Number(marmita.peso_final_g) > 0 ? `${Number(marmita.peso_final_g).toLocaleString("pt-BR")} g` : null,
    componentes, embalagens, etapas, faltando,
    recipiente: recipiente ? `${recipiente}${p.compartimentos ? ` · ${p.compartimentos} compartimento${p.compartimentos > 1 ? "s" : ""}` : ""}` : (p.compartimentos ? `${p.compartimentos} compartimento${p.compartimentos > 1 ? "s" : ""}` : ""),
  };
}
