"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Upload, Trash2, Calendar, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { PageHeader, PageBody, Card, EmptyState, Modal, Field, TextInput, Select, Btn, Toast, fmtData } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchDocumentosEmpresa, inserirDocumentoEmpresa, removerDocumentoEmpresa } from "../../../lib/documentos_empresa";
import { uploadAnexo } from "../../../lib/pessoas"; // reaproveitando upload geral

const TIPOS = ["CNPJ", "Alvará de Funcionamento", "Vigilância Sanitária", "Bombeiros", "Contrato Social", "Outros"];

export default function DocumentosLegaisPage() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ titulo: "", tipo: "CNPJ", descricao: "", data_vencimento: "" });
  const [file, setFile] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef(null);

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchDocumentosEmpresa(unidadeAtiva);
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  const handleUpload = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const salvar = async () => {
    if (!form.titulo) return setErro("Informe o título do documento.");
    setSalvando(true); setErro("");

    let arquivo_url = null;
    if (file) {
      const up = await uploadAnexo(file, `docs_legais/${Date.now()}_${file.name}`);
      if (up.error) {
        setErro("Erro no upload: " + up.error);
        setSalvando(false);
        return;
      }
      arquivo_url = up.url;
    }

    const { error } = await inserirDocumentoEmpresa({
      ...form,
      data_vencimento: form.data_vencimento || null,
      arquivo_url
    }, unidadeAtiva);

    setSalvando(false);

    if (error) {
      setErro("Erro ao salvar: " + error);
    } else {
      setToast("Documento salvo!");
      setTimeout(() => setToast(""), 3000);
      setModal(false);
      setForm({ titulo: "", tipo: "CNPJ", descricao: "", data_vencimento: "" });
      setFile(null);
      carregar();
    }
  };

  const remover = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;
    await removerDocumentoEmpresa(id);
    setDocs(docs.filter(d => d.id !== id));
  };

  // Funções para verificar vencimento
  const statusVencimento = (dataVenc) => {
    if (!dataVenc) return { status: 'ok', msg: 'Sem validade', cor: 'var(--subtle)' };
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const venc = new Date(dataVenc);
    venc.setHours(0,0,0,0);
    venc.setDate(venc.getDate() + 1); // fix timezone
    
    const diffTime = venc.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'vencido', msg: `Vencido há ${Math.abs(diffDays)} dias`, cor: '#DC2626' };
    if (diffDays <= 30) return { status: 'alerta', msg: `Vence em ${diffDays} dias`, cor: '#F59E0B' };
    return { status: 'ok', msg: `Válido até ${fmtData(dataVenc)}`, cor: '#10B981' };
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 border-b px-4 pt-12 pb-3 flex items-center gap-3"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <button onClick={() => abrirMenu()}
          className="w-9 h-9 rounded-xl flex items-center justify-center erp-card">
          <ArrowLeft size={18} style={{ color: "var(--muted)" }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight flex items-center gap-2" style={{ color: "var(--fg)" }}>
            <FileText size={18} style={{ color: "var(--muted)" }} /> Documentos Legais
          </h1>
          <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>
            Alvarás, Contratos e Certidões · {unidadeInfo.nome}
          </p>
        </div>
      </div>

      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <div className="flex justify-between items-center mb-4">
          <p className="erp-label">Arquivos ({docs.length})</p>
          <Btn variant="primary" className="!h-8 text-[11px]" onClick={() => setModal(true)}>
            + Anexar Documento
          </Btn>
        </div>

        {loading ? (
          <EmptyState icon={FileText} title="Carregando..." />
        ) : docs.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum documento anexado" hint="Guarde aqui o CNPJ, Alvará de Funcionamento e outros registros da loja." />
        ) : (
          <div className="space-y-3">
            {docs.map(d => {
              const st = statusVencimento(d.data_vencimento);
              return (
                <Card key={d.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--elevated)" }}>
                      <FileText size={18} style={{ color: "var(--accent-fg)" }} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{d.titulo}</p>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{d.tipo}</span>
                      </div>
                      {d.descricao && <p className="text-xs mt-0.5" style={{ color: "var(--subtle)" }}>{d.descricao}</p>}
                      
                      {d.data_vencimento && (
                        <div className="flex items-center gap-1.5 mt-2">
                          {st.status === 'vencido' ? <AlertTriangle size={12} color={st.cor} /> :
                           st.status === 'alerta' ? <Calendar size={12} color={st.cor} /> :
                           <CheckCircle size={12} color={st.cor} />}
                          <span className="text-[11px] font-medium" style={{ color: st.cor }}>{st.msg}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {d.arquivo_url && (
                        <a href={d.arquivo_url} target="_blank" rel="noreferrer" title="Baixar/Ver" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
                          <Download size={14} />
                        </a>
                      )}
                      <button onClick={() => remover(d.id)} title="Excluir" className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title="Anexar Documento">
        <div className="space-y-4">
          <Field label="Tipo do Documento">
            <Select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          
          <Field label="Título">
            <TextInput value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} placeholder="Ex: Alvará Bombeiros 2026" />
          </Field>

          <Field label="Descrição (Opcional)">
            <TextInput value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Número do registro, etc." />
          </Field>

          <Field label="Data de Vencimento (Opcional)">
            <TextInput type="date" value={form.data_vencimento} onChange={e => setForm({...form, data_vencimento: e.target.value})} />
          </Field>

          <Field label="Arquivo (PDF ou Imagem)">
            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition hover:border-[var(--accent-fg)]"
              style={{ borderColor: "var(--line)", background: "var(--elevated)" }}
            >
              <Upload size={24} style={{ color: "var(--muted)" }} className="mb-2" />
              {file ? (
                <p className="text-sm font-bold text-center" style={{ color: "var(--fg)" }}>{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>Clique para buscar o arquivo</p>
                  <p className="text-xs" style={{ color: "var(--subtle)" }}>Tamanho máximo 5MB</p>
                </>
              )}
            </div>
          </Field>

          {erro && <p className="text-xs text-slate-600 text-center">{erro}</p>}

          <Btn variant="primary" className="w-full" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar Documento"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
