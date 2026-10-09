"use client";

// Peças visuais das respostas do Héfisto. Toda métrica mostra de onde veio:
// fonte, período, consulta, unidade, confiança e horário da apuração — e
// "Dados parciais" / "DADOS INSUFICIENTES" escritos, nunca escondidos.

import { useState } from "react";
import { ChevronDown, Database, AlertTriangle, Info } from "lucide-react";

export const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (v, casas = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

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
  completos: { rotulo: "Dados completos", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  parciais: { rotulo: "Dados parciais", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  insuficientes: { rotulo: "Dados insuficientes", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
};

export function SeloCobertura({ cobertura }) {
  const c = COBERTURA[cobertura];
  if (!c) return null;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${c.cls}`}>{c.rotulo}</span>;
}

const NATUREZA = { ESTIMATIVA: "ESTIMATIVA", PROJECAO: "PROJEÇÃO", SIMULACAO: "SIMULAÇÃO", META: "META", SUGESTAO: "SUGESTÃO" };
export function SeloNatureza({ natureza }) {
  if (!NATUREZA[natureza]) return null;
  return <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-violet-800 ring-1 ring-violet-200">{NATUREZA[natureza]}</span>;
}

const CONFIANCA = { alta: "alta", media: "média", baixa: "baixa", nenhuma: "—" };

/** "De onde veio este número?" — recolhido por padrão, sempre disponível. */
export function Procedencia({ m }) {
  const [aberto, setAberto] = useState(false);
  if (!m) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setAberto((v) => !v)} className="inline-flex min-h-[32px] items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-800">
        <Database size={13} /> De onde veio
        <ChevronDown size={13} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-xl bg-slate-50 p-3 text-[12px] text-slate-700">
          <dt className="font-semibold text-slate-500">Fonte</dt><dd>{(m.fontes || []).map((f) => f.descricao || f.tabela).join(" · ") || "—"}</dd>
          <dt className="font-semibold text-slate-500">Período</dt><dd>{m.periodo?.rotulo || (m.periodo ? `${m.periodo.de} a ${m.periodo.ate}` : "—")}</dd>
          <dt className="font-semibold text-slate-500">Unidade</dt><dd>{m.escopo?.unidadeId || "—"}</dd>
          <dt className="font-semibold text-slate-500">Confiança</dt><dd>{CONFIANCA[m.confianca] || "—"}{m.completude != null && m.completude < 1 ? ` (${Math.round(m.completude * 100)}% dos dados)` : ""}</dd>
          <dt className="font-semibold text-slate-500">Apurado</dt><dd>{dataHora(m.apuradoEm)}</dd>
          <dt className="font-semibold text-slate-500">Consulta</dt>
          <dd className="break-words font-mono text-[11px] text-slate-600">
            {(m.consultas || []).slice(0, 6).map((c, i) => (
              <div key={i}>{c.tabela}{c.filtros?.length ? ` · ${c.filtros.map((f) => f.join(" ")).join(", ")}` : ""}{c.linhas != null ? ` → ${c.linhas} linha(s)` : ""}</div>
            ))}
            {!m.consultas?.length && "—"}
          </dd>
        </dl>
      )}
    </div>
  );
}

/** Cartão de uma métrica (indicador do resumo ou bloco de resposta). */
export function MetricaCartao({ rotulo, m, compacto = false }) {
  if (!m) return null;
  const valor = valorDaMetrica(m);
  const insuf = m.status === "insuficiente";
  const semPerm = m.status === "sem_permissao";
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compacto ? "p-3" : "p-4"}`}>
      <div className={`flex items-start justify-between gap-2 ${compacto ? "flex-col min-[480px]:flex-row" : ""}`}>
        <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{rotulo}</span>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <SeloNatureza natureza={m.natureza} />
          {!semPerm && <SeloCobertura cobertura={m.cobertura} />}
        </div>
      </div>
      {semPerm ? (
        <p className="mt-2 text-sm text-slate-500">Sem permissão para ver este dado.</p>
      ) : insuf ? (
        <div className="mt-2">
          <p className={`${compacto ? "text-[12px]" : "text-[13px]"} font-black tracking-wide text-slate-700`}>DADOS INSUFICIENTES</p>
          <p className={`mt-1 text-[13px] leading-snug text-slate-600 ${compacto ? "line-clamp-3" : ""}`} title={m.motivo}>{m.motivo}</p>
        </div>
      ) : (
        <div className="mt-1">
          <p className={`${compacto ? "text-lg sm:text-xl" : "text-2xl"} break-words font-black tabular-nums text-slate-900`}>{valor}</p>
          {m.comparacao && (
            <p className="mt-0.5 text-[12px] text-slate-600">
              {m.comparacao.unidadeDiferenca === "p.p."
                ? `${m.comparacao.diferenca > 0 ? "+" : ""}${num(m.comparacao.diferenca, 1)} p.p.`
                : m.comparacao.diferencaPct != null ? `${m.comparacao.diferencaPct > 0 ? "+" : ""}${num(m.comparacao.diferencaPct, 1)}%` : ""}
              {" "}vs {m.comparacao.periodo?.rotulo}
            </p>
          )}
          {m.detalhes?.atingimento && (
            m.detalhes.atingimento.status === "ok"
              ? <p className="mt-0.5 text-[13px] font-bold text-slate-800">Atingimento: {num(m.detalhes.atingimento.pct, 1)}% <span className="font-normal text-slate-500">(faturamento real ÷ meta)</span></p>
              : <p className="mt-0.5 text-[12px] text-slate-600"><span className="font-bold">Atingimento:</span> DADOS INSUFICIENTES — {m.detalhes.atingimento.motivo}</p>
          )}
          {m.detalhes?.mes?.pct != null && <p className="mt-0.5 text-[12px] text-slate-600">Mês: {num(m.detalhes.mes.pct, 1)}% de {brl(m.detalhes.mes.meta)}{m.detalhes.mes.cobertura === "parciais" ? " (dados parciais)" : ""}</p>}
          {m.periodo?.rotulo && <p className="mt-0.5 text-[12px] text-slate-500">{m.periodo.rotulo} · apurado às {hora(m.apuradoEm)}</p>}
          {(m.observacoes || []).slice(0, compacto ? 1 : 2).map((o, i) => (
            <p key={i} className="mt-1 flex gap-1 text-[12px] leading-snug text-amber-800" title={o}><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span className={compacto ? "line-clamp-3" : ""}>{o}</span></p>
          ))}
        </div>
      )}
      {!semPerm && <Procedencia m={m} />}
    </div>
  );
}

export function ListaBloco({ titulo, itens }) {
  if (!itens?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
      <ul className="divide-y divide-slate-100">
        {itens.map((it, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{it.rotulo}</p>
              {it.detalhe && <p className="text-[12px] text-slate-500">{it.detalhe}</p>}
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{it.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TextoBloco({ texto, qualificador }) {
  const mostrar = qualificador && !String(texto || "").startsWith(qualificador);
  return (
    <div className="flex gap-2 rounded-2xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-700">
      <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <p>{mostrar && <span className="font-bold text-slate-800">{qualificador}: </span>}{texto}</p>
    </div>
  );
}
