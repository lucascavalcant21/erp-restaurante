"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock, ArrowLeft, CheckCircle2, LogIn, LogOut, Coffee, Undo2,
  AlertTriangle, Maximize, Loader2, Ban, Timer, X, Lock, Tablet, MessageCircle, MapPin, ExternalLink,
  ChefHat, GlassWater, UtensilsCrossed
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { useRouter } from "next/navigation";
import { fetchColaboradores, inserirBancoHoras, fetchBancoHorasColaborador, somaMinutosBanco, fetchAllFolgasDaUnidade, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN } from "../../../lib/rh";
import { fetchPontoHoje, fetchPontosMes, registrarBatida } from "../../../lib/ponto";
import { fetchMarcacoesMes } from "../../../lib/ponto-marcacao";
import { comprovantesDoMes, mascararCpf } from "../../../lib/ponto-comprovante.mjs";
import { linhasJornadaSemana } from "../../../lib/jornada-semana.mjs";
import { fetchPins } from "../../../lib/seguranca";
import { fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { homeDoUsuario, sairDoSistema } from "../../../lib/auth";
import { useTempoReal } from "../../../lib/realtime";
import TecladoPin from "../../../components/ponto/TecladoPin";
import { supabase as clientePin } from "../../../lib/supabase";

const fmtMin = (m) => `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`;
// Data de hoje no fuso do tablet. toISOString() não serve: ele converte para
// UTC e, depois das 21h, devolveria o dia seguinte.
const isoLocalDeHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const horaDe = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
const strToMin = (hhmm) => { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Dia em que o lançamento do banco de horas entra: o da JORNADA. Era o dia em
// UTC, e quem saía depois das 21h de Brasília ganhava a hora extra no dia
// seguinte (14 lançamentos assim até 18/10/2026; no último dia do mês, caía no
// mês seguinte). Saída depois da meia-noite pertence à jornada de ontem.
const diaDaJornada = (reg) => reg?.data_referencia ? String(reg.data_referencia).slice(0, 10) : isoLocal(new Date());

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
      <div className="bg-hf-surface border border-hf-border rounded-3xl p-6 w-full max-w-xs text-center">
        <p className="text-lg font-black text-hf-text">{titulo}</p>
        <p className="text-hf-text-2 font-medium text-xs mb-5">{subtitulo}</p>
        <div className="flex gap-3 justify-center mb-5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? "bg-emerald-400" : "bg-hf-border"}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((d, i) => (
            <button key={i} disabled={d === ""}
              onClick={() => d === "⌫" ? setPin(p => p.slice(0, -1)) : d !== "" && digito(String(d))}
              className={`h-14 rounded-xl text-xl font-black transition-colors ${d === "" ? "invisible" : d === "⌫" ? "bg-hf-border text-hf-text hover:bg-hf-border-strong" : "bg-hf-elevated text-hf-text hover:bg-hf-border"}`}>
              {d}
            </button>
          ))}
        </div>
        {erro && <p className="text-red-700 text-xs font-bold mb-2">{erro}</p>}
        <button onClick={onClose} className="text-hf-text-2 hover:text-hf-text text-xs font-bold">Cancelar</button>
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
      <div className="bg-hf-surface border border-hf-border rounded-3xl p-6 w-full max-w-md">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-xl font-black text-hf-text">{titulo}</h3>
          <button onClick={onClose} className="text-hf-text-2 hover:text-hf-text p-1"><X size={20} /></button>
        </div>
        <p className="text-hf-text-2 font-medium text-sm mb-4">{subtitulo}</p>

        <p className="text-3xs font-bold uppercase tracking-widest text-hf-text-2 mb-2">Toque em um motivo (rápido)</p>
        <div className="space-y-2 mb-4">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button key={m} disabled={confirmando} onClick={() => onConfirm(m)}
              className="w-full text-left px-4 py-3 rounded-2xl bg-hf-elevated hover:bg-emerald-600 hover:text-white text-slate-200 font-bold transition-colors disabled:opacity-50">
              {m}
            </button>
          ))}
        </div>

        <p className="text-3xs font-bold uppercase tracking-widest text-hf-text-2 mb-2">Ou escreva o motivo</p>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2}
          placeholder="Motivo..." className="w-full p-3 bg-hf-elevated border border-hf-border rounded-2xl text-hf-text font-medium outline-none focus:border-emerald-500 resize-none mb-3" />
        <button disabled={confirmando || !texto.trim()} onClick={() => onConfirm(texto.trim())}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black flex items-center justify-center gap-2">
          {confirmando ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Confirmar
        </button>
      </div>
    </div>
  );
}

export default function PontoPage() {
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  // Conta só do ponto (conta rápida): não tem Painel nem Modo Tablet, só "Sair"
  // para entrar com outro login (dono, 24/11/2026).
  // Só para quem cai direto aqui (terminal do ponto / setor ou início no ponto):
  // conta de cozinha ou bar continua com o "Painel" para voltar ao trabalho.
  const contaSoPonto = !!sessao?.gerenciado && (["terminal_ponto", "setor"].includes(sessao?.tipo_acesso)
    || String(homeDoUsuario(sessao) || "").startsWith("/dashboard/rh/ponto"));
  const [confirmarSair, setConfirmarSair] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const sairDaConta = async () => {
    setSaindo(true);
    try { await sairDoSistema(); } catch { /* segue para o login */ }
    window.location.replace("/login");
  };
  // Tablet compartilhado (só ponto / Nico + ponto): cada um entra pelo PIN
  // (decisão do dono, 14/11/2026). Só vale quando o banco tem o PONTO-PIN-1;
  // sem ele, fica a lista por área de antes.
  const tabletCompartilhado = ["terminal_ponto", "setor"].includes(sessao?.tipo_acesso);
  const [modoPin, setModoPin] = useState(false);
  // Quem já tem PIN entra pelo PIN; quem ainda não tem toca no próprio nome
  // (23/11/2026: na troca para o sistema novo ninguém tem PIN ainda, e o
  // ponto não pode parar). Sem nenhum PIN na unidade, fica a lista de antes.
  const [idsComPin, setIdsComPin] = useState(() => new Set());
  useEffect(() => {
    if (!tabletCompartilhado || !unidadeAtiva) { setModoPin(false); return; }
    clientePin.rpc("hefisto_tem_pin", { p_unidade: unidadeAtiva }).then(({ data, error }) => {
      const ids = new Set(error ? [] : (data || []).map((x) => (typeof x === "string" ? x : Object.values(x)[0])));
      setIdsComPin(ids);
      setModoPin(!error && ids.size > 0);
    });
  }, [tabletCompartilhado, unidadeAtiva]);
  const router = useRouter();

  // Area escolhida na entrada; vazio mostra os tres cards.
  const [areaAtiva, setAreaAtiva] = useState("");
  const [colaboradores, setColaboradores] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [folgas, setFolgas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [letra, setLetra] = useState(""); // filtro A-Z (toque rapido no tablet)
  const [horaLocal, setHoraLocal] = useState(new Date());

  const [selecionado, setSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);
  // Comprovantes das batidas do mês (livro ponto_marcacao), no histórico da pessoa.
  const [comprovantes, setComprovantes] = useState([]);
  const [verComprovantes, setVerComprovantes] = useState(false);
  const [comprovanteAberto, setComprovanteAberto] = useState(null);
  // Mês que o funcionário está olhando no próprio histórico. Antes eram só os
  // 7 últimos dias, o que não dava para conferir o mês fechado nem contestar
  // uma batida do começo do mês.
  const [mesHistorico, setMesHistorico] = useState(() => isoLocal(new Date()).slice(0, 7));
  const [bancoMes, setBancoMes] = useState([]);
  const [batendo, setBatendo] = useState(false);
  const [sucesso, setSucesso] = useState(null); // { titulo, detalhe, tone }
  const [justif, setJustif] = useState(null);    // { tipo: 'retorno_cedo', tirou, faltou }
  // Nao existe mais PIN de atraso: desde que a batida atrasada parou de ser
  // travada (art. 74, I da Portaria 671/2021), o funcionario bate a hora em
  // que chegou e o atraso aparece no espelho. O modal antigo foi removido.
  const [pinAntecipada, setPinAntecipada] = useState(false);      // entrar ANTES do horário (reunião)
  const [escolhaAntecipada, setEscolhaAntecipada] = useState(null); // { min } — decisão do gerente

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
    const [rColab, rPontos, rFolgas] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
      fetchAllFolgasDaUnidade(unidadeAtiva),
    ]);
    // Extras têm recibo próprio e não participam do relógio de ponto.
    setColaboradores((rColab.data || []).filter(c =>
      (c.status || "ativo") !== "inativo" && c.tipo_contrato !== "Freelancer"
    ));
    setPontosHoje(rPontos.data || []);
    setFolgas(rFolgas.data || []);
    setLoading(false);
  }, [unidadeAtiva]);

  // A "liberação do dia" do extra saiu (RH-B1): a tabela não existe e extras
  // já ficam fora da lista acima. Nenhum contratado é bloqueado aqui.
  const bloqueadoFreela = () => false;

  // Tempo real: batida em QUALQUER aparelho aparece aqui na hora, sem atualizar
  useTempoReal(["registro_ponto", "colaboradores", "rh_folgas_esporadicas", "rh_banco_horas"], () => carregar(true));

  useEffect(() => {
    if (unidadeAtiva) carregar();
    const t = setInterval(() => setHoraLocal(new Date()), 1000);
    return () => clearInterval(t);
  }, [unidadeAtiva, carregar]);

  // Registro que vale AGORA para a pessoa.
  //
  // pontosHoje traz hoje E ontem de propósito, para o turno que vira a
  // meia-noite. O find sem filtro de data pegava o primeiro que achasse: quem
  // esqueceu de bater a saída ontem chegava hoje e a tela, lendo o dia
  // anterior, achava que a entrada "já foi" e oferecia SAÍDA P/ INTERVALO na
  // hora em que a pessoa ia bater a ENTRADA.
  //
  // A regra aqui é a mesma de registrarBatida, e tem que ser: quando as duas
  // discordam sobre qual é o dia corrente, a tela oferece uma batida que a
  // biblioteca recusa — ou grava no dia errado.
  const jornadaDeOntemAberta = (reg) => {
    if (!reg || !reg.hora_entrada || reg.hora_saida) return false;
    return (Date.now() - new Date(reg.hora_entrada).getTime()) < 20 * 3600000;
  };

  const registroDe = (colabId) => {
    const meus = pontosHoje.filter(p => p.colaborador_id === colabId);
    if (!meus.length) return null;
    const hojeISO = isoLocalDeHoje();
    const deHoje = meus.find(p => p.data_referencia === hojeISO);
    if (deHoje) return deHoje;
    // Sem registro de hoje: só continua no de ontem se a jornada estiver mesmo
    // aberta. Passou de 20h é dia esquecido, não turno da madrugada.
    const deOntem = meus.find(p => p.data_referencia < hojeISO);
    return jornadaDeOntemAberta(deOntem) ? deOntem : null;
  };

  // Abre a tela do funcionário INSTANTANEAMENTE; histórico/banco carregam em segundo plano
  const abrirFuncionario = (c) => {
    setSelecionado(c);
    setLetra("");
    setHistorico([]);
    setVerComprovantes(false);
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
    setComprovantes([]);
    setComprovanteAberto(null);
    fetchMarcacoesMes(selecionado.id, mesHistorico)
      .then(r => { if (ativo) setComprovantes(comprovantesDoMes(r.data)); })
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

  // Regra da casa (dono, 19/10/2026): hora extra é paga na folha, calculada
  // do ponto; o relógio não credita mais nada no banco de horas. O que precisa
  // ficar anotado (motivo do intervalo curto) entra como ocorrência, sem valor.
  const registrarOcorrencia = async (minutos, motivo, tipo) => {
    const hoje = diaDaJornada(registroDe(selecionado.id));
    const { error } = await inserirBancoHoras(unidadeAtiva, selecionado.id, hoje, minutos, motivo, tipo);
    return error ? `Não consegui anotar a ocorrência: ${error}` : "";
  };


  const mostrarSucesso = (titulo, detalhe, tone = "ok", comprovante = null) => {
    // Feedback sem olhar a tela: vibra e apita ao confirmar
    try { navigator.vibrate && navigator.vibrate(tone === "alerta" ? [120,80,120] : 180); const A = window.AudioContext || window.webkitAudioContext; if (A) { const ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = tone === "alerta" ? 320 : 880; g.gain.value = 0.08; o.start(); o.stop(ctx.currentTime + 0.18); } } catch (_) {}
    setSucesso({ titulo, detalhe, tone, comprovante });
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

  // Registra a batida de uma etapa.
  //
  // A hora GRAVADA é sempre a hora real do relógio. A tolerância não muda o
  // registro, só a conta: quem bateu 15:39 tem 15:39 no espelho, e o sistema
  // sabe que aqueles 60 segundos não geram atraso. Gravar 15:40 apagava a
  // marcação verdadeira — e é ela que a Portaria 671/2021 manda guardar.
  //
  // horaPrevista = horário do turno, usado só para decidir atraso/hora extra.
  const executarBatida = async (etapa, reg, horaPrevista = null, atrasoMin = 0, extrasSaida = {}) => {
    setBatendo(true);
    try {
      const recibo = await registrarBatida(selecionado.id, unidadeAtiva, etapa);
      if (recibo.error) { alert(recibo.error); return; }
      const agoraStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      // Comprovante da marcação (Portaria MTP 671/2021, art. 84): o trabalhador
      // tem direito a levar a prova do que bateu. Sem NSR não há comprovante
      // válido — e sem NSR o livro de marcações não recebeu a batida.
      // Campos obrigatórios do art. 79 da Portaria 671/2021. O que falta aqui
      // não é enfeite: comprovante sem NSR, sem local da prestação ou sem o
      // hash da marcação não cumpre a norma.
      const comprovante = recibo.nsr ? {
        nsr: recibo.nsr,
        hash: recibo.hash || null,
        local: unidadeInfo?.endereco || unidadeInfo?.nome || "",
        registroRep: unidadeInfo?.registro_inpi || "",
        etapa: ETAPAS.find(e => e.id === etapa)?.label || etapa,
        nome: selecionado.nome,
        cpf: selecionado.cpf || null,
        empresa: unidadeInfo?.nome || "",
        cnpj: unidadeInfo?.cnpj || "",
        em: new Date(recibo.marcadoEm || Date.now()),
      } : null;
      const primeiro = selecionado.nome.split(" ")[0];

      // Volta do intervalo com tempo ACIMA do padrão (fora da tolerância): excesso
      if (etapa === "retorno_intervalo" && reg?.hora_saida_intervalo) {
        const tirou = Math.round((Date.now() - new Date(reg.hora_saida_intervalo).getTime()) / 60000);
        const passou = tirou - intervaloPadrao;
        // A tolerância entra aqui, não no registro: voltar 2 min depois não é
        // excesso de intervalo, mas o horário gravado continua sendo o real.
        if (passou > cfgP.tolerancia_retorno) {
          const hoje = diaDaJornada(reg);
          await inserirBancoHoras(unidadeAtiva, selecionado.id, hoje, passou,
            `Passou ${passou}min do intervalo (tirou ${tirou}min de ${intervaloPadrao}min)`, "excesso");
          mostrarSucesso("Atenção ao horário de intervalo!",
            `${primeiro}, você tirou ${fmtMin(tirou)} — ${passou} minuto(s) além do intervalo de ${fmtMin(intervaloPadrao)}. Ficou registrado no seu histórico.`,
            "alerta", comprovante);
          return;
        }
      }

      // Entrada com atraso (fora da tolerância): mostra os minutos
      if (etapa === "entrada" && atrasoMin > 0) {
        mostrarSucesso(`Entrada às ${agoraStr}`, `${primeiro}, ${atrasoMin} min de atraso — ficou registrado no espelho.`, "alerta", comprovante);
        return;
      }

      // Saída DEPOIS do horário → vira hora extra no banco, automaticamente
      if (etapa === "saida_trabalho" && extrasSaida.extraMin > 0) {
        mostrarSucesso(`Saída às ${agoraStr}`,
          `${primeiro}, você passou ${extrasSaida.extraMin} min do horário (${extrasSaida.prevStr}). Entra como hora extra na folha do mês.`,
          "alerta", comprovante);
        return;
      }
      // Saída ANTES do horário → registrada como saída antecipada
      if (etapa === "saida_trabalho" && extrasSaida.saiuAntesMin > 0) {
        mostrarSucesso(`Saída às ${agoraStr}`,
          `${primeiro}, saída ${extrasSaida.saiuAntesMin} min antes do previsto (${extrasSaida.prevStr}) — registrado no espelho de ponto.`,
          "alerta", comprovante);
        return;
      }

      const msgs = {
        entrada: `Bom trabalho, ${primeiro}!`,
        saida_intervalo: `Bom intervalo, ${primeiro}!`,
        retorno_intervalo: `Bem-vindo de volta, ${primeiro}!`,
        saida_trabalho: `Até logo, ${primeiro}!`,
      };
      mostrarSucesso(`${ETAPAS.find(e => e.id === etapa)?.label} às ${agoraStr}`, msgs[etapa] || "", "ok", comprovante);
    } catch (e) {
      // Sem isto, qualquer exceção aqui fazia o botão não responder: o
      // funcionário aperta, nada acontece, e ninguém fica sabendo. Num tablet
      // de ponto, falha silenciosa é pior que erro na tela.
      console.error("Falha ao bater o ponto:", e);
      alert("Não consegui registrar a batida: " + (e?.message || e) + " — chame o gerente e não bata de novo antes de conferir.");
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
    // horaPrevista existe só para comparar; o que vai para o banco é a hora
    // real da batida, em qualquer etapa.
    let horaPrevista = null;
    let atrasoMin = 0;

    // ENTRADA: até 5 min depois (ou adiantado, já liberado) grava o horário do turno
    if (etapa === "entrada") {
      const entradaStr = entradaDoDia(selecionado, agora);
      if (entradaStr) {
        const prevista = comHora(agora, entradaStr);
        const diffMin = (agora.getTime() - prevista.getTime()) / 60000;
        if (diffMin <= cfgP.tolerancia_marcacao) horaPrevista = prevista;
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
      if (diffMin <= cfgP.tolerancia_retorno) horaPrevista = prevista;
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
        if (Math.abs(difMin) <= cfgP.tolerancia_marcacao) horaPrevista = prevista;
        else if (difMin > 0) extrasSaida = { extraMin: Math.round(difMin), prevStr: saidaStr };
        else extrasSaida = { saiuAntesMin: Math.round(-difMin), prevStr: saidaStr };
      }
    }

    await executarBatida(etapa, reg, horaPrevista, atrasoMin, extrasSaida);
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
      const hoje = isoLocal(new Date());
      setEscolhaAntecipada(null);
      if (modo === "extra") {
        mostrarSucesso(`Entrada às ${agoraStr}`,
          `${primeiro}, entrada ${min} min antes do horário, autorizada. Entra como hora extra na folha do mês.`);
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
        const aviso = await registrarOcorrencia(j.faltou, `Voltou ${j.tirou}min de intervalo (de ${intervaloPadrao}min). Motivo: ${motivo}`, "intervalo_curto");
        const agoraStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setJustif(null);
        mostrarSucesso(`Volta registrada às ${agoraStr}`,
          `${primeiro}, ${j.tirou} min de intervalo. Motivo anotado; o salário não muda. ${aviso}`);
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
      <div className={`erp-safe-top fixed inset-0 z-[9999] ${alerta ? "bg-amber-500" : "bg-emerald-600"} flex flex-col items-center justify-center p-4 sm:p-8 text-center animate-in fade-in duration-300`}>
        <div className="w-20 h-20 sm:w-28 sm:h-28 bg-card rounded-2xl sm:rounded-[32px] flex items-center justify-center mb-5 sm:mb-8 shadow-2xl">
          {alerta ? <AlertTriangle size={64} className="text-amber-500" /> : <CheckCircle2 size={64} className="text-success" />}
        </div>
        <h1 className="text-hf-text font-black text-3xl sm:text-4xl md:text-6xl tracking-tight max-w-3xl">{sucesso.titulo}</h1>
        {sucesso.detalhe && <p className={`${alerta ? "text-amber-50" : "text-emerald-700"} font-bold text-lg md:text-2xl mt-5 max-w-2xl leading-relaxed`}>{sucesso.detalhe}</p>}

        {/* O comprovante inteiro (com CPF) não aparece mais aqui, onde quem
            passa vê: fica no "Meu histórico" da pessoa (dono, 24/11/2026,
            "não dá pra imprimir o comprovante"). Aqui só o NSR, para conferir. */}
        {sucesso.comprovante && (
          <p className={`mt-6 rounded-2xl px-5 py-3 text-base font-bold ${alerta ? "bg-white/20 text-white" : "bg-white/20 text-white"}`}>
            Comprovante NSR {sucesso.comprovante.nsr} guardado no seu histórico
          </p>
        )}
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
    // Atraso não bloqueia mais a marcação. O art. 74, I da Portaria 671/2021
    // proíbe restrições de horário à marcação do ponto: quem chegou atrasado
    // bate a hora em que chegou, e o atraso aparece no espelho para o RH
    // tratar. Barrar a batida apagava a prova de que a pessoa trabalhou.
    const podeBater = etapa !== "concluido" && !bloqueiaFolga && !bloqueiaJanela;

    const fmtFalta = (ms) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    return (
      <div ref={containerRef} className="erp-safe-top fixed inset-0 z-[9999] bg-hf-bg overflow-y-auto font-sans">
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
            <div className="bg-hf-surface border border-hf-border rounded-3xl p-6 w-full max-w-sm text-center">
              <p className="text-lg font-black text-hf-text">{escolhaAntecipada.min} min antes do horário</p>
              <p className="text-hf-text-2 font-medium text-xs mb-5">Como tratar esse tempo adiantado (reunião/serviço)?</p>
              <div className="space-y-2">
                <button disabled={batendo} onClick={() => confirmarAntecipada("extra")} className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm disabled:opacity-50">
                  Contar como hora extra
                  <span className="block text-3xs font-bold opacity-80">vai para o banco de horas</span>
                </button>
                <button disabled={batendo} onClick={() => confirmarAntecipada("liberar")} className="w-full py-3.5 rounded-2xl bg-hf-elevated hover:bg-hf-border border border-hf-border-strong text-hf-text font-black text-sm disabled:opacity-50">
                  Vai ser liberado mais cedo hoje
                  <span className="block text-3xs font-bold opacity-70">só registra o combinado</span>
                </button>
              </div>
              <button onClick={() => setEscolhaAntecipada(null)} className="text-hf-text-2 hover:text-hf-text text-xs font-bold mt-4">Cancelar</button>
            </div>
          </div>
        )}
        {justif && (
          <ModalJustificativa
            titulo={`Voltando ${justif.tirou}min de intervalo`}
            subtitulo={`Faltam ${justif.faltou}min para completar ${fmtMin(intervaloPadrao)}. Diga o porquê de voltar antes:`}
            confirmando={batendo}
            onConfirm={confirmarJustificativa}
            onClose={() => setJustif(null)}
          />
        )}

        <div className="max-w-3xl mx-auto px-4 pb-6 pt-3 sm:p-6 md:p-10">
          {/* Compacto (dono, 24/11/2026): voltar, relógio e data numa linha só,
              para o cartão da pessoa e o botão de bater caberem na tela. */}
          <div className="mb-3 flex items-center gap-3">
            <button onClick={() => setSelecionado(null)} aria-label="Voltar para a lista" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border bg-hf-surface text-hf-text hover:bg-hf-elevated">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-3xl font-black leading-none tracking-tight text-hf-text tabular-nums sm:text-5xl">{horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-hf-text-2">{horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
            </div>
          </div>

          {/* Identificação */}
          <div className="bg-hf-surface border border-hf-border rounded-2xl p-3 mb-3 shadow-sm">
            <div className="flex items-center gap-3 text-left">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-xl font-black text-emerald-700 shrink-0">
                {selecionado.foto ? <img src={`data:image/jpeg;base64,${selecionado.foto}`} alt={selecionado.nome} className="w-full h-full object-cover" /> : selecionado.nome[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-hf-text leading-tight">{selecionado.nome}</h2>
                <p className="text-hf-text-2 font-bold text-xs uppercase tracking-wide">{selecionado.cargo || "—"}</p>
                {/* A jornada da semana inteira, agrupada como no espelho:
                    "Terça a domingo: 15:40 às 00:00", e o domingo em linha
                    própria quando tem horário diferente. Mostrar só o horário
                    de hoje escondia justamente o dia que muda — que é o dia em
                    que a pessoa erra. */}
                {linhasJornadaSemana(selecionado).map(linha => (
                  <p key={linha} className="text-hf-text font-semibold text-sm">{linha}</p>
                ))}
              </div>
            </div>
            {/* O cartão do banco de horas saiu daqui: a tela de bater ponto
                é para bater ponto. Saldo é assunto de conferência, e continua
                no histórico logo abaixo e no espelho do RH. */}
          </div>

          {/* Continuando a jornada da véspera: precisa estar escrito. Foi
              exatamente essa informação faltando que fez alguém bater a entrada
              e o sistema registrar como intervalo do dia anterior. */}
          {reg && reg.data_referencia !== isoLocalDeHoje() && (
            <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <p className="text-2xs font-bold uppercase tracking-widest text-amber-700">
                Jornada de {reg.data_referencia.slice(5).split("-").reverse().join("/")} ainda aberta
              </p>
              <p className="mt-1 text-xs font-bold leading-snug text-amber-700">
                A batida vai para aquele dia, não para hoje. Se você já encerrou
                aquele expediente, chame o gerente antes de bater.
              </p>
            </div>
          )}

          {/* Linha do dia: as 4 batidas */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {ETAPAS.map(e => {
              const hora = horaDe(reg?.[e.campo]);
              const puladoAqui = pulouIntervalo && (e.id === "saida_intervalo" || e.id === "retorno_intervalo");
              const ativa = e.id === etapa;
              return (
                <div key={e.id} className={`px-1 py-2 rounded-2xl border-2 text-center ${hora ? "bg-emerald-500/10 border-emerald-500/40" : puladoAqui ? "bg-amber-500/10 border-amber-500/30" : ativa ? "bg-hf-elevated border-hf-border-strong border-dashed" : "bg-hf-surface border-hf-border"}`}>
                  <e.icon size={18} className={`mx-auto mb-1 ${hora ? "text-emerald-700" : puladoAqui ? "text-amber-700" : "text-hf-text-2"}`} />
                  <p className="text-[10px] font-bold uppercase leading-tight text-hf-text-2 sm:text-xs">{e.label}</p>
                  <p className={`text-lg sm:text-2xl font-black tabular-nums mt-0.5 ${hora ? "text-emerald-700" : puladoAqui ? "text-amber-700 text-xs leading-tight" : "text-hf-text-2"}`}>
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
              <div className={`rounded-2xl p-3 text-center mb-3 border ${estourou ? "bg-rose-500/10 border-rose-500/40" : "bg-amber-500/10 border-amber-500/30"}`}>
                <p className={`text-3xs font-bold uppercase tracking-widest ${estourou ? "text-red-700" : "text-amber-700"}`}>
                  {estourou ? "Intervalo estourado" : "Em intervalo"}
                </p>
                <p className={`text-3xl sm:text-4xl font-black tabular-nums mt-1 ${estourou ? "text-red-700" : "text-amber-700"}`}>
                  {estourou ? `+${Math.floor(-resta / 60000)}min` : fmtFalta(resta)}
                </p>
                <p className="text-hf-text-2 font-bold text-xs mt-2">
                  {estourou
                    ? `A volta era às ${prevista.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — bata a volta agora`
                    : `volta às ${prevista.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              </div>
            );
          })()}

          {/* Ação principal */}
          {etapa === "concluido" ? (
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-4 text-center mb-4">
              <CheckCircle2 size={28} className="text-emerald-700 mx-auto mb-2" />
              <p className="text-xl font-black text-hf-text">Jornada de hoje concluída!</p>
              <p className="text-hf-text-2 font-bold text-sm mt-1">Todas as batidas foram registradas.</p>
            </div>
          ) : bloqueiaFolga ? (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-4 text-center mb-4">
              <Ban size={28} className="text-red-700 mx-auto mb-2" />
              <p className="text-xl font-black text-hf-text">Hoje é sua folga</p>
              <p className="text-red-700 font-bold text-sm mt-1">{info.motivo}. Não é possível bater o ponto em dia de folga.</p>
              <p className="text-hf-text-2 font-medium text-sm mt-2">Se isso está errado, procure a gerência para ajustar sua escala.</p>
            </div>
          ) : bloqueiaJanela ? (
            <div className="bg-hf-surface border-2 border-hf-border rounded-2xl p-4 sm:p-6 text-center mb-4 shadow-sm">
              <Timer size={32} className="text-amber-700 mx-auto mb-2" />
              <p className="text-xl sm:text-2xl font-black text-hf-text">Ainda não dá para bater a entrada</p>
              <p className="text-hf-text-2 font-bold text-sm mt-1">
                Seu horário é {janela.entradaStr}. A entrada libera às {janela.permiteEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
              </p>
              <p className="text-4xl sm:text-5xl font-black text-amber-700 tabular-nums mt-3 leading-none">{fmtFalta(janela.faltaMs)}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-hf-text-2 mt-1">faltam para liberar</p>
              <button onClick={() => setPinAntecipada(true)}
                className="mt-4 min-h-[52px] w-full max-w-md px-6 rounded-full bg-hf-menu text-white font-black text-base transition-colors">
                Reunião / serviço mais cedo? Liberar — PIN do gerente
              </button>
            </div>
          ) : (
            <button onClick={bater} disabled={batendo}
              className="w-full min-h-[64px] py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-2xl font-black text-xl md:text-2xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-3 mb-4">
              {batendo ? <Loader2 size={24} className="animate-spin" /> : etapaInfo && <etapaInfo.icon size={24} />}
              Bater: {etapaInfo?.label}
            </button>
          )}

          {/* O intervalo não é opcional: a CLT art. 71 obriga a concessão, e
              o §4º manda pagar como extra o período suprimido. Oferecer o botão
              de pular convidava à irregularidade e ainda deixava registrado que
              a casa sabia. Quem precisar encurtar bate a volta antes e
              justifica — aí fica a exceção, não a rotina. */}

          {/* Histórico do mês, com navegação. O funcionário precisa conseguir
              conferir o mês fechado — com 7 dias não dava para contestar uma
              batida do começo do mês. */}
          <div className="bg-hf-surface border border-hf-border rounded-3xl p-5">
            {/* Tudo encaixado no celular (dono, 24/11/2026): título em cima,
                mês embaixo ocupando a largura, sem nada cortado. */}
            <div className="mb-3 space-y-2">
              <p className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-hf-text-2"><Clock size={18} /> Meu histórico</p>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-hf-elevated p-1">
                <button onClick={() => andarMes(-1)} aria-label="Mês anterior"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-hf-surface text-lg text-hf-text">‹</button>
                <span className="min-w-0 flex-1 text-center text-sm font-bold text-hf-text">
                  {(() => { const t = new Date(`${mesHistorico}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })()}
                </span>
                <button onClick={() => andarMes(1)} disabled={mesEhFuturo} aria-label="Próximo mês"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-hf-surface text-lg text-hf-text disabled:opacity-30">›</button>
              </div>
            </div>
            {historico.length > 0 && (
              <p className="mb-2 text-2xs font-bold text-hf-text-2">
                {historico.length} dia(s) com registro neste mês
              </p>
            )}
            {historico.length === 0 ? (
              <p className="py-4 text-center text-lg font-medium text-hf-text-2">Nenhum registro neste mês.</p>
            ) : (
              <div className="space-y-1.5">
                {/* Rotulo em cima de cada coluna: quatro horarios seguidos sem
                    titulo obrigam a decorar a ordem. Mesma grade das linhas
                    para os titulos cairem exatamente sobre os numeros. */}
                <div className="grid grid-cols-[52px_repeat(4,minmax(0,1fr))] items-end gap-1 px-1.5 pb-1 text-center sm:grid-cols-[96px_repeat(4,minmax(0,1fr))] sm:gap-2 sm:px-2">
                  <span className="text-left text-3xs font-bold uppercase tracking-wide text-hf-text-2">Dia</span>
                  <span className="text-3xs font-bold uppercase tracking-wide text-hf-text-2">Entrada</span>
                  <span className="text-3xs font-bold uppercase tracking-wide text-hf-text-2">Saiu</span>
                  <span className="text-3xs font-bold uppercase tracking-wide text-hf-text-2">Voltou</span>
                  <span className="text-3xs font-bold uppercase tracking-wide text-hf-text-2">Saída</span>
                </div>
                {historico.map(h => (
                  <div key={h.id} className="grid grid-cols-[52px_repeat(4,minmax(0,1fr))] items-center gap-1 rounded-lg bg-hf-bg px-1.5 py-1.5 text-center sm:grid-cols-[96px_repeat(4,minmax(0,1fr))] sm:gap-2 sm:px-2">
                    {/* Dia da semana ao lado da data: quem confere o próprio
                        ponto lembra "no sábado eu saí tarde", não "no dia 15". */}
                    <span className="text-left text-2xs font-bold leading-tight text-hf-text-2">
                      {h.data_referencia?.slice(5).split("-").reverse().join("/")}
                      <span className="block sm:ml-1.5 sm:inline">{siglaDiaSemana(h.data_referencia)}</span>
                    </span>
                    {["hora_entrada", "hora_saida_intervalo", "hora_retorno_intervalo", "hora_saida"].map(c => (
                      <span key={c} className={`text-[13px] font-bold tabular-nums ${h[c] ? "text-hf-text" : "text-hf-text-2"}`}>{horaDe(h[c]) || "--:--"}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {/* Comprovantes das batidas (Portaria MTP 671/2021): cada marcação do
                livro, com NSR e hash. Toque para ver o comprovante completo. */}
            <div className="mt-4 border-t border-hf-border pt-3">
              <button type="button" onClick={() => setVerComprovantes(v => !v)} aria-expanded={verComprovantes}
                className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl bg-hf-elevated px-4 text-left">
                <span className="text-sm font-black uppercase tracking-wider text-hf-text-2">Meus comprovantes</span>
                <span className="text-sm font-bold text-hf-text">{comprovantes.length} {verComprovantes ? "▲" : "▼"}</span>
              </button>
              {verComprovantes && (
                comprovantes.length === 0 ? (
                  <p className="py-3 text-center text-sm text-hf-text-2">Nenhuma marcação neste mês.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {comprovantes.map(cp => {
                      const aberto = comprovanteAberto === cp.id;
                      return (
                        <li key={cp.id} className="rounded-xl bg-hf-bg">
                          <button type="button" onClick={() => setComprovanteAberto(aberto ? null : cp.id)} aria-expanded={aberto}
                            className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left">
                            <span className="w-11 shrink-0 text-2xs font-bold text-hf-text-2">{cp.dia.slice(5).split("-").reverse().join("/")}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-hf-text">{cp.rotulo}</span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-hf-text">{cp.em ? cp.em.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</span>
                            <span className="shrink-0 text-2xs font-bold tabular-nums text-hf-text-2">NSR {cp.nsr}</span>
                          </button>
                          {aberto && (
                            <div className="mx-3 mb-3 rounded-lg border border-hf-border bg-hf-surface p-3 font-mono text-xs leading-snug text-hf-text">
                              <p className="text-3xs font-bold uppercase tracking-[0.14em] text-hf-text-2">Comprovante de registro de ponto do trabalhador</p>
                              <p className="mt-1 text-2xl font-black tabular-nums">NSR {cp.nsr}</p>
                              <p className="mt-1">{unidadeInfo?.nome || ""}{unidadeInfo?.cnpj ? ` · CNPJ ${unidadeInfo.cnpj}` : ""}</p>
                              <p className="font-bold">{selecionado.nome}{mascararCpf(selecionado.cpf) ? ` · CPF ${mascararCpf(selecionado.cpf)}` : ""}</p>
                              <p>{cp.rotulo} · {cp.em ? cp.em.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }) : ""}</p>
                              {unidadeInfo?.endereco && <p>{unidadeInfo.endereco}</p>}
                              {cp.hash && <p className="mt-1 break-all text-3xs text-hf-text-2">SHA-256 {cp.hash}</p>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </div>
            {/* O resumo do banco de horas saiu daqui junto com o cartão do
                topo: a tela de bater ponto é para bater ponto. Saldo é
                assunto de conferência e continua no espelho do RH. */}
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
        className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left shadow-sm transition-all active:scale-[.98] ${reg?.hora_entrada && !concluido ? "bg-hf-surface border-zinc-500/40 hover:border-zinc-400/70" : info.folga || faltou ? "bg-rose-500/5 border-rose-500/30" : concluido ? "bg-hf-surface border-hf-border opacity-60" : "bg-hf-surface border-hf-border hover:border-emerald-500/60"}`}>
        <div className={`w-14 h-14 rounded-full overflow-hidden bg-hf-elevated flex items-center justify-center text-xl font-black shrink-0 ring-2 ${info.folga || faltou ? "ring-rose-500/40 text-red-700" : concluido ? "ring-hf-border text-hf-text-2" : reg?.hora_entrada ? "ring-emerald-500/70 text-emerald-700" : "ring-hf-border text-emerald-700"}`}>{c.foto ? <img src={`data:image/jpeg;base64,${c.foto}`} alt={c.nome} className="w-full h-full object-cover" /> : c.nome[0].toUpperCase()}</div>
        <div className="min-w-0 flex-1">
            <p className="font-black text-hf-text leading-tight break-words text-lg">{c.nome}</p>
            <p className="text-xs font-bold text-hf-text-2 uppercase tracking-wide truncate">{c.cargo || "—"}{entradaStr && !info.folga ? ` · ${entradaStr}${saidaDoDia(c, horaLocal) ? ` às ${saidaDoDia(c, horaLocal)}` : ""}` : ""}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {/* PRIORIDADE: jornada aberta (mesmo em dia de folga — turno de ontem
              que virou a madrugada) vem antes do selo de folga */}
          {/* Folga não é falta: sai em âmbar, não em vermelho. E cada tipo diz
              o próprio nome — quem monta a escala precisa saber se a pessoa
              está de folga semanal ou se foi a vez dela no domingo. */}
          <div className={`text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${bloqueado && !reg?.hora_entrada ? "bg-zinc-500/10 text-emerald-700" : reg?.hora_entrada && !concluido ? "bg-zinc-500/10 text-emerald-700" : info.folga ? (info.tipo === "domingo" ? "bg-amber-500/10 text-amber-700" : "bg-hf-border text-hf-text") : faltou ? "bg-rose-500/10 text-red-700" : concluido ? "bg-emerald-500/10 text-emerald-500" : "bg-hf-elevated text-hf-text-2"}`}>
            {bloqueado && !reg?.hora_entrada ? <><Ban size={13} /> Aguardando liberação</> : reg?.hora_entrada && !concluido ? <><Clock size={13} /> Próxima: {ETAPAS.find(e => e.id === etapa)?.label}</> : info.folga ? <><Ban size={13} /> {info.motivo}</> : faltou ? <><Ban size={13} /> Falta — não bateu até {entradaStr}+{cfgP.limite_atraso}min</> : concluido ? <><CheckCircle2 size={13} /> Jornada concluída</> : <><LogIn size={13} /> Aguardando entrada</>}
          </div>
        </div>
        </div>
      </button>
    );
  };

  const hNow = horaLocal.getHours();
  const saudacao = hNow >= 5 && hNow < 12 ? "Bom dia" : hNow >= 12 && hNow < 18 ? "Boa tarde" : "Boa noite";

  return (
    // Escolha de área: tudo numa tela só, fixo, sem rolar (pedido do dono, 06/11/2026).
    // A lista de pessoas de uma área continua rolando: pode ter muita gente.
    <div ref={containerRef} onClick={reforcarFullscreen} className={`erp-safe-top fixed inset-0 z-[9999] bg-hf-bg font-sans ${areaAtiva ? "overflow-y-auto" : "overflow-hidden"}`}>
      {pinSair && (
        <ModalPinGerente senha={pinGerente}
          titulo="Sair do Modo Ponto"
          subtitulo="Digite o PIN do gerente para destravar o tablet"
          onClose={() => setPinSair(false)}
          onSuccess={sairKiosk}
        />
      )}
      {confirmarSair && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Sair da conta">
          <div className="w-full max-w-sm rounded-3xl bg-hf-surface p-5 text-center shadow-xl">
            <p className="text-lg font-black text-hf-text">Sair desta conta?</p>
            <p className="mt-1 text-sm text-hf-text-2">Para voltar ao ponto neste aparelho será preciso entrar de novo com o login e a senha.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmarSair(false)} disabled={saindo} className="min-h-[48px] rounded-xl border border-hf-border font-bold text-hf-text">Cancelar</button>
              <button type="button" onClick={sairDaConta} disabled={saindo} className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-hf-menu font-bold text-white">{saindo ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Sair</button>
            </div>
          </div>
        </div>
      )}
      <div className={`max-w-4xl mx-auto ${areaAtiva ? "px-4 pb-6 pt-3 sm:p-6 md:p-10" : "flex h-full flex-col px-4 pb-4 pt-3 sm:px-6 md:p-10"}`}>
        <div className="mb-2 flex shrink-0 items-center justify-between sm:mb-4">
          {kiosk ? (
            <button onClick={() => setPinSair(true)} aria-label="Destravar com PIN do gerente" className="grid h-12 w-12 place-items-center bg-hf-surface hover:bg-hf-elevated text-hf-text-2 hover:text-hf-text rounded-2xl transition-colors border border-hf-border" title="Destravar com PIN do gerente">
              <Lock size={18} />
            </button>
          ) : contaSoPonto ? (
            <span />
          ) : (
            <button onClick={() => router.push("/dashboard")} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-hf-elevated px-3 text-sm font-bold text-hf-text transition-colors hover:bg-hf-border">
              <ArrowLeft size={16} /> Painel
            </button>
          )}
          {!kiosk && contaSoPonto && (
            <button onClick={() => setConfirmarSair(true)} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text-2 hover:text-hf-text" title="Sair desta conta e entrar com outro login">
              <LogOut size={16} /> Sair
            </button>
          )}
          {!kiosk && !contaSoPonto && (
            <button onClick={ativarKiosk} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500" title="Trava em tela cheia para tablet/celular — só sai com o PIN do gerente">
              <Tablet size={16} /> Modo Tablet
            </button>
          )}
        </div>

        <div className={`text-center relative shrink-0 ${areaAtiva ? "mb-4 sm:mb-6" : "mb-3 sm:mb-6"}`}>
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 w-[420px] max-w-full h-44 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
          <p className="text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-[0.3em] text-xs mb-1 relative">{saudacao}, Equipe</p>
          <h1 className={`font-black tabular-nums tracking-tight relative leading-none text-slate-900 dark:text-white ${areaAtiva ? "text-5xl sm:text-7xl md:text-8xl" : "text-[clamp(3rem,9vh,8rem)]"}`}>
            {/* Segundos não são enfeite: o Anexo IX, item 3, exige que o
                coletor exiba horas, minutos e segundos no momento da marcação. */}
            {horaLocal.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            <span className={`text-emerald-600 dark:text-emerald-400 font-black ml-2 ${areaAtiva ? "text-2xl sm:text-3xl md:text-4xl" : "text-[clamp(1.25rem,3.5vh,3rem)]"}`}>:{String(horaLocal.getSeconds()).padStart(2, "0")}</span>
          </h1>
          <p className="relative mt-1 text-xs font-bold uppercase tracking-wider text-hf-text-2 sm:mt-2 sm:text-sm">
            {horaLocal.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {unidadeInfo?.nome}
          </p>
          {/* Qual área está aberta, no meio e logo abaixo da hora: é a primeira
              coisa que quem chega procura para saber se está na lista certa. */}
          {areaAtiva && (
            <div className="relative mt-3 flex items-center justify-center gap-2">
              <button onClick={() => setAreaAtiva("")} aria-label="Trocar de área"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border bg-hf-surface text-hf-text hover:border-hf-accent">
                <ArrowLeft size={18} />
              </button>
              <p className="text-2xl font-black tracking-tight text-hf-text sm:text-3xl">
                {AREAS_PONTO.find(a => a.id === areaAtiva)?.titulo}
              </p>
            </div>
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
            <div className={`space-y-2 ${areaAtiva ? "mb-6" : "mb-3 max-h-[22vh] shrink-0 overflow-y-auto"}`}>
              {alertas.map((a, i) => {
                const zap = linkZap(a.c, a.msg);
                return (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl border bg-amber-500/10 border-amber-500/30 animate-pulse">
                    <Timer size={20} className="text-amber-700 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-amber-700 leading-tight">
                        {a.tipo === "entrada" ? `${a.c.nome.split(" ").slice(0, 2).join(" ")} entra às ${a.hora}` : `${a.c.nome.split(" ").slice(0, 2).join(" ")} volta do intervalo às ${a.hora}`}
                      </p>
                      <p className="text-2xs font-bold text-amber-500/80">faltam {a.falta} min</p>
                    </div>
                    {zap ? (
                      <a href={zap} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs text-hf-text shrink-0 active:scale-95 transition-transform"
                        style={{ background: "#25D366" }}>
                        <MessageCircle size={14} /> Lembrar no WhatsApp
                      </a>
                    ) : (
                      <span className="text-3xs font-bold text-hf-text-2 shrink-0">sem telefone no cadastro</span>
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
        {modoPin ? (
          <>
            <TecladoPin
              unidadeId={unidadeAtiva}
              onAchou={(id) => { const c = colaboradores.find((x) => x.id === id); if (c) abrirFuncionario(c); }}
            />
            {colaboradores.some((c) => !idsComPin.has(c.id)) && (
              <div className="mx-auto mt-6 w-full max-w-xl">
                <p className="mb-2 text-center text-sm font-bold text-hf-text-2">Ainda não tem PIN? Toque no seu nome</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {colaboradores.filter((c) => !idsComPin.has(c.id)).sort((a, b) => String(a.nome).localeCompare(String(b.nome))).map((c) => (
                    <button key={c.id} type="button" onClick={() => abrirFuncionario(c)}
                      className="min-h-[48px] rounded-full border border-hf-border bg-hf-surface px-4 text-[15px] font-bold text-hf-text">{c.nome}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : !areaAtiva ? (
          // As três áreas dividem o espaço que sobra da tela: no celular, uma
          // embaixo da outra (celular e tablet em pé); tablet deitado, lado a lado.
          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-3 gap-3 sm:gap-4 sm:landscape:grid-cols-3 sm:landscape:grid-rows-1">
            {AREAS_PONTO.map(area => {
              const Icone = area.icone;
              const quantos = colaboradores.filter(c => AREAS_DA_CATEGORIA[area.id].includes(categoriaFuncao(c.cargo))).length;
              return (
                // Centralizado e com letra grande (dono, 24/11/2026): lê de longe, toca sem mirar.
                // Celular: cartão deitado (ícone à esquerda, nome e pessoas ao lado),
                // os três cabem numa tela; tablet deitado: lado a lado (24/11/2026).
                <button key={area.id} onClick={() => setAreaAtiva(area.id)}
                  className="flex min-h-0 items-center gap-4 rounded-3xl border-2 border-hf-border bg-hf-surface px-5 py-3 text-left shadow-sm transition-all hover:border-hf-accent active:scale-[.98] sm:landscape:flex-col sm:landscape:justify-center sm:landscape:text-center">
                  <span className="grid h-[clamp(3.25rem,8vh,5.5rem)] w-[clamp(3.25rem,8vh,5.5rem)] shrink-0 place-items-center rounded-2xl" style={{ background: area.fundo, color: area.cor }}>
                    <Icone className="h-1/2 w-1/2" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[clamp(1.5rem,3.6vh,2.5rem)] font-black leading-tight tracking-tight text-hf-text">{area.nome}</span>
                    <span className="block text-base font-bold text-hf-text-2">{quantos === 1 ? "1 pessoa" : `${quantos} pessoas`}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null /* a seta de trocar de área fica ao lado do título */}
        {modoPin || !areaAtiva ? null : loading ? (
          <div className="text-center py-16"><Loader2 size={40} className="animate-spin text-hf-text-2 mx-auto" /></div>
        ) : filtrados.length === 0 ? (
          <p className="text-center text-hf-text-2 font-bold py-12">{colaboradores.length === 0 ? "Nenhum colaborador cadastrado no RH." : "Ninguém desta área está cadastrado no RH."}</p>
        ) : (
          <div className="space-y-4">
            {grupos.map(g => (
              <div key={g.cat}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-black uppercase tracking-widest text-hf-text-2">{g.cat}</p>
                  <span className="text-xs font-bold text-hf-text-2 bg-hf-surface border border-hf-border px-2 py-0.5 rounded-full">{g.itens.length}</span>
                  <div className="flex-1 h-px bg-hf-border" />
                </div>
                <div className="mx-auto grid max-w-3xl grid-cols-1 gap-2 md:grid-cols-2">
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
