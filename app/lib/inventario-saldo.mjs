// Inventário → saldo do estoque. Uma área de estoque só: a contagem é o
// inventário (celular, progresso, custo congelado, base do CMV real) e, ao
// fechar, o saldo de cada produto contado passa a ser o contado — por meio do
// mesmo acerto de contagem do Controle de Estoque (registrar_contagem_estoque_multi),
// que grava saldo anterior → novo, quem e quando. Antes eram dois jeitos de
// contar que não conversavam: o "Contagem" do Controle de Estoque mudava o
// saldo sem custo; o inventário tinha custo mas não mudava o saldo.
//
// Regra de embalagem (antes só dentro da tela do estoque, agora uma só):
//   fracionável = conteúdo por embalagem > 1 (garrafa 750 ml, saco 5 kg) e
//   permite fracionado. Unidade que se CONTA (garrafa, lata, un...) só é
//   fracionável se marcar "permite fracionado" no cadastro.
// O saldo do fracionável é guardado em CONTEÚDO (ml, g, kg...). Na contagem a
// pessoa informa embalagens fechadas + o que sobra na aberta.

const r3 = (n) => Math.round(Number(n) * 1000) / 1000;

export const UNIDADES_CONTAVEIS = ["un", "unidade", "garrafa", "lata", "barril", "caixa", "cx", "pacote", "fardo", "maco", "maço"];
export const ehUnidadeContavel = (u) => UNIDADES_CONTAVEIS.includes(String(u || "").toLowerCase());

export function ehFracionavel(item) {
  if (!item || !(Number(item.tamanho_embalagem) > 1)) return false;
  if (ehUnidadeContavel(item.unidade_medida)) return item.permite_fracionado === true;
  return item.permite_fracionado !== false;
}
export const conteudoDe = (item) => Number(item?.tamanho_embalagem) || 1;

// Fracionável numa unidade que se conta (garrafa marcada como fracionada): o
// cadastro fala em garrafas, mas o saldo é guardado em conteúdo.
const saldoEmConteudo = (insumo) => ehFracionavel(insumo) && ehUnidadeContavel(insumo?.unidade_medida);

/** Saldo do Controle de Estoque → quantidade na unidade do cadastro (a da contagem). */
export function saldoParaCadastro(saldo, insumo) {
  if (saldo == null || saldo === "" || !Number.isFinite(Number(saldo))) return null;
  return saldoEmConteudo(insumo) ? r3(Number(saldo) / conteudoDe(insumo)) : r3(Number(saldo));
}

/** Quantidade contada (unidade do cadastro) → saldo do Controle de Estoque. */
export function cadastroParaSaldo(qtd, insumo) {
  return saldoEmConteudo(insumo) ? r3(Number(qtd) * conteudoDe(insumo)) : r3(Number(qtd));
}

/**
 * Número digitado na contagem, aceitando soma: "6+4" = 10. É o que substitui a
 * contagem do bar em "frio + quente" (expositor + depósito) — conta cada lugar
 * e soma no mesmo campo. Vazio = 0; vírgula decimal; parte inválida = NaN.
 */
export function lerSoma(valor) {
  const partes = String(valor ?? "").split("+").map((x) => x.trim());
  if (partes.every((x) => x === "")) return 0;
  let total = 0;
  for (const x of partes) {
    if (x === "") return NaN;
    const n = Number(x.includes(",") ? x.replace(/\./g, "").replace(",", ".") : x);
    if (!Number.isFinite(n)) return NaN;
    total += n;
  }
  return r3(total);
}

/**
 * Embalagens fechadas + quanto tem na aberta → quantidade na unidade do cadastro.
 * Garrafa de 750 ml cadastrada em ml: 3 fechadas + 200 ml = 2450 (ml).
 * Garrafa cadastrada em "garrafa" (fracionada): 3 fechadas + 375 ml = 3,5 (garrafas).
 */
export function quantidadeDeEmbalagens({ fechadas, aberto }, insumo) {
  const f = lerSoma(fechadas), a = lerSoma(aberto);
  if (!Number.isFinite(f) || !Number.isFinite(a)) return { erro: "Quantidade inválida." };
  if (f < 0 || a < 0) return { erro: "A quantidade não pode ser negativa." };
  if (!Number.isInteger(f)) return { erro: "Embalagens fechadas são inteiras." };
  const c = conteudoDe(insumo);
  if (a >= c) return { erro: `A aberta tem no máximo ${c.toLocaleString("pt-BR")} — acima disso é outra embalagem fechada.` };
  return { valor: saldoEmConteudo(insumo) ? r3(f + a / c) : r3(f * c + a) };
}

/** Unidade em que a pessoa informa o que sobra na aberta. */
export function unidadeDoConteudo(insumo) {
  if (saldoEmConteudo(insumo)) return String(insumo?.unidade_conteudo || "ml");
  const u = String(insumo?.unidade_medida || "").toLowerCase();
  return u === "l" ? "L" : u || "un";
}

// ─── Aplicação no saldo ──────────────────────────────────────────────────────

export const marcadorInventario = (contagemId) => `[inventario:${contagemId}]`;

export function observacaoDoAjuste(contagem, fmtData = (d) => d) {
  const tipo = { inicial: "estoque inicial", intermediaria: "contagem semanal", final: "fechamento", ajuste: "ajuste" }[contagem?.tipo] || "contagem";
  return `Inventário de ${fmtData(contagem?.data_referencia)} (${tipo}) ${marcadorInventario(contagem?.id)}`;
}

/**
 * O que o fechamento grava no saldo: cada produto CONTADO, no local em que foi
 * contado. Não contado não muda (não vira zero). Item sem local não tem onde
 * gravar e é devolvido à parte. quantidade_contada vem na base (g, ml, un).
 */
export function planoDeAplicacao(itens, insumoPorId, daBase) {
  const aplicar = [];
  const semLocal = [];
  for (const i of itens || []) {
    const ins = insumoPorId.get(i.insumo_id);
    if (!i.estoque_id) { semLocal.push({ item_id: i.id, insumo_id: i.insumo_id, nome: ins?.nome || "Produto" }); continue; }
    const qtdCadastro = daBase(i.quantidade_contada, ins?.unidade_medida);
    aplicar.push({
      item_id: i.id, estoque_id: i.estoque_id, insumo_id: i.insumo_id, nome: ins?.nome || "Produto",
      saldo: cadastroParaSaldo(qtdCadastro, ins),
    });
  }
  return { aplicar, semLocal };
}

/** Quais itens do plano ainda não têm o acerto gravado (para reaplicar sem duplicar). */
export function faltandoAplicar(plano, movimentos, contagemId) {
  const marca = marcadorInventario(contagemId);
  const feitos = new Set((movimentos || [])
    .filter((m) => m?.tipo === "contagem" && String(m?.observacao || "").includes(marca))
    .map((m) => `${m.estoque_id}|${m.insumo_id}`));
  return plano.aplicar.filter((p) => !feitos.has(`${p.estoque_id}|${p.insumo_id}`));
}
