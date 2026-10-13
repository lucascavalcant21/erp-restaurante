"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  ShoppingCart,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  Package,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import {
  fetchMarmitas,
  fetchInsumosEstoque,
  fetchEmbalagensMarmitaria,,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";
import {
  calcularNecessidadeComprasMarmitaria,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaComprasPage() {
  const { unidadeAtiva, unidades } = useERP();

  const [loading, setLoading] = useState(true);
  const [marmitas, setMarmitas] = useState([]);
  const [insumosEstoque, setInsumosEstoque] = useState([]);
  const [metaPlanejadaMarmitas, setMetaPlanejadaMarmitas] = useState(600); // 600 marmitas conforme especificação
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [pedidoAprovado, setPedidoAprovado] = useState(false);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = resolverUnidade(unidadeAtiva, unidades);
        const [resMarmitas, resInsumos] = await Promise.all([
          fetchMarmitas(uId),
          fetchInsumosEstoque(uId),
        ]);

        setMarmitas(resMarmitas.data || []);
        setInsumosEstoque(resInsumos.data || []);
      } catch (e) {
        console.error("Erro ao carregar compras da marmitaria:", e);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva, unidades]);

  // Cálculo de necessidade de compras
  const listaCompras = useMemo(() => {
    if (marmitas.length === 0) return { itensCompra: [], custoTotalPrevisto: 0 };

    // Distribui as 600 marmitas proporcionalmente entre as cadastradas
    const plano = marmitas.map((m) => ({
      ficha: m,
      quantidadePlanejada: Math.round(metaPlanejadaMarmitas / (marmitas.length || 1)),
    }));

    // Simulação do saldo atual dos insumos
    const estoquesAtuais = insumosEstoque.map((i) => ({
      insumo_id: i.id,
      quantidade_atual: 12.0,
      quantidade_reservada: 2.0,
    }));

    return calcularNecessidadeComprasMarmitaria({
      planoVendas: plano,
      estoquesAtuais,
      fornecedoresInsumos: {},
    });
  }, [marmitas, insumosEstoque, metaPlanejadaMarmitas]);

  const itensFiltrados = useMemo(() => {
    if (categoriaFiltro === "todas") return listaCompras.itensCompra;
    return listaCompras.itensCompra.filter((i) => i.categoria === categoriaFiltro);
  }, [listaCompras, categoriaFiltro]);

  const exportarCSV = () => {
    const cabecalho = "Produto,Categoria,Qtd Necessaria,Estoque Utilizavel,Qtd Comprar,Unidade,Preco Estimado,Subtotal\n";
    const linhas = listaCompras.itensCompra
      .map(
        (i) =>
          `"${i.produto}","${i.categoria}",${i.quantidadeNecessaria},${i.estoqueDisponivel},${i.quantidadeComprar},"${i.unidade}",${i.ultimoPreco},${i.subtotal}`
      )
      .join("\n");
    const blob = new Blob([cabecalho + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compras-marmitaria-${metaPlanejadaMarmitas}-unidades.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Topo de Compras */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <ShoppingCart size={14} /> Suprimentos Baseados em Fichas Técnicas
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Lista de Compras Inteligente da Marmitaria
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Explosão automática de ingredientes, fatores de correção e embalagens para a meta planejada, sem compras duplicadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold px-4 py-2.5 rounded-2xl transition-all"
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold px-4 py-2.5 rounded-2xl transition-all"
          >
            <Printer size={16} /> Imprimir Lista
          </button>
        </div>
      </div>

      {/* Barra de Parâmetro da Meta Planejada */}
      <div className="bg-hf-surface p-5 rounded-3xl border border-hf-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            {metaPlanejadaMarmitas}
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Volume Planejado para o Período
            </h3>
            <p className="text-xs text-slate-500">
              Cálculo de suprimentos para abastecer {metaPlanejadaMarmitas} marmitas completas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[200, 400, 600, 1000].map((v) => (
            <button
              key={v}
              onClick={() => setMetaPlanejadaMarmitas(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                metaPlanejadaMarmitas === v
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {v} marmitas
            </button>
          ))}
          <input
            type="number"
            step="50"
            value={metaPlanejadaMarmitas}
            onChange={(e) => setMetaPlanejadaMarmitas(Number(e.target.value))}
            className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center"
          />
        </div>
      </div>

      {/* Resumo de Custos e Status de Aprovação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Custo Total Previsto
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {fmtBRL(listaCompras.custoTotalPrevisto)}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            Para {metaPlanejadaMarmitas} marmitas (média {fmtBRL(metaPlanejadaMarmitas > 0 ? listaCompras.custoTotalPrevisto / metaPlanejadaMarmitas : 0)}/un)
          </span>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Itens a Comprar (Com Falta)
          </span>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {listaCompras.itensComFaltaEstoque} itens
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            De {listaCompras.totalItensNecessarios} itens necessários no mix
          </span>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Fluxo de Aprovação
          </span>
          <div>
            {pedidoAprovado ? (
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <CheckCircle2 size={18} /> Pedido de Compra Aprovado
              </div>
            ) : (
              <button
                onClick={() => setPedidoAprovado(true)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Aprovar Pedido de Compras
              </button>
            )}
            <span className="text-[10px] text-slate-400 block mt-1">
              O estoque só é movimentado no recebimento físico das notas.
            </span>
          </div>
        </div>
      </div>

      {/* Tabela de Compras com Colunas Específicas da Fase 8 */}
      <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm p-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
              <th className="py-3 px-3">Produto</th>
              <th className="py-3 px-3">Categoria</th>
              <th className="py-3 px-3 text-right">Qtd Necessária</th>
              <th className="py-3 px-3 text-right">Estoque Utilizável</th>
              <th className="py-3 px-3 text-right">Qtd a Comprar</th>
              <th className="py-3 px-3">Unidade</th>
              <th className="py-3 px-3">Fornecedor</th>
              <th className="py-3 px-3 text-right">Último Preço</th>
              <th className="py-3 px-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itensFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">
                  Nenhum item calculado para a meta selecionada.
                </td>
              </tr>
            ) : (
              itensFiltrados.map((item, idx) => (
                <tr key={item.insumoId || idx} className="hover:bg-slate-50 font-medium">
                  <td className="py-3 px-3 font-bold text-slate-900">{item.produto}</td>
                  <td className="py-3 px-3 text-slate-500">{item.categoria}</td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-700">
                    {item.quantidadeNecessaria}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500">
                    {item.estoqueDisponivel}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-amber-700">
                    {item.quantidadeComprar}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{item.unidade}</td>
                  <td className="py-3 px-3 text-slate-700 font-semibold">{item.fornecedor}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{fmtBRL(item.ultimoPreco)}</td>
                  <td className="py-3 px-3 text-right font-black text-slate-900">{fmtBRL(item.subtotal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
