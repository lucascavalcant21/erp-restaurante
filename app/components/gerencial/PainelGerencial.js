"use client";

// Peças do painel gerencial na identidade "Gestão" (pedido do dono, 08/11/2026):
// barra de áreas preta com ícone em cima do nome, título "Visão geral" com a
// segunda palavra em vermelho, KPIs com ícone, barras em degradê laranja →
// vermelho com a foto do prato, rosca de custos, análise do produto e blocos de
// custo operacional e ponto de equilíbrio. Cores pelos tokens hf-* redefinidos em
// `.tema-gestao` (globals.css). Contas em app/lib/painel-gerencial.mjs.
// Sem dado, a peça diz o que falta: nenhum número de demonstração.

import Link from "next/link";
import { ImageOff } from "lucide-react";
import { alturasDasBarras } from "../../lib/painel-gerencial.mjs";

export const brl = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—"
  : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const pct = (v, dec = 1) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—"
  : `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`);
export const inteiro = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
const valorTxt = (v, formato) => (formato === "pct" ? pct(v) : formato === "int" ? inteiro(v) : brl(v));

const NATUREZA = {
  real: "Real",
  estimativa: "Estimativa",
  projecao: "Projeção",
  simulacao: "Simulação",
  previsto: "Previsto pela ficha",
};

export function Natureza({ tipo }) {
  if (!NATUREZA[tipo]) return null;
  const real = tipo === "real";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${real ? "bg-hf-success/10 text-hf-success" : "bg-hf-elevated text-hf-text-2"}`}>{NATUREZA[tipo]}</span>;
}

/** Barra de áreas preta: ícone em cima do nome, a área aberta em bloco vermelho. */
export function BarraDeAreas({ areas, ativa, rotulo }) {
  return (
    <nav aria-label={rotulo} className="mb-5 overflow-hidden rounded-2xl bg-hf-menu shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="flex overflow-x-auto [scrollbar-width:none]">
        {areas.map((a) => {
          const Icone = a.icone;
          const on = ativa(a);
          return (
            <Link key={a.href} href={a.href} aria-current={on ? "page" : undefined}
              className={`flex min-h-[64px] min-w-[92px] shrink-0 flex-col items-center justify-center gap-1 px-3 py-2 text-center text-[11px] font-semibold leading-tight transition sm:min-w-[104px] ${on ? "bg-gradient-to-b from-[rgb(239_68_68)] to-hf-accent text-white" : "text-hf-menu-muted hover:bg-hf-menu-hover hover:text-white"}`}>
              {Icone && <Icone size={20} strokeWidth={1.8} className="shrink-0" />}
              <span className="max-w-[96px]">{a.rotulo}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** "Visão geral": a segunda parte do título em vermelho. */
export function TituloGestao({ antes = "Visão", destaque = "geral", icone: Icone, subtitulo, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icone && <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[rgb(249_115_22)] to-hf-accent text-white shadow-[0_6px_16px_-6px_rgba(220,38,38,0.6)]"><Icone size={24} /></span>}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-hf-text sm:text-4xl">{antes} <span className="text-hf-accent">{destaque}</span></h1>
          {subtitulo && <p className="mt-0.5 text-sm text-hf-muted">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function CartaoKpi({ icone: Icone, rotulo, valor, formato = "brl", nota, natureza, destaque = false, semDado = "Dados insuficientes" }) {
  const vazio = valor === null || valor === undefined;
  return (
    <div className={`min-w-0 rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_-8px_rgba(0,0,0,0.12)] ${destaque ? "bg-gradient-to-br from-hf-success to-[rgb(6_95_70)] text-white" : "border border-hf-border bg-hf-surface"}`}>
      <div className="flex min-w-0 items-center gap-2">
        {Icone && <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${destaque ? "bg-white/15 text-white" : "bg-hf-accent/10 text-hf-accent"}`}><Icone size={16} /></span>}
        <p className={`min-w-0 text-xs font-medium leading-tight ${destaque ? "text-white/85" : "text-hf-muted"}`}>{rotulo}</p>
      </div>
      <p className={`mt-2 whitespace-nowrap tabular-nums ${vazio ? `text-xs font-semibold ${destaque ? "text-white/80" : "text-hf-muted"}` : `text-[17px] font-bold tracking-tight sm:text-lg ${!destaque && Number(valor) < 0 ? "text-hf-danger" : ""}`}`}>{vazio ? semDado : valorTxt(valor, formato)}</p>
      {(nota || natureza) && <div className={`mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-tight ${destaque ? "text-white/80" : "text-hf-muted"}`}>{natureza && !destaque && <Natureza tipo={natureza} />}{nota && <span>{nota}</span>}</div>}
    </div>
  );
}

/** Card de seção: bolinha vermelha com ícone e título. */
export function Bloco({ icone: Icone, titulo, subtitulo, direita, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-hf-border bg-hf-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_-8px_rgba(0,0,0,0.12)] sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icone && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hf-accent text-white"><Icone size={17} /></span>}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-hf-text">{titulo}</h2>
            {subtitulo && <p className="text-xs text-hf-muted">{subtitulo}</p>}
          </div>
        </div>
        {direita}
      </div>
      {children}
    </section>
  );
}

export function FaltaDado({ motivo, href, acao }) {
  return (
    <div className="rounded-xl border border-dashed border-hf-border-strong bg-hf-elevated/60 p-3 text-sm">
      <p className="font-semibold text-hf-text">DADOS INSUFICIENTES</p>
      {motivo && <p className="mt-0.5 text-hf-text-2">{motivo}</p>}
      {href && acao && <Link href={href} className="mt-1 inline-flex min-h-[40px] items-center font-semibold text-hf-accent hover:underline">{acao} →</Link>}
    </div>
  );
}

function Foto({ src, icone: Icone, className = "" }) {
  if (src) return <img src={src} alt="" loading="lazy" className={`object-cover ${className}`} />;
  const I = Icone || ImageOff;
  return <span className={`grid place-items-center bg-white/20 text-white ${className}`}><I size={18} /></span>;
}

/**
 * Barras verticais em degradê com o valor em cima e a foto do item na base.
 * itens: [{ id, nome, valor, foto?, icone? }]
 */
export function GraficoMaioresMargens({ itens = [], formato = "brl", vazio }) {
  if (!itens.length) return vazio || null;
  const alturas = alturasDasBarras(itens.map((i) => i.valor));
  return (
    <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
      <ul className="flex h-60 min-w-full items-end gap-2 sm:gap-4" aria-label="Maiores margens">
        {itens.map((i, k) => (
          <li key={i.id} className="flex h-full min-w-[60px] flex-1 flex-col items-center justify-end" title={`${i.nome}: ${valorTxt(i.valor, formato)}`}>
            <span className={`mb-1 whitespace-nowrap text-xs font-bold tabular-nums sm:text-sm ${Number(i.valor) < 0 ? "text-hf-danger" : "text-hf-text"}`}>{valorTxt(i.valor, formato)}</span>
            <div className={`relative flex w-full max-w-[96px] items-end justify-center overflow-hidden rounded-t-xl ${Number(i.valor) < 0 ? "bg-hf-danger" : "gestao-barra"}`} style={{ height: `${Math.max(alturas[k], 26)}%` }}>
              <Foto src={i.foto} icone={i.icone} className="mb-1.5 h-11 w-11 rounded-lg ring-2 ring-white/70 sm:h-14 sm:w-[86%]" />
            </div>
            <span className="mt-1.5 w-full truncate text-center text-[11px] text-hf-muted">{i.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Tons da rosca: vermelho, vermelho escuro, laranja e vermelhos claros.
const TONS = [
  "rgb(var(--hf-accent))",
  "rgb(var(--hf-danger))",
  "var(--gestao-grad-de, rgb(249 115 22))",
  "rgb(var(--hf-accent) / 0.55)",
  "rgb(var(--hf-accent) / 0.28)",
  "rgb(var(--hf-border-strong))",
];

/** Rosca (SVG) com o total no meio e a legenda ao lado. fatias: [{ rotulo, valor, pct }] */
export function Rosca({ fatias = [], total, rotuloTotal }) {
  const raio = 56;
  const volta = 2 * Math.PI * raio;
  let inicio = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-48 w-48 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`${rotuloTotal || "Total"}: ${brl(total)}`}>
          <circle cx="70" cy="70" r={raio} fill="none" stroke="rgb(var(--hf-elevated))" strokeWidth="16" />
          {fatias.map((f, i) => {
            const tam = (f.pct / 100) * volta;
            const el = <circle key={f.rotulo} cx="70" cy="70" r={raio} fill="none" stroke={TONS[i % TONS.length]} strokeWidth="16" strokeDasharray={`${Math.max(tam - 1.5, 0.5)} ${volta}`} strokeDashoffset={-inicio} />;
            inicio += tam;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="max-w-[112px] text-sm font-bold leading-tight tabular-nums text-hf-text">{brl(total)}</p>
            {rotuloTotal && <p className="text-[11px] text-hf-muted">{rotuloTotal}</p>}
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {fatias.map((f, i) => (
          <li key={f.rotulo} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: TONS[i % TONS.length] }} />
            <span className="min-w-0 flex-1 truncate text-hf-text-2">{f.rotulo}{f.agrupadas ? ` (${f.agrupadas})` : ""}</span>
            <span className="shrink-0 text-xs tabular-nums text-hf-muted">{pct(f.pct, 0)}</span>
            <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-hf-text">{brl(f.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais (maiores custos). itens: [{ id, nome, valor }] */
export function BarrasHorizontais({ itens = [], formato = "brl" }) {
  const maior = Math.max(0, ...itens.map((i) => Math.abs(Number(i.valor) || 0)));
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
          <span className="truncate text-hf-text-2" title={i.nome}>{i.nome}</span>
          <span className="h-4 overflow-hidden rounded-md bg-hf-elevated"><span className="gestao-barra-h block h-full rounded-md" style={{ width: `${maior > 0 ? Math.max(4, (Math.abs(i.valor) / maior) * 100) : 0}%` }} /></span>
          <span className="text-right text-xs font-semibold tabular-nums text-hf-text">{valorTxt(i.valor, formato)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Análise do produto/evento: venda, custo, contribuição, margem e lucro. */
export function AnaliseDoItem({ opcoes = [], valor, onChange, analise, rotuloLucro = "Lucro", icone: IconeSemFoto }) {
  const linhas = analise ? [
    { r: "Venda", v: brl(analise.venda) },
    { r: "Custo", v: brl(analise.custo) },
    { r: "Contribuição", v: brl(analise.contribuicao) },
    { r: "Margem de contribuição", v: pct(analise.margemContribuicaoPct, 0), positivo: analise.margemContribuicaoPct > 0 },
    { r: `${rotuloLucro}${analise.lucroPct != null ? ` (${pct(analise.lucroPct, 0)})` : ""}`, v: brl(analise.lucro), positivo: analise.lucro > 0, negativo: analise.lucro < 0 },
  ] : [];
  return (
    <div>
      <select value={valor || ""} onChange={(e) => onChange(e.target.value)} aria-label="Escolha o item"
        className="mb-3 min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-elevated px-3 text-sm font-medium text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15">
        {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
      {!analise ? <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: este item ainda não tem preço e custo completos.</p> : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="hidden h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[rgb(249_115_22)] to-hf-accent sm:block">
            <Foto src={analise.foto} icone={IconeSemFoto} className="h-full w-full" />
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {linhas.map((l) => (
              <li key={l.r} className="flex min-h-[38px] items-center gap-2 rounded-xl bg-hf-elevated px-3 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-hf-accent" />
                <span className="min-w-0 flex-1 truncate text-hf-text-2">{l.r}</span>
                <span className={`shrink-0 font-semibold tabular-nums ${l.negativo ? "text-hf-danger" : l.positivo ? "text-hf-success" : "text-hf-text"}`}>{l.v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Faturamento × custos fixos com o resultado do mês. r: faturamentoContraFixos() */
export function FaturamentoXCustos({ r, rotuloFaturamento = "Faturamento", rotuloFixos = "Custos fixos", rotuloResultado = "Resultado do mês", nota }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between gap-2 text-sm"><span className="text-hf-text-2">{rotuloFaturamento}</span><span className="font-bold tabular-nums text-hf-text">{brl(r.faturamento)}</span></div>
        <div className="mt-1 h-4 overflow-hidden rounded-full bg-hf-elevated"><div className="gestao-barra-h h-full rounded-full" style={{ width: `${r.larguraFaturamento}%` }} /></div>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2 text-sm"><span className="text-hf-text-2">{rotuloFixos}</span><span className="font-bold tabular-nums text-hf-text">{brl(r.custosFixos)}</span></div>
        <div className="mt-1 h-4 overflow-hidden rounded-full bg-hf-elevated"><div className="h-full rounded-full bg-hf-danger" style={{ width: `${r.larguraFixos}%` }} /></div>
      </div>
      <div className="flex items-baseline justify-between gap-2 border-t border-hf-border pt-2 text-sm">
        <span className="text-hf-text-2">{rotuloResultado}</span>
        <span className={`text-lg font-bold tabular-nums ${r.resultado === null ? "text-hf-muted" : r.resultado < 0 ? "text-hf-danger" : "text-hf-success"}`}>{r.resultado === null ? "Dados insuficientes" : brl(r.resultado)}</span>
      </div>
      {nota !== undefined ? (nota && <p className="text-xs text-hf-muted">{nota}</p>)
        : r.coberturaPct !== null && <p className="text-xs text-hf-muted">A contribuição das vendas cobre {pct(r.coberturaPct, 0)} dos custos fixos do mês.</p>}
    </div>
  );
}

/** Custo operacional por dia, hora e minuto. c: custoOperacional() */
export function CustoOperacional({ c, hrefConfig, nota }) {
  if (!c.ok) return <FaltaDado motivo={`Falta informar: ${c.faltando.join(", ")}.`} href={hrefConfig} acao="Preencher em Configurações" />;
  const caixas = [["Por dia", c.dia], ["Por hora", c.hora], ["Por minuto", c.minuto]];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {caixas.map(([r, v]) => (
          <div key={r} className="min-w-0 rounded-xl bg-hf-elevated p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-hf-muted">{r}</p>
            <p className="mt-0.5 break-words text-base font-bold tabular-nums text-hf-accent sm:text-xl">{v === null ? "—" : brl(v)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-hf-muted">{nota || `Equipe e custos fixos (${brl(c.mes)} no mês) divididos pelos dias e horas de operação.`}{c.faltando.length ? ` Para ver por hora e por minuto, informe as ${c.faltando[0]}.` : ""}</p>
      {c.faltando.length > 0 && hrefConfig && <Link href={hrefConfig} className="inline-flex min-h-[40px] items-center text-xs font-semibold text-hf-accent hover:underline">Informar em Configurações →</Link>}
    </div>
  );
}

/** Ponto de equilíbrio sem e com lucro. p: pontosDeEquilibrio() */
export function PontoDeEquilibrio({ p, unidade = "vendas", hrefConfig }) {
  if (!p.ok) return <FaltaDado motivo={p.motivo} href={hrefConfig} acao="Preencher em Configurações" />;
  const Linha = ({ sigla, rotulo, ponto, motivo }) => (
    <div className="flex min-h-[52px] items-center gap-3 rounded-xl bg-hf-elevated px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-hf-text-2">{rotulo} <span className="text-hf-muted">({sigla})</span></p>
        {ponto?.faturamentoMes != null && <p className="text-[11px] text-hf-muted">{brl(ponto.faturamentoMes)} de vendas no mês{ponto.unidadesDia != null ? ` · ${inteiro(ponto.unidadesDia)} por dia` : ""}</p>}
        {!ponto && motivo && <p className="text-[11px] text-hf-muted">{motivo}</p>}
      </div>
      <p className="shrink-0 text-base font-bold tabular-nums text-hf-text">{ponto ? `${inteiro(ponto.unidadesMes)} ${unidade}` : "—"}</p>
    </div>
  );
  return (
    <div className="space-y-2">
      <Linha sigla="PEC" rotulo="Ponto de equilíbrio sem lucro" ponto={p.sem} />
      <Linha sigla="PEE" rotulo="Ponto de equilíbrio com lucro" ponto={p.com} motivo={p.motivoCom} />
      <p className="text-xs text-hf-muted">Cada venda deixa {brl(p.contribuicao)} de contribuição{p.com ? `; a meta é ${brl(p.com.lucroMetaPorUnidade)} de lucro por venda` : ""}.</p>
    </div>
  );
}
