"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, salvarInsumo, removerInsumo } from "../../../lib/operacao";
import { FlaskConical, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft, CheckCircle2, AlertTriangle, Sparkles, Loader2, Camera } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Converte um File de imagem em base64 puro (sem o prefixo "data:...;base64,")
function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function IngredientesRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' ou 'bar'
  
  const { unidadeAtiva } = useERP();
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({ id: null, departamento: deptUrl || "cozinha", nome: "", marca: "", unidade_medida: "kg", custo_unitario: "" });

  // Importação em massa via IA (texto colado e/ou foto)
  const [modalIA, setModalIA] = useState(false);
  const [iaDept, setIaDept] = useState(deptUrl || "cozinha");
  const [iaTexto, setIaTexto] = useState("");
  const [iaImagem, setIaImagem] = useState(null); // { base64, mediaType, previewUrl, nomeArquivo }
  const [iaLoading, setIaLoading] = useState(false);
  const [iaItens, setIaItens] = useState(null); // array revisável antes de salvar
  const [iaSalvando, setIaSalvando] = useState(false);
  const fileInputRef = useRef(null);

  // Feedback de sucesso (toast flutuante autodescartável)
  const [toast, setToast] = useState(null); // { msg, tipo: 'ok' | 'erro' }
  const showToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2800);
  };

  // Paginação client-side
  const PAGE_SIZE = 10;
  const [pagina, setPagina] = useState(1);

  const carregar = async () => {
    setLoading(true);
    // Se não tiver dept na URL, traz todos da unidade. Senão, filtra pelo dept.
    const { data } = await fetchInsumos(unidadeAtiva, deptUrl);
    setInsumos(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const filtrados = insumos.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));

  // Reseta para a 1ª página quando a busca, o filtro ou os dados mudam
  useEffect(() => { setPagina(1); }, [busca, deptUrl, insumos.length]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const abrirNovo = () => {
    setForm({ id: null, departamento: deptUrl || "cozinha", nome: "", marca: "", unidade_medida: "kg", custo_unitario: "" });
    setModalNovo(true);
  };

  const abrirEditar = (ins) => {
    setForm({ marca: "", ...ins });
    setModalNovo(true);
  };

  // ─── Importação em massa via IA (foto ou lista colada) ─────────────────────
  const abrirModalIA = () => {
    setIaDept(deptUrl || "cozinha");
    setIaTexto("");
    setIaImagem(null);
    setIaItens(null);
    setModalIA(true);
  };

  const handleSelecionarImagem = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileParaBase64(file);
    setIaImagem({ base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file), nomeArquivo: file.name });
  };

  const gerarInsumosIA = async () => {
    if (!iaTexto.trim() && !iaImagem) return alert("Cole uma lista de texto ou envie uma foto.");
    setIaLoading(true);
    setIaItens(null);
    try {
      const res = await fetch("/api/ia-insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: iaTexto,
          imagem_base64: iaImagem?.base64 || null,
          imagem_media_type: iaImagem?.mediaType || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao ler a lista/foto.");
        return;
      }
      // Cada item vira uma linha revisável, com checkbox de inclusão
      setIaItens(data.itens.map(it => ({ ...it, incluir: true })));
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaLoading(false);
    }
  };

  const atualizarItemIA = (idx, campo, valor) => {
    setIaItens(lista => lista.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  };

  const salvarItensIA = async () => {
    const selecionados = (iaItens || []).filter(it => it.incluir);
    if (selecionados.length === 0) return alert("Selecione ao menos um ingrediente.");
    for (const it of selecionados) {
      if (!it.nome.trim() || !it.custo_unitario || Number(it.custo_unitario) <= 0) {
        return alert(`Confira o ingrediente "${it.nome || '(sem nome)'}": nome e custo são obrigatórios.`);
      }
    }
    setIaSalvando(true);
    let erros = 0;
    for (const it of selecionados) {
      const erro = await salvarInsumo({
        departamento: iaDept,
        nome: it.nome.trim(),
        marca: (it.marca || "").trim(),
        unidade_medida: it.unidade_medida,
        custo_unitario: Number(it.custo_unitario),
        unidade_id: unidadeAtiva,
      });
      if (erro.error) erros++;
    }
    setIaSalvando(false);
    setModalIA(false);
    await carregar();
    if (erros > 0) {
      showToast(`${selecionados.length - erros} salvos, ${erros} falharam.`, "erro");
    } else {
      showToast(`${selecionados.length} ingrediente(s) cadastrado(s)!`);
    }
  };

  const handleSalvar = async () => {
    if(!form.nome.trim()) return alert("Digite o nome do ingrediente");
    if(form.nome.length > 100) return alert("Nome não pode ter mais de 100 caracteres");
    if(!form.custo_unitario) return alert("Digite o custo");

    const custo = Number(form.custo_unitario);
    if(custo <= 0) return alert("Custo deve ser um valor maior que zero");
    if(custo > 999999.99) return alert("Custo não pode ser maior que R$ 999.999,99");

    const erro = await salvarInsumo({
       ...form,
       unidade_id: unidadeAtiva,
       custo_unitario: custo
    });

    if(erro.error) {
      return alert("Erro ao salvar ingrediente: " + erro.error);
    }

    const editando = !!form.id;
    setModalNovo(false);
    await carregar();
    showToast(editando ? "Ingrediente atualizado!" : "Ingrediente cadastrado!");
  };

  const handleRemover = async (id) => {
    const ingrediente = insumos.find(i => i.id === id);
    if(!ingrediente) return;

    if(confirm(`Deseja deletar "${ingrediente.nome}"?\n\nAviso: Se este ingrediente estiver em uso numa Ficha Técnica, a exclusão falhará.`)) {
       const { error } = await removerInsumo(id);
       if(error) {
         if(error.toLowerCase().includes("foreign") || error.toLowerCase().includes("ficha")) {
           alert(`Não é possível deletar "${ingrediente.nome}" pois ele está sendo usado em uma Ficha Técnica.\n\nDelete a ficha técnica primeiro.`);
         } else {
           alert(`Erro ao deletar "${ingrediente.nome}": ${error}`);
         }
       } else {
         await carregar();
         showToast(`"${ingrediente.nome}" removido.`);
       }
    }
  };

  if(!unidadeAtiva) {
    return (
      <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <FlaskConical size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Nenhuma Loja Ativa</h2>
          <p className="text-slate-600 font-semibold">Selecione uma loja na barra superior para gerenciar ingredientes.</p>
        </div>
      </div>
    );
  }

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
                 <FlaskConical size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Banco de Ingredientes</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Custo Base de Insumos {deptUrl ? `- ${deptUrl}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={abrirModalIA} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-5 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-sm">
                  <Sparkles size={18} /> Importar com IA
               </button>
               <button onClick={abrirNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
                  <Plus size={18} /> Cadastrar Insumo
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar ingrediente..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         <div className="inline-flex gap-1 p-1 mb-6 rounded-xl bg-slate-100">
           <button onClick={() => router.push(`/dashboard/operacao/ingredientes`)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${!deptUrl ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
             Todos
           </button>
           <button onClick={() => router.push(`/dashboard/operacao/ingredientes?dept=cozinha`)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${deptUrl === 'cozinha' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
             Cozinha
           </button>
           <button onClick={() => router.push(`/dashboard/operacao/ingredientes?dept=bar`)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${deptUrl === 'bar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
             Bar
           </button>
         </div>

         <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Ingrediente</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-20">Unid.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-32">Custo / Base</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-24">Ações</span>
            </div>
            {/* Linhas */}
            <div className="bg-white divide-y divide-slate-100">
               {loading && (
                 <div className="p-12 text-center">
                   <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold text-sm">Carregando ingredientes{deptUrl ? ` de ${deptUrl}` : ''}...</p>
                 </div>
               )}
               {!loading && paginados.map(ins => {
                 const dept = ins.departamento?.toLowerCase();
                 const deptColor = dept === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                 return (
                   <div key={ins.id} className="px-6 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center group hover:bg-emerald-50/40 transition-all duration-150">
                     {/* Nome + Dept */}
                     <div className="flex items-center gap-3 min-w-0">
                       <div className="w-1 h-10 rounded-full bg-emerald-400 shrink-0" />
                       <div className="min-w-0">
                         <p className="font-bold text-slate-800 text-[15px] leading-tight truncate">{ins.nome}{ins.marca ? <span className="text-slate-400 font-medium"> · {ins.marca}</span> : null}</p>
                         <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${deptColor}`}>{ins.departamento}</span>
                       </div>
                     </div>
                     {/* Unidade */}
                     <div className="w-20 flex justify-center">
                       <span className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm">{ins.unidade_medida}</span>
                     </div>
                     {/* Custo */}
                     <div className="w-32 text-center">
                       <span className="font-black text-xl text-emerald-600">{fmtBRL(ins.custo_unitario)}</span>
                     </div>
                     {/* Ações */}
                     <div className="w-24 flex justify-end gap-1">
                       <button onClick={() => abrirEditar(ins)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-all" title="Editar">
                         <Edit3 size={16}/>
                       </button>
                       <button onClick={() => handleRemover(ins.id)} className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-lg transition-all" title="Remover">
                         <Trash2 size={16}/>
                       </button>
                     </div>
                   </div>
                 );
               })}
               {!loading && filtrados.length === 0 && (
                 <div className="p-16 text-center">
                   <p className="text-slate-400 font-bold">Nenhum ingrediente encontrado.</p>
                 </div>
               )}
            </div>

            {/* Controles de paginação */}
            {!loading && filtrados.length > PAGE_SIZE && (
              <div className="bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  Mostrando {(paginaAtual - 1) * PAGE_SIZE + 1}–{Math.min(paginaAtual * PAGE_SIZE, filtrados.length)} de {filtrados.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1}
                    className="px-3 py-1.5 rounded-lg font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs font-black text-slate-600 px-2">{paginaAtual} / {totalPaginas}</span>
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="px-3 py-1.5 rounded-lg font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
         </div>
      </div>

      {/* Toast flutuante de feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in slide-in-from-bottom-4 fade-in">
          <div className={`px-5 py-3 rounded-xl shadow-2xl font-bold text-white flex items-center gap-2 ${toast.tipo === 'erro' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {toast.tipo === 'erro' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />} {toast.msg}
          </div>
        </div>
      )}

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Insumo" : "Novo Insumo"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  {!deptUrl && (
                    <div>
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Departamento</label>
                       <select value={form.departamento} onChange={e=>setForm({...form, departamento: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                          <option value="cozinha">Cozinha</option>
                          <option value="bar">Bar</option>
                       </select>
                    </div>
                  )}

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Ingrediente</label>
                     <input type="text" placeholder="Ex: Tomate" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Marca (opcional)</label>
                     <input type="text" placeholder="Ex: Carmem" value={form.marca || ""} onChange={e=>setForm({...form, marca: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Unidade Base</label>
                        <select value={form.unidade_medida} onChange={e=>setForm({...form, unidade_medida: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="kg">Kilo (KG)</option>
                           <option value="l">Litro (L)</option>
                           <option value="un">Unidade (UN)</option>
                           <option value="g">Grama (G)</option>
                           <option value="ml">Mililitro (ML)</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Custo da Unid. Base</label>
                        <input type="number" step="0.01" min="0" max="999999.99" placeholder="0.00" value={form.custo_unitario} onChange={e=>setForm({...form, custo_unitario: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                     Dica: Cadastre o custo da unidade de compra. Ex.: garrafa de Vodka de 1 Litro por R$ 60,00 → Unidade Base "L" e Custo "60". Nas Fichas Técnicas você lança em ml (ou g, para Kg) e o sistema converte o custo automaticamente.
                  </p>
               </div>

               <button onClick={handleSalvar} className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20}/> Salvar Ingrediente
               </button>
            </div>
         </div>
      )}

      {/* IMPORTAÇÃO EM MASSA VIA IA */}
      {modalIA && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] w-full max-w-3xl my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center p-8 pb-6 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Sparkles size={22}/></div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">Importar Ingredientes com IA</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Cole uma lista ou envie foto de nota fiscal / lista de compras</p>
                     </div>
                  </div>
                  <button onClick={() => setModalIA(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-8 overflow-y-auto custom-scrollbar space-y-5">
                  {!iaItens ? (
                     <>
                        {!deptUrl && (
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Departamento destes ingredientes</label>
                              <select value={iaDept} onChange={e=>setIaDept(e.target.value)} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                                 <option value="cozinha">Cozinha</option>
                                 <option value="bar">Bar</option>
                              </select>
                           </div>
                        )}

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Colar lista (opcional se enviar foto)</label>
                           <textarea
                              placeholder={"Ex:\nTomate Carmem 2kg R$ 15,80\nFilé de Frango Sadia 3kg R$ 42,00\nVodka Smirnoff 1L R$ 60,00"}
                              value={iaTexto}
                              onChange={e => setIaTexto(e.target.value)}
                              className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ou enviar foto (nota fiscal, lista, etiqueta)</label>
                           <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSelecionarImagem} className="hidden" />
                           {iaImagem ? (
                              <div className="mt-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                 <img src={iaImagem.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-700 truncate">{iaImagem.nomeArquivo}</p>
                                    <button onClick={() => setIaImagem(null)} className="text-xs font-bold text-red-500 hover:text-red-600 mt-1">Remover foto</button>
                                 </div>
                              </div>
                           ) : (
                              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full mt-1 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors">
                                 <Camera size={24} />
                                 <span className="font-bold text-sm">Tirar foto ou escolher da galeria</span>
                              </button>
                           )}
                        </div>

                        <button
                           onClick={gerarInsumosIA}
                           disabled={iaLoading}
                           className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                           {iaLoading ? <><Loader2 size={18} className="animate-spin"/> Lendo ingredientes...</> : <><Sparkles size={18}/> Extrair ingredientes</>}
                        </button>
                     </>
                  ) : (
                     <>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confira antes de salvar ({iaItens.filter(i=>i.incluir).length} de {iaItens.length} selecionados)</p>
                        <div className="space-y-2">
                           {iaItens.map((it, idx) => (
                              <div key={idx} className={`p-3 rounded-xl border flex flex-wrap items-center gap-2 ${it.incluir ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                 <input type="checkbox" checked={it.incluir} onChange={e=>atualizarItemIA(idx, "incluir", e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                                 <input type="text" value={it.nome} onChange={e=>atualizarItemIA(idx, "nome", e.target.value)} placeholder="Nome" className="flex-1 min-w-[140px] p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-emerald-500" />
                                 <input type="text" value={it.marca} onChange={e=>atualizarItemIA(idx, "marca", e.target.value)} placeholder="Marca" className="w-28 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500" />
                                 <select value={it.unidade_medida} onChange={e=>atualizarItemIA(idx, "unidade_medida", e.target.value)} className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-emerald-500">
                                    <option value="kg">KG</option>
                                    <option value="l">L</option>
                                    <option value="un">UN</option>
                                    <option value="g">G</option>
                                    <option value="ml">ML</option>
                                 </select>
                                 <input type="number" step="0.01" value={it.custo_unitario} onChange={e=>atualizarItemIA(idx, "custo_unitario", e.target.value)} placeholder="Custo/base" className="w-28 p-2 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-600 text-sm outline-none focus:border-emerald-500" />
                              </div>
                           ))}
                        </div>
                        <button onClick={() => setIaItens(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Voltar e enviar outra lista/foto</button>
                     </>
                  )}
               </div>

               {iaItens && (
                  <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0">
                     <button onClick={salvarItensIA} disabled={iaSalvando} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                        {iaSalvando ? <><Loader2 size={20} className="animate-spin"/> Salvando...</> : <><Save size={20}/> Salvar {iaItens.filter(i=>i.incluir).length} Ingrediente(s)</>}
                     </button>
                  </div>
               )}
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando módulo...</div>}>
       <IngredientesRunner />
    </Suspense>
  );
}
