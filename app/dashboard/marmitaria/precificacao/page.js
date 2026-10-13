"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  Calculator,
  Save,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Percent,
  Sliders,
  ShieldAlert,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import {
  fetchMarmitas,
  fetchConfiguracoesMarmitaria,
  fetchPrecificacaoCanais,
  salvarPrecificacaoCanal,,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";
import {
  calcularPrecificacaoCanal,
  CANAIS_VENDA,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaPrecificacaoPage() {
  const searchParams = useSearchParams();
  const { unidadeAtiva, unidades } = useERP();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [marmitas, setMarmitas] = useState([]);
  const [marmitaSelecionadaId, setMarmitaSelecionadaId] = useState("");
  const [config, setConfig] = useState(null);

  // Precificação dos canais para a marmita selecionada
  // canalId -> { precoVenda, taxaCanalPct, taxaPagtoPct, tributosPct, subsidioEntrega, promocaoDesconto, margemMetaPct, aprovado }
  const [precosCanais, setPrecosCanais] = useState({});

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = resolverUnidade(unidadeAtiva, unidades);
        const [resMarmitas, resConfig] = await Promise.all([
          fetchMarmitas(uId),
          fetchConfiguracoesMarmitaria(uId),
        ]);

        const lista = resMarmitas.data || [];
        setMarmitas(lista);
        setConfig(resConfig.data || {});

        const paramId = searchParams.get("marmita");
        const inicialId = paramId && lista.some((m) => m.id === paramId) ? paramId : lista[0]?.id || "";
        setMarmitaSelecionadaId(inicialId);
      } catch (e) {
        console.error("Erro ao carregar precificação:", e);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva, unidades]);

  // Carregar dados dos canais ao mudar de marmita
  useEffect(() => {
    async function carregarCanais() {
      if (!marmitaSelecionadaId) return;
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const res = await fetchPrecificacaoCanais(uId, marmitaSelecionadaId);
      const salvos = res.data || [];

      const marmita = marmitas.find((m) => m.id === marmitaSelecionadaId);
      const precoBase = Number(marmita?.preco_venda) || 25.0;

      const inicial = {};
      CANAIS_VENDA.forEach((c) => {
        const achado = salvos.find((s) => s.canal === c.id);
        const taxaCanal = achado ? Number(achado.taxa_canal_pct) : c.taxaPadraoPct;
        const taxaPagto = achado ? Number(achado.taxa_pagamento_pct) : (config?.taxa_cartao_padrao_pct || c.taxaPagtoPadraoPct);
        const tributos = achado ? Number(achado.tributos_pct) : (config?.impostos_padrao_pct || 6.0);
        const margemMeta = achado ? Number(achado.margem_meta_pct) : (config?.margem_lucro_alvo_pct || 22.0);

        // Preço inicial por canal (ex: iFood costuma ter markup para absorver a comissão)
        let precoCanal = achado ? Number(achado.preco_venda) : precoBase;
        if (!achado && c.id === "ifood") {
          precoCanal = Math.round(precoBase * 1.18); // +18% sugerido no iFood
        }

        inicial[c.id] = {
          canal: c.id,
          precoVenda: precoCanal,
          taxaCanalPct: taxaCanal,
          taxaPagamentoPct: taxaPagto,
          tributosPct: tributos,
          subsidioEntrega: achado ? Number(achado.subsidio_entrega) : 0,
          promocaoDesconto: achado ? Number(achado.promocao_desconto) : 0,
          margemMetaPct: margemMeta,
          aprovado: achado ? achado.aprovado : true,
        };
      });

      setPrecosCanais(inicial);
    }
    carregarCanais();
  }, [marmitaSelecionadaId, marmitas, config]);

  const marmitaAtiva = useMemo(() => {
    return marmitas.find((m) => m.id === marmitaSelecionadaId);
  }, [marmitas, marmitaSelecionadaId]);

  const custoTecnico = Number(marmitaAtiva?.custo_total) || 8.85;
  const custoAlimentos = marmitaAtiva
    ? (marmitaAtiva.fichas_ingredientes || []).reduce((t, i) => t + (Number(i.quantidade * (i.custo_unitario || 0)) || 0), 0) || 6.1
    : 6.1;
  const custoEmbalagens = marmitaAtiva
    ? (marmitaAtiva.embalagens || []).reduce((t, e) => t + (Number(e.quantidade * (e.custo_unitario || 0)) || 0), 0) || 2.75
    : 2.75;

  const handleSalvarCanal = async (canalId) => {
    const dados = precosCanais[canalId];
    if (!dados || !marmitaSelecionadaId) return;

    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const calc = calcularPrecificacaoCanal({
        custoTecnicoTotal: custoTecnico,
        custoAlimentos,
        custoEmbalagens,
        precoVenda: dados.precoVenda,
        taxaCanalPct: dados.taxaCanalPct,
        taxaPagamentoPct: dados.taxaPagamentoPct,
        tributosPct: dados.tributosPct,
        subsidioEntrega: dados.subsidioEntrega,
        promocaoDesconto: dados.promocaoDesconto,
        margemMetaPct: dados.margemMetaPct,
      });

      const res = await salvarPrecificacaoCanal(uId, {
        ficha_id: marmitaSelecionadaId,
        canal: canalId,
        preco_venda: dados.precoVenda,
        taxa_canal_pct: dados.taxaCanalPct,
        taxa_pagamento_pct: dados.taxaPagamentoPct,
        subsidio_entrega: dados.subsidioEntrega,
        promocao_desconto: dados.promocaoDesconto,
        tributos_pct: dados.tributosPct,
        margem_meta_pct: dados.margemMetaPct,
        preco_sugerido: calc.precoSugerido,
        aprovado: dados.aprovado,
      });

      if (res.error) alert("Erro ao salvar canal: " + res.error);
      else alert(`Preço para ${canalId.toUpperCase()} salvo com sucesso!`);
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo da página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Calculator size={14} /> Formação de Preços Inteligente
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Precificação Multicanal de Marmitas
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Cálculo com taxas reais do iFood, adquirentes e tributos. Bloqueio contra preços abaixo da margem sem aprovação.
          </p>
        </div>

        {/* Seletor de Marmita */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-600 shrink-0">Marmita:</label>
          <select
            value={marmitaSelecionadaId}
            onChange={(e) => setMarmitaSelecionadaId(e.target.value)}
            className="w-full md:w-72 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {marmitas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome_receita} ({m.tamanho || "M"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cartão de Raio-X do Custo Técnico da Marmita Selecionada */}
      <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Ficha Técnica Ativa
            </span>
            <h2 className="text-lg font-black text-slate-900">
              {marmitaAtiva?.nome_receita || "Marmita"}
            </h2>
            <span className="text-xs text-slate-500">
              Tamanho: <strong>{marmitaAtiva?.tamanho || "M"}</strong> ({marmitaAtiva?.peso_final_g || 550}g)
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">Alimentos</span>
              <span className="text-sm font-black text-slate-800">{fmtBRL(custoAlimentos)}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">Embalagens</span>
              <span className="text-sm font-black text-slate-800">{fmtBRL(custoEmbalagens)}</span>
            </div>
            <div className="text-right bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 block">
                Custo Técnico Total
              </span>
              <span className="text-xl font-black text-emerald-950">{fmtBRL(custoTecnico)}</span>
            </div>
          </div>
        </div>

        {/* Informação sobre não alterar preço público sem aprovação */}
        <div className="mt-4 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center gap-3 text-xs text-blue-900">
          <ShieldAlert size={16} className="text-blue-600 shrink-0" />
          <span>
            <strong>Governança de Preço:</strong> Alterações nos custos de insumos recalculam a ficha e acusam margens baixas, mas <strong>nunca alteram o preço de venda no iFood/PDV</strong> sem que você aprove e salve explicitamente.
          </span>
        </div>
      </div>

      {/* Grade de Canais de Venda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CANAIS_VENDA.map((canal) => {
          const dados = precosCanais[canal.id] || {
            precoVenda: 25.0,
            taxaCanalPct: canal.taxaPadraoPct,
            taxaPagamentoPct: 2.0,
            tributosPct: 6.0,
            subsidioEntrega: 0,
            promocaoDesconto: 0,
            margemMetaPct: 22.0,
            aprovado: true,
          };

          const calc = calcularPrecificacaoCanal({
            custoTecnicoTotal: custoTecnico,
            custoAlimentos,
            custoEmbalagens,
            precoVenda: dados.precoVenda,
            taxaCanalPct: dados.taxaCanalPct,
            taxaPagamentoPct: dados.taxaPagamentoPct,
            tributosPct: dados.tributosPct,
            subsidioEntrega: dados.subsidioEntrega,
            promocaoDesconto: dados.promocaoDesconto,
            margemMetaPct: dados.margemMetaPct,
          });

          return (
            <div
              key={canal.id}
              className={`bg-hf-surface rounded-3xl border p-6 shadow-sm transition-all flex flex-col justify-between space-y-5 ${
                calc.margemAbaixoMeta
                  ? "border-amber-300 ring-2 ring-amber-100"
                  : "border-hf-border hover:border-emerald-500/40"
              }`}
            >
              <div>
                {/* Header do canal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: canal.cor }}
                    ></span>
                    <h3 className="text-base font-black text-slate-900">{canal.nome}</h3>
                  </div>

                  {calc.margemAbaixoMeta ? (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-xs font-black flex items-center gap-1 border border-amber-200">
                      <AlertTriangle size={13} /> Margem Abaixo da Meta
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black flex items-center gap-1 border border-emerald-200">
                      <CheckCircle2 size={13} /> Margem Saudável
                    </span>
                  )}
                </div>

                {/* Campos de Input do Canal */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Preço de Venda (R$)</label>
                    <input
                      type="number"
                      step="0.50"
                      value={dados.precoVenda}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPrecosCanais((prev) => ({
                          ...prev,
                          [canal.id]: { ...prev[canal.id], precoVenda: val },
                        }));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Taxa Canal (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={dados.taxaCanalPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPrecosCanais((prev) => ({
                          ...prev,
                          [canal.id]: { ...prev[canal.id], taxaCanalPct: val },
                        }));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Taxa Cartão/Pix (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={dados.taxaPagamentoPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPrecosCanais((prev) => ({
                          ...prev,
                          [canal.id]: { ...prev[canal.id], taxaPagamentoPct: val },
                        }));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Tributos (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={dados.tributosPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPrecosCanais((prev) => ({
                          ...prev,
                          [canal.id]: { ...prev[canal.id], tributosPct: val },
                        }));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Subsídio Entrega (R$)</label>
                    <input
                      type="number"
                      step="1.0"
                      value={dados.subsidioEntrega}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPrecosCanais((prev) => ({
                          ...prev,
                          [canal.id]: { ...prev[canal.id], subsidioEntrega: val },
                        }));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Margem Alvo (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={dados.margemMetaPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPrecosCanais((prev) => ({
                          ...prev,
                          [canal.id]: { ...prev[canal.id], margemMetaPct: val },
                        }));
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-800"
                    />
                  </div>
                </div>

                {/* Demonstração Matemática dos Resultados */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">(-) Taxa do Canal:</span>
                    <strong className="text-slate-900">{fmtBRL(calc.valTaxaCanal)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">(-) Taxa Pagamento & Tributos:</span>
                    <strong className="text-slate-900">{fmtBRL(calc.valTaxaPagamento + calc.valTributos)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">(-) Custo Técnico da Marmita:</span>
                    <strong className="text-slate-900">{fmtBRL(calc.custoTecnicoTotal)}</strong>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-bold">
                    <span className="text-slate-700">(=) Margem de Contribuição:</span>
                    <span className={`text-sm ${calc.margemContribuicaoR$ < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {fmtBRL(calc.margemContribuicaoR$)} ({calc.margemContribuicaoPct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span>CMV Técnico neste canal:</span>
                    <span className="font-bold text-slate-700">{calc.cmvPct}%</span>
                  </div>
                </div>
              </div>

              {/* Sugestão de Preço & Aprovação */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="text-slate-500 block">Preço Sugerido p/ Margem {dados.margemMetaPct}%:</span>
                  <strong className="text-sm font-black text-emerald-800">
                    {fmtBRL(calc.precoSugerido)}
                  </strong>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setPrecosCanais((prev) => ({
                        ...prev,
                        [canal.id]: { ...prev[canal.id], precoVenda: calc.precoSugerido },
                      }));
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Aplicar Sugerido
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSalvarCanal(canal.id)}
                    disabled={salvando}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Save size={13} /> Salvar Preço
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
