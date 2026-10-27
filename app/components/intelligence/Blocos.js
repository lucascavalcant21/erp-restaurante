"use client";

// Peças visuais das respostas do Héfisto. Toda métrica mostra de onde veio:
// fonte, período, consulta, unidade, confiança e horário da apuração — e
// "Dados parciais" / "DADOS INSUFICIENTES" escritos, nunca escondidos.

import { memo, useState } from "react";
import { ChevronDown, Database, AlertTriangle, Info } from "lucide-react";

// Formatadores instanciados uma única vez no módulo (até 15x mais rápidos que toLocaleString por render)
const FMT_BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FMT_NUM_1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const FMT_NUM_3 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const FMT_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const FMT_DATA_HORA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const brl = (v) => FMT_BRL.format(Number(v) || 0);
export const num = (v, casas = 3) => {
  const n = Number(v) || 0;
  if (casas === 1) return FMT_NUM_1.format(n);
  if (casas === 3) return FMT_NUM_3.format(n);
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
};
const hora = (iso) => (iso ? FMT_HORA.format(new Date(iso)) : "—");
const dataHora = (iso) => (iso ? FMT_DATA_HORA.format(new Date(iso)) : "—");

export function valorDaMetrica(m) {
  if (!m || m.valor == null) return null;
  switch (m.unidade) {
    case "BRL": return brl(m.valor);
    case "%": return `${num(m.valor, 1)}%`;
    case "lotes": return `${m.valor} lote${m.valor === 1 ? "" : "s"}`;
    case "itens": return `${m.valor} ${m.valor === 1 ? "item" : "itens"}`;
    default: return `${num(m.valor)} ${m.unidade}`;
  }
}

const COBERTURA = {
  completos: { rotulo: "Dados completos", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200/80" },
  parciais: { rotulo: "Dados parciais", cls: "bg-amber-50 text-amber-800 ring-amber-200/80" },
  insuficientes: { rotulo: "Dados insuficientes", cls: "bg-hf-elevated text-hf-text-2 ring-hf-border" },
};

export const SeloCobertura = memo(function SeloCobertura({ cobertura }) {
  const c = COBERTURA[cobertura];
  if (!c) return null;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${c.cls}`}>{c.rotulo}</span>;
});

const NATUREZA = { ESTIMATIVA: "ESTIMATIVA", PROJECAO: "PROJEÇÃO", SIMULACAO: "SIMULAÇÃO", META: "META", SUGESTAO: "SUGESTÃO" };
export const SeloNatureza = memo(function SeloNatureza({ natureza }) {
  if (!NATUREZA[natureza]) return null;
  return <span className="inline-flex items-center rounded-full bg-hf-elevated px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-hf-text ring-1 ring-emerald-200">{NATUREZA[natureza]}</span>;
});

const CONFIANCA = { alta: "alta", media: "média", baixa: "baixa", nenhuma: "—" };

/** "De onde veio este número?" — recolhido por padrão, sempre disponível. */
export const Procedencia = memo(function Procedencia({ m }) {
  const [aberto, setAberto] = useState(false);
  if (!m) return null;
  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-1.5 -ml-1.5 text-[12px] font-semibold text-hf-text-2 transition-colors hover:bg-hf-elevated hover:text-hf-text"
      >
        <Database size={13} /> De onde veio
        <ChevronDown size={13} className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <dl className="hf-animate-in mt-1.5 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-xl border border-hf-border bg-hf-elevated/60 p-3 text-[12px] text-hf-text">
          <dt className="font-semibold text-hf-text-2">Fonte</dt><dd>{(m.fontes || []).map((f) => f.descricao || f.tabela).join(" · ") || "—"}</dd>
          <dt className="font-semibold text-hf-text-2">Período</dt><dd>{m.periodo?.rotulo || (m.periodo ? `${m.periodo.de} a ${m.periodo.ate}` : "—")}</dd>
          <dt className="font-semibold text-hf-text-2">Unidade</dt><dd>{m.escopo?.unidadeId || "—"}</dd>
          <dt className="font-semibold text-hf-text-2">Confiança</dt><dd>{CONFIANCA[m.confianca] || "—"}{m.completude != null && m.completude < 1 ? ` (${Math.round(m.completude * 100)}% dos dados)` : ""}</dd>
          <dt className="font-semibold text-hf-text-2">Apurado</dt><dd>{dataHora(m.apuradoEm)}</dd>
          <dt className="font-semibold text-hf-text-2">Consulta</dt>
          <dd className="break-words font-mono text-[11px] text-hf-text-2">
            {(m.consultas || []).slice(0, 6).map((c, i) => (
              <div key={i}>{c.tabela}{c.filtros?.length ? ` · ${c.filtros.map((f) => f.join(" ")).join(", ")}` : ""}{c.linhas != null ? ` → ${c.linhas} linha(s)` : ""}</div>
            ))}
            {!m.consultas?.length && "—"}
          </dd>
        </dl>
      )}
    </div>
  );
});

/** Cartão de uma métrica (indicador do resumo ou bloco de resposta). */
export const MetricaCartao = memo(function MetricaCartao({ rotulo, m, compacto = false }) {
  if (!m) return null;
  const valor = valorDaMetrica(m);
  const insuf = m.status === "insuficiente";
  const semPerm = m.status === "sem_permissao";
  return (
    <div className={`rounded-2xl border border-hf-border bg-hf-surface transition-shadow duration-200 ${compacto ? "p-3.5" : "p-4 sm:p-5"}`}>
      <div className={`flex items-start justify-between gap-2 ${compacto ? "flex-col min-[480px]:flex-row" : ""}`}>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-hf-text-2">{rotulo}</span>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <SeloNatureza natureza={m.natureza} />
          {!semPerm && <SeloCobertura cobertura={m.cobertura} />}
        </div>
      </div>
      {semPerm ? (
        <p className="mt-2 text-sm text-hf-text-2">Sem permissão para ver este dado.</p>
      ) : insuf ? (
        <div className="mt-2">
          <p className={`${compacto ? "text-[12px]" : "text-[13px]"} font-black tracking-wide text-hf-text`}>DADOS INSUFICIENTES</p>
          <p className={`mt-1 text-[13px] leading-snug text-hf-text-2 ${compacto ? "line-clamp-3" : ""}`} title={m.motivo}>{m.motivo}</p>
        </div>
      ) : (
        <div className="mt-1.5">
          <p className={`${compacto ? "text-lg sm:text-xl" : "text-2xl sm:text-[26px]"} break-words font-black tabular-nums tracking-tight text-hf-text`}>{valor}</p>
          {m.comparacao && (
            <p className="mt-1 text-[12px] font-semibold text-hf-text-2">
              {m.comparacao.unidadeDiferenca === "p.p."
                ? `${m.comparacao.diferenca > 0 ? "+" : ""}${num(m.comparacao.diferenca, 1)} p.p.`
                : m.comparacao.diferencaPct != null ? `${m.comparacao.diferencaPct > 0 ? "+" : ""}${num(m.comparacao.diferencaPct, 1)}%` : ""}
              {" "}vs {m.comparacao.periodo?.rotulo}
            </p>
          )}
          {m.detalhes?.atingimento && (
            m.detalhes.atingimento.status === "ok"
              ? <p className="mt-1 text-[13px] font-bold text-hf-text">Atingimento: {num(m.detalhes.atingimento.pct, 1)}% <span className="font-normal text-hf-text-2">(faturamento real ÷ meta)</span></p>
              : <p className="mt-1 text-[12px] text-hf-text-2"><span className="font-bold">Atingimento:</span> DADOS INSUFICIENTES — {m.detalhes.atingimento.motivo}</p>
          )}
          {m.detalhes?.mes?.pct != null && <p className="mt-0.5 text-[12px] text-hf-text-2">Mês: {num(m.detalhes.mes.pct, 1)}% de {brl(m.detalhes.mes.meta)}{m.detalhes.mes.cobertura === "parciais" ? " (dados parciais)" : ""}</p>}
          {m.periodo?.rotulo && <p className="mt-1 text-[12px] text-hf-muted">{m.periodo.rotulo} · apurado às {hora(m.apuradoEm)}</p>}
          {(m.observacoes || []).slice(0, compacto ? 1 : 2).map((o, i) => (
            <p key={i} className="mt-1.5 flex gap-1.5 text-[12px] font-medium leading-snug text-hf-warning" title={o}><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span className={compacto ? "line-clamp-3" : ""}>{o}</span></p>
          ))}
        </div>
      )}
      {!semPerm && <Procedencia m={m} />}
    </div>
  );
});

export const ListaBloco = memo(function ListaBloco({ titulo, itens }) {
  if (!itens?.length) return null;
  return (
    <div className="rounded-2xl border border-hf-border bg-hf-surface p-3.5 sm:p-4">
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-hf-text-2">{titulo}</p>
      <ul className="divide-y divide-hf-border">
        {itens.map((it, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-hf-text">{it.rotulo}</p>
              {it.detalhe && <p className="text-[12px] text-hf-text-2">{it.detalhe}</p>}
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-hf-text">{it.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export const TextoBloco = memo(function TextoBloco({ texto, qualificador }) {
  const mostrar = qualificador && !String(texto || "").startsWith(qualificador);
  return (
    <div className="flex gap-2 rounded-2xl border border-hf-border bg-hf-elevated/60 p-3.5 text-[13px] leading-snug text-hf-text">
      <Info size={15} className="mt-0.5 shrink-0 text-hf-text-2" />
      <p>{mostrar && <span className="font-bold text-hf-text">{qualificador}: </span>}{texto}</p>
    </div>
  );
});
