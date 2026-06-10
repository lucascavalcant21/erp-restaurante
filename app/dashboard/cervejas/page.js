"use client";

import { useState, useEffect, useMemo } from "react";
import { Wine, Plus, Trash2, Edit3, TrendingUp } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtPct,
} from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { fetchCervejas, inserirCerveja, atualizarCerveja, removerCerveja, ESTILOS, VOLUMES, ORIGENS } from "../../lib/cervejas";

const VAZIO = { marca: "", estilo: "Pilsen", volume_ml: 350, alcool: "", preco_compra: "", preco_venda: "", quantidade: "", minimo: 10, fornecedor: "", origem: "Brasil" };

function FormCerveja({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial ? { ...inicial, preco_compra: String(inicial.preco_compra), preco_venda: String(inicial.preco_venda), alcool: String(inicial.alcool || ""), quantidade: String(inicial.quantidade || ""), minimo: String(inicial.minimo || 10) } : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  const precoC = parseFloat(String(f.preco_compra).replace(",", ".")) || 0;
  const precoV = parseFloat(String(f.preco_venda).replace(",", ".")) || 0;
  const cmv = precoV > 0 ? (precoC / precoV) * 100 : 0;
  const margem = precoV > precoC ? ((precoV - precoC) / precoV) * 100 : 0;

  function salvar() {
    if (!f.marca.trim()) return setErro("Informe a marca da cerveja.");
    if (precoC <= 0) return setErro("Informe um preço de compra válido.");
    if (precoV <= 0) return setErro("Informe um preço de venda válido.");
    onSalvar({
      marca: f.marca.trim(), estilo: f.estilo, volume_ml: Number(f.volume_ml),
      alcool: f.alcool ? parseFloat(String(f.alcool).replace(",", ".")) : null,
      preco_compra: precoC, preco_venda: precoV,
      quantidade: Number(f.quantidade) || 0, minimo: Number(f.minimo) || 10,
      fornecedor: f.fornecedor || null, origem: f.origem,
    });
  }

  return (
    <>
      <Field label="Marca"><TextInput value={f.marca} onChange={(e) => set("marca", e.target.value)} placeholder="ex: Heineken, Skol, Brahma" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estilo"><Select value={f.estilo} onChange={(e) => set("estilo", e.target.value)}>{ESTILOS.map((e) => <option key={e}>{e}</option>)}</Select></Field>
        <Field label="Origem"><Select value={f.origem} onChange={(e) => set("origem", e.target.value)}>{ORIGENS.map((o) => <option key={o}>{o}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Volume (mL)"><Select value={f.volume_ml} onChange={(e) => set("volume_ml", e.target.value)}>{VOLUMES.map((v) => <option key={v}>{v}</option>)}</Select></Field>
        <Field label="Álcool (%)"><NumberInput value={f.alcool} onChange={(e) => set("alcool", e.target.value)} placeholder="4.5" step="0.1" /></Field>
        <Field label="Mínimo"><NumberInput value={f.minimo} onChange={(e) => set("minimo", e.target.value)} placeholder="10" step="1" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço de compra (R$)"><NumberInput value={f.preco_compra} onChange={(e) => set("preco_compra", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Preço de venda (R$)"><NumberInput value={f.preco_venda} onChange={(e) => set("preco_venda", e.target.value)} placeholder="0,00" step="0.01" /></Field>
      </div>
      {precoV > 0 && (
        <div className="erp-panel p-3 mb-3 flex justify-between items-center">
          <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>CMV {fmtPct(cmv)} · Margem {fmtPct(margem)}</span>
          <span className="text-sm font-bold" style={{ color: margem >= 30 ? "var(--accent-fg)" : "#DC2626" }}>{fmtBRL(precoV - precoC)}</span>
        </div>
      )}
      <Field label="Fornecedor"><TextInput value={f.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} placeholder="ex: Distribuidor local" /></Field>
      <Field label="Quantidade"><NumberInput value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} placeholder="0" step="1" /></Field>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function CervejasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [estilo, setEstilo] = useState("Todos");
  const [origem, setOrigem] = useState("Todos");
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await fetchCervejas(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, [unidadeAtiva]);

  const filtrados = useMemo(() => lista.filter((c) => {
    const mb = c.marca?.toLowerCase().includes(busca.toLowerCase());
    const me = estilo === "Todos" || c.estilo === estilo;
    const mo = origem === "Todos" || c.origem === origem;
    return mb && me && mo;
  }), [lista, busca, estilo, origem]);

  const resumo = useMemo(() => {
    const criticas = lista.filter((c) => c.quantidade <= c.minimo).length;
    const estoque_valor = lista.reduce((a, c) => a + (c.quantidade * c.preco_venda), 0);
    const cmv_medio = lista.length ? lista.reduce((a, c) => a + ((c.preco_compra / (c.preco_venda || 1)) * 100), 0) / lista.length : 0;
    return { total: lista.length, criticas, estoque_valor, cmv_medio };
  }, [lista]);

  async function salvar(dados) {
    if (editar) {
      await atualizarCerveja(editar.id, dados);
    } else {
      await inserirCerveja(dados, unidadeAtiva);
    }
    setModal(false); setEditar(null); setSalvou("Cerveja salva!");
    setTimeout(() => setSalvou(""), 2600);
    carregar();
  }

  async function remover(id) {
    await removerCerveja(id);
    setLista((p) => p.filter((c) => c.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Cervejas" subtitle="Catálogo, estoque e rentabilidade" icon={Wine} onAction={() => { setEditar(null); setModal(true); }} actionLabel="Nova" />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <KpiGrid>
          <Kpi icon={Wine} label="Cervejas cadastradas" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={TrendingUp} label="CMV médio" value={fmtPct(resumo.cmv_medio)} tint={resumo.cmv_medio <= 40 ? "#10B981" : "#F59E0B"} />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar marca..." />
        <Chips options={["Todos", ...ESTILOS]} value={estilo} onChange={setEstilo} />
        <Chips options={["Todos", ...ORIGENS]} value={origem} onChange={setOrigem} />

        <div>
          <SectionLabel>{filtrados.length} cerveja{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Wine} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Wine} title={busca ? "Nenhuma cerveja encontrada" : "Sem cervejas cadastradas"} hint={busca ? "Ajuste a busca" : "Clique em Nova para adicionar"} />
          ) : (
            <div className="space-y-2">
              {filtrados.map((c) => {
                const precoV = Number(c.preco_venda) || 0;
                const precoC = Number(c.preco_compra) || 0;
                const cmv = precoV > 0 ? (precoC / precoV) * 100 : 0;
                const margem = precoV > precoC ? ((precoV - precoC) / precoV) * 100 : 0;
                const critica = c.quantidade <= c.minimo;
                return (
                  <Card key={c.id} className="!p-3" style={critica ? { opacity: 0.75, borderLeft: "3px solid #EF4444" } : {}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold" style={{ color: "var(--fg)" }}>{c.marca}</p>
                          <span className="erp-badge text-[10px]" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{c.estilo}</span>
                          {c.origem === "Importada" && <span className="erp-badge text-[10px]" style={{ background: "#D4AF37", color: "#000" }}>Importada</span>}
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--dim)" }}>{c.volume_ml}mL {c.alcool ? `· ${c.alcool}%` : ""} · Est: {c.quantidade}/{c.minimo}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--dim)" }}>Venda</p>
                            <p className="font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(precoV)}</p>
                          </div>
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--dim)" }}>Compra</p>
                            <p className="text-sm" style={{ color: "var(--muted)" }}>{fmtBRL(precoC)}</p>
                          </div>
                          <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: 12 }}>
                            <p className="text-[10px] font-bold" style={{ color: cmv <= 40 ? "var(--accent-fg)" : "#DC2626" }}>CMV {fmtPct(cmv)}</p>
                            <p className="text-sm font-bold" style={{ color: cmv <= 40 ? "var(--accent-fg)" : "#DC2626" }}>{fmtBRL(precoV - precoC)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setEditar(c); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                        <button onClick={() => remover(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar cerveja" : "Nova cerveja"}>
        <FormCerveja inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
