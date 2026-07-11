"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { registrarProducao } from "../../../lib/estoque";
import { fetchColaboradores } from "../../../lib/rh";
import { fetchProdutos } from "../../../lib/vendas";
import { Flame, Droplets, Save, ArrowLeft, X, UtensilsCrossed, Wine, Maximize, Printer, ClipboardList } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
// guard evita loop infinito se alguém criar uma referência circular.
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

// CMV (%) = custo por porção / preço de venda do produto vinculado à ficha.
// Cor muda no limiar de 30%: <=30% saudável (verde), >30% consumindo margem (vermelho).
function calcCmv(ficha, todasFichas, produtoDaFicha) {
  const produto = produtoDaFicha[ficha.id];
  if (!produto || !produto.preco_venda) return null;
  const custoPorcao = custoTotalDaFicha(ficha, todasFichas) / porcoesDaFicha(ficha);
  return (custoPorcao / produto.preco_venda) * 100;
}
const corCmv = (cmv) => cmv > 30
  ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-600" }
  : { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600" };

function ProducaoRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha";
  
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalProduzir, setModalProduzir] = useState(false);
  const [fichaAtual, setFichaAtual] = useState(null);

  // Planejamento do dia: { [ficha_id]: { qtd, resp } } — vira planilha impressa
  const [modalPlanejar, setModalPlanejar] = useState(false);
  const [plano, setPlano] = useState({});
  const [dataPlano, setDataPlano] = useState(() => new Date().toISOString().split("T")[0]);
  const chavePlano = `producao_plano_${unidadeAtiva || ""}_${deptUrl}`;

  // Rascunho do plano sobrevive a refresh (por unidade+departamento)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chavePlano);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d.plano === "object") { setPlano(d.plano); if (d.data) setDataPlano(d.data); }
      } else {
        setPlano({});
      }
    } catch { /* rascunho corrompido: ignora */ }
  }, [chavePlano]);
  useEffect(() => {
    try { localStorage.setItem(chavePlano, JSON.stringify({ plano, data: dataPlano })); } catch { }
  }, [plano, dataPlano, chavePlano]);

  const setPlanoItem = (fichaId, patch) => {
    setPlano(p => ({ ...p, [fichaId]: { qtd: "", resp: "", ...(p[fichaId] || {}), ...patch } }));
  };
  const itensPlanejados = fichas
    .map(f => ({ ficha: f, ...(plano[f.id] || {}) }))
    .filter(x => Number(String(x.qtd || "").replace(",", ".")) > 0);

  // Planilha A4 da produção do dia: item, quantidade e espaço para escrever
  // quem fez + horários — vai impressa para a parede da cozinha.
  const imprimirPlanoDoDia = () => {
    if (itensPlanejados.length === 0) return alert("Defina a quantidade de pelo menos um item para imprimir.");
    let win = null;
    try { win = window.open("", "_blank", "width=900,height=1000"); } catch { win = null; }

    const dataFmt = dataPlano ? dataPlano.split("-").reverse().join("/") : new Date().toLocaleDateString("pt-BR");
    const diaSemana = dataPlano ? ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][new Date(dataPlano + "T12:00:00").getDay()] : "";

    const linhasTab = itensPlanejados.map((x, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td class="item"><b>${x.ficha.nome_receita}</b></td>
        <td class="qtd">${(Number(String(x.qtd).replace(",", ".")) || 0).toLocaleString("pt-BR")} porç.</td>
        <td class="nome">${x.resp || ""}</td>
        <td class="hora"></td>
        <td class="hora"></td>
        <td class="ok"></td>
      </tr>`).join("");
    const linhasVazias = Array.from({ length: 3 }).map((_, i) => `
      <tr>
        <td class="n">${itensPlanejados.length + i + 1}</td>
        <td class="item"></td>
        <td class="qtd"></td>
        <td class="nome"></td>
        <td class="hora"></td>
        <td class="hora"></td>
        <td class="ok"></td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Producao do Dia - ${dataFmt}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:14mm 12mm}
        .head{border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#555;font-weight:bold}
        h1{font-size:22px;margin-top:2px}
        .quando{font-size:14px;font-weight:bold;text-align:right}
        .quando span{display:block;font-size:11px;color:#555;font-weight:normal}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #333;padding:7px 6px;font-size:12px;vertical-align:middle}
        th{background:#eee;text-transform:uppercase;letter-spacing:.5px;font-size:9px}
        td{height:38px}
        td.n{width:5%;text-align:center;color:#666}
        td.item{width:30%}
        td.qtd{width:12%;text-align:center;font-weight:bold}
        td.nome{width:23%}
        td.hora{width:10%}
        td.ok{width:8%}
        .legenda{margin-top:8px;font-size:10px;color:#555}
        .assin{margin-top:24px;display:flex;justify-content:space-between;gap:40px}
        .assin div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:10px;text-align:center;color:#444}
        @media print{@page{size:A4 landscape;margin:10mm}}
      </style></head><body>
      <div class="head">
        <div>
          <div class="tag">Produção do Dia — ${deptUrl === "bar" ? "Bar" : "Cozinha"} · ${unidadeInfo?.nome || ""}</div>
          <h1>O que produzir hoje</h1>
        </div>
        <div class="quando">${dataFmt}<span>${diaSemana}</span></div>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Item (ficha técnica)</th><th>Quantidade</th><th>Feito por (nome)</th><th>Início</th><th>Término</th><th>OK</th></tr>
        </thead>
        <tbody>${linhasTab}${linhasVazias}</tbody>
      </table>
      <div class="legenda">Quem produzir escreve o próprio nome, os horários de início/término e marca OK ao finalizar. Depois, registre no sistema (Produção do Dia) para dar baixa no estoque.</div>
      <div class="assin">
        <div>Responsável pela ${deptUrl === "bar" ? "produção do bar" : "cozinha"}</div>
        <div>Gerente / Conferência</div>
      </div>
      </body></html>`;

    if (!win) {
      // Popup bloqueado: imprime via iframe invisível na própria aba
      try {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        document.body.appendChild(iframe);
        iframe.srcdoc = html;
        iframe.onload = () => {
          setTimeout(() => {
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert("Não consegui abrir a impressão: " + e.message); }
            setTimeout(() => iframe.remove(), 60000);
          }, 300);
        };
        return;
      } catch (e) {
        return alert("O navegador bloqueou a janela de impressão. Habilite os popups para este site.\n\nDetalhe: " + e.message);
      }
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // Form de produção
  const [qtdProd, setQtdProd] = useState("1");
  const [colabSelecionado, setColabSelecionado] = useState("");

  const carregar = async () => {
    setLoading(true);
    const [resFichas, resProdutos, resColab] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchProdutos(unidadeAtiva, deptUrl),
       fetchColaboradores(unidadeAtiva)
    ]);
    setFichas(resFichas.data || []);
    setProdutos(resProdutos.data || []);
    setColaboradores((resColab.data || []).filter(c => c.ativo !== false && c.status !== "inativo"));
    setLoading(false);
  };

  // Primeiro produto de venda vinculado a cada ficha (produtos.ficha_id -> fichas_tecnicas.id)
  const produtoDaFicha = {};
  produtos.forEach(p => { if (p.ficha_id && !produtoDaFicha[p.ficha_id]) produtoDaFicha[p.ficha_id] = p; });

  // CMV médio de todos os produtos criados (com ficha e preço de venda válidos)
  const cmvsValidos = fichas
    .map(f => calcCmv(f, fichas, produtoDaFicha))
    .filter(v => v !== null);
  const cmvMedio = cmvsValidos.length > 0 ? cmvsValidos.reduce((a, b) => a + b, 0) / cmvsValidos.length : null;

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const abrirProduzir = (ficha) => {
    setFichaAtual(ficha);
    setQtdProd("1");
    setColabSelecionado("");
    setModalProduzir(true);
  };

  const handleConfirmar = async () => {
    if(!colabSelecionado) return alert("Selecione quem está produzindo.");
    const numQtd = Number(qtdProd);
    if(numQtd <= 0) return alert("Digite uma quantidade válida.");

    // O pulo do gato: registrarProducao abate do estoque automaticamente!
    const erro = await registrarProducao(unidadeAtiva, fichaAtual, numQtd, colabSelecionado);
    
    if (erro.codigo === "ESTOQUE_INSUFICIENTE") {
      const lista = (erro.faltantes || []).map(i =>
        `• ${i.nome}: precisa ${i.necessario.toLocaleString("pt-BR")} ${i.unidade || ""}, disponível ${i.disponivel.toLocaleString("pt-BR")}`
      ).join("\n");
      return alert(`Produção não registrada. Estoque insuficiente:\n\n${lista}\n\nAjuste o estoque ou reduza a quantidade.`);
    }
    if(erro.error) return alert("Falha ao registrar produção: " + erro.error);

    alert("Produção registrada e estoque abatido com sucesso!");
    setModalProduzir(false);
  };

  const containerRef = useRef(null);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
       containerRef.current?.requestFullscreen?.();
    } else {
       document.exitFullscreen?.();
    }
  };

  const isBar = deptUrl === 'bar';

  return (
    <div ref={containerRef} className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isBar ? 'bg-slate-100 text-emerald-600' : 'bg-slate-100 text-emerald-600'}`}>
                 {isBar ? <Droplets size={28} /> : <Flame size={28} />}
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Produção do Dia</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Baixa Automática de Estoque</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={() => setModalPlanejar(true)} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg">
                  <ClipboardList size={18}/> Planejar & Imprimir o Dia
                  {itensPlanejados.length > 0 && <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{itensPlanejados.length}</span>}
               </button>
               {cmvMedio !== null && (
                  <div className={`px-4 py-2.5 rounded-2xl border ${corCmv(cmvMedio).bg} ${corCmv(cmvMedio).border}`}>
                     <p className={`text-[9px] font-black uppercase tracking-widest ${corCmv(cmvMedio).text}`}>CMV Médio</p>
                     <p className={`text-xl font-black ${corCmv(cmvMedio).text}`}>{cmvMedio.toFixed(1)}%</p>
                  </div>
               )}
               <button onClick={toggleFullscreen} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200" title="Tela Cheia">
                  <Maximize size={20}/>
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800 mb-2">O que você vai produzir agora?</h2>
            <p className="text-slate-500 font-medium">Selecione a ficha técnica. O sistema vai calcular e retirar os ingredientes do estoque físico.</p>
         </div>

         {loading ? (
            <p className="font-bold text-slate-500">Carregando fichas...</p>
         ) : fichas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <h3 className="text-xl font-black text-slate-700">Nenhuma ficha cadastrada</h3>
               <p className="text-slate-500 mt-2 font-medium">Crie suas Fichas Técnicas primeiro para poder produzir.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
               {fichas.map(f => {
                  const cmv = calcCmv(f, fichas, produtoDaFicha);
                  return (
                  <button
                     key={f.id}
                     onClick={() => abrirProduzir(f)}
                     className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all relative group text-left flex flex-col"
                  >
                     <div className="flex justify-between items-start mb-4">
                        <span className={`w-12 h-12 rounded-full flex items-center justify-center ${f.departamento === 'bar' ? 'bg-slate-50 text-emerald-600' : 'bg-slate-50 text-emerald-600'}`}>
                           {f.departamento === 'bar' ? <Wine size={20}/> : <UtensilsCrossed size={20}/>}
                        </span>
                        {cmv !== null && (
                           <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${corCmv(cmv).bg} ${corCmv(cmv).text} border ${corCmv(cmv).border}`}>
                              CMV {cmv.toFixed(1)}%
                           </span>
                        )}
                     </div>
                     <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2">{f.nome_receita}</h3>
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{f.fichas_ingredientes?.length || 0} Ingredientes</p>

                     <div className="mt-auto pt-4 border-t border-slate-100">
                        <span className={`inline-flex items-center gap-2 font-bold text-sm ${isBar ? 'text-emerald-600' : 'text-emerald-600'}`}>
                           {isBar ? <Droplets size={16}/> : <Flame size={16}/>} Iniciar Produção
                        </span>
                     </div>
                  </button>
                  );
               })}
            </div>
         )}
      </div>

      {/* Modal: planejar a produção do dia e imprimir a planilha */}
      {modalPlanejar && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] w-full max-w-2xl my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[88vh]">
               <div className="flex justify-between items-center p-8 pb-5 border-b border-slate-100 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Produção do Dia — Planejamento</h2>
                     <p className="text-xs font-bold text-slate-500 mt-1">Defina o que produzir e quanto. Designe quem faz (ou deixe em branco para escreverem o nome na folha).</p>
                  </div>
                  <button onClick={() => setModalPlanejar(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-8 pt-5 overflow-y-auto space-y-3">
                  <div className="flex items-center gap-3">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data da produção</label>
                     <input type="date" value={dataPlano} onChange={e=>setDataPlano(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                     {itensPlanejados.length > 0 && (
                        <button onClick={() => { if (confirm("Limpar o planejamento do dia?")) setPlano({}); }} className="ml-auto text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest">Limpar tudo</button>
                     )}
                  </div>

                  {fichas.map(f => {
                     const item = plano[f.id] || {};
                     const ativo = Number(String(item.qtd || "").replace(",", ".")) > 0;
                     return (
                        <div key={f.id} className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${ativo ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-slate-50/50"}`}>
                           <p className={`flex-1 font-bold text-sm ${ativo ? "text-slate-800" : "text-slate-500"}`}>{f.nome_receita}</p>
                           <div className="flex items-center gap-2">
                              <input type="number" min="0" placeholder="0" value={item.qtd || ""} onChange={e=>setPlanoItem(f.id, { qtd: e.target.value })}
                                 className="w-20 p-2.5 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">porç.</span>
                              <select value={item.resp || ""} onChange={e=>setPlanoItem(f.id, { resp: e.target.value })}
                                 className="p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-xs text-slate-600 outline-none focus:border-emerald-500 max-w-[170px]">
                                 <option value="">Nome em branco (escrever à mão)</option>
                                 {colaboradores.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                              </select>
                           </div>
                        </div>
                     );
                  })}
               </div>

               <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0 flex items-center gap-3">
                  <p className="flex-1 text-xs font-bold text-slate-500">{itensPlanejados.length} item(ns) no plano</p>
                  <button onClick={imprimirPlanoDoDia} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl shadow-emerald-600/20">
                     <Printer size={18}/> Imprimir Planilha do Dia
                  </button>
               </div>
            </div>
         </div>
      )}

      {modalProduzir && fichaAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Registrar Produção</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{fichaAtual.nome_receita}</p>
                  </div>
                  <button onClick={() => setModalProduzir(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-6">
                  {/* Quem fez? */}
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Quem está preparando?</label>
                     <select value={colabSelecionado} onChange={e=>setColabSelecionado(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-800">
                        <option value="">-- Selecione seu nome --</option>
                        {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
                     </select>
                  </div>

                  {/* Quantidade */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block text-center mb-4">Quantas porções você fez?</label>
                     <div className="flex items-center justify-center gap-4">
                        <button onClick={()=>setQtdProd(p => Math.max(1, Number(p)-1))} className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl font-black text-slate-500 hover:text-slate-800">-</button>
                        <input 
                           type="number" 
                           value={qtdProd} 
                           onChange={e=>setQtdProd(e.target.value)} 
                           className="w-24 p-2 text-center text-4xl font-black text-slate-800 bg-transparent outline-none"
                        />
                        <button onClick={()=>setQtdProd(p => Number(p)+1)} className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl font-black text-slate-500 hover:text-slate-800">+</button>
                     </div>
                  </div>

                  {/* Valor Total Médio da Produção + CMV desta ficha */}
                  {(() => {
                     const custoPorcao = custoTotalDaFicha(fichaAtual, fichas) / porcoesDaFicha(fichaAtual);
                     const valorTotalProducao = custoPorcao * Number(qtdProd || 0);
                     const cmv = calcCmv(fichaAtual, fichas, produtoDaFicha);
                     const cores = cmv !== null ? corCmv(cmv) : null;
                     return (
                        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between gap-4">
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Valor Total Médio desta Produção</p>
                              <p className="text-[10px] font-bold text-emerald-700/70 mt-0.5">{fmtBRL(custoPorcao)} / porção × {qtdProd || 0}</p>
                              <p className="text-3xl font-black text-emerald-700 mt-1">{fmtBRL(valorTotalProducao)}</p>
                           </div>
                           {cmv !== null && (
                              <div className={`px-3 py-2 rounded-xl border shrink-0 text-center ${cores.bg} ${cores.border}`}>
                                 <p className={`text-[9px] font-black uppercase tracking-widest ${cores.text}`}>CMV</p>
                                 <p className={`text-xl font-black ${cores.text}`}>{cmv.toFixed(1)}%</p>
                              </div>
                           )}
                        </div>
                     );
                  })()}

                  {/* Preview da Baixa */}
                  <div className="pt-2">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Previsão de Baixa no Estoque:</p>
                     <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                        {fichaAtual.fichas_ingredientes?.filter(ing => ing.insumos).map(ing => {
                           const consumo = ing.quantidade * Number(qtdProd);
                           return (
                              <div key={ing.insumos.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100">
                                 <span className="font-bold text-slate-600 text-sm">{ing.insumos.nome}</span>
                                 <span className="font-black text-slate-600 text-sm">- {consumo.toFixed(3)} {ing.insumos.unidade_medida}</span>
                              </div>
                           )
                        })}
                     </div>
                  </div>
               </div>

               <button onClick={handleConfirmar} className={`w-full mt-8 py-5 text-white font-black text-lg rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isBar ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-orange-500/20'} shadow-xl`}>
                  <Save size={20}/> Confirmar Produção e Baixar Estoque
               </button>
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando Produção...</div>}>
       <ProducaoRunner />
    </Suspense>
  );
}
