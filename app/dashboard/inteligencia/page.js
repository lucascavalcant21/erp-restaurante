"use client";

// CENTRAL DE INTELIGÊNCIA — a tela orientada a decisão do Héfisto.
// Não é um painel de gráficos: é o que precisa de atenção hoje, com a
// evidência de cada alerta, e a conversa para aprofundar ou agir.
// Tudo vem de /api/intelligence/* (dados reais da unidade validada no servidor).
//
// Camadas: a lógica (rede, cancelamento, erros, listas derivadas) mora em
// useCentralInteligencia; aqui só fica a apresentação.

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { RefreshCw, Loader2, ShieldCheck, ChevronDown, History, Settings, ArrowLeft } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { MetricaCartao, SeloCobertura } from "../../components/intelligence/Blocos";
import InsightCartao from "../../components/intelligence/InsightCartao";
import ConversaHefisto from "../../components/intelligence/ConversaHefisto";
import PerguntaCartao from "../../components/intelligence/PerguntaCartao";
import BannerErroRede from "../../components/intelligence/BannerErroRede";
import { SecaoInteligencia as Secao, EsqueletoInteligencia } from "../../components/intelligence/SecaoInteligencia";
import { useCentralInteligencia } from "../../components/intelligence/useCentralInteligencia";

const FMT_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const hora = (iso) => (iso ? FMT_HORA.format(new Date(iso)) : "");

const ROTULO_BLOCO = {
  faturamento: "Faturamento", compras: "Compras", variacao_preco: "Preços de compra", vencimentos: "Validades",
  divergencias_estoque: "Divergências de estoque", abaixo_minimo: "Estoque mínimo", perdas: "Perdas", contas_pagar: "Contas a pagar",
  cmv: "CMV", cmo: "CMO", ticket_medio: "Ticket médio",
};

const BOTAO_SECUNDARIO = "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border-strong bg-hf-surface px-3.5 text-[13px] font-bold text-hf-text shadow-xs transition hover:-translate-y-px hover:border-hf-accent hover:text-hf-accent disabled:opacity-50 disabled:hover:translate-y-0";

export default function CentralDeInteligencia() {
  const { unidadeAtiva, unidadeInfo } = useERP() || {};
  const c = useCentralInteligencia(unidadeAtiva);
  const conversa = useRef(null);
  const chatRef = useRef(null);

  const perguntar = useCallback((texto) => {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    conversa.current?.enviar(texto);
  }, []);

  // Pergunta vinda da busca (Ctrl+K) quando já se está na Central: vai para a conversa daqui
  useEffect(() => {
    const aoPerguntar = (e) => { const t = e?.detail?.texto; if (t) perguntar(t); };
    window.addEventListener("hefisto:perguntar", aoPerguntar);
    return () => window.removeEventListener("hefisto:perguntar", aoPerguntar);
  }, [perguntar]);

  const { brief } = c;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pt-8">
      <header className="mb-6 hf-animate-in">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-hf-accent">
          <button onClick={() => window.history.back()} className="flex min-h-[32px] items-center gap-1 rounded-lg transition-colors hover:text-emerald-900">
            <ArrowLeft size={14} /> Voltar
          </button>
          <span>· Héfisto</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight text-hf-text sm:text-3xl">Central de Inteligência</h1>
          {!c.semUnidade && (
            <div className="flex gap-2">
              <Link href="/dashboard/inteligencia/configuracoes" aria-label="Configurações da inteligência" className={BOTAO_SECUNDARIO}>
                <Settings size={16} /> <span className="hidden sm:inline">Configurações</span>
              </Link>
              <button type="button" onClick={c.carregar} disabled={c.carregando} className={BOTAO_SECUNDARIO}>
                {c.carregando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {c.carregando ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          )}
        </div>
        {brief && <p className="mt-2 max-w-3xl text-[16px] leading-snug text-hf-text-2">{brief.summary}</p>}
        {brief && (
          <p className="mt-1 text-[12px] font-medium text-hf-muted">
            {unidadeInfo?.nome || brief.escopo?.unidadeId} · apurado às {hora(brief.geradoEm)}
            {brief.auditoriaPersistente === false ? " · auditoria não persistida neste servidor" : ""}
          </p>
        )}
      </header>

      {c.semUnidade ? (
        <div className="rounded-2xl border border-hf-border bg-hf-surface p-5 text-[15px] text-hf-text-2">
          Selecione uma unidade para abrir a Central. A inteligência analisa uma unidade por vez e nunca mistura dados de empresas diferentes.
        </div>
      ) : c.erro && !brief ? (
        <BannerErroRede mensagem={c.erro} codigo={c.codigoErro} onTentarNovamente={c.carregar} carregando={c.carregando} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),420px] lg:items-start">
          <div className="min-w-0 space-y-8">
            {/* Dados antigos continuam na tela; a falha da atualização aparece por cima, com nova tentativa */}
            {c.erro && brief && (
              <BannerErroRede compacto mensagem={`Não consegui atualizar: ${c.erro}`} codigo={c.codigoErro} onTentarNovamente={c.carregar} carregando={c.carregando} />
            )}
            {c.erroAcao && <BannerErroRede compacto mensagem={c.erroAcao} onFechar={c.limparErroAcao} />}

            {!brief ? <EsqueletoInteligencia /> : (
              <>
                <Secao titulo="Resumo de hoje">
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {brief.metrics.map((x) => <MetricaCartao key={x.id} rotulo={x.rotulo} m={x.metrica} compacto />)}
                  </div>
                </Secao>

                <Secao titulo="Precisa da sua atenção" contador={c.atencao.length}>
                  {c.atencao.length ? (
                    <div className="space-y-3">
                      {c.atencaoVisivel.map((i) => (
                        <InsightCartao key={i.id} insight={i} onComando={perguntar} onResponder={c.responder} onDispensar={c.dispensar} semPergunta={c.idsComPergunta.has(i.id)} />
                      ))}
                      {c.atencao.length > c.limite && (
                        <button type="button" onClick={() => c.setVerTodos((v) => !v)} className={BOTAO_SECUNDARIO}>
                          {c.verTodos ? "Mostrar só os mais importantes" : `Ver todos (${c.atencao.length})`}
                          <ChevronDown size={15} className={`transition-transform duration-200 ${c.verTodos ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 rounded-2xl border border-hf-border bg-hf-surface p-4 text-[14px] text-hf-text-2">
                      <ShieldCheck size={18} className="text-hf-accent" /> Nada exige sua atenção nos dados disponíveis.
                    </p>
                  )}
                </Secao>

                {c.oportunidades.length > 0 && (
                  <Secao titulo="Oportunidades" contador={c.oportunidades.length}>
                    <div className="space-y-3">
                      {c.oportunidades.map((i) => (
                        <InsightCartao key={i.id} insight={i} onComando={perguntar} onResponder={c.responder} onDispensar={c.dispensar} semPergunta={c.idsComPergunta.has(i.id)} />
                      ))}
                    </div>
                  </Secao>
                )}

                {c.perguntas.length > 0 && (
                  <Secao titulo="Perguntas do Héfisto" contador={c.perguntas.length}>
                    <p className="-mt-1 text-[13px] text-hf-text-2">Só você sabe o que aconteceu. A resposta fica registrada e melhora as próximas análises — nada é alterado no estoque sem a sua confirmação.</p>
                    <div className="space-y-3">
                      {c.perguntas.slice(0, c.limite).map((q) => <PerguntaCartao key={q.id} pergunta={q} onResponder={c.responderPergunta} onComando={perguntar} />)}
                    </div>
                  </Secao>
                )}

                {c.informacoes.length > 0 && (
                  <section>
                    <button type="button" onClick={() => c.setVerInfo((v) => !v)} className="inline-flex min-h-[44px] items-center gap-2 text-[12px] font-black uppercase tracking-[0.14em] text-hf-text-2 hover:text-hf-text">
                      Informações <span className="rounded-full bg-hf-elevated px-2 py-0.5 text-[11px] text-hf-text">{c.informacoes.length}</span>
                      <ChevronDown size={15} className={`transition-transform duration-200 ${c.verInfo ? "rotate-180" : ""}`} />
                    </button>
                    {c.verInfo && (
                      <div className="mt-2 space-y-3">
                        {c.informacoes.map((i) => <InsightCartao key={i.id} insight={i} onComando={perguntar} onResponder={c.responder} onDispensar={c.dispensar} compacto />)}
                      </div>
                    )}
                  </section>
                )}

                <details className="group rounded-2xl border border-hf-border bg-hf-surface p-4">
                  <summary className="cursor-pointer text-[13px] font-bold text-hf-text">Sobre estes dados</summary>
                  <ul className="mt-3 divide-y divide-hf-border">
                    {brief.cobertura.map((b, i) => (
                      <li key={i} className="flex flex-wrap items-start justify-between gap-2 py-2 text-[13px]">
                        <span className="font-semibold text-hf-text">{ROTULO_BLOCO[b.metrica] || b.metrica}</span>
                        {b.status === "sem_permissao" ? <span className="text-hf-muted">sem permissão</span> : <SeloCobertura cobertura={b.cobertura} />}
                        {b.motivo && b.status !== "sem_permissao" && <span className="w-full text-[12px] text-hf-text-2">{b.motivo}</span>}
                      </li>
                    ))}
                  </ul>
                  {brief.preferencias?.alertasDesligadosOcultos > 0 && (
                    <p className="mt-3 text-[12px] text-hf-text-2">
                      {brief.preferencias.alertasDesligadosOcultos} alerta(s) não aparecem porque a categoria está desligada em{" "}
                      <Link href="/dashboard/inteligencia/configuracoes" className="font-semibold underline">Configurações</Link>.
                    </p>
                  )}
                  <p className="mt-3 text-[12px] text-hf-text-2">Alertas comparam a unidade com o próprio histórico (mesmo dia da semana, semanas anteriores, compras anteriores do produto). Nenhum número é estimado sem o selo ESTIMATIVA.</p>
                </details>
              </>
            )}
          </div>

          <aside ref={chatRef} className="space-y-6 lg:sticky lg:top-4">
            <Secao titulo="Pergunte ao Héfisto">
              <div className="rounded-3xl border border-hf-border bg-hf-elevated/70 p-3 shadow-sm sm:p-4">
                <ConversaHefisto ref={conversa} unidadeId={unidadeAtiva} tela={TELA_CENTRAL} />
              </div>
            </Secao>
            {c.historico.length > 0 && (
              <Secao titulo="Histórico recente">
                <ul className="space-y-1.5">
                  {c.historico.slice(0, 8).map((h) => (
                    <li key={h.id}>
                      <button type="button" onClick={() => h.comando && perguntar(h.comando)}
                        className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-hf-surface px-3 text-left text-[13px] text-hf-text transition hover:border-hf-border hover:shadow-xs">
                        <span className="flex min-w-0 items-center gap-2"><History size={14} className="shrink-0 text-hf-muted" /><span className="truncate">{h.comando || "—"}</span></span>
                        <span className="shrink-0 text-[11px] tabular-nums text-hf-muted">{hora(h.em)}</span>
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

// Objeto estável: antes era recriado a cada render e invalidava os callbacks da conversa.
const TELA_CENTRAL = Object.freeze({ rota: "/dashboard/inteligencia" });
