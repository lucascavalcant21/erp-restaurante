"use client";

// INÍCIO DO DONO AO VIVO, no visual da Home da Medway (pedido do dono,
// 14/11/2026): faixa azul-clara com a meta e o vendido de hoje, a faixa em
// degradê do Jhon, as abas em pílula, a barra de progresso da meta, os
// números do dia (vendido, desconto, imposto, taxa, lucro) e o dinheiro
// entrando venda a venda. Atualiza sozinho quando entra uma venda.
// Contas: app/lib/painel-dono.mjs. Nada é inventado: sem dado, a tela diz o
// que falta.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Loader2, Pencil, Target, TrendingUp, Wallet } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { useTempoReal } from "../../lib/realtime";
import { carregarPainelDono } from "../../lib/painel-dono-dados";
import { salvarMetaVendas } from "../../lib/parametros";
import { PERIODOS_META, custosDaVenda, estrategiasDaMeta, lucroPelasFichas, progressoDaMeta, somarVendas } from "../../lib/painel-dono.mjs";
import { DestaqueDegrade, RotuloSecao } from "../ui/Medway";
import { useMinhaAssinatura } from "../../lib/assinatura";
import { linkCheckout, rotaLiberada } from "../../lib/planos.mjs";

const brl = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function Numero({ rotulo, valor, nota, natureza }) {
  return (
    <div className="min-w-0 rounded-[18px] border border-mw-borda bg-mw-card p-4">
      <p className="text-[13px] text-mw-sec">{rotulo}</p>
      <p className="mt-1 truncate text-[22px] font-semibold tabular-nums tracking-tight text-mw-marinho">{valor}</p>
      {nota && <p className="mt-0.5 text-[12px] leading-snug text-mw-sec">{nota}</p>}
      {natureza && <span className="mt-2 inline-block rounded-full bg-mw-suave px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-mw-sec">{natureza}</span>}
    </div>
  );
}

function EditorDaMeta({ meta, onSalvar, onFechar }) {
  const [periodo, setPeriodo] = useState(meta?.periodo || "dia");
  const [valor, setValor] = useState(meta?.valor ? String(meta.valor).replace(".", ",") : "");
  const [salvando, setSalvando] = useState(false);
  const numero = Number(String(valor).replace(/\./g, "").replace(",", "."));
  return (
    <div className="space-y-4 rounded-[22px] border border-mw-borda bg-mw-card p-4">
      <p className="text-[16px] font-semibold text-mw-marinho">Sua meta de vendas</p>
      <div role="radiogroup" aria-label="Período da meta" className="flex gap-1 rounded-[14px] bg-mw-suave p-1">
        {PERIODOS_META.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)}
            className={`min-h-[44px] flex-1 rounded-[11px] text-[15px] font-semibold shadow-none ${periodo === p.id ? "bg-mw-card text-mw-marinho" : "text-mw-sec"}`}>
            {p.nome}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-[13px] text-mw-sec">Valor em reais</span>
        <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 5.000"
          className="mt-1 h-12 w-full rounded-[14px] border border-mw-borda bg-mw-card px-4 text-[18px] text-mw-marinho focus:outline-none focus:ring-2 focus:ring-mw-agua" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onFechar} className="min-h-[48px] flex-1 rounded-full bg-mw-suave text-[16px] font-semibold text-mw-marinho shadow-none">Cancelar</button>
        <button type="button" disabled={!(numero > 0) || salvando}
          onClick={async () => { setSalvando(true); await onSalvar({ periodo, valor: numero }); setSalvando(false); }}
          className="min-h-[48px] flex-1 rounded-full bg-mw-marinho text-[16px] font-semibold text-white shadow-none disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar meta"}
        </button>
      </div>
    </div>
  );
}

export default function PainelDonoAoVivo() {
  const { unidadeAtiva, sessao } = useERP();
  const assinatura = useMinhaAssinatura(sessao);
  const [dados, setDados] = useState(undefined);
  const [aba, setAba] = useState("hoje");
  const [editando, setEditando] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    const d = await carregarPainelDono(unidadeAtiva, hojeIso());
    setDados(d);
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);
  useTempoReal(["vendas", "pedidos_itens", "config_sistema"], () => carregar());

  const c = useMemo(() => {
    if (!dados?.ok) return null;
    const hoje = somarVendas(dados.vendasHoje);
    const janela = somarVendas(dados.vendasJanela);
    const mes = somarVendas(dados.vendasMes);
    // 2ª aba: o período da meta; com meta diária (igual a "Hoje"), o mês.
    const base = aba === "hoje" ? hoje : dados.meta?.periodo && dados.meta.periodo !== "dia" ? janela : mes;
    const custos = custosDaVenda({ total: base.total, cartao: base.cartao, impostoPct: dados.params.imposto_pct, taxaCartaoPct: dados.params.taxa_cartao_pct });
    const lucro = lucroPelasFichas(dados.itensHoje, new Map(dados.produtos.map((p) => [p.id, p.margem])));
    const progresso = progressoDaMeta({ meta: dados.meta, vendido: janela.total, janela: dados.janela });
    const estrategias = estrategiasDaMeta(progresso, { produtos: dados.produtos, ticket: hoje.ticket });
    return { hoje, janela, base, custos, lucro, progresso, estrategias };
  }, [dados, aba]);

  const assistenteLiberado = rotaLiberada(assinatura?.plano, "/dashboard/inteligencia/assistente");
  const linkJhon = "/dashboard/inteligencia/assistente?q=" + encodeURIComponent("Como foi minha empresa hoje?");
  const periodoMeta = PERIODOS_META.find((p) => p.id === dados?.meta?.periodo);

  if (dados === undefined) {
    return <p className="flex items-center gap-2 px-1 text-[15px] text-mw-sec"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando as vendas…</p>;
  }

  return (
    <div className="space-y-6 text-mw-texto">
      {/* Faixa azul-clara (como "Personalizar recomendações") */}
      <section className="-mx-4 bg-gradient-to-b from-mw-azul/30 via-mw-azul/10 to-transparent px-4 pb-2 pt-5 sm:-mx-6 sm:px-6">
        <p className="text-[17px] text-mw-texto">Sua meta e o dia de hoje</p>
        {aberto && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setEditando(true)} className="min-h-[124px] rounded-[22px] bg-white/60 p-4 text-left shadow-none backdrop-blur">
              <Target size={24} strokeWidth={1.7} className="text-mw-marinho" aria-hidden="true" />
              <span className="mt-3 block text-[14px] text-mw-texto">Meta {periodoMeta ? periodoMeta.nome.toLowerCase() : ""}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[18px] font-semibold text-mw-marinho">
                {dados.ok && dados.meta ? brl(dados.meta.valor) : "Definir meta"}
                <Pencil size={14} aria-hidden="true" />
              </span>
            </button>
            <div className="min-h-[124px] rounded-[22px] bg-white/60 p-4 backdrop-blur">
              <Wallet size={24} strokeWidth={1.7} className="text-mw-marinho" aria-hidden="true" />
              <span className="mt-3 block text-[14px] text-mw-texto">Vendido hoje</span>
              <span className="mt-0.5 block text-[18px] font-semibold tabular-nums text-mw-marinho">{c ? brl(c.hoje.total) : "—"}</span>
              {c && <span className="text-[12px] text-mw-sec">{c.hoje.quantidade} {c.hoje.quantidade === 1 ? "venda" : "vendas"}</span>}
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-mw-borda" />
          <button type="button" onClick={() => setAberto(!aberto)} className="inline-flex min-h-[44px] items-center gap-1.5 text-[16px] font-medium text-mw-marinho shadow-none">
            {aberto ? "Recolher" : "Mostrar"} {aberto ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </button>
          <span className="h-px flex-1 bg-mw-borda" />
        </div>
      </section>

      {editando && (
        <EditorDaMeta
          meta={dados?.meta}
          onFechar={() => setEditando(false)}
          onSalvar={async (m) => {
            const r = await salvarMetaVendas(unidadeAtiva, m);
            if (r?.error) setAviso(`Não salvou: ${r.error}`);
            else { setAviso(""); setEditando(false); carregar(); }
          }}
        />
      )}
      {aviso && <p className="text-[14px] text-hf-danger">{aviso}</p>}

      <DestaqueDegrade
        href={assistenteLiberado ? linkJhon : linkCheckout("/dashboard/inteligencia/assistente")}
        titulo="Resumo do dia com o Jhon"
        texto="Pergunte como está o restaurante agora"
        icone="Sparkles"
        trancado={!assistenteLiberado}
      />

      {!dados.ok ? (
        <p className="rounded-[18px] border border-mw-borda bg-mw-card p-4 text-[15px] text-mw-sec">DADOS INSUFICIENTES: {dados.erro}</p>
      ) : (
        <>
          <div role="tablist" aria-label="Período" className="flex gap-1 rounded-[14px] bg-mw-suave p-1">
            {[["hoje", "Hoje"], ["periodo", dados.meta?.periodo === "semana" ? "Esta semana" : "Este mês"]].map(([id, nome]) => (
              <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
                className={`min-h-[48px] flex-1 rounded-[11px] text-[16px] font-semibold shadow-none ${aba === id ? "bg-mw-card text-mw-marinho" : "text-mw-texto"}`}>
                {nome}
              </button>
            ))}
          </div>

          {c.progresso ? (
            <section className="space-y-2 rounded-[18px] bg-mw-suave/70 p-4">
              <p className="text-[15px] text-mw-sec">
                <strong className="font-semibold text-mw-marinho">{brl(c.progresso.vendido)} / {brl(c.progresso.meta)}</strong> vendido {periodoMeta?.rotulo || ""}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-mw-agua transition-[width] duration-700" style={{ width: `${c.progresso.pct}%` }} />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {c.progresso.estado === "batida" && <span className="rounded-full bg-mw-agua-claro px-3 py-1 text-[13px] font-semibold text-mw-agua">Meta batida</span>}
                {c.progresso.estado === "vai_bater" && <span className="rounded-full bg-mw-agua-claro px-3 py-1 text-[13px] font-semibold text-mw-agua">No ritmo de bater a meta</span>}
                {c.progresso.estado === "nao_vai_bater" && <span className="rounded-full bg-hf-warning/10 px-3 py-1 text-[13px] font-semibold text-hf-warning">Abaixo do ritmo da meta</span>}
                {c.progresso.falta > 0 && <span className="text-[14px] text-mw-sec">Falta {brl(c.progresso.falta)}</span>}
              </div>
              {c.progresso.previsto !== null && (
                <p className="text-[13px] text-mw-sec">PROJEÇÃO pelo ritmo de {dados.janela.passados} dias: {brl(c.progresso.previsto)} até o fim do período.</p>
              )}
            </section>
          ) : (
            <button type="button" onClick={() => setEditando(true)} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-mw-suave text-[17px] font-semibold text-mw-marinho shadow-none">
              <Target size={20} aria-hidden="true" /> Definir a meta (diária, semanal ou mensal)
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Numero rotulo="Vendido" valor={brl(c.base.total)} nota={`${c.base.quantidade} ${c.base.quantidade === 1 ? "venda" : "vendas"}${c.base.ticket ? ` · ticket ${brl(c.base.ticket)}` : ""}`} natureza="Real" />
            <Numero rotulo="Descontos dados" valor={brl(c.base.desconto)} natureza="Real" />
            <Numero rotulo="Imposto" valor={c.custos.imposto === null ? "—" : brl(c.custos.imposto)} nota={c.custos.imposto === null ? "Informe a % de imposto em Configurações" : `${dados.params.imposto_pct}% sobre o vendido`} natureza={c.custos.imposto === null ? null : "Estimativa"} />
            <Numero rotulo="Taxa da maquininha" valor={c.custos.taxaCartao === null ? "—" : brl(c.custos.taxaCartao)} nota={c.custos.taxaCartao === null ? "Informe a % da maquininha" : `${dados.params.taxa_cartao_pct}% sobre o cartão`} natureza={c.custos.taxaCartao === null ? null : "Estimativa"} />
          </div>

          <div className="rounded-[18px] border border-mw-borda bg-mw-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-mw-sec">Lucro de hoje (margem pelas fichas técnicas)</p>
              <TrendingUp size={20} className="text-mw-agua" aria-hidden="true" />
            </div>
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-mw-marinho">{c.lucro.lucro === null ? "—" : brl(c.lucro.lucro)}</p>
            <p className="text-[12px] leading-snug text-mw-sec">
              {c.lucro.lucro === null
                ? "DADOS INSUFICIENTES: nenhum item vendido hoje tem ficha técnica com custo."
                : `ESTIMATIVA: já sem imposto e taxa.${c.lucro.semMargem ? ` ${c.lucro.semMargem} ${c.lucro.semMargem === 1 ? "item ficou" : "itens ficaram"} de fora por não ter ficha com custo.` : ""}`}
            </p>
          </div>

          {c.estrategias.length > 0 && (
            <section className="space-y-2 rounded-[18px] border border-mw-borda bg-mw-card p-4">
              <p className="text-[16px] font-semibold text-mw-marinho">O Jhon sugere</p>
              <ul className="space-y-1.5 text-[15px] leading-snug text-mw-texto">
                {c.estrategias.map((e) => <li key={e} className="flex gap-2"><span aria-hidden="true">•</span><span>{e}</span></li>)}
              </ul>
              <span className="inline-block rounded-full bg-mw-suave px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-mw-sec">Sugestão</span>
            </section>
          )}

          <section className="space-y-3">
            <RotuloSecao>Dinheiro entrando</RotuloSecao>
            {dados.vendasHoje.length === 0 ? (
              <p className="rounded-[18px] border border-mw-borda bg-mw-card p-4 text-[15px] text-mw-sec">Nenhuma venda hoje ainda. Assim que a primeira for paga, ela aparece aqui.</p>
            ) : (
              <ul className="divide-y divide-mw-borda overflow-hidden rounded-[18px] border border-mw-borda bg-mw-card">
                {dados.vendasHoje.slice(0, 10).map((v) => {
                  const cancel = !!v.cancelada_em || String(v.status || "").startsWith("cancel");
                  return (
                    <li key={v.id} className="flex min-h-[56px] items-center gap-3 px-4">
                      <span className="w-12 shrink-0 text-[14px] tabular-nums text-mw-sec">{hora(v.created_at)}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] text-mw-texto">{v.forma_pagamento || "Venda"}{Number(v.desconto) > 0 ? ` · desconto ${brl(v.desconto)}` : ""}</span>
                      <span className={`shrink-0 text-[16px] font-semibold tabular-nums ${cancel ? "text-mw-sec line-through" : "text-mw-agua"}`}>+{brl(v.total)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/dashboard/vendas" className="flex min-h-[48px] items-center justify-center rounded-full border border-mw-borda bg-mw-card text-[15px] font-semibold text-mw-marinho shadow-none">Ver todas as vendas</Link>
          </section>
        </>
      )}
    </div>
  );
}
