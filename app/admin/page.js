"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, Store, Users, ShieldCheck, Plus, Activity, AlertCircle, 
  CheckCircle2, Clock, Lock, ArrowUpRight, Search, SlidersHorizontal, RefreshCw,
  Download, Terminal, Zap, AlertTriangle, Cpu
} from "lucide-react";
import { supabase } from "../lib/supabase.js";

export default function SaaSControlPlanePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [telemetriaData, setTelemetriaData] = useState(null);
  const [erroMsg, setErroMsg] = useState("");
  const [modalNovoTenant, setModalNovoTenant] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Busca por Operation ID
  const [searchOpId, setSearchOpId] = useState("");
  const [logResultado, setLogResultado] = useState(null);
  const [buscandoLog, setBuscandoLog] = useState(false);

  // Form State Novo Restaurante
  const [formTenant, setFormTenant] = useState({
    nomeEmpresa: "",
    nomeFantasia: "",
    cnpj: "",
    adminNome: "",
    adminEmail: "",
    nomeUnidade: "Matriz",
    planoId: "PILOT_PRO"
  });

  const carregarDashboard = async () => {
    setLoading(true);
    setErroMsg("");
    try {
      const [resDashboard, resTelemetria] = await Promise.all([
        supabase.rpc("obter_resumo_control_plane_saas"),
        supabase.rpc("obter_telemetria_control_plane_saas")
      ]);

      if (resDashboard.error || !resDashboard.data || !resDashboard.data.sucesso) {
        setAutorizado(false);
        setErroMsg(resDashboard.data?.erro || resDashboard.error?.message || "Acesso negado: Requer permissão de Administrador da Plataforma.");
      } else {
        setAutorizado(true);
        setDashboardData(resDashboard.data);
        if (resTelemetria.data && resTelemetria.data.sucesso) {
          setTelemetriaData(resTelemetria.data);
        }
      }
    } catch (err) {
      setErroMsg("Erro ao conectar com o Control Plane da Plataforma.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDashboard();
  }, []);

  const handleCriarTenant = async (e) => {
    e.preventDefault();
    if (!formTenant.nomeEmpresa) return;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc("provisionar_novo_tenant", {
        p_nome_empresa: formTenant.nomeEmpresa,
        p_nome_fantasia: formTenant.nomeFantasia,
        p_cnpj: formTenant.cnpj,
        p_admin_nome: formTenant.adminNome,
        p_admin_email: formTenant.adminEmail,
        p_nome_unidade: formTenant.nomeUnidade,
        p_plano_id: formTenant.planoId
      });

      if (error || !data?.sucesso) {
        alert("Erro ao provisionar restaurante: " + (data?.erro || error?.message));
      } else {
        alert(`Restaurante '${formTenant.nomeEmpresa}' provisionado com sucesso!`);
        setModalNovoTenant(false);
        setFormTenant({
          nomeEmpresa: "", nomeFantasia: "", cnpj: "", adminNome: "", adminEmail: "", nomeUnidade: "Matriz", planoId: "PILOT_PRO"
        });
        carregarDashboard();
      }
    } catch (err) {
      alert("Falha no provisionamento do tenant.");
    } finally {
      setProcessando(false);
    }
  };

  const handleBuscarOperationId = async (e) => {
    e.preventDefault();
    if (!searchOpId.trim()) return;
    setBuscandoLog(true);
    setLogResultado(null);
    try {
      const { data, error } = await supabase.rpc("pesquisar_log_suporte_saas", {
        p_operation_id: searchOpId.trim()
      });
      if (error || !data?.sucesso) {
        alert(data?.erro || error?.message || "Operation ID não encontrado.");
      } else {
        setLogResultado(data.log);
      }
    } catch (err) {
      alert("Erro ao buscar log de suporte por Operation ID.");
    } finally {
      setBuscandoLog(false);
    }
  };

  const handleExportarTenant = (empresaId) => {
    window.open(`/api/saas/export?empresa_id=${empresaId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <RefreshCw className="animate-spin text-emerald-500 mb-3" size={32} />
        <p className="text-sm font-medium text-slate-400">Verificando autorização no Control Plane SaaS...</p>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-bold mb-2">Acesso Restrito ao Control Plane</h2>
          <p className="text-sm text-slate-400 mb-6">{erroMsg}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
          >
            Voltar para a Operação do Restaurante
          </button>
        </div>
      </div>
    );
  }

  // Cálculo de Latência Média Real da Plataforma (sem valores hardcoded)
  const listTenants = telemetriaData?.telemetria_tenants || [];
  const latenciasValidas = listTenants.map(t => t.latencia_media_ms).filter(v => v !== null && v !== undefined);
  const latenciaGlobalReal = latenciasValidas.length > 0 
    ? (latenciasValidas.reduce((a, b) => a + b, 0) / latenciasValidas.length).toFixed(1) + "ms"
    : "N/A (Aguardando dados de produção)";

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Cabeçalho Principal SaaS */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                PLATAFORMA CONTROL PLANE SAAS
              </span>
              <span className="text-xs text-slate-500 font-mono">v{dashboardData?.versao_plataforma}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-50">
              Gestão de Tenants SaaS Héfisto — Control Plane
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Painel de controle administrativo, observabilidade técnica e diagnóstico por Operation ID.
            </p>
          </div>

          <button
            onClick={() => setModalNovoTenant(true)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-950/40 shrink-0"
          >
            <Plus size={18} />
            Cadastrar Novo Restaurante Piloto
          </button>
        </div>

        {/* Garantia de Privacidade */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-400">
          <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
          <span>
            <strong className="text-slate-200">Princípio de Privacidade SaaS:</strong> A telemetria exibe exclusivamente latência técnica, erros de sistema e usuários ativos. NENHUM dado comercial privado do cliente (vendas, estoque, receitas, folha) é exposto ao suporte ou à administração.
          </span>
        </div>

        {/* Cards de Métricas Globais */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Restaurantes Cadastrados</p>
              <p className="text-3xl font-extrabold text-slate-50 mt-1">{dashboardData?.total_empresas || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Building2 size={24} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Unidades Operacionais</p>
              <p className="text-3xl font-extrabold text-slate-50 mt-1">{dashboardData?.total_unidades || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Store size={24} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Latência Média RPC</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1">{latenciaGlobalReal}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Zap size={24} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Saúde da Plataforma</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1">OPERACIONAL</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Activity size={24} />
            </div>
          </div>
        </div>

        {/* Diagnóstico por Operation ID */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Terminal size={18} className="text-amber-400" />
            Modo de Diagnóstico de Erros por Operation ID (Suporte Héfisto)
          </h3>
          <p className="text-xs text-slate-400">
            Digite o <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded">operation_id</code> gerado em uma operação real do cliente para consultar o log técnico de erro sanitizado.
          </p>
          <form onSubmit={handleBuscarOperationId} className="flex gap-3">
            <input
              type="text"
              value={searchOpId}
              onChange={(e) => setSearchOpId(e.target.value)}
              placeholder="Ex: op_1672938491_a8f1"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={buscandoLog}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              <Search size={16} />
              {buscandoLog ? "Buscando..." : "Pesquisar Log"}
            </button>
          </form>

          {logResultado && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs font-mono text-slate-300">
              <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-2">
                <span>OPERATION_ID: {logResultado.operation_id}</span>
                <span>{new Date(logResultado.criado_em).toLocaleString('pt-BR')}</span>
              </div>
              <p><strong className="text-slate-400">Empresa ID:</strong> {logResultado.empresa_id}</p>
              <p><strong className="text-slate-400">Endpoint / RPC:</strong> {logResultado.endpoint}</p>
              <p><strong className="text-slate-400">Código de Erro:</strong> {logResultado.error_code}</p>
              {logResultado.is_synthetic && (
                <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase mb-2">
                  [DADO SINTÉTICO DE TESTE]
                </span>
              )}
              <div className="mt-2 p-3 bg-slate-900 rounded-lg text-slate-300 overflow-x-auto">
                <strong className="text-rose-400 block mb-1">Sanitized Stack Trace:</strong>
                <pre className="whitespace-pre-wrap">{logResultado.sanitized_stack}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Tabela de Telemetria Operacional por Tenant */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Cpu size={18} className="text-emerald-400" />
              Observabilidade Técnica por Restaurante
            </h3>
            <span className="text-xs text-slate-400">Dados Técnicos em Tempo Real</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Restaurante</th>
                  <th className="px-5 py-3.5">Plano</th>
                  <th className="px-5 py-3.5">Usuários Ativos / Dia</th>
                  <th className="px-5 py-3.5">Latência Média RPC</th>
                  <th className="px-5 py-3.5">Erros Registrados</th>
                  <th className="px-5 py-3.5">Slow Queries (&gt;500ms)</th>
                  <th className="px-5 py-3.5">Status Saúde</th>
                  <th className="px-5 py-3.5 text-right">Offboarding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(telemetriaData?.telemetria_tenants || dashboardData?.tenants || []).map((t) => (
                  <tr key={t.empresa_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-100">
                      {t.nome_empresa || t.nome}
                      <span className="block text-xs font-mono font-normal text-slate-500">{t.empresa_id}</span>
                    </td>
                    <td className="px-5 py-4 font-bold text-emerald-400">{t.plano_id || 'PILOT_PRO'}</td>
                    <td className="px-5 py-4 font-mono">{t.usuarios_ativos_hoje !== undefined ? `${t.usuarios_ativos_hoje} ativas` : '—'}</td>
                    <td className="px-5 py-4 font-mono">{t.latencia_media_ms ? `${t.latencia_media_ms} ms` : 'N/A'}</td>
                    <td className="px-5 py-4 font-mono text-slate-300">{t.contagem_erros ?? 0}</td>
                    <td className="px-5 py-4 font-mono text-slate-300">{t.slow_queries_count ?? 0}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {t.status_saude || 'GREEN'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleExportarTenant(t.empresa_id)}
                        className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                        title="Exportar dados completos em JSON (Exportação Validada)"
                      >
                        <Download size={14} />
                        Exportar JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Provisionamento Novo Tenant Piloto Real */}
        {modalNovoTenant && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-xl font-bold text-slate-100">Provisionar Novo Restaurante Piloto</h3>
              <p className="text-xs text-slate-400">Insira os dados reais fornecidos pelo cliente restaurante para provisionar o tenant em ambiente isolado.</p>
              <form onSubmit={handleCriarTenant} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nome da Empresa / Razão Social *</label>
                  <input
                    type="text"
                    required
                    value={formTenant.nomeEmpresa}
                    onChange={(e) => setFormTenant({ ...formTenant, nomeEmpresa: e.target.value })}
                    placeholder="Ex: Restaurante Exemplo LTDA"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      value={formTenant.nomeFantasia}
                      onChange={(e) => setFormTenant({ ...formTenant, nomeFantasia: e.target.value })}
                      placeholder="Ex: Exemplo Restaurante"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">E-mail Admin Real</label>
                    <input
                      type="email"
                      value={formTenant.adminEmail}
                      onChange={(e) => setFormTenant({ ...formTenant, adminEmail: e.target.value })}
                      placeholder="admin@restaurante.com.br"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nome Primeira Unidade</label>
                    <input
                      type="text"
                      value={formTenant.nomeUnidade}
                      onChange={(e) => setFormTenant({ ...formTenant, nomeUnidade: e.target.value })}
                      placeholder="Matriz"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Plano Piloto</label>
                    <select
                      value={formTenant.planoId}
                      onChange={(e) => setFormTenant({ ...formTenant, planoId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    >
                      <option value="PILOT_PRO">PILOT_PRO</option>
                      <option value="BASIC">BASIC</option>
                      <option value="PRO">PRO</option>
                      <option value="MULTIUNIT">MULTIUNIT</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setModalNovoTenant(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={processando}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl"
                  >
                    {processando ? "Provisionando..." : "Confirmar Provisionamento"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
