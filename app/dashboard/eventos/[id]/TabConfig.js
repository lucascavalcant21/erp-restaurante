"use client";

import { useState, useRef } from "react";
import { Settings, Camera, Save, Trash2 } from "lucide-react";
import { Card, SectionLabel, Btn, Field, TextInput, NumberInput, Select, fmtBRL, fmtPct } from "../../../components/ui";
import { atualizarEvento, removerEvento, uploadBanner } from "../../../lib/eventos";
import { useRouter } from "next/navigation";

export default function TabConfig({ evento, onChange }) {
  const router = useRouter();
  const [f, setF] = useState({
    nome: evento.nome || "",
    subtitulo: evento.subtitulo || "",
    tag: evento.tag || "",
    data_evento: evento.data_evento || "",
    banner_url: evento.banner_url || "",
    charge_mode: evento.charge_mode || "couple",
    capacidade: String(evento.capacidade || ""),
    preco_unit: String(evento.preco_unit || ""),
    entradas_inc: String(evento.entradas_inc || ""),
    principais_inc: String(evento.principais_inc || ""),
    sobremesas_inc: String(evento.sobremesas_inc || ""),
    drinks_inc: String(evento.drinks_inc || ""),
    impostos_rate: String((Number(evento.impostos_rate) || 0) * 100),
    credito_rate: String((Number(evento.credito_rate) || 0) * 100),
    debito_rate: String((Number(evento.debito_rate) || 0) * 100),
    credito_mix: String((Number(evento.credito_mix) || 0) * 100),
    margem_seg: String(evento.margem_seg || 10),
    status: evento.status || "ativo",
  });
  const [uploadando, setUploadando] = useState(false);
  const [salvo, setSalvo] = useState("");
  const inputRef = useRef(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function escolherBanner(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadando(true);
    const { url, error } = await uploadBanner(file, evento.id);
    setUploadando(false);
    if (error) return alert("Erro: " + error);
    set("banner_url", url);
  }

  async function salvar() {
    const num = (v) => parseFloat(String(v).replace(",", ".")) || 0;
    await atualizarEvento(evento.id, {
      nome: f.nome.trim(),
      subtitulo: f.subtitulo || null,
      tag: f.tag || null,
      data_evento: f.data_evento,
      banner_url: f.banner_url || null,
      charge_mode: f.charge_mode,
      capacidade: Number(f.capacidade) || 12,
      preco_unit: num(f.preco_unit),
      entradas_inc: Number(f.entradas_inc) || 0,
      principais_inc: Number(f.principais_inc) || 0,
      sobremesas_inc: Number(f.sobremesas_inc) || 0,
      drinks_inc: Number(f.drinks_inc) || 0,
      impostos_rate: num(f.impostos_rate) / 100,
      credito_rate: num(f.credito_rate) / 100,
      debito_rate: num(f.debito_rate) / 100,
      credito_mix: num(f.credito_mix) / 100,
      margem_seg: num(f.margem_seg),
      status: f.status,
    });
    setSalvo("Configurações salvas!");
    setTimeout(() => setSalvo(""), 2400);
    onChange();
  }

  async function excluirEvento() {
    if (!confirm(`EXCLUIR o evento "${evento.nome}" e TODOS os seus dados? Essa ação NÃO pode ser desfeita.`)) return;
    await removerEvento(evento.id);
    router.push("/dashboard/eventos");
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <h3 style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 12 }}><Settings size={16} style={{ display: "inline", marginRight: 6 }} />Identidade do Evento</h3>

        {f.banner_url && (
          <div className="mb-3">
            <img src={f.banner_url} alt="Banner" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8 }} />
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={escolherBanner} style={{ display: "none" }} />
        <div className="flex gap-2 mb-3">
          <Btn variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploadando}>
            <Camera size={14} /> {uploadando ? "Enviando..." : (f.banner_url ? "Trocar banner" : "Adicionar banner")}
          </Btn>
          {f.banner_url && (
            <Btn variant="ghost" onClick={() => set("banner_url", "")}>
              <Trash2 size={14} /> Remover
            </Btn>
          )}
        </div>

        <Field label="Nome do evento"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
        <Field label="Subtítulo"><TextInput value={f.subtitulo} onChange={(e) => set("subtitulo", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tag / Loja"><TextInput value={f.tag} onChange={(e) => set("tag", e.target.value)} /></Field>
          <Field label="Data">
            <input type="date" value={f.data_evento} onChange={(e) => set("data_evento", e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--elevated)", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13 }} />
          </Field>
        </div>
      </Card>

      <Card className="!p-4">
        <h3 style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 12 }}>Menu e Capacidade</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cobrança por">
            <Select value={f.charge_mode} onChange={(e) => set("charge_mode", e.target.value)}>
              <option value="couple">Casal</option>
              <option value="person">Pessoa</option>
            </Select>
          </Field>
          <Field label="Capacidade (mesas)"><NumberInput value={f.capacidade} onChange={(e) => set("capacidade", e.target.value)} step="1" /></Field>
        </div>
        <Field label={`Preço por ${f.charge_mode === "couple" ? "casal" : "pessoa"} (R$)`}>
          <NumberInput value={f.preco_unit} onChange={(e) => set("preco_unit", e.target.value)} step="0.01" />
        </Field>

        <SectionLabel>Itens incluídos no menu</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          <Field label="Entradas"><NumberInput value={f.entradas_inc} onChange={(e) => set("entradas_inc", e.target.value)} step="1" /></Field>
          <Field label="Principais"><NumberInput value={f.principais_inc} onChange={(e) => set("principais_inc", e.target.value)} step="1" /></Field>
          <Field label="Sobremesas"><NumberInput value={f.sobremesas_inc} onChange={(e) => set("sobremesas_inc", e.target.value)} step="1" /></Field>
          <Field label="Drinks"><NumberInput value={f.drinks_inc} onChange={(e) => set("drinks_inc", e.target.value)} step="1" /></Field>
        </div>
      </Card>

      <Card className="!p-4">
        <h3 style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 12 }}>Taxas Financeiras</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Impostos (%)"><NumberInput value={f.impostos_rate} onChange={(e) => set("impostos_rate", e.target.value)} step="0.01" /></Field>
          <Field label="Margem segurança compras (%)"><NumberInput value={f.margem_seg} onChange={(e) => set("margem_seg", e.target.value)} step="1" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Taxa crédito (%)"><NumberInput value={f.credito_rate} onChange={(e) => set("credito_rate", e.target.value)} step="0.01" /></Field>
          <Field label="Taxa débito (%)"><NumberInput value={f.debito_rate} onChange={(e) => set("debito_rate", e.target.value)} step="0.01" /></Field>
          <Field label="Mix crédito (%)"><NumberInput value={f.credito_mix} onChange={(e) => set("credito_mix", e.target.value)} step="1" /></Field>
        </div>
        <p className="text-[11px]" style={{ color: "var(--dim)" }}>
          PIX = 0% · Maquininha estimada = mix × crédito + (1-mix) × débito
        </p>
      </Card>

      <Card className="!p-4">
        <h3 style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 12 }}>Status</h3>
        <Field label="Status do evento">
          <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
            <option value="cancelado">Cancelado</option>
          </Select>
        </Field>
      </Card>

      <div className="flex gap-3 sticky bottom-3" style={{ background: "var(--bg)", padding: 10, borderRadius: 12 }}>
        <Btn variant="ghost" onClick={excluirEvento}>
          <Trash2 size={14} /> Excluir evento
        </Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>
          <Save size={14} /> {salvo || "Salvar configurações"}
        </Btn>
      </div>
    </div>
  );
}
