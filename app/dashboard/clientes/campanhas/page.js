"use client";

import { useState, useEffect, useMemo } from "react";
import { Megaphone, Wallet, Target, Ticket, Trash2 } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtPct,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchCampanhas, inserirCampanha, atualizarStatusCampanha } from "../../../lib/clientes";

const TIPOS = ["Desconto", "VIP", "Reativação", "Tráfego Pago", "Fidelidade"];
const STATUS = ["ativa", "agendada", "encerrada"];
const STATUS_STYLE = { ativa: "erp-badge-ok", agendada: "erp-badge-warn", encerrada: "" };
const VAZIO = { nome: "", tipo: "Desconto", descricao: "", cupom: "", desconto: "", inicio: "", fim: "", meta_clientes: "", clientes_atingidos: 0, receita_gerada: 0, status: "agendada" };

function FormCampanha({ onSalvar, onCancelar }) {
  const [f, setF] = useState(VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };
  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome da campanha.");
    onSalvar({ ...f, nome: f.nome.trim(), desconto: Number(f.desconto) || 0, meta_clientes: Number(f.meta_clientes) || 0 });
  }
  return (
    <>
      <Field label="Nome da campanha"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Quinta do Suco" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <Field label="Descrição"><TextInput value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="O que a campanha oferece" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cupom"><TextInput value={f.cupom} onChange={(e) => set("cupom", e.target.value.toUpperCase())} placeholder="EX: SUCO30" /></Field>
        <Field label="Desconto (%)"><NumberInput value={f.desconto} onChange={(e) => set("desconto", e.target.value)} placeholder="0" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início"><TextInput type="date" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} /></Field>
        <Field label="Fim"><TextInput type="date" value={f.fim} onChange={(e) => set("fim", e.target.value)} /></Field>
      </div>
      <Field label="Meta de clientes"><NumberInput value={f.meta_clientes} onChange={(e) => set("meta_clientes", e.target.value)} placeholder="0" /></Field>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>Criar campanha</Btn>
      </div>
    </>
  );
}

export default function CampanhasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Todas");
  const [modal, setModal] = useState(false);
  const [salvou, setSalvou] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchCampanhas(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => ({
    ativas: lista.filter((c) => c.status === "ativa").length,
    receita: lista.reduce((a, c) => a + (Number(c.receita_gerada) || 0), 0),
    atingidos: lista.reduce((a, c) => a + (Number(c.clientes_atingidos) || 0), 0),
  }), [lista]);

  const filtrados = useMemo(() => filtro === "Todas" ? lista : lista.filter((c) => c.status === filtro), [lista, filtro]);

  async function salvar(dados) {
    const { data } = await inserirCampanha(dados, unidadeAtiva);
    setLista((p) => [data || dados, ...p]);
    setModal(false);
    setSalvou(true); setTimeout(() => setSalvou(false), 2000);
  }
  async function mudarStatus(c, status) {
    setLista((p) => p.map((x) => x.id === c.id ? { ...x, status } : x));
    await atualizarStatusCampanha(c.id, status);
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Tráfego Pago" subtitle={`Campanhas e promoções · ${unidadeInfo.nome}`} icon={Megaphone}
        onAction={() => setModal(true)} actionLabel="Nova" />
      <PageBody>
        <Toast show={salvou}>Campanha criada!</Toast>

        <KpiGrid>
          <Kpi icon={Megaphone} label="Campanhas ativas" value={resumo.ativas} tint="var(--accent-fg)" />
          <Kpi icon={Wallet} label="Receita gerada" value={fmtBRL(resumo.receita)} tint="#3B82F6" />
        </KpiGrid>

        <Chips options={["Todas", ...STATUS]} value={filtro} onChange={setFiltro} />

        <div>
          <SectionLabel>{filtrados.length} campanha{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Megaphone} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Megaphone} title="Nenhuma campanha" hint="Toque em Nova para criar uma promoção ou campanha de tráfego." />
          ) : (
            <div className="space-y-3">
              {filtrados.map((c) => {
                const meta = Number(c.meta_clientes) || 0;
                const at = Number(c.clientes_atingidos) || 0;
                const pct = meta ? Math.min((at / meta) * 100, 100) : 0;
                return (
                  <Card key={c.id}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>{c.tipo}</span>
                          <span className={`erp-badge ${STATUS_STYLE[c.status] || ""}`}>{c.status}</span>
                        </div>
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{c.nome}</p>
                        {c.cupom && <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "var(--accent-fg)" }}><Ticket size={11} />{c.cupom} · {c.desconto}%</p>}
                      </div>
                    </div>
                    {meta > 0 && (
                      <>
                        <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--elevated)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                        </div>
                        <div className="flex justify-between text-[10px] mb-2" style={{ color: "var(--dim)" }}>
                          <span className="flex items-center gap-1"><Target size={10} />{at}/{meta} clientes</span>
                          <span>{fmtPct(pct)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                      {c.status !== "ativa" && <button onClick={() => mudarStatus(c, "ativa")} className="flex-1 py-1.5 text-[11px] font-bold rounded-lg erp-badge-ok">Ativar</button>}
                      {c.status === "ativa" && <button onClick={() => mudarStatus(c, "encerrada")} className="flex-1 py-1.5 text-[11px] font-bold rounded-lg" style={{ background: "var(--elevated)", color: "var(--muted)" }}>Encerrar</button>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title="Nova campanha">
        <FormCampanha onSalvar={salvar} onCancelar={() => setModal(false)} />
      </Modal>
    </div>
  );
}
