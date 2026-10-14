"use client";

// Painel da marmitaria. Seis números primeiro; depois rankings, alertas e o
// que falta cadastrar. Sem dado → "Sem dados apurados" e o caminho para
// resolver. Nenhum número de demonstração.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMarmitaria } from "../../components/marmitaria/contexto";
import { useDreMarmitaria } from "../../components/marmitaria/Dre";
import { Abas, Aviso, Campo, Indicador, Secao, SemDados, brl, inputCls, pctTxt, num } from "../../components/marmitaria/ui";
import { fetchVendas, ESTOQUE_MARMITARIA, ESTOQUE_EMBALAGENS } from "../../lib/marmitaria/dados";
import { cmvPrevisto, dreMarmitaria, fatorSaldo, periodo, rankingMarmitas, resultadoPorCanal, unidadeExclusiva } from "../../lib/marmitaria/nucleo.mjs";

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const FILTROS = [{ id: "hoje", rotulo: "Hoje" }, { id: "semana", rotulo: "Semana" }, { id: "mes", rotulo: "Mês" }, { id: "personalizado", rotulo: "Personalizado" }];

export default function VisaoGeralPage() {
  const { base, unidadeId, custos, carregando } = useMarmitaria();
  const [filtro, setFiltro] = useState("mes");
  const [pers, setPers] = useState({ de: `${hojeIso().slice(0, 7)}-01`, ate: hojeIso() });
  const p = periodo(filtro, hojeIso(), pers);
  const mes = p.ate.slice(0, 7);
  const doMes = useDreMarmitaria(mes);
  const [vendas, setVendas] = useState(null);

  useEffect(() => {
    if (!unidadeId) return;
    let vivo = true;
    fetchVendas(unidadeId, p.de, p.ate).then((r) => { if (vivo) setVendas(r.data || []); });
    return () => { vivo = false; };
  }, [unidadeId, p.de, p.ate]);

  const custoCompleto = useMemo(() => new Map([...custos.entries()].filter(([, c]) => c.completo).map(([id, c]) => [id, c.total])), [custos]);
  const doPeriodo = useMemo(() => {
    if (!base || !vendas) return null;
    const mesInteiro = filtro === "mes";
    return dreMarmitaria({ vendas, contas: [], cmvReal: mesInteiro ? doMes?.cmvReal : null, cmvPrev: cmvPrevisto(vendas, custoCompleto), tributosPct: base.config.tributos_pct });
  }, [base, vendas, filtro, doMes, custoCompleto]);

  const canal = base?.config.canais.find((c) => c.ativo) || null;
  const porMarmita = useMemo(() => {
    if (!base || !canal) return [];
    return base.marmitas.filter((m) => m.ativo !== false).map((m) => {
      const c = custos.get(m.id);
      const preco = m.precos[canal.id] ?? Number(m.preco_venda);
      const r = c && preco > 0 ? resultadoPorCanal({ preco, custoTecnico: c.total, canal, tributosPct: base.config.tributos_pct }) : null;
      return { m, c, r };
    }).filter((x) => x.r?.valido && x.r.margemContribuicao !== null);
  }, [base, canal, custos]);

  if (!base) return carregando ? <Secao><p className="text-sm text-hf-muted">Carregando o painel…</p></Secao> : null;

  const ip = doPeriodo?.indicadores;
  const im = doMes?.dre?.indicadores;
  const cmvLinha = doPeriodo?.linhas.find((l) => l.id === "cmv");
  const ranking = vendas ? rankingMarmitas(vendas, new Map(base.marmitas.map((m) => [m.id, { nome: m.nome_receita }]))).slice(0, 5) : [];
  const maisLucro = [...porMarmita].sort((a, b) => b.r.margemContribuicao - a.r.margemContribuicao).slice(0, 5);
  const negativas = porMarmita.filter((x) => x.r.margemContribuicao < 0);

  const locais = base.estoques.filter((e) => unidadeExclusiva(base.config) || e.slug === ESTOQUE_MARMITARIA || e.slug === ESTOQUE_EMBALAGENS).map((e) => e.id);
  const hoje = hojeIso();
  const alertasEstoque = base.itensEstoque.filter((i) => locais.includes(i.estoque_id)).map((i) => {
    const ins = base.insumos.get(i.insumo_id);
    const saldo = (Number(i.quantidade_atual) || 0) / fatorSaldo(ins);
    const dias = i.validade ? Math.round((new Date(`${i.validade}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000) : null;
    const min = i.estoque_minimo == null ? null : Number(i.estoque_minimo);
    const motivo = saldo <= 0 ? "zerado" : dias !== null && dias < 0 ? "vencido" : dias !== null && dias <= 2 ? `vence em ${dias} dia(s)` : min !== null && saldo < min ? "abaixo do mínimo" : null;
    return motivo ? { nome: ins?.nome || "Produto", motivo } : null;
  }).filter(Boolean);

  const pendencias = [];
  if (!base.marmitas.length) pendencias.push(["Nenhuma marmita cadastrada.", "/dashboard/marmitaria/marmitas", "Cadastrar marmita"]);
  if (!base.config.canais.length) pendencias.push(["Canais de venda e taxas não configurados.", "/dashboard/marmitaria/configuracoes", "Configurar canais"]);
  if (base.config.tributos_pct === null) pendencias.push(["Alíquota de tributos não configurada.", "/dashboard/marmitaria/configuracoes", "Configurar"]);
  if (base.config.margem_alvo_pct === null) pendencias.push(["Margem-alvo não configurada (sem sugestão de preço).", "/dashboard/marmitaria/configuracoes", "Configurar"]);
  if (!locais.length) pendencias.push(["Estoque da marmitaria não ativado (sem CMV real).", "/dashboard/marmitaria/estoque?aba=estoque", "Ativar estoque"]);
  const incompletas = base.marmitas.filter((m) => !custos.get(m.id)?.completo).length;
  if (incompletas) pendencias.push([`${incompletas} marmita(s) com custo incompleto.`, "/dashboard/marmitaria/marmitas", "Revisar"]);
  if (vendas && !vendas.length) pendencias.push(["Nenhuma venda lançada no período.", "/dashboard/marmitaria/financeiro?aba=vendas", "Lançar vendas"]);
  if (doMes && !doMes.cmo.linhas.length) pendencias.push(["Nenhum funcionário alocado (sem CMO).", "/dashboard/marmitaria/funcionarios", "Alocar"]);

  const mesTxt = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1"><Abas abas={FILTROS} valor={filtro} onChange={setFiltro} /></div>
        {filtro === "personalizado" && (
          <div className="flex gap-2">
            <Campo rotulo="De"><input type="date" className={inputCls} value={pers.de} onChange={(e) => setPers({ ...pers, de: e.target.value })} /></Campo>
            <Campo rotulo="Até"><input type="date" className={inputCls} value={pers.ate} onChange={(e) => setPers({ ...pers, ate: e.target.value })} /></Campo>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Indicador rotulo="Marmitas vendidas" valor={ip?.marmitas ?? null} formato="int" natureza="real" />
        <Indicador rotulo="Faturamento" valor={ip?.receita ?? null} natureza="real" nota="vendas − descontos − cancelamentos" />
        <Indicador rotulo={cmvLinha?.rotulo?.includes("real") ? "CMV real" : "CMV"} valor={ip?.cmv ?? null} natureza={cmvLinha?.natureza} nota={ip?.cmvPct !== null && ip?.cmvPct !== undefined ? `${pctTxt(ip.cmvPct)} do faturamento${cmvLinha?.natureza === "estimado" ? " · previsto pelas fichas" : ""}` : cmvLinha?.nota} />
        <Indicador rotulo="CMO" valor={im?.cmo ?? null} natureza="estimativa" nota={im?.cmo !== null && im?.cmo !== undefined ? `${mesTxt}${im.cmoPct !== null ? ` · ${pctTxt(im.cmoPct)} do faturamento` : ""}` : "aloque os funcionários"} />
        <Indicador rotulo="Margem de contribuição" valor={ip?.margemContribuicao ?? null} natureza={doPeriodo?.natureza} nota={ip?.margemContribuicaoPct !== null && ip?.margemContribuicaoPct !== undefined ? pctTxt(ip.margemContribuicaoPct) : null} />
        <Indicador rotulo="Lucro líquido" valor={im?.lucroLiquido ?? null} natureza={doMes?.dre?.natureza} nota={im?.lucroLiquido !== null && im?.lucroLiquido !== undefined ? `${mesTxt} · gerencial` : "depende de vendas, CMV, CMO e despesas do mês"} destaque />
      </div>

      {pendencias.length > 0 && (
        <Secao titulo="Para os números aparecerem" subtitulo="O que ainda falta cadastrar ou lançar.">
          <ul className="divide-y divide-hf-border">
            {pendencias.map(([t, href, acao]) => (
              <li key={t} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-hf-text-2">{t}</span>
                <Link href={href} className="inline-flex min-h-[40px] items-center rounded-lg px-2 font-semibold text-hf-accent hover:bg-hf-accent/5">{acao} →</Link>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Mais vendidas no período">
          {ranking.length ? (
            <ol className="divide-y divide-hf-border">{ranking.map((r, i) => <li key={r.ficha_id} className="flex justify-between gap-2 py-2 text-sm"><span>{i + 1}. {r.nome}</span><span className="tabular-nums text-hf-text-2">{num(r.quantidade, 0)} un · {brl(r.receita)}</span></li>)}</ol>
          ) : <SemDados motivo="Lance as vendas com a marmita identificada para ver o ranking." href="/dashboard/marmitaria/financeiro?aba=vendas" acao="Lançar vendas" />}
        </Secao>
        <Secao titulo="Maior margem por marmita" subtitulo={canal ? `Prevista pela ficha no ${canal.nome}` : null}>
          {maisLucro.length ? (
            <ol className="divide-y divide-hf-border">{maisLucro.map(({ m, r }) => <li key={m.id} className="flex justify-between gap-2 py-2 text-sm"><span>{m.nome_receita}</span><span className="tabular-nums font-semibold">{brl(r.margemContribuicao)} · {pctTxt(r.margemContribuicaoPct)}</span></li>)}</ol>
          ) : <SemDados motivo={canal ? "Cadastre marmitas com preço e custo." : "Configure os canais de venda."} href={canal ? "/dashboard/marmitaria/marmitas" : "/dashboard/marmitaria/configuracoes"} acao={canal ? "Ver marmitas" : "Configurar canais"} />}
        </Secao>
      </div>

      {negativas.length > 0 && (
        <Aviso tipo="alerta">
          <p className="font-semibold">Margem negativa (vende abaixo do custo variável):</p>
          <ul className="ml-4 list-disc">{negativas.map(({ m, r }) => <li key={m.id}>{m.nome_receita}: {brl(r.margemContribuicao)} por marmita no {canal.nome}</li>)}</ul>
        </Aviso>
      )}

      <Secao titulo="Alertas de estoque" subtitulo="Locais da marmitaria.">
        {!locais.length ? <SemDados motivo="Ative o estoque da marmitaria." href="/dashboard/marmitaria/estoque?aba=estoque" acao="Ativar" />
          : alertasEstoque.length ? <ul className="divide-y divide-hf-border">{alertasEstoque.slice(0, 12).map((a) => <li key={a.nome} className="flex justify-between py-2 text-sm"><span>{a.nome}</span><span className="font-semibold text-hf-warning">{a.motivo}</span></li>)}</ul>
            : <p className="text-sm text-hf-text-2">Nada zerado, vencendo ou abaixo do mínimo.</p>}
      </Secao>

      {base.unidade?.ifood_conectado && (
        <Aviso>A unidade está marcada como conectada ao iFood, mas a importação de pedidos para a marmitaria ainda não foi homologada: os pedidos pendentes aparecerão aqui quando estiver.</Aviso>
      )}
    </div>
  );
}
