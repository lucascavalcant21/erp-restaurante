"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoque, ajustarEstoque, atualizarMinimoInsumo } from "../../../lib/estoque";
import { fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { useTempoReal } from "../../../lib/realtime";
import { PackageSearch, Edit3, X, Save, ArrowLeft, RefreshCw, AlertCircle, Search, Plus, TrendingUp, Printer } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

function EstoqueRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' ou 'bar'
  
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalAjuste, setModalAjuste] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [itemAtual, setItemAtual] = useState(null);
  const [novoSaldo, setNovoSaldo] = useState("");
  const [minimoInput, setMinimoInput] = useState("");
  const [fatorRep, setFatorRep] = useState(PARAMS_PADRAO.fator_reposicao);
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") fetchParams(unidadeAtiva).then(r => setFatorRep(r.data.fator_reposicao)); }, [unidadeAtiva]);
  const [qtdEntrada, setQtdEntrada] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");

  const carregar = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data } = await fetchEstoque(unidadeAtiva, deptUrl);
    setItens(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  // Tempo real: entradas, baixas e produções atualizam os saldos sozinhos
  useTempoReal(["estoque_atual", "insumos", "producao_diaria"], () => { if (unidadeAtiva) carregar(true); });

  const filtrados = itens.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));

  // Planilha de contagem imprimível: saldo do sistema + colunas em branco para
  // a contagem física e a diferença — agrupada por departamento.
  const imprimirPlanilha = () => {
    if (!itens.length) return alert("Estoque vazio — nada para imprimir.");
    const grupos = {};
    itens.forEach(i => { const d = (i.departamento || "geral").toLowerCase(); (grupos[d] = grupos[d] || []).push(i); });
    let corpo = "";
    Object.keys(grupos).sort().forEach(dep => {
      const lista = grupos[dep].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      corpo += `<tr class="cat"><td colspan="7">${dep.toUpperCase()}</td></tr>` + lista.map(i => {
        const saldo = Number(i.quantidade_atual) || 0;
        const custo = Number(i.custo_unitario) || 0;
        return `<tr>
          <td><b>${i.nome}</b></td>
          <td class="c">${String(i.unidade_medida || "").toUpperCase()}</td>
          <td class="c">${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
          <td class="r">${custo > 0 ? fmtBRL(custo) : ""}</td>
          <td class="r">${custo > 0 ? fmtBRL(custo * saldo) : ""}</td>
          <td class="conta"></td>
          <td class="conta"></td>
        </tr>`;
      }).join("");
    });
    const valorTotal = itens.reduce((s, i) => s + (Number(i.custo_unitario) || 0) * (Number(i.quantidade_atual) || 0), 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Estoque — ${unidadeInfo?.nome || ""}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #94a3b8;padding:5px 6px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        tr{page-break-inside:avoid}
        tr.cat td{background:#f1f5f9;font-weight:bold;letter-spacing:1px;font-size:10px;color:#334155}
        td.c{text-align:center;font-weight:bold}
        td.r{text-align:right}
        td.conta{width:20mm;background:#fff}
        .totais{display:flex;justify-content:flex-end;margin-top:8px;font-size:12px;font-weight:bold}
        .assin{margin-top:16mm;display:flex;gap:30px}
        .assin div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:8mm}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Planilha de Contagem — Estoque${deptUrl ? ` · ${deptUrl}` : ""}</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${itens.length} ingrediente(s)<br/>Impresso em ${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th>Ingrediente</th><th>Unid.</th><th>Saldo sistema</th><th>Custo/un.</th><th>Valor em estoque</th><th>Contagem física</th><th>Diferença</th></tr></thead>
        <tbody>${corpo}</tbody>
      </table>
      <div class="totais"><span>Valor total em estoque: ${fmtBRL(valorTotal)}</span></div>
      <div class="assin"><div>Contado por</div><div>Data da contagem</div><div>Assinatura do responsável</div></div>
      </body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir a planilha.");
  };

  const abrirAjuste = (item) => {
    setItemAtual(item);
    setNovoSaldo(item.quantidade_atual === 0 ? "" : item.quantidade_atual);
    setMinimoInput(item.estoque_minimo ?? "");
    setModalAjuste(true);
  };

  const handleSalvarAjuste = async () => {
    if(novoSaldo === "") return alert("Digite o saldo atual");
    await ajustarEstoque(unidadeAtiva, itemAtual.insumo_id, Number(novoSaldo));
    // Estoque mínimo (opcional): abaixo dele o item entra na lista de compras
    if (String(minimoInput) !== String(itemAtual.estoque_minimo ?? "")) {
      const { error } = await atualizarMinimoInsumo(itemAtual.insumo_id, minimoInput);
      if (error) alert(error);
    }
    setModalAjuste(false);
    carregar();
  };

  // Lista de compras automática: tudo que está abaixo do mínimo definido
  const abaixoDoMinimo = itens.filter(i => Number(i.estoque_minimo) > 0 && Number(i.quantidade_atual) < Number(i.estoque_minimo));
  const imprimirCompras = () => {
    if (!abaixoDoMinimo.length) return alert("Nada abaixo do mínimo. Defina o estoque mínimo dos insumos no botão Ajustar.");
    const linhas = abaixoDoMinimo
      .sort((a, b) => (a.departamento || "").localeCompare(b.departamento || "") || a.nome.localeCompare(b.nome, "pt-BR"))
      .map(i => {
        const saldo = Number(i.quantidade_atual) || 0;
        const min = Number(i.estoque_minimo) || 0;
        const sugerido = Math.max(0, +(min * fatorRep - saldo).toFixed(2)); // repõe até (fator × mínimo)
        const custo = (Number(i.custo_unitario) || 0) * sugerido;
        return { i, saldo, min, sugerido, custo };
      });
    const total = linhas.reduce((s, l) => s + l.custo, 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Lista de Compras — abaixo do mínimo</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:9mm}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #94a3b8;padding:6px 7px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        td.c{text-align:center;font-weight:bold}td.r{text-align:right;font-weight:bold}
        td.baixo{color:#dc2626}
        .tot{background:#f1f5f9;font-weight:bold}
        .check{width:10mm}
        @media print{@page{margin:8mm}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Lista de Compras — abaixo do estoque mínimo</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${linhas.length} item(ns)<br/>${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th class="check">OK</th><th>Ingrediente</th><th>Depto</th><th>Saldo</th><th>Mínimo</th><th>Comprar (sug.)</th><th>Custo estimado</th></tr></thead>
        <tbody>
          ${linhas.map(l => `<tr>
            <td class="check"></td>
            <td><b>${l.i.nome}</b></td><td>${l.i.departamento || ""}</td>
            <td class="c baixo">${l.saldo.toLocaleString("pt-BR")} ${l.i.unidade_medida}</td>
            <td class="c">${l.min.toLocaleString("pt-BR")}</td>
            <td class="c">${l.sugerido.toLocaleString("pt-BR")} ${l.i.unidade_medida}</td>
            <td class="r">${fmtBRL(l.custo)}</td>
          </tr>`).join("")}
          <tr class="tot"><td colspan="6">TOTAL ESTIMADO</td><td class="r">${fmtBRL(total)}</td></tr>
        </tbody>
      </table>
      <p style="font-size:9px;color:#94a3b8;margin-top:8px">Sugestão de compra = repor até ${fatorRep}x o estoque mínimo. Custo estimado pelo último custo unitário.</p>
      </body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir.");
  };

  const abrirEntrada = (item) => {
    setItemAtual(item);
    setQtdEntrada("");
    setValorEntrada("");
    setModalEntrada(true);
  };

  const handleSalvarEntrada = async () => {
    if(!qtdEntrada || Number(qtdEntrada) <= 0) return alert("Digite a quantidade comprada.");
    const saldoAtual = Number(itemAtual.quantidade_atual || 0);
    const novaQtd = saldoAtual + Number(qtdEntrada);
    await ajustarEstoque(unidadeAtiva, itemAtual.insumo_id, novaQtd);
    setModalEntrada(false);
    carregar();
    alert(`Entrada registrada! Novo saldo de ${itemAtual.nome} é ${novaQtd} ${itemAtual.unidade_medida}`);
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
                 <PackageSearch size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Estoque Físico</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Saldos e Entradas {deptUrl ? `- ${deptUrl}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={imprimirCompras} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-colors shadow-sm ${abaixoDoMinimo.length ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}`}>
                  <Plus size={18} /> Compras{abaixoDoMinimo.length ? ` (${abaixoDoMinimo.length})` : ""}
               </button>
               <button onClick={imprimirPlanilha} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm">
                  <Printer size={18} /> Planilha
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 flex items-start gap-4">
            <AlertCircle className="text-slate-600 flex-shrink-0 mt-0.5" />
            <div>
               <h3 className="font-bold text-amber-800">Atenção ao Saldo Base</h3>
               <p className="text-emerald-700 text-sm mt-1">Para que a <strong>Produção do Dia</strong> funcione perfeitamente descontando insumos, certifique-se de que os ingredientes possuem saldo positivo aqui nesta tela.</p>
            </div>
         </div>

         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar ingrediente..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
            {/* Header da tabela */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Ingrediente</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-24">Custo/Un.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-20">Unid.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-32">Saldo Atual</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-48">Ação</span>
            </div>

            {/* Linhas */}
            <div className="bg-white divide-y divide-slate-100">
               {loading && (
                 <div className="p-12 text-center">
                   <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold text-sm">Buscando saldos...</p>
                 </div>
               )}
               {!loading && filtrados.map((ins, idx) => {
                 const zerado = ins.quantidade_atual <= 0;
                 const min = Number(ins.estoque_minimo) || 0;
                 // Com mínimo definido, o alerta segue o mínimo; sem, mantém o padrão (<5)
                 const critico = !zerado && (min > 0 ? ins.quantidade_atual < min : ins.quantidade_atual < 5);
                 const dept = ins.departamento?.toLowerCase();
                 const deptColor = dept === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                 return (
                   <div key={ins.insumo_id} className={`px-6 py-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center group transition-all duration-150 ${zerado ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-emerald-50/40'}`}>
                     {/* Nome + Dept */}
                     <div className="flex items-center gap-3 min-w-0">
                       <div className={`w-1 h-10 rounded-full shrink-0 ${zerado ? 'bg-red-400' : critico ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                       <div className="min-w-0">
                         <p className="font-bold text-slate-800 text-[15px] leading-tight truncate">{ins.nome}</p>
                         <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${deptColor}`}>{ins.departamento}</span>
                       </div>
                     </div>
                     {/* Custo */}
                     <div className="w-24 flex justify-center">
                       <span className="font-bold text-slate-500 text-sm">{fmtBRL(ins.custo_unitario)}</span>
                     </div>
                     {/* Unidade */}
                     <div className="w-20 flex justify-center">
                       <span className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm">{ins.unidade_medida}</span>
                     </div>
                     {/* Saldo */}
                     <div className="w-32 flex flex-col items-center">
                       <span className={`font-black text-2xl leading-none ${zerado ? 'text-red-500' : critico ? 'text-amber-500' : 'text-emerald-600'}`}>
                         {Number(ins.quantidade_atual).toFixed(2)}
                       </span>
                       {zerado && <span className="text-[9px] font-black uppercase tracking-widest text-red-400 mt-1">● Zerado</span>}
                       {critico && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 mt-1">⚠ {min > 0 ? `Abaixo do mín (${min})` : "Crítico"}</span>}
                       {!zerado && !critico && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mt-1">✓ Normal</span>}
                     </div>
                     {/* Ação */}
                     <div className="w-48 flex items-center justify-end gap-2">
                       <button onClick={() => abrirEntrada(ins)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95">
                         <Plus size={13}/> Entrada
                       </button>
                       <button onClick={() => abrirAjuste(ins)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95">
                         <RefreshCw size={13}/> Ajustar
                       </button>
                     </div>
                   </div>
                 );
               })}
               {!loading && filtrados.length === 0 && (
                 <div className="p-16 text-center">
                   <PackageSearch size={40} className="text-slate-200 mx-auto mb-3" />
                   <p className="text-slate-400 font-bold">Nenhum ingrediente cadastrado ainda.</p>
                 </div>
               )}
            </div>
         </div>
      </div>

      {modalAjuste && itemAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Ajuste de Saldo</h2>
                  <button onClick={() => setModalAjuste(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">{itemAtual.nome}</p>
                     <p className="text-3xl font-black text-slate-800">{Number(itemAtual.quantidade_atual).toFixed(2)} <span className="text-lg text-slate-500">{itemAtual.unidade_medida}</span></p>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Novo Saldo Real (Balanço)</label>
                     <div className="relative">
                        <input
                           type="number" step="0.001" placeholder="0.00"
                           value={novoSaldo} onChange={e=>setNovoSaldo(e.target.value)}
                           className="w-full p-5 text-2xl bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-500">{itemAtual.unidade_medida}</span>
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-amber-600 uppercase tracking-widest block mb-2">Estoque mínimo (opcional)</label>
                     <div className="relative">
                        <input
                           type="number" step="0.001" min="0" placeholder="Ex: 5"
                           value={minimoInput} onChange={e=>setMinimoInput(e.target.value)}
                           className="w-full p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl font-black text-amber-800 outline-none focus:border-amber-500"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-amber-500">{itemAtual.unidade_medida}</span>
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium mt-1">Abaixo desse valor o item entra sozinho na lista de Compras.</p>
                  </div>
               </div>

               <button onClick={handleSalvarAjuste} className="w-full mt-8 py-5 bg-slate-800 hover:bg-slate-900 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-500/20 active:scale-95 flex items-center justify-center gap-2">
                  <RefreshCw size={20}/> Sobrescrever Saldo
               </button>
            </div>
         </div>
      )}

      {modalEntrada && itemAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Lançar Entrada</h2>
                  <button onClick={() => setModalEntrada(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                     <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">{itemAtual.nome}</p>
                     <p className="text-sm font-medium text-emerald-700">Saldo Atual: {Number(itemAtual.quantidade_atual).toFixed(2)} {itemAtual.unidade_medida}</p>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Quantas {itemAtual.unidade_medida}s foram compradas?</label>
                     <div className="relative">
                        <input 
                           type="number" step="0.001" placeholder="Ex: 10" 
                           value={qtdEntrada} onChange={e=>setQtdEntrada(e.target.value)} 
                           className="w-full p-5 text-2xl bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-500">{itemAtual.unidade_medida}</span>
                     </div>
                  </div>
               </div>

               <button onClick={handleSalvarEntrada} className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                  <TrendingUp size={20}/> Somar ao Estoque
               </button>
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando Estoque...</div>}>
       <EstoqueRunner />
    </Suspense>
  );
}
