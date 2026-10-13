"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  Sparkles,
  Calendar,
  TrendingUp,
  Boxes,
  Users,
  ChefHat,
  Clock,
  Printer,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShoppingCart,
  DollarSign,
  PieChart,
  Info,
  Layers,
  Percent,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import {
  fetchMarmitas,
  fetchInsumosEstoque,
  fetchEmbalagensMarmitaria,
  fetchRhAlocacoes,
  salvarPlanoOperacional,
} from "../../../lib/marmitaria/marmitaria-service";
import { gerarPlanoOperacionalCompleto } from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaPlanejamentoPage() {
  const { unidadeAtiva } = useERP();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  // Parâmetros do Planejamento
  const [periodo, setPeriodo] = useState("amanha"); // 'amanha', 'semana', 'personalizado'
  const [dataPlanejada, setDataPlanejada] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [metaMarmitas, setMetaMarmitas] = useState(120);
  const [horasOperacaoDia, setHorasOperacaoDia] = useState(6);

  // Dados carregados do ERP
  const [marmitas, setMarmitas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [embalagens, setEmbalagens] = useState([]);
  const [alocacoesRh, setAlocacoesRh] = useState([]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = unidadeAtiva?.id || "matriz";
        const [resMarmitas, resIns, resEmb, resRh] = await Promise.all([
          fetchMarmitas(uId),
          fetchInsumosEstoque(uId),
          fetchEmbalagensMarmitaria(uId),
          fetchRhAlocacoes(uId),
        ]);

        setMarmitas(resMarmitas.data || []);
        setInsumos(resIns.data || []);
        setEmbalagens(resEmb.data || []);
        setAlocacoesRh(resRh.data || []);
      } catch (err) {
        console.error("Erro ao carregar dados do planejamento:", err);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva]);

  // Montagem do Mix de Produtos baseado nas marmitas cadastradas
  const mixProdutos = useMemo(() => {
    if (marmitas.length === 0) {
      return [
        { id: "1", nome: "Marmita Executiva Frango Grelhado", precoVenda: 26.0, custoAlimentos: 6.8, custoEmbalagens: 2.05, pctMix: 40, tempoPreparoMin: 1.8 },
        { id: "2", nome: "Marmita Tradicional Carne de Panela", precoVenda: 28.0, custoAlimentos: 8.2, custoEmbalagens: 2.05, pctMix: 35, tempoPreparoMin: 2.0 },
        { id: "3", nome: "Marmita Fitness Frango c/ Batata Doce", precoVenda: 27.0, custoAlimentos: 7.0, custoEmbalagens: 2.05, pctMix: 25, tempoPreparoMin: 1.5 },
      ];
    }
    return marmitas.map((m, idx) => ({
      id: m.id,
      nome: m.nome_receita,
      precoVenda: Number(m.preco_venda) || 26.0,
      custoAlimentos: (Number(m.custo_total) || 8.85) * 0.75,
      custoEmbalagens: (Number(m.custo_total) || 8.85) * 0.25,
      pctMix: Math.round(100 / marmitas.length),
      tempoPreparoMin: (Number(m.tempo_preparo_min) || 20) / 10,
    }));
  }, [marmitas]);

  // Execução do cálculo de planejamento 360º
  const plano = useMemo(() => {
    return gerarPlanoOperacionalCompleto({
      metaMarmitas,
      mixProdutos,
      colaboradoresAlocados: alocacoesRh,
      horasOperacaoDia,
    });
  }, [metaMarmitas, mixProdutos, alocacoesRh, horasOperacaoDia]);

  // Salvar plano no Supabase
  const handleSalvarPlano = async () => {
    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const payload = {
        data_planejada: dataPlanejada,
        periodo_tipo: periodo,
        meta_total_marmitas: plano.metaTotal,
        faturamento_previsto: plano.faturamentoPrevisto,
        cmv_previsto: plano.cmvPrevistoTotal,
        margem_prevista: plano.margemContribuicaoPrevista,
        pessoas_necessarias: plano.pessoasNecessarias,
        status: "aprovado",
        dados_completos: plano,
      };

      const { error } = await salvarPlanoOperacional(uId, payload);
      if (error) {
        alert("Erro ao salvar plano: " + error);
      } else {
        setMensagemSucesso("Plano Operacional aprovado e salvo com sucesso!");
        setTimeout(() => setMensagemSucesso(""), 4000);
      }
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Sparkles size={16} />
            Central de Inteligência Operacional 360º
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Planejamento Diário de Marmitas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Transforme metas de vendas em planos reais de insumos, embalagens, equipe e capacidade produtiva da cozinha.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImprimir}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Printer size={15} />
            Imprimir Plano
          </button>

          <button
            onClick={handleSalvarPlano}
            disabled={salvando}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
          >
            <Save size={16} />
            {salvando ? "Salvando..." : "Aprovar & Salvar Plano"}
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          {mensagemSucesso}
        </div>
      )}

      {/* Barra de Parâmetros da Meta */}
      <div className="bg-hf-surface p-5 rounded-3xl border border-hf-border shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Período Planejado
          </label>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                setPeriodo("amanha");
                const d = new Date();
                d.setDate(d.getDate() + 1);
                setDataPlanejada(d.toISOString().slice(0, 10));
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                periodo === "amanha" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              Amanhã
            </button>
            <button
              onClick={() => setPeriodo("semana")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                periodo === "semana" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              Semana
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Data de Execução
          </label>
          <input
            type="date"
            value={dataPlanejada}
            onChange={(e) => setDataPlanejada(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Meta de Vendas (Marmitas)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="10"
              max="1000"
              value={metaMarmitas}
              onChange={(e) => setMetaMarmitas(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-sm font-black text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Janela de Preparo da Cozinha
          </label>
          <select
            value={horasOperacaoDia}
            onChange={(e) => setHorasOperacaoDia(Number(e.target.value))}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
          >
            <option value="4">4 Horas (Turno Enxuto)</option>
            <option value="6">6 Horas (Turno Padrão)</option>
            <option value="8">8 Horas (Turno Integral)</option>
          </select>
        </div>
      </div>

      {/* Cards de KPIs do Plano Gerado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Faturamento Previsto</span>
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {fmtBRL(plano.faturamentoPrevisto)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {plano.metaTotal} marmitas no ticket médio
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>CMV Previsto (Alimentos+Emb)</span>
            <Boxes size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {fmtBRL(plano.cmvPrevistoTotal)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {fmtPct(plano.pctCmvPrevisto)} da receita prevista
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Equipe Necessária</span>
            <Users size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {plano.pessoasNecessarias} pessoas ({plano.horasTotaisNecessarias}h)
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {plano.pessoasDisponiveis} colaboradores na escala atual
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Lucro Operacional Líquido</span>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {fmtBRL(plano.lucroOperacionalPrevisto)}
          </div>
          <p className="text-xs font-bold text-emerald-600 mt-1">
            Margem Líquida: {fmtPct((plano.lucroOperacionalPrevisto / plano.faturamentoPrevisto) * 100)}
          </p>
        </div>
      </div>

      {/* Alerta de Capacidade e Gargalo */}
      {plano.haSobrecarga ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Atenção ao Gargalo de Cozinha:</span> A meta de {plano.metaTotal} marmitas exige {plano.tempoTotalPreparoMin} minutos de montagem e cocção, o que excede a janela operacional de {plano.minutosDisponiveisCozinha} minutos ({plano.percentualOcupacaoCapacidade}% de ocupação). Recomendamos ampliar a janela para 8h ou convocar 1 auxiliar extra de montagem.
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold">Capacidade Operacional Balanceada:</span> A cozinha ocupará {plano.percentualOcupacaoCapacidade}% da sua capacidade no turno de {horasOperacaoDia}h, garantindo expedição sem atrasos no delivery.
          </div>
        </div>
      )}

      {/* Grade com Mix de Marmitas e Recursos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição do Mix de Marmitas */}
        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ChefHat size={18} className="text-emerald-600" />
            Meta por Produto (Mix de Marmitas)
          </h2>

          <div className="divide-y divide-hf-border">
            {plano.distribuicaoProdutos.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{item.nome}</div>
                  <div className="text-xs text-slate-500">
                    {item.pctMix}% do mix • Custo técnico: {fmtBRL(item.custoAlimentos + item.custoEmbalagens)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-900 text-sm">
                    {item.quantidadePlanejada} un
                  </div>
                  <div className="text-xs text-emerald-700 font-bold">
                    {fmtBRL(item.faturamentoPrevisto)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recursos Necessários (Alimentos, Embalagens e CMO) */}
        <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            Recursos Operacionais Mobilizados
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900">Insumos & Proteínas (Cozinha)</div>
                <div className="text-slate-500">Carnes, frango, arroz, feijão, legumes</div>
              </div>
              <div className="text-right">
                <div className="font-black text-slate-900">{fmtBRL(plano.custoAlimentosPrevisto)}</div>
                <div className="text-[11px] text-slate-500 font-semibold">Baixa antecipada</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900">Embalagens & Descartáveis</div>
                <div className="text-slate-500">{plano.metaTotal} potes, tampas, selos e sacolas</div>
              </div>
              <div className="text-right">
                <div className="font-black text-slate-900">{fmtBRL(plano.custoEmbalagensPrevisto)}</div>
                <div className="text-[11px] text-slate-500 font-semibold">Baixa na expedição</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900">Mão de Obra Alocada (CMO Dia)</div>
                <div className="text-slate-500">{plano.pessoasNecessarias} pessoas dedicadas ao turno</div>
              </div>
              <div className="text-right">
                <div className="font-black text-slate-900">{fmtBRL(plano.cmoDiarioEstimado)}</div>
                <div className="text-[11px] text-slate-500 font-semibold">{fmtBRL(plano.cmoDiarioEstimado / plano.metaTotal)} / marmita</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
