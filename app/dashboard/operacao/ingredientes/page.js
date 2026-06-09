"use client";

import { useState, useEffect, useMemo } from "react";
import { FlaskConical, Beef, Droplets, Package, Edit3, Trash2 } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchIngredientes, inserirIngrediente, atualizarIngrediente, removerIngrediente,
  calcCustoUnitario, getUnidade, UNIDADES,
} from "../../../lib/ingredientes";

const ICONE_UN = { KG: Beef, L: Droplets, UN: Package, MACO: Package, CX: Package };
const VAZIO = { nome: "", unidade: "KG", preco_compra: "" };

function FormIngrediente({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial ? { ...inicial, preco_compra: String(inicial.preco_compra) } : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  const preco = parseFloat(String(f.preco_compra).replace(",", ".")) || 0;
  const un = getUnidade(f.unidade);
  const custoBase = calcCustoUnitario(preco, f.unidade);

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do ingrediente.");
    if (preco <= 0) return setErro("Informe um preço de compra válido.");
    onSalvar({ nome: f.nome.trim(), unidade: f.unidade, preco_compra: preco });
  }

  return (
    <>
      <Field label="Nome do ingrediente"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Carne Moída (Patinho)" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidade de compra"><Select value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>{UNIDADES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select></Field>
        <Field label="Preço de compra (R$)"><NumberInput value={f.preco_compra} onChange={(e) => set("preco_compra", e.target.value)} placeholder="0,00" step="0.01" /></Field>
      </div>
      {preco > 0 && (
        <div className="erp-panel p-3 mb-3 flex justify-between items-center">
          <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>Custo {un.label_base}</span>
          <span className="text-sm font-bold" style={{ color: "var(--accent-fg)" }}>{fmtBRL(custoBase, custoBase < 0.01 ? 4 : 2)}</span>
        </div>
      )}
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function IngredientesPage() {
  const { unidadeAtiva } = useERP();
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]     = useState("");
  const [modal, setModal]     = useState(false);
  const [editar, setEditar]   = useState(null);
  const [salvou, setSalvou]   = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchIngredientes(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return q ? lista.filter((i) => i.nome.toLowerCase().includes(q)) : lista;
  }, [lista, busca]);

  const mediaCompra = lista.length ? lista.reduce((a, i) => a + (Number(i.preco_compra) || 0), 0) / lista.length : 0;

  async function salvar(dados) {
    if (editar) await atualizarIngrediente(editar.id, dados);
    else await inserirIngrediente(dados, unidadeAtiva);
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
    carregar();
  }
  async function remover(id) {
    await removerIngrediente(id);
    setLista((p) => p.filter((i) => i.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Ingredientes" subtitle="Catálogo e custo de insumos" icon={FlaskConical}
        onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo" />
      <PageBody>
        <Toast show={salvou}>Ingrediente salvo!</Toast>

        <KpiGrid>
          <Kpi icon={FlaskConical} label="Ingredientes" value={lista.length} tint="var(--accent-fg)" />
          <Kpi icon={Package} label="Custo médio de compra" value={fmtBRL(mediaCompra)} tint="#3B82F6" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar ingrediente..." />

        <div>
          <SectionLabel>{filtrados.length} ingrediente{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={FlaskConical} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={FlaskConical} title={busca ? "Nenhum ingrediente encontrado" : "Nenhum ingrediente cadastrado"}
              hint={busca ? "Tente outro termo" : "Toque em Novo para começar o catálogo"} />
          ) : (
            <div className="space-y-2">
              {filtrados.map((i) => {
                const Icon = ICONE_UN[i.unidade] || Package;
                const un = getUnidade(i.unidade);
                const base = i.custo_por_unidade_base ?? calcCustoUnitario(i.preco_compra, i.unidade);
                return (
                  <Card key={i.id} className="!p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--elevated)" }}>
                        <Icon size={17} style={{ color: "var(--muted)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{i.nome}</p>
                          <span className="erp-badge" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{un.label}</span>
                        </div>
                        <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--dim)" }}>
                          Compra: {fmtBRL(i.preco_compra)} · <span style={{ color: "var(--accent-fg)" }}>{fmtBRL(base, base < 0.01 ? 4 : 2)} {un.label_base}</span>
                        </p>
                      </div>
                      <button onClick={() => { setEditar(i); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => remover(i.id)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={14} /></button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar ingrediente" : "Novo ingrediente"}>
        <FormIngrediente inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
