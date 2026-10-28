"use client";

// DRE da marmitaria (centro de resultado próprio) e consolidado com o
// restaurante. Toda conta vem do nucleo.mjs; aqui só se lê e se mostra.

import { useEffect, useMemo, useState } from "react";
import { useMarmitaria } from "./contexto";
import { Abas, Aviso, Campo, Indicador, Secao, Selo, brl, inputCls, pctTxt } from "./ui";
import { carregarFinanceiro, carregarEquipe, fetchVendas, ESTOQUE_MARMITARIA, ESTOQUE_EMBALAGENS } from "../../lib/marmitaria/dados";
import { cmoMarmitaria, cmvPrevisto, cmvRealDosEstoques, contasDaMarmitaria, dreMarmitaria, dreConsolidado, encargosDaConfig, fatorSaldo } from "../../lib/marmitaria/nucleo.mjs";
import { custoUnitarioEfetivoInsumo } from "../../lib/ficha-calculos.mjs";
import { somarDiasIso } from "../../lib/cmv-real.mjs";
import { carregarBaseDre, cmvDoMes, cmoDoMesRH } from "../../lib/dre-dados";
import { janelaDoMes, faturamentoDoMes, montarDre } from "../../lib/dre-gerencial.mjs";
import { duplicidadesDeFonte } from "../../lib/ifood/nucleo.mjs";
import ConciliacaoIfood from "./ConciliacaoIfood";

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const proximoMes = (mes) => { const [a, m] = mes.split("-").map(Number); return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`; };

/** Carrega e calcula o DRE da marmitaria de um mês (reusado pela Visão geral). */
export function useDreMarmitaria(mes) {
  const { base, unidadeId, custos } = useMarmitaria();
  const [dados, setDados] = useState(null);
  const estoqueIds = useMemo(() => (base?.estoques || []).filter((e) => e.slug === ESTOQUE_MARMITARIA || e.slug === ESTOQUE_EMBALAGENS).map((e) => e.id), [base]);

  useEffect(() => {
    if (!unidadeId || !base) return;
    let vivo = true;
    const de = `${mes}-01`; const ate = somarDiasIso(proximoMes(mes), -1);
    Promise.all([carregarFinanceiro(unidadeId, estoqueIds), fetchVendas(unidadeId, de, ate), carregarEquipe(unidadeId)])
      .then(([fin, vendas, equipe]) => { if (vivo) setDados({ fin, vendas: vendas.data || [], equipe, erro: [fin.error, vendas.error, equipe.error].filter(Boolean).join(" · ") || null }); });
    return () => { vivo = false; };
  }, [unidadeId, base, mes, estoqueIds]);

  return useMemo(() => {
    if (!dados || !base) return null;
    const { fin, vendas, equipe } = dados;
    const cfg = base.config;
    const custoPorBase = (insumoId) => {
      const ins = base.insumos.get(insumoId);
      if (!ins) return null;
      const c = custoUnitarioEfetivoInsumo(ins);
      // R$ por unidade do SALDO (= do cadastro; garrafa fracionada: por ml)
      return c > 0 ? c / fatorSaldo(ins) : null;
    };
    const cmvReal = cmvRealDosEstoques({ de: `${mes}-01`, ateExclusivo: proximoMes(mes), estoqueIds, contagens: fin.contagens || [], itensPorContagem: fin.itensPorContagem || new Map(),
      compras: fin.compras || [], comprasItens: fin.comprasItens || [], movimentos: fin.movimentos || [], custoPorBase });
    const cmvPrev = cmvPrevisto(vendas, new Map([...custos.entries()].filter(([, c]) => c.completo).map(([id, c]) => [id, c.total])));
    const rv = vendas.reduce((t, v) => t + (Number(v.quantidade) || 0), 0);
    const cmo = cmoMarmitaria({ alocacoes: equipe.alocacoes || [], colaboradores: equipe.colaboradores || [], recibos: equipe.recibos || [],
      encargos: encargosDaConfig(cfg.encargos, equipe.rhConfig), mes, marmitasVendidas: rv });
    const contas = contasDaMarmitaria(fin.contas || [], mes, { centrosDiretos: cfg.centros_diretos, rateio: cfg.rateio });
    const dre = dreMarmitaria({ vendas, contas, cmvReal, cmvPrev, cmo, tributosPct: cfg.tributos_pct,
      nomesCategoria: new Map((fin.categorias || []).map((c) => [c.codigo, c.nome])), nomesCanal: new Map(cfg.canais.map((c) => [c.id, c.nome])) });
    return { dre, cmvReal, cmvPrev, cmo, vendas, erro: dados.erro };
  }, [dados, base, custos, mes, estoqueIds]);
}

function LinhaDre({ l }) {
  const sub = l.tipo !== "linha";
  return (
    <>
      <tr className={sub ? "bg-hf-elevated/50" : ""}>
        <td className={`py-2 pl-2 pr-2 ${sub ? "font-bold text-hf-text" : "text-hf-text-2"}`}>
          {l.rotulo} {l.natureza === "estimado" && <Selo natureza="estimado" />}
          {l.nota && <p className="text-[11px] font-normal text-hf-muted">{l.nota}</p>}
        </td>
        <td className={`py-2 pr-2 text-right tabular-nums ${sub ? "font-bold" : ""} ${l.valor < 0 ? "text-hf-danger" : ""}`}>{l.valor === null ? <span className="text-xs text-hf-muted">Sem dados</span> : brl(l.valor)}</td>
        <td className="py-2 pr-2 text-right text-xs tabular-nums text-hf-muted">{l.pct === null ? "" : pctTxt(l.pct)}</td>
      </tr>
      {l.filhos?.filter((f) => f.valor).map((f) => (
        <tr key={f.rotulo}><td className="py-1 pl-6 pr-2 text-xs text-hf-muted">{f.rotulo}</td><td className="py-1 pr-2 text-right text-xs tabular-nums text-hf-muted">{brl(f.valor)}</td><td /></tr>
      ))}
    </>
  );
}

export default function Dre() {
  const { unidadeId } = useMarmitaria();
  const [mes, setMes] = useState(hojeIso().slice(0, 7));
  const [visao, setVisao] = useState("marmitaria");
  const r = useDreMarmitaria(mes);
  const [baseUnidade, setBaseUnidade] = useState(null);

  useEffect(() => {
    if (visao !== "consolidado" || !unidadeId || baseUnidade) return;
    carregarBaseDre(unidadeId).then(setBaseUnidade);
  }, [visao, unidadeId, baseUnidade]);

  const consolidado = useMemo(() => {
    if (visao !== "consolidado" || !baseUnidade || !r) return null;
    const janela = janelaDoMes(mes, hojeIso());
    const unidade = montarDre({ mes, janela, fat: faturamentoDoMes(baseUnidade.cmvDados?.fonteFaturamento, janela), contas: baseUnidade.contas,
      categorias: baseUnidade.categorias, cmv: cmvDoMes(baseUnidade.cmvDados, janela), cmo: cmoDoMesRH(baseUnidade, mes), params: baseUnidade.params, simulacao: null });
    return { unidade, c: dreConsolidado({ unidade, marmitaria: r.dre }) };
  }, [visao, baseUnidade, r, mes]);

  if (!r) return <Secao><p className="text-sm text-hf-muted">Calculando o resultado…</p></Secao>;
  const ind = r.dre.indicadores;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Mês" className="w-[170px]"><input type="month" className={inputCls} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /></Campo>
        <div className="min-w-[260px] flex-1"><Abas abas={[{ id: "marmitaria", rotulo: "Só a marmitaria" }, { id: "consolidado", rotulo: "Consolidado com o restaurante" }]} valor={visao} onChange={setVisao} /></div>
      </div>
      {r.erro && <Aviso tipo="alerta">Parte dos dados não carregou: {r.erro}</Aviso>}

      {visao === "marmitaria" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador rotulo="Receita de vendas" valor={ind.receita} natureza="real" nota={ind.marmitas !== null ? `${ind.marmitas} marmitas` : null} />
            <Indicador rotulo="Margem de contribuição" valor={ind.margemContribuicao} natureza={r.dre.natureza} nota={ind.margemContribuicaoPct !== null ? pctTxt(ind.margemContribuicaoPct) : null} />
            <Indicador rotulo="Lucro líquido gerencial" valor={ind.lucroLiquido} natureza={r.dre.natureza} nota={ind.margemLiquidaPct !== null ? `margem ${pctTxt(ind.margemLiquidaPct)}` : null} destaque />
            <Indicador rotulo="Ponto de equilíbrio" valor={ind.pontoEquilibrio} natureza={r.dre.natureza} nota={ind.pontoEquilibrioMarmitas ? `${ind.pontoEquilibrioMarmitas} marmitas no mês` : ind.motivoPontoEquilibrio} />
          </div>
          {/* Avisos num quadro só, com o atalho de cada um (pedido do dono, 28/10/2026: "melhore a marmitaria"). */}
          {r.dre.alertas.length > 0 && (
            <div className="rounded-2xl border border-hf-warning/30 bg-hf-warning/5 p-4">
              <p className="text-sm font-black text-hf-text">O que falta para o resultado ficar completo</p>
              <ul className="mt-2 space-y-1.5">
                {r.dre.alertas.map((a) => {
                  const atalho = /venda/i.test(a) ? ["Lançar vendas", "/dashboard/marmitaria/financeiro?aba=vendas"] : /CMO|funcion/i.test(a) ? ["Alocar funcionários", "/dashboard/marmitaria/funcionarios"] : /CMV real/i.test(a) ? ["Fazer contagem", "/dashboard/operacao/estoque/contagens"] : /tribut|imposto/i.test(a) ? ["Preencher impostos", "/dashboard/financeiro/resultado"] : null;
                  return (
                    <li key={a} className="flex flex-wrap items-center justify-between gap-2 text-sm text-hf-text-2">
                      <span className="min-w-0 flex-1">• {a}</span>
                      {atalho && <a href={atalho[1]} className="shrink-0 rounded-lg border border-hf-border bg-hf-surface px-2.5 py-1 text-xs font-bold text-hf-accent hover:bg-hf-elevated">{atalho[0]}</a>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {duplicidadesDeFonte(r.vendas).map((d) => (
            <Aviso key={d.data} tipo="alerta">Possível duplicidade em {new Date(`${d.data}T12:00:00`).toLocaleDateString("pt-BR")}: há {brl(d.valorManual)} de iFood lançado à mão e {brl(d.valorAutomatico)} que chegou sozinho do iFood. Se for o mesmo movimento, exclua o lançamento manual em Vendas.</Aviso>
          ))}
          <Secao titulo="DRE gerencial da marmitaria" subtitulo="Percentuais sobre a receita de vendas. CMV real = estoque inicial + compras + transferências recebidas − enviadas − estoque final dos locais da marmitaria.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm"><tbody className="divide-y divide-hf-border">{r.dre.linhas.map((l) => <LinhaDre key={l.id} l={l} />)}</tbody></table>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-hf-muted sm:grid-cols-3">
              <p>Lucro bruto = receita líquida − CMV. Margem bruta {pctTxt(ind.margemBrutaPct)}.</p>
              <p>Margem de contribuição = lucro bruto − taxas, entrega e promoções.</p>
              <p>Lucro líquido gerencial = resultado operacional − despesas financeiras (antes de IR e pró-labore).</p>
            </div>
          </Secao>
          <ConciliacaoIfood mes={mes} vendas={r.vendas} />
        </>
      ) : !consolidado ? (
        <Secao><p className="text-sm text-hf-muted">Carregando o DRE do restaurante…</p></Secao>
      ) : (
        <Secao titulo="Consolidado: restaurante + marmitaria" subtitulo="A coluna Unidade é o DRE gerencial do Financeiro (todas as contas, a folha inteira e o inventário geral). A marmitaria acrescenta só o que a unidade não enxerga: as vendas dela, os tributos e as taxas dessas vendas.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-hf-muted"><th className="py-2 pr-2" /><th className="py-2 pr-2 text-right">Unidade</th><th className="py-2 pr-2 text-right">+ Marmitaria</th><th className="py-2 pr-2 text-right">Consolidado</th></tr></thead>
              <tbody className="divide-y divide-hf-border">
                {consolidado.c.linhas.map((l) => (
                  <tr key={l.id} className={l.tipo !== "linha" ? "bg-hf-elevated/50 font-bold" : ""}>
                    <td className="py-2 pl-2 pr-2">{l.rotulo}{l.nota && <p className="text-[11px] font-normal text-hf-muted">{l.nota}</p>}</td>
                    {["unidade", "marmitaria", "consolidado"].map((k) => <td key={k} className={`py-2 pr-2 text-right tabular-nums ${l[k] < 0 ? "text-hf-danger" : ""}`}>{l[k] === null ? <span className="text-xs font-normal text-hf-muted">Sem dados</span> : brl(l[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Aviso className="mt-3">Para não contar duas vezes: as vendas da marmitaria são lançadas em Marmitaria → Financeiro → Vendas e <b>não</b> no faturamento diário do restaurante.</Aviso>
          {consolidado.unidade.alertas.slice(0, 4).map((a) => <Aviso key={a} tipo="alerta" className="mt-2">Unidade: {a}</Aviso>)}
        </Secao>
      )}
    </div>
  );
}
