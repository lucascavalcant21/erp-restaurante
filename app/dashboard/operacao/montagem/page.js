"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Plus, Trash2, Edit3, Printer, Camera, Clock } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchMontagens, inserirMontagem, atualizarMontagem, removerMontagem,
  uploadFotoMontagem,
} from "../../../lib/montagem";

const VAZIO = {
  nome: "", tipo: "prato", departamento: "cozinha",
  descritivo: "", foto_url: "",
  tempo_preparo: "", rendimento: "", observacoes: "",
};

function FormMontagem({ inicial, deptInicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial
      ? {
          ...inicial,
          tempo_preparo: String(inicial.tempo_preparo || ""),
        }
      : { ...VAZIO, departamento: deptInicial, tipo: deptInicial === "bar" ? "drink" : "prato" }
  );
  const [erro, setErro] = useState("");
  const [uploadando, setUploadando] = useState(false);
  const inputRef = useRef(null);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  async function escolherFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadando(true);
    const { url, error } = await uploadFotoMontagem(file, f.nome || "montagem");
    setUploadando(false);
    if (error) { setErro("Erro ao enviar foto: " + error); return; }
    set("foto_url", url);
  }

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do prato/drink.");
    if (!f.descritivo.trim()) return setErro("Informe o passo a passo de montagem.");
    onSalvar({
      nome: f.nome.trim(),
      tipo: f.tipo,
      departamento: f.departamento,
      descritivo: f.descritivo.trim(),
      foto_url: f.foto_url || null,
      tempo_preparo: f.tempo_preparo ? Number(f.tempo_preparo) : null,
      rendimento: f.rendimento || null,
      observacoes: f.observacoes || null,
    });
  }

  return (
    <>
      <Field label="Nome do prato/drink">
        <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Mojito, Filé Grelhado" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            <option value="prato">Prato</option>
            <option value="drink">Drink</option>
          </Select>
        </Field>
        <Field label="Departamento">
          <Select value={f.departamento} onChange={(e) => set("departamento", e.target.value)}>
            <option value="cozinha">Cozinha</option>
            <option value="bar">Bar</option>
          </Select>
        </Field>
      </div>

      <Field label="Foto">
        {f.foto_url && (
          <div className="mb-2">
            <img src={f.foto_url} alt="Foto" style={{ maxWidth: "100%", borderRadius: 8, maxHeight: 200, objectFit: "cover" }} />
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={escolherFoto} style={{ display: "none" }} />
        <Btn variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploadando}>
          <Camera size={14} /> {uploadando ? "Enviando..." : (f.foto_url ? "Trocar foto" : "Adicionar foto")}
        </Btn>
      </Field>

      <Field label="Passo a passo de montagem">
        <textarea
          value={f.descritivo}
          onChange={(e) => set("descritivo", e.target.value)}
          placeholder="1. Adicione gelo ao copo&#10;2. Misture os ingredientes&#10;3. Decore com hortelã"
          rows={6}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            background: "var(--elevated)", color: "var(--fg)",
            border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical",
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tempo de preparo (min)">
          <NumberInput value={f.tempo_preparo} onChange={(e) => set("tempo_preparo", e.target.value)} placeholder="5" step="1" />
        </Field>
        <Field label="Rendimento">
          <TextInput value={f.rendimento} onChange={(e) => set("rendimento", e.target.value)} placeholder="1 porção, 350ml" />
        </Field>
      </div>

      <Field label="Observações (opcional)">
        <textarea
          value={f.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          placeholder="Dicas, alertas ou variações"
          rows={3}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            background: "var(--elevated)", color: "var(--fg)",
            border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical",
          }}
        />
      </Field>

      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

function imprimirFicha(m) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ficha de Montagem — ${m.nome}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 20px; color: #111; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .badges { display: flex; gap: 6px; margin-bottom: 16px; }
    .badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; color: #475569; }
    .foto { max-width: 100%; max-height: 320px; object-fit: cover; border-radius: 12px; margin-bottom: 16px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-top: 24px; margin-bottom: 8px; }
    .descritivo { white-space: pre-wrap; line-height: 1.6; font-size: 15px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .info { padding: 12px; background: #f8fafc; border-radius: 8px; }
    .info-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .info-val { font-size: 16px; font-weight: 600; margin-top: 2px; }
    .obs { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; margin-top: 12px; font-size: 14px; }
    .rodape { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
    @media print { body { margin: 0; padding: 12px; } }
  </style>
</head>
<body>
  <h1>${m.nome}</h1>
  <div class="badges">
    <span class="badge">${m.tipo}</span>
    <span class="badge">${m.departamento}</span>
  </div>
  ${m.foto_url ? `<img src="${m.foto_url}" class="foto" alt="${m.nome}" />` : ""}

  <h2>Montagem</h2>
  <div class="descritivo">${m.descritivo}</div>

  ${(m.tempo_preparo || m.rendimento) ? `
    <div class="grid">
      ${m.tempo_preparo ? `<div class="info"><div class="info-label">Tempo de preparo</div><div class="info-val">${m.tempo_preparo} min</div></div>` : ""}
      ${m.rendimento ? `<div class="info"><div class="info-label">Rendimento</div><div class="info-val">${m.rendimento}</div></div>` : ""}
    </div>
  ` : ""}

  ${m.observacoes ? `<h2>Observações</h2><div class="obs">${m.observacoes}</div>` : ""}

  <div class="rodape">Ficha gerada em ${new Date().toLocaleString("pt-BR")} · Cerebro ERP</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>
`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

function MontagemPageInner() {
  const { unidadeAtiva } = useERP();
  const searchParams = useSearchParams();
  const deptInicial = searchParams.get("dept") || "cozinha";

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("Todos");
  const [dept, setDept] = useState(deptInicial);
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await fetchMontagens(unidadeAtiva, dept);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, [unidadeAtiva, dept]);

  const filtrados = useMemo(() => lista.filter((m) => {
    const mb = m.nome?.toLowerCase().includes(busca.toLowerCase());
    const mt = tipo === "Todos" || m.tipo === tipo.toLowerCase();
    return mb && mt;
  }), [lista, busca, tipo]);

  async function salvar(dados) {
    if (editar) {
      await atualizarMontagem(editar.id, dados);
    } else {
      await inserirMontagem(dados, unidadeAtiva);
    }
    setModal(false); setEditar(null); setSalvou("Ficha de montagem salva!");
    setTimeout(() => setSalvou(""), 2600);
    carregar();
  }

  async function remover(id) {
    if (!confirm("Remover esta ficha de montagem?")) return;
    await removerMontagem(id);
    setLista((p) => p.filter((m) => m.id !== id));
  }

  const titulo = dept === "bar" ? "Montagem — Bar" : "Montagem — Cozinha";
  const subtitle = dept === "bar"
    ? "Fichas de montagem de drinks e coquetéis"
    : "Fichas de montagem de pratos e receitas";

  return (
    <div className="min-h-screen">
      <PageHeader title={titulo} subtitle={subtitle} icon={ClipboardList} onAction={() => { setEditar(null); setModal(true); }} actionLabel="Nova" />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <KpiGrid>
          <Kpi icon={ClipboardList} label="Fichas cadastradas" value={lista.length} tint="var(--accent-fg)" />
          <Kpi icon={Clock} label="Tempo médio" value={`${lista.length ? Math.round(lista.reduce((a, m) => a + (m.tempo_preparo || 0), 0) / lista.length) : 0} min`} tint="#3B82F6" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar prato/drink..." />
        <Chips options={["bar", "cozinha"]} value={dept} onChange={setDept} />
        <Chips options={["Todos", "Prato", "Drink"]} value={tipo} onChange={setTipo} />

        <div>
          <SectionLabel>{filtrados.length} ficha{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={ClipboardList} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={ClipboardList} title={busca ? "Nenhuma ficha encontrada" : "Sem fichas cadastradas"} hint={busca ? "Ajuste a busca" : "Clique em Nova para adicionar"} />
          ) : (
            <div className="space-y-2">
              {filtrados.map((m) => (
                <Card key={m.id} className="!p-3">
                  <div className="flex items-start justify-between gap-3">
                    {m.foto_url && (
                      <img src={m.foto_url} alt={m.nome} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-bold" style={{ color: "var(--fg)" }}>{m.nome}</p>
                        <span className="erp-badge text-[10px]" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{m.tipo}</span>
                        {m.tempo_preparo && <span className="erp-badge text-[10px]" style={{ background: "var(--elevated)", color: "var(--muted)" }}>⏱ {m.tempo_preparo} min</span>}
                        {m.rendimento && <span className="erp-badge text-[10px]" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{m.rendimento}</span>}
                      </div>
                      <p className="text-[12px] line-clamp-2" style={{ color: "var(--dim)" }}>{m.descritivo}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => imprimirFicha(m)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }} title="Imprimir ficha"><Printer size={14} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => { setEditar(m); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }} title="Editar"><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => remover(m.id)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger" title="Remover"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar ficha" : "Nova ficha de montagem"}>
        <FormMontagem inicial={editar} deptInicial={dept} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}

export default function MontagemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MontagemPageInner />
    </Suspense>
  );
}
