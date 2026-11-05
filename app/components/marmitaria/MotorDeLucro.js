"use client";

// Recomendações do Motor de Lucro. A conta acontece no servidor.

import { useEffect, useMemo, useState } from "react";
import { Secao, Selo, brl } from "./ui";
import { fetchComSessao } from "../../lib/api-sessao";
import { simularOferta } from "../../lib/marmitaria/promocoes.mjs";
import { precoSugerido } from "../../lib/marmitaria/nucleo.mjs";

const CONFIANCA = { alta: "Muitas vendas", media: "Algumas vendas", baixa: "Poucas vendas" };

export default function MotorDeLucro({ painel, linhas, comum, metaPct, mudancas }) {
  const [recs, setRecs] = useState(null);
  const [erro, setErro] = useState(null);

  const entrada = useMemo(() => {
    const itens = painel.pratos.map((p) => {
      const l = linhas.find((x) => x.id === p.id);
      const item = l?.itens?.[0];
      const embutido = item?.grupo === "marmita" ? comum.embutidos?.totalPorMarmita || 0 : 0;
      const sug = metaPct != null && item?.custo != null ? precoSugerido({ custoTecnico: item.custo + embutido, canal: { ...comum.canal, itens_por_pedido: 1 }, tributosPct: comum.tributosPct, margemAlvoPct: metaPct }).preco : null;
      const lucroNoPrecoDaMeta = sug ? simularOferta({ itens: [{ ...item, preco: sug, qtd: 1 }], oferta: { tipo: "nenhuma" }, ...comum }).com.lucro : null;
      return { id: p.id, nome: p.nome, preco: l?.precoPago, lucro: p.lucro, lucroPct: p.lucroPct, vendidas: p.vendidas, precoParaMeta: sug, lucroNoPrecoDaMeta };
    });
    return { metaPct, itens, combos: painel.combos, promocoes: painel.promocoes, mudancas };
  }, [painel, linhas, comum, metaPct, mudancas]);

  useEffect(() => {
    let vivo = true;
    const pedir = async () => {
      const resposta = await fetchComSessao("/api/marmitaria/motor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) });
      const json = await resposta.json().catch(() => ({}));
      if (!vivo) return;
      if (!resposta.ok) { setErro(json.error || "O Motor de Lucro não respondeu."); return; }
      setErro(null); setRecs(json.recomendacoes || []);
    };
    pedir().catch(() => { if (vivo) setErro("O Motor de Lucro não respondeu."); });
    return () => { vivo = false; };
  }, [entrada]);

  return (
    <Secao titulo="Motor de Lucro" subtitulo="O que fazer primeiro para ganhar mais." direita={<Selo natureza="estimado" />}>
      {erro && <p className="text-sm font-semibold text-hf-danger">{erro}</p>}
      {!erro && recs === null && <p className="text-sm text-hf-text-2">Calculando…</p>}
      {!erro && recs?.length === 0 && <p className="text-sm text-hf-text-2">Nenhuma ação recomendada agora.</p>}
      {recs?.length > 0 && (
        <ol className="space-y-2">
          {recs.map((r, i) => (
            <li key={r.id} className={`rounded-2xl border-l-4 bg-hf-elevated/60 p-3 ${r.urgente ? "border-l-hf-danger" : "border-l-hf-accent"}`}>
              <p className="text-sm font-black text-hf-text">{i + 1}. {r.titulo}</p>
              <p className="text-sm text-hf-text-2">{r.motivo} {r.acao}</p>
              <p className="mt-1 text-xs font-semibold text-hf-muted">{r.impactoMes == null ? "Sem vendas para estimar o valor" : `Vale cerca de ${brl(r.impactoMes)} por mês`} · {CONFIANCA[r.confianca]}</p>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}
