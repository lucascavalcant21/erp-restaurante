"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas, fetchInsumos } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { PartyPopper, Printer, Trash2, ArrowLeft, Users, ShoppingCart, FileText } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

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
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
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
  const rend = Number(f?.rendimento_porcoes) || 1;
  const un = String(f?.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return rend;
  const pesoPorcao = Number(f?.peso_porcao_g) || 0;
  const pesoTotalG = (un === "kg" || un === "l") ? rend * 1000 : rend;
  return pesoPorcao > 0 ? pesoTotalG / pesoPorcao : rend;
}

// Formata quantidade de compra: kg/l pequenos viram g/ml; un arredonda pra cima
function fmtCompra(qtd, unidade) {
  const u = String(unidade || "").toLowerCase();
  if (u === "kg") return qtd < 1 ? `${Math.ceil(qtd * 1000)} g` : `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} kg`;
  if (u === "l") return qtd < 1 ? `${Math.ceil(qtd * 1000)} ml` : `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} L`;
  return `${Math.ceil(qtd)} un`;
}

const DRAFT_KEY = "orcamento_evento_draft";
const EVENTO_VAZIO = { nome: "", cliente: "", data: "", convidados: "", comissao_pct: "", parceria_bar_ativa: false, parceria_bar_pct: "30" };
const novoId = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));
const novaProposta = (nome) => ({ id: novoId(), nome, evento: { ...EVENTO_VAZIO }, itens: [] });

export default function OrcamentoEventoPage() {
  const { abrirMenu, unidadeAtiva, unidadeInfo } = useERP();

  const [produtos, setProdutos] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [mapaFatores, setMapaFatores] = useState({}); // insumo_id -> fator_empanamento
  const [loading, setLoading] = useState(true);

  // Várias propostas por evento (ex.: R$60/pessoa, R$90/pessoa). Cada uma tem
  // seu próprio evento + itens. `ativaId` diz qual está sendo editada.
  const [propostas, setPropostas] = useState(() => [novaProposta("Proposta 1")]);
  const [ativaId, setAtivaId] = useState(null);

  const ativa = propostas.find(p => p.id === ativaId) || propostas[0];
  const evento = ativa.evento;
  const itens = ativa.itens;
  const setEvento = (u) => setPropostas(ps => ps.map(p => p.id === ativa.id ? { ...p, evento: typeof u === "function" ? u(p.evento) : u } : p));
  const setItens = (u) => setPropostas(ps => ps.map(p => p.id === ativa.id ? { ...p, itens: typeof u === "function" ? u(p.itens) : u } : p));

  useEffect(() => {
    if (!unidadeAtiva) return;
    (async () => {
      setLoading(true);
      const [resProd, resFichas, resInsumos] = await Promise.all([
        fetchProdutos(unidadeAtiva),
        fetchFichas(unidadeAtiva),
        fetchInsumos(unidadeAtiva),
      ]);
      setProdutos(resProd.data || []);
      setFichas(resFichas.data || []);
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

  const convidados = Number(evento.convidados) || 0;

  // Linhas calculadas: produto + ficha + custos + venda.
  // Quantidade pode ser em porções, g ou kg — convertida pelo peso da porção
  // (vem da ficha técnica, mas é editável por item: média por unidade de
  // bolinho, peixe empanado etc).
  const linhas = itens.map(it => {
    const produto = produtos.find(p => p.id === it.produto_id);
    if (!produto) return null;
    const ficha = produto.ficha_id ? fichas.find(f => f.id === produto.ficha_id) : null;
    const qtd = Number(it.qtd) || 0;
    const un = it.un || "porcao";
    const pesoUn = Number(it.pesoUn) || Number(ficha?.peso_porcao_g) || 0; // g por porção/unidade

    // Converte a quantidade digitada para nº de porções
    let porcoes = qtd;
    if (un === "g") porcoes = pesoUn > 0 ? qtd / pesoUn : 0;
    if (un === "kg") porcoes = pesoUn > 0 ? (qtd * 1000) / pesoUn : 0;

    const gramasTotal = pesoUn > 0 ? porcoes * pesoUn : null;
    // Custo por porção real (usa peso quando o rendimento é em kg/g/l/ml)
    const custoPorcao = ficha ? custoTotalDaFicha(ficha, fichas) / porcoesDaFicha(ficha) : 0;
    // Preço de venda: o que você definir no item (default = preço do cardápio)
    const precoVenda = it.precoVenda !== undefined && it.precoVenda !== ""
      ? Number(it.precoVenda) || 0
      : (Number(produto.preco_venda) || 0);
    const precoCardapio = Number(produto.preco_venda) || 0;

    // "Cobrar como in natura": se a ficha usa um ingrediente empanado, o cliente
    // pode ser cobrado como se fosse o ingrediente puro (mais caro), aplicando o
    // fator de empanamento sobre o preço. Ex.: peixe rende 1,36x → cobra +36%.
    const fatorInNatura = ficha ? fatorInNaturaDaFicha(ficha, fichas, mapaFatores) : 1;
    const inNatura = !!it.inNatura && fatorInNatura > 1;
    const precoEfetivo = inNatura ? precoVenda * fatorInNatura : precoVenda;

    const vendaTotal = precoEfetivo * porcoes;
    return {
      produto_id: it.produto_id,
      nome: produto.nome_produto,
      categoria: produto.categoria,
      departamento: produto.departamento,
      ficha,
      qtd,
      un,
      pesoUn,
      porcoes,
      gramasTotal,
      unPorKg: pesoUn > 0 ? 1000 / pesoUn : null,
      vendaPorKg: pesoUn > 0 ? precoEfetivo * (1000 / pesoUn) : null,
      custoPorcao,
      custoTotal: custoPorcao * porcoes,
      precoVenda,
      precoCardapio,
      precoEditado: precoVenda !== precoCardapio,
      fatorInNatura,
      inNatura,
      precoEfetivo,
      vendaTotal,
      // Duplo benefício do empanado: ganho no preço (exato) + economia no custo (estimada)
      ganhoInNatura: inNatura ? (precoEfetivo - precoVenda) * porcoes : 0,
      economiaEmpanado: fatorInNatura > 1 ? (custoPorcao * porcoes) * (1 - 1 / fatorInNatura) : 0,
    };
  }).filter(Boolean);

  const custoEvento = linhas.reduce((a, l) => a + l.custoTotal, 0);
  const vendaEvento = linhas.reduce((a, l) => a + l.vendaTotal, 0);
  const vendaPorConvidado = convidados > 0 ? vendaEvento / convidados : null;
  const custoPorConvidado = convidados > 0 ? custoEvento / convidados : null;

  // Benefícios do empanado
  const ganhoInNaturaTotal = linhas.reduce((a, l) => a + l.ganhoInNatura, 0);
  const economiaEmpanadoTotal = linhas.reduce((a, l) => a + l.economiaEmpanado, 0);

  // Vendas do bar (parceria) e comissão
  const vendaBar = linhas.filter(l => String(l.departamento).toLowerCase() === "bar").reduce((a, l) => a + l.vendaTotal, 0);
  const parceriaBarPct = evento.parceria_bar_ativa ? (Number(evento.parceria_bar_pct) || 0) : 0;
  const parceriaBar = vendaBar * (parceriaBarPct / 100);
  const comissaoPct = Number(evento.comissao_pct) || 0;
  const comissao = vendaEvento * (comissaoPct / 100);
  const lucroEvento = vendaEvento - custoEvento - comissao - parceriaBar;

  // Lista de compras: agrega os insumos crus de todas as fichas do evento
  const compras = (() => {
    const acc = {};
    linhas.forEach(l => { if (l.ficha && l.porcoes > 0) acumularInsumos(l.ficha, l.porcoes, fichas, acc); });
    return Object.values(acc)
      .map(c => ({ ...c, custoCompra: c.qtd * c.custo_unitario }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  })();
  const totalCompras = compras.reduce((a, c) => a + c.custoCompra, 0);

  const addItem = (produtoId) => {
    if (!produtoId || itens.find(i => i.produto_id === produtoId)) return;
    const produto = produtos.find(p => p.id === produtoId);
    const ficha = produto?.ficha_id ? fichas.find(f => f.id === produto.ficha_id) : null;
    setItens([...itens, { produto_id: produtoId, qtd: convidados > 0 ? convidados : 1, un: "porcao", pesoUn: ficha?.peso_porcao_g || "", precoVenda: produto?.preco_venda ?? "" }]);
  };
  const updateItem = (produtoId, patch) => setItens(lista => lista.map(i => i.produto_id === produtoId ? { ...i, ...patch } : i));
  const removeItem = (produtoId) => setItens(lista => lista.filter(i => i.produto_id !== produtoId));
  const limparTudo = () => {
    if (confirm("Limpar todo o orçamento?")) { setEvento({ nome: "", cliente: "", data: "", convidados: "", comissao_pct: "", parceria_bar_ativa: false, parceria_bar_pct: "30" }); setItens([]); }
  };

  const cabecalhoDoc = (titulo) => `
     <div class="head">
        <div class="tag">${titulo} — ${unidadeInfo?.nome || ''}</div>
        <h1>${evento.nome || 'Evento'}</h1>
        <div class="meta">
           ${evento.cliente ? `Cliente: <b>${evento.cliente}</b> · ` : ''}
           ${evento.data ? `Data: <b>${evento.data.split('-').reverse().join('/')}</b> · ` : ''}
           Convidados: <b>${convidados || '—'}</b>
        </div>
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
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return alert("Habilite os popups para imprimir.");
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
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
       <div class="totais">
          ${vendaPorConvidado !== null ? `<div class="linha"><span>Valor por convidado (${convidados})</span><b>${fmtBRL(vendaPorConvidado)}</b></div>` : ''}
          <div class="linha destaque"><span>Valor Total do Evento</span><span>${fmtBRL(vendaEvento)}</span></div>
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

  // Documento 3: RELATÓRIO GERENCIAL — faturamento, custos, lucro, comissão,
  // parceria de bar e o duplo benefício do empanado (uso interno).
  const imprimirRelatorio = () => {
    if (linhas.length === 0) return alert("Adicione itens ao evento primeiro.");
    const linha = (rotulo, valor, cor) => `<div class="linha"><span>${rotulo}</span><b${cor ? ` style="color:${cor}"` : ''}>${valor}</b></div>`;
    const lucroPct = vendaEvento > 0 ? (lucroEvento / vendaEvento) * 100 : 0;

    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Relatório - ${evento.nome || 'Evento'}</title>${estiloDoc}</head><body>
       ${cabecalhoDoc('Relatório Gerencial')}

       <h2>Resultado do Evento</h2>
       <div class="totais" style="border-top:none;margin-top:0">
          ${linha('Faturamento (vendas)', fmtBRL(vendaEvento))}
          ${linha('− Custo de ingredientes', fmtBRL(custoEvento))}
          ${comissaoPct > 0 ? linha(`− Comissão (${comissaoPct}%)`, fmtBRL(comissao)) : ''}
          ${parceriaBar > 0 ? linha(`− Parceria bar (${parceriaBarPct}% de ${fmtBRL(vendaBar)})`, fmtBRL(parceriaBar)) : ''}
          <div class="linha destaque"><span>Lucro do evento (${lucroPct.toFixed(1)}%)</span><span style="color:${lucroEvento >= 0 ? '#059669' : '#dc2626'}">${fmtBRL(lucroEvento)}</span></div>
          ${convidados > 0 ? linha('Lucro por convidado', fmtBRL(lucroEvento / convidados)) : ''}
       </div>

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
    let venda = 0, itensCount = 0;
    (prop.itens || []).forEach(it => {
      const produto = produtos.find(p => p.id === it.produto_id);
      if (!produto) return;
      itensCount++;
      const ficha = produto.ficha_id ? fichas.find(f => f.id === produto.ficha_id) : null;
      const qtd = Number(it.qtd) || 0;
      const un = it.un || "porcao";
      const pesoUn = Number(it.pesoUn) || Number(ficha?.peso_porcao_g) || 0;
      let porcoes = qtd;
      if (un === "g") porcoes = pesoUn > 0 ? qtd / pesoUn : 0;
      if (un === "kg") porcoes = pesoUn > 0 ? (qtd * 1000) / pesoUn : 0;
      const precoV = it.precoVenda !== undefined && it.precoVenda !== "" ? Number(it.precoVenda) || 0 : (Number(produto.preco_venda) || 0);
      const fator = ficha ? fatorInNaturaDaFicha(ficha, fichas, mapaFatores) : 1;
      const precoEf = (it.inNatura && fator > 1) ? precoV * fator : precoV;
      venda += precoEf * porcoes;
    });
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

      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
                 <PartyPopper size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Orçamento de Eventos</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Buffet: custos, compras e valor por convidado</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={imprimirOrcamento} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg">
                  <FileText size={18} /> Orçamento (Cliente)
               </button>
               <button onClick={imprimirInterno} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm">
                  <Printer size={18} /> Compras (Interno)
               </button>
               <button onClick={imprimirRelatorio} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm">
                  <FileText size={18} /> Relatório Gerencial
               </button>
               {propostas.length > 1 && (
                  <button onClick={imprimirComparacao} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg">
                     <FileText size={18} /> Comparar Propostas
                  </button>
               )}
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

         {/* COLUNA ESQUERDA: dados do evento + itens */}
         <div className="space-y-6">

            {/* Abas de propostas (ex.: R$60/pessoa, R$90/pessoa) */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
               <div className="flex items-center gap-2 flex-wrap">
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
               </div>
               <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proposta ativa: {ativa.nome}</span>
                  <button onClick={renomearProposta} className="text-[10px] font-bold text-slate-500 hover:text-slate-800">Renomear</button>
                  <button onClick={duplicarProposta} className="text-[10px] font-bold text-slate-500 hover:text-slate-800">Duplicar</button>
                  {propostas.length > 1 && <button onClick={removerProposta} className="text-[10px] font-bold text-red-400 hover:text-red-600">Remover</button>}
               </div>
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
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data</label>
                     <input type="date" value={evento.data} onChange={e=>setEvento({...evento, data: e.target.value})} className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-700"/>
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> Nº de Convidados</label>
                     <input type="number" min="0" placeholder="Ex: 80" value={evento.convidados} onChange={e=>setEvento({...evento, convidados: e.target.value})} className="w-full p-3.5 mt-1 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500"/>
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
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Itens do Buffet — preço sugerido do cardápio, editável por item</p>
               <select onChange={e => { addItem(e.target.value); e.target.value = ""; }} disabled={loading} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-emerald-500 mb-4">
                  <option value="">{loading ? "Carregando cardápio..." : "+ Adicionar produto do cardápio..."}</option>
                  {produtos.filter(p => !itens.find(i => i.produto_id === p.id)).map(p => (
                     <option key={p.id} value={p.id}>{p.nome_produto} ({p.categoria}) — {fmtBRL(p.preco_venda)}</option>
                  ))}
               </select>

               {linhas.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 font-medium text-sm">
                     Adicione os produtos do buffet. Custos e lista de compras saem das Fichas Técnicas vinculadas.
                  </div>
               ) : (
                  <div className="space-y-3">
                     {linhas.map(l => (
                        <div key={l.produto_id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                           <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex-1 min-w-[150px]">
                                 <p className="font-black text-slate-800 truncate">{l.nome}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{l.categoria}{!l.ficha && <span className="text-red-500"> · sem ficha técnica</span>}</p>
                              </div>
                              <div className="text-center">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Quantidade</label>
                                 <div className="flex gap-1">
                                    <input type="number" min="0" step="0.01" value={l.qtd} onChange={e=>updateItem(l.produto_id, { qtd: e.target.value })} className="w-20 p-2 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"/>
                                    <select value={l.un} onChange={e=>updateItem(l.produto_id, { un: e.target.value })} className="p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 text-xs outline-none focus:border-emerald-500">
                                       <option value="porcao">porções</option>
                                       {l.pesoUn > 0 && <option value="g">g</option>}
                                       {l.pesoUn > 0 && <option value="kg">kg</option>}
                                    </select>
                                 </div>
                              </div>
                              <div className="text-center">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block" title="Peso médio de cada porção/unidade. Vem da ficha técnica, mas você pode ajustar.">Peso/un (g)</label>
                                 <input type="number" min="0" step="0.1" placeholder="ex: 35" value={itens.find(i=>i.produto_id===l.produto_id)?.pesoUn ?? ""} onChange={e=>updateItem(l.produto_id, { pesoUn: e.target.value })} className="w-20 p-2 text-center bg-white border border-slate-200 rounded-lg font-bold text-slate-600 outline-none focus:border-emerald-500"/>
                              </div>
                              <div className="text-center">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block" title="Preço de venda por porção só deste orçamento. Vem do cardápio, mas você pode definir o valor que quiser.">Preço/porção</label>
                                 <input type="number" min="0" step="0.01" placeholder="0,00" value={itens.find(i=>i.produto_id===l.produto_id)?.precoVenda ?? ""} onChange={e=>updateItem(l.produto_id, { precoVenda: e.target.value })} className={`w-24 p-2 text-center rounded-lg font-black outline-none focus:border-emerald-500 ${l.precoEditado ? 'bg-amber-50 border border-amber-300 text-amber-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}/>
                              </div>
                              <button onClick={() => removeItem(l.produto_id)} className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-lg border border-slate-200"><Trash2 size={15}/></button>
                           </div>

                           {l.precoEditado && (
                              <p className="text-[10px] font-bold text-amber-600 mt-2 flex items-center gap-2">
                                 Preço personalizado (cardápio: {fmtBRL(l.precoCardapio)})
                                 <button onClick={() => updateItem(l.produto_id, { precoVenda: l.precoCardapio })} className="underline hover:text-amber-700">usar o do cardápio</button>
                              </p>
                           )}

                           {/* Empanado: cobrar como in natura (peixe puro, mais caro) */}
                           {l.fatorInNatura > 1 && (
                              <label className="flex items-center gap-2 mt-2 cursor-pointer bg-sky-50 border border-sky-200 rounded-lg p-2">
                                 <input type="checkbox" checked={l.inNatura} onChange={e=>updateItem(l.produto_id, { inNatura: e.target.checked })} className="w-4 h-4 accent-sky-600"/>
                                 <span className="text-[10px] font-bold text-sky-700 leading-tight">
                                    Cobrar como in natura (+{((l.fatorInNatura - 1) * 100).toFixed(0)}%) — ingrediente empanado
                                    {l.inNatura && <span className="text-sky-500"> · {fmtBRL(l.precoVenda)} → {fmtBRL(l.precoEfetivo)}/porção</span>}
                                 </span>
                              </label>
                           )}

                           {/* Equivalências: porção em gramas, rendimento por kg e preço do kg */}
                           {l.pesoUn > 0 && (
                              <p className="text-[10px] font-bold text-slate-400 mt-2">
                                 Porção: {l.pesoUn}g · 1 kg rende <span className="text-slate-600">{(+l.unPorKg.toFixed(1)).toLocaleString("pt-BR")} un</span> · 1 kg = <span className="text-emerald-600">{fmtBRL(l.vendaPorKg)}</span>
                              </p>
                           )}

                           <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200/70 text-xs font-bold gap-2 flex-wrap">
                              <span className="text-slate-500">
                                 {l.porcoes > 0 && (
                                    <>= {(+l.porcoes.toFixed(1)).toLocaleString("pt-BR")} porç{l.porcoes >= 2 ? 'ões' : 'ão'}{l.gramasTotal ? ` · ${fmtCompra(l.gramasTotal / 1000, 'kg')}` : ''} · </>
                                 )}
                                 Custo: <span className="text-slate-700">{fmtBRL(l.custoTotal)}</span>{convidados > 0 && l.porcoes > 0 ? ` · ${(l.porcoes / convidados).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} porção/convidado` : ''}
                              </span>
                              <span className="text-emerald-600 font-black">Venda: {fmtBRL(l.vendaTotal)}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </div>

         {/* COLUNA DIREITA: resumo + compras */}
         <div className="space-y-6 lg:sticky lg:top-28">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Resumo do Evento</p>
               <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400 font-bold">Faturamento</span><span className="font-black">{fmtBRL(vendaEvento)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 font-bold">− Custo ingredientes</span><span className="font-black">{fmtBRL(custoEvento)}</span></div>
                  {comissao > 0 && <div className="flex justify-between"><span className="text-slate-400 font-bold">− Comissão ({comissaoPct}%)</span><span className="font-black">{fmtBRL(comissao)}</span></div>}
                  {parceriaBar > 0 && <div className="flex justify-between"><span className="text-slate-400 font-bold">− Parceria bar ({parceriaBarPct}%)</span><span className="font-black">{fmtBRL(parceriaBar)}</span></div>}
                  {(economiaEmpanadoTotal > 0 || ganhoInNaturaTotal > 0) && (
                     <div className="flex justify-between bg-sky-500/10 -mx-2 px-2 py-1.5 rounded-lg">
                        <span className="text-sky-300 font-bold">Benefício empanado</span>
                        <span className="font-black text-sky-300">+{fmtBRL(economiaEmpanadoTotal + ganhoInNaturaTotal)}</span>
                     </div>
                  )}
                  <div className="border-t border-slate-700 pt-3 mt-3">
                     {convidados > 0 && (
                        <div className="flex justify-between items-center mb-1">
                           <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Lucro / convidado</span>
                           <span className="font-black text-lg">{fmtBRL(lucroEvento / convidados)}</span>
                        </div>
                     )}
                     <div className="flex justify-between items-center">
                        <span className="text-slate-300 font-bold text-xs uppercase tracking-widest">Lucro do evento</span>
                        <span className={`font-black text-2xl ${lucroEvento >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtBRL(lucroEvento)}</span>
                     </div>
                     {vendaPorConvidado !== null && (
                        <p className="text-[10px] font-bold text-slate-500 mt-1 text-right">Venda: {fmtBRL(vendaEvento)} · {fmtBRL(vendaPorConvidado)}/convidado</p>
                     )}
                  </div>
               </div>
            </div>

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
    </div>
  );
}
