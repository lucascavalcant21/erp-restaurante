"use client";

// Peças visuais do módulo Marmitaria, sobre os tokens hf-* do Héfisto:
// fundo creme, cartões brancos, verde como cor de ação. Número financeiro
// sempre com tabular-nums; valor sem dado diz que não há dado.

import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

export const brl = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—"
  : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const pctTxt = (v, dec = 1) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—"
  : `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`);
export const num = (v, dec = 3) => (v === null || v === undefined ? "—"
  : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: dec }));

const NATUREZA = {
  real: { rotulo: "Real", cls: "bg-hf-accent/10 text-hf-accent" },
  estimado: { rotulo: "Estimativa", cls: "bg-hf-warning/10 text-hf-warning" },
  estimativa: { rotulo: "Estimativa", cls: "bg-hf-warning/10 text-hf-warning" },
  simulacao: { rotulo: "Simulação", cls: "bg-hf-elevated text-hf-text-2" },
  previsto: { rotulo: "Previsto pela ficha", cls: "bg-hf-elevated text-hf-text-2" },
};

export function Selo({ natureza }) {
  const n = NATUREZA[natureza];
  if (!n) return null;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${n.cls}`}>{n.rotulo}</span>;
}

export function Cartao({ children, className = "", ...rest }) {
  return <div className={`rounded-2xl border border-hf-border bg-hf-surface p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.04)] min-w-0 ${className}`} {...rest}>{children}</div>;
}

export function Secao({ titulo, subtitulo, direita, children, className = "" }) {
  return (
    <Cartao className={className}>
      {(titulo || direita) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-bold text-hf-text">{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-xs text-hf-muted">{subtitulo}</p>}
          </div>
          {direita}
        </div>
      )}
      {children}
    </Cartao>
  );
}

// Abas contextuais: quebram linha em vez de rolar para o lado.
export function Abas({ abas, valor, onChange }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-hf-elevated p-1">
      {abas.map((a) => (
        <button key={a.id} role="tab" aria-selected={valor === a.id} onClick={() => onChange(a.id)}
          className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${valor === a.id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2 hover:text-hf-text"}`}>
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Indicador({ rotulo, valor, natureza, nota, formato = "brl", destaque = false }) {
  const semDado = valor === null || valor === undefined;
  const texto = semDado ? "Sem dados apurados" : formato === "pct" ? pctTxt(valor) : formato === "int" ? num(valor, 0) : brl(valor);
  return (
    <Cartao className={destaque ? "border-hf-accent/40" : ""}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-hf-muted">{rotulo}</p>
        {!semDado && <Selo natureza={natureza} />}
      </div>
      <p className={`mt-2 tabular-nums ${semDado ? "text-sm font-semibold text-hf-muted" : `text-2xl font-black ${Number(valor) < 0 ? "text-hf-danger" : "text-hf-text"}`}`}>{texto}</p>
      {nota && <p className="mt-1 text-xs text-hf-muted">{nota}</p>}
    </Cartao>
  );
}

export function Aviso({ tipo = "info", children, className = "" }) {
  const alerta = tipo === "alerta";
  const Icone = alerta ? AlertTriangle : Info;
  return (
    <div className={`flex gap-2 rounded-xl border px-3 py-2.5 text-sm ${alerta ? "border-hf-warning/30 bg-hf-warning/5 text-hf-text" : "border-hf-border bg-hf-elevated/60 text-hf-text-2"} ${className}`}>
      <Icone size={16} className={`mt-0.5 flex-shrink-0 ${alerta ? "text-hf-warning" : "text-hf-muted"}`} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SemDados({ titulo = "Sem dados apurados", motivo, href, acao }) {
  return (
    <div className="rounded-xl border border-dashed border-hf-border-strong bg-hf-surface/60 p-4 text-sm">
      <p className="font-semibold text-hf-text">{titulo}</p>
      {motivo && <p className="mt-1 text-hf-muted">{motivo}</p>}
      {href && acao && <Link href={href} className="mt-2 inline-block font-semibold text-hf-accent hover:underline">{acao} →</Link>}
    </div>
  );
}

export function Botao({ children, variante = "primario", className = "", ...rest }) {
  const v = variante === "secundario"
    ? "border border-hf-border bg-hf-surface text-hf-text hover:bg-hf-elevated"
    : variante === "perigo" ? "border border-hf-danger/30 bg-hf-surface text-hf-danger hover:bg-hf-danger/5"
      : variante === "texto" ? "text-hf-accent hover:bg-hf-accent/5"
        : "bg-hf-accent text-hf-accent-fg hover:brightness-110";
  return (
    <button className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Campo({ rotulo, dica, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-hf-text-2">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[11px] text-hf-muted">{dica}</span>}
    </label>
  );
}

export const inputCls = "w-full min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none transition focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15";

// Número digitado com vírgula ou ponto → Number (vazio vira "").
export function lerNumero(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return "";
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : "";
}

// Guarda o TEXTO digitado ("0,05" passa por "0,0" sem virar zero); quem
// calcula lê com parseNumero/lerNumero.
export function CampoNumero({ valor, onChange, className = "", ...rest }) {
  const mostrar = valor === null || valor === undefined ? "" : typeof valor === "number" ? String(valor).replace(".", ",") : valor;
  return (
    <input inputMode="decimal" className={`${inputCls} tabular-nums ${className}`} value={mostrar}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9,.]/g, ""))} {...rest} />
  );
}
