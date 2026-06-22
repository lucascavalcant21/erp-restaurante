"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowDownUp, ArrowUpRight, ArrowDownRight, Wallet, Trash2, Plus, Minus, Search, Calendar, FileText } from "lucide-react";
import {
  PageBody, Card, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchLancamentos, inserirLancamento, removerLancamento } from "../../../lib/financeiro";

const CAT_ENTRADA = ["Vendas Balcão", "iFood / Delivery", "Eventos", "Outras receitas"];
const CAT_SAIDA   = ["Fornecedores", "Folha de Pagamento", "Aluguel", "Energia", "Marketing", "Impostos", "Outras despesas"];

// Ícones Mapeados por Categoria para dar cara de Extrato Bancário
const CatIcon = ({ cat, isEntrada }) => {
  const IconProps = { size: 16, className: isEntrada ? "text-emerald-600" : "text-slate-600" };
  
  if (cat.includes("Vendas") || cat.includes("iFood")) return <Wallet {...IconProps} />;
  if (cat.includes("Eventos")) return <Calendar {...IconProps} />;
  if (cat.includes("Fornecedores")) return <FileText {...IconProps} />;
  if (cat.includes("Folha")) return <Wallet {...IconProps} />;
  
  return isEntrada ? <ArrowUpRight {...IconProps} /> : <ArrowDownRight {...IconProps} />;
};

function FormLancamento({ isReceita, onSalvar, onCancelar }) {
  const [categoria, setCategoria] = useState(isReceita ? CAT_ENTRADA[0] : CAT_SAIDA[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState("");
  
  const cats = isReceita ? CAT_ENTRADA : CAT_SAIDA;
  const corBotao = isReceita ? "bg-emerald-500 hover:bg-emerald-600" : "bg-emerald-500 hover:bg-emerald-600";

  function salvar() {
    if (!descricao.trim()) return setErro("Informe a descrição do lançamento.");
    const v = parseFloat(String(valor).replace(",", ".")) || 0;
    if (v <= 0) return setErro("Informe um valor válido e maior que zero.");
    onSalvar({ tipo: isReceita ? "entrada" : "saida", categoria, descricao: descricao.trim(), valor: v, data });
  }

  return (
    <div className="p-2">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isReceita ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-600'}`}>
         {isReceita ? <Plus size={32} /> : <Minus size={32} />}
      </div>
      
      <div className="text-center mb-6">
         <h3 className="text-xl font-black text-slate-800">{isReceita ? "Nova Receita" : "Nova Despesa"}</h3>
         <p className="text-sm font-medium text-slate-500">{isReceita ? "Dinheiro entrando no caixa" : "Pagamento saindo do caixa"}</p>
      </div>

      <div className="space-y-4">
        <Field label="Valor da Transação (R$)">
          <NumberInput autoFocus value={valor} onChange={(e) => { setValor(e.target.value); setErro(""); }} placeholder="0,00" step="0.01" className="text-2xl font-black text-center h-14" />
        </Field>
        
        <Field label="Descrição Interna">
          <TextInput value={descricao} onChange={(e) => { setDescricao(e.target.value); setErro(""); }} placeholder="ex: Compra de hortifruti..." className="!bg-slate-50" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria Contábil">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="!bg-slate-50">
               {cats.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Data Competência">
            <TextInput type="date" value={data} onChange={(e) => setData(e.target.value)} className="!bg-slate-50" />
          </Field>
        </div>
      </div>

      {erro && <div className="mt-4 p-3 bg-slate-50 text-emerald-600 text-sm font-bold rounded-xl text-center">{erro}</div>}
      
      <div className="flex gap-3 mt-8">
        <button className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" onClick={onCancelar}>Cancelar</button>
        <button className={`flex-1 py-4 font-black text-white rounded-xl shadow-lg transition-all transform hover:-translate-y-1 ${corBotao}`} onClick={salvar}>
           Registrar {isReceita ? "Receita" : "Despesa"}
        </button>
      </div>
    </div>
  );
}

export default function FluxoCaixaFintechPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Todos");
  
  // Modais de Entrada e Saída Separados para UX Limpa
  const [modalReceita, setModalReceita] = useState(false);
  const [modalDespesa, setModalDespesa] = useState(false);
  const [salvou, setSalvou] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchLancamentos(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const entradas = lista.filter((l) => l.tipo === "entrada").reduce((a, l) => a + (Number(l.valor) || 0), 0);
    const saidas   = lista.filter((l) => l.tipo === "saida").reduce((a, l) => a + (Number(l.valor) || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((l) =>
    filtro === "Todos" ? true : filtro === "Entradas" ? l.tipo === "entrada" : l.tipo === "saida"
  ), [lista, filtro]);

  async function salvar(dados) {
    const { data } = await inserirLancamento(dados, unidadeAtiva);
    setLista((p) => [data || dados, ...p]);
    setModalReceita(false);
    setModalDespesa(false);
    setSalvou(true); setTimeout(() => setSalvou(false), 3000);
  }
  
  async function remover(id) {
    await removerLancamento(id);
    setLista((p) => p.filter((l) => l.id !== id));
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <Toast show={salvou}>Transação contabilizada com sucesso!</Toast>

      {/* HEADER FINTECH (O GRANDE CARTÃO) */}
      <div className="bg-slate-900 text-white px-6 pt-12 pb-24 rounded-b-[48px] shadow-xl relative overflow-hidden">
         {/* Background Shapes */}
         <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500 rounded-full blur-[100px] opacity-20"></div>
         <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500 rounded-full blur-[100px] opacity-10"></div>
         
         <div className="relative z-10 max-w-3xl mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Conta da Unidade · {unidadeInfo.nome}</p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-2">{fmtBRL(resumo.saldo)}</h1>
            <p className="text-sm font-medium text-slate-500">Saldo Atual do Período Operacional</p>
         </div>
      </div>

      <PageBody className="max-w-3xl mx-auto -mt-16 relative z-20">
         
         {/* ACTION BUTTONS (Nova Receita / Nova Despesa) */}
         <div className="grid grid-cols-2 gap-4 mb-10">
            <button 
              onClick={() => setModalReceita(true)} 
              className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center justify-center gap-3 group hover:shadow-xl hover:-translate-y-1 transition-all"
            >
               <div className="w-14 h-14 rounded-full bg-emerald-50 group-hover:bg-emerald-500 text-emerald-500 group-hover:text-white flex items-center justify-center transition-colors">
                  <ArrowDownRight size={24} />
               </div>
               <span className="font-bold text-slate-800">Nova Receita</span>
            </button>

            <button 
              onClick={() => setModalDespesa(true)} 
              className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-100 flex flex-col items-center justify-center gap-3 group hover:shadow-xl hover:-translate-y-1 transition-all"
            >
               <div className="w-14 h-14 rounded-full bg-slate-50 group-hover:bg-emerald-500 text-slate-600 group-hover:text-white flex items-center justify-center transition-colors">
                  <ArrowUpRight size={24} />
               </div>
               <span className="font-bold text-slate-800">Nova Despesa</span>
            </button>
         </div>

         {/* RESUMO RÁPIDO */}
         <div className="bg-white p-2 rounded-2xl border border-slate-200 flex justify-between items-center mb-10 shadow-sm">
            <div className="flex-1 text-center py-3 border-r border-slate-100">
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Entradas</p>
               <p className="text-lg font-black text-emerald-600">{fmtBRL(resumo.entradas)}</p>
            </div>
            <div className="flex-1 text-center py-3">
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Saídas</p>
               <p className="text-lg font-black text-emerald-600">{fmtBRL(resumo.saidas)}</p>
            </div>
         </div>

         {/* FILTROS DE EXTRATO */}
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-slate-800">Extrato Bancário</h2>
            <Chips options={["Todos", "Entradas", "Saídas"]} value={filtro} onChange={setFiltro} />
         </div>

         {/* LISTA DE TRANSAÇÕES (EXTRATO) */}
         <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
               <div className="p-12 text-center">
                  <ArrowDownUp size={32} className="mx-auto text-slate-500 animate-pulse mb-4" />
                  <p className="font-bold text-slate-500">Buscando transações...</p>
               </div>
            ) : filtrados.length === 0 ? (
               <div className="p-12 text-center">
                  <Search size={32} className="mx-auto text-slate-500 mb-4" />
                  <p className="font-bold text-slate-800 text-lg">Extrato Limpo</p>
                  <p className="text-sm text-slate-500 mt-2">Você ainda não tem {filtro !== "Todos" ? filtro.toLowerCase() : "lançamentos"} nesse período.</p>
               </div>
            ) : (
               <div className="divide-y divide-slate-100">
                  {filtrados.map((l) => {
                    const isEntrada = l.tipo === "entrada";
                    return (
                      <div key={l.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                         
                         <div className="flex items-center gap-4">
                            {/* Ícone FinTech */}
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isEntrada ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                               <CatIcon cat={l.categoria} isEntrada={isEntrada} />
                            </div>
                            
                            {/* Detalhes */}
                            <div>
                               <p className="font-bold text-slate-900">{l.descricao}</p>
                               <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{l.categoria}</span>
                                  <span className="text-xs font-medium text-slate-500">{fmtData(l.data)}</span>
                               </div>
                            </div>
                         </div>

                         {/* Valor e Ação */}
                         <div className="flex items-center gap-4">
                            <span className={`font-black font-mono text-lg ${isEntrada ? 'text-emerald-600' : 'text-slate-800'}`}>
                               {isEntrada ? "+" : "−"}{fmtBRL(l.valor).replace('R$', '').trim()}
                            </span>
                            
                            {/* Botão Deletar Invisível até o hover */}
                            <button 
                              onClick={() => remover(l.id)} 
                              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-500 hover:text-white"
                              title="Remover lançamento"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </div>
                    );
                  })}
               </div>
            )}
         </div>

      </PageBody>

      {/* Modais Limpos */}
      <Modal open={modalReceita} onClose={() => setModalReceita(false)}>
        <FormLancamento isReceita={true} onSalvar={salvar} onCancelar={() => setModalReceita(false)} />
      </Modal>
      
      <Modal open={modalDespesa} onClose={() => setModalDespesa(false)}>
        <FormLancamento isReceita={false} onSalvar={salvar} onCancelar={() => setModalDespesa(false)} />
      </Modal>

    </div>
  );
}
