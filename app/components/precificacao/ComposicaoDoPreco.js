"use client";

// Composição do preço de um produto (pedido do dono, 28/11/2026):
// "Quando clicar em um produto aparecer: R$ 100 total (100%), R$ 30 CMV (30%),
// R$ 22 CMO e dentro do CMO a porcentagem de cada funcionário cadastrado ou
// extra também; custo fixo, custos variáveis e o que tem dentro de cada um;
// pró-labore; imposto se caso possuir; e meu lucro."
//
// Os números são os de composicaoDoPreco (composicao-preco.mjs), que já somam
// o preço em centavos. Aqui só se abre cada grupo. O CMO por pessoa reparte o
// CMO do produto pelo peso de cada um no mês (repartirPorPeso, custo-do-dia.mjs).

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DESPESAS_VARIAVEIS } from "../../lib/composicao-preco.mjs";
import { repartirPorPeso } from "../../lib/custo-do-dia.mjs";

const brl = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const ROTULO_IMPOSTO = DESPESAS_VARIAVEIS.find(([k]) => k === "imposto_pct")?.[1];

// Cores da barra (tokens hf-*), na ordem dos grupos.
const COR = {
  cmv: "bg-hf-menu", imposto: "bg-hf-danger", variaveis: "bg-hf-warning", cmo: "bg-hf-accent",
  fixos: "bg-hf-muted", proLabore: "bg-hf-text-2", lucro: "bg-hf-success",
};

function Grupo({ id, rotulo, valor, pctPreco, itens, nota, aberto, alternar, destaque }) {
  const temItens = itens && itens.length > 0;
  return (
    <li className="py-1">
      <button type="button" onClick={temItens ? alternar : undefined} aria-expanded={temItens ? aberto : undefined}
        className="flex min-h-[44px] w-full items-center gap-2 text-left">
        <span className={`h-3 w-3 shrink-0 rounded-sm ${COR[id]}`} />
        <span className={`min-w-0 flex-1 truncate text-sm ${destaque ? "font-bold" : "font-semibold"} text-hf-text`}>{rotulo}</span>
        <span className="shrink-0 text-right text-sm tabular-nums">
          <b className="text-hf-text">{brl(valor)}</b> <span className="text-hf-muted">({pct(pctPreco)})</span>
        </span>
        {temItens ? <ChevronDown size={16} className={`shrink-0 text-hf-muted transition ${aberto ? "rotate-180" : ""}`} /> : <span className="w-4 shrink-0" />}
      </button>
      {aberto && temItens ? (
        <ul className="mb-1 ml-5 space-y-1 border-l border-hf-border pl-3">
          {itens.map((i, k) => (
            <li key={k} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-hf-text-2">{i.rotulo}{i.sub ? <span className="text-hf-muted"> · {i.sub}</span> : null}</span>
              <span className="shrink-0 tabular-nums text-hf-text-2">{brl(i.valor)} <span className="text-hf-muted">({pct(i.pct)})</span></span>
            </li>
          ))}
        </ul>
      ) : null}
      {nota ? <p className="ml-5 text-xs text-hf-muted">{nota}</p> : null}
    </li>
  );
}

export default function ComposicaoDoPreco({ c, pesosEquipe = [] }) {
  const [aberto, setAberto] = useState({ cmo: true });
  const alternar = (id) => setAberto((a) => ({ ...a, [id]: !a[id] }));

  const grupos = useMemo(() => {
    if (!c?.temPreco) return [];
    const preco = c.preco;
    const p = (v) => (preco > 0 ? (v / preco) * 100 : null);
    const imposto = c.variaveis.partes.filter((x) => x.rotulo === ROTULO_IMPOSTO);
    const outrasVar = c.variaveis.partes.filter((x) => x.rotulo !== ROTULO_IMPOSTO);
    const soma = (l) => l.reduce((s, x) => s + x.valor, 0);
    const porPessoa = repartirPorPeso(c.cmo.centavos, pesosEquipe).filter((x) => x.centavos > 0);
    const lucro = c.resultado.valor;
    return [
      { id: "cmv", rotulo: "CMV (ingredientes e embalagem)", valor: c.cmv.valor, pctPreco: c.cmv.pct,
        itens: c.cmv.partes.map((x) => ({ rotulo: x.rotulo, valor: x.valor, pct: x.pct })) },
      ...(imposto.length ? [{ id: "imposto", rotulo: "Imposto", valor: soma(imposto), pctPreco: p(soma(imposto)),
        itens: imposto.map((x) => ({ rotulo: x.rotulo, sub: `${pct(x.taxaPct)} da venda`, valor: x.valor, pct: x.pct })) }] : []),
      { id: "variaveis", rotulo: "Custos variáveis", valor: soma(outrasVar), pctPreco: p(soma(outrasVar)),
        itens: outrasVar.map((x) => ({ rotulo: x.rotulo, sub: `${pct(x.taxaPct)} da venda`, valor: x.valor, pct: x.pct })),
        nota: outrasVar.length ? null : "Nenhum (maquininha, comissão…) cadastrado." },
      { id: "cmo", rotulo: "CMO (equipe)", valor: c.cmo.valor, pctPreco: c.cmo.pct,
        itens: porPessoa.length
          ? porPessoa.map((x) => ({ rotulo: x.nome, sub: x.extra ? "extra" : x.cargo || "contratado", valor: x.centavos / 100, pct: p(x.centavos / 100) }))
          : c.cmo.partes.map((x) => ({ rotulo: x.rotulo, valor: x.valor, pct: x.pct })),
        nota: c.cmo.motivo || (porPessoa.length ? "Cada pessoa pelo peso no mês: salário, vale e taxa de serviço; extra pelas diárias pagas (ESTIMATIVA)." : null) },
      { id: "fixos", rotulo: "Custos fixos", valor: c.operacionais.valor, pctPreco: c.operacionais.pct,
        itens: c.operacionais.partes.map((x) => ({ rotulo: x.rotulo, valor: x.valor, pct: x.pct })), nota: c.operacionais.motivo },
      { id: "proLabore", rotulo: "Pró-labore", valor: c.proLabore.valor, pctPreco: c.proLabore.pct,
        itens: c.proLabore.partes.map((x) => ({ rotulo: x.rotulo, valor: x.valor, pct: x.pct })), nota: c.proLabore.motivo },
      { id: "lucro", rotulo: lucro < 0 ? "Prejuízo" : "Seu lucro", valor: lucro, pctPreco: c.resultado.pct, destaque: true },
    ];
  }, [c, pesosEquipe]);

  if (!c?.temPreco) return <p className="mt-2 rounded-xl bg-hf-elevated p-3 text-xs text-hf-muted">Digite o preço para ver para onde vai cada real.</p>;

  const positivos = grupos.filter((g) => g.valor > 0);
  const totalBarra = positivos.reduce((s, g) => s + g.valor, 0);
  return (
    <div className="mt-2 rounded-xl border border-hf-border bg-hf-bg p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-hf-text">Preço de venda</p>
        <p className="text-sm tabular-nums"><b className="text-hf-text">{brl(c.preco)}</b> <span className="text-hf-muted">(100%)</span></p>
      </div>
      {totalBarra > 0 ? (
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-hf-elevated" aria-hidden="true">
          {positivos.map((g) => <span key={g.id} className={COR[g.id]} style={{ width: `${(g.valor / totalBarra) * 100}%` }} />)}
        </div>
      ) : null}
      <ul className="mt-1 divide-y divide-hf-border">
        {grupos.map((g) => <Grupo key={g.id} {...g} aberto={!!aberto[g.id]} alternar={() => alternar(g.id)} />)}
      </ul>
      <p className="mt-1 text-xs text-hf-muted">
        CMV calculado pela ficha. CMO, custos fixos e pró-labore rateados {c.rateio?.ok ? c.rateio.descricao : "— sem base de rateio"} (ESTIMATIVA).
        {c.meta?.pct ? ` Meta de lucro: ${pct(c.meta.pct)}.` : ""}
      </p>
    </div>
  );
}
