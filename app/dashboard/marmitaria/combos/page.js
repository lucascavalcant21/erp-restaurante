"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  Tag,
  ShoppingBag,
  Percent,
  TrendingUp,
  Star,
  Truck,
  Flame,
  Award,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  DollarSign,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import { fetchMarmitas } from "../../../lib/marmitaria/marmitaria-service";
import {
  simularComboPromocional,
  classificarEngenhariaCardapio,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaCombosPage() {
  const { unidadeAtiva } = useERP();
  const [loading, setLoading] = useState(true);
  const [marmitas, setMarmitas] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("combos"); // 'combos' ou 'engenharia'

  // Parâmetros do Simulador de Combos
  const [nomeCombo, setNomeCombo] = useState("Combo Almoço Completo");
  const [precoCombo, setPrecoCombo] = useState(34.90);
  const [cupomDesconto, setCupomDesconto] = useState(4.00);
  const [subsidioFrete, setSubsidioFrete] = useState(3.00);
  const [taxaCanalPct, setTaxaCanalPct] = useState(15.0); // iFood
  const [taxaPgtoPct, setTaxaPgtoPct] = useState(2.5);

  const [itensCombo, setItensCombo] = useState([
    { nome: "Marmita Executiva Frango Grelhado", precoAvulso: 26.00, custoTecnico: 8.50 },
    { nome: "Coca-Cola Zero 350ml", precoAvulso: 6.50, custoTecnico: 2.30 },
    { nome: "Pudim Tradicional", precoAvulso: 8.00, custoTecnico: 2.10 },
  ]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = unidadeAtiva?.id || "matriz";
        const { data } = await fetchMarmitas(uId);
        setMarmitas(data || []);
      } catch (err) {
        console.error("Erro ao carregar marmitas:", err);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva]);

  // Simulação do Combo
  const resultadoCombo = useMemo(() => {
    return simularComboPromocional({
      itensCombo,
      precoCombo,
      cupomDescontoLoja: cupomDesconto,
      subsidioFreteLoja: subsidioFrete,
      taxaCanalPct,
      taxaPagamentoPct: taxaPgtoPct,
      impostosPct: 6.0,
    });
  }, [itensCombo, precoCombo, cupomDesconto, subsidioFrete, taxaCanalPct, taxaPgtoPct]);

  // Mock de vendas históricas para a Engenharia de Cardápio
  const dadosEngenharia = useMemo(() => {
    const lista = marmitas.length > 0 ? marmitas : [
      { id: "1", nome_receita: "Marmita Executiva Frango", preco_venda: 26, custo_total: 8.85 },
      { id: "2", nome_receita: "Marmita Carne de Panela", preco_venda: 28, custo_total: 10.20 },
      { id: "3", nome_receita: "Marmita Fitness Batata Doce", preco_venda: 27, custo_total: 7.90 },
      { id: "4", nome_receita: "Marmita Econômica Ovo & Calabresa", preco_venda: 20, custo_total: 7.50 },
    ];

    const formatados = lista.map((m, idx) => {
      const preco = Number(m.preco_venda) || 26;
      const custo = Number(m.custo_total) || 8.85;
      const margem = preco - custo - (preco * 0.15); // desconta taxa canal
      const volumes = [380, 290, 140, 75]; // volumes exemplo
      return {
        id: m.id,
        nome: m.nome_receita,
        precoVenda: preco,
        custoTecnico: custo,
        volumeVendido: volumes[idx % volumes.length] || 120,
        margemContribuicaoR$: margem,
      };
    });

    return classificarEngenhariaCardapio(formatados);
  }, [marmitas]);

  const adicionarItem = () => {
    setItensCombo([...itensCombo, { nome: "Item Adicional", precoAvulso: 5.0, custoTecnico: 1.5 }]);
  };

  const removerItem = (idx) => {
    setItensCombo(itensCombo.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Tag size={16} />
            Rentabilidade Comercial & Engenharia de Cardápio
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Combos Promocionais & Matriz de Rentabilidade
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Simule combos com cupons e frete grátis sem destruir a margem, e classifique produtos em Estrelas e Burros de Carga.
          </p>
        </div>

        {/* Alternador de Ferramenta */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setAbaAtiva("combos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              abaAtiva === "combos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Tag size={15} />
            Simulador de Combos
          </button>
          <button
            onClick={() => setAbaAtiva("engenharia")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              abaAtiva === "engenharia" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Award size={15} />
            Matriz de Cardápio (BCG)
          </button>
        </div>
      </div>

      {/* ABA 1: SIMULADOR DE COMBOS */}
      {abaAtiva === "combos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 e 2: Montagem do Combo e Taxas */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Composição do Combo</h2>
                  <p className="text-xs text-slate-500">Adicione a marmita e os itens adicionais do pacote promocional.</p>
                </div>
                <button
                  onClick={adicionarItem}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <Plus size={14} />
                  Adicionar Item
                </button>
              </div>

              <div className="space-y-3">
                {itensCombo.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl border border-hf-border bg-slate-50/50 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.nome}
                        onChange={(e) => {
                          const novo = [...itensCombo];
                          novo[idx].nome = e.target.value;
                          setItensCombo(novo);
                        }}
                        className="w-full text-xs font-bold text-slate-900 bg-transparent border-none focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Preço Avulso</span>
                        <input
                          type="number"
                          step="0.5"
                          value={item.precoAvulso}
                          onChange={(e) => {
                            const novo = [...itensCombo];
                            novo[idx].precoAvulso = Number(e.target.value);
                            setItensCombo(novo);
                          }}
                          className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Custo Técnico</span>
                        <input
                          type="number"
                          step="0.5"
                          value={item.custoTecnico}
                          onChange={(e) => {
                            const novo = [...itensCombo];
                            novo[idx].custoTecnico = Number(e.target.value);
                            setItensCombo(novo);
                          }}
                          className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                        />
                      </div>
                      {itensCombo.length > 1 && (
                        <button
                          onClick={() => removerItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Preço de Venda do Combo e Campanhas */}
              <div className="pt-4 border-t border-hf-border grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Preço de Venda do Combo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={precoCombo}
                    onChange={(e) => setPrecoCombo(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-black text-slate-900 bg-white"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Avulso somaria: {fmtBRL(resultadoCombo.valorAvulsoTotal)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Cupom de Desconto da Loja (R$)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={cupomDesconto}
                    onChange={(e) => setCupomDesconto(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 bg-white"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Desconto absorvido pela marmitaria</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Subsídio de Frete Grátis (R$)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={subsidioFrete}
                    onChange={(e) => setSubsidioFrete(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 bg-white"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Entrega parceira ou motoboy</span>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 3: Raio-X Financeiro da Viabilidade */}
          <div className="space-y-4">
            <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500">Resultado do Combo</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    resultadoCombo.viavel ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {resultadoCombo.viavel ? "Combo Viável" : "Margem em Risco"}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-xs text-slate-500 block uppercase font-bold">Margem de Contribuição Líquida</span>
                <div className={`text-3xl font-black ${resultadoCombo.viavel ? "text-emerald-700" : "text-red-600"}`}>
                  {fmtBRL(resultadoCombo.margemContribuicaoR$)}
                </div>
                <span className="text-xs font-bold text-slate-700 mt-1 block">
                  {fmtPct(resultadoCombo.margemContribuicaoPct)} sobre o faturado
                </span>
              </div>

              <div className="divide-y divide-hf-border text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Preço Faturado ao Cliente:</span>
                  <span className="font-bold text-slate-900">{fmtBRL(resultadoCombo.precoFaturado)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Desconto Total Percebido:</span>
                  <span className="font-bold text-amber-600">{fmtBRL(resultadoCombo.descontoOferecidoClienteR$)} ({fmtPct(resultadoCombo.descontoOferecidoPct)})</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Custo dos Produtos (CMV):</span>
                  <span className="font-bold text-slate-900">- {fmtBRL(resultadoCombo.custoTecnicoTotal)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Taxa iFood ({taxaCanalPct}%):</span>
                  <span className="font-bold text-red-600">- {fmtBRL(resultadoCombo.valTaxaCanal)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Subsídio de Frete Loja:</span>
                  <span className="font-bold text-red-600">- {fmtBRL(resultadoCombo.subsidioFreteLoja)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Tributos (~6% Simples):</span>
                  <span className="font-bold text-slate-900">- {fmtBRL(resultadoCombo.valImpostos)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: ENGENHARIA DE CARDÁPIO (MATRIZ BCG) */}
      {abaAtiva === "engenharia" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase mb-1">
                <span>Estrelas (Stars)</span>
                <Star size={18} className="text-emerald-600 fill-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-950">{dadosEngenharia.totalEstrelas} marmitas</div>
              <p className="text-xs text-emerald-700 mt-1">Alta Margem + Alto Volume</p>
            </div>

            <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-200">
              <div className="flex items-center justify-between text-blue-800 text-xs font-bold uppercase mb-1">
                <span>Burros de Carga</span>
                <Truck size={18} className="text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-950">{dadosEngenharia.totalBurrosDeCarga} marmitas</div>
              <p className="text-xs text-blue-700 mt-1">Baixa Margem + Alto Volume</p>
            </div>

            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase mb-1">
                <span>Enigmas (Puzzles)</span>
                <HelpCircle size={18} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-950">{dadosEngenharia.totalEnigmas} marmitas</div>
              <p className="text-xs text-amber-700 mt-1">Alta Margem + Baixo Volume</p>
            </div>

            <div className="bg-slate-100 p-5 rounded-2xl border border-slate-300">
              <div className="flex items-center justify-between text-slate-700 text-xs font-bold uppercase mb-1">
                <span>Cães / Abacaxis</span>
                <AlertTriangle size={18} className="text-slate-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">{dadosEngenharia.totalCaes} marmitas</div>
              <p className="text-xs text-slate-500 mt-1">Baixa Margem + Baixo Volume</p>
            </div>
          </div>

          {/* Tabela de Produtos com Estratégia Recomendada */}
          <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-hf-border">
              <h2 className="text-base font-bold text-slate-900">Classificação & Plano Estratégico do Cardápio</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Médias do período: Volume médio: <strong>{dadosEngenharia.mediaVolume} un</strong> • Margem média: <strong>{fmtBRL(dadosEngenharia.mediaMargem)}</strong>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-hf-border">
                    <th className="py-3 px-4">Marmita</th>
                    <th className="py-3 px-4 text-center">Classificação</th>
                    <th className="py-3 px-4 text-right">Volume Vendido</th>
                    <th className="py-3 px-4 text-right">Margem Líquida</th>
                    <th className="py-3 px-4">Recomendação Estratégica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hf-border">
                  {dadosEngenharia.itens.map((p) => (
                    <tr key={p.id || p.nome} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">{p.nome}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            p.quadrante === "estrela"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.quadrante === "burro_de_carga"
                              ? "bg-blue-100 text-blue-800"
                              : p.quadrante === "enigma"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          {p.quadrante.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-800">{p.volumeVendido} un</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-700">{fmtBRL(p.margemContribuicaoR$)}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{p.recomendacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
