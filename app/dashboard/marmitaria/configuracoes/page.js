"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  Settings,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ShoppingBag,
  Percent,
  Sliders,
  Building2,
  DollarSign,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import {
  fetchConfiguracoesMarmitaria,
  salvarConfiguracoesMarmitaria,
} from "../../../lib/marmitaria/marmitaria-service";

export default function MarmitariaConfiguracoesPage() {
  const { unidadeAtiva } = useERP();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const [form, setForm] = useState({
    taxa_ifood_padrao_pct: 15.0,
    taxa_cartao_padrao_pct: 2.5,
    impostos_padrao_pct: 6.0,
    margem_lucro_alvo_pct: 20.0,
    capacidade_diaria_marmitas: 150,
    horario_inicio: "09:00",
    horario_fim: "15:00",
    alocacao_custos_fixos_pct: 25.0,
    canais_ativos: ["ifood", "whatsapp", "balcao"],
    impressao_automatica_kds: true,
    impressora_etiquetas: "Zebra ZD220 (Cozinha)",
    impressora_comandas: "Epson TM-T20X (Expedição)",
    alerta_estoque_minimo_dias: 2,
  });

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const uId = unidadeAtiva?.id || "matriz";
        const { data } = await fetchConfiguracoesMarmitaria(uId);
        if (data) {
          setForm((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [unidadeAtiva]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const { error } = await salvarConfiguracoesMarmitaria(uId, form);
      if (error) {
        alert("Erro ao salvar: " + error);
      } else {
        setMensagemSucesso("Configurações da Marmitaria salvas com sucesso!");
        setTimeout(() => setMensagemSucesso(""), 4000);
      }
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleCanal = (canalId) => {
    setForm((prev) => {
      const ativos = prev.canais_ativos || [];
      if (ativos.includes(canalId)) {
        return { ...prev, canais_ativos: ativos.filter((c) => c !== canalId) };
      } else {
        return { ...prev, canais_ativos: [...ativos, canalId] };
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Settings size={16} />
            Parâmetros Operacionais & Financeiros
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Configurações da Marmitaria
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Regras de rateio da cozinha matriz, taxas de canais de venda, capacidade produtiva e rotas de impressão KDS.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={salvando}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 shrink-0"
        >
          <Save size={16} />
          {salvando ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          {mensagemSucesso}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500">
          Carregando parâmetros da Marmitaria...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Taxas e Parâmetros Financeiros */}
          <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-600" />
              Taxas Comerciais & Metas de Precificação
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Taxa Padrão iFood (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.taxa_ifood_padrao_pct}
                  onChange={(e) => setForm({ ...form, taxa_ifood_padrao_pct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Comissão básica contratada</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Taxa Média Cartão (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.taxa_cartao_padrao_pct}
                  onChange={(e) => setForm({ ...form, taxa_cartao_padrao_pct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Débito, crédito e vouchers</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tributos Estimados (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.impostos_padrao_pct}
                  onChange={(e) => setForm({ ...form, impostos_padrao_pct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Alíquota Simples Nacional</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Margem Alvo Mínima (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.margem_lucro_alvo_pct}
                  onChange={(e) => setForm({ ...form, margem_lucro_alvo_pct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Dispara alerta se menor</p>
              </div>
            </div>
          </div>

          {/* Seção 2: Rateio e Operação da Cozinha */}
          <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 size={18} className="text-emerald-600" />
              Regras de Alocação da Cozinha Matriz & Capacidade
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Rateio Custos Fixos (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.alocacao_custos_fixos_pct}
                  onChange={(e) => setForm({ ...form, alocacao_custos_fixos_pct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">% da energia, gás e aluguel</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Capacidade Diária (Marmitas)
                </label>
                <input
                  type="number"
                  value={form.capacidade_diaria_marmitas}
                  onChange={(e) => setForm({ ...form, capacidade_diaria_marmitas: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Limite técnico da cozinha</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Início da Produção / Vendas
                </label>
                <input
                  type="time"
                  value={form.horario_inicio}
                  onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Término do Turno Delivery
                </label>
                <input
                  type="time"
                  value={form.horario_fim}
                  onChange={(e) => setForm({ ...form, horario_fim: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Canais de Venda Ativos */}
          <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag size={18} className="text-emerald-600" />
              Canais de Venda Habilitados
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "ifood", nome: "iFood Delivery" },
                { id: "whatsapp", nome: "WhatsApp Direto" },
                { id: "balcao", nome: "Balcão / Retirada" },
                { id: "site", nome: "Cardápio Digital Web" },
              ].map((c) => {
                const ativo = (form.canais_ativos || []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCanal(c.id)}
                    className={`p-4 rounded-2xl border text-left font-bold text-xs transition-all flex items-center justify-between ${
                      ativo
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    <span>{c.nome}</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full ${
                        ativo ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seção 4: Automação KDS e Impressão */}
          <div className="bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Printer size={18} className="text-emerald-600" />
              Integração com KDS & Rotas de Impressão
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Impressora de Etiquetas de Montagem
                </label>
                <input
                  type="text"
                  value={form.impressora_etiquetas}
                  onChange={(e) => setForm({ ...form, impressora_etiquetas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Imprime peso, ingredientes e data de validade na marmita</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Impressora de Comandas / Expedição
                </label>
                <input
                  type="text"
                  value={form.impressora_comandas}
                  onChange={(e) => setForm({ ...form, impressora_comandas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Imprime via de conferência para sacola e motoboy</p>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
