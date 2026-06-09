"use client";

import { useState, useEffect, useMemo } from "react";
import { Truck, Star, Phone, Mail, MapPin, Edit3, Trash2, CheckCircle, XCircle, Wallet } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchFornecedores, inserirFornecedor, atualizarFornecedor, removerFornecedor } from "../../../lib/fornecedores";

const SEGMENTOS = ["Carnes", "Grãos e Cereais", "Hortifruti", "Laticínios", "Bebidas", "Embalagens", "Limpeza", "Outros"];
const PAGAMENTOS = ["À Vista", "Boleto 7d", "Boleto 15d", "Boleto 30d", "Pix"];
const VAZIO = { nome: "", segmento: "Carnes", contato: "", telefone: "", email: "", cidade: "", forma_pagamento: "À Vista", pedido_minimo: "", estrelas: 5, ativo: true };

function FormFornecedor({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial || VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do fornecedor.");
    onSalvar({
      ...f,
      nome: f.nome.trim(),
      pedido_minimo: Number(f.pedido_minimo) || 0,
      estrelas: Number(f.estrelas) || 0,
    });
  }

  return (
    <>
      <Field label="Nome / Razão social"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Frigorífico São Paulo" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Segmento"><Select value={f.segmento} onChange={(e) => set("segmento", e.target.value)}>{SEGMENTOS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Pagamento"><Select value={f.forma_pagamento} onChange={(e) => set("forma_pagamento", e.target.value)}>{PAGAMENTOS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <Field label="Contato"><TextInput value={f.contato} onChange={(e) => set("contato", e.target.value)} placeholder="Nome do vendedor" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone"><TextInput value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 9..." /></Field>
        <Field label="Cidade"><TextInput value={f.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade, UF" /></Field>
      </div>
      <Field label="E-mail"><TextInput value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="vendas@fornecedor.com" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pedido mínimo (R$)"><NumberInput value={f.pedido_minimo} onChange={(e) => set("pedido_minimo", e.target.value)} placeholder="0" /></Field>
        <Field label="Avaliação (estrelas)"><Select value={f.estrelas} onChange={(e) => set("estrelas", e.target.value)}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} ★</option>)}</Select></Field>
      </div>
      <Field label="Situação">
        <Select value={f.ativo ? "1" : "0"} onChange={(e) => set("ativo", e.target.value === "1")}>
          <option value="1">Ativo</option><option value="0">Inativo</option>
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

function CardFornecedor({ f, onEditar, onRemover }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--elevated)" }}>
          <Truck size={18} style={{ color: "var(--muted)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{f.nome}</p>
            {!f.ativo && <span className="erp-badge" style={{ background: "var(--elevated)", color: "var(--subtle)" }}>Inativo</span>}
          </div>
          <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>{f.segmento}{f.contato ? ` · ${f.contato}` : ""}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px]" style={{ color: "var(--subtle)" }}>
            {f.telefone && <span className="flex items-center gap-1"><Phone size={11} />{f.telefone}</span>}
            {f.cidade && <span className="flex items-center gap-1"><MapPin size={11} />{f.cidade}</span>}
            {f.forma_pagamento && <span className="flex items-center gap-1"><Wallet size={11} />{f.forma_pagamento}</span>}
          </div>
          <div className="flex items-center gap-0.5 mt-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={12} style={{ color: i < (f.estrelas || 0) ? "#F59E0B" : "var(--faint)" }} fill={i < (f.estrelas || 0) ? "#F59E0B" : "none"} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <button onClick={() => onEditar(f)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg" style={{ color: "var(--muted)", background: "var(--elevated)" }}>
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onRemover(f.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg erp-badge-danger">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </Card>
  );
}

export default function FornecedoresPage() {
  const { unidadeAtiva } = useERP();
  const [lista, setLista]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busca, setBusca]       = useState("");
  const [seg, setSeg]           = useState("Todos");
  const [modal, setModal]       = useState(false);
  const [editar, setEditar]     = useState(null);
  const [salvou, setSalvou]     = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchFornecedores(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const ativos = lista.filter((f) => f.ativo).length;
    const compras = lista.reduce((a, f) => a + (Number(f.total_compras) || 0), 0);
    const estrelas = lista.length ? lista.reduce((a, f) => a + (Number(f.estrelas) || 0), 0) / lista.length : 0;
    return { total: lista.length, ativos, compras, estrelas };
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((f) => {
    const mb = f.nome?.toLowerCase().includes(busca.toLowerCase()) || (f.contato || "").toLowerCase().includes(busca.toLowerCase());
    const ms = seg === "Todos" || f.segmento === seg;
    return mb && ms;
  }), [lista, busca, seg]);

  async function salvar(dados) {
    if (editar) {
      await atualizarFornecedor(editar.id, dados);
    } else {
      await inserirFornecedor(dados, unidadeAtiva);
    }
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
    carregar();
  }
  async function remover(id) {
    await removerFornecedor(id);
    setLista((p) => p.filter((f) => f.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Fornecedores" subtitle="Parceiros de compra da unidade" icon={Truck}
        onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo" />
      <PageBody>
        <Toast show={salvou}>Fornecedor salvo!</Toast>

        <KpiGrid>
          <Kpi icon={Truck} label="Fornecedores" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={CheckCircle} label="Ativos" value={resumo.ativos} tint="#10B981" />
          <Kpi icon={Wallet} label="Total em compras" value={fmtBRL(resumo.compras)} tint="#3B82F6" />
          <Kpi icon={Star} label="Média de avaliação" value={`${resumo.estrelas.toFixed(1)} ★`} tint="#F59E0B" />
        </KpiGrid>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar fornecedor..." />
          <Chips options={["Todos", ...SEGMENTOS]} value={seg} onChange={setSeg} />
        </div>

        <div>
          <SectionLabel>{filtrados.length} fornecedor{filtrados.length !== 1 ? "es" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Truck} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Truck} title={busca || seg !== "Todos" ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
              hint={busca || seg !== "Todos" ? "Ajuste a busca ou o filtro" : "Toque em Novo para adicionar o primeiro"} />
          ) : (
            <div className="space-y-3">
              {filtrados.map((f) => <CardFornecedor key={f.id} f={f} onEditar={(x) => { setEditar(x); setModal(true); }} onRemover={remover} />)}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar fornecedor" : "Novo fornecedor"}>
        <FormFornecedor inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
