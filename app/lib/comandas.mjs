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
  return [...rascunho, { chave: `${produto.id}|${nome}|${obs}`, produto_id: produto.id, nome: produto.nome_produto, valor_unitario: Number(produto.preco_venda) || 0, quantidade: 1, pessoa: nome, observacao: obs }];
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
