"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock, ArrowLeft, CheckCircle2, LogIn, LogOut, Coffee, Undo2,
  AlertTriangle, Maximize, Loader2, Hourglass, Ban, Timer, X, Lock, Tablet, MessageCircle, MapPin, ExternalLink,
  ChefHat, GlassWater, UtensilsCrossed
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { useRouter } from "next/navigation";
import { fetchColaboradores, inserirBancoHoras, fetchBancoHorasColaborador, somaMinutosBanco, fetchAllFolgasDaUnidade, fetchLiberacoesDia, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN } from "../../../lib/rh";
import { fetchPontoHoje, fetchPontosMes, registrarBatida, pularIntervalo } from "../../../lib/ponto";
import { fetchPins } from "../../../lib/seguranca";
import { fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { useTempoReal } from "../../../lib/realtime";

const fmtMin = (m) => `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`;
const horaDe = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
const strToMin = (hhmm) => { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Sigla do dia da semana a partir da data do registro. O meio-dia na conversão
// evita o clássico "sábado virou sexta" por causa de fuso.
const SIGLAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const siglaDiaSemana = (dataISO) => {
  if (!dataISO) return "";
  const d = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : SIGLAS_SEMANA[d.getDay()];
};

// Tolerâncias e limites do ponto: valores AJUSTÁVEIS em Configurações >
// Parâmetros do Sistema (cfgP). Os padrões vêm de PARAMS_PADRAO na lib.

// Data de hoje (ou da base) com o horário HH:MM
function comHora(base, hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

// Link do WhatsApp do funcionário (telefone do cadastro) com a mensagem pronta
function linkZap(colab, msg) {
  const dig = String(colab.telefone || "").replace(/\D/g, "");
  if (!dig) return null;
  const num = dig.length >= 12 ? dig : `55${dig}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

// PIN do gerente para liberar a entrada bloqueada por atraso
const PIN_GERENTE = "1234";

// Teclado de PIN (libera entrada atrasada ou destrava o modo tablet)
function ModalPinGerente({ onSuccess, onClose, titulo = "PIN do Gerente", subtitulo = "Autorizar entrada fora do horário", senha = PIN_GERENTE }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const digito = (d) => {
    if (pin.length >= 4) return;
    const novo = pin + d;
    setPin(novo);
    if (novo.length === 4) {
      setTimeout(() => {
        if (novo === senha) onSuccess();
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

// As três portas de entrada do ponto. Liderança e "Outros" entram nas três:
// gerente cobre qualquer setor, e ninguém pode ficar sem lugar para bater.
// Liderança não bate ponto: cargo de gestão é isento de controle de jornada
// (CLT art. 62, II). Aparecer no tablet só gerava registro que ninguém usa e
// poluía a lista de quem a casa precisa conferir. Chefe de Cozinha e Chef de
// Garçom continuam: o cargo deles nomeia o setor, então caem em Cozinha e
// Salão, não aqui.
const AREAS_DA_CATEGORIA = {
  cozinha: ["Cozinha", "Outros"],
  salao: ["Salão", "Outros"],
  bar: ["Bar", "Outros"],
};
const AREAS_PONTO = [
  { id: "cozinha", nome: "Cozinha", titulo: "Área da Cozinha", icone: ChefHat, cor: "#34D399", fundo: "rgba(16,185,129,.15)" },
  { id: "salao", nome: "Salão", titulo: "Área do Salão", icone: UtensilsCrossed, cor: "#FBBF24", fundo: "rgba(245,158,11,.15)" },
  { id: "bar", nome: "Bar", titulo: "Área do Bar", icone: GlassWater, cor: "#60A5FA", fundo: "rgba(59,130,246,.15)" },
];
function categoriaFuncao(cargo) {
  const c = (cargo || "").toLowerCase();
  if (/(cozinh|chapeir|confeit|pizzai|sushi|salgad|padeir|churrasqueir|a[cç]ougue|copa)/.test(c)) return "Cozinha";
  if (/(\bbar\b|barman|bartender|barista|drinks)/.test(c)) return "Bar";
  if (/(gar[çc]|atendente|sal[aã]o|recep|hostess|maitre|maître|caixa|comand|chefe de fila|chef de fila)/.test(c)) return "Salão";
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

// Horários do dia (domingo pode ter turno diferente do resto da semana)
// Jornada por dia da semana (0=Dom..6=Sáb) tem prioridade; senão domingo; senão fixo.
function entradaDoDia(c, base) {
  if (!c) return null;
  const wd = String(base.getDay());
  if (c.horario_por_dia && c.horarios_dia && c.horarios_dia[wd] && c.horarios_dia[wd].e) return c.horarios_dia[wd].e;
  const dom = base.getDay() === 0;
  return (dom ? (c.horario_dom_entrada || c.horario_entrada) : c.horario_entrada) || null;
}
function saidaDoDia(c, base) {
  if (!c) return null;
  const wd = String(base.getDay());
  if (c.horario_por_dia && c.horarios_dia && c.horarios_dia[wd] && c.horarios_dia[wd].s) return c.horarios_dia[wd].s;
  const dom = base.getDay() === 0;
  return (dom ? (c.horario_dom_saida || c.horario_saida) : c.horario_saida) || null;
}

// Está de folga hoje? (folga semanal via dias_trabalho + folga esporádica)
// Três folgas diferentes, e a casa trata cada uma de um jeito: a semanal é a
// que está no contrato; a de domingo é a escala que roda entre a equipe; e a
// programada é combinada caso a caso. Chamar todas de "folga" apagava essa
// diferença justamente para quem precisa dela — quem monta a escala.
function folgaHoje(c, folgas, base) {
  const diasStr = String(c?.dias_trabalho || "").trim();
  if (diasStr) {
    const dias = diasStr.split(",").map(s => s.trim()).filter(Boolean);
    if (dias.length && !dias.includes(String(base.getDay()))) {
      return { folga: true, tipo: "semanal", motivo: "Folga da semana" };
    }
  }
  const hoje = isoLocal(base);
  const esp = (folgas || []).find(f => f.colaborador_id === c?.id && String(f.data_folga).slice(0, 10) === hoje);
  if (esp) {
    // Domingo tem nome próprio porque é assim que a escala é falada na casa.
    if (base.getDay() === 0) return { folga: true, tipo: "domingo", motivo: "Folga de domingo" };
    return { folga: true, tipo: "programada", motivo: esp.descricao ? `Folga — ${esp.descricao}` : "Folga programada" };
  }
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

  // Area escolhida na entrada; vazio mostra os tres cards.
  const [areaAtiva, setAreaAtiva] = useState("");
  const [colaboradores, setColaboradores] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [folgas, setFolgas] = useState([]);
  const [liberadosHoje, setLiberadosHoje] = useState([]); // ids de freelancers liberados hoje
  const [loading, setLoading] = useState(true);
  const [letra, setLetra] = useState(""); // filtro A-Z (toque rapido no tablet)
  const [horaLocal, setHoraLocal] = useState(new Date());

  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);
  // Mês que o funcionário está olhando no próprio histórico. Antes eram só os
  // 7 últimos dias, o que não dava para conferir o mês fechado nem contestar
  // uma batida do começo do mês.
  const [mesHistorico, setMesHistorico] = useState(() => isoLocal(new Date()).slice(0, 7));
  const [bancoMes, setBancoMes] = useState([]);
  const [batendo, setBatendo] = useState(false);
  const [sucesso, setSucesso] = useState(null); // { titulo, detalhe, tone }
  const [justif, setJustif] = useState(null);    // { tipo: 'retorno_cedo' | 'pular_intervalo', ... }
  const [liberados, setLiberados] = useState({}); // { [colabId]: true } — atraso liberado pelo gerente hoje
  const [pinAberto, setPinAberto] = useState(false);
  const [pinAntecipada, setPinAntecipada] = useState(false);      // entrar ANTES do horário (reunião)
  const [escolhaAntecipada, setEscolhaAntecipada] = useState(null); // { min } — decisão do gerente
  const [escolhaAtraso, setEscolhaAtraso] = useState(null);         // { min } — descontar do banco?

  // PIN do gerente e parâmetros do ponto (Configurações > Senhas / Parâmetros)
  const [pinGerente, setPinGerente] = useState(PIN_GERENTE);
  const [cfgP, setCfgP] = useState(PARAMS_PADRAO);
  useEffect(() => {
    if (unidadeAtiva && unidadeAtiva !== "todas") {
      fetchPins(unidadeAtiva).then(r => setPinGerente(r.data.pin_gerente));
      fetchParams(unidadeAtiva).then(r => setCfgP(r.data));
    }
  }, [unidadeAtiva]);

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

  // Modo Tablet: mantém a TELA SEMPRE ACESA (Wake Lock) — assim ela não apaga
  // e não cai da tela cheia. Se o app for pro fundo e voltar, retoma o lock.
  useEffect(() => {
    if (!kiosk) return;
    let lock = null;
    let ativo = true;
    const pedirLock = async () => {
      try {
        if (ativo && typeof navigator !== "undefined" && "wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch { /* alguns navegadores negam sem bateria/energia — segue sem */ }
    };
    pedirLock();
    const onVis = () => { if (document.visibilityState === "visible") pedirLock(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", onVis);
      try { if (lock) lock.release(); } catch {}
    };
  }, [kiosk]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const d = new Date();
    const hojeISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const [rColab, rPontos, rFolgas, rLib] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
      fetchAllFolgasDaUnidade(unidadeAtiva),
      fetchLiberacoesDia(unidadeAtiva, hojeISO),
    ]);
    // Extras têm recibo próprio e não participam do relógio de ponto.
    setColaboradores((rColab.data || []).filter(c =>
      (c.status || "ativo") !== "inativo" && c.tipo_contrato !== "Freelancer"
    ));
    setPontosHoje(rPontos.data || []);
    setFolgas(rFolgas.data || []);
    setLiberadosHoje((rLib.data || []).map(l => l.colaborador_id));
    setLoading(false);
  }, [unidadeAtiva]);

  // Extra/freelancer só bate ponto no dia em que o gerente liberou.
  const bloqueadoFreela = (c) => c?.tipo_contrato === "Freelancer" && !liberadosHoje.includes(c.id);

  // Tempo real: batida em QUALQUER aparelho aparece aqui na hora, sem atualizar
  useTempoReal(["registro_ponto", "colaboradores", "rh_folgas_esporadicas", "rh_banco_horas"], () => carregar(true));

  useEffect(() => {
    if (unidadeAtiva) carregar();
    const t = setInterval(() => setHoraLocal(new Date()), 1000);
    return () => clearInterval(t);
  }, [unidadeAtiva, carregar]);

  const registroDe = (colabId) => pontosHoje.find(p => p.colaborador_id === colabId) || null;

  // Abre a tela do funcionário INSTANTANEAMENTE; histórico/banco carregam em segundo plano
  const abrirFuncionario = (c) => {
    if (bloqueadoFreela(c)) {
      alert(`${c.nome} é extra/freelancer e o ponto de hoje ainda não foi liberado.\n\nPeça ao gerente para liberar em RH → Ações → "Liberar ponto de hoje".`);
      return;
    }
    setSelecionado(c);
    setLetra("");
    setHistorico([]);
    setBancoMes([]);
    const mes = isoLocal(new Date()).slice(0, 7);
    setMesHistorico(mes); // sempre abre no mês corrente
    fetchBancoHorasColaborador(c.id, mes).then(r => setBancoMes(r.data || [])).catch(() => {});
  };

  // Recarrega ao trocar de pessoa ou de mês.
  useEffect(() => {
    if (!selecionado?.id) return;
    let ativo = true;
    fetchPontosMes(selecionado.id, mesHistorico)
      .then(r => { if (ativo) setHistorico(r.data || []); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [selecionado?.id, mesHistorico]);

  // Não deixa navegar para o futuro: mês que ainda não aconteceu só teria
  // linhas vazias e passaria a impressão de que faltou batida.
  const mesEhFuturo = mesHistorico >= isoLocal(new Date()).slice(0, 7);
  const andarMes = (passo) => setMesHistorico(atual => {
    const [ano, mes] = atual.split("-").map(Number);
    const d = new Date(ano, mes - 1 + passo, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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
    // Feedback sem olhar a tela: vibra e apita ao confirmar
    try { navigator.vibrate && navigator.vibrate(tone === "alerta" ? [120,80,120] : 180); const A = window.AudioContext || window.webkitAudioContext; if (A) { const ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = tone === "alerta" ? 320 : 880; g.gain.value = 0.08; o.start(); o.stop(ctx.currentTime + 0.18); } } catch (_) {}
    setSucesso({ titulo, detalhe, tone });
    // Rápido: 2s no ok; alertas (têm mais texto) ganham um pouco mais
    // Volta para a escolha de área, não para a lista da área. Quem bateu já
    // terminou; quem chega em seguida costuma ser de outro setor, e deixar a
    // lista anterior aberta faz a próxima pessoa bater no nome errado.
    setTimeout(() => {
      setSucesso(null);
      setSelecionado(null);
      setAreaAtiva("");
      carregar();
    }, tone === "alerta" ? 3500 : 2000);
  };

  // Registra a batida de uma etapa. horaMarcada = hora ajustada pela tolerância
  // (grava e mostra o horário "cheio"); atrasoMin > 0 = entrada fora da tolerância.
  const executarBatida = async (etapa, reg, horaMarcada = null, atrasoMin = 0, extrasSaida = {}) => {
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

      // Saída DEPOIS do horário → vira hora extra no banco, automaticamente
      if (etapa === "saida_trabalho" && extrasSaida.extraMin > 0) {
        const { creditado, aviso } = await creditarBanco(extrasSaida.extraMin, `Hora extra: saiu às ${agoraStr} (previsto ${extrasSaida.prevStr})`);
        mostrarSucesso(`Saída às ${agoraStr}`,
          `${primeiro}, você passou ${extrasSaida.extraMin} min do horário (${extrasSaida.prevStr}). ${creditado > 0 ? `${fmtMin(creditado)} viraram hora extra no seu banco de horas.` : ""} ${aviso}`,
          "alerta");
        return;
      }
      // Saída ANTES do horário → registrada como saída antecipada
      if (etapa === "saida_trabalho" && extrasSaida.saiuAntesMin > 0) {
        mostrarSucesso(`Saída às ${agoraStr}`,
          `${primeiro}, saída ${extrasSaida.saiuAntesMin} min antes do previsto (${extrasSaida.prevStr}) — registrado no espelho de ponto.`,
          "alerta");
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
        if (diffMin <= cfgP.tolerancia_marcacao) horaMarcada = prevista;
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
      if (diffMin <= cfgP.tolerancia_retorno) horaMarcada = prevista;
    }

    // SAÍDA DO TRABALHO: até 5 min de diferença do horário grava o horário do turno
    // (turnos que viram a meia-noite: testa a previsão em ±1 dia e usa a mais próxima).
    // PASSOU do horário → os minutos viram HORA EXTRA no banco, automaticamente.
    // Saiu ANTES → fica registrado no espelho como saída antecipada.
    let extrasSaida = {};
    if (etapa === "saida_trabalho") {
      const saidaStr = saidaDoDia(selecionado, agora);
      if (saidaStr) {
        const cands = [-1, 0, 1].map(d => { const c = comHora(agora, saidaStr); c.setDate(c.getDate() + d); return c; });
        const prevista = cands.reduce((a, b) => Math.abs(agora - b) < Math.abs(agora - a) ? b : a);
        const difMin = (agora.getTime() - prevista.getTime()) / 60000;
        if (Math.abs(difMin) <= cfgP.tolerancia_marcacao) horaMarcada = prevista;
        else if (difMin > 0) extrasSaida = { extraMin: Math.round(difMin), prevStr: saidaStr };
        else extrasSaida = { saiuAntesMin: Math.round(-difMin), prevStr: saidaStr };
      }
    }

    await executarBatida(etapa, reg, horaMarcada, atrasoMin, extrasSaida);
  };

  // Entrada ANTECIPADA autorizada (reunião/serviço): o gerente decide se os
  // minutos antes do horário viram hora extra ou se o funcionário sai mais cedo.
  const confirmarAntecipada = async (modo) => {
    if (!escolhaAntecipada || !selecionado || batendo) return;
    const min = escolhaAntecipada.min;
    setBatendo(true);
    try {
      const { error } = await registrarBatida(selecionado.id, unidadeAtiva, "entrada");
      if (error) { alert(error); return; }
      const agoraStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const primeiro = selecionado.nome.split(" ")[0];
      const hoje = new Date().toISOString().split("T")[0];
      setEscolhaAntecipada(null);
      if (modo === "extra") {
        const { creditado, aviso } = await creditarBanco(min, `Entrada antecipada (reunião/serviço): ${min}min antes do horário — autorizada pelo gerente`);
        mostrarSucesso(`Entrada às ${agoraStr}`,
          `${primeiro}, entrada ${min} min antes do horário. ${creditado > 0 ? `${fmtMin(creditado)} viraram hora extra no banco.` : ""} ${aviso}`);
      } else {
        await inserirBancoHoras(unidadeAtiva, selecionado.id, hoje, min,
          `Entrou ${min}min mais cedo (reunião/serviço) — combinado ser liberado mais cedo hoje`, "excesso");
        mostrarSucesso(`Entrada às ${agoraStr}`,
          `${primeiro}, combinado: você será liberado ${min} min mais cedo hoje. Ficou registrado.`);
      }
    } finally {
      setBatendo(false);
    }
  };

  // Atraso liberado pelo gerente: descontar do banco de horas ou só liberar
  const confirmarAtraso = async (descontar) => {
    if (!escolhaAtraso || !selecionado) return;
    const min = escolhaAtraso.min;
    if (descontar) {
      const hoje = new Date().toISOString().split("T")[0];
      await inserirBancoHoras(unidadeAtiva, selecionado.id, hoje, -min,
        `Atraso de ${min}min descontado do banco de horas (autorizado pelo gerente)`);
    }
    setLiberados(prev => ({ ...prev, [selecionado.id]: true }));
    setEscolhaAtraso(null);
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
      <div className={`fixed inset-0 z-[9999] ${alerta ? "bg-amber-500" : "bg-emerald-600"} flex flex-col items-center justify-center p-4 sm:p-8 text-center animate-in fade-in duration-300`}>
        <div className="w-20 h-20 sm:w-28 sm:h-28 bg-white rounded-2xl sm:rounded-[32px] flex items-center justify-center mb-5 sm:mb-8 shadow-2xl">
          {alerta ? <AlertTriangle size={64} className="text-amber-500" /> : <CheckCircle2 size={64} className="text-emerald-600" />}
        </div>
        <h1 className="text-white font-black text-3xl sm:text-4xl md:text-6xl tracking-tight max-w-3xl">{sucesso.titulo}</h1>
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
      permiteEm.setHours(hh, mm - cfgP.tolerancia_entrada, 0, 0);
      const faltaMs = permiteEm.getTime() - horaLocal.getTime();
      // Limite do atraso: depois disso não bate mais — conta como falta
      const limiteEm = new Date(horaLocal);
      limiteEm.setHours(hh, mm + cfgP.limite_atraso, 0, 0);
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
      <div ref={containerRef} className="erp-safe-top fixed inset-0 z-[9999] bg-slate-950 overflow-y-auto font-sans">
        {pinAberto && (
          <ModalPinGerente senha={pinGerente}
            onClose={() => setPinAberto(false)}
            onSuccess={() => {
              setPinAberto(false);
              const prevista = comHora(new Date(), entradaDoDia(selecionado, horaLocal) || "00:00");
              const min = Math.max(1, Math.round((Date.now() - prevista.getTime()) / 60000));
              setEscolhaAtraso({ min });
            }}
          />
        )}
        {pinAntecipada && (
          <ModalPinGerente senha={pinGerente}
            titulo="Entrada antecipada"
            subtitulo="PIN do gerente para autorizar entrar antes do horário"
            onClose={() => setPinAntecipada(false)}
            onSuccess={() => {
              setPinAntecipada(false);
              const prevista = comHora(new Date(), entradaDoDia(selecionado, horaLocal) || "00:00");
              const min = Math.max(1, Math.round((prevista.getTime() - Date.now()) / 60000));
              setEscolhaAntecipada({ min });
            }}
          />
        )}
        {/* Decisão do gerente: minutos ANTES do horário viram extra ou saída antecipada */}
        {escolhaAntecipada && (
          <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-5">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-center">
              <p className="text-lg font-black text-white">{escolhaAntecipada.min} min antes do horário</p>
              <p className="text-slate-400 font-medium text-xs mb-5">Como tratar esse tempo adiantado (reunião/serviço)?</p>
              <div className="space-y-2">
                <button disabled={batendo} onClick={() => confirmarAntecipada("extra")} className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm disabled:opacity-50">
                  Contar como hora extra
                  <span className="block text-[10px] font-bold opacity-80">vai para o banco de horas</span>
                </button>
                <button disabled={batendo} onClick={() => confirmarAntecipada("liberar")} className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-black text-sm disabled:opacity-50">
                  Vai ser liberado mais cedo hoje
                  <span className="block text-[10px] font-bold opacity-70">só registra o combinado</span>
                </button>
              </div>
              <button onClick={() => setEscolhaAntecipada(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold mt-4">Cancelar</button>
            </div>
          </div>
        )}
        {/* Decisão do gerente: atraso liberado — desconta do banco de horas? */}
        {escolhaAtraso && (
          <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-5">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-center">
              <p className="text-lg font-black text-white">Atraso de {escolhaAtraso.min} min</p>
              <p className="text-slate-400 font-medium text-xs mb-5">Entrada liberada. Como tratar o atraso?</p>
              <div className="space-y-2">
                <button onClick={() => confirmarAtraso(true)} className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm">
                  Descontar do banco de horas
                  <span className="block text-[10px] font-bold opacity-80">tira {escolhaAtraso.min} min do saldo</span>
                </button>
                <button onClick={() => confirmarAtraso(false)} className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-black text-sm">
                  Só liberar a entrada
                  <span className="block text-[10px] font-bold opacity-70">o atraso fica registrado no espelho</span>
                </button>
              </div>
            </div>
          </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
            <button onClick={() => setSelecionado(null)} className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-colors">
              <ArrowLeft size={18} /> Voltar
            </button>
            <div className="text-right">
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums">{horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
            </div>
          </div>

          {/* Identificação */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 mb-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-2xl sm:text-3xl font-black text-emerald-400 shrink-0">
                {selecionado.foto ? <img src={`data:image/jpeg;base64,${selecionado.foto}`} alt={selecionado.nome} className="w-full h-full object-cover" /> : selecionado.nome[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-white leading-tight line-clamp-2">{selecionado.nome}</h2>
                <p className="text-slate-400 font-bold text-xs sm:text-sm truncate">{selecionado.cargo || "—"}</p>
                {entradaStr && <p className="text-slate-500 font-bold text-[11px] sm:text-xs mt-0.5">Entrada: {entradaStr}{saidaDoDia(selecionado, horaLocal) ? ` — ${saidaDoDia(selecionado, horaLocal)}` : ""}</p>}
              </div>
            </div>
            <div className={`flex sm:flex-col items-center justify-between sm:justify-center sm:text-center px-4 py-2 rounded-2xl border shrink-0 w-full sm:w-auto ${totalBancoMes >= BANCO_LIMITE_MIN ? "bg-red-500/10 border-red-500/40" : totalBancoMes >= BANCO_ALERTA_MIN ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-800 border-slate-700"}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Hourglass size={10} /> Banco de horas</p>
              <p className={`text-lg sm:text-xl font-black ${totalBancoMes >= BANCO_LIMITE_MIN ? "text-red-400" : totalBancoMes >= BANCO_ALERTA_MIN ? "text-amber-400" : "text-white"}`}>{fmtMin(totalBancoMes)} <span className="text-xs text-slate-500">/ 8h</span></p>
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
                <p className={`text-4xl sm:text-5xl font-black tabular-nums mt-2 ${estourou ? "text-rose-400" : "text-amber-400"}`}>
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
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-3xl p-5 sm:p-8 text-center mb-6">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-xl font-black text-white">Jornada de hoje concluída!</p>
              <p className="text-slate-400 font-bold text-sm mt-1">Todas as batidas foram registradas.</p>
            </div>
          ) : bloqueiaFolga ? (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-3xl p-5 sm:p-8 text-center mb-6">
              <Ban size={44} className="text-rose-400 mx-auto mb-3" />
              <p className="text-2xl font-black text-white">Hoje é sua folga</p>
              <p className="text-rose-200 font-bold text-base mt-2">{info.motivo}. Não é possível bater o ponto em dia de folga.</p>
              <p className="text-slate-400 font-medium text-sm mt-2">Se isso está errado, procure a gerência para ajustar sua escala.</p>
            </div>
          ) : bloqueiaAtraso ? (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-3xl p-5 sm:p-8 text-center mb-6">
              <Ban size={44} className="text-rose-400 mx-auto mb-3" />
              <p className="text-2xl font-black text-white">Entrada bloqueada — falta registrada</p>
              <p className="text-rose-200 font-bold text-base mt-2">
                Seu horário era {janela.entradaStr} e já passou mais de {Math.floor(cfgP.limite_atraso / 60) > 0 ? `${Math.floor(cfgP.limite_atraso / 60)}h` : `${cfgP.limite_atraso}min`} — não é mais possível bater o ponto hoje.
              </p>
              <p className="text-slate-400 font-medium text-sm mt-2">O dia sem batida conta como falta no espelho de ponto. Procure a gerência para justificar.</p>
              <button onClick={() => setPinAberto(true)}
                className="mt-5 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-black text-sm transition-colors">
                Liberar entrada — PIN do gerente
              </button>
            </div>
          ) : bloqueiaJanela ? (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-8 text-center mb-6">
              <Timer size={44} className="text-amber-400 mx-auto mb-3" />
              <p className="text-lg font-black text-white">Ainda não dá para bater a entrada</p>
              <p className="text-slate-400 font-bold text-sm mt-1">
                Seu horário é {janela.entradaStr}. A entrada libera às {janela.permiteEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
              </p>
              <p className="text-4xl sm:text-5xl font-black text-amber-400 tabular-nums mt-5">{fmtFalta(janela.faltaMs)}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">faltam para liberar</p>
              <button onClick={() => setPinAntecipada(true)}
                className="mt-5 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-black text-sm transition-colors">
                Reunião / serviço mais cedo? Liberar — PIN do gerente
              </button>
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

          {/* Histórico do mês, com navegação. O funcionário precisa conseguir
              conferir o mês fechado — com 7 dias não dava para contestar uma
              batida do começo do mês. */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Clock size={12} /> Meu histórico</p>
              <div className="flex items-center gap-1">
                <button onClick={() => andarMes(-1)} aria-label="Mês anterior"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">‹</button>
                <span className="min-w-[112px] text-center text-xs font-black uppercase text-slate-300">
                  {new Date(`${mesHistorico}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <button onClick={() => andarMes(1)} disabled={mesEhFuturo} aria-label="Próximo mês"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30">›</button>
              </div>
            </div>
            {historico.length > 0 && (
              <p className="mb-2 text-[11px] font-bold text-slate-500">
                {historico.length} dia(s) com registro neste mês
              </p>
            )}
            {historico.length === 0 ? (
              <p className="text-sm font-medium text-slate-600">Nenhum registro neste mês.</p>
            ) : (
              <div className="space-y-1.5">
                {/* Rotulo em cima de cada coluna: quatro horarios seguidos sem
                    titulo obrigam a decorar a ordem. Mesma grade das linhas
                    para os titulos cairem exatamente sobre os numeros. */}
                <div className="grid grid-cols-[96px_1fr_1fr_1fr_1fr] gap-2 items-end px-2 pb-1 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 text-left">Dia</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Entrada</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Saiu p/<br/>intervalo</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Voltou do<br/>intervalo</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Saída</span>
                </div>
                {historico.map(h => (
                  <div key={h.id} className="grid grid-cols-[96px_1fr_1fr_1fr_1fr] gap-2 items-center text-center py-1.5 px-2 rounded-lg bg-slate-950/60">
                    {/* Dia da semana ao lado da data: quem confere o próprio
                        ponto lembra "no sábado eu saí tarde", não "no dia 15". */}
                    <span className="text-[11px] font-black text-slate-400 text-left">
                      {h.data_referencia?.slice(5).split("-").reverse().join("/")}
                      <span className="ml-1.5 text-slate-500">{siglaDiaSemana(h.data_referencia)}</span>
                    </span>
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

  // ── Tela inicial: relógio + áreas + cards agrupados por função ────────────
  // Sem área escolhida ninguém aparece: a tela de entrada são os três cards.
  const filtrados = !areaAtiva ? [] : colaboradores.filter(c =>
    (!letra || (c.nome || "").toUpperCase().startsWith(letra))
    && AREAS_DA_CATEGORIA[areaAtiva].includes(categoriaFuncao(c.cargo))
  );
  const rankPonto = (c) => { const r = registroDe(c.id); if (folgaHoje(c, folgas, horaLocal).folga) return 3; if (r?.hora_saida) return 2; if (r?.hora_entrada) return 0; return 1; };
  const grupos = ORDEM_CATEGORIAS
    .map(cat => ({ cat, itens: filtrados.filter(c => categoriaFuncao(c.cargo) === cat).sort((a, b) => rankPonto(a) - rankPonto(b)) }))
    .filter(g => g.itens.length);

  const renderCard = (c) => {
    const reg = registroDe(c.id);
    const etapa = proximaEtapa(reg);
    const concluido = etapa === "concluido";
    const info = folgaHoje(c, folgas, horaLocal);
    const bloqueado = bloqueadoFreela(c); // extra sem liberação do dia
    // Passou do limite de atraso sem bater a entrada: falta
    let faltou = false;
    const entradaStr = entradaDoDia(c, horaLocal);
    if (!info.folga && !reg?.hora_entrada && entradaStr) {
      const [hh, mm] = entradaStr.split(":").map(Number);
      const limite = new Date(horaLocal);
      limite.setHours(hh, mm + cfgP.limite_atraso, 0, 0);
      faltou = horaLocal.getTime() > limite.getTime();
    }
    return (
      <button key={c.id} onClick={() => abrirFuncionario(c)}
        className={`p-5 rounded-3xl border-2 text-left transition-all hover:-translate-y-1 ${reg?.hora_entrada && !concluido ? "bg-slate-900 border-sky-500/40 hover:border-sky-400/70" : info.folga || faltou ? "bg-rose-500/5 border-rose-500/30" : concluido ? "bg-slate-900/40 border-slate-800 opacity-60" : "bg-slate-900 border-slate-800 hover:border-emerald-500/60"}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-11 h-11 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-lg font-black shrink-0 ring-2 ${info.folga || faltou ? "ring-rose-500/40 text-rose-300" : concluido ? "ring-slate-700 text-slate-500" : reg?.hora_entrada ? "ring-emerald-500/70 text-emerald-400" : "ring-slate-700 text-emerald-400"}`}>{c.foto ? <img src={`data:image/jpeg;base64,${c.foto}`} alt={c.nome} className="w-full h-full object-cover" /> : c.nome[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="font-black text-white leading-tight break-words text-xl">{c.nome}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{c.cargo || "—"}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* PRIORIDADE: jornada aberta (mesmo em dia de folga — turno de ontem
              que virou a madrugada) vem antes do selo de folga */}
          {/* Folga não é falta: sai em âmbar, não em vermelho. E cada tipo diz
              o próprio nome — quem monta a escala precisa saber se a pessoa
              está de folga semanal ou se foi a vez dela no domingo. */}
          <div className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${bloqueado && !reg?.hora_entrada ? "bg-violet-500/10 text-violet-300" : reg?.hora_entrada && !concluido ? "bg-sky-500/10 text-sky-400" : info.folga ? (info.tipo === "domingo" ? "bg-amber-500/10 text-amber-300" : "bg-slate-700/40 text-slate-300") : faltou ? "bg-rose-500/10 text-rose-400" : concluido ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-800 text-slate-500"}`}>
            {bloqueado && !reg?.hora_entrada ? <><Ban size={11} /> Aguardando liberação</> : reg?.hora_entrada && !concluido ? <><Clock size={11} /> Próx: {ETAPAS.find(e => e.id === etapa)?.label}</> : info.folga ? <><Ban size={11} /> {info.motivo}</> : faltou ? <><Ban size={11} /> Falta — não bateu até {entradaStr}+{cfgP.limite_atraso}min</> : concluido ? <><CheckCircle2 size={11} /> Jornada concluída</> : <><LogIn size={11} /> Aguardando entrada</>}
          </div>
          {entradaStr && !info.folga && (
            <span className="text-[10px] font-bold text-slate-600">{entradaStr}{saidaDoDia(c, horaLocal) ? `–${saidaDoDia(c, horaLocal)}` : ""}</span>
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
        <ModalPinGerente senha={pinGerente}
          titulo="Sair do Modo Ponto"
          subtitulo="Digite o PIN do gerente para destravar o tablet"
          onClose={() => setPinSair(false)}
          onSuccess={sairKiosk}
        />
      )}
      <div className="max-w-4xl mx-auto p-6 md:p-10">
        <div className="flex items-center justify-between mb-6">
          {kiosk ? (
            <button onClick={() => setPinSair(true)} aria-label="Destravar com PIN do gerente" className="grid h-12 w-12 place-items-center bg-slate-900 hover:bg-slate-800 text-slate-600 hover:text-slate-400 rounded-2xl transition-colors border border-slate-800" title="Destravar com PIN do gerente">
              <Lock size={18} />
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
          <h1 className="text-8xl md:text-[10rem] font-black tabular-nums tracking-tight relative bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text text-transparent">
            {horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            <span className="text-3xl md:text-4xl text-emerald-500/70 ml-2">{String(horaLocal.getSeconds()).padStart(2, "0")}</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest mt-2 relative">
            {horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {unidadeInfo?.nome}
          </p>
          {/* Qual área está aberta, no meio e logo abaixo da hora: é a primeira
              coisa que quem chega procura para saber se está na lista certa. */}
          {areaAtiva && (
            <p className="relative mt-4 text-3xl font-black text-white md:text-4xl">
              {AREAS_PONTO.find(a => a.id === areaAtiva)?.titulo}
            </p>
          )}
        </div>

        {/* LEMBRETES: 10 min para a entrada ou para o fim do intervalo */}
        {(() => {
          const alertas = [];
          colaboradores.forEach(c => {
            const reg = registroDe(c.id);
            const info = folgaHoje(c, folgas, horaLocal);
            if (info.folga) return;
            // Faltam até 10 min para o horário de entrada (e ainda não bateu)
            if (!reg?.hora_entrada) {
              const eStr = entradaDoDia(c, horaLocal);
              if (eStr) {
                const prev = comHora(horaLocal, eStr);
                const falta = Math.round((prev.getTime() - horaLocal.getTime()) / 60000);
                if (falta > 0 && falta <= cfgP.lembrete_min) {
                  alertas.push({
                    tipo: "entrada", c, falta, hora: eStr,
                    msg: `Ola ${c.nome.split(" ")[0]}! Faltam ${falta} min para o seu horario (${eStr}). Nao esqueca de bater o ponto de entrada. — ${unidadeInfo?.nome || "Hefisto"}`,
                  });
                }
              }
            }
            // Faltam até 10 min para o fim do intervalo
            if (reg?.hora_saida_intervalo && !reg?.hora_retorno_intervalo && !reg?.hora_saida) {
              const intervalo = Number(c.tempo_intervalo) || 60;
              const prev = new Date(new Date(reg.hora_saida_intervalo).getTime() + intervalo * 60000);
              const falta = Math.round((prev.getTime() - horaLocal.getTime()) / 60000);
              if (falta > 0 && falta <= cfgP.lembrete_min) {
                const hStr = prev.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                alertas.push({
                  tipo: "intervalo", c, falta, hora: hStr,
                  msg: `Ola ${c.nome.split(" ")[0]}! Faltam ${falta} min para o fim do seu intervalo — volta as ${hStr}. — ${unidadeInfo?.nome || "Hefisto"}`,
                });
              }
            }
          });
          if (!alertas.length) return null;
          return (
            <div className="mb-6 space-y-2">
              {alertas.map((a, i) => {
                const zap = linkZap(a.c, a.msg);
                return (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl border bg-amber-500/10 border-amber-500/30 animate-pulse">
                    <Timer size={20} className="text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-amber-300 leading-tight">
                        {a.tipo === "entrada" ? `${a.c.nome.split(" ").slice(0, 2).join(" ")} entra às ${a.hora}` : `${a.c.nome.split(" ").slice(0, 2).join(" ")} volta do intervalo às ${a.hora}`}
                      </p>
                      <p className="text-[11px] font-bold text-amber-500/80">faltam {a.falta} min</p>
                    </div>
                    {zap ? (
                      <a href={zap} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-black text-xs text-white shrink-0 active:scale-95 transition-transform"
                        style={{ background: "#25D366" }}>
                        <MessageCircle size={14} /> Lembrar no WhatsApp
                      </a>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 shrink-0">sem telefone no cadastro</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Entrada por área. A busca por nome saiu: quem chega para bater vem do
            próprio setor e acha o nome na lista mais rápido do que digitaria —
            ainda mais com a mão ocupada ou molhada. */}
        {!areaAtiva ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {AREAS_PONTO.map(area => {
              const Icone = area.icone;
              const quantos = colaboradores.filter(c => AREAS_DA_CATEGORIA[area.id].includes(categoriaFuncao(c.cargo))).length;
              return (
                <button key={area.id} onClick={() => setAreaAtiva(area.id)}
                  className="flex flex-col items-center gap-3 rounded-3xl border-2 border-slate-800 bg-slate-900 p-8 transition-all hover:border-emerald-500 active:scale-[.98]">
                  <span className="grid h-24 w-24 place-items-center rounded-3xl" style={{ background: area.fundo, color: area.cor }}>
                    <Icone size={48} />
                  </span>
                  <span className="text-3xl font-black text-white">{area.nome}</span>
                  <span className="text-sm font-bold text-slate-500">{quantos} pessoa(s)</span>
                </button>
              );
            })}
          </div>
        ) : (
          // Só a seta. O nome da área já está no título, abaixo do relógio —
          // repetir na tecla de voltar era dizer a mesma coisa duas vezes.
          <button onClick={() => setAreaAtiva("")} aria-label="Voltar para a escolha de área"
            className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-emerald-500">
            <ArrowLeft size={24} />
          </button>
        )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
