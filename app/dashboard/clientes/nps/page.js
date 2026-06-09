"use client";

import { useState, useEffect, useMemo } from "react";
import { Star, Smile, Meh, Frown } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtData,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchAvaliacoes, inserirAvaliacao } from "../../../lib/clientes";

function categoria(nota) {
  if (nota >= 9) return { tipo: "Promotor", Icon: Smile, cor: "#10B981" };
  if (nota >= 7) return { tipo: "Neutro", Icon: Meh, cor: "#F59E0B" };
  return { tipo: "Detrator", Icon: Frown, cor: "#EF4444" };
}

function FormAvaliacao({ onSalvar, onCancelar }) {
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState("10");
  const [comentario, setComentario] = useState("");
  return (
    <>
      <Field label="Cliente"><TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" /></Field>
      <Field label="Nota (0 a 10)"><Select value={nota} onChange={(e) => setNota(e.target.value)}>{[10,9,8,7,6,5,4,3,2,1,0].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
      <Field label="Comentário (opcional)"><TextInput value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="O que o cliente achou?" /></Field>
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={() => onSalvar({ nome: nome.trim() || "Anônimo", nota: Number(nota), comentario: comentario.trim(), data: new Date().toISOString().slice(0, 10) })}>Registrar</Btn>
      </div>
    </>
  );
}

export default function NpsPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [salvou, setSalvou] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchAvaliacoes(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const n = lista.length;
    if (!n) return { nps: 0, media: 0, total: 0 };
    const prom = lista.filter((a) => a.nota >= 9).length;
    const detr = lista.filter((a) => a.nota <= 6).length;
    const media = lista.reduce((a, x) => a + (Number(x.nota) || 0), 0) / n;
    return { nps: Math.round(((prom - detr) / n) * 100), media, total: n };
  }, [lista]);

  async function salvar(dados) {
    const { data } = await inserirAvaliacao(dados, unidadeAtiva);
    setLista((p) => [data || dados, ...p]);
    setModal(false);
    setSalvou(true); setTimeout(() => setSalvou(false), 2000);
  }

  const npsColor = resumo.nps >= 50 ? "#10B981" : resumo.nps >= 0 ? "#F59E0B" : "#EF4444";

  return (
    <div className="min-h-screen">
      <PageHeader title="Avaliações" subtitle={`Satisfação (NPS) · ${unidadeInfo.nome}`} icon={Star}
        onAction={() => setModal(true)} actionLabel="Nova" />
      <PageBody>
        <Toast show={salvou}>Avaliação registrada!</Toast>

        <Card className="text-center">
          <p className="erp-label">Net Promoter Score</p>
          <p className="text-5xl font-bold mt-1" style={{ color: npsColor }}>{resumo.nps}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--dim)" }}>{resumo.total} avaliações · média {resumo.media.toFixed(1)}/10</p>
        </Card>

        <div>
          <SectionLabel>Avaliações recentes</SectionLabel>
          {loading ? (
            <EmptyState icon={Star} title="Carregando..." />
          ) : lista.length === 0 ? (
            <EmptyState icon={Star} title="Nenhuma avaliação" hint="Toque em Nova para registrar a satisfação dos clientes." />
          ) : (
            <div className="space-y-2">
              {lista.map((a) => {
                const c = categoria(a.nota);
                return (
                  <Card key={a.id} className="!p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.cor + "22" }}>
                        <c.Icon size={18} style={{ color: c.cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{a.nome}</p>
                          <span className="erp-badge" style={{ background: c.cor + "22", color: c.cor }}>{c.tipo}</span>
                        </div>
                        {a.comentario && <p className="text-[11px] mt-0.5" style={{ color: "var(--subtle)" }}>“{a.comentario}”</p>}
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--dim)" }}>{fmtData(a.data)}</p>
                      </div>
                      <span className="text-xl font-bold flex-shrink-0" style={{ color: c.cor }}>{a.nota}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title="Nova avaliação">
        <FormAvaliacao onSalvar={salvar} onCancelar={() => setModal(false)} />
      </Modal>
    </div>
  );
}
