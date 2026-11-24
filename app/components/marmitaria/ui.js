"use client";

// Peças visuais do módulo Marmitaria, sobre os tokens hf-* do Héfisto:
// fundo creme, cartões brancos, verde como cor de ação. Número financeiro
// sempre com tabular-nums; valor sem dado diz que não há dado.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

export const brl = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—"
  : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const pctTxt = (v, dec = 1) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—"
  : `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`);
export const markupPctTxt = (m) => (m === null || m === undefined || !Number.isFinite(Number(m)) ? "—"
  : `${((Number(m) - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`);
export const num = (v, dec = 3) => (v === null || v === undefined ? "—"
  : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: dec }));

// Markup = preço ÷ custo técnico. Sem custo completo, não há número.
export const markupTxt = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—"
  : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×`);

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

// Abas contextuais: quebram linha em vez de rolar para o lado. O rótulo não
// quebra ("Planejar e comprar" em três linhas no celular): a aba inteira
// desce para a linha de baixo.
export function Abas({ abas, valor, onChange }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-hf-elevated p-1 sm:inline-flex sm:max-w-full">
      {abas.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={valor === a.id} onClick={() => onChange(a.id)}
          className={`min-h-[40px] flex-auto whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition sm:min-h-[34px] sm:flex-none sm:px-4 ${valor === a.id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2 hover:text-hf-text"}`}>
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
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 text-xs font-semibold uppercase tracking-wide text-hf-muted">{rotulo}</p>
        {!semDado && <Selo natureza={natureza} />}
      </div>
      <p className={`mt-2 break-words tabular-nums ${semDado ? "text-sm font-semibold text-hf-muted" : `text-xl font-black sm:text-2xl ${Number(valor) < 0 ? "text-hf-danger" : "text-hf-text"}`}`}>{texto}</p>
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
// Vírgula automática (dono, 17/11/2026): ponto digitado vira vírgula na hora,
// só fica uma vírgula, e ao sair do campo ",5" vira "0,5" e "2," vira "2".
export function textoNumerico(t) {
  let s = String(t ?? "").replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const i = s.indexOf(",");
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, "");
  return s;
}
export function textoNumericoFinal(t) {
  let s = textoNumerico(t);
  if (s.startsWith(",")) s = `0${s}`;
  if (s.endsWith(",")) s = s.slice(0, -1);
  return s;
}

/** "3000" → "3.000"; "5989,31" → "5.989,31" (só para mostrar; o valor guardado não muda). */
export function comMilhar(t) {
  const s = String(t ?? "");
  if (!s) return s;
  const [int, dec] = s.split(",");
  const comPontos = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec === undefined ? comPontos : `${comPontos},${dec}`;
}

// Dono, 21/11/2026: "por cifras e unidades" → R$ na frente, unidade atrás,
// e milhar com ponto quando o campo não está sendo digitado.
export function CampoNumero({ valor, onChange, className = "", onBlur, onFocus, prefixo = "", sufixo = "", ...rest }) {
  const [focado, setFocado] = useState(false);
  const cru = valor === null || valor === undefined ? "" : typeof valor === "number" ? String(valor).replace(".", ",") : valor;
  const mostrar = focado ? cru : comMilhar(cru);
  const entrada = (
    <input inputMode="decimal" className={`${inputCls} tabular-nums ${prefixo ? "pl-11" : ""} ${sufixo ? (String(sufixo).length <= 2 ? "pr-9" : "pr-20") : ""} ${className}`} value={mostrar}
      onFocus={(e) => { setFocado(true); onFocus?.(e); }}
      onChange={(e) => onChange(textoNumerico(e.target.value))}
      onBlur={(e) => { setFocado(false); const f = textoNumericoFinal(e.target.value); if (f !== cru) onChange(f); onBlur?.(e); }} {...rest} />
  );
  if (!prefixo && !sufixo) return entrada;
  return (
    <div className="relative min-w-0">
      {prefixo && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-hf-muted">{prefixo}</span>}
      {entrada}
      {sufixo && <span className="pointer-events-none absolute right-3.5 top-1/2 max-w-[70px] -translate-y-1/2 truncate text-right text-sm font-semibold text-hf-muted">{sufixo}</span>}
    </div>
  );
}
