"use client";

// PAINEL DO ESTOQUE (HDEV-EST-001) — secundário: não abre sozinho.
// Só indicadores que o dado sustenta. Cada produto num local cai numa
// situação: Não conferido · Zerado · Abaixo do mínimo · Normal · Inativo.
// "Estoque conferido" só aparece quando não há não conferido, zerado nem
// abaixo do mínimo — saldo que ninguém contou não é saldo seguro.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useERP } from "../../../../context/ERPContext";
import { unidadeValida } from "../../../../lib/contas-pagar.mjs";
import { fetchBaseMovimento, fetchConferidos } from "../../../../lib/estoque-movimento-dados";
import { situacaoDoItem, resumoSituacoes, itemInativo, saldoOperacional, minimoNoSaldo, SITUACOES } from "../../../../lib/estoque-unidades.mjs";
import { areasComLocais, areaDoLocal } from "../../../../lib/estoque-areas.mjs";
import { hasPermission } from "../../../../lib/permissions-catalog.mjs";
import { fmtBRL } from "../../../../components/ui";
import EstoqueAbas from "../../../../components/navigation/EstoqueAbas";

const COR = { nao_conferido: "bg-hf-warning", zerado: "bg-hf-danger", abaixo: "bg-hf-danger/60", normal: "bg-hf-success", inativo: "bg-hf-muted" };
const DICA = {
  nao_conferido: "Nunca entrou num inventário fechado. Conte para confirmar o saldo.",
  zerado: "Conferido e sem saldo.",
  abaixo: "Saldo menor que o mínimo deste local.",
  normal: "Conferido e acima do mínimo.",
  inativo: "Sem saldo e sem movimento há 90 dias.",
};

export default function PainelEstoque() {
  const { unidadeAtiva, sessao } = useERP();
  const [base, setBase] = useState(null);
  const [conferidos, setConferidos] = useState(new Set());
  const [erro, setErro] = useState("");
  const [area, setArea] = useState("todas");
  const [sel, setSel] = useState("nao_conferido");
  const podeVerCusto = !sessao?.gerenciado || hasPermission(sessao, "estoque.overview.view_costs") || hasPermission(sessao, "estoque.overview.view_values");

  useEffect(() => {
    if (!unidadeValida(unidadeAtiva)) return;
    Promise.all([fetchBaseMovimento(unidadeAtiva), fetchConferidos(unidadeAtiva)]).then(([b, c]) => {
      setBase(b.data); setErro(b.error || c.error || ""); setConferidos(c.data);
    });
  }, [unidadeAtiva]);

  const linhas = useMemo(() => {
    if (!base) return [];
    const insumo = new Map(base.insumos.map((i) => [i.id, i]));
    const local = new Map(base.estoques.map((e) => [e.id, e]));
    return base.itens.filter((i) => local.has(i.estoque_id) && insumo.has(i.insumo_id)).map((i) => {
      const saldo = Number(i.quantidade_atual) || 0;
      const l = local.get(i.estoque_id);
      const dado = { saldo, minimo: minimoNoSaldo(insumo.get(i.insumo_id), i.estoque_minimo), conferido: conferidos.has(`${i.estoque_id}|${i.insumo_id}`), ativo: !itemInativo({ saldo, ultimaMovimentacao: i.ultima_movimentacao_em }) };
      const custo = base.custosMedios[i.insumo_id];
      return { id: i.id, insumo: insumo.get(i.insumo_id), local: l, area: areaDoLocal(l), ...dado, situacao: situacaoDoItem(dado),
        valor: Number.isFinite(custo) ? custo * saldo : null };
    });
  }, [base, conferidos]);

  const areas = useMemo(() => areasComLocais(base?.estoques).filter((a) => a.locais.length), [base]);
  const daArea = area === "todas" ? linhas : linhas.filter((l) => l.area === area);
  const resumo = resumoSituacoes(daArea);
  const lista = daArea.filter((l) => l.situacao === sel).sort((a, b) => String(a.insumo.nome).localeCompare(String(b.insumo.nome), "pt-BR"));
  const comSaldo = daArea.filter((l) => l.saldo > 0);
  const semCusto = comSaldo.filter((l) => l.valor == null).length;
  const valor = comSaldo.reduce((s, l) => s + (l.valor || 0), 0);

  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade.</p>;

  return (
    <div className="min-h-screen bg-hf-bg text-hf-text">
      <EstoqueAbas />
      <div className="mx-auto max-w-3xl space-y-3 px-3 pb-24 pt-3 sm:px-4">
        {erro && <p className="text-sm font-bold text-hf-danger">{erro}</p>}
        {!base && !erro && <p className="p-4 text-sm text-hf-text-2">Carregando...</p>}

        {base && <>
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[{ id: "todas", rotulo: "Todas" }, ...areas].map((a) => (
              <button key={a.id} onClick={() => setArea(a.id)} aria-pressed={area === a.id}
                className={`h-9 shrink-0 rounded-xl border px-3 text-sm font-bold ${area === a.id ? "border-hf-text bg-hf-text text-hf-surface" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{a.rotulo}</button>
            ))}
          </div>

          <p className={`rounded-xl border p-3 text-sm font-bold ${resumo.seguro ? "border-hf-success/30 bg-hf-success/10 text-hf-success" : "border-hf-border bg-hf-surface text-hf-text"}`}>
            {resumo.seguro ? "Estoque conferido: nada zerado nem abaixo do mínimo."
              : resumo.nao_conferido
                ? <>{resumo.nao_conferido} de {resumo.total} produtos ainda não foram conferidos. <Link href="/dashboard/operacao/estoque/contagens" className="text-hf-accent underline">Fazer inventário</Link></>
                : `${resumo.zerado + resumo.abaixo} produto(s) zerado(s) ou abaixo do mínimo.`}
          </p>

          <div className="grid grid-cols-5 gap-1 rounded-2xl border border-hf-border bg-hf-surface p-1" role="tablist" aria-label="Situação">
            {SITUACOES.map((s) => (
              <button key={s.id} role="tab" aria-selected={sel === s.id} onClick={() => setSel(s.id)}
                className={`flex min-w-0 flex-col items-center rounded-xl px-1 py-2 ${sel === s.id ? "bg-hf-elevated" : ""}`}>
                <span className="text-lg font-black leading-none">{resumo[s.id]}</span>
                <span className="mt-1 flex max-w-full items-center gap-1 text-[11px] font-bold leading-tight text-hf-text-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${COR[s.id]}`} /><span className="truncate">{s.rotulo}</span>
                </span>
              </button>
            ))}
          </div>

          {podeVerCusto && (
            <p className="text-xs text-hf-text-2">Valor em estoque (custo médio): <b className="text-hf-text">{fmtBRL(valor)}</b>{semCusto ? ` · ${semCusto} produto(s) com saldo sem custo médio, fora da soma` : ""}</p>
          )}

          <section className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface">
            <p className="px-3 pt-3 text-sm font-black">{SITUACOES.find((s) => s.id === sel).rotulo}</p>
            <p className="px-3 text-xs text-hf-text-2">{DICA[sel]}</p>
            <ul className="mt-2 max-h-[55vh] divide-y divide-hf-border overflow-y-auto">
              {!lista.length && <li className="p-3 text-sm text-hf-text-2">Nenhum produto.</li>}
              {lista.map((l) => (
                <li key={l.id}>
                  <Link href={`/dashboard/operacao/estoque?estoque=${l.local.id}&insumo=${l.insumo.id}&tipo=entrada`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-hf-elevated">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{l.insumo.nome}</span>
                      <span className="block truncate text-xs text-hf-text-2">{l.local.nome}{l.minimo ? ` · mínimo ${saldoOperacional(l.insumo, l.minimo)}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-sm font-black">{saldoOperacional(l.insumo, l.saldo)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>}
      </div>
    </div>
  );
}
