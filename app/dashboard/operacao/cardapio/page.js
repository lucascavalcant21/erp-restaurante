"use client";

import { useState, useEffect, useMemo } from "react";
import { ChefHat, TrendingUp, Check, AlertCircle, Edit3, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchCardapio, inserirPrato, atualizarPrato, removerPrato } from "../../../lib/cardapio";

const CATEGORIAS = ["Marmita", "Salada", "Prato Principal", "Lanche", "Sobremesa", "Combo", "Bebida", "Drink", "Coquetel", "Dose"];
const SETORES = ["Cozinha", "Bar"];
const VAZIO = { nome: "", categoria: "Marmita", preco: "", custo: "", ativo: true, setor: "Cozinha" };

function metricas(p) {
  const preco = Number(p.preco) || 0;
  const custo = Number(p.custo) || 0;
  const cmv = preco > 0 ? (custo / preco) * 100 : 0;
  const mc  = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
  return { preco, custo, cmv, mc, ok: mc >= 30 };
}

function FormPrato({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial
    ? { ...inicial, preco: String(inicial.preco ?? ""), custo: String(inicial.custo ?? "") }
    : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  const m = metricas({ preco: f.preco, custo: f.custo });

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do prato.");
    if (m.preco <= 0) return setErro("Informe um preço de venda válido.");
    onSalvar({ nome: f.nome.trim(), categoria: f.categoria, preco: m.preco, custo: Number(f.custo) || 0, ativo: f.ativo, setor: f.setor || "Cozinha" });
  }

  return (
    <>
      <Field label="Nome do prato"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Marmitex Executiva" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria"><Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Setor"><Select value={f.setor} onChange={(e) => set("setor", e.target.value)}>{SETORES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço de venda (R$)"><NumberInput value={f.preco} onChange={(e) => set("preco", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Custo / CMV (R$)"><NumberInput value={f.custo} onChange={(e) => set("custo", e.target.value)} placeholder="0,00" step="0.01" /></Field>
      </div>
      {m.preco > 0 && (
        <div className="erp-panel p-3 mb-3 flex justify-between items-center">
          <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>Margem de contribuição</span>
          <span className="text-sm font-bold" style={{ color: m.ok ? "var(--accent-fg)" : "#FCA5A5" }}>MC {fmtPct(m.mc)} · CMV {fmtPct(m.cmv)}</span>
        </div>
      )}
      <Field label="Situação">
        <Select value={f.ativo ? "1" : "0"} onChange={(e) => set("ativo", e.target.value === "1")}>
          <option value="1">Ativo</option><option value="0">Pausado</option>
        </Select>
      </Field>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function CardapioPage() {
  const { unidadeAtiva } = useERP();
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]     = useState("");
  const [cat, setCat]         = useState("Todos");
  const [setor, setSetor]     = useState("Todos");
  const [modal, setModal]     = useState(false);
  const [editar, setEditar]   = useState(null);
  const [salvou, setSalvou]   = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchCardapio(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const ativos = lista.filter((p) => p.ativo);
    const mcs = ativos.map((p) => metricas(p)).filter((m) => m.preco > 0);
    const mcMedia = mcs.length ? mcs.reduce((a, m) => a + m.mc, 0) / mcs.length : 0;
    const criticos = mcs.filter((m) => !m.ok).length;
    return { ativos: ativos.length, mcMedia, criticos, saudaveis: mcs.filter((m) => m.ok).length };
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((p) => {
    const mb = p.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cat === "Todos" || p.categoria === cat;
    const ms = setor === "Todos" || (p.setor || "Cozinha") === setor;
    return mb && mc && ms;
  }), [lista, busca, cat, setor]);

  async function salvar(dados) {
    if (editar) { await atualizarPrato(editar.id, dados); }
    else { await inserirPrato(dados, unidadeAtiva); }
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
    carregar();
  }
  async function toggle(p) {
    setLista((prev) => prev.map((x) => x.id === p.id ? { ...x, ativo: !x.ativo } : x));
    await atualizarPrato(p.id, { ativo: !p.ativo });
  }
  async function remover(id) {
    await removerPrato(id);
    setLista((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Cardápio" subtitle="Pratos, preços e margem de contribuição" icon={ChefHat}
        onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo" />
      <PageBody>
        <Toast show={salvou}>Cardápio atualizado!</Toast>

        <KpiGrid>
          <Kpi icon={ChefHat} label="Pratos ativos" value={resumo.ativos} tint="var(--accent-fg)" />
          <Kpi icon={TrendingUp} label="MC média" value={fmtPct(resumo.mcMedia)} tint={resumo.mcMedia >= 30 ? "#10B981" : "#F59E0B"} />
          <Kpi icon={Check} label="MC saudável (≥30%)" value={resumo.saudaveis} tint="#10B981" />
          <Kpi icon={AlertCircle} label="CMV crítico" value={resumo.criticos} tint={resumo.criticos > 0 ? "#EF4444" : "var(--muted)"} />
        </KpiGrid>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar prato/drink..." />
          <Chips options={["Todos", ...SETORES]} value={setor} onChange={setSetor} />
          <Chips options={["Todos", ...CATEGORIAS]} value={cat} onChange={setCat} />
        </div>

        <div>
          <SectionLabel>{filtrados.length} prato{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={ChefHat} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={ChefHat} title={busca || cat !== "Todos" ? "Nenhum prato encontrado" : "Cardápio vazio"}
              hint={busca || cat !== "Todos" ? "Ajuste a busca ou o filtro" : "Toque em Novo para adicionar um prato"} />
          ) : (
            <div className="space-y-3">
              {filtrados.map((p) => {
                const m = metricas(p);
                return (
                  <Card key={p.id} style={p.ativo ? {} : { opacity: 0.6 }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>{p.categoria}</span>
                        <p className="text-base font-bold truncate" style={{ color: "var(--fg)" }}>{p.nome}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(m.preco)}</p>
                        <p className="text-[11px]" style={{ color: "var(--dim)" }}>preço venda</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--elevated)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(m.cmv, 100)}%`, background: m.ok ? "#10B981" : "#EF4444" }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold mb-3" style={{ color: m.ok ? "var(--accent-fg)" : "#FCA5A5" }}>
                      <span>CMV {fmtPct(m.cmv)} · Custo {fmtBRL(m.custo)}</span>
                      <span>MC {fmtPct(m.mc)}</span>
                    </div>
                    <div className="flex gap-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                      <button onClick={() => toggle(p)} className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold rounded-lg" style={{ background: "var(--elevated)", color: "var(--muted)" }}>
                        {p.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />} {p.ativo ? "Pausar" : "Ativar"}
                      </button>
                      <button onClick={() => { setEditar(p); setModal(true); }} className="w-9 flex items-center justify-center rounded-lg" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => remover(p.id)} className="w-9 flex items-center justify-center rounded-lg erp-badge-danger"><Trash2 size={14} /></button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar prato" : "Novo prato"}>
        <FormPrato inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
