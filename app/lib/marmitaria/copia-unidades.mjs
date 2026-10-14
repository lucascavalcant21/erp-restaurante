// Trazer fichas técnicas e pré-preparos de OUTRA unidade da empresa (ex.: o
// arroz cozido do restaurante para a marmitaria) — puro, sem banco (testes em
// copia-unidades.test.mjs).
//
// Cada negócio tem cadastro, estoque e custo próprios (RLS por unidade), então
// compartilhar = trazer para a unidade de destino SEM duplicar à toa:
//   - ingrediente que o destino já tem (mesmo nome e mesma unidade) é
//     reaproveitado; só o que falta é criado;
//   - mesmo nome com unidade diferente é CONFLITO: nada é criado, o dono
//     decide (renomear ou ajustar o cadastro);
//   - pré-preparo usado pela ficha vem junto (antes de quem o usa) e também é
//     reaproveitado se o destino já tiver um com o mesmo nome;
//   - o item de estoque "espelho" de cada pré-preparo nasce sozinho no banco
//     (trigger) e não é copiado.

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const un = (s) => String(s || "").toLowerCase().trim();

/**
 * origem:  { fichas: [{ id, nome_receita, eh_base, departamento, rendimento_porcoes, rendimento_unidade, validade_dias,
 *                       fichas_ingredientes: [{ insumo_id, subficha_id, quantidade, fator_correcao }] }],
 *            insumos: Map id → insumo, embalagens: Map ficha_id → [{ insumo_id, quantidade, tipo }] }
 * destino: { fichas: [...], insumos: [...] }
 * escolhidas: ids das fichas da origem
 * novaChave: () => uuid (injetado)
 */
export function planoDeCopia({ origem, destino, escolhidas = [], novaChave }) {
  const fichaO = new Map((origem.fichas || []).map((f) => [f.id, f]));
  const insO = origem.insumos instanceof Map ? origem.insumos : new Map((origem.insumos || []).map((i) => [i.id, i]));
  const embO = origem.embalagens instanceof Map ? origem.embalagens : new Map();
  const insD = (destino.insumos || []).filter((i) => !i.arquivado_em && !i.ficha_tecnica_id);
  const fichasD = destino.fichas || [];
  const conflitos = []; const avisos = [];

  // 1. fichas necessárias, quem é usado antes de quem usa
  const ordem = []; const visto = new Set(); const pilha = new Set();
  const visitar = (id) => {
    if (visto.has(id)) return;
    const f = fichaO.get(id);
    if (!f) { avisos.push("Uma ficha usada não foi encontrada na unidade de origem."); return; }
    if (pilha.has(id)) { conflitos.push(`Referência circular em "${f.nome_receita}".`); return; }
    pilha.add(id);
    for (const fi of f.fichas_ingredientes || []) if (fi.subficha_id) visitar(fi.subficha_id);
    pilha.delete(id); visto.add(id); ordem.push(id);
  };
  for (const id of escolhidas) visitar(id);
  const escolhidasSet = new Set(escolhidas);

  // 2. fichas: reaproveitar pelo nome ou criar (pré-preparo = eh_base; o resto vira marmita)
  const mapaFichas = new Map(); const fichas = [];
  for (const id of ordem) {
    const f = fichaO.get(id);
    const ehPre = !!f.eh_base;
    const existente = fichasD.find((d) => norm(d.nome_receita) === norm(f.nome_receita)
      && (ehPre ? d.eh_base : d.departamento === "marmitaria"));
    if (existente) {
      mapaFichas.set(id, existente.id);
      fichas.push({ origemId: id, destinoId: existente.id, nome: f.nome_receita, tipo: ehPre ? "pre_preparo" : "marmita", existente: true });
      continue;
    }
    const destinoId = novaChave();
    mapaFichas.set(id, destinoId);
    fichas.push({ origemId: id, destinoId, nome: f.nome_receita, tipo: ehPre ? "pre_preparo" : "marmita", existente: false });
  }

  // 3. ingredientes e embalagens: reaproveitar ou criar
  const mapaInsumos = new Map(); const criar = []; const reaproveitar = [];
  const resolverInsumo = (id) => {
    if (mapaInsumos.has(id)) return;
    const o = insO.get(id);
    if (!o) { avisos.push("Um ingrediente não foi encontrado na unidade de origem."); mapaInsumos.set(id, null); return; }
    const mesmoNome = insD.filter((d) => norm(d.nome) === norm(o.nome));
    const igual = mesmoNome.find((d) => un(d.unidade_medida) === un(o.unidade_medida));
    if (igual) { mapaInsumos.set(id, igual.id); reaproveitar.push({ origemId: id, destinoId: igual.id, nome: o.nome }); return; }
    if (mesmoNome.length) {
      conflitos.push(`"${o.nome}" já existe no destino em ${mesmoNome[0].unidade_medida} e na origem é ${o.unidade_medida}: ajuste um dos cadastros.`);
      mapaInsumos.set(id, null); return;
    }
    const novoId = novaChave();
    mapaInsumos.set(id, novoId);
    criar.push({
      origemId: id, id: novoId, nome: o.nome, unidade_medida: o.unidade_medida, departamento: o.departamento || "cozinha",
      categoria: o.categoria || "", tipo: o.tipo || (o.departamento === "embalagens" ? "embalagem" : "ingrediente"),
      tamanho_embalagem: o.tamanho_embalagem ?? 1, custo_compra: o.custo_compra ?? o.custo_unitario ?? 0,
      valor_embalagem: o.valor_embalagem ?? o.custo_compra ?? o.custo_unitario ?? 0, perda_pct: o.perda_pct ?? null,
    });
  };
  // só fichas NOVAS puxam ingredientes (a que o destino já tem usa o cadastro dele)
  for (const item of fichas.filter((x) => !x.existente)) {
    const id = item.origemId;
    for (const fi of fichaO.get(id)?.fichas_ingredientes || []) if (fi.insumo_id && !fi.subficha_id) resolverInsumo(fi.insumo_id);
    if (item.tipo === "marmita") for (const e of embO.get(id) || []) if (e.insumo_id) resolverInsumo(e.insumo_id);
  }

  // 4. payloads (só das fichas novas), já com os ids do destino
  // remap: id planejado → id real (o cadastro oficial gera o id do produto novo)
  const payload = (item, unidadeId, remap = new Map()) => {
    const ins = (id) => { const v = mapaInsumos.get(id) || null; return v && remap.has(v) ? remap.get(v) : v; };
    const f = fichaO.get(item.origemId);
    const itens = (f.fichas_ingredientes || []).map((fi) => ({
      insumo_id: fi.subficha_id ? null : ins(fi.insumo_id),
      subficha_id: fi.subficha_id ? mapaFichas.get(fi.subficha_id) || null : null,
      quantidade: Number(fi.quantidade) || 0, fator_correcao: Number(fi.fator_correcao) || 0,
    })).filter((i) => (i.insumo_id || i.subficha_id) && i.quantidade > 0);
    if (item.tipo === "pre_preparo") {
      return { id: item.destinoId, unidade_id: unidadeId, tipo: "pre_preparo", nome: f.nome_receita,
        departamento: ["cozinha", "bar"].includes(f.departamento) ? f.departamento : "cozinha",
        rendimento: Number(f.rendimento_porcoes) || 1, rendimento_unidade: f.rendimento_unidade || "kg",
        validade_dias: f.validade_dias ?? null, itens };
    }
    const embalagens = (embO.get(item.origemId) || []).map((e) => ({ insumo_id: ins(e.insumo_id), quantidade: Number(e.quantidade) || 0, tipo: e.tipo || "outra" }))
      .filter((e) => e.insumo_id && e.quantidade > 0);
    return { id: item.destinoId, unidade_id: unidadeId, tipo: "marmita", nome: f.nome_receita, descricao: f.descricao || "",
      categoria: f.categoria || "", tamanho: f.tamanho_marmita || "M", peso_final_g: f.peso_final_g ?? null, ativo: true,
      preco_venda: 0, custo_embalagens_total: 0, itens, embalagens, precos: [] };
  };

  return {
    ok: conflitos.length === 0,
    conflitos: [...new Set(conflitos)], avisos: [...new Set(avisos)],
    criarInsumos: criar, reaproveitarInsumos: reaproveitar,
    fichas, payload,
    resumo: {
      insumosNovos: criar.length, insumosReaproveitados: reaproveitar.length,
      fichasNovas: fichas.filter((f) => !f.existente).length, fichasReaproveitadas: fichas.filter((f) => f.existente).length,
    },
  };
}
