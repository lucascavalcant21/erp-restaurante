// PROCESSOS DE MONTAGEM (pedido do dono, 05/11/2026): como cada marmita é
// montada, cozida, fechada e levada ao motoboy, e quais embalagens servem para
// ela. Funções puras (testes em processos.test.mjs).

import { quantidadeParaTela, unidadeDoItem } from "./formulario.mjs";

export const ETAPAS = [
  { id: "montagem", rotulo: "Montagem", atalhos: ["Arroz", "Batata", "Frango", "Molho (por cima ou por baixo)", "Queijo", "Gratinar"] },
  { id: "coccao", rotulo: "Fritura e forno", tempo: true, atalhos: ["Fritura", "Forno", "Descanso"] },
  { id: "fechamento", rotulo: "Fechamento", atalhos: ["Tampa", "Fita", "Papel filme"] },
  { id: "entrega", rotulo: "Embalagem e entrega", atalhos: ["Saco kraft", "Grampos", "Grampear a folha do pedido", "Levar ao motoboy"] },
];

export function processoVazio() {
  return { embalagens: [], etapas: [] };
}

export function normalizarProcesso(p = {}) {
  return {
    embalagens: Array.isArray(p.embalagens) ? [...new Set(p.embalagens.filter(Boolean))] : [],
    etapas: (Array.isArray(p.etapas) ? p.etapas : []).filter((e) => ETAPAS.some((x) => x.id === e?.grupo)).map((e) => ({
      id: String(e.id), grupo: e.grupo, titulo: String(e.titulo || ""), texto: String(e.texto || ""), minutos: e.minutos ?? "", graus: e.graus ?? "", foto: e.foto || "",
    })),
  };
}

/** Etapa só de título, sem instrução, não conta: é o que falta escrever. */
export function resumoDoProcesso(p) {
  const n = normalizarProcesso(p);
  const escritas = n.etapas.filter((e) => e.texto.trim() || e.minutos !== "" || e.graus !== "").length;
  return { etapas: n.etapas.length, escritas, embalagens: n.embalagens.length, grupos: ETAPAS.filter((g) => !n.etapas.some((e) => e.grupo === g.id)).map((g) => g.rotulo) };
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

export function guiaDeMontagem({ marmita, processo, insumos = new Map(), fichas = [] } = {}) {
  if (!marmita) return null;
  const ctx = { insumos, fichas };
  const componentes = (marmita.itens || []).filter((it) => Number(it.quantidade) > 0).map((it) => {
    const t = quantidadeParaTela(it.quantidade, unidadeDoItem(it, ctx));
    const nome = it.subficha_id ? fichas.find((f) => f.id === it.subficha_id)?.nome_receita : insumos.get(it.insumo_id)?.nome;
    return { nome: nome || "Item sem cadastro", quantidade: `${t.qtd} ${UN_TEXTO[t.un] || t.un}` };
  });
  const embalagens = (marmita.embalagens || []).map((e) => ({ nome: insumos.get(e.insumo_id)?.nome || "Embalagem", quantidade: Number(e.quantidade) || 1 }));
  const p = normalizarProcesso(processo);
  const etapas = ETAPAS.map((g) => ({ rotulo: g.rotulo, itens: p.etapas.filter((e) => e.grupo === g.id && (e.titulo.trim() || e.texto.trim())) }))
    .filter((g) => g.itens.length);
  const faltando = [];
  if (!componentes.length) faltando.push("a ficha técnica (o que vai e quanto)");
  if (!etapas.length) faltando.push("o passo a passo da montagem");
  if (!embalagens.length) faltando.push("as embalagens");
  return {
    nome: marmita.nome_receita || "Marmita", codigo: marmita.codigo || "", foto: marmita.imagem || "", descricao: marmita.descricao_comercial || marmita.descricao || "",
    peso: Number(marmita.peso_final_g) > 0 ? `${Number(marmita.peso_final_g).toLocaleString("pt-BR")} g` : null,
    componentes, embalagens, etapas, faltando,
  };
}
