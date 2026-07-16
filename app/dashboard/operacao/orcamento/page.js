"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas, fetchInsumos } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchOrcamentosEventos, salvarOrcamentoEvento, removerOrcamentoEvento } from "../../../lib/orcamentos";
import { fetchEmbalagens } from "../../../lib/embalagens";
import { PartyPopper, Printer, Trash2, ArrowLeft, Users, ShoppingCart, FileText, Save, History, X, Loader2, ChefHat, ClipboardList, Image as ImageIcon, GripVertical } from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { quantidadeVendaDaFicha, custoEmbalagensDoProduto } from "../../../lib/custos-receita";

// Fator "in natura" de uma ficha: quanto o preço deve subir para cobrar o item
// como se o ingrediente fosse in natura (sem empanar). Ex.: peixe que rende 1,36x
// ao empanar → cobrar +36% (o cliente paga como peixe puro, você ganha na margem).
// Pega o MAIOR fator de empanamento entre os insumos da ficha (desce nas bases).
function fatorInNaturaDaFicha(f, todasFichas, mapaFatores, guard = new Set()) {
  if (!f || guard.has(f.id)) return 1;
  guard.add(f.id);
  let maior = 1;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      const fator = Number(mapaFatores[fi.insumos.id]) || 1;
      if (fator > maior) maior = fator;
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const f2 = base ? fatorInNaturaDaFicha(base, todasFichas, mapaFatores, guard) : 1;
      if (f2 > maior) maior = f2;
    }
  });
  return maior;
}

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  const caminho = new Set(guard);
  caminho.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, caminho) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
    }
  });
  return total;
}

// Acumula os insumos CRUS necessários para produzir `porcoes` porções de uma ficha,
// descendo recursivamente nas bases/sub-receitas até chegar nos ingredientes brutos.
function acumularInsumos(ficha, porcoes, todasFichas, acc, guard = new Set()) {
  if (!ficha || guard.has(ficha.id)) return;
  guard.add(ficha.id);
  const rend = ficha.rendimento_porcoes || 1;
  (ficha.fichas_ingredientes || []).forEach(fi => {
    const qtdTotal = ((fi.quantidade || 0) / rend) * porcoes;
    if (fi.insumos) {
      const key = fi.insumos.id;
      if (!acc[key]) acc[key] = { nome: fi.insumos.nome, unidade: fi.insumos.unidade_medida, custo_unitario: fi.insumos.custo_unitario || 0, qtd: 0 };
      acc[key].qtd += qtdTotal;
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      if (base) acumularInsumos(base, qtdTotal, todasFichas, acc, guard);
    }
  });
  guard.delete(ficha.id);
}

// Nº real de porções: direto (porções/un) ou derivado do peso total quando
// o rendimento é em kg/g/l/ml (peso total ÷ peso da porção).
function porcoesDaFicha(f) {
  return quantidadeVendaDaFicha(f) || 1;
}

// Formata quantidade de compra: kg/l pequenos viram g/ml; un arredonda pra cima
function fmtCompra(qtd, unidade) {
  const u = String(unidade || "").toLowerCase();
  if (u === "kg") return qtd < 1 ? `${Math.ceil(qtd * 1000)} g` : `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} kg`;
  if (u === "l") return qtd < 1 ? `${Math.ceil(qtd * 1000)} ml` : `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} L`;
  return `${Math.ceil(qtd)} un`;
}

// Comprime uma foto para base64 leve (máx ~520px) — guardada no rascunho local
function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 520;
        let { width, height } = img;
        if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const DRAFT_KEY = "orcamento_evento_draft";
const EVENTO_VAZIO = { nome: "", cliente: "", data: "", hora: "", utensilios: "", convidados: "", comissao_pct: "", parceria_bar_ativa: false, parceria_bar_pct: "30", valor_final_venda: "", preco_pessoa: "" };
const novoId = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));
const novaProposta = (nome) => ({ id: novoId(), nome, evento: { ...EVENTO_VAZIO }, itens: [], extras: [] });

// Serviços/custos extras do evento além do buffet (aparecem no descritivo)
const EXTRAS_SUGERIDOS = ["Funcionários / Garçons", "Cantor / Banda", "Dança / Show", "Luz e Energia", "Aluguel do Espaço", "Decoração", "Limpeza"];

export default function OrcamentoEventoPage() {
  const { abrirMenu, unidadeAtiva, unidadeInfo } = useERP();

  const [produtos, setProdutos] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [embalagens, setEmbalagens] = useState([]);
  const [mapaFatores, setMapaFatores] = useState({}); // insumo_id -> fator_empanamento
  const [loading, setLoading] = useState(true);
  const [modoSaida, setModoSaida] = useState("imprimir"); // 'imprimir' | 'pdf'

  // Várias propostas por evento (ex.: R$60/pessoa, R$90/pessoa). Cada uma tem
  // seu próprio evento + itens. `ativaId` diz qual está sendo editada.
  const [propostas, setPropostas] = useState(() => [novaProposta("Proposta 1")]);
  const [ativaId, setAtivaId] = useState(null);

  const ativa = propostas.find(p => p.id === ativaId) || propostas[0];
  const evento = ativa.evento;
  const itens = ativa.itens;
  const setEvento = (u) => setPropostas(ps => ps.map(p => p.id === ativa.id ? { ...p, evento: typeof u === "function" ? u(p.evento) : u } : p));
  const setItens = (u) => setPropostas(ps => ps.map(p => p.id === ativa.id ? { ...p, itens: typeof u === "function" ? u(p.itens) : u } : p));
  const extras = ativa.extras || [];
  const setExtras = (u) => setPropostas(ps => ps.map(p => p.id === ativa.id ? { ...p, extras: typeof u === "function" ? u(p.extras || []) : u } : p));

  useEffect(() => {
    if (!unidadeAtiva) return;
    (async () => {
      setLoading(true);
      const [resProd, resFichas, resInsumos, resEmbalagens] = await Promise.all([
        fetchProdutos(unidadeAtiva),
        fetchFichas(unidadeAtiva),
        fetchInsumos(unidadeAtiva),
        fetchEmbalagens(unidadeAtiva),
      ]);
      setProdutos(resProd.data || []);
      setFichas(resFichas.data || []);
      setEmbalagens(resEmbalagens.data || []);
      const mapa = {};
      (resInsumos.data || []).forEach(i => {
        const fator = Number(i.fator_empanamento) || 0;
        if (i.eh_empanado && fator > 1) mapa[i.id] = fator;
      });
      setMapaFatores(mapa);
      setLoading(false);
    })();
  }, [unidadeAtiva]);

  // Rascunho no navegador: não perde as propostas se der refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.propostas) && d.propostas.length) {
          setPropostas(d.propostas);
          setAtivaId(d.ativaId && d.propostas.find(p => p.id === d.ativaId) ? d.ativaId : d.propostas[0].id);
        } else if (d.evento) { // migra rascunho antigo (uma proposta só)
          const p = { ...novaProposta("Proposta 1"), evento: { ...EVENTO_VAZIO, ...d.evento }, itens: Array.isArray(d.itens) ? d.itens : [] };
          setPropostas([p]); setAtivaId(p.id);
        }
      }
    } catch { /* rascunho corrompido: ignora */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ propostas, ativaId: ativa.id })); } catch { }
  }, [propostas, ativaId]);

  // ── Gestão de propostas ──────────────────────────────────────────────────
  const addProposta = () => {
    const p = novaProposta(`Proposta ${propostas.length + 1}`);
    setPropostas(ps => [...ps, p]); setAtivaId(p.id);
  };
  const duplicarProposta = () => {
    const p = { ...ativa, id: novoId(), nome: `${ativa.nome} (cópia)`, evento: { ...ativa.evento }, itens: ativa.itens.map(i => ({ ...i })) };
    setPropostas(ps => [...ps, p]); setAtivaId(p.id);
  };
  const renomearProposta = () => {
    const nome = prompt("Nome da proposta:", ativa.nome);
    if (nome && nome.trim()) setPropostas(ps => ps.map(p => p.id === ativa.id ? { ...p, nome: nome.trim() } : p));
  };
  const removerProposta = () => {
    if (propostas.length <= 1) return alert("Deve haver ao menos uma proposta.");
    if (!confirm(`Remover "${ativa.nome}"?`)) return;
    setPropostas(ps => { const rest = ps.filter(p => p.id !== ativa.id); setAtivaId(rest[0].id); return rest; });
  };

  // ── Salvar evento + histórico (banco) ────────────────────────────────────
  const [orcamentoId, setOrcamentoId] = useState(null); // id do evento carregado (null = novo)
  const [dragItemId, setDragItemId] = useState(null);    // arrastar prato para reordenar
  const [salvando, setSalvando] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  const salvarEvento = async () => {
    const nomeEvento = (evento.nome || "").trim();
    if (!nomeEvento) return alert("Dê um nome ao evento antes de salvar.");
    setSalvando(true);
    const { data, error } = await salvarOrcamentoEvento({
      id: orcamentoId,
      unidade_id: unidadeAtiva,
      nome: nomeEvento,
      cliente: evento.cliente || null,
      data_evento: evento.data || null,
      convidados: Number(evento.convidados) || null,
      dados: { propostas, ativaId: ativa.id },
    });
    setSalvando(false);
    if (error) return alert("Erro ao salvar o evento: " + error);
    setOrcamentoId(data.id);
    alert(`Evento "${nomeEvento}" salvo no histórico!`);
  };

  const abrirHistorico = async () => {
    setModalHistorico(true);
    setHistoricoLoading(true);
    const { data, error } = await fetchOrcamentosEventos(unidadeAtiva);
    setHistoricoLoading(false);
    if (error) { alert("Erro ao carregar o histórico: " + error); return; }
    setHistorico(data);
  };

  const carregarDoHistorico = (item) => {
    const d = item.dados || {};
    if (!Array.isArray(d.propostas) || !d.propostas.length) return alert("Este evento salvo está sem dados.");
    setPropostas(d.propostas);
    setAtivaId(d.propostas.find(p => p.id === d.ativaId) ? d.ativaId : d.propostas[0].id);
    setOrcamentoId(item.id);
    setModalHistorico(false);
  };

  const excluirDoHistorico = async (item) => {
    if (!confirm(`Excluir "${item.nome}" do histórico?`)) return;
    const { error } = await removerOrcamentoEvento(item.id);
    if (error) return alert("Erro ao excluir: " + error);
    setHistorico(h => h.filter(x => x.id !== item.id));
    if (orcamentoId === item.id) setOrcamentoId(null);
  };

  const novoEvento = () => {
    if (!confirm("Começar um evento novo? (o atual continua no histórico se você salvou)")) return;
    const p = novaProposta("Proposta 1");
    setPropostas([p]);
    setAtivaId(p.id);
    setOrcamentoId(null);
  };

  const convidados = Number(evento.convidados) || 0;

  // Calcula a soma base para saber o multiplicador
  const somaBase = itens.reduce((a, it) => {
    const produto = produtos.find(p => p.id === it.produto_id);
    if (!produto) return a;
    const comps = (Array.isArray(produto.composicao) && produto.composicao.length) ? produto.composicao : (produto.ficha_id ? [{ ficha_id: produto.ficha_id, qtd: 1 }] : []);
    const fichasComp = comps.map(c => ({ ficha: fichas.find(f => f.id === c.ficha_id), qtd: Number(c.qtd) || 1 })).filter(x => x.ficha);
    const qtd = Number(String(it.qtd).replace(',', '.')) || 0;
    const pesoUnFicha = fichasComp.reduce((acc, x) => acc + (Number(x.ficha.peso_porcao_g) || 0) * x.qtd, 0);
    const pesoUn = Number(it.pesoUn) || pesoUnFicha || 0;
    const porcoes = convidados > 0 ? qtd * convidados : qtd;
    const precoKgCardapio = pesoUn > 0 ? (Number(produto.preco_venda)||0) * (1000/pesoUn) : (Number(produto.preco_venda)||0);
    const precoKg = it.precoKg !== undefined && it.precoKg !== "" ? Number(it.precoKg) || 0 : precoKgCardapio;
    const precoVenda = pesoUn > 0 ? precoKg * (pesoUn / 1000) : (Number(produto.preco_venda)||0);
    const fator = fichasComp.reduce((m, x) => Math.max(m, fatorInNaturaDaFicha(x.ficha, fichas, mapaFatores)), 1);
    const precoEfBase = (!!it.inNatura && fator > 1) ? precoVenda * fator : precoVenda;
    return a + (precoEfBase * porcoes);
  }, 0);
  // Valor desejado: o R$/pessoa que o cliente vai pagar tem prioridade
  // (× convidados = total); senão vale o total digitado. O multiplicador
  // redistribui esse valor pelos itens proporcionalmente.
  const precoPessoaDesejado = Number(evento.preco_pessoa) || 0;
  const valorDesejado = (precoPessoaDesejado > 0 && convidados > 0)
    ? precoPessoaDesejado * convidados
    : (Number(evento.valor_final_venda) || 0);
  const multiplicadorMargem = (valorDesejado > 0 && somaBase > 0) ? (valorDesejado / somaBase) : 1;

  // Linhas calculadas: produto + ficha + custos + venda.
  // O fluxo principal é por R$/kg: o usuário define porção (g) e preço/kg,
  // e o sistema calcula automaticamente o R$/pessoa.
  const linhas = itens.map(it => {
    const produto = produtos.find(p => p.id === it.produto_id);
    if (!produto) return null;
    // Componentes do prato: composição múltipla ou ficha única (produtos antigos)
    const componentes = (Array.isArray(produto.composicao) && produto.composicao.length)
      ? produto.composicao
      : (produto.ficha_id ? [{ ficha_id: produto.ficha_id, qtd: 1 }] : []);
    const fichasComp = componentes
      .map(c => ({ ficha: fichas.find(f => f.id === c.ficha_id), qtd: Number(c.qtd) || 1 }))
      .filter(x => x.ficha);
    const ficha = fichasComp[0]?.ficha || null;
    const qtdRaw = it.qtd;
    const qtd = Number(String(it.qtd).replace(',', '.')) || 0;
    const un = it.un || "porcao";
    // Peso da porção do PRATO = soma dos componentes (editável por item)
    const pesoUnFicha = fichasComp.reduce((a, x) => a + (Number(x.ficha.peso_porcao_g) || 0) * x.qtd, 0);
    const pesoUn = Number(it.pesoUn) || pesoUnFicha || 0; // g por porção/unidade

    // A quantidade digitada agora representa "porções por pessoa"
    let porcoesPorPessoa = qtd;
    let porcoes = convidados > 0 ? porcoesPorPessoa * convidados : porcoesPorPessoa;

    const gramasTotal = pesoUn > 0 ? porcoes * pesoUn : null;
    // Custo por porção do prato = soma dos componentes
    const custoPorcao = fichasComp.reduce((a, x) => a + (custoTotalDaFicha(x.ficha, fichas) / porcoesDaFicha(x.ficha)) * x.qtd, 0)
      + custoEmbalagensDoProduto(produto, embalagens);
    const custoKg = pesoUn > 0 ? custoPorcao * (1000 / pesoUn) : 0;

    // Preço por KG: input principal. Se o user definiu precoKg, usa ele.
    // Senão, calcula a partir do precoVenda do cardápio.
    const precoCardapio = Number(produto.preco_venda) || 0;
    const precoKgCardapio = pesoUn > 0 ? precoCardapio * (1000 / pesoUn) : precoCardapio;
    const precoKg = it.precoKg !== undefined && it.precoKg !== ""
      ? Number(it.precoKg) || 0
      : precoKgCardapio;
    const precoKgEditado = Math.abs(precoKg - precoKgCardapio) > 0.01;

    // Preço de venda por porção (derivado do kg)
    const precoVenda = pesoUn > 0 ? precoKg * (pesoUn / 1000) : precoCardapio;

    // Empanamento / in natura: maior fator entre os componentes
    const fatorInNatura = fichasComp.reduce((m, x) => Math.max(m, fatorInNaturaDaFicha(x.ficha, fichas, mapaFatores)), 1);
    const inNatura = !!it.inNatura && fatorInNatura > 1;
    
    const precoEfetivoBase = inNatura ? precoVenda * fatorInNatura : precoVenda;
    const precoKgEfetivoBase = inNatura ? precoKg * fatorInNatura : precoKg;

    const precoEfetivo = precoEfetivoBase * multiplicadorMargem;
    const precoKgEfetivo = precoKgEfetivoBase * multiplicadorMargem;

    const vendaTotal = precoEfetivo * porcoes;
    // R$ por pessoa para este item
    const precoPorPessoa = convidados > 0 ? vendaTotal / convidados : (pesoUn > 0 ? precoKgEfetivo * (pesoUn / 1000) : precoEfetivo);
    const kgTotal = gramasTotal ? gramasTotal / 1000 : null;

    return {
      produto_id: it.produto_id,
      nome: produto.nome_produto,
      categoria: produto.categoria,
      departamento: produto.departamento,
      ficha,
      fichasComp,
      qtd,
      qtdRaw,
      un,
      pesoUn,
      porcoes,
      gramasTotal,
      kgTotal,
      unPorKg: pesoUn > 0 ? 1000 / pesoUn : null,
      vendaPorKg: pesoUn > 0 ? precoKgEfetivo : null,
      custoKg,
      custoPorcao,
      custoTotal: custoPorcao * porcoes,
      precoKg,
      precoKgCardapio,
      precoKgEditado,
      precoVenda,
      precoCardapio,
      precoEditado: precoKgEditado,
      fatorInNatura,
      inNatura,
      precoEfetivo,
      precoKgEfetivo,
      precoPorPessoa,
      vendaTotal,
      ganhoInNatura: inNatura ? (precoEfetivo - precoVenda) * porcoes : 0,
      economiaEmpanado: fatorInNatura > 1 ? (custoPorcao * porcoes) * (1 - 1 / fatorInNatura) : 0,
    };
  }).filter(Boolean);

  const custoEvento = linhas.reduce((a, l) => a + l.custoTotal, 0);
  // Com valor desejado definido, o faturamento É esse valor (mesmo que algum
  // item esteja sem preço no cardápio); senão, soma dos itens.
  const vendaEvento = valorDesejado > 0 ? valorDesejado : linhas.reduce((a, l) => a + l.vendaTotal, 0);
  const vendaPorConvidado = convidados > 0 ? vendaEvento / convidados : null;
  const custoPorConvidado = convidados > 0 ? custoEvento / convidados : null;

  // Benefícios do empanado
  const ganhoInNaturaTotal = linhas.reduce((a, l) => a + l.ganhoInNatura, 0);
  const economiaEmpanadoTotal = linhas.reduce((a, l) => a + l.economiaEmpanado, 0);

  // Vendas do bar (parceria) e comissão
  const vendaBar = linhas.filter(l => String(l.departamento).toLowerCase() === "bar").reduce((a, l) => a + l.vendaTotal, 0);
  const parceriaBarPct = evento.parceria_bar_ativa ? (Number(evento.parceria_bar_pct) || 0) : 0;
  const parceriaBar = vendaBar * (parceriaBarPct / 100);
  // Extras (funcionários, música, energia, espaço...): o que você cobra do
  // cliente e o que te custa — entram no descritivo e no lucro
  const vendaExtras = extras.reduce((a, x) => a + (Number(x.valor_cobrado) || 0), 0);
  const custoExtras = extras.reduce((a, x) => a + (Number(x.custo) || 0), 0);
  const totalCliente = vendaEvento + vendaExtras;

  const comissaoPct = Number(evento.comissao_pct) || 0;
  const comissao = totalCliente * (comissaoPct / 100);
  const lucroEvento = totalCliente - custoEvento - custoExtras - comissao - parceriaBar;

  // Lista de compras: agrega os insumos crus de TODOS os componentes do evento
  const compras = (() => {
    const acc = {};
    linhas.forEach(l => {
      if (l.porcoes > 0) (l.fichasComp || []).forEach(x => acumularInsumos(x.ficha, l.porcoes * x.qtd, fichas, acc));
    });
    return Object.values(acc)
      .map(c => ({ ...c, custoCompra: c.qtd * c.custo_unitario }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  })();
  const totalCompras = compras.reduce((a, c) => a + c.custoCompra, 0);

  const addItem = (produtoId) => {
    if (!produtoId || itens.find(i => i.produto_id === produtoId)) return;
    // Default: 1 porção por convidado; pesoUn e preço são derivados dos
    // componentes no cálculo das linhas (não precisa pré-preencher aqui)
    setItens([...itens, { produto_id: produtoId, qtd: 1, un: "porcao" }]);
  };
  const updateItem = (produtoId, patch) => setItens(lista => lista.map(i => i.produto_id === produtoId ? { ...i, ...patch } : i));
  const removeItem = (produtoId) => setItens(lista => lista.filter(i => i.produto_id !== produtoId));

  // Arrastar para reordenar os pratos do buffet
  const reordenarItens = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setItens(lista => {
      const arr = [...lista];
      const from = arr.findIndex(i => i.produto_id === fromId);
      const to = arr.findIndex(i => i.produto_id === toId);
      if (from < 0 || to < 0) return lista;
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return arr;
    });
    setDragItemId(null);
  };

  // Planejar por KG: usuário digita o total em kg e o sistema converte em
  // porções por convidado (mantém o cálculo de custo/venda consistente).
  const setTotalKg = (l, kgStr) => {
    const kg = Number(String(kgStr).replace(',', '.')) || 0;
    if (!(l.pesoUn > 0)) return; // precisa da porção em gramas
    const porcoesTotais = (kg * 1000) / l.pesoUn;
    const qtdPorPessoa = convidados > 0 ? porcoesTotais / convidados : porcoesTotais;
    updateItem(l.produto_id, { qtd: String(+qtdPorPessoa.toFixed(4)) });
  };
  const limparTudo = () => {
    if (confirm("Limpar todo o orçamento?")) { setEvento({ ...EVENTO_VAZIO }); setItens([]); }
  };

  const cabecalhoDoc = (titulo) => `
     <div class="head">
        <div class="tag">${titulo} — ${unidadeInfo?.nome || ''}</div>
        <h1>${evento.nome || 'Evento'}</h1>
        <div class="meta" style="margin-bottom: 8px;">
           ${evento.cliente ? `Cliente: <b>${evento.cliente}</b> · ` : ''}
           ${evento.data ? `Data: <b>${evento.data.split('-').reverse().join('/')}</b> · ` : ''}
           Convidados: <b>${convidados || '—'}</b>
        </div>
        ${(unidadeInfo?.cnpj || unidadeInfo?.endereco || unidadeInfo?.cidade) ? `
        <div class="meta" style="font-size: 11px; color: #64748b; padding-top: 6px; border-top: 1px dashed #cbd5e1; margin-top: 6px;">
           <b>Prestador de Serviço:</b> ${unidadeInfo?.nome || ''}
           ${unidadeInfo?.cnpj ? ` · CNPJ: ${unidadeInfo.cnpj}` : ''}
           ${unidadeInfo?.endereco ? ` · Endereço: ${unidadeInfo.endereco}` : ''}
           ${unidadeInfo?.cidade ? ` · Cidade: ${unidadeInfo.cidade}` : ''}
        </div>
        ` : ''}
     </div>`;

  const estiloDoc = `
     <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px;max-width:720px;margin:0 auto}
        .head{border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
        .tag{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
        h1{font-size:26px;margin:4px 0}
        .meta{font-size:13px;color:#475569}
        h2{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin:20px 0 8px}
        table{width:100%;border-collapse:collapse;font-size:14px}
        th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #e2e8f0}
        th{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b}
        td.c,th.c{text-align:center}td.r,th.r{text-align:right}
        .totais{margin-top:16px;border-top:3px solid #0f172a;padding-top:12px}
        .totais .linha{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}
        .totais .destaque{font-size:20px;font-weight:bold}
        .obs{margin-top:24px;font-size:11px;color:#94a3b8}
        @media print{@page{margin:14mm}}
     </style>`;

  const abrirDoc = (html) => {
    let win = null;
    try { win = window.open('', '_blank', 'width=800,height=900'); } catch { win = null; }
    if (!win) {
      // Popup bloqueado: cai para impressão na própria aba via iframe invisível
      try {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        document.body.appendChild(iframe);
        iframe.srcdoc = html;
        iframe.onload = () => {
          setTimeout(() => {
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert('Não consegui abrir a impressão: ' + e.message); }
            setTimeout(() => iframe.remove(), 60000);
          }, 300);
        };
        return;
      } catch (e) {
        return alert('O navegador bloqueou a janela de impressão. Habilite os popups para este site.\n\nDetalhe: ' + e.message);
      }
    }
    if (modoSaida === "pdf") {
      // Baixa PDF de verdade (html2pdf via CDN). Se falhar em 7s, cai pra impressão.
      const tit = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || "documento").replace(/[^\wÀ-ÿ \-]/g, "").trim().replace(/\s+/g, "-");
      const script = `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>`
        + `<script>(function(){var done=false;function run(){if(window.html2pdf){done=true;html2pdf().set({margin:10,filename:'${tit}.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(document.body).save().then(function(){setTimeout(function(){window.close();},1000);});}else{setTimeout(run,300);}}window.addEventListener('load',function(){setTimeout(run,300);});setTimeout(function(){if(!done){window.print();}},7000);})();<\/script>`;
      win.document.write(html.replace('</body>', script + '</body>'));
      win.document.close();
    } else {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  };

  // Se algo der errado ao montar o documento, mostra o erro em vez de falhar mudo
  const seguro = (fn) => () => {
    try { fn(); } catch (e) { console.error("[orcamento] erro ao gerar documento:", e); alert("Erro ao gerar o documento: " + e.message); }
  };

  // Descrição da quantidade escolhida, com equivalências (pro cliente se programar)
  const descQtd = (l) => {
    const qtdFmt = (+Number(l.qtd).toFixed(2)).toLocaleString("pt-BR");
    if (l.un === "g" || l.un === "kg") {
      return `${qtdFmt} ${l.un} (rende ≈ ${(+l.porcoes.toFixed(1)).toLocaleString("pt-BR")} un de ${l.pesoUn}g)`;
    }
    return `${qtdFmt} porç${Number(l.qtd) >= 2 ? "ões" : "ão"}${l.gramasTotal ? ` de ${l.pesoUn}g (${fmtCompra(l.gramasTotal / 1000, "kg")})` : ""}`;
  };

  // Documento 1: ORÇAMENTO para o cliente (sem custos internos)
  const imprimirOrcamento = () => {
    if (linhas.length === 0) return alert("Adicione itens ao evento primeiro.");
    const rows = linhas.map(l =>
      `<tr><td>${l.nome}</td><td class="c">${descQtd(l)}</td><td class="r">${fmtBRL(l.precoEfetivo)}/porção</td><td class="r">${fmtBRL(l.vendaTotal)}</td></tr>`
    ).join('');
    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Orçamento - ${evento.nome || 'Evento'}</title>${estiloDoc}</head><body>
       ${cabecalhoDoc('Orçamento de Buffet')}
       <h2>Itens do Buffet</h2>
       <table>
          <thead><tr><th>Item</th><th class="c">Quantidade</th><th class="r">Valor Unit.</th><th class="r">Valor Total</th></tr></thead>
          <tbody>${rows}</tbody>
       </table>
       ${extras.filter(x => Number(x.valor_cobrado) > 0).length ? `
       <h2>Serviços Adicionais</h2>
       <table>
          <tbody>
             ${extras.filter(x => Number(x.valor_cobrado) > 0).map(x => `<tr><td>${x.nome || "Serviço"}</td><td class="r">${fmtBRL(x.valor_cobrado)}</td></tr>`).join("")}
             <tr><td style="font-weight:bold">Subtotal serviços</td><td class="r" style="font-weight:bold">${fmtBRL(vendaExtras)}</td></tr>
          </tbody>
       </table>` : ''}
       <div class="totais">
          ${vendaPorConvidado !== null ? `<div class="linha"><span>Buffet por convidado (${convidados})</span><b>${fmtBRL(vendaPorConvidado)}</b></div>` : ''}
          ${vendaExtras > 0 ? `<div class="linha"><span>Buffet</span><b>${fmtBRL(vendaEvento)}</b></div><div class="linha"><span>Serviços adicionais</span><b>${fmtBRL(vendaExtras)}</b></div>` : ''}
          <div class="linha destaque"><span>Valor Total do Evento</span><span>${fmtBRL(totalCliente)}</span></div>
       </div>
       <div class="obs">Orçamento gerado em ${new Date().toLocaleDateString('pt-BR')}. Valores sujeitos a confirmação de data e disponibilidade.</div>
    </body></html>`);
  };

  // Documento 2: LISTA INTERNA — compras e custos (não vai pro cliente)
  const imprimirInterno = () => {
    if (linhas.length === 0) return alert("Adicione itens ao evento primeiro.");
    const rowsProdutos = linhas.map(l =>
      `<tr><td>${l.nome}${!l.ficha ? ' *' : ''}</td><td class="c">${descQtd(l)}</td><td class="r">${fmtBRL(l.custoPorcao)}</td><td class="r">${fmtBRL(l.custoTotal)}</td><td class="r">${fmtBRL(l.vendaTotal)}</td></tr>`
    ).join('');
    const rowsCompras = compras.map(c =>
      `<tr><td>${c.nome}</td><td class="c">${fmtCompra(c.qtd, c.unidade)}</td><td class="r">${fmtBRL(c.custo_unitario)}/${c.unidade}</td><td class="r">${fmtBRL(c.custoCompra)}</td></tr>`
    ).join('');
    const temSemFicha = linhas.some(l => !l.ficha);
    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Produção e Compras - ${evento.nome || 'Evento'}</title>${estiloDoc}</head><body>
       ${cabecalhoDoc('Produção e Compras (uso interno)')}
       <h2>Produção do Buffet</h2>
       <table>
          <thead><tr><th>Item</th><th class="c">Quantidade</th><th class="r">Custo/Porção</th><th class="r">Custo Total</th><th class="r">Venda</th></tr></thead>
          <tbody>${rowsProdutos}</tbody>
       </table>
       ${temSemFicha ? '<div class="obs">* item sem ficha técnica vinculada — custo e compras não calculados.</div>' : ''}
       <h2>Lista de Compras (Ingredientes)</h2>
       <table>
          <thead><tr><th>Ingrediente</th><th class="c">Comprar</th><th class="r">Custo Base</th><th class="r">Estimado</th></tr></thead>
          <tbody>${rowsCompras.length ? rowsCompras : '<tr><td colspan="4">Nenhum item com ficha técnica.</td></tr>'}</tbody>
       </table>
       <div class="totais">
          <div class="linha"><span>Custo total de ingredientes</span><b>${fmtBRL(totalCompras)}</b></div>
          ${custoPorConvidado !== null ? `<div class="linha"><span>Custo por convidado</span><b>${fmtBRL(custoPorConvidado)}</b></div>` : ''}
          <div class="linha"><span>Valor de venda do evento</span><b>${fmtBRL(vendaEvento)}</b></div>
          <div class="linha destaque"><span>Margem estimada</span><span>${fmtBRL(vendaEvento - custoEvento)}</span></div>
       </div>
    </body></html>`);
  };

  // Documento: PROGRAMAÇÃO DO EVENTO (uso interno / cozinha) — cardápio, modo de
  // preparo, descrição de montagem, foto de referência, utensílios e compras.
  // Serve para você se organizar na produção; não vai para o cliente.
  const imprimirProgramacao = () => {
    if (linhas.length === 0) return alert("Adicione itens ao evento primeiro.");
    const itemPorId = (id) => itens.find(i => i.produto_id === id) || {};

    const cards = linhas.map(l => {
      const it = itemPorId(l.produto_id);
      // Modo de preparo: junta o de cada ficha do prato (composição múltipla)
      const preparo = (l.fichasComp || [])
        .map(x => x.ficha?.modo_preparo)
        .filter(Boolean)
        .join("\n\n");
      const preparoHtml = preparo
        ? preparo.split("\n").filter(t => t.trim()).map(t => `<p>${t.replace(/</g, "&lt;")}</p>`).join("")
        : '<p class="vazio">Sem modo de preparo cadastrado na ficha técnica.</p>';
      return `
      <div class="prato">
        <div class="prato-head">
          <div>
            <h3>${l.nome}</h3>
            <span class="qtd">${descQtd(l)}${l.categoria ? ` · ${l.categoria}` : ""}</span>
          </div>
          ${it.foto ? `<img src="${it.foto}" alt="" class="foto"/>` : ""}
        </div>
        ${it.descricao ? `<div class="montagem"><b>Montagem / onde servir:</b> ${it.descricao.replace(/</g, "&lt;")}</div>` : ""}
        <div class="preparo"><b>Modo de preparo</b>${preparoHtml}</div>
      </div>`;
    }).join("");

    const rowsCompras = compras.map(c =>
      `<tr><td>${c.nome}</td><td class="c">${fmtCompra(c.qtd, c.unidade)}</td></tr>`
    ).join("");

    const dataHora = [
      evento.data ? evento.data.split("-").reverse().join("/") : null,
      evento.hora || null,
    ].filter(Boolean).join(" às ");

    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Programacao - ${evento.nome || "Evento"}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:22px;max-width:760px;margin:0 auto}
        .head{border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:14px}
        .tag{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
        h1{font-size:25px;margin:4px 0}
        .quando{display:inline-block;background:#0f172a;color:#fff;font-weight:bold;font-size:14px;padding:5px 12px;border-radius:8px;margin-top:4px}
        .meta{font-size:13px;color:#475569;margin-top:6px}
        h2{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin:20px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
        .prato{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:12px;page-break-inside:avoid}
        .prato-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .prato h3{font-size:17px;margin:0}
        .qtd{font-size:12px;color:#64748b;font-weight:bold}
        .foto{width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1;flex-shrink:0}
        .montagem{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;margin-top:8px;font-size:13px;color:#166534}
        .preparo{margin-top:10px;font-size:13px;color:#334155}
        .preparo b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px}
        .preparo p{margin:3px 0;line-height:1.45}
        .preparo .vazio{color:#94a3b8;font-style:italic}
        .util{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:13px;color:#78350f;white-space:pre-wrap;line-height:1.5}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #e2e8f0}
        th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b}
        td.c,th.c{text-align:center}
        .obs{margin-top:22px;font-size:11px;color:#94a3b8}
        @media print{@page{margin:12mm}}
      </style></head><body>
      <div class="head">
        <div class="tag">Programação do Evento — uso interno · ${unidadeInfo?.nome || ""}</div>
        <h1>${evento.nome || "Evento"}</h1>
        ${dataHora ? `<div class="quando">${dataHora}</div>` : ""}
        <div class="meta">${evento.cliente ? `Cliente: <b>${evento.cliente}</b> · ` : ""}Convidados: <b>${convidados || "—"}</b></div>
      </div>

      <h2>Cardápio & Modo de Preparo</h2>
      ${cards}

      ${(evento.utensilios || "").trim() ? `<h2>Utensílios / Equipamentos a Levar</h2><div class="util">${evento.utensilios.replace(/</g, "&lt;")}</div>` : ""}

      <h2>Ingredientes para Comprar</h2>
      <table>
        <thead><tr><th>Ingrediente</th><th class="c">Comprar</th></tr></thead>
        <tbody>${rowsCompras || '<tr><td colspan="2">Nenhum item com ficha técnica.</td></tr>'}</tbody>
      </table>

      <div class="obs">Programação gerada em ${new Date().toLocaleDateString("pt-BR")}. Documento de uso interno.</div>
    </body></html>`);
  };

  // Documento 3: RELATÓRIO GERENCIAL — faturamento, custos, lucro, comissão,
  // parceria de bar e o duplo benefício do empanado (uso interno).
  const imprimirRelatorio = () => {
    if (linhas.length === 0) return alert("Adicione itens ao evento primeiro.");
    const linha = (rotulo, valor, cor) => `<div class="linha"><span>${rotulo}</span><b${cor ? ` style="color:${cor}"` : ''}>${valor}</b></div>`;
    const lucroPct = totalCliente > 0 ? (lucroEvento / totalCliente) * 100 : 0;

    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Relatório - ${evento.nome || 'Evento'}</title>${estiloDoc}</head><body>
       ${cabecalhoDoc('Relatório Gerencial')}

       <h2>Resultado do Evento</h2>
       <div class="totais" style="border-top:none;margin-top:0">
          ${linha('Faturamento buffet', fmtBRL(vendaEvento))}
          ${vendaExtras > 0 ? linha('+ Serviços extras cobrados', fmtBRL(vendaExtras)) : ''}
          ${vendaExtras > 0 ? linha('= Faturamento total', fmtBRL(totalCliente)) : ''}
          ${linha('− Custo de ingredientes', fmtBRL(custoEvento))}
          ${custoExtras > 0 ? linha('− Custo dos extras (funcionários, música...)', fmtBRL(custoExtras)) : ''}
          ${comissaoPct > 0 ? linha(`− Comissão (${comissaoPct}%)`, fmtBRL(comissao)) : ''}
          ${parceriaBar > 0 ? linha(`− Parceria bar (${parceriaBarPct}% de ${fmtBRL(vendaBar)})`, fmtBRL(parceriaBar)) : ''}
          <div class="linha destaque"><span>Lucro do evento (${lucroPct.toFixed(1)}%)</span><span style="color:${lucroEvento >= 0 ? '#059669' : '#dc2626'}">${fmtBRL(lucroEvento)}</span></div>
          ${convidados > 0 ? linha('Lucro por convidado', fmtBRL(lucroEvento / convidados)) : ''}
       </div>

       ${extras.length ? `
       <h2>Serviços e Custos Extras</h2>
       <table>
          <thead><tr><th>Item</th><th class="r">Meu custo</th><th class="r">Cobrado do cliente</th></tr></thead>
          <tbody>${extras.map(x => `<tr><td>${x.nome || 'Serviço'}</td><td class="r">${fmtBRL(x.custo)}</td><td class="r">${fmtBRL(x.valor_cobrado)}</td></tr>`).join('')}</tbody>
       </table>` : ''}

       ${(ganhoInNaturaTotal > 0 || economiaEmpanadoTotal > 0) ? `
       <h2>Benefício do Empanamento</h2>
       <div class="totais" style="border-top:none;margin-top:0">
          ${economiaEmpanadoTotal > 0 ? linha('Economia no custo (usei menos peixe)', fmtBRL(economiaEmpanadoTotal), '#059669') : ''}
          ${ganhoInNaturaTotal > 0 ? linha('Ganho no preço (cobrado como in natura)', fmtBRL(ganhoInNaturaTotal), '#059669') : ''}
          <div class="linha destaque"><span>Benefício total do empanado</span><span style="color:#059669">${fmtBRL(economiaEmpanadoTotal + ganhoInNaturaTotal)}</span></div>
       </div>
       <div class="obs">Economia estimada: comparação com servir o ingrediente in natura. Ganho no preço: itens cobrados como in natura.</div>
       ` : ''}

       ${parceriaBar > 0 ? `
       <h2>Parceria de Bebidas</h2>
       <div class="totais" style="border-top:none;margin-top:0">
          ${linha('Vendas do bar', fmtBRL(vendaBar))}
          ${linha(`Repasse ao contratante (${parceriaBarPct}%)`, fmtBRL(parceriaBar))}
       </div>` : ''}

       <h2>Itens do Buffet</h2>
       <table>
          <thead><tr><th>Item</th><th class="c">Qtd</th><th class="r">Custo</th><th class="r">Venda</th></tr></thead>
          <tbody>${linhas.map(l => `<tr><td>${l.nome}${l.inNatura ? ' (in natura)' : ''}</td><td class="c">${(+l.porcoes.toFixed(1)).toLocaleString('pt-BR')}</td><td class="r">${fmtBRL(l.custoTotal)}</td><td class="r">${fmtBRL(l.vendaTotal)}</td></tr>`).join('')}</tbody>
       </table>
    </body></html>`);
  };

  // Venda total e valor/convidado de UMA proposta (para o comparativo)
  const resumoProposta = (prop) => {
    const conv = Number(prop.evento?.convidados) || 0;
    let somaBase = 0, itensCount = 0;
    (prop.itens || []).forEach(it => {
      const produto = produtos.find(p => p.id === it.produto_id);
      if (!produto) return;
      itensCount++;
      const comps = (Array.isArray(produto.composicao) && produto.composicao.length) ? produto.composicao : (produto.ficha_id ? [{ ficha_id: produto.ficha_id, qtd: 1 }] : []);
      const fichasComp = comps.map(c => ({ ficha: fichas.find(f => f.id === c.ficha_id), qtd: Number(c.qtd) || 1 })).filter(x => x.ficha);
      const qtd = Number(String(it.qtd).replace(',', '.')) || 0;
      const pesoUnFicha = fichasComp.reduce((a, x) => a + (Number(x.ficha.peso_porcao_g) || 0) * x.qtd, 0);
      const pesoUn = Number(it.pesoUn) || pesoUnFicha || 0;
      let porcoes = conv > 0 ? qtd * conv : qtd;
      const precoCardapio = Number(produto.preco_venda) || 0;
      const precoKgCardapio = pesoUn > 0 ? precoCardapio * (1000 / pesoUn) : precoCardapio;
      const precoKg = it.precoKg !== undefined && it.precoKg !== "" ? Number(it.precoKg) || 0 : precoKgCardapio;
      const precoVenda = pesoUn > 0 ? precoKg * (pesoUn / 1000) : precoCardapio;
      const fator = fichasComp.reduce((m, x) => Math.max(m, fatorInNaturaDaFicha(x.ficha, fichas, mapaFatores)), 1);
      const precoEfBase = (it.inNatura && fator > 1) ? precoVenda * fator : precoVenda;
      somaBase += precoEfBase * porcoes;
    });
    const precoPessoaProp = Number(prop.evento?.preco_pessoa) || 0;
    const valorDesejado = (precoPessoaProp > 0 && conv > 0)
      ? precoPessoaProp * conv
      : (Number(prop.evento?.valor_final_venda) || 0);
    const vendaBuffet = valorDesejado > 0 ? valorDesejado : somaBase;
    const vendaExtrasProp = (prop.extras || []).reduce((a, x) => a + (Number(x.valor_cobrado) || 0), 0);
    const venda = vendaBuffet + vendaExtrasProp;
    return { venda, convidados: conv, porConvidado: conv > 0 ? venda / conv : null, itensCount };
  };

  // Documento: COMPARATIVO de propostas (para o cliente escolher)
  const imprimirComparacao = () => {
    const validas = propostas.filter(p => (p.itens || []).length > 0);
    if (validas.length === 0) return alert("Adicione itens em ao menos uma proposta.");
    const cols = validas.map(p => ({ nome: p.nome, ...resumoProposta(p) }));
    const cabecalho = cols.map(c => `<th class="r">${c.nome}</th>`).join('');
    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Propostas - ${evento.nome || 'Evento'}</title>${estiloDoc}</head><body>
       ${cabecalhoDoc('Propostas de Buffet')}
       <h2>Opções para o seu evento</h2>
       <table>
          <thead><tr><th>Comparativo</th>${cabecalho}</tr></thead>
          <tbody>
             <tr><td>Convidados</td>${cols.map(c => `<td class="r">${c.convidados || '—'}</td>`).join('')}</tr>
             <tr><td>Itens no buffet</td>${cols.map(c => `<td class="r">${c.itensCount}</td>`).join('')}</tr>
             <tr><td><b>Valor por convidado</b></td>${cols.map(c => `<td class="r"><b>${c.porConvidado !== null ? fmtBRL(c.porConvidado) : '—'}</b></td>`).join('')}</tr>
             <tr><td><b>Valor total</b></td>${cols.map(c => `<td class="r"><b>${fmtBRL(c.venda)}</b></td>`).join('')}</tr>
          </tbody>
       </table>
       <div class="obs">Escolha a opção que melhor se encaixa. Valores sujeitos a confirmação de data e disponibilidade · ${new Date().toLocaleDateString('pt-BR')}.</div>
    </body></html>`);
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">

      {/* TOPBAR — linha 1: título + ações do evento; linha 2: documentos p/ imprimir */}
      <div className="bg-white border-b border-slate-200 pt-5 pb-4 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
               <div className="flex items-center gap-4">
                 <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                    <ArrowLeft size={20}/>
                 </button>
                 <div className="w-12 h-12 rounded-2xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
                    <PartyPopper size={24} />
                 </div>
                 <div>
                    <h1 className="text-2xl font-black tracking-tighter text-slate-900">Orçamentos de Eventos</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-0.5">Buffet: custos, compras e valor por convidado</p>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                  {orcamentoId && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">salvo</span>}
                  <button onClick={abrirHistorico} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                     <History size={14}/> Histórico
                  </button>
                  <button onClick={novoEvento} className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">Novo evento</button>
                  <button onClick={salvarEvento} disabled={salvando} className="flex items-center gap-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-emerald-600/20">
                     {salvando ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} {orcamentoId ? "Atualizar" : "Salvar Evento"}
                  </button>
               </div>
            </div>

            {/* Documentos: escolha o destino (imprimir/PDF) e o documento */}
            <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gerar:</span>
               <div className="inline-flex p-1 rounded-xl bg-slate-100">
                  <button onClick={() => setModoSaida("imprimir")} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${modoSaida === "imprimir" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Imprimir</button>
                  <button onClick={() => setModoSaida("pdf")} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${modoSaida === "pdf" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"}`}>Baixar PDF</button>
               </div>
               <span className="w-px h-6 bg-slate-200 mx-1" />
               <button type="button" onClick={seguro(imprimirOrcamento)} className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors">
                  <FileText size={14} /> Orçamento (Cliente)
               </button>
               <button type="button" onClick={seguro(imprimirInterno)} className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-slate-50 transition-colors">
                  <Printer size={14} /> Compras (Interno)
               </button>
               <button type="button" onClick={seguro(imprimirProgramacao)} className="flex items-center gap-1.5 bg-white text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-colors">
                  <ClipboardList size={14} /> Programação (Cozinha)
               </button>
               <button type="button" onClick={seguro(imprimirRelatorio)} className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-slate-50 transition-colors">
                  <FileText size={14} /> Relatório Gerencial
               </button>
               {propostas.length > 1 && (
                  <button type="button" onClick={seguro(imprimirComparacao)} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors">
                     <FileText size={14} /> Comparar Propostas
                  </button>
               )}
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

         {/* COLUNA ESQUERDA: dados do evento + itens */}
         <div className="space-y-6">

            {/* Propostas do mesmo evento (ex.: R$60/pessoa, R$90/pessoa) */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 flex-wrap">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Propostas:</span>
               {propostas.map(p => {
                  const r = resumoProposta(p);
                  const ativoTab = p.id === ativa.id;
                  return (
                     <button key={p.id} onClick={() => setAtivaId(p.id)} className={`px-3 py-2 rounded-xl font-bold text-sm transition-all ${ativoTab ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200'}`}>
                        {p.nome}
                        {r.porConvidado !== null && <span className={`ml-1.5 ${ativoTab ? 'text-emerald-300' : 'text-emerald-600'}`}>{fmtBRL(r.porConvidado)}/pes</span>}
                     </button>
                  );
               })}
               <button onClick={addProposta} className="px-3 py-2 rounded-xl font-bold text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">+ Nova</button>
               <span className="flex-1" />
               <button onClick={renomearProposta} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1.5">Renomear</button>
               <button onClick={duplicarProposta} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1.5">Duplicar</button>
               {propostas.length > 1 && <button onClick={removerProposta} className="text-[10px] font-bold text-red-400 hover:text-red-600 px-1.5">Remover</button>}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dados do Evento</p>
                  <button onClick={limparTudo} className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest">Limpar proposta</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do Evento</label>
                     <input type="text" placeholder="Ex: Casamento Ana e João" value={evento.nome} onChange={e=>setEvento({...evento, nome: e.target.value})} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-800"/>
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cliente</label>
                     <input type="text" placeholder="Nome do cliente" value={evento.cliente} onChange={e=>setEvento({...evento, cliente: e.target.value})} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-800"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data</label>
                        <input type="date" value={evento.data} onChange={e=>setEvento({...evento, data: e.target.value})} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-700"/>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Horário</label>
                        <input type="time" value={evento.hora || ""} onChange={e=>setEvento({...evento, hora: e.target.value})} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-700"/>
                     </div>
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> Nº de Convidados</label>
                     <input type="number" min="0" placeholder="Ex: 80" value={evento.convidados} onChange={e=>setEvento({...evento, convidados: e.target.value})} className="w-full p-3.5 mt-1 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500"/>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Cobrar do Cliente (R$ por pessoa)</label>
                     <input type="number" min="0" step="0.01" placeholder="Ex: 70,00" value={evento.preco_pessoa || ""} onChange={e=>setEvento({...evento, preco_pessoa: e.target.value})} className="w-full p-3.5 mt-1 bg-emerald-50 border-2 border-emerald-300 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500"/>
                     {precoPessoaDesejado > 0 && convidados > 0 && (
                        <p className="text-[10px] font-bold text-slate-500 mt-1.5 leading-relaxed">
                           Cliente paga <span className="text-slate-800">{fmtBRL(vendaEvento)}</span> no total.
                           Seu custo: <span className="text-slate-800">{fmtBRL(custoPorConvidado || 0)}/pessoa</span> ·
                           lucro: <span className={`font-black ${lucroEvento >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtBRL(lucroEvento / convidados)}/pessoa ({fmtBRL(lucroEvento)})</span>
                        </p>
                     )}
                     {precoPessoaDesejado > 0 && !(convidados > 0) && (
                        <p className="text-[10px] font-bold text-amber-600 mt-1.5">Informe o nº de convidados para o cálculo valer.</p>
                     )}
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ou Valor de Venda total (R$)</label>
                     <input type="number" min="0" step="0.01" placeholder="Ex: 5000" disabled={precoPessoaDesejado > 0 && convidados > 0} value={evento.valor_final_venda || ""} onChange={e=>setEvento({...evento, valor_final_venda: e.target.value})} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-40"/>
                     {precoPessoaDesejado > 0 && convidados > 0 && (
                        <p className="text-[10px] font-medium text-slate-400 mt-1">Ignorado — o valor por pessoa está mandando.</p>
                     )}
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comissão sobre vendas (%)</label>
                     <input type="number" min="0" step="0.1" placeholder="Ex: 10" value={evento.comissao_pct} onChange={e=>setEvento({...evento, comissao_pct: e.target.value})} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                  </div>
                  <div>
                     <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input type="checkbox" checked={evento.parceria_bar_ativa} onChange={e=>setEvento({...evento, parceria_bar_ativa: e.target.checked})} className="w-4 h-4 accent-emerald-600"/>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Parceria de bar (repasse ao contratante)</span>
                     </label>
                     {evento.parceria_bar_ativa && (
                        <div className="flex items-center gap-2 mt-1">
                           <input type="number" min="0" max="100" step="1" value={evento.parceria_bar_pct} onChange={e=>setEvento({...evento, parceria_bar_pct: e.target.value})} className="w-24 p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:border-emerald-500"/>
                           <span className="text-xs font-bold text-slate-500">% das vendas do bar {vendaBar > 0 ? `(${fmtBRL(vendaBar)})` : ''}</span>
                        </div>
                     )}
                  </div>
               </div>

               {/* Utensílios do evento — só para a programação interna (não vai pro cliente) */}
               <div className="mt-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><ChefHat size={12}/> Utensílios / equipamentos que vou levar</label>
                  <textarea placeholder="Ex: 2 rechauds, panela de 20L, tábuas, réchaud de banho-maria, garfos de servir, bandejas..." value={evento.utensilios || ""} onChange={e=>setEvento({...evento, utensilios: e.target.value})} rows={2} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm text-slate-700 outline-none focus:border-emerald-500 resize-none"/>
               </div>
            </div>

            {/* ══ TABELA RESUMO — R$/pessoa por prato ══ */}
            {linhas.length > 0 && (
              <div className="rounded-2xl overflow-x-auto shadow-md border border-slate-200">
                  <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-5 py-3 flex items-center justify-between min-w-[580px]">
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-100">Resumo do Buffet — Valor por Pessoa</span>
                  {convidados > 0 && <span className="text-white font-black text-lg">{fmtBRL(vendaPorConvidado)}<span className="text-emerald-200 font-bold text-xs ml-1">/pessoa</span></span>}
                </div>
                <div className="bg-white">
                  {/* Header */}
                  <div className="px-5 py-2.5 grid grid-cols-[1fr_70px_80px_90px_90px] gap-2 items-center min-w-[580px] bg-slate-50 border-b border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prato</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Porção</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">R$/kg</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">R$/pessoa</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</span>
                  </div>
                  {/* Linhas */}
                  <div className="divide-y divide-slate-50">
                    {linhas.map(l => (
                      <div key={l.produto_id} className="px-5 py-2.5 grid grid-cols-[1fr_70px_80px_90px_90px] gap-2 items-center min-w-[580px] hover:bg-emerald-50/30 transition-colors">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-700 text-sm truncate">{l.nome}</p>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{l.categoria}</span>
                        </div>
                        <span className="text-center text-xs font-bold text-slate-600">{l.pesoUn > 0 ? `${l.pesoUn}g` : '—'}</span>
                        <span className="text-center text-xs font-black text-slate-700">{l.vendaPorKg ? fmtBRL(l.vendaPorKg) : '—'}</span>
                        <span className="text-center text-sm font-black text-emerald-600">{convidados > 0 ? fmtBRL(l.precoPorPessoa) : '—'}</span>
                        <span className="text-right text-xs font-black text-slate-700">{fmtBRL(l.vendaTotal)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Totais */}
                  <div className="px-5 py-3 bg-slate-800 grid grid-cols-[1fr_70px_80px_90px_90px] gap-2 items-center min-w-[580px]">
                    <span className="font-black text-white text-sm">TOTAL DO EVENTO</span>
                    <span />
                    <span />
                    <span className="text-center font-black text-emerald-400 text-lg">{convidados > 0 ? fmtBRL(vendaPorConvidado) : '—'}</span>
                    <span className="text-right font-black text-white text-sm">{fmtBRL(vendaEvento)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ITENS DO BUFFET — configuração detalhada ══ */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Configurar Itens do Buffet</p>
               <select onChange={e => { addItem(e.target.value); e.target.value = ""; }} disabled={loading} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-emerald-500 mb-4">
                  <option value="">{loading ? "Carregando cardápio..." : "+ Adicionar produto do cardápio..."}</option>
                  {produtos.filter(p => !itens.find(i => i.produto_id === p.id)).map(p => (
                     <option key={p.id} value={p.id}>{p.nome_produto} ({p.categoria}) — {fmtBRL(p.preco_venda)}</option>
                  ))}
               </select>

               {linhas.length === 0 ? (
                  <div className="text-center p-12 text-slate-300">
                     <ShoppingCart size={40} className="mx-auto mb-3 opacity-40" />
                     <p className="text-slate-400 font-bold text-sm">Adicione os produtos do buffet acima.</p>
                     <p className="text-slate-400 font-medium text-xs mt-1">Custos e compras são calculados automaticamente pelas Fichas Técnicas.</p>
                  </div>
               ) : (
                  <div className="space-y-3">
                     {linhas.map(l => (
                        <div key={l.produto_id}
                           onDragOver={e => { if (dragItemId) e.preventDefault(); }}
                           onDrop={() => reordenarItens(dragItemId, l.produto_id)}
                           className={`rounded-2xl border overflow-hidden transition-colors ${dragItemId === l.produto_id ? 'opacity-50 border-emerald-400' : 'border-slate-200 hover:border-slate-300'}`}>
                           {/* CABEÇALHO DO ITEM — nome + categoria */}
                           <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                 <div draggable onDragStart={() => setDragItemId(l.produto_id)} onDragEnd={() => setDragItemId(null)}
                                    title="Arraste para reordenar os pratos" className="text-slate-400 hover:text-white cursor-grab active:cursor-grabbing shrink-0">
                                    <GripVertical size={18} />
                                 </div>
                                 <div className="min-w-0">
                                    <p className="font-black text-white text-[15px] truncate">{l.nome}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                       {l.categoria}
                                       {!l.ficha && <span className="text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">sem ficha técnica</span>}
                                    </p>
                                 </div>
                              </div>
                              <button onClick={() => removeItem(l.produto_id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"><Trash2 size={16}/></button>
                           </div>

                           {/* INPUTS — grid organizado */}
                           <div className="p-4 bg-white">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                 {/* Quantidade (porções por convidado) */}
                                 <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quantidade</label>
                                    <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden focus-within:border-emerald-500">
                                       <input type="text" inputMode="decimal" placeholder="0" value={l.qtdRaw !== undefined ? l.qtdRaw : ''} onChange={e=>{
                                          const val = e.target.value.replace(/[^0-9.,]/g, '');
                                          updateItem(l.produto_id, { qtd: val });
                                       }} className="w-full min-w-0 p-2.5 text-center bg-transparent font-black text-slate-700 outline-none"/>
                                       <div className="flex items-center justify-center px-2 bg-slate-100 border-l border-slate-200 text-[10px] font-bold text-slate-500 shrink-0">
                                          porções
                                       </div>
                                    </div>
                                 </div>
                                 {/* Porção em gramas — sem ela não dá pra calcular R$/kg */}
                                 <div>
                                    <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${l.pesoUn > 0 ? "text-slate-400" : "text-amber-600"}`}>Porção (g)</label>
                                    <input type="number" min="0" step="0.1" placeholder="ex: 200" value={(() => { const raw = itens.find(i=>i.produto_id===l.produto_id)?.pesoUn; return raw === undefined ? (l.pesoUn || "") : raw; })()} onChange={e=>updateItem(l.produto_id, { pesoUn: e.target.value })} className={`w-full p-2.5 text-center rounded-lg font-bold text-slate-600 outline-none focus:border-emerald-500 ${l.pesoUn > 0 ? "bg-slate-50 border border-slate-200" : "bg-amber-50 border-2 border-amber-400"}`}/>
                                    {!(l.pesoUn > 0) && <p className="text-[9px] font-bold text-amber-600 mt-1 leading-tight">Comece aqui: o peso da porção destrava o R$/kg e o preço</p>}
                                 </div>
                                 {/* Preço por KG — input principal */}
                                 <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">R$ / kg</label>
                                    <input type="number" min="0" step="0.01" placeholder="0,00" value={(() => { const raw = itens.find(i=>i.produto_id===l.produto_id)?.precoKg; return raw === undefined ? (l.precoKgCardapio ? (+l.precoKgCardapio.toFixed(2)) : "") : raw; })()} onChange={e=>updateItem(l.produto_id, { precoKg: e.target.value })} className={`w-full p-2.5 text-center rounded-lg font-black outline-none focus:border-emerald-500 ${l.precoKgEditado ? 'bg-amber-50 border-2 border-amber-400 text-amber-700' : 'bg-emerald-50 border-2 border-emerald-300 text-emerald-700'}`}/>
                                    {l.precoKgEditado && (
                                       <button onClick={() => updateItem(l.produto_id, { precoKg: "" })} className="text-[9px] font-bold text-amber-500 hover:text-amber-700 mt-1 underline block w-full text-center">
                                          voltar sugestão ({fmtBRL(l.precoKgCardapio)})
                                       </button>
                                    )}
                                 </div>
                                 {/* Resumo de Custos e Vendas */}
                                 <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-200 p-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Custo Total</span>
                                    <span className="font-black text-lg text-slate-700">{fmtBRL(l.custoTotal)}</span>
                                    <span className="text-[9px] font-bold text-slate-400 mt-0.5 text-center">{convidados > 0 ? `${fmtBRL(l.custoTotal / convidados)} / pessoa` : ''}</span>
                                 </div>
                                 <div className="flex flex-col items-center justify-center bg-emerald-50 rounded-lg border-2 border-emerald-200 p-2">
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest text-center">Preço de Venda</span>
                                    <span className="font-black text-xl text-emerald-700">{fmtBRL(l.vendaTotal)}</span>
                                    <span className="text-[9px] font-bold text-emerald-600 mt-0.5 text-center">{convidados > 0 ? `${fmtBRL(l.precoPorPessoa)} / pessoa` : ''}</span>
                                 </div>
                              </div>

                              {/* PLANEJAR POR KG — digite o total em kg e veja quanto rende por pessoa */}
                              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
                                 <div className="shrink-0">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total do prato (kg)</label>
                                    <input type="text" inputMode="decimal" placeholder="ex: 1"
                                       value={l.kgTotal ? +l.kgTotal.toFixed(3) : ""}
                                       onChange={e => setTotalKg(l, e.target.value.replace(/[^0-9.,]/g, ''))}
                                       disabled={!(l.pesoUn > 0)}
                                       className="w-24 p-2.5 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-50"/>
                                 </div>
                                 <div className="flex-1 min-w-[180px] text-xs font-bold text-slate-600 leading-snug">
                                    {l.pesoUn > 0 ? (
                                       <>
                                          <p>{l.kgTotal ? `${(+l.kgTotal.toFixed(3)).toLocaleString('pt-BR')} kg` : '—'} = <b className="text-slate-800">{(+l.porcoes.toFixed(1)).toLocaleString('pt-BR')}</b> porções de {l.pesoUn}g <span className="text-slate-400 font-medium">(serve {Math.floor(l.porcoes)} com 1 porção cada)</span></p>
                                          {convidados > 0 && (
                                             <p className="text-[11px] text-emerald-700 mt-0.5">Dividido entre {convidados} convidados: <b>{(l.pesoUn * l.qtd).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} g por pessoa</b></p>
                                          )}
                                       </>
                                    ) : (
                                       <span className="text-slate-400 font-medium">Preencha a “Porção (g)” para planejar por kg.</span>
                                    )}
                                 </div>
                              </div>

                              {/* OPÇÕES ESPECIAIS — empanado */}
                              {l.fatorInNatura > 1 && (
                                 <label className="flex items-center gap-2 mt-3 cursor-pointer bg-sky-50 border border-sky-200 rounded-xl p-2.5">
                                    <input type="checkbox" checked={l.inNatura} onChange={e=>updateItem(l.produto_id, { inNatura: e.target.checked })} className="w-4 h-4 accent-sky-600 shrink-0"/>
                                    <span className="text-[10px] font-bold text-sky-700 leading-tight">
                                       Cobrar como in natura (+{((l.fatorInNatura - 1) * 100).toFixed(0)}%)
                                       {l.inNatura && <span className="text-sky-500"> · {fmtBRL(l.precoVenda)} → {fmtBRL(l.precoEfetivo)}/porção</span>}
                                    </span>
                                 </label>
                              )}

                              {/* RODAPÉ — métricas compactas */}
                              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                                 {l.porcoes > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400">
                                       <span className="text-slate-600 font-black">{(+l.porcoes.toFixed(1)).toLocaleString("pt-BR")}</span> porç{l.porcoes >= 2 ? 'ões' : 'ão'}
                                       {l.gramasTotal ? ` · ${fmtCompra(l.gramasTotal / 1000, 'kg')}` : ''}
                                    </span>
                                 )}
                                 {l.pesoUn > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400">
                                       1kg = <span className="text-slate-600">{(+l.unPorKg.toFixed(1)).toLocaleString("pt-BR")} un</span> · <span className="text-emerald-600">{fmtBRL(l.vendaPorKg)}</span>
                                    </span>
                                 )}
                                 <span className="text-[10px] font-bold text-slate-400">
                                    Custo: <span className="text-slate-700 font-black">{fmtBRL(l.custoTotal)}</span>
                                 </span>
                                 {convidados > 0 && l.porcoes > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400">
                                       <span className="text-slate-600">{(l.porcoes / convidados).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span> porção/convidado
                                    </span>
                                 )}
                              </div>

                              {/* PROGRAMAÇÃO INTERNA — descrição de montagem + foto (só pra você) */}
                              <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><ClipboardList size={11}/> Programação (uso interno)</p>
                                 <div className="flex flex-col sm:flex-row gap-3">
                                    <textarea
                                       placeholder="Onde/como servir este prato: réchaud na mesa 2, decorar com salsa, servir quente..."
                                       value={(() => { const it = itens.find(i=>i.produto_id===l.produto_id); return it?.descricao || ""; })()}
                                       onChange={e=>updateItem(l.produto_id, { descricao: e.target.value })}
                                       rows={2}
                                       className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"/>
                                    <div className="shrink-0">
                                       {(() => {
                                          const it = itens.find(i=>i.produto_id===l.produto_id);
                                          if (it?.foto) return (
                                             <div className="relative w-24 h-24">
                                                <img src={it.foto} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200"/>
                                                <button onClick={()=>updateItem(l.produto_id, { foto: null })} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600"><X size={13}/></button>
                                             </div>
                                          );
                                          return (
                                             <label className="w-24 h-24 flex flex-col items-center justify-center gap-1 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-emerald-400 text-slate-400 hover:text-emerald-500 transition-colors">
                                                <ImageIcon size={20}/>
                                                <span className="text-[9px] font-bold">Foto</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={async e=>{ const f=e.target.files?.[0]; if(f){ try{ const b64=await comprimirImagem(f); updateItem(l.produto_id,{ foto:b64 }); }catch{ alert("Não consegui carregar a imagem."); } } e.target.value=""; }}/>
                                             </label>
                                          );
                                       })()}
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            {/* ══ SERVIÇOS E CUSTOS EXTRAS — além do buffet ══ */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Serviços e Custos Extras</p>
               <p className="text-[11px] font-medium text-slate-400 mb-4">Funcionários, música, energia, aluguel do espaço... O que for cobrado aparece no orçamento do cliente junto ao buffet.</p>
               <div className="flex flex-wrap gap-2 mb-4">
                  {EXTRAS_SUGERIDOS.filter(s => !extras.find(x => x.nome === s)).map(s => (
                     <button key={s} type="button" onClick={() => setExtras(lista => [...lista, { id: novoId(), nome: s, custo: "", valor_cobrado: "" }])}
                        className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                        + {s}
                     </button>
                  ))}
                  <button type="button" onClick={() => setExtras(lista => [...lista, { id: novoId(), nome: "", custo: "", valor_cobrado: "" }])}
                     className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                     + Outro...
                  </button>
               </div>
               {extras.length > 0 && (
                  <div className="space-y-2">
                     {extras.map(x => (
                        <div key={x.id} className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                           <input type="text" placeholder="Nome do serviço/custo" value={x.nome}
                              onChange={e => setExtras(lista => lista.map(i => i.id === x.id ? { ...i, nome: e.target.value } : i))}
                              className="flex-1 min-w-[140px] p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-sm text-slate-700 outline-none focus:border-emerald-500"/>
                           <div className="text-center">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Meu custo</label>
                              <input type="number" min="0" step="0.01" placeholder="0,00" value={x.custo}
                                 onChange={e => setExtras(lista => lista.map(i => i.id === x.id ? { ...i, custo: e.target.value } : i))}
                                 className="w-24 p-2 text-center bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                           </div>
                           <div className="text-center">
                              <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Cobrar do cliente</label>
                              <input type="number" min="0" step="0.01" placeholder="0,00" value={x.valor_cobrado}
                                 onChange={e => setExtras(lista => lista.map(i => i.id === x.id ? { ...i, valor_cobrado: e.target.value } : i))}
                                 className="w-28 p-2 text-center bg-emerald-50 border-2 border-emerald-200 rounded-lg font-black text-emerald-700 outline-none focus:border-emerald-500"/>
                           </div>
                           <button type="button" onClick={() => setExtras(lista => lista.filter(i => i.id !== x.id))} className="p-2 text-slate-400 hover:text-red-500 rounded-lg shrink-0"><Trash2 size={15}/></button>
                        </div>
                     ))}
                     <div className="flex justify-between pt-2 text-xs font-black text-slate-600">
                        <span>Custo dos extras: {fmtBRL(custoExtras)}</span>
                        <span className="text-emerald-700">Cobrado do cliente: {fmtBRL(vendaExtras)}</span>
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* COLUNA DIREITA: resumo + compras */}
         <div className="space-y-6 lg:sticky lg:top-28">
            {(() => {
               const pes = Math.max(1, convidados);
               const margemPct = totalCliente > 0 ? (lucroEvento / totalCliente) * 100 : 0;
               const markupPct = (custoEvento + custoExtras) > 0 ? ((totalCliente / (custoEvento + custoExtras)) - 1) * 100 : 0;
               // Linha do resumo: rótulo + explicação + valor total + valor/pessoa
               const Linha = ({ cor = "text-slate-200", sinal = "", label, ajuda, total, porPes, forte }) => (
                  <div className="py-2 border-b border-slate-800/60 last:border-0">
                     <div className="flex justify-between items-baseline gap-2">
                        <span className={`font-bold ${cor} ${forte ? 'text-base' : 'text-sm'}`}>{sinal}{label}</span>
                        <span className={`font-black ${forte ? 'text-xl' : 'text-base'} ${cor}`}>{sinal}{fmtBRL(total)}</span>
                     </div>
                     <div className="flex justify-between items-baseline gap-2 mt-0.5">
                        <span className="text-[10px] font-medium text-slate-500">{ajuda}</span>
                        {convidados > 0 && porPes !== undefined && <span className="text-[10px] font-bold text-slate-500 shrink-0">{sinal}{fmtBRL(porPes)}/pessoa</span>}
                     </div>
                  </div>
               );
               // Nada configurado ainda: mostra o passo a passo em vez de zeros
               if (linhas.length === 0 && totalCliente <= 0) {
                  return (
                     <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Resumo do Evento</p>
                        <p className="text-sm font-bold text-slate-200 mb-4">Monte o orçamento em 3 passos:</p>
                        <div className="space-y-3">
                           {[
                              ["1", "Preencha os dados do evento", "nome, nº de convidados e o valor por pessoa que vai cobrar"],
                              ["2", "Adicione os pratos do buffet", "escolha os produtos do cardápio e ajuste porção e quantidade"],
                              ["3", "Acompanhe aqui o resultado", "faturamento, custos e lucro aparecem sozinhos"],
                           ].map(([n, t, s]) => (
                              <div key={n} className="flex gap-3 items-start">
                                 <span className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">{n}</span>
                                 <div>
                                    <p className="text-sm font-bold text-white leading-tight">{t}</p>
                                    <p className="text-[11px] font-medium text-slate-400">{s}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  );
               }
               return (
               <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo do Evento</p>
                     {convidados > 0 && <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">{convidados} convidados</span>}
                  </div>

                  <Linha cor="text-white" label="Faturamento (o que você recebe)" ajuda={vendaExtras > 0 ? `buffet ${fmtBRL(vendaEvento)} + extras ${fmtBRL(vendaExtras)}` : "buffet contratado"} total={totalCliente} porPes={totalCliente / pes} forte />
                  <Linha cor="text-rose-300" sinal="− " label="Custo dos ingredientes" ajuda="somado das fichas técnicas dos pratos" total={custoEvento} porPes={custoEvento / pes} />
                  {custoExtras > 0 && <Linha cor="text-rose-300" sinal="− " label="Custo dos extras" ajuda="equipe, música, espaço, energia..." total={custoExtras} porPes={custoExtras / pes} />}
                  {comissao > 0 && <Linha cor="text-rose-300" sinal="− " label={`Comissão (${comissaoPct}%)`} ajuda="comissão sobre o faturamento" total={comissao} porPes={comissao / pes} />}
                  {parceriaBar > 0 && <Linha cor="text-rose-300" sinal="− " label={`Parceria do bar (${parceriaBarPct}%)`} ajuda="repasse sobre as bebidas" total={parceriaBar} porPes={parceriaBar / pes} />}
                  {(economiaEmpanadoTotal > 0 || ganhoInNaturaTotal > 0) && (
                     <Linha cor="text-sky-300" sinal="+ " label="Benefício empanado / in natura" ajuda="ganho de peso já embutido no cálculo" total={economiaEmpanadoTotal + ganhoInNaturaTotal} porPes={(economiaEmpanadoTotal + ganhoInNaturaTotal) / pes} />
                  )}

                  <div className="mt-3 pt-3 border-t-2 border-slate-700">
                     <div className="flex justify-between items-baseline gap-2">
                        <span className="text-slate-300 font-black text-xs uppercase tracking-widest">Lucro do evento</span>
                        <span className={`font-black text-3xl ${lucroEvento >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtBRL(lucroEvento)}</span>
                     </div>
                     {convidados > 0 && (
                        <p className="text-right text-[11px] font-bold text-slate-400 mt-0.5">{fmtBRL(lucroEvento / pes)} por pessoa</p>
                     )}
                     {totalCliente > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                           <div className="bg-slate-800 rounded-xl p-2.5 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Margem de lucro</p>
                              <p className={`text-lg font-black ${margemPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{margemPct.toFixed(0)}%</p>
                           </div>
                           <div className="bg-slate-800 rounded-xl p-2.5 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Preço sobre o custo</p>
                              <p className="text-lg font-black text-slate-200">{markupPct >= 0 ? '+' : ''}{markupPct.toFixed(0)}%</p>
                           </div>
                        </div>
                     )}
                     {totalCliente <= 0 && custoEvento > 0 && (
                        <p className="text-[11px] font-bold text-slate-300 bg-slate-800 rounded-lg px-3 py-2 mt-3 leading-snug">
                           Defina o que vai cobrar (R$ por pessoa ou valor total) nos Dados do Evento — o lucro e a margem aparecem aqui.
                        </p>
                     )}
                     {lucroEvento < 0 && totalCliente > 0 && (
                        <p className="text-[11px] font-bold text-red-300 bg-red-500/10 rounded-lg px-3 py-2 mt-3 leading-snug">
                           Prejuízo: o custo está maior que o faturamento. Confira o preço por pessoa e os custos das fichas — se os ingredientes parecerem altos, use "Recalcular custos" em Ingredientes.
                        </p>
                     )}
                  </div>
               </div>
               );
            })()}

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><ShoppingCart size={14}/> Lista de Compras</p>
               {compras.length === 0 ? (
                  <p className="text-sm text-slate-400 font-medium">Os ingredientes aparecem aqui conforme você adiciona itens com ficha técnica.</p>
               ) : (
                  <>
                     <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                        {compras.map((c, i) => (
                           <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50">
                              <div className="min-w-0">
                                 <p className="font-bold text-slate-700 truncate">{c.nome}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fmtCompra(c.qtd, c.unidade)}</p>
                              </div>
                              <span className="font-black text-slate-600 shrink-0 ml-2">{fmtBRL(c.custoCompra)}</span>
                           </div>
                        ))}
                     </div>
                     <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total de compras</span>
                        <span className="font-black text-lg text-emerald-600">{fmtBRL(totalCompras)}</span>
                     </div>
                  </>
               )}
            </div>
         </div>

      </div>

      {/* HISTÓRICO DE EVENTOS SALVOS */}
      {modalHistorico && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] w-full max-w-2xl my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
               <div className="flex justify-between items-center p-4 sm:p-8 pb-4 sm:pb-6 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center"><History size={22}/></div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">Histórico de Eventos</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Clique num evento para carregar todas as propostas dele</p>
                     </div>
                  </div>
                  <button onClick={() => setModalHistorico(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar">
                  {historicoLoading ? (
                     <p className="text-center font-bold text-slate-400 p-8">Carregando histórico...</p>
                  ) : historico.length === 0 ? (
                     <p className="text-center font-medium text-slate-400 p-8">Nenhum evento salvo ainda. Monte um orçamento e clique em "Salvar Evento".</p>
                  ) : (
                     <div className="space-y-2">
                        {historico.map(item => {
                           const nProps = Array.isArray(item.dados?.propostas) ? item.dados.propostas.length : 0;
                           return (
                              <div key={item.id} className={`p-4 rounded-2xl border flex items-center gap-3 transition-colors ${item.id === orcamentoId ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                                 <button onClick={() => carregarDoHistorico(item)} className="flex-1 min-w-0 text-left">
                                    <p className="font-black text-slate-800 truncate">{item.nome}{item.id === orcamentoId && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 ml-2">aberto</span>}</p>
                                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                       {item.cliente ? `${item.cliente} · ` : ''}
                                       {item.data_evento ? `${item.data_evento.split('-').reverse().join('/')} · ` : ''}
                                       {item.convidados ? `${item.convidados} convidados · ` : ''}
                                       {nProps} proposta{nProps !== 1 ? 's' : ''}
                                    </p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Atualizado em {new Date(item.updated_at).toLocaleDateString('pt-BR')} às {new Date(item.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                 </button>
                                 <button onClick={() => excluirDoHistorico(item)} className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-lg border border-slate-200 shrink-0" title="Excluir do histórico"><Trash2 size={15}/></button>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
