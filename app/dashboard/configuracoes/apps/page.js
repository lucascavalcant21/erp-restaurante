"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Smartphone, ShieldCheck, Key, Plus, RefreshCw, Eye, EyeOff, Copy,
  Check, Trash2, Edit3, Lock, Clock, MapPin, Laptop, Tablet, AlertCircle,
  CheckCircle, ArrowRight, Sparkles, Filter, Search, Power, ExternalLink,
  ChevronRight, UtensilsCrossed, Wine, Users, Package, DollarSign, Bot, TrendingUp
} from "lucide-react";
import {
  fetchAppsConfig, salvarAppConfig, removerAppConfig, alterarSenhaApp,
  alterarStatusApp, fetchLogsAcesso, MODULOS_APP, PRESETS_APPS, tempoRelativo
} from "../../../lib/apps-config";
import { useERP } from "../../../context/ERPContext";

export default function AppsConfigPage() {
  const { unidadeAtiva, unidades } = useERP();
  const [apps, setApps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("apps"); // 'apps' | 'auditoria'

  // Modais
  const [modalAppAberto, setModalAppAberto] = useState(false);
  const [appEmEdicao, setAppEmEdicao] = useState(null);
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [appTrocaSenha, setAppTrocaSenha] = useState(null);
  const [novaSenha, setNovaSenha] = useState("");

  // Formulário do App
  const [form, setForm] = useState({
    id: null,
    nome: "",
    login: "",
    senha: "",
    unidade_id: unidadeAtiva || "matriz",
    icone: "Smartphone",
    cor: "#047857",
    modulosIds: ["cozinha", "assistente"],
    telaInicial: "/dashboard/operacao/inteligente",
  });

  // Senhas reveladas na tabela
  const [senhasVisiveis, setSenhasVisiveis] = useState({});
  const [copiadoId, setCopiadoId] = useState(null);

  // Filtros da auditoria
  const [buscaAudit, setBuscaAudit] = useState("");
  const [filtroAppAudit, setFiltroAppAudit] = useState("todos");

  // Carrega dados
  const carregar = async () => {
    setCarregando(true);
    try {
      const [listaApps, listaLogs] = await Promise.all([
        fetchAppsConfig(unidadeAtiva),
        fetchLogsAcesso(unidadeAtiva),
      ]);
      setApps(listaApps);
      setLogs(listaLogs);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // Auto-refresh da auditoria a cada 20 segundos
    const intervalo = setInterval(() => {
      fetchLogsAcesso(unidadeAtiva).then(setLogs).catch(() => {});
    }, 20000);
    return () => clearInterval(intervalo);
  }, [unidadeAtiva]);

  // Abre modal para novo app ou preset
  const abrirNovoApp = (preset = null) => {
    if (preset) {
      setForm({
        id: null,
        nome: preset.nome,
        login: preset.loginSugestao,
        senha: `${preset.loginSugestao}123`,
        unidade_id: unidadeAtiva || "matriz",
        icone: preset.icone,
        cor: preset.cor,
        modulosIds: preset.modulosIds,
        telaInicial: preset.telaInicial,
      });
    } else {
      setForm({
        id: null,
        nome: "App Estação Nova",
        login: "",
        senha: "",
        unidade_id: unidadeAtiva || "matriz",
        icone: "Smartphone",
        cor: "#047857",
        modulosIds: ["cozinha"],
        telaInicial: "/dashboard/operacao/inteligente",
      });
    }
    setAppEmEdicao(null);
    setModalAppAberto(true);
  };

  const abrirEditarApp = (app) => {
    setAppEmEdicao(app);
    setForm({
      id: app.id,
      nome: app.nome,
      login: app.login,
      senha: app.senha,
      unidade_id: app.unidade_id || unidadeAtiva || "matriz",
      icone: app.icone || "Smartphone",
      cor: app.cor || "#047857",
      modulosIds: app.modulosIds || [],
      telaInicial: app.telaInicial || "/dashboard",
    });
    setModalAppAberto(true);
  };

  const salvarApp = async (e) => {
    e.preventDefault();
    try {
      await salvarAppConfig(unidadeAtiva, form);
      setModalAppAberto(false);
      carregar();
    } catch (err) {
      alert(err.message || "Erro ao salvar app");
    }
  };

  const toggleModulo = (modId) => {
    setForm((prev) => {
      const existe = prev.modulosIds.includes(modId);
      const novos = existe
        ? prev.modulosIds.filter((id) => id !== modId)
        : [...prev.modulosIds, modId];
      // Ajusta tela inicial se o módulo correspondente foi desmarcado
      const modObj = MODULOS_APP.find((m) => m.id === novos[0]);
      return {
        ...prev,
        modulosIds: novos,
        telaInicial: modObj ? modObj.rotas[0] : "/dashboard",
      };
    });
  };

  const alternarStatus = async (app) => {
    try {
      await alterarStatusApp(unidadeAtiva, app.id, !app.ativo);
      carregar();
    } catch (err) {
      alert("Erro ao alterar status: " + err.message);
    }
  };

  const excluirApp = async (app) => {
    if (!confirm(`Deseja realmente excluir o "${app.nome}"? O login "${app.login}" deixará de funcionar imediatamente.`)) return;
    try {
      await removerAppConfig(unidadeAtiva, app.id);
      carregar();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const salvarNovaSenha = async (e) => {
    e.preventDefault();
    if (!novaSenha || novaSenha.length < 3) {
      return alert("A nova senha deve ter pelo menos 3 caracteres.");
    }
    try {
      await alterarSenhaApp(unidadeAtiva, appTrocaSenha.id, novaSenha);
      setModalSenhaAberto(false);
      setNovaSenha("");
      carregar();
    } catch (err) {
      alert("Erro ao trocar senha: " + err.message);
    }
  };

  const copiarLoginSenha = (app) => {
    const texto = `Login: ${app.login}\nSenha: ${app.senha}`;
    navigator.clipboard?.writeText(texto);
    setCopiadoId(app.id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  // Filtra logs de auditoria
  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      if (filtroAppAudit !== "todos" && log.login !== filtroAppAudit) return false;
      if (buscaAudit) {
        const q = buscaAudit.toLowerCase();
        const texto = `${log.app_nome} ${log.login} ${log.ip} ${log.dispositivo} ${log.local} ${log.detalhes}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [logs, filtroAppAudit, buscaAudit]);

  // Ícones dinâmicos
  const renderIcone = (nome, cor = "#047857", size = 20) => {
    const props = { size, style: { color: cor } };
    switch (nome) {
      case "UtensilsCrossed": return <UtensilsCrossed {...props} />;
      case "Wine": return <Wine {...props} />;
      case "Users": return <Users {...props} />;
      case "Package": return <Package {...props} />;
      case "Clock": return <Clock {...props} />;
      case "DollarSign": return <DollarSign {...props} />;
      case "Bot": return <Bot {...props} />;
      case "TrendingUp": return <TrendingUp {...props} />;
      default: return <Smartphone {...props} />;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-24">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2 text-2xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit mb-2 border border-emerald-200">
            <ShieldCheck size={14} /> Controle de Estações &amp; Terminais
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
            Apps, Terminais e Logins de Estação
          </h1>
          <p className="text-sm text-fg max-w-2xl mt-1">
            Crie logins e senhas para cada app ou tablet, defina exatamente o que cada estação pode enxergar e acompanhe que horas teve acesso e o local em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => abrirNovoApp()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-3 rounded-xl flex items-center gap-2 transition active:scale-[0.98] shadow-sm"
          >
            <Plus size={18} /> Novo App / Estação
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card p-4 sm:p-5 rounded-2xl border border-line shadow-sm">
          <p className="text-3xs uppercase font-extrabold tracking-widest text-subtle">Apps Cadastrados</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{apps.length}</p>
          <p className="text-xs text-emerald-600 font-bold mt-1">Prontos para login em tablets</p>
        </div>

        <div className="bg-card p-4 sm:p-5 rounded-2xl border border-line shadow-sm">
          <p className="text-3xs uppercase font-extrabold tracking-widest text-subtle">Apps Ativos na Loja</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
            {apps.filter((a) => a.ativo).length}
          </p>
          <p className="text-xs text-subtle font-medium mt-1">Acesso liberado no sistema</p>
        </div>

        <div className="bg-card p-4 sm:p-5 rounded-2xl border border-line shadow-sm">
          <p className="text-3xs uppercase font-extrabold tracking-widest text-subtle">Acessos Monitorados</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{logs.length}</p>
          <p className="text-xs text-emerald-600 font-bold mt-1">Registro de data, hora e IP</p>
        </div>

        <div className="bg-card p-4 sm:p-5 rounded-2xl border border-line shadow-sm">
          <p className="text-3xs uppercase font-extrabold tracking-widest text-subtle">Unidade Ativa</p>
          <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1 truncate">
            {unidadeAtiva === "matriz" ? "Loja Matriz" : unidadeAtiva}
          </p>
          <p className="text-xs text-subtle font-medium mt-1">Sincronizado na rede</p>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="flex border-b border-line gap-2">
        <button
          onClick={() => setAbaAtiva("apps")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            abaAtiva === "apps"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-subtle hover:text-slate-800"
          }`}
        >
          <Smartphone size={16} /> Apps e Logins Criados ({apps.length})
        </button>

        <button
          onClick={() => setAbaAtiva("auditoria")}
          className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            abaAtiva === "auditoria"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-subtle hover:text-slate-800"
          }`}
        >
          <Clock size={16} /> Auditoria &amp; Acessos em Tempo Real ({logs.length})
        </button>
      </div>

      {/* ════════════════ ABA 1: APPS CRIADOS ════════════════ */}
      {abaAtiva === "apps" && (
        <div className="space-y-6">
          {/* CRIAÇÃO RÁPIDA POR PRESETS */}
          <div className="bg-white rounded-2xl border border-line p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-subtle mb-3 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" /> Criar Estação Rápida com 1 Clique (Modelos Recomendados)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {PRESETS_APPS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => abrirNovoApp(preset)}
                  className="flex flex-col items-center text-center p-3 rounded-xl border border-line hover:border-emerald-400 hover:bg-emerald-50/50 transition active:scale-[0.98] group"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-xs group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${preset.cor}15` }}
                  >
                    {renderIcone(preset.icone, preset.cor, 20)}
                  </div>
                  <span className="text-xs font-black text-slate-800 leading-tight">{preset.nome}</span>
                  <span className="text-3xs text-subtle font-medium mt-1">login: @{preset.loginSugestao}</span>
                </button>
              ))}
            </div>
          </div>

          {/* LISTA DE CARDS DE APPS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => {
              const senhaVisivel = senhasVisiveis[app.id];
              const modulosNomes = MODULOS_APP.filter((m) => (app.modulosIds || []).includes(m.id)).map((m) => m.label);

              return (
                <div
                  key={app.id}
                  className={`bg-card rounded-2xl border ${
                    app.ativo ? "border-line" : "border-amber-200 bg-amber-50/20"
                  } p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between`}
                >
                  <div>
                    {/* TOPO DO CARD */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-xs shrink-0"
                          style={{ backgroundColor: `${app.cor || "#047857"}18` }}
                        >
                          {renderIcone(app.icone, app.cor, 24)}
                        </div>
                        <div>
                          <h3 className="font-black text-base text-slate-800 leading-tight">{app.nome}</h3>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                            @{app.login}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => alternarStatus(app)}
                        title={app.ativo ? "Pausar App" : "Ativar App"}
                        className={`px-2.5 py-1 rounded-full text-3xs font-black uppercase tracking-wider transition ${
                          app.ativo
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                        }`}
                      >
                        {app.ativo ? "🟢 Ativo" : "⏸️ Pausado"}
                      </button>
                    </div>

                    {/* DADOS DE CREDENCIAIS (LOGIN & SENHA) */}
                    <div className="bg-slate-50 border border-line-soft rounded-xl p-3 mb-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-subtle font-medium">Login do App:</span>
                        <span className="font-mono font-bold text-slate-800">{app.login}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-line-soft">
                        <span className="text-subtle font-medium">Senha de Acesso:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">
                            {senhaVisivel ? app.senha : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSenhasVisiveis((prev) => ({ ...prev, [app.id]: !prev[app.id] }))
                            }
                            className="text-subtle hover:text-slate-800 p-0.5"
                          >
                            {senhaVisivel ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copiarLoginSenha(app)}
                            title="Copiar login e senha"
                            className="text-subtle hover:text-emerald-700 p-0.5"
                          >
                            {copiadoId === app.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* MÓDULOS LIBERADOS */}
                    <div className="mb-4">
                      <p className="text-3xs uppercase font-extrabold tracking-widest text-subtle mb-1.5">
                        O que este app enxerga:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {modulosNomes.map((nome, i) => (
                          <span
                            key={i}
                            className="text-3xs font-bold px-2 py-0.5 rounded-md bg-white border border-line text-slate-700"
                          >
                            {nome}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* TELA INICIAL */}
                    <div className="mb-4 text-xs">
                      <span className="text-subtle font-medium">Abre direto em: </span>
                      <span className="font-bold text-slate-700 font-mono text-3xs bg-white px-2 py-0.5 rounded border border-line">
                        {app.telaInicial || "/dashboard"}
                      </span>
                    </div>
                  </div>

                  {/* AÇÕES NO RODAPÉ */}
                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setAppTrocaSenha(app);
                        setNovaSenha("");
                        setModalSenhaAberto(true);
                      }}
                      className="text-xs font-bold text-subtle hover:text-emerald-700 flex items-center gap-1 p-1"
                    >
                      <Key size={14} /> Trocar Senha
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEditarApp(app)}
                        title="Editar módulos e permissões"
                        className="p-1.5 text-subtle hover:text-slate-800 rounded-lg hover:bg-slate-100"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => excluirApp(app)}
                        title="Excluir este app"
                        className="p-1.5 text-subtle hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════ ABA 2: AUDITORIA & ACESSOS EM TEMPO REAL ════════════════ */}
      {abaAtiva === "auditoria" && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS E BUSCA */}
          <div className="bg-card rounded-2xl border border-line p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3 top-3 text-subtle" />
              <input
                type="text"
                value={buscaAudit}
                onChange={(e) => setBuscaAudit(e.target.value)}
                placeholder="Buscar por app, login, IP, aparelho..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-line rounded-xl text-sm font-semibold outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filtroAppAudit}
                onChange={(e) => setFiltroAppAudit(e.target.value)}
                className="p-2 bg-white border border-line rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="todos">Todos os Apps</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.login}>
                    {a.nome} (@{a.login})
                  </option>
                ))}
              </select>

              <button
                onClick={carregar}
                disabled={carregando}
                className="p-2 rounded-xl border border-line hover:bg-slate-100 text-subtle transition flex items-center gap-1 text-xs font-bold shrink-0"
              >
                <RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar
              </button>
            </div>
          </div>

          {/* FEED E TABELA DE LOGS */}
          <div className="bg-card rounded-2xl border border-line overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-line text-3xs font-extrabold uppercase tracking-widest text-subtle">
                    <th className="py-3 px-4">Horário do Acesso</th>
                    <th className="py-3 px-4">App &amp; Login</th>
                    <th className="py-3 px-4">Localização &amp; Unidade</th>
                    <th className="py-3 px-4">Aparelho / Dispositivo</th>
                    <th className="py-3 px-4">IP / Conexão</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft font-medium">
                  {logsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-subtle font-bold">
                        Nenhum registro de acesso encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    logsFiltrados.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* HORÁRIO */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-800 text-xs">
                            {log.horarioFormatado || new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                          </div>
                          <div className="text-3xs text-subtle">
                            {tempoRelativo(log.timestamp)} · {log.dataFormatada || new Date(log.timestamp).toLocaleDateString("pt-BR")}
                          </div>
                        </td>

                        {/* APP E LOGIN */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            {log.app_nome}
                          </div>
                          <div className="text-3xs text-emerald-700 font-bold font-mono">
                            @{log.login}
                          </div>
                        </td>

                        {/* LOCAL */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                            <MapPin size={14} className="text-emerald-600 shrink-0" />
                            {log.local || "Loja Matriz"}
                          </div>
                          <div className="text-3xs text-subtle ml-5">
                            {log.detalhes || "Operação diária"}
                          </div>
                        </td>

                        {/* APARELHO */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold">
                            {log.tipoTela === "Tablet" ? (
                              <Tablet size={14} className="text-indigo-600 shrink-0" />
                            ) : (
                              <Laptop size={14} className="text-slate-600 shrink-0" />
                            )}
                            {log.dispositivo || "Tablet Operacional"}
                          </div>
                          <div className="text-3xs text-subtle ml-5">{log.navegador || "Chrome"}</div>
                        </td>

                        {/* IP */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-line">
                            {log.ip || "Rede Local"}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {log.sucesso ? (
                            <span className="inline-flex items-center gap-1 text-3xs font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle size={12} /> Conectado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-3xs font-extrabold uppercase px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle size={12} /> Bloqueado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: CRIAR / EDITAR APP ════════════════ */}
      {modalAppAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl border border-line shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-5 border-b border-line flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-lg text-slate-800">
                  {appEmEdicao ? `Editar ${form.nome}` : "Criar Novo App / Estação"}
                </h3>
                <p className="text-xs text-subtle">
                  Defina o login, a senha e exatamente quais telas este aparelho poderá acessar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAppAberto(false)}
                className="text-subtle hover:text-slate-800 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={salvarApp} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-3xs uppercase font-extrabold tracking-widest text-subtle mb-1 block">
                    Nome da Estação / App
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: App Cozinha Tablet 01"
                    className="w-full p-2.5 bg-white border border-line rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-3xs uppercase font-extrabold tracking-widest text-subtle mb-1 block">
                    Unidade de Operação
                  </label>
                  <select
                    value={form.unidade_id}
                    onChange={(e) => setForm({ ...form, unidade_id: e.target.value })}
                    className="w-full p-2.5 bg-white border border-line rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="matriz">Unidade Matriz</option>
                    {(unidades || [])
                      .filter((u) => u.id !== "todas" && u.id !== "matriz")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-3xs uppercase font-extrabold tracking-widest text-subtle mb-1 block">
                    Login do App (Usuário)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.login}
                    onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase().trim() })}
                    placeholder="Ex: cozinha ou bar_loja1"
                    className="w-full p-2.5 bg-white border border-line rounded-xl font-mono font-bold text-sm text-slate-800 outline-none focus:border-emerald-500"
                  />
                  <span className="text-3xs text-subtle">Usado para entrar na tela de login</span>
                </div>

                <div>
                  <label className="text-3xs uppercase font-extrabold tracking-widest text-subtle mb-1 block">
                    Senha de Acesso
                  </label>
                  <input
                    type="text"
                    required
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    placeholder="Ex: 1234 ou senha_cozinha"
                    className="w-full p-2.5 bg-white border border-line rounded-xl font-mono font-bold text-sm text-slate-800 outline-none focus:border-emerald-500"
                  />
                  <span className="text-3xs text-subtle">Senha fixa configurada pelo dono</span>
                </div>
              </div>

              {/* SELEÇÃO DO QUE O APP VÊ */}
              <div className="pt-2 border-t border-line">
                <label className="text-xs uppercase font-black tracking-wider text-slate-800 mb-2 block flex items-center justify-between">
                  <span>Escolha o que este App enxerga (Módulos &amp; Telas):</span>
                  <span className="text-3xs text-emerald-700 font-bold">
                    {form.modulosIds.length} selecionado(s)
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                  {MODULOS_APP.map((mod) => {
                    const ativo = form.modulosIds.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleModulo(mod.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                          ativo
                            ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                            : "border-line bg-white hover:bg-slate-50 opacity-70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ativo}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                            {renderIcone(mod.icone, mod.cor, 16)}
                            <span className="truncate">{mod.label}</span>
                          </div>
                          <p className="text-3xs text-subtle mt-0.5 leading-snug">{mod.descricao}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TELA INICIAL */}
              <div>
                <label className="text-3xs uppercase font-extrabold tracking-widest text-subtle mb-1 block">
                  Tela Inicial (onde o app abre após o login)
                </label>
                <select
                  value={form.telaInicial}
                  onChange={(e) => setForm({ ...form, telaInicial: e.target.value })}
                  className="w-full p-2.5 bg-white border border-line rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-emerald-500"
                >
                  <option value="/dashboard/operacao/inteligente">Central KDS Cozinha / Bar (/dashboard/operacao/inteligente)</option>
                  <option value="/dashboard/salao/mesas">Mapa de Mesas Salão (/dashboard/salao/mesas)</option>
                  <option value="/dashboard/operacao/estoque">Painel de Estoque (/dashboard/operacao/estoque)</option>
                  <option value="/dashboard/ponto">Quiosque de Bater Ponto (/dashboard/ponto)</option>
                  <option value="/dashboard/vendas">Frente de Caixa (/dashboard/vendas)</option>
                  <option value="/dashboard/assistente">Tablet Green Dot Assist (/dashboard/assistente)</option>
                  <option value="/dashboard">Painel Geral do Dono (/dashboard)</option>
                </select>
              </div>

              {/* BOTÕES */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAppAberto(false)}
                  className="px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-subtle hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition active:scale-[0.98] shadow-sm"
                >
                  Salvar App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: TROCAR SENHA RÁPIDA ════════════════ */}
      {modalSenhaAberto && appTrocaSenha && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-line shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-line bg-slate-50 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-800">Trocar Senha de {appTrocaSenha.nome}</h3>
              <button
                type="button"
                onClick={() => setModalSenhaAberto(false)}
                className="text-subtle hover:text-slate-800 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={salvarNovaSenha} className="p-5 space-y-4">
              <div>
                <label className="text-3xs uppercase font-extrabold tracking-widest text-subtle mb-1 block">
                  Nova Senha para @{appTrocaSenha.login}
                </label>
                <input
                  type="text"
                  required
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="w-full p-2.5 bg-white border border-line rounded-xl font-mono font-bold text-sm text-slate-800 outline-none focus:border-emerald-500"
                  autoFocus
                />
                <span className="text-3xs text-subtle mt-1 block">
                  A nova senha passa a valer imediatamente no tablet.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setModalSenhaAberto(false)}
                  className="px-3.5 py-2 rounded-xl border border-line text-xs font-bold text-subtle hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition active:scale-[0.98]"
                >
                  Confirmar Troca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
