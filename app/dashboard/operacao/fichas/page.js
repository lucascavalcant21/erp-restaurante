"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas, salvarFicha, removerFicha, fetchInsumos } from "../../../lib/operacao";
import { LayoutList, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft, UtensilsCrossed, Wine, ChevronRight, Printer, Sparkles, Loader2 } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Sub-unidades para lançamento em ficha. O custo do insumo é por unidade-base
// (R$/kg, R$/L). Em receita pensamos em g/ml, então convertemos: 1 base = `f` sub.
// Ex: kg → g (f=1000). Insumos em "un" não têm sub-unidade.
const SUB_UNIDADES = {
  kg: { sub: "g",  f: 1000 },
  l:  { sub: "ml", f: 1000 },
};
const getSub = (unidade) => SUB_UNIDADES[String(unidade || "").toLowerCase()] || null;

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
// Custo por unidade-de-rendimento de uma base (usado quando ela vira ingrediente)
function custoUnitBase(base, todasFichas) {
  return custoTotalDaFicha(base, todasFichas) / (base.rendimento_porcoes || 1);
}

function FichasRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha"; // 'cozinha' ou 'bar'
  
  const { unidadeAtiva } = useERP();
  const [fichas, setFichas] = useState([]);
  const [insumosAtivos, setInsumosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  
  // Estado do formulário da Ficha
  const [form, setForm] = useState({
    id: null,
    departamento: deptUrl,
    nome_receita: "",
    rendimento_porcoes: "1",
    modo_preparo: "",
    eh_base: false,
    rendimento_unidade: "porcao"
  });

  // Ingredientes da ficha. Cada item tem `chave` (insumo_id OU subficha_id),
  // `tipo` ('insumo'|'base'), `custo_unitario` (por unidade-base) e `unidade`.
  const [ingFicha, setIngFicha] = useState([]);

  // Bases disponíveis (fichas marcadas como pré-preparo), exceto a própria ficha em edição
  const basesDisponiveis = fichas.filter(f => f.eh_base && f.id !== form.id);

  // Assistente de IA para o Modo de Preparo
  const [iaExplicacao, setIaExplicacao] = useState("");
  const [iaLoading, setIaLoading] = useState(false);

  const gerarPreparoIA = async () => {
    if (!iaExplicacao.trim()) return alert("Explique com suas palavras como o prato é feito.");
    setIaLoading(true);
    try {
      const res = await fetch("/api/ia-preparo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explicacao: iaExplicacao,
          nome_receita: form.nome_receita,
          porcoes: form.rendimento_porcoes,
          ingredientes: ingFicha.map(i => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao gerar o modo de preparo.");
        return;
      }
      setForm(f => ({ ...f, modo_preparo: data.modo_preparo }));
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaLoading(false);
    }
  };

  const carregar = async () => {
    setLoading(true);
    const [resFichas, resInsumos] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, deptUrl)
    ]);
    setFichas(resFichas.data || []);
    setInsumosAtivos(resInsumos.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const filtradas = fichas.filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()));

  const abrirNova = () => {
    setForm({ id: null, departamento: deptUrl, nome_receita: "", rendimento_porcoes: "1", modo_preparo: "", eh_base: false, rendimento_unidade: "porcao" });
    setIngFicha([]);
    setIaExplicacao("");
    setModalNovo(true);
  };

  const abrirEditar = (ficha) => {
    setForm({
       id: ficha.id,
       departamento: ficha.departamento,
       nome_receita: ficha.nome_receita,
       rendimento_porcoes: ficha.rendimento_porcoes,
       modo_preparo: ficha.modo_preparo || "",
       eh_base: !!ficha.eh_base,
       rendimento_unidade: ficha.rendimento_unidade || "porcao"
    });
    // Reconstrói os ingredientes: cada um é um INSUMO ou uma BASE (sub-ficha).
    const mapIng = (ficha.fichas_ingredientes || []).map(fi => {
       if (fi.subficha_id) {
          const base = fichas.find(x => x.id === fi.subficha_id);
          return {
             chave: fi.subficha_id, tipo: "base", subficha_id: fi.subficha_id,
             nome: base?.nome_receita || "Base",
             unidade: base?.rendimento_unidade || "un",
             custo_unitario: base ? custoUnitBase(base, fichas) : 0,
             quantidade: fi.quantidade,
             modo: getSub(base?.rendimento_unidade) ? "sub" : "base",
          };
       }
       return {
          chave: fi.insumos.id, tipo: "insumo", insumo_id: fi.insumos.id,
          nome: fi.insumos.nome, unidade: fi.insumos.unidade_medida,
          custo_unitario: fi.insumos.custo_unitario, quantidade: fi.quantidade,
          modo: getSub(fi.insumos.unidade_medida) ? "sub" : "base",
       };
    });
    setIngFicha(mapIng);
    setIaExplicacao("");
    setModalNovo(true);
  };

  const calcularCustoTotal = (ingredientesLista) => {
    return ingredientesLista.reduce((acc, ing) => acc + (ing.custo_unitario * ing.quantidade), 0);
  };

  // Adiciona insumo ou base. `valor` = "insumo:<id>" ou "base:<id>"
  const addIngrediente = (valor) => {
    if (!valor) return;
    const [tipo, id] = valor.split(":");
    if (ingFicha.find(i => i.chave === id)) return; // já existe

    if (tipo === "base") {
       const base = fichas.find(f => f.id === id);
       if (!base) return;
       setIngFicha([...ingFicha, {
          chave: base.id, tipo: "base", subficha_id: base.id,
          nome: base.nome_receita, unidade: base.rendimento_unidade || "un",
          custo_unitario: custoUnitBase(base, fichas), quantidade: 0,
          modo: getSub(base.rendimento_unidade) ? "sub" : "base",
       }]);
    } else {
       const insumoDb = insumosAtivos.find(i => i.id === id);
       if (!insumoDb) return;
       setIngFicha([...ingFicha, {
          chave: insumoDb.id, tipo: "insumo", insumo_id: insumoDb.id,
          nome: insumoDb.nome, unidade: insumoDb.unidade_medida,
          custo_unitario: insumoDb.custo_unitario, quantidade: 0,
          modo: getSub(insumoDb.unidade_medida) ? "sub" : "base",
       }]);
    }
  };

  // Recebe a quantidade JÁ em unidade-base (a conversão acontece no onChange do input)
  const updateQtd = (chave, qtdBase) => {
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, quantidade: Number(qtdBase) || 0 } : i));
  };

  const toggleModo = (chave) => {
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, modo: i.modo === 'sub' ? 'base' : 'sub' } : i));
  };

  const removeIngrediente = (chave) => {
    setIngFicha(lista => lista.filter(i => i.chave !== chave));
  };

  const handleSalvar = async () => {
    if(!form.nome_receita.trim()) return alert("Digite o nome da receita");
    if(!form.rendimento_porcoes) return alert("Digite o rendimento");

    // Filtra ingredientes que estão com qtd = 0
    const ingValidos = ingFicha.filter(i => i.quantidade > 0);
    if(ingValidos.length === 0) return alert("Adicione pelo menos um ingrediente com quantidade válida.");

    const erro = await salvarFicha(
       {
          id: form.id,
          unidade_id: unidadeAtiva,
          departamento: form.departamento,
          nome_receita: form.nome_receita,
          rendimento_porcoes: Number(form.rendimento_porcoes),
          modo_preparo: form.modo_preparo,
          eh_base: !!form.eh_base,
          rendimento_unidade: form.eh_base ? form.rendimento_unidade : "porcao"
       },
       ingValidos.map(i => ({
          insumo_id: i.tipo === "insumo" ? i.insumo_id : null,
          subficha_id: i.tipo === "base" ? i.subficha_id : null,
          quantidade: i.quantidade
       }))
    );

    if(erro.error) return alert("Erro ao salvar: " + erro.error);
    
    setModalNovo(false);
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Deseja excluir esta ficha técnica permanentemente?")) {
       await removerFicha(id);
       carregar();
    }
  };

  const imprimirFicha = (f) => {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return alert("Habilite os popups para imprimir a ficha técnica.");
    const SUB = { kg: { s: 'g', fa: 1000 }, l: { s: 'ml', fa: 1000 } };
    const fmtQtd = (qtd, un) => {
       const c = SUB[String(un || '').toLowerCase()];
       return c ? `${(+(qtd * c.fa)).toLocaleString('pt-BR')} ${c.s}` : `${qtd} ${String(un || '').toUpperCase()}`;
    };
    let custoTotal = 0;
    const rows = (f.fichas_ingredientes || []).map(fi => {
       let nome, unidade, custo;
       if (fi.subficha_id) {
          const base = fichas.find(x => x.id === fi.subficha_id);
          nome = (base?.nome_receita || 'Base') + ' (base)';
          unidade = base?.rendimento_unidade;
          custo = base ? custoUnitBase(base, fichas) * fi.quantidade : 0;
       } else {
          nome = fi.insumos?.nome || 'Insumo';
          unidade = fi.insumos?.unidade_medida;
          custo = (fi.insumos?.custo_unitario || 0) * fi.quantidade;
       }
       custoTotal += custo;
       return `<tr><td>${nome}</td><td class="c">${fmtQtd(fi.quantidade, unidade)}</td><td class="r">R$ ${custo.toFixed(2)}</td></tr>`;
    }).join('');
    const rende = f.rendimento_porcoes || 1;
    const custoPorcao = custoTotal / rende;
    win.document.write(`
       <!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ficha Técnica - ${f.nome_receita}</title>
       <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px;max-width:720px;margin:0 auto}
          .head{border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
          .tag{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
          h1{font-size:26px;margin:4px 0}
          .meta{font-size:13px;color:#475569;font-weight:bold}
          h2{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin:20px 0 8px}
          table{width:100%;border-collapse:collapse;font-size:14px}
          th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #e2e8f0}
          th{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b}
          td.c{text-align:center}td.r,th.r{text-align:right}
          .totais{display:flex;justify-content:flex-end;gap:24px;margin-top:12px;font-size:14px}
          .totais b{font-size:18px}
          .preparo{margin-top:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
          @media print{@page{margin:14mm}}
       </style></head><body>
          <div class="head">
             <div class="tag">Ficha Técnica${f.departamento ? ' — ' + f.departamento : ''}</div>
             <h1>${f.nome_receita}</h1>
             <div class="meta">Rendimento: ${rende} porç${rende > 1 ? 'ões' : 'ão'}</div>
          </div>
          <h2>Ingredientes</h2>
          <table>
             <thead><tr><th>Ingrediente</th><th class="c">Quantidade</th><th class="r">Custo</th></tr></thead>
             <tbody>${rows || '<tr><td colspan="3">Sem ingredientes cadastrados.</td></tr>'}</tbody>
          </table>
          <div class="totais">
             <div>Custo por porção: <b>R$ ${custoPorcao.toFixed(2)}</b></div>
             <div>Custo total: <b>R$ ${custoTotal.toFixed(2)}</b></div>
          </div>
          <h2>Modo de Preparo</h2>
          <div class="preparo">${f.modo_preparo ? f.modo_preparo : 'Não informado.'}</div>
       </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
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
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${deptUrl === 'bar' ? 'bg-slate-100 text-emerald-600' : 'bg-slate-100 text-slate-800'}`}>
                 <LayoutList size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Fichas Técnicas</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Receituário e Custos - {deptUrl}</p>
              </div>
            </div>
            <button onClick={abrirNova} className={`flex items-center gap-2 text-white px-5 py-3 rounded-xl font-bold transition-colors shadow-lg ${deptUrl === 'bar' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'}`}>
               <Plus size={18} /> Nova Ficha
            </button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar receita..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         {loading ? (
            <p className="font-bold text-slate-500">Buscando receitas...</p>
         ) : filtradas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <LayoutList size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">Nenhuma ficha encontrada</h3>
               <p className="text-slate-500 mt-2 font-medium">Cadastre suas receitas para calcular automaticamente o custo do prato.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filtradas.map(f => {
                  // Custo recursivo (resolve bases/sub-receitas)
                  const custoFicha = custoTotalDaFicha(f, fichas);
                  const custoPorcao = custoFicha / (f.rendimento_porcoes || 1);

                  return (
                     <div key={f.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                           <span className={`w-10 h-10 rounded-full flex items-center justify-center ${f.departamento === 'bar' ? 'bg-slate-50 text-emerald-600' : 'bg-slate-50 text-emerald-600'}`}>
                              {f.departamento === 'bar' ? <Wine size={18}/> : <UtensilsCrossed size={18}/>}
                           </span>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => imprimirFicha(f)} title="Imprimir ficha técnica" className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600"><Printer size={16}/></button>
                              <button onClick={() => abrirEditar(f)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600"><Edit3 size={16}/></button>
                              <button onClick={() => handleRemover(f.id)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600"><Trash2 size={16}/></button>
                           </div>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight mb-1">{f.nome_receita}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Rende: {f.rendimento_porcoes} Porções</p>
                        
                        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                           <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Custo / Porção</p>
                              <p className="text-2xl font-black text-emerald-600">{fmtBRL(custoPorcao)}</p>
                           </div>
                           <p className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md">Total: {fmtBRL(custoFicha)}</p>
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </div>

      {/* MODAL DE CRIAÇÃO DA FICHA TÉCNICA */}
      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Receita" : "Nova Receita"}</h2>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Custo Total Atual: <span className="text-emerald-600 font-black">{fmtBRL(calcularCustoTotal(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* COLUNA ESQUERDA: Dados Básicos */}
                  <div className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Receita</label>
                        <input type="text" placeholder="Ex: Caipirinha de Morango" value={form.nome_receita} onChange={e=>setForm({...form, nome_receita: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                     </div>
                     <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={form.eh_base} onChange={e=>setForm({...form, eh_base: e.target.checked})} className="w-4 h-4 accent-purple-600"/>
                           <span className="text-xs font-black text-purple-700 uppercase tracking-widest">É uma base / pré-preparo</span>
                        </label>
                        <p className="text-[11px] text-purple-500 mt-1 font-medium">Marque se esta receita é usada como ingrediente de outros pratos (ex.: base de tucupi, molho, massa).</p>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rendimento {form.eh_base ? '(quanto rende)' : '(nº porções)'}</label>
                           <input type="number" placeholder="1" value={form.rendimento_porcoes} onChange={e=>setForm({...form, rendimento_porcoes: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                        </div>
                        {form.eh_base && (
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Unidade</label>
                              <select value={form.rendimento_unidade} onChange={e=>setForm({...form, rendimento_unidade: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                                 <option value="l">Litros (L)</option>
                                 <option value="kg">Kilos (kg)</option>
                                 <option value="un">Unidades (un)</option>
                              </select>
                           </div>
                        )}
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de Preparo</label>

                        {/* Assistente de IA: você explica solto, a IA estrutura em etapas */}
                        <div className="mt-1 mb-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                           <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={15} className="text-emerald-600" />
                              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Explique com suas palavras — a IA organiza</span>
                           </div>
                           <textarea
                              placeholder="Ex: refogo a cebola no azeite numa panela, junto o camarão, deixo uns 5 min, jogo o leite de coco e o tucupi e cozinho até engrossar..."
                              value={iaExplicacao}
                              onChange={e => setIaExplicacao(e.target.value)}
                              className="w-full h-20 p-3 bg-white border border-emerald-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                           <button
                              type="button"
                              onClick={gerarPreparoIA}
                              disabled={iaLoading}
                              className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                           >
                              {iaLoading
                                 ? <><Loader2 size={16} className="animate-spin" /> Estruturando etapas...</>
                                 : <><Sparkles size={16} /> Gerar modo de preparo</>}
                           </button>
                           <p className="text-[10px] text-emerald-700/70 font-medium mt-1.5 leading-tight">A IA deduz panela, se vai ao fogo, o tempo de cada etapa e o tempo total. Você pode editar o texto depois.</p>
                        </div>

                        <textarea placeholder="Passo a passo da execução..." value={form.modo_preparo} onChange={e=>setForm({...form, modo_preparo: e.target.value})} className="w-full h-40 p-4 mt-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm resize-none"></textarea>
                     </div>
                  </div>

                  {/* COLUNA DIREITA: Ingredientes da Ficha */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[500px]">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Composição (Ingredientes)</label>
                     
                     {/* ADD INGREDIENTE */}
                     <div className="flex gap-2 mb-4">
                        <select onChange={e => { addIngrediente(e.target.value); e.target.value=""; }} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 outline-none focus:border-emerald-500 text-sm">
                           <option value="">+ Adicionar insumo ou base...</option>
                           <optgroup label="Insumos">
                              {insumosAtivos.map(i => <option key={i.id} value={`insumo:${i.id}`}>{i.nome} ({i.unidade_medida})</option>)}
                           </optgroup>
                           {basesDisponiveis.length > 0 && (
                              <optgroup label="Bases / Pré-preparos">
                                 {basesDisponiveis.map(b => <option key={b.id} value={`base:${b.id}`}>{b.nome_receita} ({b.rendimento_unidade})</option>)}
                              </optgroup>
                           )}
                        </select>
                     </div>

                     {/* LISTA DE INGREDIENTES */}
                     <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {ingFicha.length === 0 && (
                           <div className="text-center p-6 text-slate-500 font-medium text-sm">
                              Selecione ingredientes acima para montar a ficha técnica e calcular o custo.
                           </div>
                        )}
                        {ingFicha.map(ing => {
                           const sub = getSub(ing.unidade);
                           const emSub = sub && ing.modo === "sub";
                           const fator = emSub ? sub.f : 1;
                           const unidadeLabel = emSub ? sub.sub : ing.unidade;
                           // valor exibido = quantidade-base convertida pra unidade de digitação
                           const valorExibido = ing.quantidade ? +(ing.quantidade * fator).toFixed(4) : "";
                           const onChangeQtd = (e) => {
                              const v = Number(e.target.value) || 0;
                              updateQtd(ing.chave, v / fator); // sempre grava em unidade-base
                           };
                           return (
                           <div key={ing.chave} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 group">
                              <div className="flex-1 min-w-0">
                                 <p className="font-bold text-slate-800 text-sm truncate flex items-center gap-1.5">
                                    {ing.nome}
                                    {ing.tipo === "base" && <span className="text-[8px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Base</span>}
                                 </p>
                                 <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Custo: {fmtBRL(ing.custo_unitario * ing.quantidade)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <input
                                    type="number"
                                    step={emSub ? "1" : "0.001"}
                                    min="0"
                                    placeholder="0"
                                    value={valorExibido}
                                    onChange={onChangeQtd}
                                    className="w-20 p-2 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"
                                 />
                                 {sub ? (
                                    <button
                                       type="button"
                                       onClick={() => toggleModo(ing.chave)}
                                       title="Alternar unidade de lançamento"
                                       className="text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-1.5 py-1 uppercase w-9 transition-colors"
                                    >
                                       {unidadeLabel}
                                    </button>
                                 ) : (
                                    <span className="text-[10px] font-black text-slate-500 uppercase w-9 text-center">{unidadeLabel}</span>
                                 )}
                              </div>
                              <button onClick={() => removeIngrediente(ing.chave)} className="p-2 text-slate-500 hover:text-slate-600 transition-colors bg-white rounded-lg border border-slate-200">
                                 <Trash2 size={14}/>
                              </button>
                           </div>
                           );
                        })}
                     </div>

                  </div>

               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-6 border-t border-slate-100 bg-white">
                  <button onClick={handleSalvar} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> Salvar Receita ({fmtBRL(calcularCustoTotal(ingFicha))})
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando módulo...</div>}>
       <FichasRunner />
    </Suspense>
  );
}
