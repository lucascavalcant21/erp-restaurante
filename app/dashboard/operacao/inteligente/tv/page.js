"use client";

// MODO TV — painel para pendurar na parede da cozinha.
//
// Não é a Central Operacional em tela cheia. A Central é para quem está
// sentado, clicando e filtrando; aqui ninguém toca, ninguém está perto e a tela
// compete com o barulho da praça. Por isso: fonte grande, três blocos fixos na
// ordem em que importam (atrasado, agora, a seguir) e nenhum controle além do
// botão de tela cheia — que some sozinho depois de alguns segundos parado.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Maximize2, Minimize2, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { gerarExecucoesDoDia, fetchExecucoes, fetchNaoConformidades } from "../../../../lib/operacao-inteligente";
import { calcularScore, isoData } from "../../../../lib/operacao-agenda.mjs";
import { painelDoDia, linhaDaExecucao, LIMITE_POR_BLOCO } from "../../../../lib/operacao-tv.mjs";

// De quanto em quanto tempo busca no banco. Um minuto é o suficiente: quem
// conclui uma rotina não fica olhando para a parede esperando a tela mudar.
const INTERVALO_BUSCA_MS = 60000;
// O relógio e os status recalculam bem mais rápido que isso, de graça.
const INTERVALO_RELOGIO_MS = 10000;
const SUMIR_CONTROLES_MS = 6000;

export default function ModoTV() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [execucoes, setExecucoes] = useState([]);
  const [ncs, setNcs] = useState([]);
  const [agora, setAgora] = useState(() => new Date());
  const [online, setOnline] = useState(true);
  const [ultimaBusca, setUltimaBusca] = useState(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [controlesVisiveis, setControlesVisiveis] = useState(true);
  const sumirRef = useRef(null);

  const buscar = useCallback(async ({ gerar = false } = {}) => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const hoje = isoData(new Date());
    if (gerar) await gerarExecucoesDoDia(unidadeAtiva, hoje);
    const [exec, nc] = await Promise.all([
      fetchExecucoes(unidadeAtiva, { data: hoje }),
      fetchNaoConformidades(unidadeAtiva, { status: "ABERTA" }),
    ]);
    // Erro de rede não pode limpar a parede: melhor um número de um minuto
    // atrás do que uma tela vazia que parece "não há nada para fazer hoje".
    if (exec.error || nc.error) { setOnline(false); return; }
    setExecucoes(exec.data || []);
    setNcs(nc.data || []);
    setOnline(true);
    setUltimaBusca(new Date());
  }, [unidadeAtiva]);

  useEffect(() => { buscar({ gerar: true }); }, [buscar]);

  useEffect(() => {
    const t = setInterval(() => buscar(), INTERVALO_BUSCA_MS);
    return () => clearInterval(t);
  }, [buscar]);

  // O relógio anda sozinho, e com ele os status: uma rotina que vence às 15h
  // vira atraso na tela sem esperar a próxima busca no banco.
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), INTERVALO_RELOGIO_MS);
    return () => clearInterval(t);
  }, []);

  // Os controles somem quando ninguém mexe. Numa parede, um botão flutuante
  // aceso o tempo todo vira sujeira na imagem.
  useEffect(() => {
    const acordar = () => {
      setControlesVisiveis(true);
      clearTimeout(sumirRef.current);
      sumirRef.current = setTimeout(() => setControlesVisiveis(false), SUMIR_CONTROLES_MS);
    };
    acordar();
    window.addEventListener("mousemove", acordar);
    window.addEventListener("touchstart", acordar);
    window.addEventListener("keydown", acordar);
    return () => {
      clearTimeout(sumirRef.current);
      window.removeEventListener("mousemove", acordar);
      window.removeEventListener("touchstart", acordar);
      window.removeEventListener("keydown", acordar);
    };
  }, []);

  useEffect(() => {
    const mudou = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* navegador pode recusar sem gesto do usuário: não é erro de tela */ }
  }

  const painel = useMemo(() => painelDoDia(execucoes, ncs, agora), [execucoes, ncs, agora]);
  const score = useMemo(() => calcularScore({ execucoes: painel.todas }), [painel]);
  const { contadores } = painel;

  const relogio = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dataLonga = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="grid h-screen place-items-center bg-slate-950 p-10 text-center">
        <p className="text-3xl font-black text-slate-300">Escolha uma unidade para pendurar o painel.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Cabeçalho: hora grande, porque de longe é o que situa quem olha. */}
      <header className="flex shrink-0 items-center justify-between gap-6 border-b border-white/10 px-8 py-5">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">Operação do dia</h1>
          {/* first-letter, e não `capitalize`: este maiusculiza toda palavra e
              "domingo, 30 de agosto" virava "Domingo, 30 De Agosto". */}
          <p className="mt-0.5 text-sm font-bold text-slate-400 first-letter:uppercase sm:text-base">{dataLonga}</p>
        </div>
        <div className="flex items-center gap-6">
          {contadores.ncs > 0 && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-red-500/15 px-5 py-3">
              <ShieldAlert size={26} className="text-red-400" />
              <span className="text-2xl font-black text-red-300 sm:text-3xl">{contadores.ncs}</span>
              <span className="text-xs font-black uppercase tracking-wider text-red-300/80">
                não conformidade{contadores.ncs > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <p className="text-5xl font-black tabular-nums tracking-tight text-white sm:text-6xl">{relogio}</p>
        </div>
      </header>

      {/* Três colunas fixas. Não há aba nem rolagem: o que não coube vira "+N". */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-white/10 lg:grid-cols-3 lg:overflow-hidden">
        <Bloco titulo="Atrasado" tom="perigo" itens={painel.atrasadas}
          vazio="Nada atrasado." />
        <Bloco titulo="Acontecendo agora" tom="acao" itens={painel.emCurso}
          vazio="Nada em andamento." />
        <Bloco titulo="A seguir" tom="neutro" itens={painel.aSeguir}
          vazio="Nada mais para hoje." />
      </main>

      {/* Rodapé: o resumo do dia, que ninguém precisa ler correndo. */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-6 border-t border-white/10 px-8 py-4">
        <div className="flex items-center gap-8">
          <Numero rotulo="Concluídas" valor={`${contadores.concluidas}/${contadores.total}`} />
          <Numero rotulo="Do dia" valor={`${contadores.progresso}%`} destaque />
          {score.score != null && <Numero rotulo="Score" valor={score.score} destaque />}
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          {online ? <Wifi size={16} /> : <WifiOff size={16} className="text-amber-400" />}
          <span className="text-xs font-bold">
            {online
              ? `atualizado ${ultimaBusca ? ultimaBusca.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "agora"}`
              : "sem conexão — mostrando o último dado recebido"}
          </span>
        </div>
      </footer>

      <div className={`fixed right-6 top-6 z-10 flex gap-2 transition-opacity duration-500 ${controlesVisiveis ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button type="button" onClick={() => router.push("/dashboard/operacao/inteligente")}
          title="Voltar para a Central Operacional"
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white backdrop-blur hover:bg-white/20">
          <ArrowLeft size={20} />
        </button>
        <button type="button" onClick={alternarTelaCheia}
          title={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white backdrop-blur hover:bg-white/20">
          {telaCheia ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>
    </div>
  );
}

const TONS = {
  perigo: { titulo: "text-red-300", pinta: "bg-red-500/10", hora: "text-red-300", barra: "bg-red-400" },
  acao: { titulo: "text-emerald-300", pinta: "bg-emerald-500/10", hora: "text-emerald-300", barra: "bg-emerald-400" },
  neutro: { titulo: "text-slate-400", pinta: "bg-white/[0.03]", hora: "text-slate-300", barra: "bg-slate-400" },
};

function Bloco({ titulo, tom, itens, vazio }) {
  const t = TONS[tom] || TONS.neutro;
  const mostrar = itens.slice(0, LIMITE_POR_BLOCO);
  const sobra = itens.length - mostrar.length;

  return (
    <section className={`flex min-h-0 min-w-0 flex-col bg-slate-950 p-6 ${itens.length ? t.pinta : ""}`}>
      <h2 className={`mb-4 flex shrink-0 items-baseline gap-3 text-sm font-black uppercase tracking-[0.15em] ${t.titulo}`}>
        {titulo}
        <span className="text-2xl tabular-nums">{itens.length}</span>
      </h2>

      {itens.length === 0 ? (
        <p className="text-lg font-bold text-slate-600">{vazio}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
          {mostrar.map(execucao => {
            const l = linhaDaExecucao(execucao);
            return (
              <article key={l.id} className="rounded-2xl bg-white/[0.06] px-5 py-3.5">
                <div className="flex items-baseline gap-4">
                  <span className={`shrink-0 text-2xl font-black tabular-nums ${t.hora}`}>{l.hora}</span>
                  <span className="min-w-0 flex-1 truncate text-xl font-black text-white">{l.nome}</span>
                  {l.critica && (
                    <span className="shrink-0 rounded-lg bg-red-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-300">
                      crítico
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex min-w-0 items-center gap-3 text-sm font-bold text-slate-400">
                  {l.setor && <span className="shrink-0 capitalize">{l.setor}</span>}
                  {l.responsavel && <span className="truncate text-slate-300">{l.responsavel}</span>}
                </div>
                {l.progresso != null && l.progresso > 0 && (
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${t.barra}`} style={{ width: `${Math.min(100, l.progresso)}%` }} />
                  </div>
                )}
              </article>
            );
          })}
          {sobra > 0 && (
            <p className="pt-1 text-base font-black text-slate-500">e mais {sobra}</p>
          )}
        </div>
      )}
    </section>
  );
}

function Numero({ rotulo, valor, destaque = false }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{rotulo}</p>
      <p className={`text-3xl font-black tabular-nums ${destaque ? "text-emerald-400" : "text-white"}`}>{valor}</p>
    </div>
  );
}
