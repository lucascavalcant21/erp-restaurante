// ESTOQUE DAS BASES (pedido do dono, 23/11/2026): quanto tem pronto de cada
// base (arroz branco, vatapá, molhos…), com entrada quando produz e retirada
// quando usa, perde ou vence.
//
// O banco já guarda: cada base da Cozinha e do Bar tem um item espelho no
// estoque "pre-preparos-cozinha" / "pre-preparos-bar" (trigger
// sincronizar_pre_preparo_ficha). A movimentação vai pelo motor do ERP
// (estoque_movimentar), nunca por conta própria aqui.

export const SLUGS_BASES = Object.freeze(["pre-preparos-cozinha", "pre-preparos-bar"]);

export const MOTIVOS_BASE = Object.freeze({
  entrada: [{ codigo: "producao", rotulo: "Produzi" }, { codigo: "devolucao", rotulo: "Voltou (sobrou)" }],
  saida: [{ codigo: "consumo", rotulo: "Usei" }, { codigo: "perda", rotulo: "Perdi" }, { codigo: "vencimento", rotulo: "Venceu" }],
});

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmt = (v, dec = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: dec });

/** Unidade do saldo → opções para digitar (kg aceita g; L aceita ml). */
export function unidadesDeDigitar(unidade) {
  const u = semAcento(unidade).trim();
  if (u === "kg") return [{ id: "kg", fator: 1 }, { id: "g", fator: 0.001 }];
  if (u === "g") return [{ id: "g", fator: 1 }, { id: "kg", fator: 1000 }];
  if (u === "l" || u === "lt") return [{ id: "L", fator: 1 }, { id: "ml", fator: 0.001 }];
  if (u === "ml") return [{ id: "ml", fator: 1 }, { id: "L", fator: 1000 }];
  return [{ id: u || "un", fator: 1 }];
}

/** "1,8" ou "1.8" → 1.8; inválido → null. */
export function lerQuantidade(txt) {
  const s = String(txt ?? "").trim();
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Quantidade digitada na unidade escolhida → unidade do saldo (3 casas). */
export function paraUnidadeDoSaldo(qtd, fator) {
  return Math.round(qtd * fator * 1000) / 1000;
}

export function textoSaldo(qtd, unidade) {
  const q = Number(qtd) || 0;
  const u = semAcento(unidade).trim();
  if (q === 0) return `0 ${u === "l" ? "L" : u || "un"}`;
  if (u === "kg") return Math.abs(q) < 1 ? `${fmt(q * 1000, 0)} g` : `${fmt(q)} kg`;
  if (u === "l" || u === "lt") return Math.abs(q) < 1 ? `${fmt(q * 1000, 0)} ml` : `${fmt(q)} L`;
  return `${fmt(q)} ${u || "un"}`;
}

/**
 * Linhas do banco (estoque_itens + insumos + estoque) → lista da tela.
 * Mostra as bases atuais (com ficha) e qualquer item com saldo (para nenhum
 * saldo ficar escondido). Com saldo primeiro, depois por nome.
 */
export function montarEstoqueBases(linhas = [], estoques = []) {
  const setor = new Map(estoques.map((e) => [e.id, e.slug === "pre-preparos-bar" ? "bar" : "cozinha"]));
  return linhas
    .filter((l) => setor.has(l.estoque_id) && (l.ficha_tecnica_id || Number(l.quantidade_atual) !== 0))
    .map((l) => ({
      id: l.id, estoqueId: l.estoque_id, insumoId: l.insumo_id, fichaId: l.ficha_tecnica_id || null,
      nome: String(l.insumos?.nome || "Base sem nome").trim(), unidade: l.insumos?.unidade_medida || "un",
      saldo: Number(l.quantidade_atual) || 0, setor: setor.get(l.estoque_id), local: l.local_interno || "",
      negativo: Number(l.quantidade_atual) < 0,
    }))
    .sort((a, b) => (b.saldo !== 0) - (a.saldo !== 0) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function filtrarBases(lista, { setor = "todos", busca = "" } = {}) {
  const q = semAcento(busca).trim();
  return lista.filter((b) => (setor === "todos" || b.setor === setor) && (!q || semAcento(b.nome).includes(q)));
}
