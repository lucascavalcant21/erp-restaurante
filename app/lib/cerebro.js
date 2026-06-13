import { UNIDADES } from "./unidades";
import { fetchEstoque } from "./estoque";
import { fetchFuncionarios } from "./rh";
import { fetchCardapio } from "./cardapio";
import { fetchLancamentos } from "./financeiro";
import { fetchProducoes } from "./producao";
import { fetchVendas } from "./vendas";
import { fetchEventos } from "./eventos";

export function fmtPct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

export async function carregarDadosDaUnidade(u) {
  const [est, fun, car, lan, prod, ven, evt] = await Promise.all([
    fetchEstoque(u.id),
    fetchFuncionarios(u.id),
    fetchCardapio(u.id),
    fetchLancamentos(u.id),
    fetchProducoes(u.id, null, 500),
    fetchVendas(u.id),
    fetchEventos(u.id)
  ]);
  
  const estoque = est.data || [];
  const equipe = (fun.data || []).filter((f) => f.ativo !== false && f.status !== "inativo");
  const pratos = (car.data || []).filter((p) => p.ativo !== false);
  const lancamentos = lan.data || [];
  const producoes = prod.data || [];
  const vendas = ven.data || [];
  const eventos = evt.data || [];

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
    lancamentos30: lanc30,
    eventos
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
  const eventos = unidades.flatMap(u => u.eventos || []);
  
  const produtos = {};
  unidades.forEach(u => {
    u.producoes30.forEach(p => {
      if (!produtos[p.prato_nome]) produtos[p.prato_nome] = { nome: p.prato_nome, qtd: 0, lucro: 0 };
      produtos[p.prato_nome].qtd += Number(p.quantidade) || 0;
      produtos[p.prato_nome].lucro += (Number(p.receita_potencial) || 0) - (Number(p.custo_total) || 0);
    });
  });
  const topPratos = Object.values(produtos).sort((a, b) => b.lucro - a.lucro).slice(0, 5);

  return { receita, despesa, lucro, folha, cmo, cmv, criticos, colaboradores, topPratos, eventos };
}

export function gerarInsights(rede, unidades) {
  if (!rede) return [];
  const alertas = [];
  const fmtBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  // 1. Faturamento e Metas
  const metaEstimada = Math.ceil((rede.receita + 1) / 50000) * 50000; 
  const faltaMeta = metaEstimada - rede.receita;
  if (faltaMeta > 0 && faltaMeta < 15000) {
    alertas.push({ id: "meta_quase", tipo: "info", titulo: "Meta de Faturamento Próxima! 🚀", msg: `A rede já faturou ${fmtBRL(rede.receita)}. Faltam apenas ${fmtBRL(faltaMeta)} para atingir o marco de ${fmtBRL(metaEstimada)}! DICA: Faça uma promoção rápida de combos no Delivery para bater a meta hoje.` });
  } else if (rede.receita > 0) {
    alertas.push({ id: "fat_atual", tipo: "sucesso", titulo: "Desempenho de Receita 💰", msg: `Faturamento atual da rede: ${fmtBRL(rede.receita)}. Lucro líquido estimado: ${fmtBRL(rede.lucro)}.` });
  }

  // 2. Dicas para ganhar mais dinheiro (Engenharia de Cardápio)
  if (rede.topPratos.length > 0) {
    const campeao = rede.topPratos[0];
    alertas.push({ id: "dica_combo", tipo: "sucesso", titulo: "Oportunidade: Venda mais! 🤑", msg: `O item "${campeao.nome}" tem margem altíssima (gerou ${fmtBRL(campeao.lucro)} de lucro bruto). DICA: Crie um combo 'Compre e Ganhe' envolvendo este prato para aumentar o seu Ticket Médio da rede.` });
  }

  // 3. Fornecedores e CMV
  if (rede.cmv > 35) {
    alertas.push({ id: "cmv_fornecedor", tipo: "perigo", titulo: "Alerta de Custos e Fornecedores 🚨", msg: `O Custo da Mercadoria (CMV) global está elevado (${fmtPct(rede.cmv)}). DICA: Está na hora de cotar novos fornecedores para os ingredientes mais usados, negociar preços ou reajustar o preço final no cardápio.` });
  } else if (rede.cmv > 0 && rede.cmv <= 28) {
    alertas.push({ id: "cmv_ok", tipo: "sucesso", titulo: "CMV e Fornecedores Saudáveis ✅", msg: `O CMV da rede está impecável (${fmtPct(rede.cmv)}). Os preços negociados com os fornecedores estão acompanhando bem o seu preço de venda.` });
  }

  // 4. Custo de Mão de Obra (CMO)
  if (rede.cmo > 30) {
    alertas.push({ id: "cmo_alto", tipo: "alerta", titulo: "Custo de Folha Elevado 👥", msg: `Sua mão de obra representa ${fmtPct(rede.cmo)} da receita. DICA: Otimize a escala de funcionários nos turnos mais ociosos para evitar ineficiência.` });
  }

  // 5. Ranking de Lojas
  const melhorLoja = unidades.reduce((m, u) => (u.lucro30 > (m?.lucro30 || 0) ? u : m), null);
  const piorLoja = unidades.reduce((m, u) => (u.lucro30 < (m?.lucro30 || Infinity) ? u : m), null);
  
  if (melhorLoja && melhorLoja.lucro30 > 0) {
    alertas.push({ id: "top_loja", tipo: "info", titulo: "Destaque Operacional ⭐", msg: `A unidade "${melhorLoja.nome}" lidera com lucro de ${fmtBRL(melhorLoja.lucro30)}. DICA: Replique os processos dessa unidade para as outras lojas.` });
  }
  
  if (piorLoja && piorLoja.lucro30 < 0) {
    alertas.push({ id: "pior_loja", tipo: "perigo", titulo: `Unidade no Vermelho: ${piorLoja.nome} 📉`, msg: `A unidade teve um déficit estimado de ${fmtBRL(piorLoja.lucro30)}. DICA: Faça uma auditoria nos desperdícios de cozinha do restaurante e corte despesas não essenciais.` });
  }

  // 6. Estoque Crítico
  if (rede.criticos > 0) {
    alertas.push({ id: "est_crit", tipo: "alerta", titulo: "Risco de Ruptura de Estoque 📦", msg: `Existem ${rede.criticos} insumos em níveis críticos na rede. DICA: Faça uma cotação de urgência com seus melhores fornecedores para não perder vendas por falta de ingredientes.` });
  }

  // 7. Eventos Futuros
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const eventosFuturos = (rede.eventos || [])
    .filter(e => new Date(e.data_evento) >= hoje)
    .sort((a, b) => new Date(a.data_evento) - new Date(b.data_evento));

  if (eventosFuturos.length > 0) {
    const prox = eventosFuturos[0];
    const dataFormatada = new Date(prox.data_evento).toLocaleDateString('pt-BR');
    alertas.push({ id: `evento_${prox.id}`, tipo: "info", titulo: `Evento Próximo: ${prox.nome} 📅`, msg: `O evento "${prox.nome}" está marcado para ${dataFormatada}. DICA: Verifique se as bebidas do Bar e as Fichas Técnicas da Cozinha estão preparadas no sistema.` });
  }

  return alertas;
}
