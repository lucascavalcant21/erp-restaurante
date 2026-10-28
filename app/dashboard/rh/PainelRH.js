"use client";

// Painel do RH (aba Visão Geral). Três perguntas, nesta ordem:
//   1. Hoje: quem está trabalhando, quem atrasou, quem está fora.
//   2. Precisa de atenção: o que está errado ou vencendo, com o porquê e o botão
//      que resolve. Só entra o que dá para provar com o dado do banco.
//   3. Mês: quanto custa a equipe até agora.
// Substitui a fileira de 7 cartões (com "custo de hoje" rateado e "média da
// semana" estimada) e o gráfico de composição: números sem decisão por trás.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, ClipboardList, Printer, Clock, CalendarDays, FileText, Users, Award,
  AlertTriangle, CheckCircle2, ChevronRight, CalendarHeart, Network,
} from "lucide-react";
import { fmtBRL } from "../../components/ui";
import { horarioDoDia, fetchRecibosPrestacaoUnidade } from "../../lib/rh";
import { fetchPontosAbertos } from "../../lib/ponto";
import { atestadoNaData } from "../../lib/ponto-status.mjs";
import { TOLERANCIA_MARCACAO_MIN } from "../../lib/jornada-calculo.mjs";
import { pendenciasDoColaborador } from "../../lib/prontuario-colaborador.mjs";
import { situacaoAvisoPrevio, aniversariantesDoMes, fraseAniversario } from "../../lib/contrato-experiencia.mjs";

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const emMin = (hhmm) => { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const horaDe = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
const dataCurta = (iso) => String(iso || "").slice(0, 10).split("-").reverse().slice(0, 2).join("/");
const primeiroNome = (n) => String(n || "").split(" ")[0];

const STATUS = {
  atrasado:    { rotulo: "Atrasado",       cls: "bg-amber-50 text-amber-800 border-amber-200", ordem: 0 },
  aguardando:  { rotulo: "Ainda não entrou", cls: "bg-zinc-50 text-zinc-700 border-zinc-200", ordem: 1 },
  intervalo:   { rotulo: "Intervalo",      cls: "bg-zinc-100 text-zinc-800 border-zinc-200", ordem: 2 },
  trabalhando: { rotulo: "Trabalhando",    cls: "bg-emerald-50 text-emerald-800 border-emerald-200", ordem: 3 },
  encerrado:   { rotulo: "Saiu",           cls: "bg-zinc-100 text-zinc-600 border-zinc-200", ordem: 4 },
  atestado:    { rotulo: "Atestado",       cls: "bg-sky-50 text-sky-800 border-sky-200", ordem: 5 },
  folga:       { rotulo: "Folga",          cls: "bg-zinc-50 text-zinc-500 border-zinc-200", ordem: 6 },
};

function Secao({ titulo, extra, children }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-fg">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Numero({ rotulo, valor, sub, tom = "text-fg" }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5">
      <p className="text-3xs font-bold uppercase tracking-wider text-subtle">{rotulo}</p>
      <p className={`mt-0.5 text-2xl font-black tabular-nums ${tom}`}>{valor}</p>
      {sub && <p className="text-3xs font-semibold text-subtle">{sub}</p>}
    </div>
  );
}

export default function PainelRH({
  unidadeAtiva, unidadeInfo, funcionarios = [], pontosHoje = [], folgasUnidade = [], atestadosMes = [],
  pontosMesUnidade = [], lancamentos = [], paramsSis = {}, convencao = null, previsaoDe,
  onNovo, onFaltas, onFeriados, onAfd, baixandoAfd, onReciboExtra, onAcoes,
}) {
  const router = useRouter();
  const agora = new Date();
  const hojeISO = isoLocal(agora);
  const mesISO = hojeISO.slice(0, 7);
  const minAgora = agora.getHours() * 60 + agora.getMinutes();

  const [abertos, setAbertos] = useState(null);
  const [recibos, setRecibos] = useState(null);
  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const desde = new Date(); desde.setDate(desde.getDate() - 60);
    fetchPontosAbertos(unidadeAtiva, isoLocal(desde)).then((r) => setAbertos(r.data || []));
    fetchRecibosPrestacaoUnidade(unidadeAtiva).then((r) => setRecibos(r.data || []));
  }, [unidadeAtiva]);

  const ativos = useMemo(() => funcionarios.filter((f) => (f.status || "ativo") !== "inativo"), [funcionarios]);
  const fixos = ativos.filter((f) => f.tipo_contrato !== "Freelancer");
  const porId = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  // ── 1. Hoje ────────────────────────────────────────────────────────────────
  const equipeHoje = useMemo(() => {
    const pontoDe = new Map(pontosHoje.map((p) => [p.colaborador_id, p]));
    const folgaHoje = new Set(folgasUnidade.filter((f) => String(f.data_folga).slice(0, 10) === hojeISO).map((f) => f.colaborador_id));
    return fixos.map((c) => {
      const reg = pontoDe.get(c.id);
      const dias = String(c.dias_trabalho || "").split(",").map((d) => d.trim()).filter(Boolean);
      const entrada = horarioDoDia(c, agora.getDay())?.entrada || "";
      const previsto = !folgaHoje.has(c.id) && (dias.length ? dias.includes(String(agora.getDay())) : Boolean(entrada));
      const atestado = atestadoNaData(atestadosMes.filter((a) => a.colaborador_id === c.id), hojeISO);
      let st = "folga";
      if (reg?.hora_saida) st = "encerrado";
      else if (reg?.hora_saida_intervalo && !reg?.hora_retorno_intervalo) st = "intervalo";
      else if (reg?.hora_entrada) st = "trabalhando";
      else if (atestado) st = "atestado";
      else if (previsto) st = entrada && minAgora > emMin(entrada) + TOLERANCIA_MARCACAO_MIN ? "atrasado" : "aguardando";
      return { c, reg, entrada, previsto: previsto || Boolean(reg?.hora_entrada), st };
    }).sort((a, b) => STATUS[a.st].ordem - STATUS[b.st].ordem || String(a.c.nome).localeCompare(String(b.c.nome)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixos, pontosHoje, folgasUnidade, atestadosMes, hojeISO, minAgora]);

  const conta = (...sts) => equipeHoje.filter((e) => sts.includes(e.st)).length;
  const previstos = equipeHoje.filter((e) => e.previsto).length;

  // ── 2. Precisa de atenção ──────────────────────────────────────────────────
  const pendencias = useMemo(() => {
    const itens = [];
    // Ponto sem saída: agrupa por pessoa.
    const porPessoa = new Map();
    (abertos || []).forEach((p) => {
      const c = porId.get(p.colaborador_id);
      if (!c || (c.status || "ativo") === "inativo") return;
      if (!porPessoa.has(c.id)) porPessoa.set(c.id, { c, dias: [] });
      porPessoa.get(c.id).dias.push(p.data_referencia);
    });
    porPessoa.forEach(({ c, dias }) => itens.push({
      nivel: "alto", c,
      texto: `${dias.length} dia(s) de ponto sem saída: ${dias.slice(0, 4).map(dataCurta).join(", ")}${dias.length > 4 ? "…" : ""}`,
      porque: "Entrada batida e nenhuma saída nos últimos 60 dias. O espelho, a folha e o AFD ficam incompletos.",
      acao: "Corrigir", ir: `/dashboard/rh/ponto/corrigir?colab=${c.id}&data=${String(dias[dias.length - 1]).slice(0, 10)}`,
    }));
    // Contrato, cadastro e aviso prévio.
    ativos.forEach((c) => {
      const av = situacaoAvisoPrevio(c, agora);
      if (av) itens.push({
        nivel: av.concluido ? "alto" : "medio", c,
        texto: av.concluido ? "Aviso prévio terminou: finalizar o desligamento." : `Cumprindo aviso prévio: faltam ${av.diasRestantes} dia(s).`,
        porque: `Aviso de ${av.diasTotal} dias registrado no cadastro.`,
        acao: "Abrir", ir: `/dashboard/rh/funcionario/${c.id}?aba=contratos`,
      });
      pendenciasDoColaborador(c, { hoje: agora, cct: convencao?.cct || null })
        .filter((p) => p.nivel === "alto")
        .forEach((p) => itens.push({
          nivel: "alto", c, texto: p.texto,
          porque: p.fonte || "Conferido no cadastro e no vínculo do colaborador.",
          acao: /Experiência|período/.test(p.texto) ? "Decidir" : "Completar",
          ir: `/dashboard/rh/funcionario/${c.id}?aba=${/Experiência|período/.test(p.texto) ? "contratos" : "pessoais"}`,
        }));
    });
    // Folga marcada num dia em que a pessoa trabalhou (mês corrente).
    folgasUnidade.forEach((f) => {
      const dia = String(f.data_folga).slice(0, 10);
      if (dia.slice(0, 7) !== mesISO) return;
      const p = pontosMesUnidade.find((x) => x.colaborador_id === f.colaborador_id && x.data_referencia === dia && x.hora_entrada);
      const c = porId.get(f.colaborador_id);
      if (p && c) itens.push({
        nivel: "medio", c,
        texto: `Folga marcada em ${dataCurta(dia)}, mas há ponto nesse dia (${horaDe(p.hora_entrada)}${p.hora_saida ? `–${horaDe(p.hora_saida)}` : ""}).`,
        porque: "Ou a folga está errada, ou foi trabalho em dia de folga, que se paga em dobro.",
        acao: "Conferir", ir: `/dashboard/rh/ponto/corrigir?colab=${c.id}&data=${dia}`,
      });
    });
    const ordem = { alto: 0, medio: 1 };
    return itens.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertos, ativos, porId, folgasUnidade, pontosMesUnidade, convencao, mesISO]);

  // ── 3. Mês ─────────────────────────────────────────────────────────────────
  const mes = useMemo(() => {
    const folha = fixos.reduce((s, f) => s + (previsaoDe ? previsaoDe(f).previsto : 0), 0);
    const extrasMes = (recibos || []).filter((r) => String(r.data_trabalho || "").slice(0, 7) === mesISO && porId.get(r.colaborador_id)?.tipo_contrato === "Freelancer");
    const custoExtras = extrasMes.reduce((s, r) => s + (Number(r.valor_total) || 0), 0);
    const fat = lancamentos.filter((l) => l.tipo === "entrada" && String(l.data || "").slice(0, 7) === mesISO).reduce((s, l) => s + (Number(l.valor) || 0), 0);
    const minimo = Number(paramsSis?.faturamento_minimo_cmo) || 0;
    const total = folha + custoExtras;
    return { folha, custoExtras, diarias: extrasMes.length, total, fat, pct: fat >= minimo && fat > 0 ? (total / fat) * 100 : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixos, recibos, lancamentos, paramsSis, mesISO, previsaoDe]);

  const aniv = aniversariantesDoMes(ativos, agora);
  const nomeMes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const dataLonga = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const BotaoSec = ({ icon: Icon, children, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-white disabled:opacity-60">
      <Icon size={14} /> {children}
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-6 pt-4 sm:px-6 sm:pt-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">RH e equipe</h1>
          <p className="mt-0.5 text-xs font-semibold text-subtle">{unidadeInfo?.nome || "Unidade"} · {dataLonga}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onNovo} className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-fg hover:opacity-90">
            <UserPlus size={16} /> Novo funcionário
          </button>
          <button type="button" onClick={() => router.push("/dashboard/rh/fechamento")} className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-card px-4 text-sm font-bold text-accent-strong hover:bg-accent-soft">
            <ClipboardList size={16} /> Fechar folha
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <BotaoSec icon={Users} onClick={() => router.push("/dashboard/rh/extra")}>Extras</BotaoSec>
        <BotaoSec icon={Printer} onClick={onReciboExtra}>Recibo de extra</BotaoSec>
        <BotaoSec icon={Clock} onClick={onFaltas}>Faltas e atrasos</BotaoSec>
        <BotaoSec icon={CalendarDays} onClick={onFeriados}>Feriados</BotaoSec>
        <BotaoSec icon={FileText} onClick={onAfd} disabled={baixandoAfd}>{baixandoAfd ? "Exportando..." : "Exportar AFD"}</BotaoSec>
        <BotaoSec icon={Award} onClick={() => router.push("/dashboard/rh/cargos")}>Cargos</BotaoSec>
        <BotaoSec icon={Network} onClick={() => router.push("/dashboard/rh/organograma")}>Organograma</BotaoSec>
      </div>

      {/* 1. Hoje */}
      <Secao titulo="Hoje" extra={<button type="button" onClick={() => router.push("/dashboard/rh/ponto")} className="flex items-center gap-1 text-xs font-bold text-accent-strong">Relógio <ChevronRight size={14} /></button>}>
        {fixos.length === 0 ? (
          <p className="text-sm text-subtle">Nenhum funcionário fixo ativo. Cadastre a equipe em "Novo funcionário".</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Numero rotulo="Previstos" valor={previstos} sub={`de ${fixos.length} fixos`} />
              <Numero rotulo="Presentes" valor={conta("trabalhando", "intervalo", "encerrado")} sub={`${conta("intervalo")} em intervalo`} tom="text-accent-strong" />
              <Numero rotulo="Atrasados" valor={conta("atrasado")} sub={`mais de ${TOLERANCIA_MARCACAO_MIN} min`} tom={conta("atrasado") ? "text-amber-700" : "text-fg"} />
              <Numero rotulo="Fora hoje" valor={conta("folga", "atestado")} sub={`${conta("atestado")} com atestado`} />
            </div>
            <ul className="mt-3 divide-y divide-line">
              {equipeHoje.map(({ c, reg, entrada, st }) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onAcoes?.(c)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-white">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-fg">{c.nome}</span>
                      <span className="block truncate text-3xs font-semibold text-subtle">
                        {c.cargo || "Sem cargo"}{entrada ? ` · turno ${entrada}` : ""}{reg?.hora_entrada ? ` · entrou ${horaDe(reg.hora_entrada)}` : ""}{reg?.hora_saida ? ` · saiu ${horaDe(reg.hora_saida)}` : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-lg border px-2 py-1 text-3xs font-bold ${STATUS[st].cls}`}>{STATUS[st].rotulo}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>

      {/* 2. Precisa de atenção */}
      <Secao titulo="Precisa de atenção" extra={abertos !== null && <span className="text-xs font-bold text-subtle">{pendencias.length} item(ns)</span>}>
        {abertos === null ? (
          <p className="text-sm text-subtle">Conferindo ponto, contratos e cadastros...</p>
        ) : pendencias.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={16} /> Nada pendente. Conferido: ponto sem saída (60 dias), experiência e aviso prévio, CPF, salário e piso, folgas com ponto no mês.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendencias.map((p, i) => (
              <li key={i} className={`flex items-start gap-3 rounded-xl border p-3 ${p.nivel === "alto" ? "border-rose-200 bg-rose-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${p.nivel === "alto" ? "text-rose-700" : "text-amber-700"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-fg"><span className="font-black">{primeiroNome(p.c.nome)}:</span> {p.texto}</p>
                  <p className="mt-0.5 text-3xs font-semibold text-subtle">Por quê: {p.porque}</p>
                </div>
                <button type="button" onClick={() => router.push(p.ir)} className="shrink-0 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-fg-soft hover:bg-white">{p.acao}</button>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* 3. Mês */}
      <Secao titulo={`Mês de ${nomeMes}`}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Numero rotulo="Folha prevista (fixos)" valor={fmtBRL(mes.folha)} sub="projeção: salário, VA, taxa e adicionais do ponto até hoje, menos vales" />
          <Numero rotulo="Extras pagos" valor={recibos === null ? "..." : fmtBRL(mes.custoExtras)} sub={`${mes.diarias} recibo(s) de diária no mês`} />
          <Numero rotulo="Mão de obra / faturamento" valor={mes.pct === null ? "—" : `${mes.pct.toFixed(1)}%`}
            sub={mes.pct === null ? "aguardando o faturamento do mês em Finanças" : `${fmtBRL(mes.total)} de ${fmtBRL(mes.fat)}`} />
        </div>
        {aniv.itens.filter((it) => !it.jaFez).length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs font-semibold text-fg-soft">
            <CalendarHeart size={14} className="mt-0.5 shrink-0 text-accent-strong" />
            <span>{aniv.itens.filter((it) => !it.jaFez).map((it) => fraseAniversario(it)).join(" · ")}</span>
          </div>
        )}
      </Secao>
    </div>
  );
}
