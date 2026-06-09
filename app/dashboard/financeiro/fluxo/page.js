"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowDownUp, ArrowUpCircle, ArrowDownCircle, Wallet, Trash2 } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchLancamentos, inserirLancamento, removerLancamento } from "../../../lib/financeiro";

const CAT_ENTRADA = ["Vendas Balcão", "iFood / Delivery", "Eventos", "Outras receitas"];
const CAT_SAIDA   = ["Fornecedores", "Folha de Pagamento", "Aluguel", "Energia", "Marketing", "Impostos", "Outras despesas"];

function FormLancamento({ onSalvar, onCancelar }) {
  const [tipo, setTipo] = useState("entrada");
  const [categoria, setCategoria] = useState(CAT_ENTRADA[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState("");
  const cats = tipo === "entrada" ? CAT_ENTRADA : CAT_SAIDA;

  function salvar() {
    if (!descricao.trim()) return setErro("Informe a descrição.");
    const v = parseFloat(String(valor).replace(",", ".")) || 0;
    if (v <= 0) return setErro("Informe um valor válido.");
    onSalvar({ tipo, categoria, descricao: descricao.trim(), valor: v, data });
  }

  return (
    <>
      <div className="flex gap-2 mb-3">
        {["entrada", "saida"].map((t) => (
          <button key={t} onClick={() => { setTipo(t); setCategoria((t === "entrada" ? CAT_ENTRADA : CAT_SAIDA)[0]); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={tipo === t
              ? { background: t === "entrada" ? "#10B981" : "#EF4444", color: "#fff" }
              : { background: "var(--elevated)", color: "var(--muted)" }}>
            {t === "entrada" ? "Entrada" : "Saída"}
          </button>
        ))}
      </div>
      <Field label="Categoria"><Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field label="Descrição"><TextInput value={descricao} onChange={(e) => { setDescricao(e.target.value); setErro(""); }} placeholder="ex: Vendas do dia" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)"><NumberInput value={valor} onChange={(e) => { setValor(e.target.value); setErro(""); }} placeholder="0,00" step="0.01" /></Field>
        <Field label="Data"><TextInput type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
      </div>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>Lançar</Btn>
      </div>
    </>
  );
}

export default function FluxoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Todos");
  const [modal, setModal] = useState(false);
  const [salvou, setSalvou] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchLancamentos(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const entradas = lista.filter((l) => l.tipo === "entrada").reduce((a, l) => a + (Number(l.valor) || 0), 0);
    const saidas   = lista.filter((l) => l.tipo === "saida").reduce((a, l) => a + (Number(l.valor) || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((l) =>
    filtro === "Todos" ? true : filtro === "Entradas" ? l.tipo === "entrada" : l.tipo === "saida"
  ), [lista, filtro]);

  async function salvar(dados) {
    const { data } = await inserirLancamento(dados, unidadeAtiva);
    setLista((p) => [data || dados, ...p]);
    setModal(false);
    setSalvou(true); setTimeout(() => setSalvou(false), 2000);
  }
  async function remover(id) {
    await removerLancamento(id);
    setLista((p) => p.filter((l) => l.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Fluxo de Caixa" subtitle={`Entradas e saídas · ${unidadeInfo.nome}`} icon={ArrowDownUp}
        onAction={() => setModal(true)} actionLabel="Lançar" />
      <PageBody>
        <Toast show={salvou}>Lançamento registrado!</Toast>

        <KpiGrid>
          <Kpi icon={ArrowUpCircle} label="Entradas" value={fmtBRL(resumo.entradas)} tint="#10B981" />
          <Kpi icon={ArrowDownCircle} label="Saídas" value={fmtBRL(resumo.saidas)} tint="#EF4444" />
        </KpiGrid>
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={18} style={{ color: resumo.saldo >= 0 ? "var(--accent-fg)" : "#FCA5A5" }} />
              <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>Saldo do período</span>
            </div>
            <span className="text-xl font-bold" style={{ color: resumo.saldo >= 0 ? "var(--accent-fg)" : "#FCA5A5" }}>{fmtBRL(resumo.saldo)}</span>
          </div>
        </Card>

        <Chips options={["Todos", "Entradas", "Saídas"]} value={filtro} onChange={setFiltro} />

        <div>
          <SectionLabel>{filtrados.length} lançamento{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={ArrowDownUp} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={ArrowDownUp} title="Nenhum lançamento" hint="Toque em Lançar para registrar entradas e saídas." />
          ) : (
            <div className="space-y-2">
              {filtrados.map((l) => {
                const ent = l.tipo === "entrada";
                return (
                  <Card key={l.id} className="!p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ent ? "var(--accent-soft)" : "var(--danger-soft)" }}>
                        {ent ? <ArrowUpCircle size={16} style={{ color: "#10B981" }} /> : <ArrowDownCircle size={16} style={{ color: "#EF4444" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{l.descricao}</p>
                        <p className="text-[11px]" style={{ color: "var(--dim)" }}>{l.categoria} · {fmtData(l.data)}</p>
                      </div>
                      <span className="text-sm font-bold" style={{ color: ent ? "var(--accent-fg)" : "#FCA5A5" }}>{ent ? "+" : "−"}{fmtBRL(l.valor)}</span>
                      <button onClick={() => remover(l.id)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={13} /></button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title="Novo lançamento">
        <FormLancamento onSalvar={salvar} onCancelar={() => setModal(false)} />
      </Modal>
    </div>
  );
}
