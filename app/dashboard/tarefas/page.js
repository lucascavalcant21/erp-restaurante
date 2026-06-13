"use client";

import { useState, useEffect } from "react";
import { ListChecks, CheckCircle, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader, PageBody, Card, EmptyState, SectionLabel, Btn, Toast, fmtData } from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { fetchMinhasTarefas, responderTarefa } from "../../lib/tarefas";

export default function MinhasTarefasPage() {
  const { unidadeAtiva, sessao } = useERP();
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvou, setSalvou] = useState(false);
  const [executando, setExecutando] = useState(null); // Tarefa sendo preenchida
  const [respostas, setRespostas] = useState({});

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  async function carregar() {
    setLoading(true);
    const { data } = await fetchMinhasTarefas(unidadeAtiva);
    setTarefas(data || []);
    setLoading(false);
  }

  const pendentes = tarefas.filter(t => t.status === "pendente");
  const concluidas = tarefas.filter(t => t.status === "concluida");

  function iniciarExecucao(tarefa) {
    setRespostas({});
    setExecutando(tarefa);
  }

  async function finalizarTarefa() {
    if (!executando) return;
    const nome = sessao?.nome || "Funcionário";
    await responderTarefa(executando.id, respostas, nome);
    setExecutando(null);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 3000);
    carregar();
  }

  if (executando) {
    const tpl = executando.tarefas_templates;
    return (
      <div className="min-h-screen pb-20">
        <PageHeader title={tpl.titulo} subtitle="Execução de Tarefa" onBack={() => setExecutando(null)} />
        <PageBody>
          <div className="erp-card p-6 mb-6" style={{ background: "var(--panel)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>{tpl.descricao}</p>
          </div>

          <SectionLabel>Preencha os campos abaixo:</SectionLabel>
          <div className="space-y-4">
            {(tpl.campos || []).map((campo, i) => (
              <Card key={i} className="p-4">
                <p className="text-sm font-bold mb-3" style={{ color: "var(--fg)" }}>{campo.label}</p>
                {campo.tipo === "checkbox" && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-600 text-accent focus:ring-accent"
                      checked={respostas[campo.id] || false}
                      onChange={(e) => setRespostas(p => ({ ...p, [campo.id]: e.target.checked }))} />
                    <span className="text-sm font-medium" style={{ color: "var(--dim)" }}>Sim, confirmado.</span>
                  </label>
                )}
                {campo.tipo === "text" && (
                  <input type="text" className="erp-input w-full" placeholder="Sua resposta..."
                    value={respostas[campo.id] || ""}
                    onChange={(e) => setRespostas(p => ({ ...p, [campo.id]: e.target.value }))} />
                )}
                {campo.tipo === "number" && (
                  <input type="number" className="erp-input w-full" placeholder="0"
                    value={respostas[campo.id] || ""}
                    onChange={(e) => setRespostas(p => ({ ...p, [campo.id]: e.target.value }))} />
                )}
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <Btn variant="primary" className="w-full py-4 text-base" onClick={finalizarTarefa}>
              <CheckCircle size={20} className="mr-2" /> Finalizar e Enviar
            </Btn>
          </div>
        </PageBody>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Minhas Tarefas" subtitle="Atividades diárias enviadas pelo Cérebro" icon={ListChecks} />
      <PageBody>
        <Toast show={salvou}>Tarefa concluída com sucesso!</Toast>

        {loading ? (
          <EmptyState title="Carregando tarefas..." icon={Clock} />
        ) : (
          <div className="space-y-8">
            {/* Pendentes */}
            <div>
              <SectionLabel>Para Fazer ({pendentes.length})</SectionLabel>
              {pendentes.length === 0 ? (
                <EmptyState title="Tudo limpo!" hint="Você não tem tarefas pendentes hoje." icon={CheckCircle} />
              ) : (
                <div className="space-y-3">
                  {pendentes.map(t => (
                    <Card key={t.id} className="p-4 flex items-center gap-4 cursor-pointer hover:border-accent transition-colors" onClick={() => iniciarExecucao(t)}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,158,11,0.15)" }}>
                        <AlertTriangle size={24} color="#F59E0B" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-base" style={{ color: "var(--fg)" }}>{t.tarefas_templates?.titulo}</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>
                          Prazo: {t.prazo ? fmtData(t.prazo) : "Sem prazo definido"}
                        </p>
                      </div>
                      <ArrowRight size={20} style={{ color: "var(--muted)" }} />
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Concluídas */}
            {concluidas.length > 0 && (
              <div>
                <SectionLabel>Concluídas ({concluidas.length})</SectionLabel>
                <div className="space-y-3 opacity-70">
                  {concluidas.map(t => (
                    <Card key={t.id} className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.15)" }}>
                        <CheckCircle size={20} color="#10B981" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm line-through" style={{ color: "var(--fg)" }}>{t.tarefas_templates?.titulo}</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>
                          Feito por {t.funcionario_nome} em {fmtData(t.concluida_em)}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
