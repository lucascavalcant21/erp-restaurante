"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Users, Wallet, MapPin, Edit3, Trash2, CheckCircle } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchEventos, inserirEvento, atualizarEvento, removerEvento } from "../../../lib/eventos";

const TIPOS  = ["Casamento", "Aniversário", "Corporativo", "Formatura", "Confraternização", "Outro"];
const STATUS = ["Pendente", "Confirmado", "Concluído", "Cancelado"];
const STATUS_STYLE = {
  Pendente:   "erp-badge-warn",
  Confirmado: "erp-badge-ok",
  Concluído:  "erp-badge-ok",
  Cancelado:  "erp-badge-danger",
};
const VAZIO = { nome: "", tipo: "Casamento", status: "Pendente", data: "", local: "", responsavel: "", convidados: "", valor_contrato: "", custo_estimado: "", observacoes: "" };

function FormEvento({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial
    ? { ...inicial, convidados: String(inicial.convidados ?? ""), valor_contrato: String(inicial.valor_contrato ?? ""), custo_estimado: String(inicial.custo_estimado ?? "") }
    : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do evento.");
    if (!f.data) return setErro("Informe a data do evento.");
    onSalvar({
      ...f, nome: f.nome.trim(),
      convidados: Number(f.convidados) || 0,
      valor_contrato: Number(f.valor_contrato) || 0,
      custo_estimado: Number(f.custo_estimado) || 0,
    });
  }

  return (
    <>
      <Field label="Nome do evento"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Casamento Silva & Costa" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data e hora"><TextInput type="datetime-local" value={f.data} onChange={(e) => set("data", e.target.value)} /></Field>
        <Field label="Convidados"><NumberInput value={f.convidados} onChange={(e) => set("convidados", e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label="Local"><TextInput value={f.local} onChange={(e) => set("local", e.target.value)} placeholder="ex: Salão Villa Bella" /></Field>
      <Field label="Responsável"><TextInput value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Nome do responsável" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor do contrato (R$)"><NumberInput value={f.valor_contrato} onChange={(e) => set("valor_contrato", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Custo estimado (R$)"><NumberInput value={f.custo_estimado} onChange={(e) => set("custo_estimado", e.target.value)} placeholder="0,00" step="0.01" /></Field>
      </div>
      <Field label="Observações"><TextInput value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Detalhes do cardápio, equipe..." /></Field>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function EventosPage() {
  const { unidadeAtiva } = useERP();
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]     = useState("");
  const [st, setSt]           = useState("Todos");
  const [modal, setModal]     = useState(false);
  const [editar, setEditar]   = useState(null);
  const [salvou, setSalvou]   = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchEventos(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const confirmados = lista.filter((e) => e.status === "Confirmado").length;
    const receita = lista.filter((e) => e.status !== "Cancelado").reduce((a, e) => a + (Number(e.valor_contrato) || 0), 0);
    const convidados = lista.filter((e) => e.status !== "Cancelado").reduce((a, e) => a + (Number(e.convidados) || 0), 0);
    return { total: lista.length, confirmados, receita, convidados };
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((e) => {
    const mb = e.nome?.toLowerCase().includes(busca.toLowerCase()) || (e.local || "").toLowerCase().includes(busca.toLowerCase());
    const ms = st === "Todos" || e.status === st;
    return mb && ms;
  }).sort((a, b) => String(a.data).localeCompare(String(b.data))), [lista, busca, st]);

  async function salvar(dados) {
    if (editar) await atualizarEvento(editar.id, dados);
    else await inserirEvento(dados, unidadeAtiva);
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
    carregar();
  }
  async function remover(id) {
    await removerEvento(id);
    setLista((p) => p.filter((e) => e.id !== id));
  }

  function fmtDataHora(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Eventos" subtitle="Gestão de eventos e contratos" icon={Calendar}
        onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo" />
      <PageBody>
        <Toast show={salvou}>Evento salvo!</Toast>

        <KpiGrid>
          <Kpi icon={Calendar} label="Eventos" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={CheckCircle} label="Confirmados" value={resumo.confirmados} tint="#10B981" />
          <Kpi icon={Wallet} label="Receita prevista" value={fmtBRL(resumo.receita)} tint="#3B82F6" />
          <Kpi icon={Users} label="Convidados" value={resumo.convidados} tint="#F59E0B" />
        </KpiGrid>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar evento..." />
          <Chips options={["Todos", ...STATUS]} value={st} onChange={setSt} />
        </div>

        <div>
          <SectionLabel>{filtrados.length} evento{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Calendar} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Calendar} title={busca || st !== "Todos" ? "Nenhum evento encontrado" : "Nenhum evento agendado"}
              hint={busca || st !== "Todos" ? "Ajuste a busca ou o filtro" : "Toque em Novo para agendar um evento"} />
          ) : (
            <div className="space-y-3">
              {filtrados.map((e) => {
                const margem = (Number(e.valor_contrato) || 0) - (Number(e.custo_estimado) || 0);
                return (
                  <Card key={e.id}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>{e.tipo}</span>
                          <span className={`erp-badge ${STATUS_STYLE[e.status] || ""}`}>{e.status}</span>
                        </div>
                        <p className="text-base font-bold truncate" style={{ color: "var(--fg)" }}>{e.nome}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(e.valor_contrato)}</p>
                        <p className="text-[11px]" style={{ color: margem >= 0 ? "var(--accent-fg)" : "#DC2626" }}>lucro {fmtBRL(margem)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] mb-3" style={{ color: "var(--subtle)" }}>
                      <span className="flex items-center gap-1"><Calendar size={11} />{fmtDataHora(e.data)}</span>
                      {e.local && <span className="flex items-center gap-1"><MapPin size={11} />{e.local}</span>}
                      {!!e.convidados && <span className="flex items-center gap-1"><Users size={11} />{e.convidados}</span>}
                    </div>
                    <div className="flex gap-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                      <button onClick={() => { setEditar(e); setModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg" style={{ background: "var(--elevated)", color: "var(--muted)" }}><Edit3 size={13} /> Editar</button>
                      <button onClick={() => remover(e.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg erp-badge-danger"><Trash2 size={13} /> Remover</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar evento" : "Novo evento"}>
        <FormEvento inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
