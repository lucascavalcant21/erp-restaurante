"use client";

import { useState, useEffect, useMemo } from "react";
import { UserCheck, Wallet, ShoppingBag, Phone, Edit3 } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, EmptyState, Modal, Field, TextInput, NumberInput, Btn, Toast, fmtBRL, fmtData,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchClientes, inserirCliente, atualizarCliente } from "../../../lib/clientes";

const VAZIO = { nome: "", tel: "", total_gasto: "", total_pedidos: "", ultima_compra: "" };

function FormCliente({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial
    ? { ...inicial, total_gasto: String(inicial.total_gasto ?? ""), total_pedidos: String(inicial.total_pedidos ?? "") }
    : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do cliente.");
    onSalvar({ ...f, nome: f.nome.trim(), total_gasto: Number(f.total_gasto) || 0, total_pedidos: Number(f.total_pedidos) || 0 });
  }
  return (
    <>
      <Field label="Nome"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Maria Oliveira" /></Field>
      <Field label="Telefone / WhatsApp"><TextInput value={f.tel} onChange={(e) => set("tel", e.target.value)} placeholder="(31) 9..." /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total gasto (R$)"><NumberInput value={f.total_gasto} onChange={(e) => set("total_gasto", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Nº de pedidos"><NumberInput value={f.total_pedidos} onChange={(e) => set("total_pedidos", e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Última compra"><TextInput type="date" value={f.ultima_compra || ""} onChange={(e) => set("ultima_compra", e.target.value)} /></Field>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function CrmPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchClientes(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const gasto = lista.reduce((a, c) => a + (Number(c.total_gasto) || 0), 0);
    const pedidos = lista.reduce((a, c) => a + (Number(c.total_pedidos) || 0), 0);
    return { total: lista.length, gasto, ticket: pedidos ? gasto / pedidos : 0 };
  }, [lista]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return q ? lista.filter((c) => c.nome?.toLowerCase().includes(q) || (c.tel || "").includes(q)) : lista;
  }, [lista, busca]);

  async function salvar(dados) {
    if (editar) await atualizarCliente(editar.id, dados);
    else await inserirCliente(dados, unidadeAtiva);
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
    carregar();
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="CRM" subtitle={`Base de clientes · ${unidadeInfo.nome}`} icon={UserCheck}
        onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo" />
      <PageBody>
        <Toast show={salvou}>Cliente salvo!</Toast>

        <KpiGrid>
          <Kpi icon={UserCheck} label="Clientes" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={ShoppingBag} label="Ticket médio" value={fmtBRL(resumo.ticket)} tint="#3B82F6" />
        </KpiGrid>
        <Card className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--muted)" }}><Wallet size={16} /> Receita total da base</span>
          <span className="text-xl font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(resumo.gasto)}</span>
        </Card>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar cliente..." />

        <div>
          <SectionLabel>{filtrados.length} cliente{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={UserCheck} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={UserCheck} title={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              hint={busca ? "Tente outro termo" : "Toque em Novo para começar sua base de clientes"} />
          ) : (
            <div className="space-y-2">
              {filtrados.sort((a, b) => (Number(b.total_gasto) || 0) - (Number(a.total_gasto) || 0)).map((c) => (
                <Card key={c.id} className="!p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>{c.nome?.[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{c.nome}</p>
                      <p className="text-[11px] flex items-center gap-2" style={{ color: "var(--dim)" }}>
                        {c.tel && <span className="flex items-center gap-1"><Phone size={11} />{c.tel}</span>}
                        {!!c.total_pedidos && <span>{c.total_pedidos} pedidos</span>}
                        {c.ultima_compra && <span>· {fmtData(c.ultima_compra)}</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(c.total_gasto)}</p>
                    </div>
                    <button onClick={() => { setEditar(c); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar cliente" : "Novo cliente"}>
        <FormCliente inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
