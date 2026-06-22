"use client";

import { useState, useEffect } from "react";
import { ListChecks, Plus, Send, Edit, Trash, Server, FileText } from "lucide-react";
import { PageHeader, PageBody, Card, SectionLabel, Modal, Btn, Field, TextInput, Select, Toast } from "../../../components/ui";
import { fetchTemplates, inserirTemplate, criarInstancia } from "../../../lib/tarefas";
import { useERP } from "../../../context/ERPContext";

export default function MotorDeTarefasPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvou, setSalvou] = useState(false);
  
  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEnviar, setModalEnviar] = useState(null); // Recebe o template selecionado

  // Form Novo Template
  const [fTitulo, setFTitulo] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCampos, setFCampos] = useState([]); // [{ id: "c1", label: "Geladeira Limpa?", tipo: "checkbox" }]

  const { unidades } = useERP();

  // Form Envio
  const [envioUnidade, setEnvioUnidade] = useState(unidades[0]?.id || "");
  const [envioPrazo, setEnvioPrazo] = useState("");

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchTemplates();
    setTemplates(data || []);
    setLoading(false);
  }

  function addCampo(tipo) {
    const id = `c_${Date.now()}`;
    let label = "Novo Campo";
    if (tipo === "checkbox") label = "Confirmação Sim/Não";
    if (tipo === "text") label = "Texto (Observação)";
    if (tipo === "number") label = "Número (Quantidade)";
    
    setFCampos([...fCampos, { id, label, tipo }]);
  }

  function alteraCampo(idx, novoLabel) {
    const n = [...fCampos];
    n[idx].label = novoLabel;
    setFCampos(n);
  }

  function removeCampo(idx) {
    setFCampos(fCampos.filter((_, i) => i !== idx));
  }

  async function salvarTemplate() {
    if (!fTitulo.trim()) return alert("O título é obrigatório");
    await inserirTemplate({
      titulo: fTitulo,
      descricao: fDesc,
      tipo: "formulario",
      campos: fCampos
    });
    setModalNovo(false);
    setFTitulo(""); setFDesc(""); setFCampos([]);
    setSalvou(true); setTimeout(() => setSalvou(false), 2000);
    carregar();
  }

  async function despacharTarefa() {
    if (!modalEnviar) return;
    let prazoFormatado = null;
    if (envioPrazo) {
      prazoFormatado = new Date(envioPrazo).toISOString();
    }
    
    await criarInstancia({
      template_id: modalEnviar.id,
      unidade_id: envioUnidade,
      prazo: prazoFormatado
    });
    setModalEnviar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2000);
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Motor de Tarefas" subtitle="Crie e despache formulários e checklists para as unidades" icon={Server}
        onAction={() => setModalNovo(true)} actionLabel="Novo Template" />

      <PageBody>
        <Toast show={salvou}>Operação realizada com sucesso!</Toast>

        <SectionLabel>Meus Templates ({templates.length})</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          {templates.map(t => (
            <Card key={t.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={18} style={{ color: "var(--accent)" }} />
                  <p className="font-bold text-base truncate" style={{ color: "var(--fg)" }}>{t.titulo}</p>
                </div>
                <p className="text-sm font-medium mb-4 line-clamp-2" style={{ color: "var(--dim)" }}>{t.descricao}</p>
                
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>Campos</p>
                <div className="space-y-1 mb-4">
                  {(t.campos || []).slice(0, 3).map((c, i) => (
                    <p key={i} className="text-xs truncate" style={{ color: "var(--dim)" }}>• {c.label} ({c.tipo})</p>
                  ))}
                  {(t.campos || []).length > 3 && <p className="text-xs italic" style={{ color: "var(--muted)" }}>+ {(t.campos.length - 3)} campos</p>}
                </div>
              </div>

              <Btn variant="primary" className="w-full mt-2" onClick={() => setModalEnviar(t)}>
                <Send size={16} className="mr-2" /> Despachar p/ Unidade
              </Btn>
            </Card>
          ))}
        </div>
      </PageBody>

      {/* MODAL: NOVO TEMPLATE */}
      <Modal open={modalNovo} onClose={() => setModalNovo(false)} title="Novo Template de Tarefa">
        <Field label="Título"><TextInput value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder="ex: Checklist de Abertura" /></Field>
        <Field label="Descrição"><TextInput value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Instruções para a unidade..." /></Field>
        
        <SectionLabel className="mt-4">Campos do Formulário</SectionLabel>
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {fCampos.map((c, i) => (
            <div key={i} className="flex gap-2 items-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="flex-1">
                <TextInput value={c.label} onChange={(e) => alteraCampo(i, e.target.value)} />
              </div>
              <div className="w-24 text-[10px] font-bold text-center uppercase" style={{ color: "var(--accent)" }}>{c.tipo}</div>
              <button onClick={() => removeCampo(i)} className="p-2 rounded hover:bg-emerald-500/20"><Trash size={16} color="#ef4444" /></button>
            </div>
          ))}
          {fCampos.length === 0 && <p className="text-xs text-center p-4 text-gray-500">Nenhum campo. Adicione um abaixo.</p>}
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => addCampo("checkbox")} className="flex-1 p-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10">+ Checkbox</button>
          <button onClick={() => addCampo("text")} className="flex-1 p-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10">+ Texto</button>
          <button onClick={() => addCampo("number")} className="flex-1 p-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10">+ Número</button>
        </div>

        <div className="flex gap-3">
          <Btn variant="ghost" className="flex-1" onClick={() => setModalNovo(false)}>Cancelar</Btn>
          <Btn variant="primary" className="flex-1" onClick={salvarTemplate}>Salvar Template</Btn>
        </div>
      </Modal>

      {/* MODAL: DESPACHAR (ENVIAR PARA UNIDADE) */}
      <Modal open={!!modalEnviar} onClose={() => setModalEnviar(null)} title="Enviar Tarefa">
        {modalEnviar && (
          <>
            <p className="text-sm font-medium mb-4" style={{ color: "var(--fg)" }}>
              Enviando: <strong className="text-accent">{modalEnviar.titulo}</strong>
            </p>
            <Field label="Destino (Unidade)">
              <Select value={envioUnidade} onChange={(e) => setEnvioUnidade(e.target.value)}>
                {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Prazo (Opcional)">
              <input type="datetime-local" className="erp-input w-full" value={envioPrazo} onChange={(e) => setEnvioPrazo(e.target.value)} />
            </Field>

            <div className="flex gap-3 mt-6">
              <Btn variant="ghost" className="flex-1" onClick={() => setModalEnviar(null)}>Cancelar</Btn>
              <Btn variant="primary" className="flex-1" onClick={despacharTarefa}>Enviar Agora</Btn>
            </div>
          </>
        )}
      </Modal>

    </div>
  );
}
