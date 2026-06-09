"use client";

import { useState, useEffect, useMemo } from "react";
import { FileText, Trash2, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchDocumentos, inserirDocumento, atualizarDocumento, removerDocumento } from "../../../lib/financeiro";

const TIPOS = ["Boleto", "Nota Fiscal", "Fatura", "Contrato", "Recibo"];
const CATS  = ["Fornecedor", "Aluguel", "Energia", "Folha", "Imposto", "Marketing", "Outros"];
const STATUS = ["Pendente", "Pago", "Vencido"];
const STATUS_STYLE = { Pago: "erp-badge-ok", Pendente: "erp-badge-warn", Vencido: "erp-badge-danger" };
const VAZIO = { tipo: "Boleto", descricao: "", categoria: "Fornecedor", valor: "", emissao: new Date().toISOString().slice(0, 10), vencimento: "", status: "Pendente" };

function FormDoc({ onSalvar, onCancelar }) {
  const [f, setF] = useState(VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  function salvar() {
    if (!f.descricao.trim()) return setErro("Informe a descrição.");
    const v = parseFloat(String(f.valor).replace(",", ".")) || 0;
    if (v <= 0) return setErro("Informe o valor.");
    if (!f.vencimento) return setErro("Informe o vencimento.");
    onSalvar({ ...f, descricao: f.descricao.trim(), valor: v });
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Categoria"><Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      </div>
      <Field label="Descrição"><TextInput value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="ex: Conta de energia" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)"><NumberInput value={f.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Emissão"><TextInput type="date" value={f.emissao} onChange={(e) => set("emissao", e.target.value)} /></Field>
        <Field label="Vencimento"><TextInput type="date" value={f.vencimento} onChange={(e) => set("vencimento", e.target.value)} /></Field>
      </div>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>Adicionar</Btn>
      </div>
    </>
  );
}

export default function DocumentosPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Todos");
  const [modal, setModal] = useState(false);
  const [salvou, setSalvou] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchDocumentos(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const pendente = lista.filter((d) => d.status === "Pendente").reduce((a, d) => a + (Number(d.valor) || 0), 0);
    const pago     = lista.filter((d) => d.status === "Pago").reduce((a, d) => a + (Number(d.valor) || 0), 0);
    const vencido  = lista.filter((d) => d.status === "Vencido").length;
    return { pendente, pago, vencido };
  }, [lista]);

  const filtrados = useMemo(() => filtro === "Todos" ? lista : lista.filter((d) => d.status === filtro), [lista, filtro]);

  async function salvar(dados) {
    const { data } = await inserirDocumento(dados, unidadeAtiva);
    setLista((p) => [...p, data || dados]);
    setModal(false);
    setSalvou(true); setTimeout(() => setSalvou(false), 2000);
  }
  async function marcarPago(d) {
    setLista((p) => p.map((x) => x.id === d.id ? { ...x, status: "Pago" } : x));
    await atualizarDocumento(d.id, { status: "Pago" });
  }
  async function remover(id) {
    await removerDocumento(id);
    setLista((p) => p.filter((d) => d.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Notas e Boletos" subtitle={`Contas e documentos · ${unidadeInfo.nome}`} icon={FileText}
        onAction={() => setModal(true)} actionLabel="Novo" />
      <PageBody>
        <Toast show={salvou}>Documento adicionado!</Toast>

        <KpiGrid>
          <Kpi icon={Clock} label="A pagar (pendente)" value={fmtBRL(resumo.pendente)} tint="#F59E0B" />
          <Kpi icon={CheckCircle} label="Pago" value={fmtBRL(resumo.pago)} tint="#10B981" />
        </KpiGrid>
        {resumo.vencido > 0 && (
          <Card className="flex items-center gap-3">
            <AlertTriangle size={18} style={{ color: "#EF4444" }} />
            <span className="text-sm font-bold" style={{ color: "#FCA5A5" }}>{resumo.vencido} documento(s) vencido(s)</span>
          </Card>
        )}

        <Chips options={["Todos", ...STATUS]} value={filtro} onChange={setFiltro} />

        <div>
          <SectionLabel>{filtrados.length} documento{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={FileText} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhum documento" hint="Toque em Novo para registrar notas, boletos e faturas." />
          ) : (
            <div className="space-y-2">
              {filtrados.map((d) => (
                <Card key={d.id} className="!p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>{d.tipo}</span>
                        <span className={`erp-badge ${STATUS_STYLE[d.status] || ""}`}>{d.status}</span>
                      </div>
                      <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{d.descricao}</p>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{d.categoria} · vence {fmtData(d.vencimento)}</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(d.valor)}</span>
                  </div>
                  <div className="flex gap-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                    {d.status !== "Pago" && (
                      <button onClick={() => marcarPago(d)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg erp-badge-ok"><CheckCircle size={13} /> Marcar pago</button>
                    )}
                    <button onClick={() => remover(d.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg erp-badge-danger"><Trash2 size={13} /> Remover</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title="Novo documento">
        <FormDoc onSalvar={salvar} onCancelar={() => setModal(false)} />
      </Modal>
    </div>
  );
}
