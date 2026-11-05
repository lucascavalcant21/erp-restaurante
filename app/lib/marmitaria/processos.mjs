// PROCESSOS DE MONTAGEM (pedido do dono, 05/11/2026): como cada marmita é
// montada, cozida, fechada e levada ao motoboy, e quais embalagens servem para
// ela. Funções puras (testes em processos.test.mjs).

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
