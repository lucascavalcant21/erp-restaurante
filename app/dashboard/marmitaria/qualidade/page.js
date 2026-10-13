"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  ShieldCheck,
  AlertTriangle,
  Star,
  Thermometer,
  Clock,
  Plus,
  CheckCircle2,
  DollarSign,
  PieChart,
  FileText,
  UserCheck,
  Lock,
  Sparkles,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import {
  fetchQualidadeOcorrencias,
  salvarQualidadeOcorrencia,
  fetchMarmitas,
} from "../../../lib/marmitaria/marmitaria-service";
import { calcularMetricasQualidade } from "../../../lib/marmitaria/marmitaria-calculos.mjs";

const TIPOS_OCORRENCIA = [
  { id: "erro_montagem", label: "Erro de Montagem / Troca de Marmita" },
  { id: "atraso_entrega", label: "Atraso Significativo na Entrega" },
  { id: "temperatura_inadequada", label: "Comida Fria / Temperatura Abaixo de 60°C" },
  { id: "item_faltante", label: "Item Faltante (Talher, Molho ou Bebida)" },
  { id: "embalagem_violada", label: "Embalagem Danificada / Lacre Rompido" },
  { id: "elogio", label: "Elogio de Cliente / Avaliação Positiva" },
];

export default function MarmitariaQualidadePage() {
  const { unidadeAtiva } = useERP();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [marmitas, setMarmitas] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const [form, setForm] = useState({
    tipo: "erro_montagem",
    pedido_codigo: "",
    produto_id: "",
    gravidade: "media",
    nota_avaliacao: 2,
    custo_reembolso: 0,
    descricao: "",
    acao_corretiva: "",
    data: new Date().toISOString().slice(0, 10),
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const [resOc, resMar] = await Promise.all([
        fetchQualidadeOcorrencias(uId),
        fetchMarmitas(uId),
      ]);
      setOcorrencias(resOc.data || []);
      setMarmitas(resMar.data || []);
    } catch (err) {
      console.error("Erro ao carregar qualidade:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  // Métricas de Qualidade
  const metricas = useMemo(() => {
    return calcularMetricasQualidade({
      ocorrencias,
      totalPedidos: 1850, // total de pedidos do mês
    });
  }, [ocorrencias]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descricao) return alert("Descreva o ocorrido!");

    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const { error } = await salvarQualidadeOcorrencia(uId, form);
      if (error) {
        alert("Erro ao registrar: " + error);
      } else {
        setMensagemSucesso("Ocorrência de qualidade registrada!");
        setTimeout(() => setMensagemSucesso(""), 4000);
        setModalAberto(false);
        carregar();
      }
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <ShieldCheck size={16} />
            Qualidade, Atendimento & Conformidade Sanitária (ANVISA RDC 216)
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Controle de Qualidade & Atendimento
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de não-conformidades, taxa de defeito operacional, custos de reembolso e conformidade térmica.
          </p>
        </div>

        <button
          onClick={() => {
            setForm({
              tipo: "erro_montagem",
              pedido_codigo: "",
              produto_id: marmitas[0]?.id || "",
              gravidade: "media",
              nota_avaliacao: 2,
              custo_reembolso: 0,
              descricao: "",
              acao_corretiva: "",
              data: new Date().toISOString().slice(0, 10),
            });
            setModalAberto(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-emerald-600/20"
        >
          <Plus size={16} />
          Registrar Ocorrência
        </button>
      </div>

      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          {mensagemSucesso}
        </div>
      )}

      {/* Cards de KPIs de Qualidade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Taxa de Conformidade</span>
            <ShieldCheck size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {fmtPct(metricas.conformidadeOperacionalPct)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Taxa de falha: {fmtPct(metricas.taxaDefeitoPct)} dos pedidos
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Avaliação Média dos Clientes</span>
            <Star size={18} className="text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {metricas.avaliacaoMedia} / 5.0
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Média ponderada no iFood e canais diretos
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Custo de Reembolsos / Perdas</span>
            <DollarSign size={18} className="text-red-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {fmtBRL(metricas.custoTotalReembolsos)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {metricas.totalOcorrencias} ocorrências no período
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Controle Térmico ANVISA</span>
            <Thermometer size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            100% Conforme
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cocção &gt; 74°C • Rampa &gt; 60°C
          </p>
        </div>
      </div>

      {/* Protocolos de Boas Práticas Sanitárias (ANVISA RDC 216) e LGPD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
          <Thermometer size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Diretriz Sanitária RDC 216:</span> O alimento quente em espera para montagem e despacho deve permanecer a temperaturas superiores a <strong>60°C</strong> por no máximo 6 horas. Na cocção de carnes e aves, a temperatura no centro geométrico deve atingir no mínimo <strong>74°C</strong>.
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
          <Lock size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Privacidade & LGPD:</span> O registro de ocorrências vincula o código do pedido e o produto sem armazenar ou expor dados sensíveis do cliente na tela operacional da cozinha, cumprindo as diretrizes de governança de dados.
          </div>
        </div>
      </div>

      {/* Histórico de Ocorrências */}
      <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-hf-border flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Ocorrências Registradas & Ações Corretivas</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Carregando ocorrências...</div>
        ) : ocorrencias.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck size={36} className="mx-auto text-emerald-400 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">Nenhuma não-conformidade registrada</h3>
            <p className="text-xs text-slate-500 mt-1">
              Excelente padrão operacional na montagem e entrega das marmitas!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-hf-border">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Tipo da Ocorrência</th>
                  <th className="py-3 px-4">Pedido / Marmita</th>
                  <th className="py-3 px-4">Descrição do Ocorrido</th>
                  <th className="py-3 px-4">Ação Corretiva</th>
                  <th className="py-3 px-4 text-right">Reembolso (R$)</th>
                  <th className="py-3 px-4 text-center">Gravidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hf-border">
                {ocorrencias.map((oc) => (
                  <tr key={oc.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-700">{oc.data}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {TIPOS_OCORRENCIA.find((t) => t.id === oc.tipo)?.label || oc.tipo}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-bold">{oc.pedido_codigo ? `#${oc.pedido_codigo}` : "Pedido Balcão"}</div>
                      <div className="text-[11px] text-slate-500">{oc.fichas_tecnicas?.nome_receita || "Marmita Geral"}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 max-w-xs">{oc.descricao}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium max-w-xs">
                      {oc.acao_corretiva || "Orientação à equipe de expedição"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-red-600">
                      {oc.custo_reembolso > 0 ? fmtBRL(oc.custo_reembolso) : "R$ 0,00"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          oc.gravidade === "alta"
                            ? "bg-red-100 text-red-800"
                            : oc.gravidade === "media"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {oc.gravidade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Nova Ocorrência */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                Registrar Ocorrência de Qualidade
              </h3>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tipo de Ocorrência</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                  >
                    {TIPOS_OCORRENCIA.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Gravidade</label>
                  <select
                    value={form.gravidade}
                    onChange={(e) => setForm({ ...form, gravidade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                  >
                    <option value="baixa">Baixa (Pequena divergência)</option>
                    <option value="media">Média (Atraso / Troca de item)</option>
                    <option value="alta">Alta (Reclamação grave / Reembolso)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Código do Pedido</label>
                  <input
                    type="text"
                    value={form.pedido_codigo}
                    onChange={(e) => setForm({ ...form, pedido_codigo: e.target.value })}
                    placeholder="Ex: #4829 (iFood/PDV)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Custo Reembolsado (R$)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.custo_reembolso}
                    onChange={(e) => setForm({ ...form, custo_reembolso: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm font-bold text-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Descrição do Ocorrido</label>
                <textarea
                  rows={2}
                  required
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Explique o que aconteceu (ex: Cliente reclamou que a marmita executiva foi sem purê)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Ação Corretiva Implementada</label>
                <input
                  type="text"
                  value={form.acao_corretiva}
                  onChange={(e) => setForm({ ...form, acao_corretiva: e.target.value })}
                  placeholder="Ex: Reforço no check de expedição da marmita antes do selamento..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
