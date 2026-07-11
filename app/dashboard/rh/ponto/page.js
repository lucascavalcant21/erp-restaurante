"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock, Search, ArrowLeft, CheckCircle2, LogIn, LogOut, Coffee, Undo2,
  AlertTriangle, Maximize, Loader2, Hourglass, Ban, Timer, X, Lock, Tablet
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { useRouter } from "next/navigation";
import { fetchColaboradores, inserirBancoHoras, fetchBancoHorasColaborador, somaMinutosBanco, fetchAllFolgasDaUnidade, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN } from "../../../lib/rh";
import { fetchPontoHoje, fetchHistoricoPonto, registrarBatida, pularIntervalo } from "../../../lib/ponto";

const fmtMin = (m) => `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`;
const horaDe = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
const strToMin = (hhmm) => { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Só pode bater a ENTRADA a partir de X min antes do horário (contagem regressiva)
const TOLERANCIA_ENTRADA_MIN = 2;
// Passou X min do horário de entrada sem bater: bloqueia e conta como falta
const LIMITE_ATRASO_MIN = 60;
// Tolerâncias de marcação (Súmula 366 TST) — aplicadas por dentro, SEM exibir
// ao funcionário: entrada/saída até 5 min gravam o horário do turno (8h05→8h;
// 8h06 já grava real + atraso); volta do intervalo até 2 min grava a prevista.
const TOLERANCIA_MARCACAO_MIN = 5;
const TOLERANCIA_RETORNO_MIN = 2;

// Data de hoje (ou da base) com o horário HH:MM
function comHora(base, hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
// PIN do gerente para liberar a entrada bloqueada por atraso
const PIN_GERENTE = "1234";

// Teclado de PIN (libera entrada atrasada ou destrava o modo tablet)
function ModalPinGerente({ onSuccess, onClose, titulo = "PIN do Gerente", subtitulo = "Autorizar entrada fora do horário" }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const digito = (d) => {
    if (pin.length >= 4) return;
    const novo = pin + d;
    setPin(novo);
    if (novo.length === 4) {
      setTimeout(() => {
        if (novo === PIN_GERENTE) onSuccess();
        else { setErro("PIN incorreto"); setPin(""); }
      }, 150);
    }
  };
  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xs text-center">
        <p className="text-lg font-black text-white">{titulo}</p>
        <p className="text-slate-400 font-medium text-xs mb-5">{subtitulo}</p>
        <div className="flex gap-3 justify-center mb-5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? "bg-emerald-400" : "bg-slate-700"}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((d, i) => (
            <button key={i} disabled={d === ""}
              onClick={() => d === "⌫" ? setPin(p => p.slice(0, -1)) : d !== "" && digito(String(d))}
              className={`h-14 rounded-xl text-xl font-black transition-colors ${d === "" ? "invisible" : d === "⌫" ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-800 text-white hover:bg-slate-700"}`}>
              {d}
            </button>
          ))}
        </div>
        {erro && <p className="text-red-400 text-xs font-bold mb-2">{erro}</p>}
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs font-bold">Cancelar</button>
      </div>
    </div>
  );
}

// Mensagens prontas para justificar (voltar antes do intervalo ou não tirar)
const MOTIVOS_RAPIDOS = [
  "Movimento alto, precisei ficar",
  "A pedido da gerência",
  "Por conta própria, estava tranquilo",
];

// Categorias de função para agrupar os cards
const ORDEM_CATEGORIAS = ["Liderança", "Cozinha", "Bar", "Salão", "Outros"];
function categoriaFuncao(cargo) {
  const c = (cargo || "").toLowerCase();
  if (/(cozinh|chapeir|confeit|pizzai|sushi|salgad|padeir|churrasqueir|a[cç]ougue|chefe de fila|copa)/.test(c)) return "Cozinha";
  if (/(\bbar\b|barman|bartender|barista|drinks)/.test(c)) return "Bar";
  if (/(gar[çc]|atendente|sal[aã]o|recep|hostess|maitre|maître|caixa|comand)/.test(c)) return "Salão";
  if (/(gerente|supervisor|\bceo\b|coordenad|encarregad|gestor|propriet|diretor|s[oó]cio)/.test(c)) return "Liderança";
  return "Outros";
}

// Próxima batida com base no que já foi registrado hoje.
// ORDEM IMPORTA: a saída final encerra o dia mesmo sem horários de intervalo
// (quem pulou o intervalo), senão o sistema voltava a pedir "saída p/ intervalo".
function proximaEtapa(reg) {
  if (!reg || !reg.hora_entrada) return "entrada";
  if (reg.hora_saida) return "concluido"; // dia encerrado (com ou sem intervalo)
  if (reg.status_jornada >= 3 && !reg.hora_retorno_intervalo && !reg.hora_saida_intervalo) return "saida_trabalho"; // pulou intervalo
  if (!reg.hora_saida_intervalo) return "saida_intervalo";
  if (!reg.hora_retorno_intervalo) return "retorno_intervalo";
  return "saida_trabalho";
}

const ETAPAS = [
  { id: "entrada", label: "Entrada", icon: LogIn, campo: "hora_entrada" },
  { id: "saida_intervalo", label: "Saída p/ Intervalo", icon: Coffee, campo: "hora_saida_intervalo" },
  { id: "retorno_intervalo", label: "Volta do Intervalo", icon: Undo2, campo: "hora_retorno_intervalo" },
  { id: "saida_trabalho", label: "Saída do Trabalho", icon: LogOut, campo: "hora_saida" },
];

// Horário de entrada do dia (usa o de domingo quando for domingo)
function entradaDoDia(c, base) {
  if (!c) return null;
  const dom = base.getDay() === 0;
  return (dom ? (c.horario_dom_entrada || c.horario_entrada) : c.horario_entrada) || null;
}

// Está de folga hoje? (folga semanal via dias_trabalho + folga esporádica)
function folgaHoje(c, folgas, base) {
  const diasStr = String(c?.dias_trabalho || "").trim();
  if (diasStr) {
    const dias = diasStr.split(",").map(s => s.trim()).filter(Boolean);
    if (dias.length && !dias.includes(String(base.getDay()))) {
      return { folga: true, motivo: "Folga semanal" };
    }
  }
  const hoje = isoLocal(base);
  const esp = (folgas || []).find(f => f.colaborador_id === c?.id && String(f.data_folga).slice(0, 10) === hoje);
  if (esp) return { folga: true, motivo: esp.descricao ? `Folga programada — ${esp.descricao}` : "Folga programada" };
  return { folga: false };
}

// Modal de justificativa (3 opções prontas + texto livre)
function ModalJustificativa({ titulo, subtitulo, onConfirm, onClose, confirmando }) {
  const [texto, setTexto] = useState("");
  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-xl font-black text-white">{titulo}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={20} /></button>
        </div>
        <p className="text-slate-400 font-medium text-sm mb-4">{subtitulo}</p>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Toque em um motivo (rápido)</p>
        <div className="space-y-2 mb-4">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button key={m} disabled={confirmando} onClick={() => onConfirm(m)}
              className="w-full text-left px-4 py-3 rounded-2xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 font-bold transition-colors disabled:opacity-50">
              {m}
            </button>
          ))}
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Ou escreva o motivo</p>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2}
          placeholder="Motivo..." className="w-full p-3 bg-slate-800 border border-slate-700 rounded-2xl text-white font-medium outline-none focus:border-emerald-500 resize-none mb-3" />
        <button disabled={confirmando || !texto.trim()} onClick={() => onConfirm(texto.trim())}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black flex items-center justify-center gap-2">
          {confirmando ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Confirmar
        </button>
      </div>
    </div>
  );
}

export default function PontoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();

  const [colaboradores, setColaboradores] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [folgas, setFolgas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [horaLocal, setHoraLocal] = useState(new Date());

  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [bancoMes, setBancoMes] = useState([]);
  const [batendo, setBatendo] = useState(false);
  const [sucesso, setSucesso] = useState(null); // { titulo, detalhe, tone }
  const [justif, setJustif] = useState(null);    // { tipo: 'retorno_cedo' | 'pular_intervalo', ... }
  const [liberados, setLiberados] = useState({}); // { [colabId]: true } — atraso liberado pelo gerente hoje
  const [pinAberto, setPinAberto] = useState(false);

  // ── MODO TABLET (quiosque): trava a tela do ponto; só sai com o PIN ────────
  // Persiste no aparelho: fechar/reabrir o app volta direto para cá.
  const [kiosk, setKiosk] = useState(false);
  const [pinSair, setPinSair] = useState(false);
  useEffect(() => {
    try { setKiosk(localStorage.getItem("hefisto_modo_ponto") === "1"); } catch {}
  }, []);
  const pedirFullscreen = () => {
    try { const p = containerRef.current?.requestFullscreen?.(); if (p && p.catch) p.catch(() => {}); } catch {}
  };
  const ativarKiosk = () => {
    try { localStorage.setItem("hefisto_modo_ponto", "1"); } catch {}
    setKiosk(true);
    pedirFullscreen();
  };
  const sairKiosk = () => {
    try { localStorage.removeItem("hefisto_modo_ponto"); } catch {}
    setKiosk(false);
    setPinSair(false);
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
    router.push("/dashboard");
  };
  // Qualquer toque tenta voltar à tela cheia (o navegador só permite com gesto)
  const reforcarFullscreen = () => {
    if (kiosk && typeof document !== "undefined" && !document.fullscreenElement) pedirFullscreen();
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    const [rColab, rPontos, rFolgas] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
      fetchAllFolgasDaUnidade(unidadeAtiva),
    ]);
    setColaboradores((rColab.data || []).filter(c => (c.status || "ativo") !== "inativo"));
    setPontosHoje(rPontos.data || []);
    setFolgas(rFolgas.data || []);
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => {
    if (unidadeAtiva) carregar();
    const t = setInterval(() => setHoraLocal(new Date()), 1000);
    return () => clearInterval(t);
  }, [unidadeAtiva, carregar]);

  const registroDe = (colabId) => pontosHoje.find(p => p.colaborador_id === colabId) || null;

  // Abre a tela do funcionário INSTANTANEAMENTE; histórico/banco carregam em segundo plano
  const abrirFuncionario = (c) => {
    setSelecionado(c);
    setBusca("");
    setHistorico([]);
    setBancoMes([]);
    const mes = new Date().toISOString().slice(0, 7);
    fetchHistoricoPonto(c.id).then(r => setHistorico(r.data || [])).catch(() => {});
    fetchBancoHorasColaborador(c.id, mes).then(r => setBancoMes(r.data || [])).catch(() => {});
  };

  const totalBancoMes = somaMinutosBanco(bancoMes);
  const intervaloPadrao = selecionado ? (Number(selecionado.tempo_intervalo) || 60) : 60;

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

  const mostrarSucesso = (titulo, detalhe, tone = "ok") => {
    setSucesso({ titulo, detalhe, tone });
    // Rápido: 2s no ok; alertas (têm mais texto) ganham um pouco mais
    setTimeout(() => { setSucesso(null); setSelecionado(null); carregar(); }, tone === "alerta" ? 3500 : 2000);
  };

  // Registra a batida de uma etapa. horaMarcada = hora ajustada pela tolerância
  // (grava e mostra o horário "cheio"); atrasoMin > 0 = entrada fora da tolerância.
  const executarBatida = async (etapa, reg, horaMarcada = null, atrasoMin = 0) => {
    setBatendo(true);
    try {
      const { error } = await registrarBatida(selecionado.id, unidadeAtiva, etapa, horaMarcada ? horaMarcada.toISOString() : null);
      if (error) { alert(error); return; }
      const agoraStr = (horaMarcada || new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const primeiro = selecionado.nome.split(" ")[0];

      // Volta do intervalo com tempo ACIMA do padrão (fora da tolerância): excesso
      if (etapa === "retorno_intervalo" && reg?.hora_saida_intervalo) {
        const base = horaMarcada ? horaMarcada.getTime() : Date.now();
        const tirou = Math.round((base - new Date(reg.hora_saida_intervalo).getTime()) / 60000);
        const passou = tirou - intervaloPadrao;
        if (passou >= 1) {
          const hoje = new Date().toISOString().split("T")[0];
          await inserirBancoHoras(unidadeAtiva, selecionado.id, hoje, passou,
            `Passou ${passou}min do intervalo (tirou ${tirou}min de ${intervaloPadrao}min)`, "excesso");
          mostrarSucesso("Atenção ao horário de intervalo!",
            `${primeiro}, você tirou ${fmtMin(tirou)} — ${passou} minuto(s) além do intervalo de ${fmtMin(intervaloPadrao)}. Ficou registrado no seu histórico.`,
            "alerta");
          return;
        }
      }

      // Entrada com atraso (fora da tolerância): mostra os minutos
      if (etapa === "entrada" && atrasoMin > 0) {
        mostrarSucesso(`Entrada às ${agoraStr}`, `${primeiro}, ${atrasoMin} min de atraso — ficou registrado no espelho.`, "alerta");
        return;
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

  // Ação principal de bater: aplica as tolerâncias (invisíveis pro funcionário)
  // e pede justificativa quando a volta do intervalo é antes da hora.
  const bater = async () => {
    if (batendo || !selecionado) return;
    const reg = registroDe(selecionado.id);
    const etapa = proximaEtapa(reg);
    if (etapa === "concluido") return;
    const agora = new Date();
    let horaMarcada = null;
    let atrasoMin = 0;

    // ENTRADA: até 5 min depois (ou adiantado, já liberado) grava o horário do turno
    if (etapa === "entrada") {
      const entradaStr = entradaDoDia(selecionado, agora);
      if (entradaStr) {
        const prevista = comHora(agora, entradaStr);
        const diffMin = (agora.getTime() - prevista.getTime()) / 60000;
        if (diffMin <= TOLERANCIA_MARCACAO_MIN) horaMarcada = prevista;
        else atrasoMin = Math.round(diffMin);
      }
    }

    // VOLTA DO INTERVALO: antes da hora → justificativa; até 2 min depois → hora prevista
    if (etapa === "retorno_intervalo" && reg?.hora_saida_intervalo) {
      const prevista = new Date(new Date(reg.hora_saida_intervalo).getTime() + intervaloPadrao * 60000);
      const diffMin = (agora.getTime() - prevista.getTime()) / 60000;
      if (diffMin < 0) {
        const tirou = Math.round((agora.getTime() - new Date(reg.hora_saida_intervalo).getTime()) / 60000);
        setJustif({ tipo: "retorno_cedo", tirou, faltou: intervaloPadrao - tirou });
        return;
      }
      if (diffMin <= TOLERANCIA_RETORNO_MIN) horaMarcada = prevista;
    }

    // SAÍDA DO TRABALHO: até 5 min de diferença do horário grava o horário do turno
    // (turnos que viram a meia-noite: testa a previsão em ±1 dia e usa a mais próxima)
    if (etapa === "saida_trabalho") {
      const dom = agora.getDay() === 0;
      const saidaStr = (dom ? (selecionado.horario_dom_saida || selecionado.horario_saida) : selecionado.horario_saida) || null;
      if (saidaStr) {
        const cands = [-1, 0, 1].map(d => { const c = comHora(agora, saidaStr); c.setDate(c.getDate() + d); return c; });
        const prevista = cands.reduce((a, b) => Math.abs(agora - b) < Math.abs(agora - a) ? b : a);
        if (Math.abs(agora.getTime() - prevista.getTime()) / 60000 <= TOLERANCIA_MARCACAO_MIN) horaMarcada = prevista;
      }
    }

    await executarBatida(etapa, reg, horaMarcada, atrasoMin);
  };

  // Confirma a justificativa (motivo escolhido ou digitado)
  const confirmarJustificativa = async (motivo) => {
    if (!justif || !selecionado) return;
    const j = justif;
    setBatendo(true);
    try {
      const primeiro = selecionado.nome.split(" ")[0];
      if (j.tipo === "retorno_cedo") {
        const { error } = await registrarBatida(selecionado.id, unidadeAtiva, "retorno_intervalo");
        if (error) { alert(error); return; }
        const { creditado, aviso } = await creditarBanco(j.faltou, `Voltou ${j.tirou}min de intervalo (de ${intervaloPadrao}min). Motivo: ${motivo}`);
        const agoraStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setJustif(null);
        mostrarSucesso(`Volta registrada às ${agoraStr}`,
          `${primeiro}, ${j.tirou} min de intervalo. ${creditado > 0 ? `${fmtMin(creditado)} foram pro seu banco de horas.` : ""} ${aviso}`);
      } else if (j.tipo === "pular_intervalo") {
        const { error } = await pularIntervalo(selecionado.id);
        if (error) { alert(error); return; }
        const { creditado, aviso } = await creditarBanco(intervaloPadrao, `Não tirou o intervalo. Motivo: ${motivo}`);
        setJustif(null);
        mostrarSucesso("Intervalo não tirado — registrado!",
          `${creditado > 0 ? `${fmtMin(creditado)} creditados no seu banco de horas.` : ""} ${aviso}`);
      }
    } finally {
      setBatendo(false);
    }
  };

  const containerRef = useRef(null);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // ── Tela de sucesso / alerta ───────────────────────────────────────────────
  if (sucesso) {
    const alerta = sucesso.tone === "alerta";
    return (
      <div className={`fixed inset-0 z-[9999] ${alerta ? "bg-amber-500" : "bg-emerald-600"} flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300`}>
        <div className="w-28 h-28 bg-white rounded-[32px] flex items-center justify-center mb-8 shadow-2xl">
          {alerta ? <AlertTriangle size={64} className="text-amber-500" /> : <CheckCircle2 size={64} className="text-emerald-600" />}
        </div>
        <h1 className="text-white font-black text-4xl md:text-6xl tracking-tight max-w-3xl">{sucesso.titulo}</h1>
        {sucesso.detalhe && <p className={`${alerta ? "text-amber-50" : "text-emerald-100"} font-bold text-lg md:text-2xl mt-5 max-w-2xl leading-relaxed`}>{sucesso.detalhe}</p>}
      </div>
    );
  }

  // ── Tela do funcionário (bater ponto) ─────────────────────────────────────
  if (selecionado) {
    const reg = registroDe(selecionado.id);
    const etapa = proximaEtapa(reg);
    const etapaInfo = ETAPAS.find(e => e.id === etapa);
    const pulouIntervalo = !!reg?.hora_entrada && !reg?.hora_saida_intervalo && (reg?.status_jornada >= 3 || !!reg?.hora_saida);

    // Travas da ENTRADA: folga e janela de horário
    const info = folgaHoje(selecionado, folgas, horaLocal);
    const entradaStr = entradaDoDia(selecionado, horaLocal);
    let janela = null; // { permiteEm: Date, faltaMs, atrasoMs }
    if (etapa === "entrada" && entradaStr) {
      const [hh, mm] = entradaStr.split(":").map(Number);
      const permiteEm = new Date(horaLocal);
      permiteEm.setHours(hh, mm - TOLERANCIA_ENTRADA_MIN, 0, 0);
      const faltaMs = permiteEm.getTime() - horaLocal.getTime();
      // Limite do atraso: depois disso não bate mais — conta como falta
      const limiteEm = new Date(horaLocal);
      limiteEm.setHours(hh, mm + LIMITE_ATRASO_MIN, 0, 0);
      const atrasoMs = horaLocal.getTime() - limiteEm.getTime();
      janela = { permiteEm, faltaMs, atrasoMs, entradaStr };
    }
    const bloqueiaFolga = etapa === "entrada" && info.folga;
    const bloqueiaJanela = etapa === "entrada" && janela && janela.faltaMs > 0;
    const bloqueiaAtraso = etapa === "entrada" && janela && janela.atrasoMs > 0 && !liberados[selecionado.id];
    const podeBater = etapa !== "concluido" && !bloqueiaFolga && !bloqueiaJanela && !bloqueiaAtraso;

    const fmtFalta = (ms) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    return (
      <div ref={containerRef} className="fixed inset-0 z-[9999] bg-slate-950 overflow-y-auto font-sans">
        {pinAberto && (
          <ModalPinGerente
            onClose={() => setPinAberto(false)}
            onSuccess={() => {
              setLiberados(prev => ({ ...prev, [selecionado.id]: true }));
              setPinAberto(false);
            }}
          />
        )}
        {justif && (
          <ModalJustificativa
            titulo={justif.tipo === "pular_intervalo" ? "Não vai tirar o intervalo?" : `Voltando ${justif.tirou}min de intervalo`}
            subtitulo={justif.tipo === "pular_intervalo"
              ? `O intervalo de ${fmtMin(intervaloPadrao)} vai pro seu banco de horas. Diga o porquê:`
              : `Faltam ${justif.faltou}min para completar ${fmtMin(intervaloPadrao)}. Diga o porquê de voltar antes:`}
            confirmando={batendo}
            onConfirm={confirmarJustificativa}
            onClose={() => setJustif(null)}
          />
        )}

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
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight break-words">{selecionado.nome}</h2>
              <p className="text-slate-400 font-bold text-sm">{selecionado.cargo || "—"} · {unidadeInfo?.nome}</p>
              {entradaStr && <p className="text-slate-500 font-bold text-xs mt-0.5">Horário de entrada: {entradaStr}{selecionado.horario_saida ? ` — ${selecionado.horario_saida}` : ""}</p>}
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

          {/* EM INTERVALO: contagem regressiva até a hora de voltar */}
          {etapa === "retorno_intervalo" && reg?.hora_saida_intervalo && (() => {
            const prevista = new Date(new Date(reg.hora_saida_intervalo).getTime() + intervaloPadrao * 60000);
            const resta = prevista.getTime() - horaLocal.getTime();
            const estourou = resta <= 0;
            return (
              <div className={`rounded-3xl p-6 text-center mb-4 border ${estourou ? "bg-rose-500/10 border-rose-500/40" : "bg-amber-500/10 border-amber-500/30"}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${estourou ? "text-rose-300" : "text-amber-300"}`}>
                  {estourou ? "Intervalo estourado" : "Em intervalo"}
                </p>
                <p className={`text-5xl font-black tabular-nums mt-2 ${estourou ? "text-rose-400" : "text-amber-400"}`}>
                  {estourou ? `+${Math.floor(-resta / 60000)}min` : fmtFalta(resta)}
                </p>
                <p className="text-slate-400 font-bold text-xs mt-2">
                  {estourou
                    ? `A volta era às ${prevista.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — bata a volta agora`
                    : `volta às ${prevista.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              </div>
            );
          })()}

          {/* Ação principal */}
          {etapa === "concluido" ? (
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-3xl p-8 text-center mb-6">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-xl font-black text-white">Jornada de hoje concluída!</p>
              <p className="text-slate-400 font-bold text-sm mt-1">Todas as batidas foram registradas.</p>
            </div>
          ) : bloqueiaFolga ? (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-3xl p-8 text-center mb-6">
              <Ban size={44} className="text-rose-400 mx-auto mb-3" />
              <p className="text-2xl font-black text-white">Hoje é sua folga</p>
              <p className="text-rose-200 font-bold text-base mt-2">{info.motivo}. Não é possível bater o ponto em dia de folga.</p>
              <p className="text-slate-400 font-medium text-sm mt-2">Se isso está errado, procure a gerência para ajustar sua escala.</p>
            </div>
          ) : bloqueiaAtraso ? (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-3xl p-8 text-center mb-6">
              <Ban size={44} className="text-rose-400 mx-auto mb-3" />
              <p className="text-2xl font-black text-white">Entrada bloqueada — falta registrada</p>
              <p className="text-rose-200 font-bold text-base mt-2">
                Seu horário era {janela.entradaStr} e já passou mais de {Math.floor(LIMITE_ATRASO_MIN / 60) > 0 ? `${Math.floor(LIMITE_ATRASO_MIN / 60)}h` : `${LIMITE_ATRASO_MIN}min`} — não é mais possível bater o ponto hoje.
              </p>
              <p className="text-slate-400 font-medium text-sm mt-2">O dia sem batida conta como falta no espelho de ponto. Procure a gerência para justificar.</p>
              <button onClick={() => setPinAberto(true)}
                className="mt-5 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-black text-sm transition-colors">
                Liberar entrada — PIN do gerente
              </button>
            </div>
          ) : bloqueiaJanela ? (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 text-center mb-6">
              <Timer size={44} className="text-amber-400 mx-auto mb-3" />
              <p className="text-lg font-black text-white">Ainda não dá para bater a entrada</p>
              <p className="text-slate-400 font-bold text-sm mt-1">
                Seu horário é {janela.entradaStr}. A entrada libera às {janela.permiteEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
              </p>
              <p className="text-5xl font-black text-amber-400 tabular-nums mt-5">{fmtFalta(janela.faltaMs)}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">faltam para liberar</p>
            </div>
          ) : (
            <button onClick={bater} disabled={batendo}
              className="w-full py-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-3xl font-black text-2xl md:text-3xl transition-all active:scale-[0.98] shadow-2xl shadow-emerald-600/30 flex items-center justify-center gap-4 mb-4">
              {batendo ? <Loader2 size={30} className="animate-spin" /> : etapaInfo && <etapaInfo.icon size={30} />}
              Bater: {etapaInfo?.label}
            </button>
          )}

          {/* Não vou tirar o intervalo — só aparece na etapa certa */}
          {etapa === "saida_intervalo" && podeBater && (
            <button onClick={() => setJustif({ tipo: "pular_intervalo" })} disabled={batendo}
              className="w-full py-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-2xl font-black text-base transition-colors flex items-center justify-center gap-2 mb-6">
              <AlertTriangle size={18} /> Não vou tirar a folga de {fmtMin(intervaloPadrao)} hoje
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
            {bancoMes.length > 0 && (() => {
              const excessos = bancoMes.filter(b => b.tipo === "excesso");
              const creditos = bancoMes.length - excessos.length;
              return (
                <p className="text-[10px] font-bold text-slate-500 mt-3">
                  Banco de horas no mês: {creditos} crédito(s) somando <span className={totalBancoMes >= BANCO_ALERTA_MIN ? "text-amber-400" : "text-emerald-400"}>{fmtMin(totalBancoMes)}</span>.
                  {excessos.length > 0 && <span className="text-amber-400"> {excessos.length} ocorrência(s) de intervalo passado do horário.</span>}
                  {" "}O espelho completo é impresso pelo RH.
                </p>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // ── Tela inicial: relógio + busca + cards agrupados por função ─────────────
  const q = busca.toLowerCase();
  const filtrados = colaboradores.filter(c =>
    c.nome.toLowerCase().includes(q) || (c.cargo || "").toLowerCase().includes(q)
  );
  const grupos = ORDEM_CATEGORIAS
    .map(cat => ({ cat, itens: filtrados.filter(c => categoriaFuncao(c.cargo) === cat) }))
    .filter(g => g.itens.length);

  const renderCard = (c) => {
    const reg = registroDe(c.id);
    const etapa = proximaEtapa(reg);
    const concluido = etapa === "concluido";
    const info = folgaHoje(c, folgas, horaLocal);
    // Passou do limite de atraso sem bater a entrada: falta
    let faltou = false;
    const entradaStr = entradaDoDia(c, horaLocal);
    if (!info.folga && !reg?.hora_entrada && entradaStr) {
      const [hh, mm] = entradaStr.split(":").map(Number);
      const limite = new Date(horaLocal);
      limite.setHours(hh, mm + LIMITE_ATRASO_MIN, 0, 0);
      faltou = horaLocal.getTime() > limite.getTime();
    }
    return (
      <button key={c.id} onClick={() => abrirFuncionario(c)}
        className={`p-5 rounded-3xl border-2 text-left transition-all hover:-translate-y-1 ${info.folga || faltou ? "bg-rose-500/5 border-rose-500/30" : concluido ? "bg-slate-900/40 border-slate-800 opacity-60" : "bg-slate-900 border-slate-800 hover:border-emerald-500/60"}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center text-lg font-black shrink-0 ring-2 ${info.folga || faltou ? "ring-rose-500/40 text-rose-300" : concluido ? "ring-slate-700 text-slate-500" : reg?.hora_entrada ? "ring-emerald-500/70 text-emerald-400" : "ring-slate-700 text-emerald-400"}`}>{c.nome[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="font-black text-white leading-tight break-words">{c.nome}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{c.cargo || "—"}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${info.folga || faltou ? "bg-rose-500/10 text-rose-400" : concluido ? "bg-emerald-500/10 text-emerald-500" : reg?.hora_entrada ? "bg-sky-500/10 text-sky-400" : "bg-slate-800 text-slate-500"}`}>
            {info.folga ? <><Ban size={11} /> Folga hoje</> : faltou ? <><Ban size={11} /> Falta — não bateu até {entradaStr}+{LIMITE_ATRASO_MIN}min</> : concluido ? <><CheckCircle2 size={11} /> Jornada concluída</> : reg?.hora_entrada ? <><Clock size={11} /> Próx: {ETAPAS.find(e => e.id === etapa)?.label}</> : <><LogIn size={11} /> Aguardando entrada</>}
          </div>
          {entradaStr && !info.folga && (
            <span className="text-[10px] font-bold text-slate-600">{entradaStr}{c.horario_saida ? `–${c.horario_saida}` : ""}</span>
          )}
        </div>
      </button>
    );
  };

  const hNow = horaLocal.getHours();
  const saudacao = hNow >= 5 && hNow < 12 ? "Bom dia" : hNow >= 12 && hNow < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div ref={containerRef} onClick={reforcarFullscreen} className="fixed inset-0 z-[9999] bg-slate-950 overflow-y-auto font-sans">
      {pinSair && (
        <ModalPinGerente
          titulo="Sair do Modo Ponto"
          subtitulo="Digite o PIN do gerente para destravar o tablet"
          onClose={() => setPinSair(false)}
          onSuccess={sairKiosk}
        />
      )}
      <div className="max-w-4xl mx-auto p-6 md:p-10">
        <div className="flex items-center justify-between mb-6">
          {kiosk ? (
            <button onClick={() => setPinSair(true)} className="flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-600 hover:text-slate-400 rounded-2xl font-bold text-xs transition-colors border border-slate-800" title="Destravar com PIN do gerente">
              <Lock size={14} /> Travado
            </button>
          ) : (
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-colors">
              <ArrowLeft size={18} /> Painel
            </button>
          )}
          {!kiosk && (
            <button onClick={ativarKiosk} className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm transition-colors shadow-lg shadow-emerald-600/25" title="Trava em tela cheia para tablet/celular — só sai com o PIN do gerente">
              <Tablet size={17} /> Modo Tablet
            </button>
          )}
        </div>

        <div className="text-center mb-8 relative">
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 w-[420px] max-w-full h-44 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
          <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-xs mb-1 relative">{saudacao}, Equipe</p>
          <h1 className="text-7xl md:text-8xl font-black tabular-nums tracking-tight relative bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text text-transparent">
            {horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            <span className="text-2xl text-emerald-500/70 ml-2">{String(horaLocal.getSeconds()).padStart(2, "0")}</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest mt-2 relative">
            {horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {unidadeInfo?.nome}
          </p>
        </div>

        {/* Busca por nome OU função */}
        <div className="relative mb-6">
          <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou função..."
            className="w-full pl-14 pr-5 py-5 bg-slate-900 border-2 border-slate-800 focus:border-emerald-500 rounded-3xl text-white text-xl font-bold outline-none placeholder:text-slate-600 transition-colors"
            autoFocus
          />
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 size={40} className="animate-spin text-slate-600 mx-auto" /></div>
        ) : filtrados.length === 0 ? (
          <p className="text-center text-slate-600 font-bold py-12">{colaboradores.length === 0 ? "Nenhum colaborador cadastrado no RH." : "Nenhum nome ou função encontrado."}</p>
        ) : (
          <div className="space-y-7">
            {grupos.map(g => (
              <div key={g.cat}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">{g.cat}</p>
                  <span className="text-[10px] font-black text-slate-600 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">{g.itens.length}</span>
                  <div className="flex-1 h-px bg-slate-800/70" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {g.itens.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
