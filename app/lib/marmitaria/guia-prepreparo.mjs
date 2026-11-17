// Ficha impressa do pré-preparo (dono, 17/11/2026: "posso imprimir o
// pré-preparo do arroz, do estrogonofe…"). Monta o mesmo formato do guia de
// montagem (guia-impresso.mjs): ingredientes com a quantidade do lote,
// rendimento, validade, tempo e o modo de preparo passo a passo.
import { passosDoPreparo } from "./modo-preparo.mjs";

const fmt = (n, c = 3) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: c });

/** 0,07 kg → "70 g"; 1,8 L → "1,8 L"; 3 un → "3 un" */
export function quantidadeLegivel(q, un) {
  const u = String(un || "un").toLowerCase();
  const n = Number(q) || 0;
  if (u === "kg" && n < 1) return `${fmt(n * 1000, 1)} g`;
  if (u === "l" && n < 1) return `${fmt(n * 1000, 1)} ml`;
  return `${fmt(n)} ${u === "l" ? "L" : u}`;
}

export function guiaDoPrePreparo(ficha, insumos = new Map(), fichas = []) {
  if (!ficha) return null;
  const porId = new Map(fichas.map((f) => [f.id, f]));
  const componentes = (ficha.fichas_ingredientes || []).map((fi) => {
    if (fi.subficha_id) {
      const sf = porId.get(fi.subficha_id);
      return { nome: sf?.nome_receita || "Pré-preparo", quantidade: quantidadeLegivel(fi.quantidade, sf?.rendimento_unidade) };
    }
    const ins = insumos.get(fi.insumo_id) || fi.insumos;
    return { nome: ins?.nome || "Ingrediente", quantidade: quantidadeLegivel(fi.quantidade, ins?.unidade_medida) };
  });
  const rend = Number(ficha.rendimento_porcoes) || 0;
  const info = [
    rend > 0 ? `Rende ${quantidadeLegivel(rend, ficha.rendimento_unidade)}${ficha.peso_porcao_g ? ` (${fmt(ficha.peso_porcao_g)} g cada)` : ""}` : null,
    ficha.validade_dias ? `validade ${ficha.validade_dias} dia(s)` : null,
    ficha.tempo_preparo ? `tempo total ${ficha.tempo_preparo} min` : null,
  ].filter(Boolean).join(" · ");
  const passos = passosDoPreparo(ficha.modo_preparo);
  return {
    nome: ficha.nome_receita || "Pré-preparo",
    codigo: ficha.codigo || "",
    descricao: info,
    foto: ficha.imagem || "",
    tituloItens: "Ingredientes do lote",
    componentes,
    semEmbalagens: true,
    embalagens: [],
    peso: "",
    etapas: passos.length ? [{ rotulo: "Modo de preparo", itens: passos.map((p) => ({ titulo: p.texto, texto: "" })) }] : [],
    faltando: [],
  };
}
