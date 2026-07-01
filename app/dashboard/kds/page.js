"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import { fetchItensKDS, atualizarStatusKDS } from "../../lib/vendas";
import { supabase, isSupabaseReady } from "../../lib/supabase";
import { ArrowLeft, Clock, Maximize, ChefHat, GlassWater, ChevronUp, ChevronDown, Check, Play, Bike, Utensils, Printer, Phone, MapPin, X } from "lucide-react";

// Estágios do quadro (kanban de cozinha)
const COLUNAS = [
  { id: "fila",       titulo: "Na fila",    cor: "#64748b" },
  { id: "preparando", titulo: "Preparando", cor: "#d97706" },
  { id: "pronto",     titulo: "Pronto",     cor: "#059669" },
];

const ehDelivery = (t) => ["delivery", "ifood", "cardapio", "qrcode"].includes(t);

function tipoBadge(t) {
  if (t === "ifood") return { label: "iFood", cls: "bg-red-100 text-red-700" };
  if (t === "balcao") return { label: "Balcão", cls: "bg-emerald-100 text-emerald-700" };
  if (ehDelivery(t)) return { label: "Online", cls: "bg-purple-100 text-purple-700" };
  return { label: "Mesa", cls: "bg-blue-100 text-blue-700" };
}

function KDSRunner() {
  const { abrirMenu, unidadeAtiva } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "todos"; // 'cozinha' | 'bar' | 'todos'

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordemFila, setOrdemFila] = useState([]); // prioridade manual (array de pedidoId)
  const [stats, setStats] = useState({ itens: 0, pedidos: 0, delivery: 0, mesa: 0 });
  const [confirmItem, setConfirmItem] = useState(null); // item aguardando confirmacao
  const [detalhe, setDetalhe] = useState(null); // { pedido, info } — painel de detalhe
  const containerRef = useRef(null);

  const acaoLabel = (status) => ({
    pendente: "Iniciar o preparo deste item",
    preparando: "Marcar este item como pronto",
    pronto: "Marcar este item como entregue",
  }[status] || "Avançar item");

  const carregar = async () => {
    if (itens.length === 0) setLoading(true);
    const { data } = await fetchItensKDS(unidadeAtiva, deptUrl);
    setItens(data || []);
    setLoading(false);
  };

  // Contadores do turno (feitos hoje): itens, pedidos, delivery x mesa
  const carregarStats = async () => {
    if (!isSupabaseReady() || !unidadeAtiva) return;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("pedidos_itens")
      .select("id, quantidade, status_kds, pedidos!inner(id, tipo_pedido, unidade_id, created_at)")
      .eq("pedidos.unidade_id", unidadeAtiva)
      .gte("pedidos.created_at", hoje.toISOString());
    if (!data) return;
    const feitos = data.filter(i => ["pronto", "entregue"].includes(i.status_kds));
    const itensFeitos = feitos.reduce((a, i) => a + (i.quantidade || 1), 0);
    const tipoPorPedido = {};
    feitos.forEach(i => { tipoPorPedido[i.pedidos.id] = i.pedidos.tipo_pedido; });
    let delivery = 0, mesa = 0;
    Object.values(tipoPorPedido).forEach(t => { ehDelivery(t) ? delivery++ : mesa++; });
    setStats({ itens: itensFeitos, pedidos: Object.keys(tipoPorPedido).length, delivery, mesa });
  };

  useEffect(() => {
    if (!unidadeAtiva) return;
    carregar(); carregarStats();
    const intervalo = setInterval(() => { carregar(); carregarStats(); }, 5000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva, deptUrl]);

  // Avança um item: pendente -> preparando -> pronto -> entregue
  const avancarItem = async (item) => {
    const prox = { pendente: "preparando", preparando: "pronto", pronto: "entregue" }[item.status_kds];
    if (!prox) return;
    setItens(atual => atual.map(i => i.id === item.id ? { ...i, status_kds: prox } : i));
    await atualizarStatusKDS(item.id, prox);
  };

  // Avança o pedido inteiro (todos os itens do estágio atual)
  const avancarPedido = async (pedido) => {
    const de = pedido.stage === "fila" ? "pendente" : pedido.stage === "preparando" ? "preparando" : "pronto";
    const prox = { pendente: "preparando", preparando: "pronto", pronto: "entregue" }[de];
    const alvo = pedido.itens.filter(i => i.status_kds === de);
    setItens(atual => atual.map(i => alvo.find(a => a.id === i.id) ? { ...i, status_kds: prox } : i));
    for (const i of alvo) await atualizarStatusKDS(i.id, prox);
  };

  const moverFila = (pedidoId, dir, ordemAtual) => {
    const i = ordemAtual.indexOf(pedidoId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordemAtual.length) return;
    const novo = [...ordemAtual];
    [novo[i], novo[j]] = [novo[j], novo[i]];
    setOrdemFila(novo);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // Abre o painel de detalhe do pedido (busca cliente/telefone/endereco)
  const abrirDetalhe = async (pedido) => {
    setDetalhe({ pedido, info: null });
    if (!isSupabaseReady()) return;
    const { data } = await supabase.from("pedidos")
      .select("cliente_nome, cliente_telefone, endereco_entrega, forma_pagamento, identificacao, created_at")
      .eq("id", pedido.pedidoId).maybeSingle();
    setDetalhe(d => (d && d.pedido.pedidoId === pedido.pedidoId) ? { ...d, info: data } : d);
  };

  // Imprime a via da cozinha do pedido (itens + obs, sem precos)
  const imprimirVia = (pedido) => {
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return alert("Habilite os popups para imprimir a via.");
    const agora = new Date().toLocaleString('pt-BR');
    const ident = pedido.numero_mesa ? 'MESA ' + pedido.numero_mesa : (pedido.cliente_nome || '#' + pedido.pedidoId.substring(0, 4));
    const itensHtml = pedido.itens.filter(i => i.status_kds !== 'entregue').map(it => `
       <div class="item"><span class="q">${it.quantidade}x</span> ${it.produtos?.nome_produto || 'Item'}${it.observacao ? `<div class="obs">OBS: ${it.observacao}</div>` : ''}</div>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Via da Cozinha</title><style>
       *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;width:80mm;padding:4mm;color:#000}
       .center{text-align:center}.big{font-size:20px;font-weight:bold}.sep{border-top:1px dashed #000;margin:8px 0}
       .item{font-size:16px;font-weight:bold;margin:8px 0}.item .q{font-size:19px}.obs{font-size:12px;font-weight:normal;margin:2px 0 0 6px}
       @media print{@page{margin:0;size:80mm auto}}
    </style></head><body>
       <div class="center big">COZINHA</div><div class="center">${ident}</div>
       <div class="center" style="font-size:10px">${agora}</div><div class="sep"></div>${itensHtml}<div class="sep"></div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  // Agrupa itens (não entregues) em pedidos e calcula o estágio
  const pedidos = Object.values(itens.reduce((acc, it) => {
    if (it.status_kds === "entregue") return acc;
    const pId = it.pedidos?.id;
    if (!pId) return acc;
    if (!acc[pId]) acc[pId] = {
      pedidoId: pId,
      tipo_pedido: it.pedidos.tipo_pedido,
      cliente_nome: it.pedidos.cliente_nome,
      numero_mesa: it.pedidos.mesas?.numero_mesa,
      created_at: it.pedidos.created_at || it.created_at,
      itens: [],
    };
    acc[pId].itens.push(it);
    return acc;
  }, {})).map(p => {
    const s = p.itens.map(i => i.status_kds);
    p.stage = s.includes("pendente") ? "fila" : s.includes("preparando") ? "preparando" : "pronto";
    return p;
  });

  const identificacao = (p) => {
    if (p.tipo_pedido === "ifood" || ehDelivery(p.tipo_pedido))
      return p.cliente_nome ? p.cliente_nome.split(" ")[0] : `#${p.pedidoId.substring(0, 4)}`;
    if (p.tipo_pedido === "balcao") return `#${p.pedidoId.substring(0, 4)}`;
    return `Mesa ${p.numero_mesa || "?"}`;
  };

  const pedidosPorColuna = (colId) => {
    let lista = pedidos.filter(p => p.stage === colId);
    if (colId === "fila") {
      const idx = id => { const i = ordemFila.indexOf(id); return i === -1 ? 9999 : i; };
      lista = [...lista].sort((a, b) => (idx(a.pedidoId) - idx(b.pedidoId)) || (new Date(a.created_at) - new Date(b.created_at)));
    } else {
      lista = [...lista].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return lista;
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => abrirMenu()} className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            {deptUrl === "bar" ? <GlassWater size={20} /> : <ChefHat size={20} />}
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900">Cozinha — KDS</h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{deptUrl === "todos" ? "Todos os setores" : deptUrl} • Tempo real</p>
          </div>
        </div>

        {/* Contadores do turno */}
        <div className="hidden md:flex items-center gap-2">
          {[
            { l: "Itens feitos", v: stats.itens, i: <Check size={14} /> },
            { l: "Pedidos", v: stats.pedidos, i: <Utensils size={14} /> },
            { l: "Delivery", v: stats.delivery, i: <Bike size={14} /> },
            { l: "Mesa", v: stats.mesa, i: <Utensils size={14} /> },
          ].map((k, idx) => (
            <div key={idx} className="px-3 py-1.5 bg-slate-50 rounded-xl text-center min-w-[74px] border border-slate-100">
              <p className="text-lg font-black text-slate-800 leading-none">{k.v}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">{k.i}{k.l}</p>
            </div>
          ))}
          <button onClick={toggleFullscreen} className="p-2.5 ml-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors" title="Tela cheia">
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {/* Quadro */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUNAS.map(col => {
          const lista = pedidosPorColuna(col.id);
          const ordemAtual = lista.map(p => p.pedidoId);
          return (
            <div key={col.id} className="bg-slate-200/40 rounded-2xl p-3 flex flex-col min-h-[200px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.cor }} />
                <span className="font-black text-sm text-slate-700">{col.titulo}</span>
                <span className="text-xs font-bold text-slate-500 bg-white rounded-full px-2 py-0.5">{lista.length}</span>
              </div>

              <div className="flex flex-col gap-3">
                {loading && itens.length === 0 && <p className="text-center text-slate-400 text-sm font-bold py-8">Carregando…</p>}
                {!loading && lista.length === 0 && (
                  <div className="text-center text-slate-400 text-xs font-bold py-10 border-2 border-dashed border-slate-200 rounded-xl">
                    {col.id === "fila" ? "Nenhum pedido na fila" : col.id === "preparando" ? "Nada em preparo" : "Nada pronto ainda"}
                  </div>
                )}

                {lista.map((p, pi) => {
                  const badge = tipoBadge(p.tipo_pedido);
                  const minPedido = Math.floor((Date.now() - new Date(p.created_at)) / 60000);
                  return (
                    <div key={p.pedidoId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-100">
                        <button onClick={() => abrirDetalhe(p)} className="flex items-center gap-2 min-w-0 group/head">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>
                          <span className="font-black text-slate-800 text-sm truncate group-hover/head:underline">{identificacao(p)}</span>
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><Clock size={12} />{minPedido}m</span>
                          <button onClick={() => imprimirVia(p)} title="Imprimir via" className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"><Printer size={14} /></button>
                          {col.id === "fila" && (
                            <div className="flex flex-col">
                              <button onClick={() => moverFila(p.pedidoId, -1, ordemAtual)} disabled={pi === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 leading-none"><ChevronUp size={16} /></button>
                              <button onClick={() => moverFila(p.pedidoId, 1, ordemAtual)} disabled={pi === lista.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 leading-none"><ChevronDown size={16} /></button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-2 space-y-1.5">
                        {p.itens.filter(i => i.status_kds !== "entregue").map(it => {
                          const tempoBase = it.produtos?.tempo_preparo_base || 15;
                          const minItem = Math.floor((Date.now() - new Date(it.created_at)) / 60000);
                          const pronto = it.status_kds === "pronto";
                          const atrasado = !pronto && minItem >= tempoBase;          // passou do tempo -> pisca
                          const critico = !pronto && minItem >= tempoBase + 15;       // +15 min -> vermelho, pisca rapido
                          let cor, anim = "";
                          if (pronto) cor = "bg-emerald-50 text-emerald-800 border-emerald-100";
                          else if (critico) { cor = "bg-red-100 text-red-900 border-red-300"; anim = "animate-blink-fast"; }
                          else if (atrasado) { cor = "bg-amber-100 text-amber-900 border-amber-300"; anim = "animate-blink"; }
                          else if (it.status_kds === "preparando") cor = "bg-amber-50 text-amber-800 border-amber-100";
                          else cor = "bg-slate-50 text-slate-700 border-slate-100";
                          return (
                            <button key={it.id} onClick={() => setConfirmItem(it)} className={`w-full text-left px-3 py-2 rounded-lg border font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-between ${cor} ${anim}`}>
                              <span className="truncate">{it.quantidade}x {it.produtos?.nome_produto}</span>
                              {it.status_kds === "pronto" ? <Check size={16} className="shrink-0" /> : <Play size={13} className="shrink-0 opacity-60" />}
                            </button>
                          );
                        })}
                        {p.itens.some(i => i.observacao) && (
                          <div className="px-1 pt-1 space-y-0.5">
                            {p.itens.filter(i => i.observacao).map(i => (
                              <p key={i.id} className="text-[11px] font-bold text-amber-700">Obs: {i.observacao}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-2 pt-0">
                        {col.id === "fila" && (
                          <button onClick={() => avancarPedido(p)} className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5">
                            <Play size={13} /> Iniciar preparo (tudo)
                          </button>
                        )}
                        {col.id === "preparando" && (
                          <button onClick={() => avancarPedido(p)} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5">
                            <Check size={14} /> Marcar pronto (tudo)
                          </button>
                        )}
                        {col.id === "pronto" && (
                          <button onClick={() => avancarPedido(p)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5">
                            <Check size={14} /> Finalizar / entregue
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmacao ao tocar num item (pergunta em vez de avancar direto) */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setConfirmItem(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900 leading-tight">{confirmItem.quantidade}x {confirmItem.produtos?.nome_produto}</h3>
            {confirmItem.observacao && <p className="text-xs font-bold text-amber-700 mt-1">Obs: {confirmItem.observacao}</p>}
            <p className="text-sm font-bold text-slate-500 mt-3">{acaoLabel(confirmItem.status_kds)}?</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => setConfirmItem(null)} className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
              <button onClick={() => { avancarItem(confirmItem); setConfirmItem(null); }} className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Painel de detalhe do pedido (clique no cabecalho) */}
      {detalhe && (() => {
        const p = detalhe.pedido;
        const info = detalhe.info;
        const badge = tipoBadge(p.tipo_pedido);
        const horario = new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const isDelivery = ehDelivery(p.tipo_pedido);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setDetalhe(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg leading-tight">{identificacao(p)}</h3>
                    <p className="text-xs font-bold text-slate-400">Feito às {horario}</p>
                  </div>
                </div>
                <button onClick={() => setDetalhe(null)} className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 shrink-0"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {isDelivery && (
                  <div className="space-y-2">
                    {info?.cliente_telefone && <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Phone size={15} className="text-slate-400" /> {info.cliente_telefone}</p>}
                    {info?.endereco_entrega && <p className="text-sm font-bold text-slate-700 flex items-start gap-2"><MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" /> {info.endereco_entrega}</p>}
                    {!info && <p className="text-xs text-slate-400 font-bold">Carregando dados do cliente…</p>}
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Itens</p>
                  <div className="space-y-1.5">
                    {p.itens.filter(i => i.status_kds !== "entregue").map(it => (
                      <div key={it.id} className="flex justify-between items-start bg-slate-50 rounded-lg px-3 py-2">
                        <span className="font-bold text-slate-800 text-sm">{it.quantidade}x {it.produtos?.nome_produto}{it.observacao ? <span className="block text-[11px] font-bold text-amber-700">Obs: {it.observacao}</span> : null}</span>
                        <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 ml-2">{it.status_kds}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100">
                <button onClick={() => imprimirVia(p)} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2"><Printer size={16} /> Imprimir via</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Iniciando KDS…</div>}>
      <KDSRunner />
    </Suspense>
  );
}
