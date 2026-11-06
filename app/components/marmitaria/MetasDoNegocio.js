"use client";

// Metas da marmitaria: o custo do dia, o ponto de equilíbrio, as metas por período,
// a previsão do mês e para onde vai cada real do faturamento.

import { useEffect, useMemo, useState } from "react";
import { useMarmitaria } from "./contexto";
import { Secao, Selo, brl } from "./ui";
import { Estrutura, Lista, Numero, Projecao, TabelaDePeriodos, inteiro } from "../metas/BlocosDeMetas";
import { fetchVendas } from "../../lib/marmitaria/dados";
import { contribuicaoMedia, estrategia, estruturaDoMes, gargaloDaEstrutura, lucroDasVendas, menosVendidos, movimentoRecente, pontoDeEquilibrio, porPeriodo, previsaoDoMes, vendasDoMes } from "../../lib/metas-negocio.mjs";

function DiagnosticoDeLucro({ bolso, gargalo, pratos, bebidas, movimento }) {
  return (
    <>
      {bolso.lucro !== null ? <>
        <p className="text-xs font-bold text-hf-text-2">Lucro estimado nos últimos 30 dias</p>
        <p className={`text-3xl font-black tabular-nums ${bolso.lucro > 0 ? "text-hf-success" : "text-hf-danger"}`}>{brl(bolso.lucro)}</p>
        <p className="text-sm text-hf-text-2">De {brl(bolso.faturamento)} vendidos.{bolso.pct !== null ? ` Sobrou ${String(bolso.pct).replace(".", ",")}%.` : ""}{bolso.semLucro > 0 ? ` ${inteiro(bolso.semLucro)} itens ficaram fora da conta, sem preço ou custo completo.` : ""}</p>
      </> : <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: {bolso.faturamento > 0 ? `${brl(bolso.faturamento)} vendidos, mas sem itens com preço e custo completos.` : "nenhuma venda lançada nos últimos 30 dias."}</p>}
      <div className="mt-3 space-y-3">
        {gargalo && <p className="rounded-xl border border-hf-danger/40 bg-hf-danger/10 p-3 text-sm text-hf-text"><b>Principal gargalo: {gargalo.rotulo}.</b> Está em {String(gargalo.pct).replace(".", ",")}%, acima de {gargalo.limite}%. O excesso reduz o lucro em {brl(gargalo.excesso)} por mês.</p>}
        {movimento && movimento.variacaoPct < 0 && <p className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-sm text-hf-text"><b>O volume de vendas caiu {Math.abs(movimento.variacaoPct)}%.</b> Foram {inteiro(movimento.atual)} itens nos últimos 7 dias, contra {inteiro(movimento.anterior)} nos 7 anteriores. O sistema mostra a queda, mas a causa precisa de avaliações e pesquisa com clientes.</p>}
        <Lista titulo="Pratos de menor giro" itens={pratos} />
        <Lista titulo="Bebidas de menor giro" itens={bebidas} />
      </div>
    </>
  );
}

export default function MetasDoNegocio({ linhas, embutidos, pratos, catalogo, vendas30 }) {
  const { base, unidadeId } = useMarmitaria();
  const [vendas, setVendas] = useState([]);
  const hoje = new Date().toLocaleDateString("sv-SE");
  const r = base.config.rateio || {};
  const diasMes = Number(r.dias_operacao_mes) > 0 ? Number(r.dias_operacao_mes) : null;
  const metaMes = Number(r.meta_faturamento_mes) > 0 ? Number(r.meta_faturamento_mes) : null;

  useEffect(() => {
    if (!unidadeId) return undefined;
    let vivo = true;
    fetchVendas(unidadeId, `${hoje.slice(0, 7)}-01`, hoje).then((res) => { if (vivo) setVendas(res.data || []); });
    return () => { vivo = false; };
  }, [unidadeId, hoje]);

  const dados = useMemo(() => {
    const media = contribuicaoMedia(linhas, vendas30);
    const eq = pontoDeEquilibrio({ cmoMes: embutidos.cmoMes, fixosMes: embutidos.fixosMes, diasMes, contribuicao: media?.contribuicao ?? null, ticket: media?.ticket ?? null });
    const dias = vendasDoMes(vendas, hoje);
    const equilibrioMes = eq.ok ? eq.faturamentoMes : null;
    const prev = previsaoDoMes({ dias, hojeIso: hoje, diasMes, metaMes, equilibrioMes });
    return {
      eq, dias, prev, equilibrioMes, plano: estrategia(prev, pratos),
      periodoEq: eq.ok ? porPeriodo(eq.faturamentoMes, diasMes) : null, periodoMeta: porPeriodo(metaMes, diasMes),
      estrutura: estruturaDoMes({ faturamento: prev.ok ? prev.previsto : metaMes, cmvPct: media?.cmvPct ?? null, cmoLinhas: embutidos.cmoLinhas, fixosLinhas: embutidos.fixosLinhas }),
    };
  }, [linhas, vendas, vendas30, embutidos, diasMes, metaMes, pratos, hoje]);
  const { eq } = dados;
  const hojeDiag = useMemo(() => ({
    bolso: lucroDasVendas(vendas30, pratos), gargalo: gargaloDaEstrutura(dados.estrutura), movimento: movimentoRecente(vendas30, hoje),
    pratos: vendas30.length ? menosVendidos(catalogo.marmita, vendas30) : [], bebidas: vendas30.length ? menosVendidos(catalogo.bebida, vendas30) : [],
  }), [vendas30, pratos, dados.estrutura, catalogo, hoje]);

  return (
    <div className="space-y-4">
      <Secao titulo="Diagnóstico de lucro" subtitulo="Lucro estimado, principais gargalos e giro do cardápio." direita={<Selo natureza="estimado" />}>
        <DiagnosticoDeLucro {...hojeDiag} />
      </Secao>
      <Secao titulo="Custo operacional diário" subtitulo="Funcionários e custos fixos divididos pelos dias de operação." direita={<Selo natureza="estimado" />}>
        {eq.ok ? (
          <div className="grid grid-cols-2 gap-3">
            <Numero rotulo="Custo diário" valor={brl(eq.custoDia)} nota={`${brl(eq.custoMes)} no mês`} />
            <Numero rotulo="Ponto de equilíbrio" valor={`${inteiro(eq.unidadesDia)} por dia`} nota={`${brl(eq.faturamentoDia)} de vendas`} />
          </div>
        ) : <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: {eq.motivo} Preencha em <a href="/dashboard/marmitaria/configuracoes" className="font-bold underline">Configurações</a>.</p>}
        {eq.ok && <p className="mt-2 text-sm text-hf-text">A partir da {inteiro(eq.unidadesDia)}ª marmita do dia, as vendas passam a gerar lucro.</p>}
      </Secao>
      <Secao titulo="Metas" subtitulo="Ponto de equilíbrio e meta de faturamento por período.">
        <TabelaDePeriodos equilibrio={dados.periodoEq} meta={dados.periodoMeta} />
        {!metaMes && <p className="mt-2 text-sm text-hf-text-2">Defina a meta de faturamento do mês em Configurações.</p>}
      </Secao>
      <Secao titulo="Projeção de faturamento" subtitulo="Calculada pelo ritmo de vendas do mês." direita={<Selo natureza="estimado" />}>
        <Projecao p={dados.prev} dias={dados.dias} metaMes={metaMes} equilibrioMes={dados.equilibrioMes} plano={dados.plano} />
      </Secao>
      {dados.estrutura && (
        <Secao titulo="Estrutura de custos" subtitulo={`Sobre ${brl(dados.estrutura.faturamento)}. Abra cada grupo para ver o detalhe por pessoa e por conta.`}>
          <Estrutura e={dados.estrutura} />
        </Secao>
      )}
    </div>
  );
}
