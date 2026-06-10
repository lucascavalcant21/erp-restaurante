"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Bell, ClipboardList, AlertTriangle, DollarSign, FileText, GraduationCap, Trash2, Upload, Download, User } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData,
} from "../../../../components/ui";
import { useERP } from "../../../../context/ERPContext";
import { supabase } from "../../../../lib/supabase";
import {
  fetchAvisos, inserirAviso, removerAviso,
  fetchProducoes, inserirProducao, removerProducao,
  fetchAdvertencias, inserirAdvertencia, removerAdvertencia,
  fetchHolerites, inserirHolerite, removerHolerite,
  fetchDocumentos, inserirDocumento, removerDocumento,
  fetchCursos, inserirCurso, removerCurso,
  uploadAnexo,
} from "../../../../lib/pessoas";

const TABS = [
  { key: "avisos", label: "Avisos", icon: Bell, fetch: fetchAvisos, insert: inserirAviso, remove: removerAviso,
    campos: [{ k: "titulo", label: "Título" }, { k: "corpo", label: "Mensagem" }, { k: "tipo", label: "Tipo", select: ["info", "reuniao", "alerta"] }],
    titulo: (x) => x.titulo, sub: (x) => x.corpo },
  { key: "producoes", label: "Produções", icon: ClipboardList, fetch: fetchProducoes, insert: inserirProducao, remove: removerProducao,
    campos: [{ k: "titulo", label: "Tarefa" }, { k: "descricao", label: "Descrição" }, { k: "periodo", label: "Período", select: ["dia", "semana"] }],
    titulo: (x) => x.titulo, sub: (x) => `${x.periodo === "semana" ? "Semanal" : "Diária"} · ${x.status || "pendente"}` },
  { key: "advertencias", label: "Advertências", icon: AlertTriangle, fetch: fetchAdvertencias, insert: inserirAdvertencia, remove: removerAdvertencia,
    campos: [{ k: "motivo", label: "Motivo" }, { k: "descricao", label: "Descrição" }, { k: "gravidade", label: "Gravidade", select: ["leve", "media", "grave"] }],
    titulo: (x) => x.motivo, sub: (x) => x.gravidade },
  { key: "holerites", label: "Holerites", icon: DollarSign, fetch: fetchHolerites, insert: inserirHolerite, remove: removerHolerite, upload: true,
    campos: [{ k: "mes", label: "Mês (1-12)", num: true }, { k: "ano", label: "Ano", num: true }, { k: "bruto", label: "Bruto (R$)", num: true }, { k: "liquido", label: "Líquido (R$)", num: true }],
    titulo: (x) => `${String(x.mes).padStart(2, "0")}/${x.ano}`, sub: (x) => `Líquido ${fmtBRL(x.liquido)}` },
  { key: "documentos", label: "Documentos", icon: FileText, fetch: fetchDocumentos, insert: inserirDocumento, remove: removerDocumento, upload: true,
    campos: [{ k: "titulo", label: "Título" }, { k: "tipo", label: "Tipo", select: ["Contrato", "RG", "Comprovante", "Outro"] }],
    titulo: (x) => x.titulo, sub: (x) => x.tipo },
  { key: "cursos", label: "Cursos", icon: GraduationCap, fetch: fetchCursos, insert: inserirCurso, remove: removerCurso, upload: true,
    campos: [{ k: "titulo", label: "Título" }, { k: "descricao", label: "Descrição" }, { k: "origem", label: "Origem", select: ["empresa", "colaborador"] }, { k: "tipo_arquivo", label: "Tipo", select: ["pdf", "video", "link"] }],
    titulo: (x) => x.titulo, sub: (x) => `${x.origem} · ${x.tipo_arquivo}` },
];

function FormTab({ tab, func, onSalvar, onCancelar }) {
  const [f, setF] = useState({});
  const [file, setFile] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  async function salvar() {
    const obrig = tab.campos[0].k;
    if (!f[obrig]) return setErro(`Preencha "${tab.campos[0].label}".`);
    setEnviando(true);
    let arquivo_url = null;
    if (tab.upload && file) {
      const up = await uploadAnexo(file, `${tab.key}/${func.id}`);
      if (up.error) { setErro("Falha no upload: " + up.error); setEnviando(false); return; }
      arquivo_url = up.url;
    }
    const obj = { ...f, func_id: func.id };
    tab.campos.forEach((c) => { if (c.num) obj[c.k] = Number(f[c.k]) || 0; });
    if (tab.upload) obj.arquivo_url = arquivo_url;
    await onSalvar(obj);
    setEnviando(false);
  }

  return (
    <>
      {tab.campos.map((c) => (
        <Field key={c.k} label={c.label}>
          {c.select ? (
            <Select value={f[c.k] || c.select[0]} onChange={(e) => set(c.k, e.target.value)}>{c.select.map((o) => <option key={o}>{o}</option>)}</Select>
          ) : c.num ? (
            <NumberInput value={f[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} />
          ) : (
            <TextInput value={f[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} />
          )}
        </Field>
      ))}
      {tab.upload && (
        <Field label="Arquivo (PDF/vídeo) — opcional">
          <label className="erp-btn erp-btn-ghost w-full cursor-pointer">
            <Upload size={15} /> {file ? file.name.slice(0, 24) : "Escolher arquivo"}
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
      )}
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={enviando} onClick={salvar}>{enviando ? "Salvando..." : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function FuncionarioDetalhePage() {
  const { id } = useParams();
  const { unidadeInfo } = useERP();
  const [func, setFunc] = useState(null);
  const [abaKey, setAbaKey] = useState("avisos");
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [salvou, setSalvou] = useState("");

  const aba = TABS.find((t) => t.key === abaKey);

  useEffect(() => {
    if (!supabase || !id) return;
    supabase.from("funcionarios").select("*").eq("id", id).maybeSingle().then(({ data }) => setFunc(data));
  }, [id]);

  const carregar = useCallback(async () => {
    if (!func) return;
    setLoading(true);
    setItens(await aba.fetch(func.id));
    setLoading(false);
  }, [func, aba]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(obj) {
    await aba.insert(obj, func.unidade_id);
    setModal(false);
    setSalvou("Adicionado e enviado ao portal do colaborador!");
    setTimeout(() => setSalvou(""), 2600);
    carregar();
  }
  async function remover(it) {
    await aba.remove(it.id);
    setItens((p) => p.filter((x) => x.id !== it.id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title={func?.nome || "Funcionário"} subtitle={`Gestão de pessoal · ${unidadeInfo.nome}`} icon={User} />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        {func && (
          <Card className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>{func.nome?.[0]?.toUpperCase()}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{func.nome}</p>
              <p className="text-[11px]" style={{ color: "var(--dim)" }}>{func.cargo} · {func.turno || "—"} · {func.email || "sem e-mail"}</p>
            </div>
          </Card>
        )}

        {!func?.email && func && (
          <Card><p className="text-[12px]" style={{ color: "#DC2626" }}>⚠️ Este funcionário não tem e-mail cadastrado — sem e-mail, ele não consegue ver o portal. Edite o cadastro e adicione o e-mail de login dele.</p></Card>
        )}

        <Chips options={TABS.map((t) => ({ value: t.key, label: t.label }))} value={abaKey} onChange={setAbaKey} />

        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>{aba.label}</SectionLabel>
            <Btn variant="primary" className="!h-8 text-[11px]" onClick={() => setModal(true)}>+ Novo</Btn>
          </div>
          {loading ? (
            <EmptyState icon={aba.icon} title="Carregando..." />
          ) : itens.length === 0 ? (
            <EmptyState icon={aba.icon} title={`Nenhum item em ${aba.label}`} hint="Toque em + Novo para adicionar." />
          ) : (
            <div className="space-y-2">
              {itens.map((it) => (
                <Card key={it.id} className="!p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{aba.titulo(it)}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--dim)" }}>{aba.sub(it)} · {fmtData(it.created_at || it.data)}</p>
                  </div>
                  {it.arquivo_url && <a href={it.arquivo_url} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Download size={14} style={{ color: "var(--muted)" }} /></a>}
                  <button onClick={() => remover(it)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={14} /></button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title={`Novo · ${aba.label}`}>
        {func && <FormTab tab={aba} func={func} onSalvar={salvar} onCancelar={() => setModal(false)} />}
      </Modal>
    </div>
  );
}
