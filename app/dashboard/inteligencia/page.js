"use client";

// CENTRAL DE INTELIGÊNCIA — a tela orientada a decisão do Héfisto.
// Não é um painel de gráficos: é o que precisa de atenção hoje, com a
// evidência de cada alerta, e a conversa para aprofundar ou agir.
// Tudo vem de /api/intelligence/* (dados reais da unidade validada no servidor).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Loader2, ShieldCheck, ChevronDown, History, Settings, ArrowLeft } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { buscarResumoDoDia, responderInsight, buscarHistorico } from "../../lib/intelligence/client/api";
import { MetricaCartao, SeloCobertura } from "../../components/intelligence/Blocos";
import InsightCartao from "../../components/intelligence/InsightCartao";
import ConversaHefisto from "../../components/intelligence/ConversaHefisto";
import PerguntaCartao from "../../components/intelligence/PerguntaCartao";

const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

const ROTULO_BLOCO = {
  faturamento: "Faturamento", compras: "Compras", variacao_preco: "Preços de compra", vencimentos: "Validades",
  divergencias_estoque: "Divergências de estoque", abaixo_minimo: "Estoque mínimo", perdas: "Perdas", contas_pagar: "Contas a pagar",
  cmv: "CMV", cmo: "CMO", ticket_medio: "Ticket médio",
};

function Secao({ titulo, contador, children, acao }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-slate-500">
          {titulo}{contador != null && <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">{contador}</span>}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Carregando">
      <div className="h-6 w-2/3 rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-200" />)}</div>
      <div className="h-40 rounded-2xl bg-slate-200" />
    </div>
  );
}

export default function CentralDeInteligencia() {
  const { unidadeAtiva, unidadeInfo } = useERP() || {};
  const [brief, setBrief] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [ocultos, setOcultos] = useState(() => new Set());
  const [historico, setHistorico] = useState([]);
  const [verInfo, setVerInfo] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const conversa = useRef(null);
  const chatRef = useRef(null);
  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";

  const carregar = useCallback(async () => {
    if (semUnidade) return;
    setCarregando(true); setErro(null);
    const ctl = new AbortController();
    const r = await buscarResumoDoDia(unidadeAtiva, ctl.signal);
    setCarregando(false);
    if (r.ok) { setBrief({ ...r.dados.brief, auditoriaPersistente: r.dados.auditoriaPersistente }); setOcultos(new Set()); } else setErro(r.dados?.erro || "Não foi possível carregar a Central agora.");
    const h = await buscarHistorico(unidadeAtiva);
    if (h.ok) setHistorico(h.dados.itens || []);
  }, [unidadeAtiva, semUnidade]);

  useEffect(() => { setBrief(null); carregar(); }, [carregar]);

  const perguntar = (texto) => {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    conversa.current?.enviar(texto);
  };

  // Pergunta vinda da busca (Ctrl+K) quando já se está na Central: vai para a conversa daqui
  useEffect(() => {
    const aoPerguntar = (e) => { const t = e?.detail?.texto; if (t) { chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); conversa.current?.enviar(t); } };
    window.addEventListener("hefisto:perguntar", aoPerguntar);
    return () => window.removeEventListener("hefisto:perguntar", aoPerguntar);
  }, []);

  async function responder(insight, opcao) {
    const r = await responderInsight(unidadeAtiva, { insightId: insight.id, insightTipo: insight.tipo, resposta: "opcao", opcao });
    return r.ok;
  }
  async function dispensar(insight) {
    const r = await responderInsight(unidadeAtiva, { insightId: insight.id, insightTipo: insight.tipo, resposta: "dispensar" });
    if (r.ok) setOcultos((s) => new Set([...s, insight.id]));
  }

  const visiveis = (xs) => (xs || []).filter((i) => !ocultos.has(i.id));
  // já vêm ordenados no servidor por criticidade × impacto × confiança
  const atencao = brief ? [...visiveis(brief.critical), ...visiveis(brief.warnings)] : [];
  const limite = brief?.destaques || 3;
  const atencaoVisivel = verTodos ? atencao : atencao.slice(0, limite);
  const perguntas = brief ? (brief.perguntasAbertas || []).filter((q) => !ocultos.has(q.insightId)) : [];
  const idsComPergunta = new Set(perguntas.map((q) => q.insightId));
  async function responderPergunta(q, opcao) {
    const r = await responderInsight(unidadeAtiva, { insightId: q.insightId, insightTipo: q.insightTipo, resposta: "opcao", opcao });
    return r.ok;
  }
  const oportunidades = brief ? visiveis(brief.opportunities) : [];
  const informacoes = brief ? visiveis(brief.information) : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pt-8">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 mb-1">
          <button onClick={() => window.history.back()} className="flex items-center gap-1 hover:text-emerald-900 transition-colors">
            <ArrowLeft size={14} />
            Voltar
          </button>
          <span>· Héfisto</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Central de Inteligência</h1>
          {!semUnidade && (
            <div className="flex gap-2">
              <Link href="/dashboard/inteligencia/configuracoes" aria-label="Configurações da inteligência"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 hover:border-slate-500">
                <Settings size={16} /> <span className="hidden sm:inline">Configurações</span>
              </Link>
              <button type="button" onClick={carregar} disabled={carregando}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 hover:border-slate-500 disabled:opacity-50">
                {carregando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Atualizar
              </button>
            </div>
          )}
        </div>
        {brief && (
          <p className="mt-2 max-w-3xl text-[16px] leading-snug text-slate-700">{brief.summary}</p>
        )}
        {brief && <p className="mt-1 text-[12px] text-slate-500">{unidadeInfo?.nome || brief.escopo.unidadeId} · apurado às {hora(brief.geradoEm)}{brief.auditoriaPersistente === false ? " · auditoria não persistida neste servidor" : ""}</p>}
      </header>

      {semUnidade ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-700">
          Selecione uma unidade para abrir a Central. A inteligência analisa uma unidade por vez e nunca mistura dados de empresas diferentes.
        </div>
      ) : erro && !brief ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[15px] text-amber-900">{erro}</div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),420px] lg:items-start">
          <div className="min-w-0 space-y-8">
            {!brief ? <Esqueleto /> : (
              <>
                <Secao titulo="Resumo de hoje">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {brief.metrics.map((x) => <MetricaCartao key={x.id} rotulo={x.rotulo} m={x.metrica} compacto />)}
                  </div>
                </Secao>

                <Secao titulo="Precisa da sua atenção" contador={atencao.length}>
                  {atencao.length ? (
                    <div className="space-y-3">
                      {atencaoVisivel.map((i) => <InsightCartao key={i.id} insight={i} onComando={perguntar} onResponder={responder} onDispensar={dispensar} semPergunta={idsComPergunta.has(i.id)} />)}
                      {atencao.length > limite && (
                        <button type="button" onClick={() => setVerTodos((v) => !v)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-700 hover:border-slate-500">
                          {verTodos ? "Mostrar só os mais importantes" : `Ver todos (${atencao.length})`}
                          <ChevronDown size={15} className={`transition-transform ${verTodos ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 rounded-2xl bg-white p-4 text-[14px] text-slate-600"><ShieldCheck size={18} className="text-emerald-600" /> Nada exige sua atenção nos dados disponíveis.</p>
                  )}
                </Secao>

                {oportunidades.length > 0 && (
                  <Secao titulo="Oportunidades" contador={oportunidades.length}>
                    <div className="space-y-3">{oportunidades.map((i) => <InsightCartao key={i.id} insight={i} onComando={perguntar} onResponder={responder} onDispensar={dispensar} semPergunta={idsComPergunta.has(i.id)} />)}</div>
                  </Secao>
                )}

                {perguntas.length > 0 && (
                  <Secao titulo="Perguntas do Héfisto" contador={perguntas.length}>
                    <p className="-mt-1 text-[13px] text-slate-600">Só você sabe o que aconteceu. A resposta fica registrada e melhora as próximas análises — nada é alterado no estoque sem a sua confirmação.</p>
                    <div className="space-y-3">{perguntas.slice(0, limite).map((q) => <PerguntaCartao key={q.id} pergunta={q} onResponder={responderPergunta} onComando={perguntar} />)}</div>
                  </Secao>
                )}

                {informacoes.length > 0 && (
                  <section>
                    <button type="button" onClick={() => setVerInfo((v) => !v)} className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Informações <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">{informacoes.length}</span>
                      <ChevronDown size={15} className={`transition-transform ${verInfo ? "rotate-180" : ""}`} />
                    </button>
                    {verInfo && <div className="mt-2 space-y-3">{informacoes.map((i) => <InsightCartao key={i.id} insight={i} onComando={perguntar} onResponder={responder} onDispensar={dispensar} compacto />)}</div>}
                  </section>
                )}

                <details className="rounded-2xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-[13px] font-bold text-slate-700">Sobre estes dados</summary>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {brief.cobertura.map((b, i) => (
                      <li key={i} className="flex flex-wrap items-start justify-between gap-2 py-2 text-[13px]">
                        <span className="font-semibold text-slate-800">{ROTULO_BLOCO[b.metrica] || b.metrica}</span>
                        {b.status === "sem_permissao" ? <span className="text-slate-500">sem permissão</span> : <SeloCobertura cobertura={b.cobertura} />}
                        {b.motivo && b.status !== "sem_permissao" && <span className="w-full text-[12px] text-slate-500">{b.motivo}</span>}
                      </li>
                    ))}
                  </ul>
                  {brief.preferencias?.alertasDesligadosOcultos > 0 && <p className="mt-3 text-[12px] text-slate-500">{brief.preferencias.alertasDesligadosOcultos} alerta(s) não aparecem porque a categoria está desligada em <Link href="/dashboard/inteligencia/configuracoes" className="font-semibold underline">Configurações</Link>.</p>}
                  <p className="mt-3 text-[12px] text-slate-500">Alertas comparam a unidade com o próprio histórico (mesmo dia da semana, semanas anteriores, compras anteriores do produto). Nenhum número é estimado sem o selo ESTIMATIVA.</p>
                </details>
              </>
            )}
          </div>

          <aside ref={chatRef} className="space-y-6 lg:sticky lg:top-4">
            <Secao titulo="Pergunte ao Héfisto">
              <div className="rounded-3xl border border-slate-200 bg-[#F7F8F7] p-3 sm:p-4">
                <ConversaHefisto ref={conversa} unidadeId={unidadeAtiva} tela={{ rota: "/dashboard/inteligencia" }} />
              </div>
            </Secao>
            {historico.length > 0 && (
              <Secao titulo="Histórico recente">
                <ul className="space-y-1">
                  {historico.slice(0, 8).map((h) => (
                    <li key={h.id}>
                      <button type="button" onClick={() => h.comando && perguntar(h.comando)} className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl bg-white px-3 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                        <span className="flex min-w-0 items-center gap-2"><History size={14} className="shrink-0 text-slate-400" /><span className="truncate">{h.comando || "—"}</span></span>
                        <span className="shrink-0 text-[11px] text-slate-400">{hora(h.em)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Secao>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
