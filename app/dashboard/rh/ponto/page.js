"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock, Search, ArrowLeft, CheckCircle2, LogIn, LogOut, Coffee, Undo2,
  AlertTriangle, Maximize, Loader2, Hourglass
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { useRouter } from "next/navigation";
import { fetchColaboradores, inserirBancoHoras, fetchBancoHorasColaborador, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN } from "../../../lib/rh";
import { fetchPontoHoje, fetchHistoricoPonto, registrarBatida, pularIntervalo } from "../../../lib/ponto";

const fmtMin = (m) => `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`;
const horaDe = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

// Próxima batida com base no que já foi registrado hoje
function proximaEtapa(reg) {
  if (!reg || !reg.hora_entrada) return "entrada";
  if (reg.status_jornada === 3 && !reg.hora_retorno_intervalo && !reg.hora_saida_intervalo) return "saida_trabalho"; // pulou intervalo
  if (!reg.hora_saida_intervalo) return "saida_intervalo";
  if (!reg.hora_retorno_intervalo) return "retorno_intervalo";
  if (!reg.hora_saida) return "saida_trabalho";
  return "concluido";
}

const ETAPAS = [
  { id: "entrada", label: "Entrada", icon: LogIn, campo: "hora_entrada" },
  { id: "saida_intervalo", label: "Saída p/ Intervalo", icon: Coffee, campo: "hora_saida_intervalo" },
  { id: "retorno_intervalo", label: "Volta do Intervalo", icon: Undo2, campo: "hora_retorno_intervalo" },
  { id: "saida_trabalho", label: "Saída do Trabalho", icon: LogOut, campo: "hora_saida" },
];

export default function PontoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();

  const [colaboradores, setColaboradores] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [horaLocal, setHoraLocal] = useState(new Date());

  // Funcionário selecionado (tela de bater ponto)
  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [bancoMes, setBancoMes] = useState([]);
  const [batendo, setBatendo] = useState(false);
  const [sucesso, setSucesso] = useState(null); // { titulo, detalhe }

  const carregar = useCallback(async () => {
    setLoading(true);
    const [rColab, rPontos] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
    ]);
    setColaboradores((rColab.data || []).filter(c => (c.status || "ativo") !== "inativo"));
    setPontosHoje(rPontos.data || []);
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => {
    if (unidadeAtiva) carregar();
    const t = setInterval(() => setHoraLocal(new Date()), 1000);
    return () => clearInterval(t);
  }, [unidadeAtiva, carregar]);

  const registroDe = (colabId) => pontosHoje.find(p => p.colaborador_id === colabId) || null;

  // Abre a tela do funcionário: histórico de 7 dias + banco de horas do mês
  const abrirFuncionario = async (c) => {
    setSelecionado(c);
    setBusca("");
    const mes = new Date().toISOString().slice(0, 7);
    const [rHist, rBanco] = await Promise.all([
      fetchHistoricoPonto(c.id),
      fetchBancoHorasColaborador(c.id, mes),
    ]);
    setHistorico(rHist.data || []);
    setBancoMes(rBanco.data || []);
  };

  const totalBancoMes = bancoMes.reduce((s, b) => s + (Number(b.minutos) || 0), 0);
  const intervaloPadrao = selecionado ? (Number(selecionado.tempo_intervalo) || 60) : 60;

  // Credita minutos no banco respeitando o teto de 8h/mês
  const creditarBanco = async (minutos, motivo) => {
    const restante = BANCO_LIMITE_MIN - totalBancoMes;
    if (restante <= 0) {
      return { creditado: 0, aviso: `Banco de horas já está no limite de 8h — os ${fmtMin(minutos)} NÃO foram creditados. Avise o gestor!` };
    }
    const credito = Math.min(minutos, restante);
    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await inserirBancoHoras(unidadeAtiva, selecionado.id, hoje, credito, motivo);
    if (error) return { creditado: 0, aviso: "Falha ao creditar no banco de horas: " + error };
    let aviso = "";
    if (credito < minutos) aviso = `Só ${fmtMin(credito)} creditados — o banco atingiu o limite de 8h no mês.`;
    else if (totalBancoMes + credito >= BANCO_ALERTA_MIN) aviso = `Banco de horas chegou a ${fmtMin(totalBancoMes + credito)} — perto do limite de 8h. Programe a folga!`;
    return { creditado: credito, aviso };
  };

  const mostrarSucesso = (titulo, detalhe) => {
    setSucesso({ titulo, detalhe });
    setTimeout(() => { setSucesso(null); setSelecionado(null); carregar(); }, 4000);
  };

  // Bater a próxima etapa do ponto
  const bater = async () => {
    if (batendo) return;
    const reg = registroDe(selecionado.id);
    const etapa = proximaEtapa(reg);
    if (etapa === "concluido") return;
    setBatendo(true);
    try {
      const { error } = await registrarBatida(selecionado.id, unidadeAtiva, etapa);
      if (error) { alert(error); return; }

      const agoraStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const primeiro = selecionado.nome.split(" ")[0];

      // Volta do intervalo: se tirou menos que o padrão, a diferença vai pro banco
      if (etapa === "retorno_intervalo" && reg?.hora_saida_intervalo) {
        const tirou = Math.round((Date.now() - new Date(reg.hora_saida_intervalo).getTime()) / 60000);
        const faltou = intervaloPadrao - tirou;
        if (faltou >= 1) {
          const { creditado, aviso } = await creditarBanco(
            faltou,
            `Intervalo de ${tirou}min em vez de ${intervaloPadrao}min (automático do ponto)`
          );
          mostrarSucesso(
            `Volta registrada às ${agoraStr}`,
            `${primeiro}, você tirou ${tirou} min de intervalo. ${creditado > 0 ? `${fmtMin(creditado)} foram para o seu banco de horas.` : ""} ${aviso}`
          );
          return;
        }
      }

      const msgs = {
        entrada: `Bom trabalho, ${primeiro}!`,
        saida_intervalo: `Bom intervalo, ${primeiro}!`,
        retorno_intervalo: `Bem-vindo de volta, ${primeiro}!`,
        saida_trabalho: `Até logo, ${primeiro}!`,
      };
      mostrarSucesso(`${ETAPAS.find(e => e.id === etapa)?.label} às ${agoraStr}`, msgs[etapa] || "");
    } finally {
      setBatendo(false);
    }
  };

  // "Não vou conseguir tirar o intervalo hoje" → 1h inteira vai pro banco
  const naoTirarIntervalo = async () => {
    if (!confirm(`${selecionado.nome.split(" ")[0]}, confirma que você NÃO vai tirar o intervalo de ${fmtMin(intervaloPadrao)} hoje?\n\nEsse tempo vai para o seu banco de horas.`)) return;
    setBatendo(true);
    try {
      const { error } = await pularIntervalo(selecionado.id);
      if (error) { alert(error); return; }
      const { creditado, aviso } = await creditarBanco(intervaloPadrao, "Intervalo não tirado (registrado no ponto)");
      mostrarSucesso(
        "Intervalo não tirado — registrado!",
        `${creditado > 0 ? `${fmtMin(creditado)} creditados no seu banco de horas.` : ""} ${aviso}`
      );
    } finally {
      setBatendo(false);
    }
  };

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="fixed inset-0 z-[9999] bg-emerald-600 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
        <div className="w-28 h-28 bg-white rounded-[32px] flex items-center justify-center mb-8 shadow-2xl">
          <CheckCircle2 size={64} className="text-emerald-600" />
        </div>
        <h1 className="text-white font-black text-4xl md:text-6xl tracking-tight max-w-3xl">{sucesso.titulo}</h1>
        {sucesso.detalhe && <p className="text-emerald-100 font-bold text-lg md:text-2xl mt-5 max-w-2xl leading-relaxed">{sucesso.detalhe}</p>}
      </div>
    );
  }

  const containerRef = useRef(null);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // ── Tela do funcionário (bater ponto) ─────────────────────────────────────
  if (selecionado) {
    const reg = registroDe(selecionado.id);
    const etapa = proximaEtapa(reg);
    const etapaInfo = ETAPAS.find(e => e.id === etapa);
    const pulouIntervalo = reg?.status_jornada === 3 && !reg?.hora_saida_intervalo;

    return (
      <div ref={containerRef} className="fixed inset-0 z-[9999] bg-slate-950 overflow-y-auto font-sans">
        <div className="max-w-3xl mx-auto p-6 md:p-10">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => setSelecionado(null)} className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-colors">
              <ArrowLeft size={18} /> Voltar
            </button>
            <div className="text-right">
              <p className="text-4xl font-black text-white tabular-nums">{horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
            </div>
          </div>

          {/* Identificação */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-3xl font-black text-emerald-400 shrink-0">
              {selecionado.nome[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black text-white truncate">{selecionado.nome}</h2>
              <p className="text-slate-400 font-bold text-sm">{selecionado.cargo || "—"} · {unidadeInfo?.nome}</p>
            </div>
            <div className={`text-right px-4 py-2 rounded-2xl border shrink-0 ${totalBancoMes >= BANCO_LIMITE_MIN ? "bg-red-500/10 border-red-500/40" : totalBancoMes >= BANCO_ALERTA_MIN ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-800 border-slate-700"}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Hourglass size={10} /> Banco de horas</p>
              <p className={`text-xl font-black ${totalBancoMes >= BANCO_LIMITE_MIN ? "text-red-400" : totalBancoMes >= BANCO_ALERTA_MIN ? "text-amber-400" : "text-white"}`}>{fmtMin(totalBancoMes)} <span className="text-xs text-slate-500">/ 8h</span></p>
            </div>
          </div>

          {/* Linha do dia: as 4 batidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {ETAPAS.map(e => {
              const hora = horaDe(reg?.[e.campo]);
              const puladoAqui = pulouIntervalo && (e.id === "saida_intervalo" || e.id === "retorno_intervalo");
              const ativa = e.id === etapa;
              return (
                <div key={e.id} className={`p-4 rounded-2xl border text-center ${hora ? "bg-emerald-500/10 border-emerald-500/40" : puladoAqui ? "bg-amber-500/10 border-amber-500/30" : ativa ? "bg-slate-800 border-slate-500 border-dashed" : "bg-slate-900 border-slate-800"}`}>
                  <e.icon size={18} className={`mx-auto mb-1.5 ${hora ? "text-emerald-400" : puladoAqui ? "text-amber-400" : "text-slate-500"}`} />
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{e.label}</p>
                  <p className={`text-lg font-black mt-0.5 ${hora ? "text-emerald-400" : puladoAqui ? "text-amber-400 text-xs leading-tight" : "text-slate-600"}`}>
                    {hora || (puladoAqui ? "não tirado" : "--:--")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Ação principal */}
          {etapa === "concluido" ? (
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-3xl p-8 text-center mb-6">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-xl font-black text-white">Jornada de hoje concluída!</p>
              <p className="text-slate-400 font-bold text-sm mt-1">Todas as batidas foram registradas.</p>
            </div>
          ) : (
            <button onClick={bater} disabled={batendo}
              className="w-full py-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-3xl font-black text-2xl md:text-3xl transition-all active:scale-[0.98] shadow-2xl shadow-emerald-600/30 flex items-center justify-center gap-4 mb-4">
              {batendo ? <Loader2 size={30} className="animate-spin" /> : etapaInfo && <etapaInfo.icon size={30} />}
              Bater: {etapaInfo?.label}
            </button>
          )}

          {/* Não vou tirar intervalo — só aparece na etapa certa */}
          {etapa === "saida_intervalo" && (
            <button onClick={naoTirarIntervalo} disabled={batendo}
              className="w-full py-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-2xl font-black text-base transition-colors flex items-center justify-center gap-2 mb-6">
              <AlertTriangle size={18} /> Não vou conseguir tirar o intervalo hoje ({fmtMin(intervaloPadrao)} vai pro banco de horas)
            </button>
          )}

          {/* Histórico: últimos 7 dias */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><Clock size={12} /> Últimos dias</p>
            {historico.length === 0 ? (
              <p className="text-sm font-medium text-slate-600">Sem registros anteriores.</p>
            ) : (
              <div className="space-y-1.5">
                {historico.map(h => (
                  <div key={h.id} className="grid grid-cols-[70px_1fr_1fr_1fr_1fr] gap-2 items-center text-center py-1.5 px-2 rounded-lg bg-slate-950/60">
                    <span className="text-[11px] font-black text-slate-400 text-left">{h.data_referencia?.slice(5).split("-").reverse().join("/")}</span>
                    {["hora_entrada", "hora_saida_intervalo", "hora_retorno_intervalo", "hora_saida"].map(c => (
                      <span key={c} className={`text-xs font-bold ${h[c] ? "text-slate-200" : "text-slate-700"}`}>{horaDe(h[c]) || "--:--"}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {bancoMes.length > 0 && (
              <p className="text-[10px] font-bold text-slate-500 mt-3">
                Banco de horas no mês: {bancoMes.length} lançamento(s) somando <span className={totalBancoMes >= BANCO_ALERTA_MIN ? "text-amber-400" : "text-emerald-400"}>{fmtMin(totalBancoMes)}</span>. O espelho completo é impresso pelo RH.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Tela inicial: relógio + busca do nome ─────────────────────────────────
  const filtrados = colaboradores.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] bg-slate-950 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto p-6 md:p-10">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-colors">
            <ArrowLeft size={18} /> Painel
          </button>
          <button onClick={toggleFullscreen} className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-colors" title="Tela cheia">
            <Maximize size={20} />
          </button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-7xl md:text-8xl font-black text-white tabular-nums tracking-tight">
            {horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            <span className="text-2xl text-slate-600 ml-2">{String(horaLocal.getSeconds()).padStart(2, "0")}</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest mt-2">
            {horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {unidadeInfo?.nome}
          </p>
        </div>

        {/* Busca do nome */}
        <div className="relative mb-6">
          <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Digite seu nome para bater o ponto..."
            className="w-full pl-14 pr-5 py-5 bg-slate-900 border-2 border-slate-800 focus:border-emerald-500 rounded-3xl text-white text-xl font-bold outline-none placeholder:text-slate-600 transition-colors"
            autoFocus
          />
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 size={40} className="animate-spin text-slate-600 mx-auto" /></div>
        ) : filtrados.length === 0 ? (
          <p className="text-center text-slate-600 font-bold py-12">{colaboradores.length === 0 ? "Nenhum colaborador cadastrado no RH." : "Nenhum nome encontrado."}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtrados.map(c => {
              const reg = registroDe(c.id);
              const etapa = proximaEtapa(reg);
              const concluido = etapa === "concluido";
              return (
                <button key={c.id} onClick={() => abrirFuncionario(c)}
                  className={`p-5 rounded-3xl border-2 text-left transition-all hover:-translate-y-1 ${concluido ? "bg-slate-900/40 border-slate-800 opacity-60" : "bg-slate-900 border-slate-800 hover:border-emerald-500/60"}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center text-lg font-black text-emerald-400 shrink-0">{c.nome[0].toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="font-black text-white truncate">{c.nome.split(" ").slice(0, 2).join(" ")}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{c.cargo || "—"}</p>
                    </div>
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${concluido ? "bg-emerald-500/10 text-emerald-500" : reg?.hora_entrada ? "bg-sky-500/10 text-sky-400" : "bg-slate-800 text-slate-500"}`}>
                    {concluido ? <><CheckCircle2 size={11} /> Jornada concluída</> : reg?.hora_entrada ? <><Clock size={11} /> Próx: {ETAPAS.find(e => e.id === etapa)?.label}</> : <><LogIn size={11} /> Aguardando entrada</>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
