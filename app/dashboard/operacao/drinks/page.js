"use client";

import { useState, useEffect, useMemo } from "react";
import { Wine, Plus, Trash2, Edit3, TrendingUp } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchDrinks, inserirDrink, atualizarDrink, removerDrink, TIPOS, COPOS, DESTILADOS, SABORES, GUARNACOES } from "../../../lib/drinks";

const VAZIO = { nome: "", tipo: "Drink", copo: "Highball", ml: 250, preco_venda: "", preco_custo: "", destilado: "Vodka", xarope_sim: false, xarope_qual: "", sabor: "", chantilly: false, guarnacao: "" };

function FormDrink({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial ? { ...inicial, preco_venda: String(inicial.preco_venda), preco_custo: String(inicial.preco_custo) } : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  const precoV = parseFloat(String(f.preco_venda).replace(",", ".")) || 0;
  const precoC = parseFloat(String(f.preco_custo).replace(",", ".")) || 0;
  const cmv = precoV > 0 ? (precoC / precoV) * 100 : 0;
  const margem = ((precoV - precoC) / precoV) * 100 || 0;

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do drink.");
    if (precoV <= 0) return setErro("Informe um preço válido.");
    onSalvar({
      nome: f.nome.trim(), tipo: f.tipo, copo: f.copo, ml: Number(f.ml) || 0,
      preco_venda: precoV, preco_custo: precoC,
      destilado: f.tipo === "Mocktail" ? null : f.destilado,
      xarope_sim: f.xarope_sim, xarope_qual: f.xarope_sim ? f.xarope_qual : null,
      sabor: f.sabor || null, chantilly: f.chantilly, guarnacao: f.guarnacao || null,
    });
  }

  return (
    <>
      <Field label="Nome do drink"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Mojito, Caipirinha, Água com Limão" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Copo"><Select value={f.copo} onChange={(e) => set("copo", e.target.value)}>{COPOS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Volume (mL)"><NumberInput value={f.ml} onChange={(e) => set("ml", e.target.value)} placeholder="250" step="10" /></Field>
        <Field label="Sabor"><Select value={f.sabor} onChange={(e) => set("sabor", e.target.value)}><option value="">Nenhum</option>{SABORES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Guarnação"><Select value={f.guarnacao} onChange={(e) => set("guarnacao", e.target.value)}><option value="">Nenhuma</option>{GUARNACOES.map((g) => <option key={g}>{g}</option>)}</Select></Field>
      </div>
      {f.tipo === "Drink" && (
        <Field label="Destilado"><Select value={f.destilado} onChange={(e) => set("destilado", e.target.value)}>{DESTILADOS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="erp-label block mb-1.5 text-[12px]">Xarope?</label>
          <div className="flex gap-2">
            <button onClick={() => set("xarope_sim", true)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${f.xarope_sim ? "erp-btn-primary" : "erp-card"}`}>Sim</button>
            <button onClick={() => set("xarope_sim", false)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${!f.xarope_sim ? "erp-btn-primary" : "erp-card"}`}>Não</button>
          </div>
        </div>
        {f.xarope_sim && <Field label="Qual xarope?"><TextInput value={f.xarope_qual} onChange={(e) => set("xarope_qual", e.target.value)} placeholder="ex: Xarope de Framboesa" /></Field>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="erp-label block mb-1.5 text-[12px]">Chantilly?</label>
          <div className="flex gap-2">
            <button onClick={() => set("chantilly", true)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${f.chantilly ? "erp-btn-primary" : "erp-card"}`}>Sim</button>
            <button onClick={() => set("chantilly", false)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${!f.chantilly ? "erp-btn-primary" : "erp-card"}`}>Não</button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço de venda (R$)"><NumberInput value={f.preco_venda} onChange={(e) => set("preco_venda", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Preço de custo (R$)"><NumberInput value={f.preco_custo} onChange={(e) => set("preco_custo", e.target.value)} placeholder="0,00" step="0.01" /></Field>
      </div>
      {precoV > 0 && <p className="text-xs font-bold" style={{ color: margem >= 50 ? "var(--accent-fg)" : "#F59E0B" }}>CMV {fmtPct(cmv)} · Margem {fmtBRL(precoV - precoC)}</p>}
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function DrinksPage() {
  const { unidadeAtiva } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("Todos");
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await fetchDrinks(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, [unidadeAtiva]);

  const filtrados = useMemo(() => lista.filter((d) => {
    const mb = d.nome?.toLowerCase().includes(busca.toLowerCase());
    const mt = tipo === "Todos" || d.tipo === tipo;
    return mb && mt;
  }), [lista, busca, tipo]);

  const resumo = useMemo(() => {
    const drinks = lista.filter((d) => d.tipo === "Drink").length;
    const mocktails = lista.filter((d) => d.tipo === "Mocktail").length;
    const cmv_medio = lista.length ? lista.reduce((a, d) => a + ((d.preco_custo / (d.preco_venda || 1)) * 100), 0) / lista.length : 0;
    return { drinks, mocktails, cmv_medio };
  }, [lista]);

  async function salvar(dados) {
    if (editar) {
      await atualizarDrink(editar.id, dados);
    } else {
      await inserirDrink(dados, unidadeAtiva);
    }
    setModal(false); setEditar(null); setSalvou("Drink salvo!");
    setTimeout(() => setSalvou(""), 2600);
    carregar();
  }

  async function remover(id) {
    await removerDrink(id);
    setLista((p) => p.filter((d) => d.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Cardápio de Drinks" subtitle="Drinks e mocktails detalhados" icon={Wine} onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo" />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <KpiGrid>
          <Kpi icon={Wine} label="Drinks (com álcool)" value={resumo.drinks} tint="var(--accent-fg)" />
          <Kpi icon={Wine} label="Mocktails (sem álcool)" value={resumo.mocktails} tint="#10B981" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar drink..." />
        <Chips options={["Todos", ...TIPOS]} value={tipo} onChange={setTipo} />

        <div>
          <SectionLabel>{filtrados.length} drink{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Wine} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Wine} title={busca ? "Nenhum drink encontrado" : "Sem drinks cadastrados"} hint={busca ? "Ajuste a busca" : "Clique em Novo para adicionar"} />
          ) : (
            <div className="space-y-2">
              {filtrados.map((d) => {
                const precoV = Number(d.preco_venda) || 0;
                const precoC = Number(d.preco_custo) || 0;
                const cmv = precoV > 0 ? (precoC / precoV) * 100 : 0;
                return (
                  <Card key={d.id} className="!p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold" style={{ color: "var(--fg)" }}>{d.nome}</p>
                          <span className="erp-badge text-[10px]" style={{ background: d.tipo === "Drink" ? "#EC4899" : "#10B981", color: "#fff" }}>{d.tipo}</span>
                        </div>
                        <p className="text-[11px] font-bold mt-1" style={{ color: "var(--accent-fg)" }}>Em estoque: {d.estoque_producao || 0} unid.</p>
                      </div>
                      <p className="text-lg font-bold" style={{ color: "var(--accent-fg)" }}>{fmtBRL(precoV)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-2" style={{ color: "var(--dim)" }}>
                      <div><strong>Copo:</strong> {d.copo} · {d.ml}mL</div>
                      {d.destilado && <div><strong>Destilado:</strong> {d.destilado}</div>}
                      {d.sabor && <div><strong>Sabor:</strong> {d.sabor}</div>}
                      {d.xarope_sim && <div><strong>Xarope:</strong> {d.xarope_qual}</div>}
                      {d.guarnacao && <div><strong>Guarnação:</strong> {d.guarnacao}</div>}
                      {d.chantilly && <div><strong>Chantilly:</strong> Sim</div>}
                    </div>
                    <div className="flex items-center justify-between text-[10px]" style={{ color: cmv <= 40 ? "var(--accent-fg)" : "#F59E0B", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                      <span>CMV {fmtPct(cmv)}</span>
                      <span className="font-bold">{fmtBRL(precoV - precoC)}</span>
                    </div>
                    <div className="flex gap-1 mt-2 flex-shrink-0">
                      <button onClick={() => { setEditar(d); setModal(true); }} className="flex-1 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => remover(d.id)} className="flex-1 w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={14} /></button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar drink" : "Novo drink"}>
        <FormDrink inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
