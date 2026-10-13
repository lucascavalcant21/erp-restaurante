"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  Calendar,
  Users,
  Repeat,
  Plus,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import {
  fetchAssinaturas,
  salvarAssinatura,,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";

const DIAS_SEMANA = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sáb" },
];

export default function MarmitariaAssinaturasPage() {
  const { unidadeAtiva, unidades } = useERP();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [assinaturas, setAssinaturas] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const [form, setForm] = useState({
    cliente_nome: "",
    cliente_telefone: "",
    plano_tipo: "semanal_5dias",
    quantidade_marmitas_periodo: 5,
    dias_entrega: ["seg", "ter", "qua", "qui", "sex"],
    valor_recorrente: 120.0,
    forma_cobranca: "pix_semanal",
    status: "ativo",
    preferencias_cardapio: "Sem cebola crua",
    endereco_entrega: "Rua das Flores, 120",
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const { data } = await fetchAssinaturas(uId);
      setAssinaturas(data || []);
    } catch (err) {
      console.error("Erro ao carregar assinaturas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva, unidades]);

  // Cálculos de receita recorrente (MRR de marmitas)
  const ativas = assinaturas.filter((a) => a.status === "ativo");
  const totalMarmitasSemana = ativas.reduce((t, a) => t + (Number(a.quantidade_marmitas_periodo) || 5), 0);
  const faturamentoSemanalRecorrente = ativas.reduce((t, a) => t + (Number(a.valor_recorrente) || 120), 0);
  const mrrMensalEstimado = faturamentoSemanalRecorrente * 4.3;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente_nome) return alert("Informe o nome do cliente!");

    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const { error } = await salvarAssinatura(uId, form);
      if (error) {
        alert("Erro ao salvar assinatura: " + error);
      } else {
        setMensagemSucesso("Plano de assinatura cadastrado com sucesso!");
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

  const toggleDia = (diaId) => {
    const atuais = form.dias_entrega || [];
    if (atuais.includes(diaId)) {
      setForm({ ...form, dias_entrega: atuais.filter((d) => d !== diaId) });
    } else {
      setForm({ ...form, dias_entrega: [...atuais, diaId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Repeat size={16} />
            Vendas Recorrentes & Fidelidade
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Assinaturas & Planos Programados
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cardápio programado semanal e mensal com entrega garantida e receita previsível para a marmitaria.
          </p>
        </div>

        <button
          onClick={() => {
            setForm({
              cliente_nome: "",
              cliente_telefone: "",
              plano_tipo: "semanal_5dias",
              quantidade_marmitas_periodo: 5,
              dias_entrega: ["seg", "ter", "qua", "qui", "sex"],
              valor_recorrente: 120.0,
              forma_cobranca: "pix_semanal",
              status: "ativo",
              preferencias_cardapio: "",
              endereco_entrega: "",
            });
            setModalAberto(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-emerald-600/20"
        >
          <Plus size={16} />
          Nova Assinatura
        </button>
      </div>

      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          {mensagemSucesso}
        </div>
      )}

      {/* KPIs da Recorrência */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">Assinantes Ativos</div>
          <div className="text-2xl font-black text-slate-900">{ativas.length} clientes</div>
          <p className="text-xs text-slate-500 mt-1">Retenção de clientes</p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">Volume Programado / Semana</div>
          <div className="text-2xl font-black text-emerald-700">{totalMarmitasSemana} marmitas</div>
          <p className="text-xs text-slate-500 mt-1">Demanda contratada e previsível</p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">Receita Semanal Garantida</div>
          <div className="text-2xl font-black text-slate-900">{fmtBRL(faturamentoSemanalRecorrente)}</div>
          <p className="text-xs text-slate-500 mt-1">Faturamento recorrente</p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">MRR Mensal Estimado</div>
          <div className="text-2xl font-black text-blue-700">{fmtBRL(mrrMensalEstimado)}</div>
          <p className="text-xs text-slate-500 mt-1">Base mensal recorrente</p>
        </div>
      </div>

      {/* Lista de Assinaturas */}
      <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-hf-border">
          <h2 className="text-base font-bold text-slate-900">Assinaturas Ativas & Calendário de Entregas</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Carregando assinaturas...</div>
        ) : assinaturas.length === 0 ? (
          <div className="p-12 text-center">
            <Repeat size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">Nenhum plano de assinatura cadastrado</h3>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre pacotes semanais para clientes de empresas e rotinas de escritório.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-hf-border">
                  <th className="py-3 px-4">Cliente / Contato</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Dias de Entrega</th>
                  <th className="py-3 px-4 text-right">Valor Recorrente</th>
                  <th className="py-3 px-4">Endereço de Entrega</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hf-border">
                {assinaturas.map((ass) => (
                  <tr key={ass.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{ass.cliente_nome}</div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1">
                        <Phone size={11} />
                        {ass.cliente_telefone || "Sem telefone"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block">
                        {ass.quantidade_marmitas_periodo} marmitas / semana
                      </span>
                      <span className="text-[11px] text-slate-500 uppercase">{ass.forma_cobranca}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1">
                        {(ass.dias_entrega || []).map((d) => (
                          <span key={d} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-sm">
                      {fmtBRL(ass.valor_recorrente)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {ass.endereco_entrega || "Balcão / Retirada"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          ass.status === "ativo" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ass.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Nova Assinatura */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Repeat size={18} className="text-emerald-600" />
                Cadastrar Assinatura de Marmitas
              </h3>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nome do Cliente</label>
                  <input
                    type="text"
                    required
                    value={form.cliente_nome}
                    onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={form.cliente_telefone}
                    onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Marmitas por Semana</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.quantidade_marmitas_periodo}
                    onChange={(e) => setForm({ ...form, quantidade_marmitas_periodo: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Valor Semanal (R$)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.valor_recorrente}
                    onChange={(e) => setForm({ ...form, valor_recorrente: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Dias de Entrega na Semana</label>
                <div className="flex gap-2">
                  {DIAS_SEMANA.map((d) => {
                    const sel = (form.dias_entrega || []).includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDia(d.id)}
                        className={`flex-1 py-1.5 rounded-xl font-bold border transition-all ${
                          sel ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Endereço de Entrega</label>
                <input
                  type="text"
                  value={form.endereco_entrega}
                  onChange={(e) => setForm({ ...form, endereco_entrega: e.target.value })}
                  placeholder="Rua, número, complemento e bairro"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Preferências ou Restrições</label>
                <input
                  type="text"
                  value={form.preferencias_cardapio}
                  onChange={(e) => setForm({ ...form, preferencias_cardapio: e.target.value })}
                  placeholder="Ex: Sem glúten, sem cebola crua, prefere frango"
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
                  {salvando ? "Salvando..." : "Salvar Assinatura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
