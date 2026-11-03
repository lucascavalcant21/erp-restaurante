"use client";

import { memo, useState } from "react";
import { Loader2 } from "lucide-react";

const FMT_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const BotaoConversa = memo(function BotaoConversa({ children, onClick, tipo = "secundario", disabled, className = "", type = "button" }) {
  const estilos = {
    primario: "bg-hf-accent text-hf-accent-fg shadow-xs hover:bg-emerald-800",
    perigo: "bg-hf-danger text-white shadow-xs hover:bg-rose-800",
    secundario: "border border-hf-border-strong bg-hf-surface text-hf-text hover:border-hf-accent hover:text-hf-accent",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] rounded-xl px-4 text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-50 ${estilos[tipo] || estilos.secundario} ${className}`}
    >
      {children}
    </button>
  );
});

export const RespostaLivreForm = memo(function RespostaLivreForm({ pergunta, onEnviar, desabilitado }) {
  const [valor, setValor] = useState("");
  const numerico = pergunta.campo === "quantidade";
  return (
    <form
      className="mt-2.5 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor.trim()) {
          onEnviar(valor.trim());
          setValor("");
        }
      }}
    >
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        disabled={desabilitado}
        inputMode={numerico ? "decimal" : "text"}
        placeholder={numerico ? "Ex.: 2,5" : "Digite aqui"}
        className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-hf-border-strong bg-hf-surface px-3.5 text-[15px] text-hf-text focus:border-hf-accent focus:outline-none focus:ring-2 focus:ring-hf-accent/20"
      />
      <BotaoConversa type="submit" tipo="primario" disabled={desabilitado || !valor.trim()}>
        OK
      </BotaoConversa>
    </form>
  );
});

const ConfirmacaoAcaoCard = memo(function ConfirmacaoAcaoCard({ c, onConfirmar, onCancelar, ocupado }) {
  const [texto, setTexto] = useState("");
  const horarioExpiracao = c.expiraEm ? FMT_HORA.format(new Date(c.expiraEm)) : "—";

  return (
    <div className="hf-animate-in mt-2.5 rounded-2xl border-2 border-hf-accent bg-hf-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-black text-hf-text">{c.titulo}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${
            c.risco === "HIGH" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {c.risco === "HIGH" ? "Risco alto" : "Confirmação necessária"}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 rounded-xl bg-hf-elevated/60 p-3">
        {(c.linhas || []).map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-[13px] sm:text-[14px]">
            <dt className="font-medium text-hf-text-2">{l.rotulo}</dt>
            <dd className="text-right font-bold tabular-nums text-hf-text">{l.valor}</dd>
          </div>
        ))}
      </dl>
      {c.confirmacaoExplicita && (
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite CONFIRMAR"
          className="mt-3 min-h-[44px] w-full rounded-xl border border-hf-border-strong bg-hf-surface px-3.5 text-[15px] font-bold text-hf-text focus:border-hf-accent focus:outline-none"
        />
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <BotaoConversa tipo="secundario" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </BotaoConversa>
        <BotaoConversa
          tipo="primario"
          onClick={() => onConfirmar(c.confirmacaoExplicita ? texto : null)}
          disabled={ocupado || (c.confirmacaoExplicita && texto !== "CONFIRMAR")}
        >
          {ocupado ? <Loader2 size={18} className="mx-auto animate-spin" /> : "Confirmar"}
        </BotaoConversa>
      </div>
      <p className="mt-2.5 text-[11px] leading-snug text-hf-muted">
        Nada é gravado antes de confirmar. Expira às {horarioExpiracao}.
        {c.rollback ? ` Para desfazer: ${c.rollback}` : ""}
      </p>
    </div>
  );
});

export default ConfirmacaoAcaoCard;
