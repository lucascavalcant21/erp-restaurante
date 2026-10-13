"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  Users,
  Plus,
  Clock,
  DollarSign,
  Briefcase,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  PieChart,
  ShieldAlert,
  Info,
  Sparkles,
} from "lucide-react";
import { fmtBRL, fmtPct } from "../../../components/ui";
import {
  fetchRhAlocacoes,
  salvarRhAlocacao,,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";
import { fetchColaboradores } from "../../../lib/rh";
import { calcularCmoAlocadoMarmitaria } from "../../../lib/marmitaria/marmitaria-calculos.mjs";

const TURNOS = ["Manhã", "Tarde", "Noite", "Integral"];
const FUNCOES_MARMITARIA = [
  "Preparo e Cocção",
  "Montagem de Marmitas",
  "Embalagem e Etiquetagem",
  "Expedição e Entrega",
  "Higienização e Apoio",
  "Coordenação de Cozinha",
];

export default function MarmitariaRhPage() {
  const { unidadeAtiva, unidades } = useERP();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alocacoes, setAlocacoes] = useState([]);
  const [todosColaboradores, setTodosColaboradores] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos"); // 'todos', 'exclusivo', 'compartilhado', 'extra'
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  // Formulário de alocação
  const [form, setForm] = useState({
    colaborador_id: "",
    tipo_alocacao: "compartilhado",
    percentual_tempo: 50,
    horas_por_semana: 22,
    turno: "Manhã",
    funcao_marmitaria: "Preparo e Cocção",
    salario_base: 2000,
    encargos_provisoes: 600,
    beneficios: 300,
  });

  const carregarDados = async () => {
    setLoading(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const [resAloc, resColabs] = await Promise.all([
        fetchRhAlocacoes(uId),
        fetchColaboradores(uId),
      ]);

      setAlocacoes(resAloc.data || []);
      setTodosColaboradores(resColabs.data || []);
    } catch (e) {
      console.error("Erro ao carregar RH Marmitaria:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [unidadeAtiva, unidades]);

  // Colaboradores que ainda não foram alocados
  const colaboradoresDisponiveis = useMemo(() => {
    const idsAlocados = new Set(alocacoes.map((a) => a.colaborador_id));
    return todosColaboradores.filter((c) => !idsAlocados.has(c.id));
  }, [todosColaboradores, alocacoes]);

  // Normalização de dados para o cálculo do CMO
  const dadosParaCalculoCmo = useMemo(() => {
    return alocacoes.map((a) => {
      const colab = a.colaboradores || {};
      const sal = Number(colab.salario_base || colab.remuneracao) || 2000;
      const encargos = sal * 0.35; // Estimativa padrão encargos/benefícios
      const ben = 300;
      return {
        id: a.id,
        nome: colab.nome || "Colaborador",
        cargo: colab.cargo || a.funcao_marmitaria,
        tipo_alocacao: a.tipo_alocacao || "compartilhado",
        percentual_tempo: Number(a.percentual_tempo) || 100,
        horas_por_semana: Number(a.horas_por_semana) || 44,
        turno: a.turno || "Manhã",
        salario_base: sal,
        encargos_provisoes: encargos,
        beneficios: ben,
        funcao_marmitaria: a.funcao_marmitaria || "Preparo",
      };
    });
  }, [alocacoes]);

  const calculoCmo = useMemo(() => {
    return calcularCmoAlocadoMarmitaria(dadosParaCalculoCmo);
  }, [dadosParaCalculoCmo]);

  // Filtragem de tabela
  const alocacoesFiltradas = useMemo(() => {
    if (filtroTipo === "todos") return alocacoes;
    return alocacoes.filter((a) => a.tipo_alocacao === filtroTipo);
  }, [alocacoes, filtroTipo]);

  // Submissão do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.colaborador_id) {
      alert("Selecione um colaborador!");
      return;
    }

    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const { error } = await salvarRhAlocacao(uId, form);
      if (error) {
        alert("Erro ao salvar alocação: " + error);
      } else {
        setMensagemSucesso("Alocação salva com sucesso!");
        setTimeout(() => setMensagemSucesso(""), 4000);
        setModalAberto(false);
        await carregarDados();
      }
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (item) => {
    setForm({
      colaborador_id: item.colaborador_id,
      tipo_alocacao: item.tipo_alocacao || "compartilhado",
      percentual_tempo: item.percentual_tempo || 50,
      horas_por_semana: item.horas_por_semana || 22,
      turno: item.turno || "Manhã",
      funcao_marmitaria: item.funcao_marmitaria || "Preparo e Cocção",
    });
    setModalAberto(true);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Users size={16} />
            Recursos Humanos & CMO da Operação
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            RH & Escalas da Marmitaria
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Alocação de equipe exclusiva, compartilhada e extras sem duplicar funcionários ou salários no ERP central.
          </p>
        </div>

        <button
          onClick={() => {
            setForm({
              colaborador_id: colaboradoresDisponiveis[0]?.id || "",
              tipo_alocacao: "compartilhado",
              percentual_tempo: 50,
              horas_por_semana: 22,
              turno: "Manhã",
              funcao_marmitaria: "Preparo e Cocção",
            });
            setModalAberto(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-emerald-600/20 shrink-0"
        >
          <Plus size={16} />
          Alocar Colaborador
        </button>
      </div>

      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          {mensagemSucesso}
        </div>
      )}

      {/* Cards de KPIs de CMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Equipe Alocada</span>
            <Users size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {alocacoes.length} pessoas
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {alocacoes.filter((a) => a.tipo_alocacao === "exclusivo").length} exclusivos •{" "}
            {alocacoes.filter((a) => a.tipo_alocacao === "compartilhado").length} compartilhados
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>CMO Total Alocado</span>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {fmtBRL(calculoCmo.cmoTotal || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Custo mensal apurado na Marmitaria
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Custo Exclusivos / Extras</span>
            <Briefcase size={18} className="text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-800">
            {fmtBRL(calculoCmo.cmoExclusivos || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            + {fmtBRL(calculoCmo.cmoExtras || 0)} diárias de extras
          </p>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase mb-2">
            <span>Horas Dedicadas / Sem</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {alocacoes.reduce((t, a) => t + (Number(a.horas_por_semana) || 0), 0)}h / sem
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Capacidade produtiva semanal
          </p>
        </div>
      </div>

      {/* Regra de Ouro: Sem Duplicação */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-900">
        <Sparkles size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Regra de Isolamento de Custos:</span> Os colaboradores abaixo pertencem ao quadro geral de funcionários do restaurante matriz. A alocação aqui definida aplica o percentual de dedicação diretamente na apuração gerencial de CMO e DRE da Marmitaria, garantindo que o custo não seja duplicado na contabilidade geral da empresa.
        </div>
      </div>

      {/* Tabela de Alocações com Filtros */}
      <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-hf-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            Quadro de Alocação de Funcionários
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filtrar por tipo:</span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFiltroTipo("todos")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === "todos" ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos ({alocacoes.length})
              </button>
              <button
                onClick={() => setFiltroTipo("exclusivo")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === "exclusivo" ? "bg-white shadow-sm text-emerald-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Exclusivos
              </button>
              <button
                onClick={() => setFiltroTipo("compartilhado")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === "compartilhado" ? "bg-white shadow-sm text-blue-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Compartilhados
              </button>
              <button
                onClick={() => setFiltroTipo("extra")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === "extra" ? "bg-white shadow-sm text-amber-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Extras
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Carregando alocações de RH da marmitaria...
          </div>
        ) : alocacoesFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Nenhum colaborador alocado neste filtro</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Clique em &quot;Alocar Colaborador&quot; para vincular um funcionário da cozinha à operação da Marmitaria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-hf-border">
                  <th className="py-3 px-4">Colaborador / Cargo Geral</th>
                  <th className="py-3 px-4">Tipo Alocação</th>
                  <th className="py-3 px-4 text-center">% Dedicação</th>
                  <th className="py-3 px-4">Turno</th>
                  <th className="py-3 px-4">Função na Marmitaria</th>
                  <th className="py-3 px-4 text-right">Horas/Sem</th>
                  <th className="py-3 px-4 text-right">CMO Alocado</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hf-border">
                {alocacoesFiltradas.map((item) => {
                  const colab = item.colaboradores || {};
                  const sal = Number(colab.salario_base || colab.remuneracao) || 2000;
                  const encargos = sal * 0.35 + 300;
                  const cmoEstimado = (sal + encargos) * ((Number(item.percentual_tempo) || 100) / 100);

                  return (
                    <tr key={item.id || item.colaborador_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{colab.nome || "Colaborador"}</div>
                        <div className="text-[11px] text-slate-500">{colab.cargo || "Cozinha Central"}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            item.tipo_alocacao === "exclusivo"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.tipo_alocacao === "extra"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.tipo_alocacao}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-800 text-xs">
                          {item.percentual_tempo}%
                        </span>
                        <div className="w-16 bg-slate-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, item.percentual_tempo)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {item.turno || "Manhã"}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {item.funcao_marmitaria || "Preparo e Cocção"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                        {item.horas_por_semana}h
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                        {fmtBRL(cmoEstimado)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => abrirEdicao(item)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-emerald-700 rounded-lg transition-colors"
                          title="Editar Alocação"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Alocação de Colaborador */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Alocar Colaborador na Marmitaria
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Colaborador do ERP
                </label>
                <select
                  value={form.colaborador_id}
                  onChange={(e) => setForm({ ...form, colaborador_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Selecione um funcionário...</option>
                  {todosColaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.cargo || "Sem cargo"})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Reaproveita o cadastro geral do RH. Nenhuma pessoa é duplicada.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tipo de Alocação
                  </label>
                  <select
                    value={form.tipo_alocacao}
                    onChange={(e) => {
                      const tipo = e.target.value;
                      setForm({
                        ...form,
                        tipo_alocacao: tipo,
                        percentual_tempo: tipo === "exclusivo" ? 100 : tipo === "compartilhado" ? 50 : 25,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="compartilhado">Compartilhado (% de tempo)</option>
                    <option value="exclusivo">Exclusivo (100% Marmitaria)</option>
                    <option value="extra">Extra / Diarista</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    % de Tempo Dedicado
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.percentual_tempo}
                    onChange={(e) => setForm({ ...form, percentual_tempo: Number(e.target.value) })}
                    disabled={form.tipo_alocacao === "exclusivo"}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Turno de Trabalho
                  </label>
                  <select
                    value={form.turno}
                    onChange={(e) => setForm({ ...form, turno: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {TURNOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Horas por Semana
                  </label>
                  <input
                    type="number"
                    value={form.horas_por_semana}
                    onChange={(e) => setForm({ ...form, horas_por_semana: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Função Específica na Marmitaria
                </label>
                <select
                  value={form.funcao_marmitaria}
                  onChange={(e) => setForm({ ...form, funcao_marmitaria: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {FUNCOES_MARMITARIA.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-sm transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar Alocação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
