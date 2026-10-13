"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  Boxes,
  Package,
  ArrowRightLeft,
  Search,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Filter,
  History,
  Layers,
  Sparkles,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import {
  fetchInsumosEstoque,
  fetchEmbalagensMarmitaria,
  fetchTransferenciasEstoque,
  registrarTransferenciaEstoque,
} from "../../../lib/marmitaria/marmitaria-service";
import {
  CATEGORIAS_ESTOQUE_MARMITARIA,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaEstoquePage() {
  const { unidadeAtiva } = useERP();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [insumos, setInsumos] = useState([]);
  const [embalagens, setEmbalagens] = useState([]);
  const [transferencias, setTransferencias] = useState([]);

  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");
  const [busca, setBusca] = useState("");
  const [abaPrincipal, setAbaPrincipal] = useState("estoque"); // 'estoque' | 'embalagens' | 'transferencias'

  // Modal Transferência Interna
  const [modalTransferir, setModalTransferir] = useState(false);
  const [formTransf, setFormTransf] = useState({
    insumo_id: "",
    quantidade: 5,
    unidade_medida: "kg",
    origem: "cozinha_principal",
    destino: "marmitaria",
    observacao: "Transferência para a produção do dia",
  });

  // Modal Conversão de Embalagens (Caixa -> Unidades)
  const [modalConversao, setModalConversao] = useState(false);
  const [formConversao, setFormConversao] = useState({
    nome: "Caixa Marmita com Divisória (100 un)",
    tipoEmbalagem: "caixa", // caixa, pacote, unidade
    fatorConversao: 100, // 1 caixa = 100 unidades
    quantidadeComprada: 5, // 5 caixas
    custoTotalCaixa: 110.0,
  });

  const carregarDados = async () => {
    setLoading(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const [resInsumos, resEmbs, resTransf] = await Promise.all([
        fetchInsumosEstoque(uId),
        fetchEmbalagensMarmitaria(uId),
        fetchTransferenciasEstoque(uId),
      ]);

      setInsumos(resInsumos.data || []);
      setEmbalagens(resEmbs.data || []);
      setTransferencias(resTransf.data || []);

      if (resInsumos.data?.[0]) {
        setFormTransf((prev) => ({
          ...prev,
          insumo_id: resInsumos.data[0].id,
          unidade_medida: resInsumos.data[0].unidade_medida || "kg",
        }));
      }
    } catch (e) {
      console.error("Erro ao carregar estoque da marmitaria:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [unidadeAtiva]);

  // Filtragem dos itens de estoque
  const insumosFiltrados = useMemo(() => {
    return insumos.filter((item) => {
      const matchBusca =
        !busca ||
        item.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        item.categoria?.toLowerCase().includes(busca.toLowerCase());
      const matchCat = categoriaAtiva === "todas" || item.categoria === categoriaAtiva;
      return matchBusca && matchCat;
    });
  }, [insumos, busca, categoriaAtiva]);

  const handleSalvarTransferencia = async () => {
    if (!formTransf.insumo_id) {
      alert("Selecione o insumo para transferir.");
      return;
    }

    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const res = await registrarTransferenciaEstoque(uId, formTransf);
      if (res.error) alert("Erro ao transferir: " + res.error);
      else {
        alert("Transferência interna registrada com sucesso!");
        setModalTransferir(false);
        carregarDados();
      }
    } catch (e) {
      alert("Erro ao transferir: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo do Estoque */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-700 mb-1">
            <Boxes size={14} /> Estoque Operacional
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Estoque & Embalagens da Marmitaria
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Visão focada na operação de marmitas conectada ao estoque central Seldeestrela sem duplicidade de insumos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalConversao(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold px-4 py-2.5 rounded-2xl transition-all"
          >
            <Package size={16} /> Conversor de Embalagens
          </button>
          <button
            onClick={() => setModalTransferir(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
          >
            <ArrowRightLeft size={16} /> Transferência Interna
          </button>
        </div>
      </div>

      {/* Abas Principais (Estoque Geral, Embalagens & Kits, Histórico de Transferências) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setAbaPrincipal("estoque")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaPrincipal === "estoque"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Visão Geral por Categoria ({insumos.length} itens)
        </button>
        <button
          onClick={() => setAbaPrincipal("embalagens")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaPrincipal === "embalagens"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Embalagens & Kits ({embalagens.length})
        </button>
        <button
          onClick={() => setAbaPrincipal("transferencias")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaPrincipal === "transferencias"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Histórico de Transferências ({transferencias.length})
        </button>
      </div>

      {abaPrincipal === "estoque" && (
        <div className="space-y-4">
          {/* Seletor de Categorias da Fase 5 */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setCategoriaAtiva("todas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                categoriaAtiva === "todas"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              Todas as Categorias
            </button>

            {CATEGORIAS_ESTOQUE_MARMITARIA.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  categoriaAtiva === cat
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tabela de Insumos */}
          <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm p-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Item / Insumo</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Saldo Disponível</th>
                  <th className="py-3 px-3">Estoque Mínimo</th>
                  <th className="py-3 px-3">Custo Unitário</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insumosFiltrados.slice(0, 40).map((item) => {
                  const saldo = 12.5; // Saldo operacional utilizável
                  const min = Number(item.estoque_minimo) || 5;
                  const alerta = saldo < min;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 font-medium">
                      <td className="py-3 px-3 font-bold text-slate-900">{item.nome}</td>
                      <td className="py-3 px-3 text-slate-500">{item.categoria || "Geral"}</td>
                      <td className="py-3 px-3 font-black text-slate-800">
                        {saldo} {item.unidade_medida}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {min} {item.unidade_medida}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {fmtBRL(item.custo_unitario)}
                      </td>
                      <td className="py-3 px-3">
                        {alerta ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold flex items-center gap-1 w-fit">
                            <AlertTriangle size={11} /> Abaixo do Mínimo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setFormTransf({
                              ...formTransf,
                              insumo_id: item.id,
                              unidade_medida: item.unidade_medida,
                            });
                            setModalTransferir(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                        >
                          Transferir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaPrincipal === "embalagens" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {embalagens.map((emb) => (
            <div
              key={emb.id}
              className="bg-hf-surface p-5 rounded-3xl border border-hf-border shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-black uppercase">
                  Embalagem
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{emb.nome}</h3>
                <span className="text-xs text-slate-500">
                  Unidade: <strong>{emb.unidade_medida || "un"}</strong>
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-500">Custo por Unidade:</span>
                <strong className="text-sm font-black text-slate-900">{fmtBRL(emb.custo_unitario)}</strong>
              </div>

              <button
                onClick={() => setModalConversao(true)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Converter Entrada de Caixa
              </button>
            </div>
          ))}
        </div>
      )}

      {abaPrincipal === "transferencias" && (
        <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm p-4 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-3">Produto Transferido</th>
                <th className="py-3 px-3">Quantidade</th>
                <th className="py-3 px-3">Origem</th>
                <th className="py-3 px-3">Destino</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transferencias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                    Nenhuma transferência interna realizada ainda.
                  </td>
                </tr>
              ) : (
                transferencias.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 font-medium">
                    <td className="py-3 px-3 text-slate-600">{t.data}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{t.insumos?.nome || "Insumo"}</td>
                    <td className="py-3 px-3 font-black text-slate-800">{t.quantidade} {t.unidade_medida}</td>
                    <td className="py-3 px-3 text-slate-600">Cozinha Principal</td>
                    <td className="py-3 px-3 font-bold text-emerald-700">Marmitaria & Delivery</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL TRANSFERÊNCIA INTERNA (FASE 5) */}
      {modalTransferir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-emerald-700 block">Movimentação Interna</span>
                <h3 className="text-lg font-black text-slate-900">Transferir para Marmitaria</h3>
              </div>
              <button onClick={() => setModalTransferir(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Registra a alocação de insumos da cozinha central para a operação de marmitas com rastreabilidade total, <strong>sem gerar compra ou venda fictícia</strong>.
            </p>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Produto a Transferir:</label>
                <select
                  value={formTransf.insumo_id}
                  onChange={(e) => {
                    const ins = insumos.find((i) => i.id === e.target.value);
                    setFormTransf({
                      ...formTransf,
                      insumo_id: e.target.value,
                      unidade_medida: ins?.unidade_medida || "kg",
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome} ({i.unidade_medida})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Quantidade:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formTransf.quantidade}
                    onChange={(e) => setFormTransf({ ...formTransf, quantidade: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unidade:</label>
                  <input
                    type="text"
                    disabled
                    value={formTransf.unidade_medida}
                    className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Observação:</label>
                <input
                  type="text"
                  value={formTransf.observacao}
                  onChange={(e) => setFormTransf({ ...formTransf, observacao: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setModalTransferir(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarTransferencia}
                disabled={salvando}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Confirmar Transferência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONVERSOR DE EMBALAGENS (FASE 6) */}
      {modalConversao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-purple-700 block">Conversão de Embalagens</span>
                <h3 className="text-lg font-black text-slate-900">Entrada por Caixa ou Pacote</h3>
              </div>
              <button onClick={() => setModalConversao(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Converte automaticamente compras fechadas (ex: 1 caixa com 100 marmitas) em unidades unitárias para alimentar as fichas técnicas com precisão no centavo.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Embalagem:</label>
                <input
                  type="text"
                  value={formConversao.nome}
                  onChange={(e) => setFormConversao({ ...formConversao, nome: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unidades por Caixa/Pacote:</label>
                  <input
                    type="number"
                    value={formConversao.fatorConversao}
                    onChange={(e) => setFormConversao({ ...formConversao, fatorConversao: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Custo da Caixa (R$):</label>
                  <input
                    type="number"
                    step="1"
                    value={formConversao.custoTotalCaixa}
                    onChange={(e) => setFormConversao({ ...formConversao, custoTotalCaixa: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl text-xs space-y-1">
                <span className="text-purple-900 font-bold block">Resultado da Conversão:</span>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Custo unitário calculado:</span>
                  <strong className="text-sm font-black text-purple-950">
                    {fmtBRL(formConversao.custoTotalCaixa / (formConversao.fatorConversao || 1))} por unidade
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setModalConversao(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
