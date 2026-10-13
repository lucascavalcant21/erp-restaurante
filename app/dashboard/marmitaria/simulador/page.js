"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  BarChart3,
  Calculator,
  Save,
  TrendingUp,
  Target,
  DollarSign,
  PieChart,
  ShoppingBag,
  Sparkles,
  Info,
  CheckCircle2,
  Bookmark,
  Layers,
  ArrowRight,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import {
  fetchMarmitas,
  fetchConfiguracoesMarmitaria,
  fetchRhAlocacoes,
  salvarSimulacao,
  fetchSimulacoes,,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";
import {
  simularOperacaoMarmitaria,
  compararCenariosEscala,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaSimuladorPage() {
  const { unidadeAtiva, unidades } = useERP();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [marmitas, setMarmitas] = useState([]);
  const [config, setConfig] = useState(null);
  const [alocacoesRh, setAlocacoesRh] = useState([]);
  const [simulacoesSalvas, setSimulacoesSalvas] = useState([]);

  // Configuração da simulação
  const [metaDiariaTotal, setMetaDiariaTotal] = useState(100);
  const [diasOperacaoMes, setDiasOperacaoMes] = useState(26);
  const [metaLucroMes, setMetaLucroMes] = useState(15000);

  // Mix de marmitas: [{ id, nome, precoVenda, custoAlimentos, custoEmbalagens, quantidadeDia, taxaCanalPct, taxaPagtoPct, tributosPct }]
  const [mixMarmitas, setMixMarmitas] = useState([]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = resolverUnidade(unidadeAtiva, unidades);
        const [resMarmitas, resConfig, resRh, resSims] = await Promise.all([
          fetchMarmitas(uId),
          fetchConfiguracoesMarmitaria(uId),
          fetchRhAlocacoes(uId),
          fetchSimulacoes(uId),
        ]);

        const lista = resMarmitas.data || [];
        setMarmitas(lista);
        setConfig(resConfig.data || {});
        setAlocacoesRh(resRh.data || []);
        setSimulacoesSalvas(resSims.data || []);

        // Mix padrão inicial: distribui 100 marmitas entre as disponíveis
        if (lista.length > 0) {
          const parcelas = [30, 40, 20, 10]; // Exemplo clássico da especificação
          const mix = lista.slice(0, 4).map((m, idx) => ({
            id: m.id,
            nome: m.nome_receita,
            precoVenda: Number(m.preco_venda) || (22 + idx * 4),
            custoAlimentos: Number(m.custo_total * 0.7) || (5.5 + idx * 1.2),
            custoEmbalagens: Number(m.custo_total * 0.3) || 2.5,
            quantidadeDia: parcelas[idx] || 15,
            taxaCanalPct: 12.0, // Média ponderada iFood + WhatsApp
            taxaPagtoPct: 1.5,
            tributosPct: 6.0,
          }));
          setMixMarmitas(mix);
        } else {
          // Mix de demonstração se não houver marmitas cadastradas ainda
          setMixMarmitas([
            { id: "1", nome: "Marmita Tradicional", precoVenda: 22.0, custoAlimentos: 5.5, custoEmbalagens: 2.5, quantidadeDia: 30, taxaCanalPct: 10, taxaPagtoPct: 1.5, tributosPct: 6 },
            { id: "2", nome: "Marmita Executiva", precoVenda: 28.0, custoAlimentos: 7.0, custoEmbalagens: 2.5, quantidadeDia: 40, taxaCanalPct: 12, taxaPagtoPct: 1.5, tributosPct: 6 },
            { id: "3", nome: "Marmita Premium", precoVenda: 34.0, custoAlimentos: 9.5, custoEmbalagens: 2.8, quantidadeDia: 20, taxaCanalPct: 15, taxaPagtoPct: 1.5, tributosPct: 6 },
            { id: "4", nome: "Marmita Fitness", precoVenda: 26.0, custoAlimentos: 6.8, custoEmbalagens: 2.5, quantidadeDia: 10, taxaCanalPct: 8, taxaPagtoPct: 1.5, tributosPct: 6 },
          ]);
        }
      } catch (e) {
        console.error("Erro ao carregar simulador:", e);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva, unidades]);

  // CMO e custos fixos alocados
  const cmoAlocadoMes = useMemo(() => {
    if (alocacoesRh.length > 0) {
      return alocacoesRh.reduce(
        (t, a) => t + (Number(a.colaboradores?.salario_base || 1800) * (Number(a.percentual_tempo || 100) / 100)),
        0
      );
    }
    return 4800; // 2 funcionários alocados na marmitaria
  }, [alocacoesRh]);

  const custosFixosAlocadosMes = useMemo(() => {
    return 2200; // Rateio auditável de energia, gás, aluguel da cozinha
  }, []);

  // Executa o cálculo da simulação
  const resultadoSimulacao = useMemo(() => {
    return simularOperacaoMarmitaria({
      marmitas: mixMarmitas,
      diasOperacaoMes,
      cmoAlocadoMes,
      custosFixosAlocadosMes,
      metaLucroMes,
    });
  }, [mixMarmitas, diasOperacaoMes, cmoAlocadoMes, custosFixosAlocadosMes, metaLucroMes]);

  // Comparativo de escalas (20, 30, 50, 100, 150, 200 marmitas/dia)
  const cenariosEscala = useMemo(() => {
    return compararCenariosEscala({
      marmitas: mixMarmitas,
      diasOperacaoMes,
      cmoAlocadoMes,
      custosFixosAlocadosMes,
    });
  }, [mixMarmitas, diasOperacaoMes, cmoAlocadoMes, custosFixosAlocadosMes]);

  // Altera a escala proporcional com um clique
  const ajustarMetaDiariaTotal = (novaMeta) => {
    setMetaDiariaTotal(novaMeta);
    const somaAtual = mixMarmitas.reduce((t, m) => t + Number(m.quantidadeDia || 0), 0) || 1;
    setMixMarmitas((prev) =>
      prev.map((m) => {
        const proporcao = Number(m.quantidadeDia || 0) / somaAtual;
        return {
          ...m,
          quantidadeDia: Math.max(1, Math.round(novaMeta * proporcao)),
        };
      })
    );
  };

  const handleSalvarSimulacao = async () => {
    const nome = prompt("Nome da simulação:", `Cenário ${resultadoSimulacao.quantidadeDiaria} marmitas/dia`);
    if (!nome) return;

    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const res = await salvarSimulacao(uId, {
        nome,
        descricao: `Mix com ${mixMarmitas.length} marmitas para ${diasOperacaoMes} dias/mês`,
        cenario_meta_diaria: resultadoSimulacao.quantidadeDiaria,
        dias_operacao_mes: diasOperacaoMes,
        itens: mixMarmitas,
        resultado_consolidado: resultadoSimulacao,
      });

      if (res.error) alert("Erro ao salvar simulação: " + res.error);
      else {
        alert("Simulação salva com sucesso!");
        const novas = await fetchSimulacoes(uId);
        setSimulacoesSalvas(novas.data || []);
      }
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo do Simulador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Target size={14} /> Simulador Interativo de Metas
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Simulador de Vendas & Ponto de Equilíbrio
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Projete faturamento, CMV, CMO, custos fixos e breakeven para qualquer meta diária sem gerar movimentações reais.
          </p>
        </div>

        <button
          onClick={handleSalvarSimulacao}
          disabled={salvando}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Save size={16} /> Salvar Cenário
        </button>
      </div>

      {/* Botões Rápidos de Cenários de Escala (20, 30, 50, 100, 150, 200 marmitas/dia) */}
      <div className="bg-hf-surface p-5 rounded-3xl border border-hf-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Cenários Rápidos de Venda Diária:
          </span>
          <span className="text-xs text-slate-400 font-semibold">
            Atualmente simulando: <strong className="text-slate-800">{resultadoSimulacao.quantidadeDiaria} marmitas/dia</strong>
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[20, 30, 50, 100, 150, 200].map((escala) => (
            <button
              key={escala}
              onClick={() => ajustarMetaDiariaTotal(escala)}
              className={`py-3 px-2 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border ${
                resultadoSimulacao.quantidadeDiaria === escala
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 scale-105"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
              }`}
            >
              <span className="text-sm">{escala}</span>
              <span className="text-[10px] font-bold opacity-80 uppercase">marmitas/dia</span>
            </button>
          ))}
        </div>
      </div>

      {/* Resultados Consolidados da Projeção */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Faturamento Mensal
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {fmtBRL(resultadoSimulacao.faturamentoMensal)}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            {resultadoSimulacao.quantidadeMensal.toLocaleString("pt-BR")} marmitas no mês
          </span>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            CMV Total (Alimentos + Emb)
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {fmtBRL(resultadoSimulacao.cmvTotalMensal)}
          </div>
          <span className="text-xs text-amber-600 font-bold mt-1 block">
            {resultadoSimulacao.cmvPct.toFixed(1)}% do faturamento
          </span>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Margem de Contribuição
          </span>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            {fmtBRL(resultadoSimulacao.margemContribuicaoMensal)}
          </div>
          <span className="text-xs text-emerald-600 font-bold mt-1 block">
            {resultadoSimulacao.margemContribuicaoPct.toFixed(1)}% do faturamento
          </span>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Lucro Operacional Estimado
          </span>
          <div className={`text-2xl font-black tracking-tight ${resultadoSimulacao.resultadoOperacionalMensal < 0 ? "text-red-600" : "text-emerald-700"}`}>
            {fmtBRL(resultadoSimulacao.resultadoOperacionalMensal)}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            Margem Líquida: {resultadoSimulacao.margemLiquidaPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Ponto de Equilíbrio & Metas de Lucro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Ponto de Equilíbrio (Breakeven)</h3>
              <p className="text-xs text-slate-500">Volume exato para cobrir CMV, CMO e custos fixos.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-center">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Por Dia</span>
              <strong className="text-lg font-black text-blue-950">
                {resultadoSimulacao.pontoEquilibrioQtdDia} un
              </strong>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase">No Mês</span>
              <strong className="text-lg font-black text-blue-950">
                {resultadoSimulacao.pontoEquilibrioQtdMes} un
              </strong>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Faturamento Mín</span>
              <strong className="text-lg font-black text-blue-950">
                {fmtBRL(resultadoSimulacao.pontoEquilibrioFaturamentoMes)}
              </strong>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex items-center justify-between">
              <span>CMO alocado da equipe:</span>
              <strong className="text-slate-800">{fmtBRL(cmoAlocadoMes)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Custos fixos de cozinha rateados:</span>
              <strong className="text-slate-800">{fmtBRL(custosFixosAlocadosMes)}</strong>
            </div>
          </div>
        </div>

        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Target size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Meta de Lucro Líquido</h3>
                <p className="text-xs text-slate-500">Quanto preciso vender para sobrar esse valor?</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">R$</span>
              <input
                type="number"
                step="1000"
                value={metaLucroMes}
                onChange={(e) => setMetaLucroMes(Number(e.target.value))}
                className="w-28 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-center">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 block uppercase">Marmitas Necessárias/Dia</span>
              <strong className="text-xl font-black text-emerald-950">
                {resultadoSimulacao.qtdParaMetaLucroDia} marmitas/dia
              </strong>
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-800 block uppercase">Marmitas no Mês</span>
              <strong className="text-xl font-black text-emerald-950">
                {resultadoSimulacao.qtdParaMetaLucroMes} un
              </strong>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Com seu mix atual de produtos e margem de contribuição média de{" "}
            <strong className="text-slate-800">{fmtBRL(resultadoSimulacao.ticketMedio * (resultadoSimulacao.margemContribuicaoPct / 100))}</strong> por marmita.
          </p>
        </div>
      </div>

      {/* Tabela de Mix Detalhado por Marmita */}
      <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Layers size={18} className="text-emerald-600" />
          Composição do Mix de Vendas Diárias
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Marmita</th>
                <th className="py-2.5 px-3">Preço Venda</th>
                <th className="py-2.5 px-3">Custo Alim.</th>
                <th className="py-2.5 px-3">Custo Emb.</th>
                <th className="py-2.5 px-3">Qtd/Dia</th>
                <th className="py-2.5 px-3">Faturamento/Mês</th>
                <th className="py-2.5 px-3">CMV/Mês</th>
                <th className="py-2.5 px-3">Margem Contrib.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultadoSimulacao.itensDetalhados.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50 font-medium">
                  <td className="py-3 px-3 font-bold text-slate-900">{item.nome}</td>
                  <td className="py-3 px-3 font-semibold text-slate-800">{fmtBRL(item.precoVenda)}</td>
                  <td className="py-3 px-3 text-slate-600">{fmtBRL(item.custoAlimentos)}</td>
                  <td className="py-3 px-3 text-slate-600">{fmtBRL(item.custoEmbalagens)}</td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min="0"
                      value={item.quantidadeDia}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMixMarmitas((prev) => {
                          const clone = [...prev];
                          clone[idx].quantidadeDia = val;
                          return clone;
                        });
                      }}
                      className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                    />
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">{fmtBRL(item.faturamentoMes)}</td>
                  <td className="py-3 px-3 text-amber-700 font-bold">{fmtBRL(item.custoTecnicoMes)}</td>
                  <td className="py-3 px-3 text-emerald-700 font-bold">
                    {fmtBRL(item.margemContribuicaoMes)} ({item.margemContribuicaoPct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela Comparativa de Escala (20 a 200 marmitas/dia) */}
      <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-600" />
          Comparativo de Cenários de Escala (20 a 200/dia)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Cenário</th>
                <th className="py-2.5 px-3">Faturamento Mensal</th>
                <th className="py-2.5 px-3">CMV Total</th>
                <th className="py-2.5 px-3">Margem Contribuição</th>
                <th className="py-2.5 px-3">Resultado Operacional</th>
                <th className="py-2.5 px-3">Status Breakeven</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cenariosEscala.map((c) => (
                <tr key={c.cenarioMarmitasDia} className="hover:bg-slate-50 font-medium">
                  <td className="py-3 px-3 font-black text-slate-900">
                    {c.cenarioMarmitasDia} marmitas/dia
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800">{fmtBRL(c.faturamentoMes)}</td>
                  <td className="py-3 px-3 text-amber-700">{fmtBRL(c.cmvTotalMes)} ({c.cmvPct.toFixed(1)}%)</td>
                  <td className="py-3 px-3 text-emerald-700 font-bold">{fmtBRL(c.margemContribuicaoMes)}</td>
                  <td className="py-3 px-3 font-black">
                    <span className={c.resultadoOperacionalMes < 0 ? "text-red-600" : "text-emerald-700"}>
                      {fmtBRL(c.resultadoOperacionalMes)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {c.atingeEquilibrio ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                        Lucrativo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold">
                        Abaixo do Breakeven
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
