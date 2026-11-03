"use client";

import Link from "next/link";
import React, { memo } from "react";
import {
  Banknote,
  CalendarDays,
  PartyPopper,
  Users,
  PackageX,
  Wallet,
  RefreshCw,
  UtensilsCrossed,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  WifiOff,
} from "lucide-react";
import { fmtBRL } from "../components/ui";
import { variacao } from "../lib/painel-inicio.mjs";
import {
  usePainelInicio,
  ROTAS_DASHBOARD,
} from "../components/dashboard/usePainelInicio";
import {
  CardIndicador,
  ValorIndicador,
  DetalheIndicador,
} from "../components/dashboard/CardIndicador";
import { GraficoSemana } from "../components/dashboard/GraficoSemana";
import {
  PainelDashboard,
  VazioDashboard,
} from "../components/dashboard/PainelDashboard";
import {
  PainelProximosEventos,
  PainelReservasHoje,
} from "../components/dashboard/PainelEventosReservas";

const pctComSinal = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const Delta = memo(function Delta({ atual, anterior, rotulo }) {
  const v = variacao(atual, anterior);
  if (v === null) {
    return (
      <span className="font-medium text-hf-text-2">sem outros dias para comparar</span>
    );
  }
  const sobe = v >= 0;
  const Seta = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span
        className={`whitespace-nowrap font-bold ${
          sobe ? "text-hf-success" : "text-rose-700"
        }`}
      >
        <Seta size={14} aria-hidden className="-mt-0.5 inline" /> {pctComSinal.format(v)}
      </span>{" "}
      <span className="font-medium text-hf-text-2">{rotulo}</span>
    </>
  );
});

export default function InicioPage() {
  const {
    unidadeInfo,
    agora,
    dados,
    atualizando,
    erroRede,
    carregar,
    pode,
    semUnidade,
    saudacaoTexto,
    dataExtenso,
    colunasGrid,
    faturamento: f,
    contas: c,
    equipe: e,
    reservas: r,
    eventos: ev,
    estoque: s,
    mesas,
  } = usePainelInicio();

  const bloco = (k) => (dados === undefined ? undefined : dados?.[k] ?? { ok: false });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* ── CABEÇALHO DO PAINEL PRINCIPAL ── */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-hf-surface px-6 py-7 shadow-card sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-hf-accent/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-hf-accent">
              {saudacaoTexto || "\u00a0"}
            </p>
            <h1 className="mt-1 truncate text-2xl sm:text-4xl font-black tracking-tight text-hf-text">
              {unidadeInfo?.nome || "Sua operação"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-medium text-hf-text-2 first-letter:uppercase">
              {dataExtenso || "\u00a0"}
            </p>
          </div>

          {!semUnidade && (
            <button
              onClick={carregar}
              disabled={atualizando}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-hf-text shadow-xs transition hover:bg-zinc-100 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
            >
              <RefreshCw
                size={14}
                className={atualizando ? "animate-spin text-hf-accent" : "text-hf-text-2"}
                aria-hidden
              />
              {dados?.em
                ? `Atualizado às ${dados.em.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Carregando..."}
            </button>
          )}
        </div>
      </section>

      {/* ── BANNER DE ERRO DE REDE SE HOUVER ── */}
      {erroRede && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-semibold text-rose-800 shadow-xs">
          <div className="flex items-center gap-2.5">
            <WifiOff size={18} className="shrink-0 text-rose-600" />
            <span>{erroRede}</span>
          </div>
          <button
            onClick={carregar}
            className="shrink-0 rounded-xl bg-rose-600 px-3 py-1.5 font-bold text-white transition hover:bg-rose-700"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {semUnidade ? (
        <VazioDashboard>
          Escolha uma unidade no seletor do topo para visualizar os números do dia.
        </VazioDashboard>
      ) : !pode ? null : (
        <>
          {/* ── SEÇÃO DE CARDS DE INDICADORES PRINCIPAIS ── */}
          <section className={`grid grid-cols-2 gap-3.5 sm:gap-4 ${colunasGrid}`}>
            {/* FATURAMENTO */}
            {pode.financeiro && (
              <CardIndicador
                href={
                  f && !f.disponivel
                    ? ROTAS_DASHBOARD.lancarFaturamento
                    : ROTAS_DASHBOARD.dre
                }
                icone={Banknote}
                rotulo="Faturamento"
                bloco={bloco("faturamento")}
                tom={f?.disponivel ? "verde" : "neutro"}
              >
                {!f?.disponivel ? (
                  <div>
                    <ValorIndicador>sem dado</ValorIndicador>
                    <DetalheIndicador>
                      Lance o faturamento do dia para exibir o balanço
                    </DetalheIndicador>
                  </div>
                ) : !f.ultimo ? (
                  <div>
                    <ValorIndicador>—</ValorIndicador>
                    <DetalheIndicador>
                      Nenhum faturamento nos últimos 7 dias
                    </DetalheIndicador>
                  </div>
                ) : (
                  <div>
                    <ValorIndicador>{fmtBRL(f.ultimo.total)}</ValorIndicador>
                    <DetalheIndicador>{f.ultimo.rotulo}</DetalheIndicador>
                    <p className="mt-1 text-[12px] sm:text-[13px]">
                      <Delta
                        atual={f.ultimo.total}
                        anterior={f.mediaOutros}
                        rotulo="vs média dos outros dias"
                      />
                    </p>
                  </div>
                )}
              </CardIndicador>
            )}

            {/* CONTAS A PAGAR */}
            {pode.contas && (
              <CardIndicador
                href={ROTAS_DASHBOARD.contas}
                icone={Wallet}
                rotulo="Contas a pagar"
                bloco={bloco("contas")}
                tom={c?.vencidas.qtd ? "perigo" : c?.hoje.qtd ? "alerta" : "verde"}
              >
                <div>
                  {c?.vencidas.qtd ? (
                    <>
                      <ValorIndicador>{fmtBRL(c.vencidas.valor)}</ValorIndicador>
                      <DetalheIndicador>
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                          <AlertTriangle size={13} aria-hidden />{" "}
                          {plural(c.vencidas.qtd, "conta vencida", "contas vencidas")}
                        </span>
                        {c.hoje.qtd ? ` · ${fmtBRL(c.hoje.valor)} vence hoje` : ""}
                      </DetalheIndicador>
                    </>
                  ) : c?.hoje.qtd ? (
                    <>
                      <ValorIndicador>{fmtBRL(c.hoje.valor)}</ValorIndicador>
                      <DetalheIndicador>
                        {plural(c.hoje.qtd, "conta vence hoje", "contas vencem hoje")}
                      </DetalheIndicador>
                    </>
                  ) : (
                    <>
                      <ValorIndicador>Em dia</ValorIndicador>
                      <DetalheIndicador>
                        <span className="inline-flex items-center gap-1 font-semibold text-hf-success">
                          <CheckCircle2 size={13} className="text-hf-success" aria-hidden />{" "}
                          Nada vencido nem vencendo hoje
                        </span>
                      </DetalheIndicador>
                    </>
                  )}
                </div>
              </CardIndicador>
            )}

            {/* EQUIPE / PONTO */}
            {pode.rh && (
              <CardIndicador
                href={ROTAS_DASHBOARD.rh}
                icone={Users}
                rotulo="Equipe agora"
                bloco={bloco("equipe")}
              >
                <div>
                  <ValorIndicador>
                    {e ? plural(e.presentes, "pessoa", "pessoas") : "—"}
                  </ValorIndicador>
                  <DetalheIndicador>
                    {e && (e.presentes || e.encerraram)
                      ? `${e.trabalhando} trabalhando · ${e.intervalo} em pausa · ${
                          e.encerraram
                        } ${e.encerraram === 1 ? "saiu" : "saíram"}`
                      : "Ninguém bateu ponto hoje ainda"}
                  </DetalheIndicador>
                </div>
              </CardIndicador>
            )}

            {/* RESERVAS DE HOJE */}
            {pode.eventos && (
              <CardIndicador
                href={ROTAS_DASHBOARD.reservas}
                icone={CalendarDays}
                rotulo="Reservas hoje"
                bloco={bloco("reservas")}
              >
                <div>
                  <ValorIndicador>{r ? r.lista.length : "—"}</ValorIndicador>
                  <DetalheIndicador>
                    {r?.lista.length
                      ? `${plural(r.pessoas, "pessoa", "pessoas")} · próxima às ${String(
                          r.lista[0].horario || ""
                        ).slice(0, 5)}`
                      : "Nenhuma reserva para hoje"}
                  </DetalheIndicador>
                </div>
              </CardIndicador>
            )}

            {/* EVENTOS NO PERÍODO */}
            {pode.eventos && (
              <CardIndicador
                href={ROTAS_DASHBOARD.eventos}
                icone={PartyPopper}
                rotulo="Eventos (30 dias)"
                bloco={bloco("eventos")}
              >
                <div>
                  <ValorIndicador>{ev ? ev.noPeriodo : "—"}</ValorIndicador>
                  <DetalheIndicador>
                    {ev?.lista?.[0]
                      ? `Próximo: ${
                          ev.lista[0].nome || ev.lista[0].cliente_nome || "Evento"
                        } · ${ev.lista[0].dataIso.slice(8, 10)}/${ev.lista[0].dataIso.slice(
                          5,
                          7
                        )}`
                      : "Nenhum evento agendado"}
                  </DetalheIndicador>
                </div>
              </CardIndicador>
            )}

            {/* ESTOQUE BAIXO */}
            {pode.estoque && (
              <CardIndicador
                href={ROTAS_DASHBOARD.estoque}
                icone={PackageX}
                rotulo="Estoque baixo"
                bloco={bloco("estoque")}
                tom={s?.total ? "alerta" : "verde"}
              >
                <div>
                  <ValorIndicador>
                    {s ? plural(s.total, "item", "itens") : "—"}
                  </ValorIndicador>
                  <DetalheIndicador>
                    {s?.total
                      ? s.porEstoque
                          .slice(0, 3)
                          .map((x) => `${x.nome} ${x.qtd}`)
                          .join(" · ")
                      : "Todos os insumos acima do mínimo"}
                  </DetalheIndicador>
                </div>
              </CardIndicador>
            )}

            {/* MESAS DO SALÃO */}
            {pode.mesas && mesas?.total > 0 && (
              <CardIndicador
                href={ROTAS_DASHBOARD.mesas}
                icone={UtensilsCrossed}
                rotulo="Mesas ocupadas"
                bloco={bloco("mesas")}
              >
                <div>
                  <ValorIndicador>
                    {mesas.ocupadas} de {mesas.total}
                  </ValorIndicador>
                  <DetalheIndicador>
                    {pct.format(mesas.taxa)} de ocupação do salão
                  </DetalheIndicador>
                </div>
              </CardIndicador>
            )}
          </section>

          {/* ── PAINÉIS DETALHADOS: FATURAMENTO & EVENTOS/RESERVAS ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {pode.financeiro && (
              <PainelDashboard
                className={`lg:col-span-2 ${
                  f?.disponivel && f.diasLancados ? "" : "lg:self-start"
                }`}
                titulo="Faturamento dos últimos 7 dias"
                href={ROTAS_DASHBOARD.dre}
                acao="Ver DRE"
                subtitulo={
                  f?.disponivel && f.diasLancados
                    ? `${fmtBRL(f.totalLancado)} em ${plural(
                        f.diasLancados,
                        "dia lançado",
                        "dias lançados"
                      )}${
                        f.diasSemLancamento
                          ? ` · ${plural(f.diasSemLancamento, "dia", "dias")} sem lançamento`
                          : ""
                      }`
                    : "\u00a0"
                }
              >
                {dados === undefined ? (
                  <div
                    className="h-56 animate-pulse rounded-2xl bg-zinc-100/70"
                    aria-hidden
                  />
                ) : !dados?.faturamento?.ok ? (
                  <VazioDashboard>
                    Não foi possível sincronizar o faturamento no momento.
                  </VazioDashboard>
                ) : !f.disponivel ? (
                  <VazioDashboard>
                    <span>
                      {f.motivo}{" "}
                      <Link
                        href={ROTAS_DASHBOARD.lancarFaturamento}
                        className="font-bold text-hf-accent hover:underline"
                      >
                        Lançar o faturamento do dia
                      </Link>
                    </span>
                  </VazioDashboard>
                ) : !f.diasLancados ? (
                  <VazioDashboard>
                    <span>
                      Nenhum faturamento lançado nos últimos 7 dias.{" "}
                      <Link
                        href={ROTAS_DASHBOARD.lancarFaturamento}
                        className="font-bold text-hf-accent hover:underline"
                      >
                        Lançar o faturamento do dia
                      </Link>
                    </span>
                  </VazioDashboard>
                ) : (
                  <GraficoSemana dias={f.dias} destaque={f.ultimo?.iso} />
                )}
              </PainelDashboard>
            )}

            {pode.eventos && (
              <div
                className={`grid grid-cols-1 gap-5 ${
                  pode.financeiro ? "" : "lg:col-span-3 lg:grid-cols-2"
                }`}
              >
                <PainelProximosEventos dados={dados} />
                <PainelReservasHoje dados={dados} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
