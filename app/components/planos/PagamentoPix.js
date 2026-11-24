"use client";

// Pagar a assinatura por Pix (pedido do dono, 14/11/2026: "por enquanto vai
// ser no Nubank, chave Pix"). Mostra o valor do período escolhido, a chave
// (pedida ao servidor só na hora, só para o administrador) e o botão para
// mandar o comprovante no WhatsApp comercial. A liberação do plano é manual,
// depois que o comprovante chega: esta tela não grava nada.

import { useState } from "react";
import { Check, Copy, Loader2, MessageCircle, QrCode } from "lucide-react";
import { fetchComSessao } from "../../lib/api-sessao";
import { linkComprovante, precoNoPeriodo, reais } from "../../lib/planos.mjs";

const WHATSAPP_COMERCIAL = process.env.NEXT_PUBLIC_HEFISTO_WHATSAPP_COMERCIAL || "";

export default function PagamentoPix({ plano, periodo, empresa }) {
  const [estado, setEstado] = useState({ aberto: false, carregando: false, chave: null, banco: null, erro: null });
  const [copiado, setCopiado] = useState(null);
  const preco = precoNoPeriodo(plano, periodo);
  const comprovante = linkComprovante(WHATSAPP_COMERCIAL, { plano, periodo, empresa });

  async function abrir() {
    setEstado((e) => ({ ...e, aberto: true, carregando: !e.chave, erro: null }));
    if (estado.chave) return;
    try {
      const r = await fetchComSessao("/api/assinatura/pix");
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.error || "Não foi possível carregar a chave Pix.");
      setEstado({ aberto: true, carregando: false, chave: dados.chave, banco: dados.banco, erro: null });
    } catch (e) {
      setEstado({ aberto: true, carregando: false, chave: null, banco: null, erro: e.message });
    }
  }

  async function copiar(texto, qual) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 2000);
    } catch { /* sem permissão de copiar: o texto continua à vista */ }
  }

  if (!estado.aberto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-hf-surface text-base font-semibold text-hf-text transition hover:bg-hf-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
      >
        <QrCode size={18} aria-hidden="true" /> Pagar {reais(preco.totalCentavos)} com Pix
      </button>
    );
  }

  const linhaCopiar = (rotulo, valor, qual) => (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-xs text-white/70">{rotulo}</span>
        <span className="block break-all text-lg font-semibold tracking-tight">{valor}</span>
      </span>
      <button
        type="button"
        onClick={() => copiar(qual === "valor" ? (preco.totalCentavos / 100).toFixed(2).replace(".", ",") : valor, qual)}
        aria-label={`Copiar ${rotulo.toLowerCase()}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 text-white shadow-none hover:bg-white/10"
      >
        {copiado === qual ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      </button>
    </div>
  );

  return (
    <div className="space-y-3 rounded-[22px] border border-white/20 p-4 text-white">
      <p className="text-sm font-semibold">Pagamento por Pix · {preco.periodo.nome}</p>
      {estado.carregando && (
        <p className="flex items-center gap-2 text-sm text-white/80"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Carregando a chave Pix…</p>
      )}
      {estado.erro && <p className="text-sm text-white/80">{estado.erro}</p>}
      {estado.chave && (
        <>
          {linhaCopiar("Valor", reais(preco.totalCentavos), "valor")}
          {linhaCopiar(`Chave Pix${estado.banco ? ` (${estado.banco})` : ""}`, estado.chave, "chave")}
          <ol className="list-decimal space-y-1 pl-5 text-sm text-white/80">
            <li>No app do seu banco, escolha Pix e cole a chave.</li>
            <li>Confira o valor e pague.</li>
            <li>Mande o comprovante no WhatsApp. O plano é liberado depois da conferência.</li>
          </ol>
          {comprovante && (
            <a
              href={comprovante}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-hf-surface text-base font-semibold text-hf-text transition hover:bg-hf-elevated"
            >
              <MessageCircle size={18} aria-hidden="true" /> Enviar comprovante
            </a>
          )}
        </>
      )}
      <p className="text-xs text-white/60">Cartão de crédito e débito: em breve.</p>
    </div>
  );
}
