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
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}H${p(d.getMinutes())}`;
}

export default function EtiquetasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState({ produto: "", conservacao: "Congelado", quantidade: "1", unidade: "UN", dias: 30, lote: "", responsavel: "" });
  const [cnpj, setCnpj] = useState("");
  const [codigo, setCodigo] = useState(gerarCodigo());
  const [tamanho, setTamanho] = useState("60x60"); // "60x60" | "60x40"
  const [validadeModo, setValidadeModo] = useState("dias"); // "dias" | "data"
  const [dataValidade, setDataValidade] = useState("");
  const [presets, setPresets] = useState([]);
  const [novoPreset, setNovoPreset] = useState({ nome: "", dias: "" });
  const [showPreset, setShowPreset] = useState(false);
  const [salvou, setSalvou] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function salvarPresets(lista) { setPresets(lista); try { localStorage.setItem("erp_validade_presets", JSON.stringify(lista)); } catch (_) {} }
  function addPreset() {
    if (!novoPreset.nome.trim() || !novoPreset.dias) return;
    salvarPresets([...presets, { nome: novoPreset.nome.trim(), dias: Number(novoPreset.dias) || 0 }]);
    setNovoPreset({ nome: "", dias: "" }); setShowPreset(false);
  }

  // Dimensões/escala da etiqueta conforme o tamanho escolhido
  const dim = tamanho === "60x40"
    ? { h: "40mm", pad: "2.5mm", titulo: "4mm", linha: "2.9mm", resp: "2.5mm", qr: 50, gap: "0.5mm" }
    : { h: "60mm", pad: "4mm",   titulo: "5mm", linha: "3.4mm", resp: "3mm",   qr: 92, gap: "0.8mm" };

  useEffect(() => {
    lerSessao().then((s) => s?.nome && setForm((f) => ({ ...f, responsavel: f.responsavel || s.nome })));
    try {
      setCnpj(localStorage.getItem("erp_cnpj") || "");
      setPresets(JSON.parse(localStorage.getItem("erp_validade_presets") || "[]"));
    } catch (_) {}
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
    if (c) { set("dias", c.dias); setValidadeModo("dias"); }
  }
  function aplicarPreset(p) { set("dias", p.dias); setValidadeModo("dias"); }

  const agora = useMemo(() => new Date(), [form, codigo]); // recalc ao mexer
  const validadeEm = useMemo(() => {
    if (validadeModo === "data" && dataValidade) return new Date(`${dataValidade}T23:59:00`);
    return new Date(agora.getTime() + (Number(form.dias) || 0) * 86400000);
  }, [validadeModo, dataValidade, agora, form.dias]);
  const diasEfetivo = Math.max(0, Math.round((validadeEm.getTime() - agora.getTime()) / 86400000));
  const nomeProduto = (form.produto || "").trim();

  const rastreioUrl = typeof window !== "undefined" ? `${window.location.origin}/rastreio/${codigo}` : `/rastreio/${codigo}`;

  function salvarCnpj(v) { setCnpj(v); try { localStorage.setItem("erp_cnpj", v); } catch (_) {} }

  async function salvar(imprimir) {
    if (!nomeProduto) { setSalvou("⚠️ Informe o produto"); setTimeout(() => setSalvou(""), 2000); return; }
    if (!form.responsavel.trim()) { setSalvou("⚠️ Informe o responsável"); setTimeout(() => setSalvou(""), 2000); return; }
    await criarEtiqueta({
      codigo, produto: nomeProduto, conservacao: form.conservacao,
      quantidade: Number(form.quantidade) || 0, unidade: form.unidade,
      validade_dias: diasEfetivo,
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
              <div className="mb-2 flex gap-1.5">
                {[["dias", "Por dias"], ["data", "Por data"]].map(([m, l]) => (
                  <button key={m} onClick={() => setValidadeModo(m)} className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-all"
                    style={validadeModo === m ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--line)" }}>{l}</button>
                ))}
              </div>
              {validadeModo === "dias" ? (
                <Field label="Validade (dias)"><NumberInput value={form.dias} onChange={(e) => set("dias", e.target.value)} /></Field>
              ) : (
                <Field label="Data de validade"><TextInput type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} /></Field>
              )}
              <div className="flex flex-wrap gap-1.5 items-center mb-3">
                {presets.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-bold pl-2.5 pr-1.5 py-1 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
                    <button onClick={() => aplicarPreset(p)} title="Aplicar">{p.nome} · {p.dias}d</button>
                    <button onClick={() => salvarPresets(presets.filter((_, x) => x !== i))} title="Remover" style={{ opacity: 0.6 }}>×</button>
                  </span>
                ))}
                <button onClick={() => setShowPreset((v) => !v)} className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ border: "1px dashed var(--line)", color: "var(--muted)" }}>+ preset</button>
              </div>
              {showPreset && (
                <div className="flex gap-2 mb-3 items-end">
                  <div className="flex-1"><TextInput value={novoPreset.nome} onChange={(e) => setNovoPreset((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome (ex: Açaí)" /></div>
                  <div style={{ width: 90 }}><NumberInput value={novoPreset.dias} onChange={(e) => setNovoPreset((p) => ({ ...p, dias: e.target.value }))} placeholder="dias" /></div>
                  <Btn variant="primary" onClick={addPreset}>OK</Btn>
                </div>
              )}
              <Field label="Lote / SIF (opcional)"><TextInput value={form.lote} onChange={(e) => set("lote", e.target.value)} placeholder="SIF 1234" /></Field>
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
              <div id="area-impressao" style={{ width: "60mm", height: dim.h, background: "#fff", color: "#000", padding: dim.pad, fontFamily: "'Courier New', monospace", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* produto */}
                <div style={{ fontSize: dim.titulo, fontWeight: 800, lineHeight: 1.0, textTransform: "uppercase", paddingBottom: dim.gap, borderBottom: "0.5mm solid #000" }}>
                  {nomeProduto || "PRODUTO"}
                </div>
                {/* conservação + qtd */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: dim.linha, fontWeight: 700, padding: "0.8mm 0", borderBottom: "0.4mm solid #000" }}>
                  <span>{form.conservacao.toUpperCase()}</span>
                  <span>QTD: {form.quantidade}{form.unidade !== "UN" ? " " + form.unidade : ""}</span>
                </div>
                {/* manipulação + validade */}
                <div style={{ padding: "0.8mm 0", borderBottom: "0.4mm solid #000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: dim.linha, fontWeight: 700 }}><span>MANIPULACAO:</span><span>{fmtDataHora(agora)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: dim.linha, fontWeight: 700, marginTop: "0.4mm" }}><span>VALIDADE:</span><span>{fmtDataHora(validadeEm)}</span></div>
                </div>
                {/* responsável */}
                <div style={{ fontSize: dim.linha, fontWeight: 700, marginTop: "1mm" }}>RESP.: {(form.responsavel || "—").toUpperCase()}</div>
                {form.lote && <div style={{ fontSize: dim.resp, fontWeight: 700, marginTop: "0.5mm" }}>LOTE/SIF: {form.lote}</div>}
                {/* QR Code centralizado */}
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, padding: "1mm 0" }}>
                  <QRCodeSVG value={rastreioUrl} size={dim.qr} level="M" />
                </div>
                {/* rodapé empresa */}
                <div style={{ borderTop: "0.5mm solid #000", paddingTop: dim.gap, display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: dim.resp, fontWeight: 700, gap: "2mm" }}>
                  <div style={{ minWidth: 0 }}>
                    {cnpj && <div>CNPJ: {fmtCNPJ(cnpj)}</div>}
                    <div>{(unidadeInfo.nome || "").toUpperCase()}</div>
                  </div>
                  <div style={{ opacity: 0.7, flexShrink: 0 }}>#{codigo}</div>
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

function fmtCNPJ(s) {
  const d = (s || "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : s;
}

function Linha({ k, v, top, fs = "3.6mm", forte }) {
  const base = { display: "flex", justifyContent: "space-between", gap: "2mm", fontSize: fs, fontWeight: 700, whiteSpace: "nowrap" };
  if (forte) {
    return (
      <div style={{ ...base, background: "#000", color: "#fff", padding: "0.9mm 1.2mm", borderRadius: "0.8mm", marginTop: "1mm" }}>
        <span>{k}</span><span>{v}</span>
      </div>
    );
  }
  return (
    <div style={{ ...base, marginTop: top ? "1.2mm" : "0.6mm", borderBottom: "0.3mm solid #000", paddingBottom: "0.6mm" }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}
