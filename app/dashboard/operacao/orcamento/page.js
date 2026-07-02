"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { PartyPopper, Printer, Trash2, ArrowLeft, Users, ShoppingCart, FileText } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

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

// Formata quantidade de compra: kg/l pequenos viram g/ml; un arredonda pra cima
function fmtCompra(qtd, unidade) {
  const u = String(unidade || "").toLowerCase();
  if (u === "kg") return qtd < 1 ? `${Math.ceil(qtd * 1000)} g` : `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} kg`;
  if (u === "l") return qtd < 1 ? `${Math.ceil(qtd * 1000)} ml` : `${(+qtd.toFixed(3)).toLocaleString("pt-BR")} L`;
  return `${Math.ceil(qtd)} un`;
}

const DRAFT_KEY = "orcamento_evento_draft";

export default function OrcamentoEventoPage() {
  const { abrirMenu, unidadeAtiva, unidadeInfo } = useERP();

  const [produtos, setProdutos] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [evento, setEvento] = useState({ nome: "", cliente: "", data: "", convidados: "" });
  const [itens, setItens] = useState([]); // [{ produto_id, qtd }]

  useEffect(() => {
    if (!unidadeAtiva) return;
    (async () => {
      setLoading(true);
      const [resProd, resFichas] = await Promise.all([
        fetchProdutos(unidadeAtiva),
        fetchFichas(unidadeAtiva),
      ]);
      setProdutos(resProd.data || []);
      setFichas(resFichas.data || []);
      setLoading(false);
    })();
  }, [unidadeAtiva]);

  // Rascunho no navegador: não perde o evento se der refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.evento) setEvento(d.evento);
        if (Array.isArray(d.itens)) setItens(d.itens);
      }
    } catch { /* rascunho corrompido: ignora */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ evento, itens })); } catch { }
  }, [evento, itens]);

  const convidados = Number(evento.convidados) || 0;

  // Linhas calculadas: produto + ficha + custos + venda
  const linhas = itens.map(it => {
    const produto = produtos.find(p => p.id === it.produto_id);
    if (!produto) return null;
    const ficha = produto.ficha_id ? fichas.find(f => f.id === produto.ficha_id) : null;
    const qtd = Number(it.qtd) || 0;
    const custoPorcao = ficha ? custoTotalDaFicha(ficha, fichas) / (ficha.rendimento_porcoes || 1) : 0;
    const precoVenda = Number(produto.preco_venda) || 0;
    return {
      produto_id: it.produto_id,
      nome: produto.nome_produto,
      categoria: produto.categoria,
      ficha,
      qtd,
      custoPorcao,
      custoTotal: custoPorcao * qtd,
      precoVenda,
      vendaTotal: precoVenda * qtd,
    };
  }).filter(Boolean);

  const custoEvento = linhas.reduce((a, l) => a + l.custoTotal, 0);
  const vendaEvento = linhas.reduce((a, l) => a + l.vendaTotal, 0);
  const vendaPorConvidado = convidados > 0 ? vendaEvento / convidados : null;
  const custoPorConvidado = convidados > 0 ? custoEvento / convidados : null;

  // Lista de compras: agrega os insumos crus de todas as fichas do evento
  const compras = (() => {
    const acc = {};
    linhas.forEach(l => { if (l.ficha && l.qtd > 0) acumularInsumos(l.ficha, l.qtd, fichas, acc); });
    return Object.values(acc)
      .map(c => ({ ...c, custoCompra: c.qtd * c.custo_unitario }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  })();
  const totalCompras = compras.reduce((a, c) => a + c.custoCompra, 0);

  const addItem = (produtoId) => {
    if (!produtoId || itens.find(i => i.produto_id === produtoId)) return;
    setItens([...itens, { produto_id: produtoId, qtd: convidados > 0 ? convidados : 1 }]);
  };
  const updateQtd = (produtoId, qtd) => setItens(lista => lista.map(i => i.produto_id === produtoId ? { ...i, qtd } : i));
  const removeItem = (produtoId) => setItens(lista => lista.filter(i => i.produto_id !== produtoId));
  const limparTudo = () => {
    if (confirm("Limpar todo o orçamento?")) { setEvento({ nome: "", cliente: "", data: "", convidados: "" }); setItens([]); }
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

  // Documento 1: ORÇAMENTO para o cliente (sem custos internos)
  const imprimirOrcamento = () => {
    if (linhas.length === 0) return alert("Adicione itens ao evento primeiro.");
    const rows = linhas.map(l =>
      `<tr><td>${l.nome}</td><td class="c">${l.qtd}</td><td class="r">${fmtBRL(l.precoVenda)}</td><td class="r">${fmtBRL(l.vendaTotal)}</td></tr>`
    ).join('');
    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Orçamento - ${evento.nome || 'Evento'}</title>${estiloDoc}</head><body>
       ${cabecalhoDoc('Orçamento de Buffet')}
       <h2>Itens do Buffet</h2>
       <table>
          <thead><tr><th>Item</th><th class="c">Porções</th><th class="r">Valor Unit.</th><th class="r">Valor Total</th></tr></thead>
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
      `<tr><td>${l.nome}${!l.ficha ? ' *' : ''}</td><td class="c">${l.qtd}</td><td class="r">${fmtBRL(l.custoPorcao)}</td><td class="r">${fmtBRL(l.custoTotal)}</td><td class="r">${fmtBRL(l.vendaTotal)}</td></tr>`
    ).join('');
    const rowsCompras = compras.map(c =>
      `<tr><td>${c.nome}</td><td class="c">${fmtCompra(c.qtd, c.unidade)}</td><td class="r">${fmtBRL(c.custo_unitario)}/${c.unidade}</td><td class="r">${fmtBRL(c.custoCompra)}</td></tr>`
    ).join('');
    const temSemFicha = linhas.some(l => !l.ficha);
    abrirDoc(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Produção e Compras - ${evento.nome || 'Evento'}</title>${estiloDoc}</head><body>
       ${cabecalhoDoc('Produção e Compras (uso interno)')}
       <h2>Produção do Buffet</h2>
       <table>
          <thead><tr><th>Item</th><th class="c">Porções</th><th class="r">Custo/Porção</th><th class="r">Custo Total</th><th class="r">Venda</th></tr></thead>
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
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

         {/* COLUNA ESQUERDA: dados do evento + itens */}
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dados do Evento</p>
                  <button onClick={limparTudo} className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest">Limpar tudo</button>
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
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Itens do Buffet (do Cardápio)</p>
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
                           <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                 <p className="font-black text-slate-800 truncate">{l.nome}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{l.categoria}{!l.ficha && <span className="text-red-500"> · sem ficha técnica</span>}</p>
                              </div>
                              <div className="text-center">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Porções</label>
                                 <input type="number" min="0" value={l.qtd} onChange={e=>updateQtd(l.produto_id, e.target.value)} className="w-20 p-2 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"/>
                              </div>
                              <button onClick={() => removeItem(l.produto_id)} className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-lg border border-slate-200"><Trash2 size={15}/></button>
                           </div>
                           <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200/70 text-xs font-bold">
                              <span className="text-slate-500">Custo: <span className="text-slate-700">{fmtBRL(l.custoTotal)}</span>{convidados > 0 && l.qtd > 0 ? ` · ${(l.qtd / convidados).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} porção/convidado` : ''}</span>
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
                  <div className="flex justify-between"><span className="text-slate-400 font-bold">Custo (ingredientes)</span><span className="font-black">{fmtBRL(custoEvento)}</span></div>
                  {custoPorConvidado !== null && <div className="flex justify-between"><span className="text-slate-400 font-bold">Custo / convidado</span><span className="font-black">{fmtBRL(custoPorConvidado)}</span></div>}
                  <div className="flex justify-between"><span className="text-slate-400 font-bold">Margem estimada</span><span className="font-black text-emerald-400">{fmtBRL(vendaEvento - custoEvento)}</span></div>
                  <div className="border-t border-slate-700 pt-3 mt-3">
                     {vendaPorConvidado !== null && (
                        <div className="flex justify-between items-center mb-1">
                           <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Por convidado</span>
                           <span className="font-black text-lg">{fmtBRL(vendaPorConvidado)}</span>
                        </div>
                     )}
                     <div className="flex justify-between items-center">
                        <span className="text-slate-300 font-bold text-xs uppercase tracking-widest">Total (venda)</span>
                        <span className="font-black text-2xl text-emerald-400">{fmtBRL(vendaEvento)}</span>
                     </div>
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
