"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, Briefcase, Clock, DollarSign, Edit3, Trash2, Info, FileText, Upload, Loader2 } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, EmptyState, Modal, Field, TextInput, Btn, Toast, Chips
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchTiposBonificacao, inserirTipoBonificacao, atualizarTipoBonificacao, removerTipoBonificacao } from "../../../lib/pessoas";
import { fetchCargos, inserirCargo, atualizarCargo, removerCargo, fetchTurnos, inserirTurno, atualizarTurno, removerTurno, inserirCargosPadrao, fetchRegulamento, salvarRegulamento, uploadRegulamentoPDF } from "../../../lib/rh";

function FormGenerico({ inicial, onSalvar, onCancelar, temRegras, temFuncoes }) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [regras, setRegras] = useState(inicial?.regras || "");
  const [funcoes, setFuncoes] = useState(inicial?.funcoes_padrao || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return setErro("O nome é obrigatório.");
    setSalvando(true);
    let payload = { nome };
    if (temRegras) payload.regras = regras;
    if (temFuncoes) payload.funcoes_padrao = funcoes;
    await onSalvar(payload);
    setSalvando(false);
  }

  return (
    <>
      <Field label="Nome">
        <TextInput value={nome} onChange={e => { setNome(e.target.value); setErro(""); }} placeholder="Digite o nome..." />
      </Field>
      {temRegras && (
        <Field label="Regras / Descrição (Opcional)">
          <TextInput value={regras} onChange={e => setRegras(e.target.value)} placeholder="Condições para ganhar este bônus..." />
        </Field>
      )}
      {temFuncoes && (
        <Field label="Funções Padrão do Cargo">
          <textarea 
            value={funcoes} 
            onChange={e => setFuncoes(e.target.value)} 
            placeholder="Ex: Prepara alimentos, limpa a praça..."
            className="erp-input h-24 resize-none py-2"
          />
        </Field>
      )}
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3 mt-4">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando..." : "Salvar"}
        </Btn>
      </div>
    </>
  );
}

export default function RhConfiguracoesPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [abaAtiva, setAbaAtiva] = useState("cargos");
  
  const [cargos, setCargos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [bonus, setBonus] = useState([]);
  
  const [regulamento, setRegulamento] = useState({ texto_regulamento: "", url_pdf: "" });
  const [salvandoReg, setSalvandoReg] = useState(false);
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState("");
  const [gerandoPadroes, setGerandoPadroes] = useState(false);

  async function carregar() {
    setLoading(true);
    const [c, t, b, reg] = await Promise.all([
      fetchCargos(unidadeAtiva),
      fetchTurnos(unidadeAtiva),
      fetchTiposBonificacao(unidadeAtiva),
      fetchRegulamento(unidadeAtiva)
    ]);
    setCargos(c.data || []);
    setTurnos(t.data || []);
    setBonus(b.data || []);
    if (reg.data) setRegulamento(reg.data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [unidadeAtiva]);

  const abaProps = {
    cargos: { icon: Briefcase, lista: cargos, title: "Cargos", insert: inserirCargo, update: atualizarCargo, remove: removerCargo, hasRules: false, hasFunctions: true },
    turnos: { icon: Clock, lista: turnos, title: "Turnos", insert: inserirTurno, update: atualizarTurno, remove: removerTurno, hasRules: false, hasFunctions: false },
    bonus: { icon: DollarSign, lista: bonus, title: "Tipos de Bônus", insert: inserirTipoBonificacao, update: atualizarTipoBonificacao, remove: removerTipoBonificacao, hasRules: true, hasFunctions: false }
  };
  
  const atual = abaProps[abaAtiva];

  async function salvar(dados) {
    if (editar) {
      await atual.update(editar.id, dados);
      setSalvou(`${atual.title} atualizado!`);
    } else {
      await atual.insert(dados, unidadeAtiva);
      setSalvou(`Novo ${atual.title} criado!`);
    }
    setModal(false);
    setTimeout(() => setSalvou(""), 3000);
    carregar();
  }

  async function remover(id) {
    if (confirm(`Tem certeza que deseja apagar?`)) {
      await atual.remove(id);
      carregar();
    }
  }

  async function handleGerarPadroes() {
    if (confirm("Isso vai adicionar todos os cargos da brigada (Cozinha, Salão, Bar) na sua unidade. Deseja continuar?")) {
      setGerandoPadroes(true);
      await inserirCargosPadrao(unidadeAtiva);
      setGerandoPadroes(false);
      setSalvou("Cargos gerados com sucesso!");
      setTimeout(() => setSalvou(""), 3000);
      carregar();
    }
  }

  return (
    <div className="min-h-screen">
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={async (e) => {
         const file = e.target.files?.[0];
         if(!file) return;
         setSalvandoReg(true);
         const { error } = await uploadRegulamentoPDF(unidadeAtiva, file);
         if(error) alert(error);
         else { setSalvou("PDF anexado!"); carregar(); }
         setSalvandoReg(false);
      }} />

      <PageHeader title="Configurações de RH" subtitle={`Ajustes do Módulo · ${unidadeInfo.nome}`} icon={Settings}
        onAction={abaAtiva === "regulamento" ? undefined : () => { setEditar(null); setModal(true); }} 
        actionLabel={abaAtiva === "regulamento" ? "" : `Novo ${atual?.title || ''}`} />
      
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <Chips options={[
          { value: "cargos", label: "Cargos" },
          { value: "turnos", label: "Turnos" },
          { value: "bonus", label: "Tipos de Bônus" },
          { value: "regulamento", label: "Regulamento" }
        ]} value={abaAtiva} onChange={setAbaAtiva} />

        <div className="mt-4">
          {abaAtiva === "regulamento" ? (
             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div>
                  <label className="text-sm font-bold text-slate-700">Texto do Regulamento Interno</label>
                  <p className="text-xs text-slate-500 mb-2">Digite as regras de conduta, faltas, uniformes, etc. Isso será impresso no termo do funcionário.</p>
                  <textarea 
                     value={regulamento.texto_regulamento || ""} 
                     onChange={e => setRegulamento({...regulamento, texto_regulamento: e.target.value})} 
                     className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"
                     placeholder="Digite o regulamento aqui..."
                  />
                </div>
                
                <div className="pt-4 border-t border-slate-100">
                  <label className="text-sm font-bold text-slate-700">Anexar Regulamento em PDF (Opcional)</label>
                  <p className="text-xs text-slate-500 mb-3">Se você já tiver um arquivo PDF pronto, pode anexá-lo aqui. O funcionário também poderá baixar.</p>
                  
                  {regulamento.url_pdf ? (
                    <div className="flex items-center gap-3">
                       <a href={regulamento.url_pdf} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-100 text-emerald-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200">
                         <FileText size={16}/> Ver PDF Atual
                       </a>
                       <button onClick={() => fileInputRef.current.click()} className="text-slate-500 text-sm font-bold hover:text-slate-700 underline">Trocar PDF</button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200">
                      <Upload size={16}/> Fazer Upload de PDF
                    </button>
                  )}
                </div>

                <div className="pt-6">
                   <Btn variant="primary" disabled={salvandoReg} onClick={async () => {
                      setSalvandoReg(true);
                      await salvarRegulamento(unidadeAtiva, regulamento.texto_regulamento, undefined);
                      setSalvou("Regulamento salvo!");
                      setTimeout(() => setSalvou(""), 3000);
                      setSalvandoReg(false);
                   }}>
                      {salvandoReg ? "Salvando..." : "Salvar Regulamento"}
                   </Btn>
                </div>
             </div>
          ) : (
             <>
               <div className="flex items-center justify-between mb-4">
                 <SectionLabel className="!mb-0">{atual.lista.length} {atual.title} cadastrados</SectionLabel>
                 {abaAtiva === "cargos" && atual.lista.length === 0 && (
                   <Btn variant="primary" onClick={handleGerarPadroes} disabled={gerandoPadroes}>
                     {gerandoPadroes ? "Gerando..." : "Preencher Hierarquia Padrão"}
                   </Btn>
                 )}
               </div>

               {loading ? (
                 <EmptyState icon={atual.icon} title="Carregando..." />
               ) : atual.lista.length === 0 ? (
                 <EmptyState icon={atual.icon} title={`Nenhum item em ${atual.title}`} hint="Toque no botão 'Novo' lá em cima para começar." />
               ) : (
                 <div className="space-y-3">
                   {atual.lista.map(item => (
                     <Card key={item.id} className="flex items-center justify-between !p-4">
                       <div className="flex-1 min-w-0 pr-4">
                         <p className="text-sm font-bold truncate text-[var(--fg)] flex items-center gap-2">
                           <atual.icon size={14} className="text-[var(--accent-fg)]" />
                           {item.nome}
                         </p>
                         {item.regras && <p className="text-xs text-[var(--dim)] mt-1 truncate">{item.regras}</p>}
                         {item.funcoes_padrao && <p className="text-[11px] text-[var(--dim)] mt-1 truncate">{item.funcoes_padrao}</p>}
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => { setEditar(item); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--elevated)]">
                           <Edit3 size={14} className="text-[var(--muted)]" />
                         </button>
                         <button onClick={() => remover(item.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20">
                           <Trash2 size={14} className="text-slate-600" />
                         </button>
                       </div>
                     </Card>
                   ))}
                 </div>
               )}
             </>
          )}
        </div>
      </PageBody>

      <Modal open={modal && abaAtiva !== "regulamento"} onClose={() => setModal(false)} title={editar ? `Editar ${atual?.title || ''}` : `Novo ${atual?.title || ''}`}>
        <FormGenerico inicial={editar} onSalvar={salvar} onCancelar={() => setModal(false)} temRegras={atual?.hasRules} temFuncoes={atual?.hasFunctions} />
      </Modal>
    </div>
  );
}
