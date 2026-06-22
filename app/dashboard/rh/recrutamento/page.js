"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Briefcase, MapPin, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { PageHeader, PageBody, Card, EmptyState, Modal, Btn, Toast, fmtData } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchCandidatos, atualizarStatusCandidato, removerCandidato } from "../../../lib/recrutamento";

export default function RecrutamentoPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Todos");
  const [toast, setToast] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchCandidatos(unidadeAtiva);
    setCandidatos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  const filtrados = candidatos.filter(c => filtro === "Todos" || c.status === filtro);

  const stats = {
    total: candidatos.length,
    aprovados: candidatos.filter(c => c.status === "Aprovado").length,
    reprovados: candidatos.filter(c => c.status === "Reprovado").length,
  };

  const mudarStatus = async (id, status) => {
    await atualizarStatusCandidato(id, status);
    setCandidatos(candidatos.map(c => c.id === id ? { ...c, status } : c));
    setToast(`Status alterado para ${status}`);
    setTimeout(() => setToast(""), 2000);
  };

  const remover = async (id) => {
    if (!confirm("Deseja apagar este candidato do banco de talentos?")) return;
    await removerCandidato(id);
    setCandidatos(candidatos.filter(c => c.id !== id));
  };

  const chamarZap = (telefone) => {
    const num = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${num}?text=Olá! Vimos seu cadastro no nosso banco de talentos para a vaga de restaurante.`, "_blank");
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 border-b px-4 pt-12 pb-3 flex items-center gap-3"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center erp-card">
          <ArrowLeft size={18} style={{ color: "var(--muted)" }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight flex items-center gap-2" style={{ color: "var(--fg)" }}>
            <Users size={18} style={{ color: "var(--muted)" }} /> Banco de Talentos
          </h1>
          <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>
            Triagem Automática · {unidadeInfo.nome}
          </p>
        </div>
      </div>

      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        {/* Status Pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
          {["Todos", "Aprovado", "Triagem", "Reprovado"].map(s => (
            <button key={s} onClick={() => setFiltro(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border ${
                filtro === s 
                  ? 'bg-slate-800 text-white border-slate-800' 
                  : 'bg-[var(--elevated)] text-[var(--fg)] border-[var(--line)] hover:border-slate-400'
              }`}>
              {s} {s === "Todos" ? `(${stats.total})` : s === "Aprovado" ? `(${stats.aprovados})` : s === "Reprovado" ? `(${stats.reprovados})` : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <EmptyState icon={Users} title="Carregando candidatos..." />
        ) : filtrados.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum candidato" hint="Compartilhe o link /vagas para receber cadastros" />
        ) : (
          <div className="space-y-3">
            {filtrados.map(c => (
              <Card key={c.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-base" style={{ color: "var(--fg)" }}>{c.nome}</h3>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{c.cargo_desejado}</p>
                  </div>
                  {c.status === "Aprovado" && <span className="erp-badge erp-badge-ok"><CheckCircle size={12}/> Aprovado</span>}
                  {c.status === "Reprovado" && <span className="erp-badge erp-badge-danger"><XCircle size={12}/> Reprovado</span>}
                  {c.status === "Triagem" && <span className="erp-badge erp-badge-warn"><Clock size={12}/> Triagem</span>}
                </div>

                <div className="bg-[var(--panel)] p-3 rounded-xl border border-[var(--line)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--dim)" }}><Briefcase size={14}/> Experiência</span>
                    <span className="font-bold" style={{ color: "var(--fg)" }}>{c.exp_anos || "Não informada"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--dim)" }}><Clock size={14}/> Fim de Semana/Noite</span>
                    <span className="font-bold" style={{ color: c.trabalha_fim_semana ? "#10B981" : "#DC2626" }}>
                      {c.trabalha_fim_semana ? "Sim" : "Não pode"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--dim)" }}><MapPin size={14}/> Mora Perto (1 Cond.)</span>
                    <span className="font-bold" style={{ color: "var(--fg)" }}>{c.mora_perto ? "Sim" : "Não"}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <Btn variant="primary" className="flex-1 !h-9 text-xs" onClick={() => chamarZap(c.telefone)}>
                    Chamar WhatsApp
                  </Btn>
                  
                  {c.status !== "Aprovado" && (
                    <button onClick={() => mudarStatus(c.id, "Aprovado")} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-800 hover:bg-emerald-200">
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {c.status !== "Reprovado" && (
                    <button onClick={() => mudarStatus(c.id, "Reprovado")} className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-emerald-600 hover:bg-slate-200">
                      <XCircle size={16} />
                    </button>
                  )}
                  <button onClick={() => remover(c.id)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--panel)] text-slate-500 hover:text-slate-600 border border-[var(--line)]">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
    </div>
  );
}
