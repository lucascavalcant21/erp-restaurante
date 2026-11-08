"use client";

// DASHBOARD GERENCIAL DA MARMITARIA (pedido do dono, 08/11/2026): a "Visão
// geral" no modelo de gestão — produtos, preço médio, custos fixos, ponto de
// equilíbrio e resultado no topo; maiores margens com a foto do prato; custos
// fixos em rosca; análise do produto; faturamento × custos fixos; maiores
// custos; custo operacional por dia/hora/minuto e ponto de equilíbrio sem e com
// lucro. Tudo com o que o módulo já tem: o Cardápio (useCardapio), a equipe e os
// custos fixos (useCustosEmbutidos), as vendas lançadas e o DRE do mês.
// Contas em app/lib/painel-gerencial.mjs; nenhum número de demonstração.

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, BarChart3, Clock, Coins, Gauge, ListOrdered, Package, PieChart, Scale, Tag, TrendingUp, UtensilsCrossed, Wallet } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { useCardapio } from "../../../components/marmitaria/useCardapio";
import { useDreMarmitaria } from "../../../components/marmitaria/Dre";
import { fetchVendas } from "../../../lib/marmitaria/dados";
import { contribuicaoMedia } from "../../../lib/metas-negocio.mjs";
import { analiseDoPrato, custoOperacional, faturamentoContraFixos, fatiasDeCusto, maioresPor, pontosDeEquilibrio } from "../../../lib/painel-gerencial.mjs";
import { AnaliseDoItem, Bloco, BarrasHorizontais, CartaoKpi, CustoOperacional, FaltaDado, FaturamentoXCustos, GraficoMaioresMargens, PontoDeEquilibrio, Rosca, TituloGestao, brl } from "../../../components/gerencial/PainelGerencial";

const CONFIG = "/dashboard/marmitaria/configuracoes";
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const ultimoDia = (mes) => { const [a, m] = mes.split("-").map(Number); return new Date(a, m, 0).toLocaleDateString("sv-SE"); };
const rotuloMes = (mes) => { const t = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const faturamentoDasVendas = (vendas) => vendas.reduce((t, v) => t + (Number(v.valor_bruto) || 0) - (Number(v.descontos) || 0) - (Number(v.cancelamentos) || 0), 0);

function Painel() {
  const { base, unidadeId } = useMarmitaria();
  const { canais, canal, setCanalId, embutidos, linhas } = useCardapio();
  const [mes, setMes] = useState(hojeIso().slice(0, 7));
  const [vendas, setVendas] = useState(null);
  const [escolhido, setEscolhido] = useState("");
  const doMes = useDreMarmitaria(mes);

  useEffect(() => {
    if (!unidadeId) return undefined;
    let vivo = true;
    setVendas(null);
    fetchVendas(unidadeId, `${mes}-01`, ultimoDia(mes)).then((r) => { if (vivo) setVendas(r.data || []); });
    return () => { vivo = false; };
  }, [unidadeId, mes]);

  const d = useMemo(() => {
    const rateio = base.config.rateio || {};
    const pratos = linhas.filter((l) => l.secao === "marmitas");
    const analises = pratos.map(analiseDoPrato).filter(Boolean);
    const media = contribuicaoMedia(linhas, vendas || []);
    const precos = pratos.map((l) => l.precoPago).filter((v) => v > 0);
    const lucros = analises.filter((a) => a.lucro !== null);

    // Custos do mês: equipe (CMO) + custos fixos, os mesmos que entram em cada marmita.
    const equipe = embutidos.cmoMes;
    const fixos = embutidos.fixosMes;
    const custoMes = equipe === null && fixos === null ? null : (equipe || 0) + (fixos || 0);
    const linhasRosca = [
      ...(equipe ? [{ rotulo: "Equipe", valor: equipe }] : []),
      ...(embutidos.fixosLinhas?.length ? embutidos.fixosLinhas.map((f) => ({ rotulo: f.nome, valor: f.valor })) : fixos ? [{ rotulo: "Custos fixos", valor: fixos }] : []),
    ];
    const metaReais = Number(rateio.meta_lucro_reais) > 0 ? Number(rateio.meta_lucro_reais)
      : base.config.margem_alvo_pct != null && media?.ticket ? (media.ticket * Number(base.config.margem_alvo_pct)) / 100 : null;

    const faturamento = vendas && vendas.length ? faturamentoDasVendas(vendas) : null;
    const contribuicaoMes = vendas && vendas.length ? doMes?.dre?.indicadores?.margemContribuicao ?? null : null;
    return {
      pratos, analises, media,
      precoMedio: media?.ticket ?? (precos.length ? precos.reduce((t, v) => t + v, 0) / precos.length : null),
      lucroMedio: lucros.length ? lucros.reduce((t, a) => t + a.lucro, 0) / lucros.length : null,
      custoMes,
      rosca: fatiasDeCusto(linhasRosca, { maximo: 5 }),
      equilibrio: pontosDeEquilibrio({ custoFixoMes: custoMes, contribuicao: media?.contribuicao ?? null, ticket: media?.ticket ?? null, lucroMetaPorUnidade: metaReais, diasMes: rateio.dias_operacao_mes }),
      operacional: custoOperacional({ custoMes, diasMes: rateio.dias_operacao_mes, horasDia: rateio.horas_operacao_dia }),
      fxf: faturamentoContraFixos({ faturamento, contribuicao: contribuicaoMes, custosFixos: custoMes }),
      margens: maioresPor(analises, "contribuicao", 5),
      custos: maioresPor(analises, "custo", 5),
      vendidas: vendas ? vendas.reduce((t, v) => t + (Number(v.quantidade) || 0), 0) : null,
    };
  }, [base, linhas, embutidos, vendas, doMes]);

  const atual = d.margens[0] || d.analises[0] || null;
  const eq = d.equilibrio;
  const res = d.fxf.resultado;

  return (
    <div className="space-y-4">
      <TituloGestao icone={Gauge} subtitulo={`Marmitaria · ${rotuloMes(mes)} · preços e margens no ${canal.nome}`}>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={mes} max={hojeIso().slice(0, 7)} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês"
            className="min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-medium text-hf-text outline-none focus:border-hf-accent" />
          {canais.length > 1 && (
            <select value={canal.id} onChange={(e) => setCanalId(e.target.value)} aria-label="Plataforma"
              className="min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-medium text-hf-text outline-none focus:border-hf-accent">
              {canais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
        </div>
      </TituloGestao>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CartaoKpi icone={Package} rotulo="Produtos" valor={d.pratos.length} formato="int" nota={d.vendidas !== null ? `${d.vendidas.toLocaleString("pt-BR")} vendidos no mês` : null} />
        <CartaoKpi icone={Tag} rotulo="Preço médio" valor={d.precoMedio} nota={d.media?.ponderada ? "pelas vendas do mês" : "média do cardápio"} />
        <CartaoKpi icone={Coins} rotulo="Lucro médio por marmita" valor={d.lucroMedio} natureza="previsto" />
        <CartaoKpi icone={Wallet} rotulo="Custos fixos do mês" valor={d.custoMes} natureza="estimativa" nota="equipe + custos fixos" />
        <CartaoKpi icone={Scale} rotulo="Ponto de equilíbrio" valor={eq.ok ? eq.sem.unidadesMes : null} formato="int" nota={eq.ok ? "marmitas no mês" : "faltam dados"} />
        <CartaoKpi icone={TrendingUp} rotulo="Resultado do mês" valor={res} destaque={res !== null && res >= 0} natureza="estimativa" nota={res === null ? null : "contribuição − custos fixos"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Bloco icone={BarChart3} titulo="Maiores margens" subtitulo="Margem de contribuição por unidade, prevista pela ficha">
          <GraficoMaioresMargens itens={d.margens.map((a) => ({ id: a.id, nome: a.nome, valor: a.contribuicao, foto: a.foto, icone: UtensilsCrossed }))}
            vazio={<FaltaDado motivo="Nenhuma marmita com preço e custo completos nesta plataforma." href="/dashboard/marmitaria/marmitas/cardapio" acao="Abrir a Precificação" />} />
        </Bloco>
        <Bloco icone={PieChart} titulo="Custos fixos" subtitulo="Equipe e contas do mês">
          {d.rosca.fatias.length ? <Rosca fatias={d.rosca.fatias} total={d.rosca.total} rotuloTotal="por mês" />
            : <FaltaDado motivo={`Falta informar: ${embutidos.faltando.filter((f) => f !== "marmitas por mês").join(", ") || "custos fixos"}.`} href={CONFIG} acao="Preencher em Configurações" />}
        </Bloco>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco icone={BadgeDollarSign} titulo="Análise do produto">
          {d.analises.length ? <AnaliseDoItem opcoes={d.pratos.map((l) => ({ id: l.id, nome: l.nome }))} valor={escolhido || atual?.id} onChange={setEscolhido}
            analise={escolhido ? d.analises.find((a) => a.id === escolhido) || null : atual} icone={UtensilsCrossed} />
            : <FaltaDado motivo="Monte as fichas e forme os preços para analisar cada produto." href="/dashboard/marmitaria/marmitas/cardapio" acao="Abrir a Precificação" />}
        </Bloco>
        <Bloco icone={ListOrdered} titulo="Maiores custos" subtitulo="Custo de cada unidade: alimentos, pré-preparos e embalagem">
          {d.custos.length ? <BarrasHorizontais itens={d.custos.map((a) => ({ id: a.id, nome: a.nome, valor: a.custo }))} />
            : <FaltaDado motivo="Nenhuma marmita com custo completo." href="/dashboard/marmitaria/marmitas" acao="Revisar as fichas" />}
        </Bloco>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloco icone={Wallet} titulo="Faturamento × custos fixos" subtitulo={rotuloMes(mes)}>
          {vendas === null ? <p className="text-sm text-hf-muted">Carregando as vendas…</p>
            : d.fxf.faturamento === null ? <FaltaDado motivo={`Nenhuma venda lançada em ${rotuloMes(mes).toLowerCase()}.`} href="/dashboard/marmitaria/financeiro?aba=vendas" acao="Lançar vendas" />
              : <FaturamentoXCustos r={d.fxf} rotuloFaturamento={`Faturamento (${(d.vendidas || 0).toLocaleString("pt-BR")} vendas)`} />}
        </Bloco>
        <Bloco icone={Clock} titulo="Custo operacional">
          <CustoOperacional c={d.operacional} hrefConfig={CONFIG} />
        </Bloco>
        <Bloco icone={Scale} titulo="Ponto de equilíbrio" subtitulo="Calculado com base nas despesas">
          <PontoDeEquilibrio p={eq} unidade="marmitas" hrefConfig={CONFIG} />
        </Bloco>
      </div>

      <p className="text-xs text-hf-muted">Faturamento: REAL (vendas lançadas). Margens, custos e lucro por marmita: previstos pela ficha técnica no {canal.nome}. Custos fixos, resultado, custo operacional e ponto de equilíbrio: ESTIMATIVA (equipe e contas do último mês fechado ou o que foi informado em Configurações). Custos fixos no mês: {brl(d.custoMes)}.</p>
    </div>
  );
}

export default function DashboardGerencialMarmitaria() {
  const { base, carregando } = useMarmitaria();
  if (!base) return carregando ? <p className="rounded-2xl border border-hf-border bg-hf-surface p-6 text-sm text-hf-muted">Carregando o dashboard…</p> : null;
  return <Painel />;
}
