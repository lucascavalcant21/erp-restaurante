import { UNIDADES } from "./unidades";
import { fetchEstoque } from "./estoque";
import { fetchFuncionarios } from "./rh";
import { fetchCardapio } from "./cardapio";
import { fetchLancamentos } from "./financeiro";
import { fetchProducoes } from "./producao";
import { fetchVendas } from "./vendas";

export function fmtPct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

export async function carregarDadosDaUnidade(u) {
  const [est, fun, car, lan, prod, ven] = await Promise.all([
    fetchEstoque(u.id),
    fetchFuncionarios(u.id),
    fetchCardapio(u.id),
    fetchLancamentos(u.id),
    fetchProducoes(u.id, null, 500),
    fetchVendas(u.id)
  ]);
  
  const estoque = est.data || [];
  const equipe = (fun.data || []).filter((f) => f.ativo !== false && f.status !== "inativo");
  const pratos = (car.data || []).filter((p) => p.ativo !== false);
  const lancamentos = lan.data || [];
  const producoes = prod.data || [];
  const vendas = ven.data || [];

  const now = Date.now(), d30 = 30 * 86400000;
  const lanc30 = lancamentos.filter((l) => new Date(l.data).getTime() >= now - d30);
  const receita30 = lanc30.filter(l => l.tipo === "entrada").reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const despesa30 = lanc30.filter(l => l.tipo === "saida").reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const lucro30 = receita30 - despesa30;

  const folha = equipe.reduce((a, f) => a + (Number(f.salario) || 0), 0);
  const cmo = receita30 > 0 ? (folha / receita30) * 100 : 0;

  const prod30 = producoes.filter((p) => new Date(p.created_at).getTime() >= now - d30);
  const custoProduzido = prod30.reduce((a, p) => a + (Number(p.custo_total) || 0), 0);
  const receitaProduzida = prod30.reduce((a, p) => a + (Number(p.receita_potencial) || 0), 0);
  const cmvProducao = receitaProduzida > 0 ? (custoProduzido / receitaProduzida) * 100 : null;

  const cmvsPratos = pratos.filter((p) => (Number(p.preco) || 0) > 0).map((p) => ((Number(p.custo) || 0) / Number(p.preco)) * 100);
  const cmvMedio = cmvsPratos.length ? cmvsPratos.reduce((a, b) => a + b, 0) / cmvsPratos.length : 0;

  const cmvFinal = cmvProducao !== null ? cmvProducao : cmvMedio;
  const criticos = estoque.filter((i) => (i.quantidade ?? 0) <= (i.minimo ?? 0)).length;

  return {
    ...u,
    receita30,
    despesa30,
    lucro30,
    folha,
    cmo,
    cmv: cmvFinal,
    criticos,
    equipe: equipe.length,
    vendas30: vendas.filter(v => new Date(v.created_at).getTime() >= now - d30),
    producoes30: prod30,
    lancamentos30: lanc30
  };
}

export function consolidarRede(unidades) {
  if (!unidades.length) return null;
  const receita = unidades.reduce((a, u) => a + u.receita30, 0);
  const despesa = unidades.reduce((a, u) => a + u.despesa30, 0);
  const lucro = receita - despesa;
  const folha = unidades.reduce((a, u) => a + u.folha, 0);
  const cmo = receita > 0 ? (folha / receita) * 100 : 0;
  const cmvsValidos = unidades.filter(u => u.cmv > 0);
  const cmv = cmvsValidos.length ? cmvsValidos.reduce((a, u) => a + u.cmv, 0) / cmvsValidos.length : 0;
  const criticos = unidades.reduce((a, u) => a + u.criticos, 0);
  const colaboradores = unidades.reduce((a, u) => a + u.equipe, 0);
  
  const produtos = {};
  unidades.forEach(u => {
    u.producoes30.forEach(p => {
      if (!produtos[p.prato_nome]) produtos[p.prato_nome] = { nome: p.prato_nome, qtd: 0, lucro: 0 };
      produtos[p.prato_nome].qtd += Number(p.quantidade) || 0;
      produtos[p.prato_nome].lucro += (Number(p.receita_potencial) || 0) - (Number(p.custo_total) || 0);
    });
  });
  const topPratos = Object.values(produtos).sort((a, b) => b.lucro - a.lucro).slice(0, 5);

  return { receita, despesa, lucro, folha, cmo, cmv, criticos, colaboradores, topPratos };
}

export function gerarInsights(rede, unidades) {
  if (!rede) return [];
  const alertas = [];

  const fmtBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  if (rede.cmo > 30) {
    alertas.push({ id: "cmo_alto", tipo: "perigo", titulo: "Atenção ao CMO Global", msg: `O Custo de Mão de Obra (CMO) da rede está muito alto (${fmtPct(rede.cmo)}). O ideal para restaurantes é abaixo de 25%.` });
  } else if (rede.cmo > 0 && rede.cmo < 20) {
    alertas.push({ id: "cmo_ok", tipo: "sucesso", titulo: "CMO Excelente", msg: `O Custo de Mão de Obra (CMO) da rede está excelente (${fmtPct(rede.cmo)}). Equipe altamente produtiva.` });
  }
  unidades.forEach(u => {
    if (u.cmo > 35) alertas.push({ id: `cmo_crit_${u.id}`, tipo: "alerta", titulo: `CMO Crítico - ${u.nome}`, msg: `Atenção à loja ${u.nome}: CMO crítico de ${fmtPct(u.cmo)}. Receita não está pagando a folha adequadamente.` });
  });

  if (rede.cmv > 35) {
    alertas.push({ id: "cmv_alto", tipo: "perigo", titulo: "Atenção ao CMV Global", msg: `O Custo da Mercadoria Vendida (CMV) da rede está em ${fmtPct(rede.cmv)}. Fique de olho no desperdício ou ajuste os preços de venda.` });
  } else if (rede.cmv > 0 && rede.cmv <= 28) {
    alertas.push({ id: "cmv_ok", tipo: "sucesso", titulo: "CMV Saudável", msg: `CMV da rede muito saudável (${fmtPct(rede.cmv)}). Boa precificação e controle de estoque.` });
  }
  unidades.forEach(u => {
    if (u.cmv > 40) alertas.push({ id: `cmv_crit_${u.id}`, tipo: "alerta", titulo: `CMV Crítico - ${u.nome}`, msg: `Unidade ${u.nome} com CMV crítico de ${fmtPct(u.cmv)}. Verifique as fichas técnicas e desperdícios urgentes.` });
  });

  const melhorLoja = unidades.reduce((m, u) => (u.lucro30 > (m?.lucro30 || 0) ? u : m), null);
  if (melhorLoja && melhorLoja.lucro30 > 0) {
    alertas.push({ id: "top_loja", tipo: "info", titulo: "Loja Destaque", msg: `A unidade ${melhorLoja.nome} é o destaque do mês, puxando o lucro da rede com ${fmtBRL(melhorLoja.lucro30)}.` });
  }

  if (rede.topPratos.length > 0) {
    alertas.push({ id: "top_prato", tipo: "info", titulo: "Produto Estrela", msg: `O prato "${rede.topPratos[0].nome}" é sua estrela! Ele gerou ${fmtBRL(rede.topPratos[0].lucro)} de lucro bruto estimado na produção.` });
  }

  if (rede.criticos > 0) {
    alertas.push({ id: "est_crit", tipo: "alerta", titulo: "Ruptura de Estoque Iminente", msg: `Existem ${rede.criticos} itens em estoque crítico na rede. Evite ruptura de vendas repondo os insumos.` });
  }

  return alertas;
}
