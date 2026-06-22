"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Plus, Trash2, FlaskConical, Calculator, Settings2, Info, Check, ArrowRight, Gauge } from "lucide-react";
import {
  PageBody, Card, Chips, Field, NumberInput, Select, TextInput, Btn, EmptyState, Toast, fmtBRL, fmtPct,
} from "../../../components/ui";

const SETORES = ["Cozinha", "Bar"];
import { useERP } from "../../../context/ERPContext";
import { fetchIngredientes, getIngredienteById, calcCustoLinha, getUnidade } from "../../../lib/ingredientes";
import { fetchTodasFichas, salvarFichaCompleta } from "../../../lib/cardapio";
import { podeEditarGlobal } from "../../../lib/auth";

export default function FichasTecnicasPage() {
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const podeEditar = sessao ? podeEditarGlobal(sessao.papel) : false;
  const [catalogo, setCatalogo] = useState([]);
  const [pratosDb, setPratosDb] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Ficha Atual
  const [fichaAtualId, setFichaAtualId] = useState("nova");
  const [nome, setNome]   = useState("");
  const [preco, setPreco] = useState("");
  const [itens, setItens] = useState([]); // { id, ingrediente_id, quantidade }
  
  // Adição
  const [selId, setSelId] = useState("");
  const [qtd, setQtd]     = useState("");
  const [setor, setSetor] = useState("Cozinha");
  const [salvou, setSalvou] = useState(false);

  const catalogoSetor = catalogo.filter((i) => (i.setor || "Cozinha") === setor);

  async function carregarTudo() {
    setLoading(true);
    const [resIng, resFichas] = await Promise.all([
      fetchIngredientes(unidadeAtiva),
      fetchTodasFichas(unidadeAtiva)
    ]);
    setCatalogo(resIng.data || []);
    setSelId(String(resIng.data?.[0]?.id ?? ""));
    setPratosDb(resFichas.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (unidadeAtiva) carregarTudo();
  }, [unidadeAtiva]);

  // Quando muda a ficha no dropdown
  useEffect(() => {
    if (fichaAtualId === "nova") {
      setNome(""); setPreco(""); setItens([]);
    } else {
      const p = pratosDb.find(x => x.id === fichaAtualId);
      if (p) {
        setNome(p.nome);
        setPreco(p.preco || "");
        const fichaRow = p.fichas_tecnicas?.[0];
        if (fichaRow && fichaRow.ficha_itens) {
          setItens(fichaRow.ficha_itens.map(it => ({
            id: `loaded_${it.id}`,
            ingrediente_id: it.ingrediente_id,
            quantidade: it.quantidade
          })));
        } else {
          setItens([]);
        }
      }
    }
  }, [fichaAtualId, pratosDb]);

  const custoTotal = useMemo(() => itens.reduce((acc, it) => {
    const ing = getIngredienteById(it.ingrediente_id, catalogo);
    return acc + (ing ? calcCustoLinha(ing, it.quantidade) : 0);
  }, 0), [itens, catalogo]);

  const precoN = parseFloat(String(preco).replace(",", ".")) || 0;
  const mc  = precoN > 0 ? ((precoN - custoTotal) / precoN) * 100 : 0;
  const cmv = precoN > 0 ? (custoTotal / precoN) * 100 : 0;
  
  // Limites Saudáveis (CMV Ideal < 30%)
  const isHealthy = cmv > 0 && cmv <= 30;
  const isWarning = cmv > 30 && cmv <= 40;
  const isCritical = cmv > 40;

  function adicionar() {
    const ing = getIngredienteById(selId, catalogo);
    const q = parseFloat(String(qtd).replace(",", ".")) || 0;
    if (!ing || q <= 0) return;
    setItens((p) => [...p, { id: `l${Date.now()}`, ingrediente_id: ing.id, quantidade: q }]);
    setQtd("");
  }
  function remover(id) { setItens((p) => p.filter((x) => x.id !== id)); }
  
  async function salvar() {
    if (!nome.trim() || !itens.length) return;
    setSalvando(true);
    
    const prato_id = fichaAtualId === "nova" ? null : fichaAtualId;
    const res = await salvarFichaCompleta(
      prato_id, 
      { nome, preco: precoN, custoTotal, setor }, 
      itens, 
      unidadeAtiva
    );
    
    setSalvando(false);
    if (!res.error) {
      setSalvou(true); 
      setTimeout(() => setSalvou(false), 2500);
      await carregarTudo();
      setFichaAtualId(res.prato_id);
    } else {
      alert("Erro ao salvar: " + res.error);
    }
  }

  const ingSel = getIngredienteById(selId, catalogo);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      
      {/* HEADER LABORATÓRIO */}
      <div className="bg-slate-900 text-white px-6 py-10 md:py-12 rounded-b-[40px] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5"><FlaskConical size={200} /></div>
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 max-w-5xl mx-auto">
            <div>
               <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                  <Calculator size={14}/> Engenharia de Cardápio
               </p>
               <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Laboratório de Receitas.</h1>
               <p className="text-sm font-medium text-slate-400 mt-2">Cálculo de CMV e precificação · {unidadeInfo.nome}</p>
            </div>
            
            <div className="bg-slate-800/80 p-3 rounded-2xl shadow-inner border border-slate-700 min-w-[280px]">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Abrir Ficha Existente</p>
               <Select value={fichaAtualId} onChange={(e) => setFichaAtualId(e.target.value)} className="!bg-slate-900 !text-white !border-slate-700">
                 <option value="nova">✨ Criar Nova Ficha Técnica</option>
                 {pratosDb.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
               </Select>
            </div>
         </div>
      </div>

      <PageBody className="max-w-5xl mx-auto mt-6">
        <Toast show={salvou}>Ficha calculada e armazenada no cofre!</Toast>

        {loading ? (
          <EmptyState icon={FlaskConical} title="Carregando laboratório..." />
        ) : catalogo.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Laboratório sem insumos"
            hint="Cadastre os ingredientes básicos primeiro no módulo de Estoque/Ingredientes." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             
             {/* COLUNA ESQUERDA: DADOS DO PRATO E ADIÇÃO DE INGREDIENTES (7/12) */}
             <div className="lg:col-span-7 space-y-6">
                
                {/* Informações Básicas */}
                <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
                   <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
                      <Settings2 size={18}/> Produto de Venda
                   </h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Nome Comercial do Prato">
                        <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Smash Burger Duplo" disabled={!podeEditar} className="!bg-slate-50" />
                      </Field>
                      <Field label="Preço de Venda Final (R$)">
                        <NumberInput value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" step="0.01" disabled={!podeEditar} className="!bg-slate-50" />
                      </Field>
                   </div>
                </div>

                {/* Bloco de Composição (Adicionar) */}
                {podeEditar && (
                   <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
                      <div className="flex justify-between items-end mb-4">
                         <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                            <FlaskConical size={18}/> Formular Receita
                         </h2>
                         <Chips options={SETORES} value={setor} onChange={(s) => { setSetor(s); const first = catalogo.find((i) => (i.setor || "Cozinha") === s); setSelId(String(first?.id ?? "")); }} />
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-4 mb-4">
                         <div className="flex-1">
                            <Field label="Selecionar Ingrediente">
                              <Select value={selId} onChange={(e) => setSelId(e.target.value)} className="!bg-slate-50">
                                {catalogoSetor.length === 0 && <option value="">— Vazio —</option>}
                                {catalogoSetor.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                              </Select>
                            </Field>
                         </div>
                         <div className="w-full md:w-32">
                            <Field label={`Qtd ${ingSel ? `(${getUnidade(ingSel.unidade).base})` : ""}`}>
                              <NumberInput value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="0" onKeyDown={(e) => e.key === "Enter" && adicionar()} className="!bg-slate-50 text-center font-bold" />
                            </Field>
                         </div>
                      </div>
                      <button onClick={adicionar} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                         <Plus size={18} /> Lançar na Mistura
                      </button>
                   </div>
                )}

                {/* Lista de Ingredientes (Receita) */}
                <div>
                   <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 ml-2">Composição Atual ({itens.length})</h2>
                   
                   {itens.length === 0 ? (
                      <div className="p-8 border-2 border-dashed border-slate-200 rounded-[24px] text-center bg-slate-50/50">
                         <FlaskConical size={32} className="mx-auto text-slate-300 mb-2" />
                         <p className="font-bold text-slate-500">A panela está vazia.</p>
                         <p className="text-xs text-slate-400 mt-1">Adicione os ingredientes acima para iniciar a engenharia de custo.</p>
                      </div>
                   ) : (
                      <div className="space-y-3">
                         {itens.map((it) => {
                            const ing = getIngredienteById(it.ingrediente_id, catalogo);
                            if (!ing) return null;
                            const un = getUnidade(ing.unidade);
                            const custo = calcCustoLinha(ing, it.quantidade);
                            
                            return (
                               <div key={it.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 hover:border-slate-300 transition-colors group">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                     <FlaskConical size={18} />
                                  </div>
                                  <div className="flex-1">
                                     <p className="font-black text-slate-800 text-sm">{ing.nome}</p>
                                     <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                                        {it.quantidade} {un.base} · {fmtBRL(ing.custo_por_unidade_base, 4)} p/ {un.label_base}
                                     </p>
                                  </div>
                                  <div className="text-right">
                                     <p className="font-black font-mono text-slate-700">{fmtBRL(custo)}</p>
                                  </div>
                                  {podeEditar && (
                                     <button onClick={() => remover(it.id)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16} />
                                     </button>
                                  )}
                               </div>
                            );
                         })}
                      </div>
                   )}
                </div>

             </div>

             {/* COLUNA DIREITA: TERMÔMETRO DE LUCRATIVIDADE (5/12) */}
             <div className="lg:col-span-5 relative">
                <div className="sticky top-6">
                   <div className="bg-slate-900 rounded-[32px] p-8 shadow-xl text-white relative overflow-hidden">
                      {/* Efeito de brilho de fundo dinâmico */}
                      <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[80px] opacity-40 transition-colors duration-1000 ${
                        precoN === 0 ? 'bg-slate-700' :
                        isHealthy ? 'bg-emerald-500' : 
                        isWarning ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>

                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2 relative z-10">
                         <Gauge size={18}/> Termômetro de Lucro
                      </h2>

                      {/* Display Custo Ficha */}
                      <div className="bg-white/10 p-5 rounded-2xl border border-white/10 mb-6 relative z-10 backdrop-blur-sm">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Custo Total dos Ingredientes</p>
                         <p className="text-4xl font-black font-mono">{fmtBRL(custoTotal)}</p>
                      </div>

                      {/* Gauges (Se houver preço) */}
                      {precoN > 0 ? (
                         <div className="space-y-6 relative z-10">
                            
                            {/* CMV */}
                            <div>
                               <div className="flex justify-between items-end mb-2">
                                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">CMV (Custo da Mercadoria)</span>
                                  <span className={`text-2xl font-black ${isHealthy ? 'text-emerald-400' : isWarning ? 'text-yellow-400' : 'text-red-400'}`}>
                                     {cmv.toFixed(1)}%
                                  </span>
                               </div>
                               <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(cmv, 100)}%` }}></div>
                               </div>
                               <p className="text-[10px] font-bold text-slate-400 mt-2">
                                  {isHealthy ? "✅ Margem excelente (Menor que 30%)" : 
                                   isWarning ? "⚠️ Margem apertada (Entre 30% e 40%)" : 
                                   "🚨 Cuidado! Produto não rentável (Acima de 40%)"}
                               </p>
                            </div>

                            {/* Margem de Contribuição Bruta */}
                            <div className="pt-4 border-t border-white/10">
                               <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-1">Margem de Contribuição Bruta</p>
                               <p className="text-3xl font-black text-white">{fmtBRL(precoN - custoTotal)}</p>
                               <p className="text-[10px] text-slate-400 font-bold mt-1">Isso é o que sobra para pagar custos fixos e gerar lucro final.</p>
                            </div>

                         </div>
                      ) : (
                         <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl text-center relative z-10">
                            <Info size={24} className="text-slate-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-300">Insira o Preço de Venda</p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Para ativar o cálculo de CMV e Margem</p>
                         </div>
                      )}

                      {/* Botão de Salvar */}
                      {podeEditar && (
                         <button 
                           onClick={salvar} 
                           disabled={!nome.trim() || !itens.length || salvando}
                           className="w-full mt-8 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-emerald-400 hover:text-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] relative z-10 flex items-center justify-center gap-2"
                         >
                            {salvando ? "Blindando Ficha..." : <><Check size={18}/> Salvar Engenharia</>}
                         </button>
                      )}
                   </div>
                </div>
             </div>

          </div>
        )}
      </PageBody>
    </div>
  );
}
