"use client";

import { useState, useEffect, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Tag, Printer, Save, Snowflake, Thermometer, Box, QrCode } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Field, TextInput, NumberInput, Select, Btn, Toast,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { lerSessao } from "../../../lib/auth";
import { fetchCardapio } from "../../../lib/cardapio";
import { fetchEstoque } from "../../../lib/estoque";
import { CONSERVACAO, gerarCodigo, criarEtiqueta } from "../../../lib/etiquetas";

const UNIDADES = ["UN", "KG", "G", "L", "ML", "CX", "PCT", "BANDEJA"];
const ICONE_CONS = { Resfriado: Thermometer, Congelado: Snowflake, Ambiente: Box };

function fmtDataHora(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}h${p(d.getMinutes())}`;
}

export default function EtiquetasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState({ produto: "", conservacao: "Congelado", quantidade: "1", unidade: "UN", dias: 30, lote: "", responsavel: "" });
  const [cnpj, setCnpj] = useState("");
  const [codigo, setCodigo] = useState(gerarCodigo());
  const [tamanho, setTamanho] = useState("60x60"); // "60x60" | "60x40"
  const [salvou, setSalvou] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Dimensões/escala da etiqueta conforme o tamanho escolhido
  const dim = tamanho === "60x40"
    ? { h: "40mm", pad: "2.5mm", titulo: "4mm", linha: "2.9mm", resp: "2.6mm", qr: 60, gap: "0.5mm" }
    : { h: "60mm", pad: "4mm",   titulo: "5mm", linha: "3.6mm", resp: "3.2mm", qr: 96, gap: "0.8mm" };

  useEffect(() => {
    lerSessao().then((s) => s?.nome && setForm((f) => ({ ...f, responsavel: f.responsavel || s.nome })));
    try { setCnpj(localStorage.getItem("erp_cnpj") || ""); } catch (_) {}
  }, []);
  useEffect(() => {
    (async () => {
      const [c, e] = await Promise.all([fetchCardapio(unidadeAtiva), fetchEstoque(unidadeAtiva)]);
      const nomes = [...new Set([...(c.data || []), ...(e.data || [])].map((x) => x.nome))].sort();
      setProdutos(nomes);
    })();
  }, [unidadeAtiva]);

  function escolherConservacao(id) {
    const c = CONSERVACAO.find((x) => x.id === id);
    set("conservacao", id);
    if (c) set("dias", c.dias);
  }

  const agora = useMemo(() => new Date(), [form, codigo]); // recalc ao mexer
  const validadeEm = useMemo(() => new Date(agora.getTime() + (Number(form.dias) || 0) * 86400000), [agora, form.dias]);
  const nomeProduto = (form.produto || "").trim();

  const rastreioUrl = typeof window !== "undefined" ? `${window.location.origin}/rastreio/${codigo}` : `/rastreio/${codigo}`;

  function salvarCnpj(v) { setCnpj(v); try { localStorage.setItem("erp_cnpj", v); } catch (_) {} }

  async function salvar(imprimir) {
    if (!nomeProduto) { setSalvou("⚠️ Informe o produto"); setTimeout(() => setSalvou(""), 2000); return; }
    if (!form.responsavel.trim()) { setSalvou("⚠️ Informe o responsável"); setTimeout(() => setSalvou(""), 2000); return; }
    await criarEtiqueta({
      codigo, produto: nomeProduto, conservacao: form.conservacao,
      quantidade: Number(form.quantidade) || 0, unidade: form.unidade,
      validade_dias: Number(form.dias) || 0,
      manipulacao_em: agora.toISOString(), validade_em: validadeEm.toISOString(),
      lote: form.lote || null, responsavel: form.responsavel.trim(),
    }, unidadeAtiva);
    if (imprimir) { setTimeout(() => window.print(), 150); }
    setSalvou(imprimir ? "Etiqueta salva e enviada para impressão!" : "Etiqueta salva!");
    setTimeout(() => { setSalvou(""); setCodigo(gerarCodigo()); }, 2200);
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Etiquetas" subtitle={`QR Code + rastreio · ${unidadeInfo.nome}`} icon={Tag} />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* ── Formulário ── */}
          <div className="space-y-4">
            <Card>
              <Field label="Produto">
                <Select value={produtos.includes(form.produto) ? form.produto : ""} onChange={(e) => set("produto", e.target.value)}>
                  <option value="">Selecione um produto...</option>
                  {produtos.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Ou digite o nome manualmente">
                <TextInput value={form.produto} onChange={(e) => set("produto", e.target.value)} placeholder="Nome do produto" />
              </Field>
            </Card>

            <Card>
              <SectionLabel>Conservação</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {CONSERVACAO.map((c) => {
                  const Icon = ICONE_CONS[c.id] || Box; const sel = form.conservacao === c.id;
                  return (
                    <button key={c.id} onClick={() => escolherConservacao(c.id)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                      style={{ border: `1.5px solid ${sel ? c.cor : "var(--line)"}`, background: sel ? c.cor + "22" : "var(--panel)" }}>
                      <Icon size={18} style={{ color: sel ? c.cor : "var(--muted)" }} />
                      <span className="text-[12px] font-bold" style={{ color: sel ? "var(--fg)" : "var(--muted)" }}>{c.id}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade"><NumberInput value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} /></Field>
                <Field label="Unidade"><Select value={form.unidade} onChange={(e) => set("unidade", e.target.value)}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</Select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Validade (dias)"><NumberInput value={form.dias} onChange={(e) => set("dias", e.target.value)} /></Field>
                <Field label="Lote / SIF (opcional)"><TextInput value={form.lote} onChange={(e) => set("lote", e.target.value)} placeholder="SIF 1234" /></Field>
              </div>
              <Field label="Responsável"><TextInput value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Nome" /></Field>
              <Field label="CNPJ da empresa (sai na etiqueta)"><TextInput value={cnpj} onChange={(e) => salvarCnpj(e.target.value)} placeholder="00.000.000/0001-00" /></Field>
            </Card>

            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1" onClick={() => salvar(false)}><Save size={16} /> Salvar</Btn>
              <Btn variant="primary" className="flex-1" onClick={() => salvar(true)}><Printer size={16} /> Imprimir</Btn>
            </div>
          </div>

          {/* ── Preview / Etiqueta ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Pré-visualização</SectionLabel>
              <div className="flex gap-1.5">
                {["60x40", "60x60"].map((t) => (
                  <button key={t} onClick={() => setTamanho(t)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={tamanho === t ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                    {t.replace("x", "×")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div id="area-impressao" style={{ width: "60mm", height: dim.h, background: "#fff", color: "#000", padding: dim.pad, fontFamily: "monospace", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ fontSize: dim.titulo, fontWeight: 800, lineHeight: 1.05, textTransform: "uppercase", borderBottom: "0.4mm solid #000", paddingBottom: dim.gap }}>
                  {nomeProduto || "PRODUTO"}
                </div>
                <Linha fs={dim.linha} k={form.conservacao.toUpperCase()} v={`QTD: ${form.quantidade}${form.unidade !== "UN" ? form.unidade : ""}`} top />
                <Linha fs={dim.linha} k="MANIP.:" v={fmtDataHora(agora)} />
                <Linha fs={dim.linha} k="VALIDADE:" v={fmtDataHora(validadeEm)} />
                {form.lote && <Linha fs={dim.linha} k="LOTE/SIF:" v={form.lote} />}
                <div style={{ borderTop: "0.4mm solid #000", marginTop: "auto", paddingTop: dim.gap, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "2mm" }}>
                  <div style={{ fontSize: dim.resp, lineHeight: 1.25, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>RESP.: {(form.responsavel || "—").toUpperCase()}</div>
                    <div>{(unidadeInfo.nome || "").toUpperCase()}</div>
                    {cnpj && <div>CNPJ: {cnpj}</div>}
                  </div>
                  <div style={{ background: "#fff", flexShrink: 0 }}>
                    <QRCodeSVG value={rastreioUrl} size={dim.qr} level="M" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-center mt-3 flex items-center justify-center gap-1.5" style={{ color: "var(--dim)" }}>
              <QrCode size={13} /> {tamanho.replace("x", "×")}mm · código {codigo}
            </p>
          </div>
        </div>
      </PageBody>
    </div>
  );
}

function Linha({ k, v, top, fs = "3.6mm" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "2mm", fontSize: fs, fontWeight: 700, marginTop: top ? "1.2mm" : "0.6mm", borderBottom: "0.3mm solid #000", paddingBottom: "0.6mm", whiteSpace: "nowrap" }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}
