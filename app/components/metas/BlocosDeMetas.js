"use client";

// Blocos de metas usados por Marmitaria, Restaurante e Eventos: períodos,
// projeção do mês e estrutura de custos. Recebem números já calculados.

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const brl = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const inteiro = (v) => Number(v).toLocaleString("pt-BR");
const ESTADO = {
  bate_meta: { titulo: "Projeção: meta atingida", cor: "text-hf-success" },
  abaixo_meta: { titulo: "Projeção: meta não atingida", cor: "text-hf-warning" },
  abaixo_equilibrio: { titulo: "Projeção: abaixo do ponto de equilíbrio", cor: "text-hf-danger" },
  sem_meta: { titulo: "Projeção do mês", cor: "text-hf-text" },
};
const FAIXA = { acima: "Acima da referência", abaixo: "Abaixo da referência", dentro: "Dentro da referência" };

export function Numero({ rotulo, valor, nota }) {
  return (
    <div className="min-w-0 rounded-xl border border-hf-border p-3">
      <p className="text-xs font-bold text-hf-text-2">{rotulo}</p>
      <p className="truncate text-xl font-black tabular-nums text-hf-text">{valor}</p>
      {nota && <p className="text-xs text-hf-text-2">{nota}</p>}
    </div>
  );
}

export function TabelaDePeriodos({ equilibrio, meta }) {
  const linhas = [["Dia", "dia"], ["Semana", "semana"], ["Mês", "mes"], ["Ano", "ano"]];
  return (
    <div className="overflow-x-auto rounded-xl border border-hf-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Ponto de equilíbrio e meta por período</caption>
        <thead><tr className="bg-hf-elevated text-left text-xs text-hf-text-2"><th scope="col" className="px-3 py-2">Período</th><th scope="col" className="px-3 py-2 text-right">Equilíbrio</th><th scope="col" className="px-3 py-2 text-right">Meta</th></tr></thead>
        <tbody>
          {linhas.map(([r, k]) => (
            <tr key={k} className="border-t border-hf-border">
              <th scope="row" className="px-3 py-2 text-left font-bold text-hf-text">{r}</th>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-hf-text">{equilibrio ? brl(equilibrio[k]) : "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-hf-text">{meta ? brl(meta[k]) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Projecao({ p, dias, metaMes, equilibrioMes, plano }) {
  if (!p.ok) return <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: {p.motivo}</p>;
  const e = ESTADO[p.estado];
  return (
    <>
      <p className={`text-lg font-black ${e.cor}`}>{e.titulo}</p>
      <p className="text-sm text-hf-text-2">Projeção de {brl(p.previsto)} no mês, com {brl(p.vendido)} faturados em {p.diasVendidos} dias.{p.pctDaMeta !== null ? ` Isso é ${p.pctDaMeta}% da meta.` : ""}</p>
      <div className="mt-3 h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dias} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hf-border))" />
            <XAxis dataKey="data" tickFormatter={(d) => d.slice(8, 10)} tick={{ fontSize: 11 }} stroke="rgb(var(--hf-text-2))" />
            <YAxis tickFormatter={(v) => `${Math.round(v / 1000)} mil`} width={48} tick={{ fontSize: 11 }} stroke="rgb(var(--hf-text-2))" domain={[0, (max) => Math.max(max, metaMes || 0, equilibrioMes || 0)]} />
            <Tooltip formatter={(v) => brl(v)} labelFormatter={(d) => `Dia ${String(d).slice(8, 10)}`} />
            {metaMes > 0 && <ReferenceLine y={metaMes} stroke="rgb(var(--hf-accent))" strokeDasharray="6 3" label={{ value: "Meta", position: "insideTopRight", fontSize: 11 }} />}
            {equilibrioMes > 0 && <ReferenceLine y={equilibrioMes} stroke="rgb(var(--hf-danger))" strokeDasharray="6 3" label={{ value: "Equilíbrio", position: "insideTopRight", fontSize: 11 }} />}
            <Line type="monotone" dataKey="acumulado" name="Vendido no mês" stroke="rgb(var(--hf-text))" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {p.falta > 0 && (
        <div className="mt-3 rounded-xl border border-hf-border bg-hf-elevated p-3 text-sm text-hf-text">
          <p className="font-black">Faltam {brl(p.falta)} para a meta.</p>
          {p.precisaPorDia !== null && <p>Nos {p.restantes} dias que restam, venda {brl(p.precisaPorDia)} por dia.</p>}
          {plano && <p className="mt-1">Estratégia: {inteiro(plano.unidades)} {plano.nome} a mais{plano.porDia ? `, cerca de ${inteiro(plano.porDia)} por dia` : ""}. {plano.tipo === "margem" ? `É o prato de maior margem de contribuição entre os que já vendem, com ${brl(plano.lucroExtra)} de margem a mais.` : `É o item de maior lucro por pedido, com ${brl(plano.lucroExtra)} de lucro adicional.`}</p>}
        </div>
      )}
    </>
  );
}

export function Lista({ titulo, itens }) {
  if (!itens.length) return null;
  return (
    <div>
      <p className="text-sm font-black text-hf-text">{titulo}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {itens.map((i) => <li key={i.id} className="flex justify-between gap-3"><span className="min-w-0 truncate text-hf-text">{i.nome}</span><span className="shrink-0 tabular-nums text-hf-text-2">{i.vendidas ? `${inteiro(i.vendidas)} vendidas` : "Sem vendas"}</span></li>)}
      </ul>
    </div>
  );
}

export function Estrutura({ e }) {
  return (
    <ul className="divide-y divide-hf-border">
      {e.grupos.map((g) => (
        <li key={g.id} className="py-2">
          <details>
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-bold text-hf-text">{g.rotulo}</span>
                {g.referencia && <span className="block text-xs text-hf-text-2">{FAIXA[g.estado]}: {g.referencia.min}% a {g.referencia.max}% ({g.referencia.fonte})</span>}
              </span>
              <span className="shrink-0 text-right"><span className="block font-black tabular-nums text-hf-text">{String(g.pct).replace(".", ",")}%</span><span className="block text-xs tabular-nums text-hf-text-2">{brl(g.valor)}</span></span>
            </summary>
            {g.linhas.length > 0 && <ul className="mt-1 space-y-1 pl-3 text-sm">{g.linhas.map((l) => <li key={l.nome} className="flex justify-between gap-3"><span className="min-w-0 truncate text-hf-text">{l.nome}</span><span className="shrink-0 tabular-nums text-hf-text-2">{String(l.pct).replace(".", ",")}% · {brl(l.valor)}</span></li>)}</ul>}
          </details>
        </li>
      ))}
    </ul>
  );
}

