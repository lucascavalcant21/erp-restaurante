"use client";

// Tela inicial. Era um protótipo com tudo escrito à mão ("R$ 8.542",
// "Boa noite, Lucas" às 11h, um casamento de exemplo) e nada clicável. Agora
// cada número vem do módulo dele, pela mesma regra da tela do módulo, e cada
// cartão leva para lá. As contas estão em lib/painel-inicio.mjs (com teste).

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, ArrowDownRight, Banknote, CalendarDays, PartyPopper, Users, PackageX,
  Wallet, RefreshCw, ChevronRight, UtensilsCrossed, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useERP } from "../context/ERPContext";
import { canAccessRoute } from "../lib/permissions-catalog.mjs";
import { carregarPainelInicio } from "../lib/painel-inicio-dados";
import { saudacao, primeiroNome, variacao } from "../lib/painel-inicio.mjs";
import { rotuloEtapa } from "../lib/evento-financeiro.mjs";
import { useTempoReal } from "../lib/realtime";
import { fmtBRL } from "../components/ui";

const ROTAS = {
  financeiro: "/dashboard/financeiro",
  contas: "/dashboard/financeiro/contas",
  rh: "/dashboard/rh",
  eventos: "/dashboard/reservas-eventos",
  estoque: "/dashboard/operacao/estoque?gestao=1",
  mesas: "/dashboard/mesas",
};

const brlCompacto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const pctComSinal = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Cores das barras validadas no checador de paleta (contraste >= 3:1 no fundo
// branco e separação para daltonismo): dias anteriores em cinza, hoje em verde.
const COR_BARRA = { passado: "#7c8aa0", hoje: "#047857" };

const TONS = {
  neutro: "bg-slate-100 text-slate-700",
  verde: "bg-emerald-50 text-emerald-700",
  alerta: "bg-amber-50 text-amber-700",
  perigo: "bg-rose-50 text-rose-700",
};

// ─── Peças ───────────────────────────────────────────────────────────────────

function Indicador({ href, icone: Icone, rotulo, bloco, tom = "neutro", children }) {
  const carregando = bloco === undefined;
  const erro = bloco && !bloco.ok;
  return (
    <Link href={href}
      className="group flex min-h-[132px] flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition sm:min-h-[148px] sm:gap-4 sm:p-5 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-9 sm:w-9 ${TONS[erro ? "neutro" : tom]}`}>
            <Icone size={17} />
          </span>
          <span className="line-clamp-2 text-[13px] font-bold leading-tight text-slate-600 sm:truncate sm:text-sm">{rotulo}</span>
        </div>
        {/* O cartão inteiro é o link; a seta é só a dica. No celular ela tirava o espaço do rótulo. */}
        <ArrowUpRight size={18} aria-hidden className="hidden shrink-0 text-slate-300 transition group-hover:text-emerald-600 sm:block" />
      </div>
      {carregando ? (
        <div aria-hidden>
          <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-2.5 h-4 w-40 animate-pulse rounded bg-slate-100" />
        </div>
      ) : erro ? (
        <div>
          <p className="text-[22px] font-black leading-none text-slate-300 sm:text-[28px]">—</p>
          <p className="mt-2 text-[13px] font-semibold text-slate-500 sm:text-sm">Não consegui carregar agora</p>
        </div>
      ) : children}
    </Link>
  );
}

const Valor = ({ children }) => <p className="text-[22px] font-black leading-none tracking-tight text-slate-900 sm:text-[28px]">{children}</p>;
const Detalhe = ({ children }) => <p className="mt-2 text-[13px] font-semibold text-slate-500 sm:text-sm">{children}</p>;

function Delta({ atual, anterior }) {
  const v = variacao(atual, anterior);
  if (v === null) return <span>sem base de comparação com ontem</span>;
  const sobe = v >= 0;
  const Seta = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span className={`whitespace-nowrap font-bold ${sobe ? "text-emerald-700" : "text-rose-700"}`}>
        <Seta size={14} aria-hidden className="-mt-0.5 inline" /> {pctComSinal.format(v)}
      </span>{" "}
      <span className="font-semibold text-slate-500">vs ontem até agora</span>
    </>
  );
}

function Painel({ titulo, subtitulo, href, acao, className = "", children }) {
  return (
    <section className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-900 sm:text-lg">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-sm font-medium text-slate-500">{subtitulo}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
            {acao} <ChevronRight size={16} aria-hidden />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Vazio({ children }) {
  return <p className="grid flex-1 place-items-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-500">{children}</p>;
}

// Uma série só: o título diz o que é, sem legenda. Rótulo direto só em hoje e
// no maior dia; o valor de cada dia aparece no mouse/teclado e é o nome
// acessível da barra.
function GraficoSemana({ dias }) {
  const max = Math.max(0, ...dias.map((d) => d.total));
  return (
    <div className="flex flex-1 flex-col">
      <ol aria-label="Faturamento por dia" className="relative flex min-h-48 flex-1 items-end gap-1.5 border-b border-slate-200 sm:gap-3">
        {dias.map((d, i) => {
          const altura = max > 0 ? (d.total / max) * 82 : 0; // 18% livre para o rótulo do maior dia
          const rotular = d.total > 0 && (d.hoje || d.total === max);
          const lado = i === 0 ? "left-0" : i === dias.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
          const texto = `${d.hoje ? "Hoje" : `${d.sigla} ${ddmm(d.iso)}`} · ${fmtBRL(d.total)} · ${plural(d.qtd, "venda", "vendas")}`;
          return (
            <li key={d.iso} tabIndex={0} aria-label={texto}
              className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end rounded-t-md outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500">
              {rotular && (
                <span aria-hidden className="mb-1 whitespace-nowrap text-xs font-bold text-slate-700">{brlCompacto.format(d.total)}</span>
              )}
              <span aria-hidden className="block w-full max-w-[24px] rounded-t-[4px]"
                style={{ height: `${d.total > 0 ? Math.max(altura, 1.5) : 0}%`, background: d.hoje ? COR_BARRA.hoje : COR_BARRA.passado }} />
              {/* Logo acima da barra (e do rótulo dela), não no topo do painel. */}
              <span aria-hidden style={{ bottom: `calc(${altura}% + ${rotular ? 26 : 8}px)` }}
                className={`pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block group-focus-visible:block ${lado}`}>
                {texto}
              </span>
            </li>
          );
        })}
      </ol>
      <ol className="mt-2 flex gap-1.5 sm:gap-3" aria-hidden>
        {dias.map((d) => (
          <li key={d.iso} className={`flex-1 text-center text-xs font-semibold ${d.hoje ? "text-slate-900" : "text-slate-500"}`}>
            {d.hoje ? "Hoje" : <><span className="hidden capitalize sm:inline">{d.sigla} </span>{d.dia}</>}
          </li>
        ))}
      </ol>
    </div>
  );
}

const corEtapa = (etapa) =>
  ["CONFIRMADO", "SINAL PAGO", "PREPARACAO", "EM PRODUCAO", "EVENTO"].includes(etapa)
    ? "bg-emerald-50 text-emerald-800"
    : ["APROVADO", "AGUARDANDO SINAL", "NEGOCIACAO", "PROPOSTA ENVIADA"].includes(etapa)
      ? "bg-amber-50 text-amber-800"
      : "bg-slate-100 text-slate-700";

// ─── Tela ────────────────────────────────────────────────────────────────────

export default function Inicio() {
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();
  const [agora, setAgora] = useState(null); // só no navegador: a hora do servidor é UTC
  const [dados, setDados] = useState(undefined);
  const [atualizando, setAtualizando] = useState(false);

  const pode = useMemo(() => {
    if (!sessao) return null;
    const ok = (rota) => {
      const [caminho, busca = ""] = rota.split("?");
      return !sessao.gerenciado || canAccessRoute(sessao, caminho, busca);
    };
    return Object.fromEntries(Object.entries(ROTAS).map(([k, rota]) => [k, ok(rota)]));
  }, [sessao]);

  const carregar = useCallback(async () => {
    if (!pode || !unidadeAtiva) return;
    setAtualizando(true);
    const momento = new Date();
    const r = await carregarPainelInicio(unidadeAtiva, pode, momento);
    setAgora(momento);
    setDados(r);
    setAtualizando(false);
  }, [pode, unidadeAtiva]);

  useEffect(() => { setAgora(new Date()); }, []);
  useEffect(() => { setDados(undefined); carregar(); }, [carregar]);
  // Dois minutos com a tela aberta, e na hora em que alguma tabela muda.
  useEffect(() => {
    const t = setInterval(carregar, 120000);
    return () => clearInterval(t);
  }, [carregar]);
  useTempoReal(["vendas", "registro_ponto", "reservas", "eventos", "estoque_itens", "contas_pagar", "comandas", "mesas"], carregar);

  const nome = primeiroNome(sessao?.nome);
  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";
  const bloco = (k) => (dados === undefined ? undefined : dados?.[k] ?? { ok: false });
  const v = dados?.vendas?.ok ? dados.vendas.dados : null;
  const mesas = dados?.mesas?.ok ? dados.mesas.dados : null;
  // Sete cartões em três colunas deixavam um sozinho na última linha.
  const nCartoes = pode ? [pode.financeiro, pode.contas, pode.rh, pode.eventos, pode.eventos, pode.estoque, pode.mesas && mesas?.total > 0].filter(Boolean).length : 0;
  const colunas = nCartoes === 4 || nCartoes >= 7 ? "xl:grid-cols-4" : "xl:grid-cols-3";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Cabeçalho */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-7 text-white sm:px-8 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-300">
              {agora ? `${saudacao(agora)}${nome ? `, ${nome}` : ""}` : " "}
            </p>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight sm:text-4xl">{unidadeInfo?.nome || "Sua operação"}</h1>
            <p className="mt-1 text-sm font-medium text-slate-300 first-letter:uppercase">
              {agora ? agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}
            </p>
          </div>
          {!semUnidade && (
            <button onClick={carregar} disabled={atualizando}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/15 disabled:opacity-70">
              <RefreshCw size={15} className={atualizando ? "animate-spin" : ""} aria-hidden />
              {dados?.em ? `Atualizado às ${dados.em.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Carregando..."}
            </button>
          )}
        </div>
      </section>

      {semUnidade ? (
        <Vazio>Escolha uma unidade no topo para ver os números do dia.</Vazio>
      ) : !pode ? null : (
        <>
          {/* Indicadores: cada um abre o módulo dele */}
          <section className={`grid grid-cols-2 gap-3 sm:gap-4 ${colunas}`}>
            {pode.financeiro && (
              <Indicador href={ROTAS.financeiro} icone={Banknote} rotulo="Faturamento hoje" bloco={bloco("vendas")} tom="verde">
                <div>
                  <Valor>{fmtBRL(v?.hoje)}</Valor>
                  <Detalhe>{plural(v?.qtdHoje || 0, "venda", "vendas")}</Detalhe>
                  <p className="mt-0.5 text-[13px] sm:text-sm"><Delta atual={v?.hoje} anterior={v?.ontemAteAgora} /></p>
                </div>
              </Indicador>
            )}

            {pode.contas && (() => {
              const c = dados?.contas?.ok ? dados.contas.dados : null;
              const tom = c?.vencidas.qtd ? "perigo" : c?.hoje.qtd ? "alerta" : "verde";
              return (
                <Indicador href={ROTAS.contas} icone={Wallet} rotulo="Contas a pagar" bloco={bloco("contas")} tom={tom}>
                  <div>
                    {c?.vencidas.qtd ? (
                      <>
                        <Valor>{fmtBRL(c.vencidas.valor)}</Valor>
                        <Detalhe>
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700"><AlertTriangle size={14} aria-hidden /> {plural(c.vencidas.qtd, "conta vencida", "contas vencidas")}</span>
                          {c.hoje.qtd ? ` · ${fmtBRL(c.hoje.valor)} vence hoje` : ""}
                        </Detalhe>
                      </>
                    ) : c?.hoje.qtd ? (
                      <>
                        <Valor>{fmtBRL(c.hoje.valor)}</Valor>
                        <Detalhe>{plural(c.hoje.qtd, "conta vence hoje", "contas vencem hoje")}</Detalhe>
                      </>
                    ) : (
                      <>
                        <Valor>Em dia</Valor>
                        <Detalhe><span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-700" aria-hidden /> Nada vencido nem vencendo hoje</span></Detalhe>
                      </>
                    )}
                  </div>
                </Indicador>
              );
            })()}

            {pode.rh && (() => {
              const e = dados?.equipe?.ok ? dados.equipe.dados : null;
              return (
                <Indicador href={ROTAS.rh} icone={Users} rotulo="Equipe agora" bloco={bloco("equipe")}>
                  <div>
                    <Valor>{e ? plural(e.presentes, "pessoa", "pessoas") : ""}</Valor>
                    <Detalhe>
                      {e && (e.presentes || e.encerraram)
                        ? `${e.trabalhando} trabalhando · ${e.intervalo} em intervalo · ${e.encerraram} já ${e.encerraram === 1 ? "saiu" : "saíram"}`
                        : "Ninguém bateu ponto hoje ainda"}
                    </Detalhe>
                  </div>
                </Indicador>
              );
            })()}

            {pode.eventos && (() => {
              const r = dados?.reservas?.ok ? dados.reservas.dados : null;
              return (
                <Indicador href={ROTAS.eventos} icone={CalendarDays} rotulo="Reservas hoje" bloco={bloco("reservas")}>
                  <div>
                    <Valor>{r ? r.lista.length : ""}</Valor>
                    <Detalhe>{r?.lista.length ? `${plural(r.pessoas, "pessoa", "pessoas")} · próxima às ${String(r.lista[0].horario || "").slice(0, 5)}` : "Nenhuma reserva para hoje"}</Detalhe>
                  </div>
                </Indicador>
              );
            })()}

            {pode.eventos && (() => {
              const e = dados?.eventos?.ok ? dados.eventos.dados : null;
              const prox = e?.lista[0];
              return (
                <Indicador href={ROTAS.eventos} icone={PartyPopper} rotulo="Eventos (30 dias)" bloco={bloco("eventos")}>
                  <div>
                    <Valor>{e ? e.noPeriodo : ""}</Valor>
                    <Detalhe>{prox ? `Próximo: ${prox.nome || prox.cliente_nome || "Evento"} · ${ddmm(prox.dataIso)}` : "Nenhum evento marcado"}</Detalhe>
                  </div>
                </Indicador>
              );
            })()}

            {pode.estoque && (() => {
              const s = dados?.estoque?.ok ? dados.estoque.dados : null;
              return (
                <Indicador href={ROTAS.estoque} icone={PackageX} rotulo="Estoque baixo" bloco={bloco("estoque")} tom={s?.total ? "alerta" : "verde"}>
                  <div>
                    <Valor>{s ? plural(s.total, "item", "itens") : ""}</Valor>
                    <Detalhe>{s?.total ? s.porEstoque.slice(0, 3).map((x) => `${x.nome} ${x.qtd}`).join(" · ") : "Tudo acima do mínimo"}</Detalhe>
                  </div>
                </Indicador>
              );
            })()}

            {pode.mesas && mesas?.total > 0 && (
              <Indicador href={ROTAS.mesas} icone={UtensilsCrossed} rotulo="Mesas ocupadas" bloco={bloco("mesas")}>
                <div>
                  <Valor>{mesas.ocupadas} de {mesas.total}</Valor>
                  <Detalhe>{pct.format(mesas.taxa)} do salão</Detalhe>
                </div>
              </Indicador>
            )}
          </section>

          {/* Painéis */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {pode.financeiro && (
              <Painel className="lg:col-span-2" titulo="Faturamento dos últimos 7 dias" href={ROTAS.financeiro} acao="Financeiro"
                subtitulo={v ? `Total ${fmtBRL(v.totalSemana)} · média de ${fmtBRL(v.totalSemana / 7)} por dia` : " "}>
                {dados === undefined ? (
                  <div className="h-56 animate-pulse rounded-xl bg-slate-50" aria-hidden />
                ) : !v ? (
                  <Vazio>Não consegui carregar as vendas agora.</Vazio>
                ) : v.totalSemana === 0 ? (
                  <Vazio>Nenhuma venda registrada nos últimos 7 dias.</Vazio>
                ) : (
                  <GraficoSemana dias={v.dias} />
                )}
              </Painel>
            )}

            {pode.eventos && (
              <div className={`grid grid-cols-1 gap-4 ${pode.financeiro ? "" : "lg:col-span-3 lg:grid-cols-2"}`}>
                <Painel titulo="Próximos eventos" href={ROTAS.eventos} acao="Funil">
                  {dados === undefined ? (
                    <div className="h-32 animate-pulse rounded-xl bg-slate-50" aria-hidden />
                  ) : !dados?.eventos?.ok ? (
                    <Vazio>Não consegui carregar os eventos agora.</Vazio>
                  ) : !dados.eventos.dados.lista.length ? (
                    <Vazio>Nenhum evento marcado daqui para a frente.</Vazio>
                  ) : (
                    <ul className="space-y-2">
                      {dados.eventos.dados.lista.slice(0, 4).map((e) => (
                        <li key={e.id}>
                          <Link href={`/dashboard/reservas-eventos/eventos/${e.id}`}
                            className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/40">
                            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-center leading-none">
                              <span>
                                <span className="block text-base font-black text-slate-900">{e.dataIso.slice(8, 10)}</span>
                                <span className="block text-[11px] font-bold uppercase text-slate-500">{MESES[Number(e.dataIso.slice(5, 7)) - 1]}</span>
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block line-clamp-2 text-sm font-bold leading-snug text-slate-900">{e.nome || e.cliente_nome || "Evento sem título"}</span>
                              <span className="block truncate text-xs font-semibold text-slate-500">
                                {Number(e.capacidade) > 0
                                  ? plural(Number(e.capacidade), "convidado", "convidados")
                                  : e.nome && e.cliente_nome ? e.cliente_nome : "Convidados a definir"}
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold ${corEtapa(e.etapa)}`}>{rotuloEtapa(e.etapa)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Painel>

                <Painel titulo="Reservas de hoje" href={ROTAS.eventos} acao="Reservas">
                  {dados === undefined ? (
                    <div className="h-24 animate-pulse rounded-xl bg-slate-50" aria-hidden />
                  ) : !dados?.reservas?.ok ? (
                    <Vazio>Não consegui carregar as reservas agora.</Vazio>
                  ) : !dados.reservas.dados.lista.length ? (
                    <Vazio>Nenhuma reserva para hoje.</Vazio>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {dados.reservas.dados.lista.slice(0, 6).map((r) => (
                        <li key={r.id}>
                          <Link href={ROTAS.eventos} className="flex items-center gap-3 py-2.5 text-sm hover:text-emerald-800">
                            <span className="w-12 shrink-0 font-black tabular-nums text-slate-900">{String(r.horario || "").slice(0, 5)}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{r.cliente_nome || "Sem nome"}</span>
                            <span className="shrink-0 font-semibold text-slate-500">{plural(Number(r.qtd_pessoas) || 0, "pessoa", "pessoas")}{r.mesa ? ` · ${r.mesa}` : ""}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Painel>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
