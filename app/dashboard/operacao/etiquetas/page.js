"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Tag, Printer, Save, Snowflake, Thermometer, Box, QrCode } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Field, TextInput, NumberInput, Select, Btn, Toast, EmptyState
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { lerSessao } from "../../../lib/auth";
import { fetchEstoque } from "../../../lib/estoque";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchColaboradores } from "../../../lib/rh";
import { CONSERVACAO, gerarCodigo, criarEtiqueta } from "../../../lib/etiquetas";
import { UNIDADES as UNIDADES_REDE } from "../../../lib/unidades";

const UNIDADES = ["UN", "KG", "G", "L", "ML", "CX", "PCT", "BANDEJA"];
const ICONE_CONS = { Resfriado: Thermometer, Congelado: Snowflake, Ambiente: Box };

function fmtDataHora(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}H${p(d.getMinutes())}`;
}
function fmtData(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function EtiquetasRunner() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' | 'bar' | null (todos)
  const [produtos, setProdutos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [form, setForm] = useState({ 
    produto: "", conservacao: "Congelado", quantidade: "1", unidade: "UN", 
    dias: 30, lote: "", responsavel: "" 
  });
  const [cnpj, setCnpj] = useState("");
  const [codigo, setCodigo] = useState(gerarCodigo());
  const [tamanho, setTamanho] = useState("60x60"); // "60x60" | "60x40"
  const [validadeModo, setValidadeModo] = useState("dias"); // "dias" | "data"
  // "aberto" = produto aberto/manipulado (mostra data e hora de manipulação);
  // "dia" = só validade (etiquetar a data de validade, sem manipulação)
  const [tipoEtiqueta, setTipoEtiqueta] = useState("aberto");
  const [dataValidade, setDataValidade] = useState("");
  const [presets, setPresets] = useState([]);
  const [novoPreset, setNovoPreset] = useState({ nome: "", dias: "" });
  const [showPreset, setShowPreset] = useState(false);
  const [salvou, setSalvou] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [copias, setCopias] = useState(1);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function salvarPresets(lista) { setPresets(lista); try { localStorage.setItem("erp_validade_presets", JSON.stringify(lista)); } catch (_) {} }
  function addPreset() {
    if (!novoPreset.nome.trim() || !novoPreset.dias) return;
    salvarPresets([...presets, { nome: novoPreset.nome.trim(), dias: Number(novoPreset.dias) || 0 }]);
    setNovoPreset({ nome: "", dias: "" }); setShowPreset(false);
  }

  // Dimensões/escala da etiqueta conforme o tamanho escolhido
  const dim = tamanho === "60x40"
    ? { h: "40mm", pad: "2.5mm", titulo: "3.8mm", linha: "2.5mm", resp: "2.4mm", qr: 42, gap: "0.5mm" }
    : { h: "60mm", pad: "3.5mm", titulo: "4.6mm", linha: "3mm",   resp: "2.8mm", qr: 64, gap: "0.8mm" };

  useEffect(() => {
    lerSessao().then((s) => s?.nome && setForm((f) => ({ ...f, responsavel: f.responsavel || s.nome })));
    try {
      setCnpj(localStorage.getItem("erp_cnpj") || "");
      setPresets(JSON.parse(localStorage.getItem("erp_validade_presets") || "[]"));
    } catch (_) {}
  }, []);
  const [custoMap, setCustoMap] = useState({});
  useEffect(() => {
    (async () => {
      // Produtos do cardápio + insumos do estoque, filtrados pelo departamento
      // da URL (?dept=cozinha ou ?dept=bar) — cada área vê só o que é dela.
      const [e, pr, colab] = await Promise.all([
        fetchEstoque(unidadeAtiva, deptUrl || undefined),
        fetchProdutos(unidadeAtiva, deptUrl || undefined),
        fetchColaboradores(unidadeAtiva),
      ]);
      const nomes = [...new Set([
        ...(e.data || []).map((x) => x.nome),
        ...(pr.data || []).map((x) => x.nome_produto),
      ].filter(Boolean))].sort();
      setProdutos(nomes);
      const mapa = {};
      (e.data || []).forEach((x) => { mapa[x.nome] = Number(x.custo_unitario) || Number(x.preco_unit) || mapa[x.nome] || 0; });
      setCustoMap(mapa);
      setColaboradores((colab.data || []).filter((c) => c.ativo !== false && c.status !== "inativo"));
    })();
  }, [unidadeAtiva, deptUrl]);

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
    if (salvando) return;
    if (!nomeProduto) { setSalvou("Informe o produto"); setTimeout(() => setSalvou(""), 2000); return; }
    if (!form.responsavel.trim()) { setSalvou("Informe o responsável"); setTimeout(() => setSalvou(""), 2000); return; }
    if (Number(form.quantidade) <= 0) { setSalvou("Informe uma quantidade maior que zero"); setTimeout(() => setSalvou(""), 2500); return; }
    if (Number(copias) < 1) { setSalvou("Informe pelo menos uma etiqueta"); setTimeout(() => setSalvou(""), 2500); return; }
    if (!Number.isFinite(validadeEm.getTime()) || validadeEm.getTime() < agora.getTime()) {
      setSalvou("A validade não pode estar no passado"); setTimeout(() => setSalvou(""), 2500); return;
    }

    setSalvando(true);
    try {
      const resultado = await criarEtiqueta({
        codigo, produto: nomeProduto, conservacao: form.conservacao,
        quantidade: Number(form.quantidade), unidade: form.unidade,
        validade_dias: diasEfetivo,
        manipulacao_em: agora.toISOString(),
        validade_em: validadeEm.toISOString(),
        lote: form.lote || null, responsavel: form.responsavel.trim(),
        custo_unit: custoMap[nomeProduto] || 0, status: "ativa",
        copias: Number(copias),
      }, unidadeAtiva);

      if (resultado.error) {
        setSalvou("Não foi possível salvar: " + resultado.error);
        setTimeout(() => setSalvou(""), 4000);
        return;
      }

      if (imprimir) setTimeout(() => window.print(), 150);
      setSalvou(imprimir ? "Etiqueta salva. Abrindo impressão..." : "Etiqueta salva!");
      setTimeout(() => { setSalvou(""); setCodigo(gerarCodigo()); }, 2200);
    } catch (erro) {
      setSalvou("Falha ao salvar a etiqueta: " + (erro?.message || "erro inesperado"));
      setTimeout(() => setSalvou(""), 4000);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden !important; }
          #area-impressao, #area-impressao * { visibility: visible !important; }
          #area-impressao { position: absolute !important; left: 0; top: 0; margin: 0; padding: 0; background: #fff !important; color: #000 !important; width: 100%; display: flex !important; flex-direction: column !important; gap: 0 !important; }
          .etiqueta-print { page-break-after: always; overflow: hidden; border-radius: 0 !important; box-shadow: none !important; border: none !important; margin: 0 !important; }
          @page { margin: 0; }
        }
      `}} />
      <PageHeader title={`Etiquetas${deptUrl ? ` — ${deptUrl === 'bar' ? 'Bar' : 'Cozinha'}` : ''}`} subtitle={`QR Code + rastreio · ${unidadeInfo.nome}`} icon={Tag} />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        {/* Filtro por departamento: cada área imprime etiquetas só dos seus itens */}
        <div className="inline-flex gap-1 p-1 mb-4 rounded-xl" style={{ background: "var(--elevated)" }}>
          {[["", "Todos"], ["cozinha", "Cozinha"], ["bar", "Bar"]].map(([d, l]) => (
            <button key={d} onClick={() => router.push(`/dashboard/operacao/etiquetas${d ? `?dept=${d}` : ""}`)}
              className="px-4 py-2 rounded-lg font-bold text-sm transition-all"
              style={(deptUrl || "") === d ? { background: "var(--card)", color: "var(--fg)", boxShadow: "0 1px 2px rgba(0,0,0,.15)" } : { color: "var(--muted)" }}>
              {l}
            </button>
          ))}
        </div>

        {(!unidadeAtiva || unidadeAtiva === "todas") ? (
          <EmptyState icon={Tag} title="Acesso Restrito às Unidades" hint="O Cérebro (Gestão Central) apenas visualiza o Controle de Validade. Para gerar novas etiquetas, selecione uma unidade no menu lateral." />
        ) : (
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
              {/* Tipo da etiqueta: produto aberto (manipulação) ou só validade */}
              <div className="mb-4">
                <p className="erp-label mb-2">Tipo de etiqueta</p>
                <div className="flex gap-1.5">
                  {[["aberto", "Produto aberto (manipulação)"], ["dia", "Só validade do dia"]].map(([m, l]) => (
                    <button key={m} onClick={() => setTipoEtiqueta(m)} className="flex-1 py-2.5 rounded-lg text-[12px] font-bold transition-all"
                      style={tipoEtiqueta === m ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--line)" }}>{l}</button>
                  ))}
                </div>
                <p className="text-[10px] font-medium mt-1.5" style={{ color: "var(--dim)" }}>
                  {tipoEtiqueta === "aberto" ? "Registra data e hora da abertura/manipulação + a validade." : "Só a validade — para etiquetar produto lacrado ou preparo do dia."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Peso do Produto"><NumberInput value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} placeholder="0.00" /></Field>
                <Field label="Unidade"><Select value={form.unidade} onChange={(e) => set("unidade", e.target.value)}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</Select></Field>
                <Field label="Etiquetas p/ Imprimir"><NumberInput value={copias} onChange={(e) => setCopias(e.target.value)} min="1" /></Field>
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
              <Field label="Responsável">
                <Select value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)}>
                  <option value="">Selecione um funcionário...</option>
                  {form.responsavel && !colaboradores.some((c) => c.nome === form.responsavel) && <option value={form.responsavel}>{form.responsavel}</option>}
                  {colaboradores.map((c) => <option key={c.id} value={c.nome}>{c.nome} ({c.cargo || "Equipe"})</option>)}
                </Select>
              </Field>
              <Field label="CNPJ da empresa (sai na etiqueta)"><TextInput value={cnpj} onChange={(e) => salvarCnpj(e.target.value)} placeholder="00.000.000/0001-00" /></Field>
            </Card>

            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1" disabled={salvando} onClick={() => salvar(false)}><Save size={16} /> {salvando ? "Salvando..." : "Salvar"}</Btn>
              <Btn variant="primary" className="flex-1" disabled={salvando} onClick={() => salvar(true)}><Printer size={16} /> {salvando ? "Aguarde..." : "Imprimir"}</Btn>
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
            <div className="flex justify-center overflow-auto p-4 bg-slate-100 rounded-2xl border border-slate-200">
              <div id="area-impressao" className="flex flex-col gap-4">
                {Array.from({ length: Math.max(1, copias) }).map((_, idx) => (
                  <div key={idx} className="etiqueta-print shadow-sm" style={{ width: "60mm", height: dim.h, background: "#fff", color: "#000", padding: dim.pad, fontFamily: "'Courier New', monospace", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
                    {/* produto */}
                    <div style={{ fontSize: dim.titulo, fontWeight: 800, lineHeight: 1.0, textTransform: "uppercase", paddingBottom: dim.gap, borderBottom: "0.5mm solid #000" }}>
                      {nomeProduto || "PRODUTO"}
                    </div>
                    {/* conservação + qtd */}
                    <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 700, padding: "0.8mm 0", borderBottom: "0.4mm solid #000" }}>
                      <span>{form.conservacao.toUpperCase()}</span>
                      <span>PESO: {form.quantidade}{form.unidade !== "UN" ? " " + form.unidade : ""}</span>
                    </div>
                    {/* manipulação (só se produto aberto) + validade */}
                    <div style={{ padding: "0.8mm 0", borderBottom: "0.4mm solid #000" }}>
                      {tipoEtiqueta === "aberto" && (
                        <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 700 }}><span>MANIPULACAO:</span><span>{fmtDataHora(agora)}</span></div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 700, marginTop: tipoEtiqueta === "aberto" ? "0.4mm" : 0 }}><span>VALIDADE:</span><span>{tipoEtiqueta === "aberto" ? fmtDataHora(validadeEm) : fmtData(validadeEm)}</span></div>
                    </div>
                    {/* responsável */}
                    <div style={{ fontSize: dim.linha, fontWeight: 700, marginTop: "1mm" }}>RESP.: {(form.responsavel || "—").toUpperCase()}</div>
                    {form.lote && <div style={{ fontSize: dim.resp, fontWeight: 700, marginTop: "0.5mm" }}>LOTE/SIF: {form.lote}</div>}
                    {/* espaço flexível empurra o rodapé pra baixo */}
                    <div style={{ flex: 1, minHeight: "1mm" }} />
                    {/* rodapé: empresa (esq) + QR encaixado (dir) */}
                    <div style={{ borderTop: "0.5mm solid #000", paddingTop: dim.gap, display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: dim.resp, fontWeight: 700, gap: "2mm" }}>
                      <div style={{ minWidth: 0, lineHeight: 1.35 }}>
                        {cnpj && <div>CNPJ: {fmtCNPJ(cnpj)}</div>}
                        <div>{(unidadeInfo.nome || "").toUpperCase()}</div>
                        <div style={{ opacity: 0.7 }}>#{codigo}</div>
                      </div>
                      <div style={{ flexShrink: 0, lineHeight: 0 }}>
                        <QRCodeSVG value={rastreioUrl} size={dim.qr} level="M" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-center mt-3 flex items-center justify-center gap-1.5" style={{ color: "var(--dim)" }}>
              <QrCode size={13} /> {tamanho.replace("x", "×")}mm · código {codigo}
            </p>
          </div>
        </div>
        )}
      </PageBody>
    </div>
  );
}

export default function EtiquetasPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold" style={{ color: "var(--muted)" }}>Carregando Etiquetas...</div>}>
       <EtiquetasRunner />
    </Suspense>
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
