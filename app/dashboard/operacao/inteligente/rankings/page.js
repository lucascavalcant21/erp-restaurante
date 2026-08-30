"use client";

// RANKINGS — como cada pessoa e cada setor vêm se saindo ao longo do tempo.
// A Central mostra o agregado de hoje; aqui é a série, que é onde aparece o
// que é padrão e o que foi só um dia ruim.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BarChart3, Loader2, Users, Building2, TrendingDown, AlertCircle, Printer,
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { fetchExecucoesPeriodo } from "../../../../lib/operacao-inteligente";
import { isoData } from "../../../../lib/operacao-agenda.mjs";
import {
  rankingPorPessoa, rankingPorSetor, serieDiaria, processosQueMaisFalham,
} from "../../../../lib/operacao-ranking.mjs";

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  return isoData(d);
}

// Verde é a única cor primária, então a escala de desempenho é a intensidade
// dela; vermelho fica reservado para o que está de fato mal.
function tomDoScore(score) {
  if (score == null) return "text-slate-400";
  if (score >= 90) return "text-emerald-700";
  if (score >= 75) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

export default function Rankings() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [execucoes, setExecucoes] = useState([]);
  const [dias, setDias] = useState(30);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [truncado, setTruncado] = useState(false);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    setCarregando(true); setErro("");
    const r = await fetchExecucoesPeriodo(unidadeAtiva, { de: diasAtras(dias), ate: isoData(new Date()) });
    if (r.error) { setErro(r.error); setExecucoes([]); }
    else { setExecucoes(r.data || []); setTruncado(!!r.truncado); }
    setCarregando(false);
  }, [unidadeAtiva, dias]);

  useEffect(() => { carregar(); }, [carregar]);

  const pessoas = useMemo(() => rankingPorPessoa(execucoes), [execucoes]);
  const setores = useMemo(() => rankingPorSetor(execucoes), [execucoes]);
  const serie = useMemo(() => serieDiaria(execucoes), [execucoes]);
  const falhas = useMemo(() => processosQueMaisFalham(execucoes), [execucoes]);

  const vazio = !carregando && execucoes.length === 0;

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-20">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/operacao/inteligente")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Rankings</h1>
            <p className="text-xs font-bold text-slate-500">Desempenho por pessoa e por setor ao longo do tempo</p>
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {PERIODOS.map(p => (
              <button key={p.dias} onClick={() => setDias(p.dias)}
                className={`h-9 rounded-lg px-3 text-sm font-black transition-colors ${dias === p.dias ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-800"}`}>
                {p.rotulo}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()}
            className="flex h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50 print:hidden">
            <Printer size={17} /> Imprimir
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        {erro && (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{erro}</p>
        )}
        {truncado && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            O período tem mais registros do que cabe numa consulta. Os números abaixo cobrem só parte dele —
            escolha um intervalo menor para o ranking valer.
          </p>
        )}

        {carregando ? (
          <div className="grid min-h-60 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>
        ) : vazio ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Users className="mx-auto text-slate-300" size={38} />
            <p className="mt-3 font-black text-slate-700">Nenhuma rotina neste período</p>
            <p className="mt-1 text-sm text-slate-500">O ranking se monta sozinho conforme as rotinas do dia forem acontecendo.</p>
          </div>
        ) : (
          <>
            {/* Rotina órfã não é falha de ninguém — e some do ranking de
                pessoas. Fica aqui em cima para não sumir da vista também. */}
            {pessoas.semResponsavel.total > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <AlertCircle size={19} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-sm font-bold text-amber-800">
                  {pessoas.semResponsavel.total} rotina{pessoas.semResponsavel.total > 1 ? "s" : ""} ninguém iniciou
                  {pessoas.semResponsavel.atrasadas > 0 && <> — {pessoas.semResponsavel.atrasadas} delas ficaram atrasadas</>}.
                  Sem alguém que tenha iniciado, elas não entram na conta de nenhuma pessoa; contam no setor.
                </p>
              </div>
            )}

            <Secao titulo="Por pessoa" icone={Users}>
              {pessoas.ranqueados.length === 0 ? (
                <p className="text-sm font-bold text-slate-500">
                  Ninguém tem {pessoas.minimo} rotinas ou mais no período — sem isso, o ranking premiaria quem fez menos.
                </p>
              ) : (
                <Tabela linhas={pessoas.ranqueados} rotuloCol="Pessoa" chave="nome" comPosicao />
              )}
              {pessoas.poucosDados.length > 0 && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="cursor-pointer select-none text-xs font-black uppercase tracking-wider text-slate-500">
                    Poucos dados para ranquear ({pessoas.poucosDados.length})
                  </summary>
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Menos de {pessoas.minimo} rotinas no período. Quem fez uma e acertou aparece com 100%, e ordenar
                    isso junto colocaria quem trabalhou menos na frente.
                  </p>
                  <div className="mt-2"><Tabela linhas={pessoas.poucosDados} rotuloCol="Pessoa" chave="nome" /></div>
                </details>
              )}
            </Secao>

            <Secao titulo="Por setor" icone={Building2}>
              <Tabela linhas={setores} rotuloCol="Setor" chave="setor" comPosicao capitalizar />
            </Secao>

            {falhas.length > 0 && (
              <Secao titulo="Rotinas que mais falham" icone={TrendingDown}>
                <p className="mb-3 text-xs font-bold text-slate-500">
                  Não fazer, fazer atrasado ou fazer com item não conforme. Rotina que falha sempre, com gente
                  diferente, costuma ser problema do processo — não de quem executa.
                </p>
                <div className="space-y-2">
                  {falhas.map(p => (
                    <div key={p.nome} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="min-w-0 flex-1 truncate font-black text-slate-800">{p.nome}</span>
                      <span className="shrink-0 text-sm font-bold text-slate-500">{p.falhas} de {p.total}</span>
                      <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(100, Math.round(p.falhas / p.total * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {serie.length > 1 && (
              <Secao titulo="Dia a dia" icone={BarChart3}>
                {/* items-stretch, e não items-end: com items-end cada coluna
                    encolhe até o tamanho do rótulo, a área da barra fica com
                    altura zero e a altura em % resolve contra zero — o gráfico
                    saía sem barra nenhuma, só com os dias embaixo. */}
                <div className="flex items-stretch gap-1 overflow-x-auto pb-1" style={{ height: 140 }}>
                  {serie.map(d => (
                    <div key={d.dia} className="flex min-w-[26px] flex-1 flex-col items-center gap-1" title={`${d.dia}: ${d.score ?? "—"} (${d.concluidas}/${d.total})`}>
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-t-md bg-emerald-500"
                          style={{ height: `${d.score == null ? 2 : Math.max(2, d.score)}%` }} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{String(d.dia).slice(8, 10)}</span>
                    </div>
                  ))}
                </div>
              </Secao>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Secao({ titulo, icone: Icone, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700">
        <Icone size={15} /> {titulo}
      </h2>
      {children}
    </section>
  );
}

function Tabela({ linhas, rotuloCol, chave, comPosicao = false, capitalizar = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            <th className="pb-2 pr-3">{rotuloCol}</th>
            <th className="pb-2 px-2 text-center">Feitas</th>
            <th className="pb-2 px-2 text-center">Atrasos</th>
            <th className="pb-2 px-2 text-center">Não conf.</th>
            <th className="pb-2 px-2 text-center">Pontual.</th>
            <th className="pb-2 px-2 text-center">Qualid.</th>
            <th className="pb-2 pl-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l.id || l[chave]} className="border-t border-slate-100">
              <td className={`py-2.5 pr-3 font-black text-slate-800 ${capitalizar ? "capitalize" : ""}`}>
                {comPosicao && <span className="mr-2 text-slate-400 tabular-nums">{i + 1}º</span>}
                {l[chave]}
              </td>
              <td className="px-2 text-center font-bold tabular-nums text-slate-600">{l.concluidas}/{l.total}</td>
              <td className="px-2 text-center font-bold tabular-nums text-slate-600">{l.atrasadas + l.comAtraso}</td>
              <td className="px-2 text-center font-bold tabular-nums text-slate-600">{l.naoConformes}</td>
              <td className="px-2 text-center font-bold tabular-nums text-slate-500">{l.pontualidade == null ? "—" : `${l.pontualidade}%`}</td>
              <td className="px-2 text-center font-bold tabular-nums text-slate-500">{l.qualidade == null ? "—" : `${l.qualidade}%`}</td>
              <td className={`pl-2 text-right text-base font-black tabular-nums ${tomDoScore(l.score)}`}>{l.score ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
