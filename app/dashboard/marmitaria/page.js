"use client";

// Painel da marmitaria. Enquanto falta configuração, "Primeiros passos" vem
// primeiro; sem venda no período, um aviso só (em vez de seis cartões "Sem
// dados apurados"); com vendas, os seis números, rankings e alertas.
// Nenhum número de demonstração.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMarmitaria } from "../../components/marmitaria/contexto";
import { useDreMarmitaria } from "../../components/marmitaria/Dre";
import { CheckCircle2, Circle } from "lucide-react";
import { Abas, Aviso, Campo, Indicador, Secao, Selo, brl, inputCls, pctTxt, num } from "../../components/marmitaria/ui";
import { fetchVendas, ESTOQUE_MARMITARIA, ESTOQUE_EMBALAGENS } from "../../lib/marmitaria/dados";
import { cmvPrevisto, dreMarmitaria, fatorSaldo, periodo, rankingMarmitas, resultadoPorCanal } from "../../lib/marmitaria/nucleo.mjs";

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

  const locais = base.estoques.filter((e) => e.slug === ESTOQUE_MARMITARIA || e.slug === ESTOQUE_EMBALAGENS).map((e) => e.id);
  const hoje = hojeIso();
  const alertasEstoque = base.itensEstoque.filter((i) => locais.includes(i.estoque_id)).map((i) => {
    const ins = base.insumos.get(i.insumo_id);
    const saldo = (Number(i.quantidade_atual) || 0) / fatorSaldo(ins);
    const dias = i.validade ? Math.round((new Date(`${i.validade}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000) : null;
    const min = i.estoque_minimo == null ? null : Number(i.estoque_minimo);
    const motivo = saldo <= 0 ? "zerado" : dias !== null && dias < 0 ? "vencido" : dias !== null && dias <= 2 ? `vence em ${dias} dia(s)` : min !== null && saldo < min ? "abaixo do mínimo" : null;
    return motivo ? { nome: ins?.nome || "Produto", motivo } : null;
  }).filter(Boolean);

  // Primeiros passos: o que precisa existir para os números aparecerem, na
  // ordem em que o dono configura. Com tudo pronto, o cartão some.
  const incompletas = base.marmitas.filter((m) => m.ativo !== false && !custos.get(m.id)?.completo).length;
  const passos = [
    { feito: base.marmitas.length > 0, texto: "Cadastrar as marmitas", href: "/dashboard/marmitaria/marmitas", acao: "Cadastrar" },
    { feito: base.marmitas.length > 0 && !incompletas, texto: incompletas ? `Completar o custo de ${incompletas} marmita(s)` : "Custo das marmitas completo", href: "/dashboard/marmitaria/marmitas", acao: "Revisar" },
    { feito: base.config.canais.length > 0, texto: "Canais de venda e taxas (iFood, WhatsApp, balcão)", href: "/dashboard/marmitaria/configuracoes", acao: "Configurar" },
    { feito: base.config.tributos_pct !== null, texto: "Alíquota de tributos", href: "/dashboard/marmitaria/configuracoes", acao: "Configurar" },
    { feito: base.config.margem_alvo_pct !== null, texto: "Margem-alvo (para sugerir preço)", href: "/dashboard/marmitaria/configuracoes", acao: "Configurar" },
    { feito: locais.length > 0, texto: "Ativar o estoque da marmitaria (CMV real)", href: "/dashboard/marmitaria/estoque?aba=estoque", acao: "Ativar" },
    { feito: !!doMes?.cmo.linhas.length, texto: "Alocar quem trabalha na marmitaria (CMO)", href: "/dashboard/marmitaria/funcionarios", acao: "Alocar" },
  ];
  const prontos = passos.filter((x) => x.feito).length;
  const semVendas = vendas !== null && !vendas.length;

  const mesTxt = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const periodoTxt = filtro === "hoje" ? "hoje" : filtro === "semana" ? "nesta semana" : filtro === "mes" ? `em ${mesTxt}` : "no período";
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

      {prontos < passos.length && (
        <Secao titulo="Primeiros passos" subtitulo={`${prontos} de ${passos.length} prontos. Sem isso, os números da marmitaria ficam incompletos.`}>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-hf-elevated" aria-hidden="true">
            <div className="h-full rounded-full bg-hf-accent" style={{ width: `${Math.round((prontos / passos.length) * 100)}%` }} />
          </div>
          <ul className="divide-y divide-hf-border">
            {passos.map((x) => (
              <li key={x.texto} className="flex items-center gap-3 py-1.5 text-sm">
                {x.feito ? <CheckCircle2 size={18} className="shrink-0 text-hf-accent" /> : <Circle size={18} className="shrink-0 text-hf-border-strong" />}
                <span className={`min-w-0 flex-1 ${x.feito ? "text-hf-muted line-through decoration-hf-border-strong" : "text-hf-text"}`}>{x.texto}</span>
                {!x.feito && <Link href={x.href} className="inline-flex min-h-[40px] shrink-0 items-center rounded-lg px-2 font-semibold text-hf-accent hover:bg-hf-accent/5">{x.acao} →</Link>}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {semVendas ? (
        <Secao>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-hf-text">Nenhuma venda lançada {periodoTxt}</p>
              <p className="mt-0.5 text-sm text-hf-muted">Faturamento, CMV, margem, lucro e as mais vendidas aparecem quando houver vendas lançadas.</p>
              {im?.cmo !== null && im?.cmo !== undefined && <p className="mt-1 text-sm text-hf-text-2">CMO de {mesTxt}: <strong className="tabular-nums">{brl(im.cmo)}</strong> <Selo natureza="estimativa" /></p>}
            </div>
            <Link href="/dashboard/marmitaria/financeiro?aba=vendas" className="inline-flex min-h-[44px] items-center rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg hover:brightness-110">Lançar vendas</Link>
          </div>
        </Secao>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Indicador rotulo="Marmitas vendidas" valor={ip?.marmitas ?? null} formato="int" natureza="real" />
          <Indicador rotulo="Faturamento" valor={ip?.receita ?? null} natureza="real" nota="vendas − descontos − cancelamentos" />
          <Indicador rotulo={cmvLinha?.rotulo?.includes("real") ? "CMV real" : "CMV"} valor={ip?.cmv ?? null} natureza={cmvLinha?.natureza} nota={ip?.cmvPct !== null && ip?.cmvPct !== undefined ? `${pctTxt(ip.cmvPct)} do faturamento${cmvLinha?.natureza === "estimado" ? " · previsto pelas fichas" : ""}` : cmvLinha?.nota} />
          <Indicador rotulo="CMO" valor={im?.cmo ?? null} natureza="estimativa" nota={im?.cmo !== null && im?.cmo !== undefined ? `${mesTxt}${im.cmoPct !== null ? ` · ${pctTxt(im.cmoPct)} do faturamento` : ""}` : "aloque os funcionários"} />
          <Indicador rotulo="Margem de contribuição" valor={ip?.margemContribuicao ?? null} natureza={doPeriodo?.natureza} nota={ip?.margemContribuicaoPct !== null && ip?.margemContribuicaoPct !== undefined ? pctTxt(ip.margemContribuicaoPct) : null} />
          <Indicador rotulo="Lucro líquido" valor={im?.lucroLiquido ?? null} natureza={doMes?.dre?.natureza} nota={im?.lucroLiquido !== null && im?.lucroLiquido !== undefined ? `${mesTxt} · gerencial` : "depende de vendas, CMV, CMO e despesas do mês"} destaque />
        </div>
      )}

      {(ranking.length > 0 || maisLucro.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {ranking.length > 0 && (
            <Secao titulo="Mais vendidas no período">
              <ol className="divide-y divide-hf-border">{ranking.map((r, i) => <li key={r.ficha_id} className="flex justify-between gap-2 py-2 text-sm"><span className="min-w-0 truncate">{i + 1}. {r.nome}</span><span className="shrink-0 tabular-nums text-hf-text-2">{num(r.quantidade, 0)} un · {brl(r.receita)}</span></li>)}</ol>
            </Secao>
          )}
          {maisLucro.length > 0 && (
            <Secao titulo="Maior margem por marmita" subtitulo={canal ? `Prevista pela ficha no ${canal.nome}` : null}>
              <ol className="divide-y divide-hf-border">{maisLucro.map(({ m, r }) => <li key={m.id} className="flex justify-between gap-2 py-2 text-sm"><span className="min-w-0 truncate">{m.nome_receita}</span><span className="shrink-0 tabular-nums font-semibold">{brl(r.margemContribuicao)} · {pctTxt(r.margemContribuicaoPct)}</span></li>)}</ol>
            </Secao>
          )}
        </div>
      )}

      {negativas.length > 0 && (
        <Aviso tipo="alerta">
          <p className="font-semibold">Margem negativa (vende abaixo do custo variável):</p>
          <ul className="ml-4 list-disc">{negativas.map(({ m, r }) => <li key={m.id}>{m.nome_receita}: {brl(r.margemContribuicao)} por marmita no {canal.nome}</li>)}</ul>
        </Aviso>
      )}

      {locais.length > 0 && (
        <Secao titulo="Alertas de estoque" subtitulo="Locais da marmitaria.">
          {alertasEstoque.length ? <ul className="divide-y divide-hf-border">{alertasEstoque.slice(0, 12).map((a) => <li key={a.nome} className="flex justify-between gap-2 py-2 text-sm"><span className="min-w-0 truncate">{a.nome}</span><span className="shrink-0 font-semibold text-hf-warning">{a.motivo}</span></li>)}</ul>
            : <p className="text-sm text-hf-text-2">Nada zerado, vencendo ou abaixo do mínimo.</p>}
        </Secao>
      )}

      {base.unidade?.ifood_conectado && (
        <Aviso>A unidade está marcada como conectada ao iFood, mas a importação de pedidos para a marmitaria ainda não foi homologada: os pedidos pendentes aparecerão aqui quando estiver.</Aviso>
      )}
    </div>
  );
}
