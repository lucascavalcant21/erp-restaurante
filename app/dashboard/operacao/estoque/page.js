"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package, AlertTriangle, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle,
  Edit3, Trash2, Tablet, ShoppingCart, Copy, Search, CheckCircle2, Factory, LogOut, LogIn
} from "lucide-react";
import {
  PageBody, Card, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoque, inserirItem, atualizarItem, movimentar, removerItem } from "../../../lib/estoque";
import { podeEditarGlobal } from "../../../lib/auth";
import { fetchCardapio } from "../../../lib/cardapio";
import { fetchDrinks } from "../../../lib/drinks";

const CATEGORIAS = ["Proteína", "Grão", "Hortifruti", "Laticínios", "Óleo", "Bebida", "Embalagem", "Limpeza", "Outros"];
const UNIDADES_EST = ["KG", "L", "UN", "CX", "MAÇO", "G", "ML"];
const VAZIO = { nome: "", categoria: "Proteína", unidade: "KG", quantidade: "", minimo: "", custo_unitario: "" };

function statusItem(i) {
  if ((i.quantidade ?? 0) <= (i.minimo ?? 0)) return "critico";
  if ((i.quantidade ?? 0) <= (i.minimo ?? 0) * 1.5) return "baixo";
  return "ok";
}

function FormItem({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial
    ? { ...inicial, quantidade: String(inicial.quantidade ?? ""), minimo: String(inicial.minimo ?? ""), custo_unitario: String(Number(inicial.custo_unitario) || Number(inicial.preco_unit) || "") }
    : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do item.");
    onSalvar({
      ...f, nome: f.nome.trim(),
      quantidade: Number(f.quantidade) || 0,
      minimo: Number(f.minimo) || 0,
      custo_unitario: Number(f.custo_unitario) || 0,
    });
  }

  return (
    <div className="p-2 space-y-4">
      <Field label="Nome Comercial do Insumo"><TextInput autoFocus value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Frango (peito)" className="!bg-slate-50" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoria"><Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)} className="!bg-slate-50">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Unidade de Medida"><Select value={f.unidade} onChange={(e) => set("unidade", e.target.value)} className="!bg-slate-50">{UNIDADES_EST.map((u) => <option key={u}>{u}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Qtd Atual"><NumberInput value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} placeholder="0" className="!bg-slate-50" /></Field>
        <Field label="Mínimo Ideal"><NumberInput value={f.minimo} onChange={(e) => set("minimo", e.target.value)} placeholder="0" className="!bg-slate-50" /></Field>
        <Field label="Custo un. (R$)"><NumberInput value={f.custo_unitario} onChange={(e) => set("custo_unitario", e.target.value)} placeholder="0,00" step="0.01" className="!bg-slate-50" /></Field>
      </div>
      {erro && <div className="p-3 bg-red-50 text-red-600 font-bold rounded-xl text-center text-sm">{erro}</div>}
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors" onClick={onCancelar}>Cancelar</button>
        <button className="flex-1 py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-slate-800 transition-colors" onClick={salvar}>{inicial ? "Atualizar Ficha" : "Cadastrar Insumo"}</button>
      </div>
    </div>
  );
}

function FormMov({ item, tipo, produtosCombo, onConfirmar, onCancelar }) {
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [produtoDestino, setProdutoDestino] = useState("");
  const entrada = tipo === "entrada";
  const n = parseFloat(qtd) || 0;
  const invalido = n <= 0 || (!entrada && n > (item.quantidade ?? 0)) || (!entrada && !produtoDestino);
  
  function confirmar() {
    let finalObs = obs;
    if (!entrada && produtoDestino) {
      finalObs = `Produção: ${produtoDestino}${obs ? ` - ${obs}` : ""}`;
    }
    onConfirmar(n, finalObs);
  }

  return (
    <div className="p-2 space-y-4">
      <div className={`p-4 rounded-xl mb-4 flex items-center justify-between ${entrada ? 'bg-emerald-50' : 'bg-orange-50'}`}>
         <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${entrada ? 'text-emerald-600' : 'text-orange-600'}`}>{entrada ? 'Nova Entrada' : 'Saída de Insumo'}</p>
            <p className={`text-lg font-black ${entrada ? 'text-emerald-900' : 'text-orange-900'}`}>{item.nome}</p>
         </div>
         <div className="text-right">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${entrada ? 'text-emerald-600' : 'text-orange-600'}`}>Estoque Atual</p>
            <p className={`text-lg font-black ${entrada ? 'text-emerald-900' : 'text-orange-900'}`}>{item.quantidade} {item.unidade}</p>
         </div>
      </div>
      
      {!entrada && (
        <Field label="Para qual produção está tirando? *">
          <Select value={produtoDestino} onChange={(e) => setProdutoDestino(e.target.value)} className="!bg-slate-50">
            <option value="">Selecione o prato ou destino...</option>
            {produtosCombo.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
            <option value="Perda/Desperdício">Perda/Desperdício</option>
            <option value="Consumo Interno">Consumo Interno</option>
          </Select>
        </Field>
      )}

      <Field label={`Quantidade a movimentar (${item.unidade}) *`}>
        <NumberInput autoFocus value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="0" step="0.1" className="text-2xl h-14 font-black text-center !bg-slate-50" />
      </Field>
      
      <Field label="Motivo / Observação (Opcional)">
        <TextInput value={obs} onChange={(e) => setObs(e.target.value)} placeholder={entrada ? "ex: NF 12345 Fornecedor X" : "ex: Complemento turno noite..."} className="!bg-slate-50" />
      </Field>
      
      <div className="flex gap-3 pt-4">
        <button className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors" onClick={onCancelar}>Cancelar</button>
        <button 
          className={`flex-1 py-3 font-black text-white rounded-xl shadow-lg transition-all disabled:opacity-50 ${entrada ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'}`} 
          disabled={invalido} 
          onClick={confirmar}
        >
          Confirmar {entrada ? "Entrada" : "Saída"}
        </button>
      </div>
    </div>
  );
}

export default function EstoqueLogisticoPage() {
  const router = useRouter();
  const { setEstoque: setEstoqueGlobal, unidadeAtiva, sessao, unidadeInfo } = useERP();
  const podeEditar = sessao ? podeEditarGlobal(sessao.papel) : false;
  const [itens, setItens]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]     = useState("");
  const [cat, setCat]         = useState("Todos");
  const [modal, setModal]     = useState(false);
  const [editar, setEditar]   = useState(null);
  const [mov, setMov]         = useState(null); 
  const [salvou, setSalvou]   = useState(false);
  const [produtos, setProdutos] = useState([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [resEstoque, resCardapio, resDrinks] = await Promise.all([
      fetchEstoque(unidadeAtiva),
      fetchCardapio(unidadeAtiva),
      fetchDrinks(unidadeAtiva)
    ]);
    setItens(resEstoque.data || []);
    const ativos = [...(resCardapio.data || []), ...(resDrinks.data || [])].filter(p => p.ativo !== false);
    ativos.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    setProdutos(ativos);
    setLoading(false);
  }, [unidadeAtiva]);
  
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (!loading) setEstoqueGlobal(itens); }, [itens, loading, setEstoqueGlobal]);

  const resumo = useMemo(() => ({
    total: itens.length,
    valor: itens.reduce((a, i) => a + (i.quantidade || 0) * (Number(i.custo_unitario) || Number(i.preco_unit) || 0), 0),
    criticos: itens.filter((i) => statusItem(i) === "critico"),
    baixos: itens.filter((i) => statusItem(i) === "baixo"),
  }), [itens]);

  const filtrados = useMemo(() => itens.filter((i) => {
    const mb = i.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cat === "Todos" || i.categoria === cat;
    return mb && mc;
  }), [itens, busca, cat]);

  async function salvarItem(dados) {
    const campos = {
      nome: dados.nome, categoria: dados.categoria, unidade: dados.unidade,
      quantidade: dados.quantidade, minimo: dados.minimo,
      preco_unit: dados.custo_unitario, custo_unitario: dados.custo_unitario,
    };
    if (editar) {
      await atualizarItem(editar.id, campos);
    } else {
      await inserirItem(campos, unidadeAtiva);
    }
    await carregar();
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
  }

  async function confirmarMov(qtd, obs) {
    const { item, tipo } = mov;
    const delta = tipo === "entrada" ? qtd : -qtd;
    setItens((p) => p.map((i) => i.id === item.id ? { ...i, quantidade: Math.max(0, (i.quantidade || 0) + delta) } : i));
    await movimentar(item.id, tipo, qtd, obs);
    setMov(null);
  }

  async function remover(id) {
    await removerItem(id);
    setItens((p) => p.filter((i) => i.id !== id));
  }

  const gerarListaCompras = () => {
    let texto = `*🛒 LISTA DE COMPRAS - ${unidadeInfo?.nome || 'HEFISTO'}*\n_Gerada automaticamente_\n\n`;
    resumo.criticos.forEach(i => {
      const comprarQtd = (i.minimo || 0) - (i.quantidade || 0);
      texto += `• ${i.nome}: *Comprar ${comprarQtd} ${i.unidade}* _(Atual: ${i.quantidade})_\n`;
    });
    navigator.clipboard.writeText(texto);
    alert("Lista copiada! Cole no WhatsApp do seu fornecedor ou comprador.");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <Toast show={salvou}>Operação Logística Registrada!</Toast>

      {/* HEADER LOGÍSTICO */}
      <div className="bg-slate-900 text-white px-6 py-10 rounded-b-[40px] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5"><Factory size={200} /></div>
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 max-w-5xl mx-auto">
            <div>
               <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                  <Package size={14}/> Centro de Distribuição
               </p>
               <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Estoque Geral.</h1>
               <p className="text-sm font-medium text-slate-400 mt-2">Gestão de Insumos da {unidadeInfo.nome}</p>
            </div>
            
            <div className="flex gap-3">
               <button onClick={() => router.push("/dashboard/operacao/estoque/tablet")} className="px-5 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                  <Tablet size={18}/> Modo Tablet
               </button>
               {podeEditar && (
                 <button onClick={() => { setEditar(null); setModal(true); }} className="px-5 py-3 rounded-2xl bg-white text-slate-900 font-black shadow-lg flex items-center gap-2 hover:bg-slate-100 transition-all">
                    Cadastrar Insumo
                 </button>
               )}
            </div>
         </div>
      </div>

      <PageBody className="max-w-5xl mx-auto mt-6">
        
        {/* PAINEL DE RUPTURA (ALERTA LOGÍSTICO) */}
        {!loading && resumo.criticos.length > 0 && (
          <div className="mb-8 p-6 md:p-8 bg-red-600 rounded-[32px] shadow-lg text-white flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden border border-red-500">
             <div className="absolute -right-10 -bottom-10 opacity-10"><AlertTriangle size={200}/></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                   <AlertTriangle size={24} className="text-red-200" />
                   <h2 className="text-2xl font-black tracking-tighter">Alerta de Ruptura!</h2>
                </div>
                <p className="text-red-100 font-medium">Você tem <span className="font-black text-white">{resumo.criticos.length} itens</span> abaixo do estoque mínimo. A operação pode parar.</p>
             </div>
             
             <button onClick={gerarListaCompras} className="relative z-10 px-6 py-4 bg-white text-red-700 font-black rounded-2xl shadow-xl flex items-center gap-3 hover:scale-105 transition-transform w-full md:w-auto justify-center">
                <ShoppingCart size={20}/>
                Gerar Pedido WhatsApp
             </button>
          </div>
        )}

        {/* MODO SEGURO */}
        {!loading && resumo.criticos.length === 0 && resumo.total > 0 && (
          <div className="mb-8 p-6 bg-emerald-50 rounded-[32px] border border-emerald-100 flex items-center gap-4 text-emerald-800">
             <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 size={24}/>
             </div>
             <div>
                <h3 className="font-black text-lg">Estoque Abastecido</h3>
                <p className="text-sm font-medium text-emerald-600">Nenhum insumo crítico no momento. Operação rodando 100% segura.</p>
             </div>
          </div>
        )}

        {/* BARRA DE PESQUISA E FILTROS */}
        <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-200 mb-8 flex flex-col gap-4">
           <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={busca} 
                onChange={e => setBusca(e.target.value)} 
                placeholder="Pesquisar insumo por nome..." 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-slate-900 outline-none"
              />
           </div>
           <Chips options={["Todos", ...CATEGORIAS]} value={cat} onChange={setCat} />
        </div>

        {/* LISTAGEM DE PRATELEIRAS (O ESTOQUE EM SI) */}
        <div>
           {loading ? (
             <div className="p-12 text-center">
                <Package size={32} className="mx-auto text-slate-300 animate-pulse mb-4" />
                <p className="font-bold text-slate-500">Varrendo prateleiras...</p>
             </div>
           ) : filtrados.length === 0 ? (
             <div className="p-12 text-center bg-white rounded-[32px] border border-slate-200">
                <Search size={32} className="mx-auto text-slate-300 mb-4" />
                <p className="font-bold text-slate-800 text-lg">Nenhum item encontrado</p>
                <p className="text-sm text-slate-500 mt-2">Ajuste os filtros ou cadastre novos insumos.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtrados.map((i) => {
                  const st = statusItem(i);
                  const valor = (i.quantidade || 0) * (Number(i.custo_unitario) || Number(i.preco_unit) || 0);
                  const pct = Math.min(((i.quantidade || 0) / ((i.minimo || 1) * 3)) * 100, 100);
                  
                  // Cores da progress bar
                  const corBarra = st === "critico" ? "bg-red-500" : st === "baixo" ? "bg-orange-400" : "bg-emerald-500";
                  const corBg = st === "critico" ? "bg-red-100" : st === "baixo" ? "bg-orange-100" : "bg-emerald-100";
                  const corBadge = st === "critico" ? "bg-red-50 text-red-600 border-red-200" : st === "baixo" ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-emerald-50 text-emerald-600 border-emerald-200";

                  return (
                    <div key={i.id} className="bg-white p-5 rounded-[24px] border border-slate-200 hover:border-slate-300 shadow-sm transition-all group">
                       
                       <div className="flex justify-between items-start mb-4">
                          <div className="min-w-0 pr-4">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{i.categoria}</span>
                             </div>
                             <h3 className="text-lg font-black text-slate-800 truncate">{i.nome}</h3>
                          </div>
                          
                          <div className={`px-3 py-1.5 rounded-xl border flex flex-col items-center justify-center shrink-0 ${corBadge}`}>
                             <span className="text-xs font-bold uppercase tracking-widest opacity-80">Qtd</span>
                             <span className="text-lg font-black font-mono">{i.quantidade} {i.unidade}</span>
                          </div>
                       </div>

                       {/* Tanque de Estoque (Progress Bar) */}
                       <div className="mb-4">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                             <span>Nível Operacional</span>
                             <span>Min: {i.minimo} {i.unidade}</span>
                          </div>
                          <div className={`w-full h-2 rounded-full overflow-hidden ${corBg}`}>
                             <div className={`h-full rounded-full transition-all duration-700 ${corBarra}`} style={{ width: `${pct}%` }}></div>
                          </div>
                       </div>

                       {/* Botões de Ação */}
                       <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                          <button onClick={() => setMov({ item: i, tipo: "entrada" })} className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-colors">
                             <LogIn size={14}/> Entrada
                          </button>
                          <button onClick={() => setMov({ item: i, tipo: "saida" })} className="flex-1 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-colors">
                             <LogOut size={14}/> Saída
                          </button>
                          
                          {podeEditar && (
                             <div className="flex gap-2 pl-2 border-l border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditar(i); setModal(true); }} className="w-10 h-10 bg-slate-50 hover:bg-slate-200 text-slate-500 rounded-xl flex items-center justify-center transition-colors">
                                   <Edit3 size={14}/>
                                </button>
                                <button onClick={() => remover(i.id)} className="w-10 h-10 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-xl flex items-center justify-center transition-colors">
                                   <Trash2 size={14}/>
                                </button>
                             </div>
                          )}
                       </div>

                    </div>
                  );
                })}
             </div>
           )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Atualizar Insumo" : "Novo Insumo"}>
        <FormItem inicial={editar} onSalvar={salvarItem} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
      
      <Modal open={!!mov} onClose={() => setMov(null)} title={mov?.tipo === "entrada" ? "Registrar Entrada (Compra)" : "Registrar Saída (Consumo/Perda)"}>
        {mov && <FormMov item={mov.item} tipo={mov.tipo} produtosCombo={produtos} onConfirmar={confirmarMov} onCancelar={() => setMov(null)} />}
      </Modal>
    </div>
  );
}
