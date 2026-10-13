"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  ChefHat,
  Plus,
  Clock,
  CheckCircle2,
  Package,
  Truck,
  AlertTriangle,
  Printer,
  Scale,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  Play,
  RotateCcw,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import {
  fetchProducaoLotes,
  salvarProducaoLote,
  fetchMarmitas,,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";
import {
  calcularRendimentoReal,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

const STATUS_PRODUCAO = [
  { id: "planejado", label: "Planejada", cor: "bg-slate-100 text-slate-800 border-slate-200" },
  { id: "em_preparo", label: "Em Preparo", cor: "bg-blue-50 text-blue-800 border-blue-200" },
  { id: "preparado", label: "Preparado", cor: "bg-amber-50 text-amber-800 border-amber-200" },
  { id: "embalado", label: "Embalado", cor: "bg-purple-50 text-purple-800 border-purple-200" },
  { id: "disponivel", label: "Disponível", cor: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { id: "expedido", label: "Expedido", cor: "bg-emerald-600 text-white border-emerald-600" },
];

export default function MarmitariaProducaoPage() {
  const { unidadeAtiva, unidades } = useERP();

  const [loading, setLoading] = useState(true);
  const [lotes, setLotes] = useState([]);
  const [marmitas, setMarmitas] = useState([]);
  const [abaStatus, setAbaStatus] = useState("todos");

  // Modais
  const [modalNovoLote, setModalNovoLote] = useState(false);
  const [modalRendimento, setModalRendimento] = useState(false);
  const [loteAtivoRendimento, setLoteAtivoRendimento] = useState(null);

  // Form Lote
  const [formLote, setFormLote] = useState({
    ficha_id: "",
    tipo_demanda: "antecipada",
    quantidade_planejada: 30,
    data_producao: new Date().toISOString().slice(0, 10),
  });

  // Form Rendimento Real
  const [formRendimento, setFormRendimento] = useState({
    pesoCompradoBrutoKg: 10,
    custoTotalComprado: 220,
    pesoAposLimpezaKg: 8.5,
    pesoAposCoccaoKg: 6.8,
    porcoesProduzidas: 45,
  });

  const carregarDados = async () => {
    setLoading(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const [resLotes, resMarmitas] = await Promise.all([
        fetchProducaoLotes(uId),
        fetchMarmitas(uId),
      ]);

      const listaLotes = resLotes.data || [];
      setLotes(listaLotes);
      setMarmitas(resMarmitas.data || []);

      if (resMarmitas.data?.[0]) {
        setFormLote((prev) => ({ ...prev, ficha_id: resMarmitas.data[0].id }));
      }
    } catch (e) {
      console.error("Erro ao carregar lotes de produção:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [unidadeAtiva, unidades]);

  const lotesFiltrados = useMemo(() => {
    if (abaStatus === "todos") return lotes;
    return lotes.filter((l) => l.status === abaStatus);
  }, [lotes, abaStatus]);

  // Cálculos do Rendimento Real em tempo real
  const calculoRendimento = useMemo(() => {
    return calcularRendimentoReal(formRendimento);
  }, [formRendimento]);

  const handleAvancarStatus = async (lote) => {
    const ordem = ["planejado", "em_preparo", "preparado", "embalado", "disponivel", "expedido"];
    const atualIdx = ordem.indexOf(lote.status);
    if (atualIdx === -1 || atualIdx === ordem.length - 1) return;

    const proximoStatus = ordem[atualIdx + 1];
    const uId = resolverUnidade(unidadeAtiva, unidades);

    // Regra de baixa de estoque auditável e sem duplicidade:
    // Na transição para 'em_preparo', marca que consumiu os ingredientes.
    // Na transição para 'expedido', marca que consumiu embalagens e deu saída no produto.
    const updates = {
      id: lote.id,
      status: proximoStatus,
      quantidade_produzida: proximoStatus === "disponivel" || proximoStatus === "expedido" ? lote.quantidade_planejada : lote.quantidade_produzida,
      baixou_ingredientes: lote.baixou_ingredientes || proximoStatus === "em_preparo",
      baixou_embalagens: lote.baixou_embalagens || proximoStatus === "embalado" || proximoStatus === "expedido",
    };

    const res = await salvarProducaoLote(uId, updates);
    if (!res.error) carregarDados();
  };

  const handleSalvarNovoLote = async () => {
    if (!formLote.ficha_id) {
      alert("Selecione a marmita para produzir.");
      return;
    }

    const marmita = marmitas.find((m) => m.id === formLote.ficha_id);
    const custoUnit = Number(marmita?.custo_total) || 8.5;
    const custoTotal = custoUnit * Number(formLote.quantidade_planejada);

    const uId = resolverUnidade(unidadeAtiva, unidades);
    const res = await salvarProducaoLote(uId, {
      ...formLote,
      custo_total: custoTotal,
      status: "planejado",
    });

    if (res.error) alert("Erro ao criar lote: " + res.error);
    else {
      setModalNovoLote(false);
      carregarDados();
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo da Produção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-700 mb-1">
            <ChefHat size={14} /> Produção & KDS
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Produção de Marmitas & Rendimento Real
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Fluxo Kanban (preparo → embalado → expedição) com controle de rendimento na cocção e baixa única de estoque.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalRendimento(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold px-4 py-2.5 rounded-2xl transition-all"
          >
            <Scale size={16} /> Calculadora de Rendimento
          </button>
          <button
            onClick={() => setModalNovoLote(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Plus size={16} /> Planejar Novo Lote
          </button>
        </div>
      </div>

      {/* Abas de Status do Fluxo de Produção */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-hf-surface p-2 rounded-2xl border border-hf-border">
        <button
          onClick={() => setAbaStatus("todos")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            abaStatus === "todos"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Todos os Lotes ({lotes.length})
        </button>

        {STATUS_PRODUCAO.map((st) => {
          const qtd = lotes.filter((l) => l.status === st.id).length;
          return (
            <button
              key={st.id}
              onClick={() => setAbaStatus(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                abaStatus === st.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <span>{st.label}</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{qtd}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de Lotes em Produção */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-bold">
          Carregando lotes de produção da marmitaria...
        </div>
      ) : lotesFiltrados.length === 0 ? (
        <div className="bg-hf-surface p-12 text-center rounded-3xl border border-hf-border">
          <ChefHat size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Nenhum lote neste status</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Planeje lotes de produção antecipada ou sob demanda para alimentar a expedição.
          </p>
          <button
            onClick={() => setModalNovoLote(true)}
            className="mt-4 inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl"
          >
            <Plus size={16} /> Planejar Lote
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {lotesFiltrados.map((lote) => {
            const stInfo = STATUS_PRODUCAO.find((s) => s.id === lote.status) || STATUS_PRODUCAO[0];

            return (
              <div
                key={lote.id}
                className="bg-hf-surface rounded-3xl border border-hf-border p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {lote.codigo}
                    </span>
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black border ${stInfo.cor}`}>
                      {stInfo.label}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900 mt-2">
                    {lote.fichas_tecnicas?.nome_receita || "Marmita"}
                  </h3>
                  <span className="text-xs text-slate-500 block">
                    Demanda: <strong>{lote.tipo_demanda === "antecipada" ? "Produção Antecipada" : "Sob Demanda"}</strong> • Data: {lote.data_producao}
                  </span>

                  {/* Detalhes de Quantidade e Custos */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block">Planejado:</span>
                      <strong className="text-slate-800 text-sm">{lote.quantidade_planejada} un</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Custo do Lote:</span>
                      <strong className="text-slate-800 text-sm">{fmtBRL(lote.custo_total)}</strong>
                    </div>
                  </div>

                  {/* Status das Baixas de Estoque (Auditável - Sem duplicidade) */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} className={lote.baixou_ingredientes ? "text-emerald-500" : "text-slate-300"} />
                      Ingredientes baixados
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} className={lote.baixou_embalagens ? "text-emerald-500" : "text-slate-300"} />
                      Embalagens baixadas
                    </span>
                  </div>
                </div>

                {/* Ações do Lote */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    title="Imprimir Comanda KDS"
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                  >
                    <Printer size={15} />
                  </button>

                  {lote.status !== "expedido" && (
                    <button
                      onClick={() => handleAvancarStatus(lote)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <span>Avançar Etapa</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NOVO LOTE */}
      {modalNovoLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-black text-slate-900">Planejar Lote de Produção</h3>
              <button onClick={() => setModalNovoLote(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Marmita a Produzir:</label>
                <select
                  value={formLote.ficha_id}
                  onChange={(e) => setFormLote({ ...formLote, ficha_id: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                >
                  {marmitas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome_receita} ({m.tamanho || "M"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Quantidade (unidades):</label>
                  <input
                    type="number"
                    min="1"
                    value={formLote.quantidade_planejada}
                    onChange={(e) => setFormLote({ ...formLote, quantidade_planejada: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tipo de Produção:</label>
                  <select
                    value={formLote.tipo_demanda}
                    onChange={(e) => setFormLote({ ...formLote, tipo_demanda: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  >
                    <option value="antecipada">Antecipada (Estoque pronto)</option>
                    <option value="sob_demanda">Sob Demanda (Na hora)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setModalNovoLote(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarNovoLote}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Confirmar e Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CALCULADORA DE RENDIMENTO REAL (FASE 7) */}
      {modalRendimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-xl rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-blue-700 block">Engenharia de Cocção</span>
                <h3 className="text-lg font-black text-slate-900">Controle do Rendimento Real</h3>
              </div>
              <button onClick={() => setModalRendimento(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Mede a perda real na limpeza e cocção para apurar o custo exato por porção servida na marmita.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">1. Peso Comprado Bruto (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={formRendimento.pesoCompradoBrutoKg}
                  onChange={(e) => setFormRendimento({ ...formRendimento, pesoCompradoBrutoKg: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Custo Total da Compra (R$):</label>
                <input
                  type="number"
                  step="1"
                  value={formRendimento.custoTotalComprado}
                  onChange={(e) => setFormRendimento({ ...formRendimento, custoTotalComprado: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">2. Peso Após Limpeza (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={formRendimento.pesoAposLimpezaKg}
                  onChange={(e) => setFormRendimento({ ...formRendimento, pesoAposLimpezaKg: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">3. Peso Após Cocção (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={formRendimento.pesoAposCoccaoKg}
                  onChange={(e) => setFormRendimento({ ...formRendimento, pesoAposCoccaoKg: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="font-bold text-slate-700">4. Quantidade de Porções Produzidas:</label>
                <input
                  type="number"
                  min="1"
                  value={formRendimento.porcoesProduzidas}
                  onChange={(e) => setFormRendimento({ ...formRendimento, porcoesProduzidas: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>

            {/* Resultado do Rendimento */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Perda na Limpeza:</span>
                <strong className="text-slate-900">{calculoRendimento.perdaLimpezaPct}% (FC Real: {calculoRendimento.fatorCorrecaoReal})</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Perda na Cocção:</span>
                <strong className="text-slate-900">{calculoRendimento.perdaCoccaoPct}%</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Rendimento Total Líquido:</span>
                <strong className="text-slate-900">{calculoRendimento.rendimentoTotalPct}%</strong>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-blue-200 font-bold">
                <span className="text-blue-900">Custo Final Por Porção:</span>
                <strong className="text-base text-blue-950">{fmtBRL(calculoRendimento.custoFinalPorPorcao)}</strong>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Peso Médio da Porção:</span>
                <strong>{calculoRendimento.pesoMedioPorcaoG}g</strong>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setModalRendimento(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Concluir Análise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
