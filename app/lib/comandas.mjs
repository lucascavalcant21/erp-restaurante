// Comanda da mesa (decisões do dono, 06/11/2026): uma conta por mesa, com cada item
// podendo levar o nome de quem pediu. Regras puras, sem banco.

export const MESA_TODA = "Mesa";
const LIMITE_NOME = 40;

export const STATUS_DO_ITEM = {
  pendente: "Na fila",
  preparando: "Preparando",
  em_preparo: "Preparando",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const centavos = (v) => Math.round((Number(v) || 0) * 100);
const valido = (i) => i?.status_kds !== "cancelado";

export const totalDoItem = (i) => (centavos(i?.valor_unitario) * (Number(i?.quantidade) || 0)) / 100;

/** Consumo da comanda, sem os 10%: quem aplica taxa e desconto é o caixa. */
export const totalDaComanda = (itens = []) => itens.filter(valido).reduce((t, i) => t + centavos(totalDoItem(i)), 0) / 100;

export function limparNome(nome) {
  return String(nome || "").replace(/\s+/g, " ").trim().slice(0, LIMITE_NOME);
}

/** Pessoas da mesa, na ordem em que apareceram; o que não tem nome é da mesa toda. */
export function pessoasDaComanda(itens = [], extras = []) {
  const vistos = new Map();
  for (const nome of [...itens.map((i) => i?.pessoa), ...extras]) {
    const limpo = limparNome(nome);
    if (limpo && limpo !== MESA_TODA && !vistos.has(limpo.toLowerCase())) vistos.set(limpo.toLowerCase(), limpo);
  }
  return [...vistos.values()];
}

/** Quanto cada pessoa consumiu. A linha "Mesa" fica por último, para dividir entre todos. */
export function resumoPorPessoa(itens = []) {
  const grupos = new Map();
  for (const i of itens.filter(valido)) {
    const pessoa = limparNome(i.pessoa) || MESA_TODA;
    const chave = pessoa.toLowerCase();
    if (!grupos.has(chave)) grupos.set(chave, { pessoa, total: 0, itens: 0 });
    const g = grupos.get(chave);
    g.total = (centavos(g.total) + centavos(totalDoItem(i))) / 100;
    g.itens += Number(i.quantidade) || 0;
  }
  return [...grupos.values()].sort((a, b) => (a.pessoa === MESA_TODA) - (b.pessoa === MESA_TODA));
}

/** Soma no rascunho; mesmo produto, pessoa e observação viram uma linha só. */
export function somarAoRascunho(rascunho = [], produto, pessoa = "", observacao = "") {
  const nome = limparNome(pessoa);
  const obs = String(observacao || "").trim();
  const achou = rascunho.find((l) => l.produto_id === produto.id && l.pessoa === nome && l.observacao === obs);
  if (achou) return rascunho.map((l) => (l === achou ? { ...l, quantidade: l.quantidade + 1 } : l));
  // departamento e categoria: decidem as observações prontas da linha (07/11/2026).
  return [...rascunho, { chave: `${produto.id}|${nome}|${obs}`, produto_id: produto.id, nome: produto.nome_produto, valor_unitario: Number(produto.preco_venda) || 0, quantidade: 1, pessoa: nome, observacao: obs, departamento: produto.departamento || null, categoria: produto.categoria || null }];
}

export function mudarQuantidade(rascunho = [], chave, delta) {
  return rascunho.map((l) => (l.chave === chave ? { ...l, quantidade: l.quantidade + delta } : l)).filter((l) => l.quantidade > 0);
}

/** Observação fica na linha: outra quantidade do mesmo prato pode vir sem ela. */
export function definirObservacao(rascunho = [], chave, observacao) {
  return rascunho.map((l) => (l.chave === chave ? { ...l, observacao: String(observacao || "").slice(0, 120) } : l));
}

/** Linhas gravadas no banco a partir do rascunho. Produto sem preço não sai para a cozinha. */
export function itensParaEnviar(pedidoId, rascunho = []) {
  const semPreco = rascunho.find((l) => !(Number(l.valor_unitario) > 0));
  if (semPreco) return { erro: `${semPreco.nome} está sem preço. Avise o caixa.`, linhas: [] };
  return {
    erro: null,
    linhas: rascunho.map((l) => ({
      pedido_id: pedidoId, produto_id: l.produto_id, quantidade: l.quantidade, valor_unitario: l.valor_unitario,
      observacao: String(l.observacao || "").trim() || null, pessoa: l.pessoa || null, status_kds: "pendente",
    })),
  };
}

export function estadoDaMesa(mesa, pedido, agora = Date.now()) {
  if (!pedido) return { id: "livre", rotulo: "Livre" };
  const horas = (agora - new Date(pedido.created_at).getTime()) / 3600000;
  if (mesa?.status === "fechando") return { id: "conta", rotulo: "Conta pedida" };
  return { id: "ocupada", rotulo: horas >= 24 ? `Aberta há ${Math.floor(horas / 24)} ${horas < 48 ? "dia" : "dias"}` : "Ocupada", antiga: horas >= 24 };
}

export function tempoDaMesa(desde, agora = Date.now()) {
  const min = Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
  return `${Math.floor(min / 1440)}d`;
}

export function numeroDaMesa(mesa) {
  return String(mesa?.numero_mesa || mesa?.numero || "").replace(/^mesa\s*/i, "");
}

export function ordenarMesas(mesas = []) {
  return [...mesas].sort((a, b) => numeroDaMesa(a).localeCompare(numeroDaMesa(b), "pt-BR", { numeric: true }));
}

/* ── Venda no balcão pelo mesmo fechamento da comanda (07/11/2026) ─────────
   O balcão (e as abas iFood e Cardápio digital do caixa) cria o pedido aberto,
   grava os itens e fecha pelo comanda_fechar: entra no caixa, no faturamento do
   dia e nas contas a receber, baixa pela ficha e pode ser cancelada. */

const c2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const ORIGENS_BALCAO = { balcao: "Balcão", ifood: "iFood", cardapio: "Cardápio digital" };

/**
 * Monta itens, totais e pagamentos como o banco vai conferir: cada item
 * arredondado, desconto e acréscimo em centavos. Diferença de até 5 centavos
 * nos pagamentos (desconto em %, troco) vai para o último pagamento; mais que
 * isso é erro de valor e volta para o caixa corrigir.
 */
export function planoDoBalcao({ itens = [], pagamentos = [], desconto = 0, acrescimo = 0 } = {}) {
  const linhas = (itens || []).filter((it) => it?.id && Number(it.quantidade) > 0).map((it) => {
    const mods = it.modsSelecionados || [];
    const unit = c2(Number(it.preco_venda ?? it.preco ?? 0) + mods.reduce((t, m) => t + Number(m.preco || 0), 0));
    const extras = mods.map((m) => `+${m.nome}`).join(", ");
    const obs = [String(it.observacao || "").trim(), extras && (it.observacao ? `(${extras})` : extras)].filter(Boolean).join(" ");
    return { produto_id: it.id, quantidade: Number(it.quantidade), valor_unitario: unit, observacao: obs || null,
      status_kds: String(it.departamento || "").toLowerCase().includes("cozinha") ? "pendente" : "entregue" };
  });
  if (!linhas.length) return { erro: "Adicione itens à venda." };
  const subtotal = c2(linhas.reduce((t, l) => t + c2(l.quantidade * l.valor_unitario), 0));
  if (!(subtotal > 0)) return { erro: "A venda está sem valor." };
  const desc = Math.min(Math.max(c2(desconto), 0), subtotal);
  const acr = Math.max(c2(acrescimo), 0);
  const total = c2(subtotal - desc + acr);
  const pags = (pagamentos || []).map((p) => ({ forma: p.forma === "vr" ? "voucher" : p.forma, valor: c2(p.valor) })).filter((p) => p.valor > 0);
  if (!pags.length) return { erro: "Informe o pagamento." };
  const diferenca = c2(total - pags.reduce((t, p) => t + p.valor, 0));
  if (Math.abs(diferenca) > 0.05) return { erro: `Pagamentos somam ${pags.reduce((t, p) => t + p.valor, 0).toFixed(2)} e a venda é ${total.toFixed(2)}.` };
  if (diferenca !== 0) {
    const ultimo = pags[pags.length - 1];
    ultimo.valor = c2(ultimo.valor + diferenca);
    if (!(ultimo.valor > 0)) return { erro: "Confira os valores dos pagamentos." };
  }
  return { linhas, subtotal, desconto: desc, acrescimo: acr, total, pagamentos: pags };
}
