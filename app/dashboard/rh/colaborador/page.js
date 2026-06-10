"use client";

import { useState, useEffect } from "react";
import { Badge, DollarSign, FileText, Bell, AlertTriangle, ClipboardList, GraduationCap, Clock, ChevronDown, Download, PlayCircle } from "lucide-react";
import { PageHeader, PageBody, Card, EmptyState, fmtData, fmtBRL } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { lerSessao, getPapel } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";
import {
  buscarFuncionarioPorEmail, fetchHolerites, fetchDocumentos, fetchAvisos,
  fetchAdvertencias, fetchProducoes, fetchCursos,
} from "../../../lib/pessoas";

function Secao({ icon: Icon, titulo, badge, children, aberto = false }) {
  const [open, setOpen] = useState(aberto);
  return (
    <Card className="!p-0 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Icon size={15} style={{ color: "var(--muted)" }} /></div>
        <span className="flex-1 text-left text-sm font-bold" style={{ color: "var(--fg)" }}>{titulo}</span>
        {badge > 0 && <span className="erp-badge erp-badge-ok">{badge}</span>}
        <ChevronDown size={16} style={{ color: "var(--dim)", transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />
      </button>
      {open && <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>{children}</div>}
    </Card>
  );
}
const GRAV = { leve: "erp-badge-warn", media: "erp-badge-warn", grave: "erp-badge-danger" };

export default function ColaboradorPage() {
  const { unidadeInfo } = useERP();
  const [sessao, setSessao] = useState(null);
  const [func, setFunc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({ holerites: [], documentos: [], avisos: [], advertencias: [], producoes: [], cursos: [], ponto: [] });

  useEffect(() => {
    (async () => {
      const s = await lerSessao(); setSessao(s);
      const f = await buscarFuncionarioPorEmail(s?.email); setFunc(f);
      if (f) {
        const [holerites, documentos, avisos, advertencias, producoes, cursos] = await Promise.all([
          fetchHolerites(f.id), fetchDocumentos(f.id), fetchAvisos(f.id),
          fetchAdvertencias(f.id), fetchProducoes(f.id), fetchCursos(f.id),
        ]);
        let ponto = [];
        if (supabase) {
          const { data } = await supabase.from("registros_ponto").select("*").eq("func_id", f.id).order("data", { ascending: false }).limit(15);
          ponto = data || [];
        }
        setD({ holerites, documentos, avisos, advertencias, producoes, cursos, ponto });
      }
      setLoading(false);
    })();
  }, []);

  const papel = sessao ? getPapel(sessao.papel) : null;

  return (
    <div className="min-h-screen">
      <PageHeader title="Portal do Colaborador" subtitle="Seu espaço de autosserviço" icon={Badge} />
      <PageBody>
        {/* Cartão do colaborador */}
        <Card className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
            {(func?.nome || sessao?.nome)?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold truncate" style={{ color: "var(--fg)" }}>{func?.nome || sessao?.nome || "Colaborador"}</p>
            <p className="text-[11px]" style={{ color: "var(--dim)" }}>
              {func ? `${func.cargo || papel?.label} · ${func.turno || ""}` : papel?.label} · {unidadeInfo.nome}
            </p>
          </div>
        </Card>

        {loading ? (
          <EmptyState icon={Badge} title="Carregando seu portal..." />
        ) : !func ? (
          <EmptyState icon={Badge} title="Cadastro não vinculado"
            hint={`Seu acesso (${sessao?.email || ""}) ainda não foi associado a um funcionário. Peça ao RH para cadastrar você com este mesmo e-mail.`} />
        ) : (
          <>
            <Secao icon={Bell} titulo="Avisos e reuniões" badge={d.avisos.length} aberto>
              {d.avisos.length === 0 ? <EmptyState icon={Bell} title="Sem avisos" /> : (
                <div className="space-y-2">{d.avisos.map((a) => (
                  <div key={a.id} className="erp-panel p-3">
                    <div className="flex justify-between"><p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{a.titulo}</p>
                      <span className="text-[10px]" style={{ color: "var(--dim)" }}>{fmtData(a.data)}</span></div>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--subtle)" }}>{a.corpo}</p>
                  </div>))}</div>
              )}
            </Secao>

            <Secao icon={ClipboardList} titulo="Minhas produções" badge={d.producoes.filter(p=>p.status!=="feito").length}>
              {d.producoes.length === 0 ? <EmptyState icon={ClipboardList} title="Nenhuma produção atribuída" /> : (
                <div className="space-y-2">{d.producoes.map((p) => (
                  <div key={p.id} className="erp-panel p-3 flex items-center justify-between">
                    <div><p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{p.titulo}</p>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{p.periodo === "semana" ? "Semanal" : "Diária"} · {fmtData(p.data)}</p></div>
                    <span className={`erp-badge ${p.status === "feito" ? "erp-badge-ok" : "erp-badge-warn"}`}>{p.status}</span>
                  </div>))}</div>
              )}
            </Secao>

            <Secao icon={DollarSign} titulo="Meus holerites" badge={d.holerites.length}>
              {d.holerites.length === 0 ? <EmptyState icon={DollarSign} title="Nenhum holerite disponível" /> : (
                <div className="space-y-2">{d.holerites.map((h) => (
                  <div key={h.id} className="erp-panel p-3 flex items-center justify-between">
                    <div><p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{String(h.mes).padStart(2,"0")}/{h.ano}</p>
                      <p className="text-[11px]" style={{ color: "var(--accent-fg)" }}>Líquido {fmtBRL(h.liquido)}</p></div>
                    {h.arquivo_url && <a href={h.arquivo_url} target="_blank" rel="noreferrer" className="erp-badge erp-badge-ok flex items-center gap-1"><Download size={12} /> Baixar</a>}
                  </div>))}</div>
              )}
            </Secao>

            <Secao icon={FileText} titulo="Meus documentos" badge={d.documentos.length}>
              {d.documentos.length === 0 ? <EmptyState icon={FileText} title="Nenhum documento" /> : (
                <div className="space-y-2">{d.documentos.map((doc) => (
                  <div key={doc.id} className="erp-panel p-3 flex items-center justify-between">
                    <div><p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{doc.titulo}</p>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{doc.tipo}</p></div>
                    {doc.arquivo_url && <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="erp-badge erp-badge-ok flex items-center gap-1"><Download size={12} /> Abrir</a>}
                  </div>))}</div>
              )}
            </Secao>

            <Secao icon={GraduationCap} titulo="Cursos e treinamentos" badge={d.cursos.length}>
              {d.cursos.length === 0 ? <EmptyState icon={GraduationCap} title="Nenhum curso" /> : (
                <div className="space-y-2">{d.cursos.map((c) => (
                  <div key={c.id} className="erp-panel p-3 flex items-center justify-between">
                    <div><p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{c.titulo}</p>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{c.origem === "empresa" ? "Da empresa" : "Meu curso"} · {c.tipo_arquivo}</p></div>
                    {c.arquivo_url && <a href={c.arquivo_url} target="_blank" rel="noreferrer" className="erp-badge erp-badge-ok flex items-center gap-1">{c.tipo_arquivo === "video" ? <PlayCircle size={12} /> : <Download size={12} />} Acessar</a>}
                  </div>))}</div>
              )}
            </Secao>

            <Secao icon={AlertTriangle} titulo="Advertências" badge={d.advertencias.length}>
              {d.advertencias.length === 0 ? <EmptyState icon={AlertTriangle} title="Nenhuma advertência" hint="Tudo certo por aqui! 👍" /> : (
                <div className="space-y-2">{d.advertencias.map((a) => (
                  <div key={a.id} className="erp-panel p-3">
                    <div className="flex justify-between"><span className={`erp-badge ${GRAV[a.gravidade] || ""}`}>{a.gravidade}</span>
                      <span className="text-[10px]" style={{ color: "var(--dim)" }}>{fmtData(a.data)}</span></div>
                    <p className="text-sm font-bold mt-1" style={{ color: "var(--fg)" }}>{a.motivo}</p>
                    {a.descricao && <p className="text-[12px]" style={{ color: "var(--subtle)" }}>{a.descricao}</p>}
                  </div>))}</div>
              )}
            </Secao>

            <Secao icon={Clock} titulo="Meu histórico de ponto" badge={d.ponto.length}>
              {d.ponto.length === 0 ? <EmptyState icon={Clock} title="Sem registros de ponto" /> : (
                <div className="space-y-1">{d.ponto.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                    <span className="text-[12px] font-medium" style={{ color: "var(--fg-soft)" }}>{fmtData(r.data)}</span>
                    <span className="text-[12px]" style={{ color: "var(--dim)" }}>Entrada <b style={{ color: "var(--accent-fg)" }}>{r.entrada || "—"}</b> · Saída <b style={{ color: "#DC2626" }}>{r.saida || "—"}</b></span>
                  </div>))}</div>
              )}
            </Secao>
          </>
        )}
      </PageBody>
    </div>
  );
}
