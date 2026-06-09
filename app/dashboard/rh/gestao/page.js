"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Users, Wallet, UserCheck, Edit3, Trash2, Phone, Settings2 } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchFuncionarios, inserirFuncionario, atualizarFuncionario, removerFuncionario } from "../../../lib/rh";

const CARGOS = ["Gerente", "Cozinheiro", "Auxiliar de Cozinha", "Atendente", "Caixa", "Entregador", "Limpeza", "Estoquista", "Outro"];
const TURNOS = ["Manhã (06-14h)", "Tarde (14-22h)", "Noite (22-06h)", "Integral (08-18h)", "Folguista"];
const VAZIO = { nome: "", cargo: "Atendente", turno: "Manhã (06-14h)", salario: "", admissao: "", telefone: "", email: "", ativo: true };

function FormFunc({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial ? { ...inicial, salario: String(inicial.salario ?? "") } : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    onSalvar({ ...f, nome: f.nome.trim(), salario: Number(f.salario) || 0 });
  }
  return (
    <>
      <Field label="Nome completo"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Ana Souza" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cargo"><Select value={f.cargo} onChange={(e) => set("cargo", e.target.value)}>{CARGOS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Turno"><Select value={f.turno} onChange={(e) => set("turno", e.target.value)}>{TURNOS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Salário (R$)"><NumberInput value={f.salario} onChange={(e) => set("salario", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Admissão"><TextInput type="date" value={f.admissao} onChange={(e) => set("admissao", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone"><TextInput value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 9..." /></Field>
        <Field label="Situação"><Select value={f.ativo ? "1" : "0"} onChange={(e) => set("ativo", e.target.value === "1")}><option value="1">Ativo</option><option value="0">Inativo</option></Select></Field>
      </div>
      <Field label="E-mail"><TextInput value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="email@..." /></Field>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function GestaoRhPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [cargo, setCargo] = useState("Todos");
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchFuncionarios(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const ativos = lista.filter((f) => f.ativo !== false);
    return { total: lista.length, ativos: ativos.length, folha: ativos.reduce((a, f) => a + (Number(f.salario) || 0), 0) };
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((f) => {
    const mb = f.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cargo === "Todos" || f.cargo === cargo;
    return mb && mc;
  }), [lista, busca, cargo]);

  async function salvar(dados) {
    if (editar) await atualizarFuncionario(editar.id, dados);
    else await inserirFuncionario(dados, unidadeAtiva);
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
    carregar();
  }
  async function remover(id) {
    await removerFuncionario(id);
    setLista((p) => p.filter((f) => f.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="RH" subtitle={`Equipe · ${unidadeInfo.nome}`} icon={Users}
        onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo" />
      <PageBody>
        <Toast show={salvou}>Colaborador salvo!</Toast>

        <KpiGrid>
          <Kpi icon={Users} label="Colaboradores" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={UserCheck} label="Ativos" value={resumo.ativos} tint="#10B981" />
        </KpiGrid>
        <Card className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--muted)" }}><Wallet size={16} /> Folha mensal</span>
          <span className="text-xl font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(resumo.folha)}</span>
        </Card>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar colaborador..." />
          <Chips options={["Todos", ...CARGOS]} value={cargo} onChange={setCargo} />
        </div>

        <div>
          <SectionLabel>{filtrados.length} colaborador{filtrados.length !== 1 ? "es" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Users} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Users} title={busca || cargo !== "Todos" ? "Nenhum colaborador encontrado" : "Nenhum colaborador cadastrado"}
              hint={busca || cargo !== "Todos" ? "Ajuste a busca ou o filtro" : "Toque em Novo para cadastrar a equipe"} />
          ) : (
            <div className="space-y-2">
              {filtrados.map((f) => (
                <Card key={f.id} className="!p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
                      {f.nome?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{f.nome}</p>
                        {f.ativo === false && <span className="erp-badge" style={{ background: "var(--elevated)", color: "var(--subtle)" }}>Inativo</span>}
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{f.cargo} · {f.turno}{f.salario ? ` · ${fmtBRL(f.salario)}` : ""}</p>
                    </div>
                    <button onClick={() => router.push(`/dashboard/rh/funcionario/${f.id}`)} title="Gerenciar (holerites, docs, avisos...)" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}><Settings2 size={14} style={{ color: "var(--accent-fg)" }} /></button>
                    <button onClick={() => { setEditar(f); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                    <button onClick={() => remover(f.id)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={14} /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar colaborador" : "Novo colaborador"}>
        <FormFunc inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
