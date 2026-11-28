"use client";

// Oscilação do custo do prato (dono, 28/11/2026): "o prato no início custava
// R$ 10, agora está custando 18; logo a precificação dele precisa ser
// ajustada". Conta em custo-prato-historico.mjs (testada): a receita de hoje
// com o preço que cada ingrediente tinha em cada mês.

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { fetchHistoricoPrecosParaCusto } from "../../lib/operacao";
import { custoDoPratoNoTempo } from "../../lib/custo-prato-historico.mjs";

const brl = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const mes = (iso) => new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");

// Um histórico por unidade na sessão: várias fichas abertas não buscam de novo.
const cache = new Map();
function useHistorico(unidadeId) {
  const [dados, setDados] = useState(() => cache.get(unidadeId)?.data || null);
  useEffect(() => {
    if (!unidadeId || unidadeId === "todas") return;
    let vivo = true;
    if (!cache.has(unidadeId)) cache.set(unidadeId, fetchHistoricoPrecosParaCusto(unidadeId).then((r) => { cache.set(unidadeId, { data: r.data || [] }); return r.data || []; }));
    Promise.resolve(cache.get(unidadeId)).then((v) => { if (vivo) setDados(Array.isArray(v) ? v : v?.data || []); });
    return () => { vivo = false; };
  }, [unidadeId]);
  return dados;
}

export default function CustoNoTempo({ ficha, fichas = [], produtos = [], params = {}, unidadeId, precoVenda = 0, metaCmv = 30 }) {
  const historico = useHistorico(unidadeId);
  const r = useMemo(() => (historico ? custoDoPratoNoTempo({ ficha, fichas, produtos, params, historico }) : null), [historico, ficha, fichas, produtos, params]);
  if (!r) return <p className="text-xs text-hf-muted">Carregando o histórico de custo…</p>;
  if (!r.temHistorico) return <p className="text-xs text-hf-muted">Ainda não há mudança de preço registrada nos ingredientes deste prato.</p>;

  const pts = r.pontos;
  const vs = pts.map((p) => p.cmv);
  const [v0, v1] = [Math.min(...vs), Math.max(...vs)];
  const W = 320, H = 90, M = 6;
  const x = (i) => M + (pts.length > 1 ? (i / (pts.length - 1)) * (W - 2 * M) : 0);
  const y = (v) => H - M - (v1 > v0 ? ((v - v0) / (v1 - v0)) * (H - 2 * M) : (H - 2 * M) / 2);
  const primeiro = pts[0], ultimo = pts[pts.length - 1];
  const subiu = (r.variacaoPct || 0) > 0.5;
  const desceu = (r.variacaoPct || 0) < -0.5;
  const cmvPctAgora = precoVenda > 0 ? (ultimo.cmv / precoVenda) * 100 : null;
  const precisaAjustar = subiu && cmvPctAgora != null && cmvPctAgora > metaCmv;
  const precoParaMeta = precisaAjustar && metaCmv > 0 ? Math.ceil((ultimo.cmv / (metaCmv / 100)) * 10) / 10 : null;
  const parcial = pts.some((p) => p.cobertura < 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-hf-text">
          {mes(primeiro.data)}: <b>{brl(primeiro.cmv)}</b> → hoje: <b>{brl(ultimo.cmv)}</b>
        </p>
        <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-bold ${subiu ? "text-hf-danger" : desceu ? "text-hf-success" : "text-hf-muted"}`}>
          {subiu ? <TrendingUp size={16} /> : desceu ? <TrendingDown size={16} /> : null}
          {r.variacaoPct == null ? "—" : `${r.variacaoPct > 0 ? "+" : ""}${r.variacaoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-24 w-full" role="img" aria-label="Custo por porção mês a mês">
        <polyline fill="none" strokeWidth="2" className="stroke-hf-menu" points={pts.map((p, i) => `${x(i)},${y(p.cmv)}`).join(" ")} />
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.cmv)} r="2.5" className={p.cobertura < 100 ? "fill-hf-muted" : "fill-hf-menu"} />)}
      </svg>
      <div className="flex justify-between text-[11px] text-hf-muted"><span>{mes(primeiro.data)}</span><span>hoje</span></div>
      {precisaAjustar ? (
        <p className="mt-2 rounded-xl bg-hf-warning/10 p-2 text-xs text-hf-text">
          O custo subiu e o CMV hoje é {cmvPctAgora.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% (meta {metaCmv}%). Para voltar à meta, o preço seria cerca de <b>{brl(precoParaMeta)}</b>.
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-hf-muted">
        Custo por porção com a receita de hoje e o preço de cada ingrediente em cada mês. Saltos de mais de 3 vezes contam como correção de cadastro, não como aumento.
        {parcial ? " Pontos cinza: algum ingrediente ainda não tinha preço registrado (usado o primeiro conhecido)." : ""}
      </p>
    </div>
  );
}
