"use client";

// Metas do Restaurante: as mesmas regras da Marmitaria (metas-negocio.mjs), com o
// faturamento diário do Financeiro e os custos do Resultado do mês.

import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseReady } from "../../../lib/supabase";
import { contribuicaoDoPrato, estrategia, estruturaDoMes, gargaloDaEstrutura, porPeriodo, previsaoDoMes, vendasDoMes, vendasPorPrato } from "../../../lib/metas-negocio.mjs";
import { Estrutura, Projecao, TabelaDePeriodos, brl } from "../../../components/metas/BlocosDeMetas";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { dadosDoPrato } from "../../../lib/pizza-do-prato.mjs";
import { produtoDaFicha } from "../../../lib/ficha-calculos.mjs";

const ultimoDia = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
};

const proximoMes = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
};

/** Itens das comandas pagas do mês (salão e balcão), sem as vendas canceladas. */
async function fetchItensVendidosDoMes(unidadeId, mes) {
  const vendas = await supabase.from("vendas").select("pedido_id").eq("unidade_id", unidadeId).neq("status", "cancelada")
    .not("pedido_id", "is", null).gte("created_at", `${mes}-01T00:00:00-03:00`).lt("created_at", `${proximoMes(mes)}-01T00:00:00-03:00`);
  if (vendas.error) return { itens: [], erro: "Não foi possível ler as vendas do mês." };
  const ids = [...new Set((vendas.data || []).map((v) => v.pedido_id))];
  const itens = [];
  for (let i = 0; i < ids.length; i += 150) {
    const r = await supabase.from("pedidos_itens").select("produto_id, quantidade, valor_unitario, status_kds").in("pedido_id", ids.slice(i, i + 150));
    if (r.error) return { itens: [], erro: "Não foi possível ler os itens vendidos." };
    itens.push(...(r.data || []));
  }
  return { itens, erro: "" };
}

/** Produtos com a margem de contribuição pela ficha (mesma conta da Pizza do prato). */
function produtosComMargem(produtos = [], fichas = [], params = {}) {
  return produtos.map((p) => {
    const ficha = fichas.find((f) => f.id === p.ficha_id) || fichas.find((f) => produtoDaFicha(f, [p])?.id === p.id && !f.eh_base);
    const preco = Number(p.preco_venda) || 0;
    if (!ficha) return { id: p.id, nome: p.nome_produto, departamento: p.departamento, ativo: p.ativo, preco, contribuicao: null };
    const e = dadosDoPrato(ficha, { fichas, produtos, params });
    return { id: p.id, nome: p.nome_produto, departamento: p.departamento, ativo: p.ativo, preco: e.preco || preco, contribuicao: contribuicaoDoPrato(e) };
  });
}

function Caixa({ titulo, subtitulo, children }) {
  return (
    <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
      <h2 className="text-base font-black text-hf-text">{titulo}</h2>
      {subtitulo && <p className="text-xs text-hf-muted">{subtitulo}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function MetasDoRestaurante({ unidadeId, mes, modelo, resultado, cmo }) {
  const [diario, setDiario] = useState({ linhas: [], erro: "" });
  const [pratos, setPratos] = useState({ carregando: true, itens: [], produtos: [], erro: "" });
  const hoje = new Date().toLocaleDateString("sv-SE");
  const referencia = mes === hoje.slice(0, 7) ? hoje : ultimoDia(mes);

  useEffect(() => {
    if (!unidadeId || !isSupabaseReady()) return undefined;
    let vivo = true;
    supabase.from("fin_faturamento_diario").select("data, vendas_brutas, descontos, cancelamentos")
      .eq("unidade_id", unidadeId).gte("data", `${mes}-01`).lte("data", ultimoDia(mes)).order("data")
      .then(({ data, error }) => { if (vivo) setDiario({ linhas: data || [], erro: error ? "Não foi possível ler o faturamento diário." : "" }); });
    return () => { vivo = false; };
  }, [unidadeId, mes]);

  // Vendas por prato: itens das comandas pagas + margem de cada prato pelas fichas.
  useEffect(() => {
    if (!unidadeId || !isSupabaseReady()) return undefined;
    let vivo = true;
    setPratos((x) => ({ ...x, carregando: true }));
    Promise.all([fetchItensVendidosDoMes(unidadeId, mes), fetchFichas(unidadeId), fetchProdutos(unidadeId), fetchParams(unidadeId)])
      .then(([v, f, p, pr]) => {
        if (!vivo) return;
        const params = { ...PARAMS_PADRAO, ...(pr.data || {}) };
        setPratos({ carregando: false, itens: v.itens, produtos: produtosComMargem(p.data || [], f.data || [], params), erro: v.erro || (p.error ? "Não foi possível ler os produtos." : "") });
      })
      .catch(() => { if (vivo) setPratos({ carregando: false, itens: [], produtos: [], erro: "Não foi possível ler as vendas por prato." }); });
    return () => { vivo = false; };
  }, [unidadeId, mes]);

  const d = useMemo(() => {
    const diasMes = resultado.dias > 0 ? resultado.dias : null;
    const metaMes = Number(modelo.meta_faturamento) > 0 ? Number(modelo.meta_faturamento) : null;
    const equilibrioMes = resultado.equilibrio?.mes ?? null;
    const dias = vendasDoMes(diario.linhas.map((l) => ({ data: l.data, valor_bruto: l.vendas_brutas, descontos: l.descontos, cancelamentos: l.cancelamentos, quantidade: 0 })), referencia);
    const prev = previsaoDoMes({ dias, hojeIso: referencia, diasMes, metaMes, equilibrioMes });
    const linha = (id) => resultado.linhas.find((l) => l.id === id);
    const itens = (id) => (linha(id)?.itens || []).filter((i) => Number(i.valor) > 0).map((i) => ({ nome: i.nome, valor: i.valor }));
    const faturamento = resultado.faturamento > 0 ? resultado.faturamento : prev.ok ? prev.previsto : null;
    const estrutura = estruturaDoMes({
      faturamento, cmvPct: linha("cmv")?.pct ?? null,
      cmoLinhas: (cmo?.pessoas || []).filter((p) => p.total > 0).map((p) => ({ nome: p.nome, valor: p.total })),
      fixosLinhas: [...itens("fixos"), ...itens("outros")],
    });
    const porPrato = vendasPorPrato(pratos.itens, pratos.produtos);
    return { diasMes, metaMes, equilibrioMes, dias, prev, estrutura, gargalo: gargaloDaEstrutura(estrutura),
      porPrato, plano: (() => { const e = estrategia(prev, porPrato.candidatos); return e ? { ...e, tipo: "margem" } : null; })(),
      periodoEq: porPeriodo(equilibrioMes, diasMes), periodoMeta: porPeriodo(metaMes, diasMes) };
  }, [diario, modelo, resultado, cmo, referencia, pratos]);

  return (
    <>
      <Caixa titulo="Metas" subtitulo="Ponto de equilíbrio e meta de faturamento por período.">
        <TabelaDePeriodos equilibrio={d.periodoEq} meta={d.periodoMeta} />
        {!d.metaMes && <p className="mt-2 text-xs text-hf-text-2">Informe a meta de faturamento do mês em Vendas, impostos e cartão.</p>}
      </Caixa>
      <Caixa titulo="Projeção de faturamento" subtitulo="Calculada pelo faturamento diário lançado no Financeiro e pelas comandas.">
        {diario.erro ? <p className="text-sm font-bold text-hf-danger">{diario.erro}</p>
          : <Projecao p={d.prev} dias={d.dias} metaMes={d.metaMes} equilibrioMes={d.equilibrioMes} plano={d.plano} />}
      </Caixa>
      <Caixa titulo="Vendas por prato" subtitulo="Comandas e balcão recebidos pelo caixa do Héfisto no mês. Margem de contribuição: preço menos ingredientes, embalagem, imposto e taxa do cartão.">
        <VendasPorPrato pratos={pratos} v={d.porPrato} />
      </Caixa>
      {d.estrutura && (
        <Caixa titulo="Estrutura de custos" subtitulo={`Sobre ${brl(d.estrutura.faturamento)}. Abra cada grupo para ver o detalhe por pessoa e por conta.`}>
          {d.gargalo && <p className="mb-2 rounded-xl border border-hf-danger/40 bg-hf-danger/10 p-3 text-sm text-hf-text"><b>Principal gargalo: {d.gargalo.rotulo}.</b> Está em {String(d.gargalo.pct).replace(".", ",")}%, acima de {d.gargalo.limite}%. O excesso reduz o lucro em {brl(d.gargalo.excesso)} por mês.</p>}
          <Estrutura e={d.estrutura} />
        </Caixa>
      )}
    </>
  );
}

function ListaDePratos({ titulo, linhas, valor }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-hf-muted">{titulo}</p>
      {!linhas.length ? <p className="mt-1 text-sm text-hf-text-2">Nenhum.</p> : (
        <ul className="mt-1 divide-y divide-hf-border">
          {linhas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 truncate font-semibold text-hf-text">{l.nome}</span>
              <span className="shrink-0 tabular-nums text-hf-text-2">{valor(l)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VendasPorPrato({ pratos, v }) {
  if (pratos.carregando) return <p className="text-sm text-hf-muted">Carregando…</p>;
  if (pratos.erro) return <p className="text-sm font-bold text-hf-danger">{pratos.erro}</p>;
  if (!v.temVendas) {
    return <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: nenhuma venda com itens neste mês. As vendas entram aqui quando o salão e o balcão recebem pelo caixa do Héfisto.</p>;
  }
  const un = (n) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "vendido" : "vendidos"}`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-hf-text-2">{v.totalUnidades.toLocaleString("pt-BR")} itens vendidos no mês.</p>
      <ListaDePratos titulo="Mais margem no mês" linhas={v.maisMargem} valor={(l) => `${brl(l.margemNoMes)} · ${un(l.unidades)}`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ListaDePratos titulo="Pratos que menos saem" linhas={v.pratosParados} valor={(l) => un(l.unidades)} />
        <ListaDePratos titulo="Bebidas que menos saem" linhas={v.bebidasParadas} valor={(l) => un(l.unidades)} />
      </div>
      {(v.semMargem > 0 || v.semProduto > 0) && (
        <p className="text-xs text-hf-muted">
          {v.semMargem > 0 && `${v.semMargem} ${v.semMargem === 1 ? "item vendido está" : "itens vendidos estão"} sem margem: a ficha não tem custo ou rendimento completo. `}
          {v.semProduto > 0 && `${v.semProduto} ${v.semProduto === 1 ? "item não tem" : "itens não têm"} produto cadastrado.`}
        </p>
      )}
    </div>
  );
}
