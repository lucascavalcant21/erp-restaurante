"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock3,
  History,
  Loader2,
  Mic,
  PackageCheck,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Sparkles,
  X,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchEstoque } from "../../../lib/estoque";
import { fetchColaboradores } from "../../../lib/rh";
import {
  calcularCapacidadePorEstoque,
  calcularConsumoPorSaida,
  calcularMediasProducao,
  cancelarLoteProducao,
  converterDaBase,
  converterParaBase,
  dataSaoPaulo,
  fetchContagensProducao,
  fetchLotesProducao,
  fetchSaldosProducao,
  finalizarLoteProducao,
  formatarQuantidadeBase,
  iniciarLoteProducao,
  intervaloPeriodo,
  registrarContagemProducao,
  salvarPlanoProducao,
  unidadePadraoFicha,
} from "../../../lib/planejamentoProducao";

const STATUS = {
  planejado: { texto: "Planejado", classe: "bg-blue-50 text-blue-700 border-blue-200" },
  em_producao: { texto: "Em produção", classe: "bg-amber-50 text-amber-700 border-amber-200" },
  concluido: { texto: "Concluído", classe: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { texto: "Cancelado", classe: "bg-slate-100 text-slate-500 border-slate-200" },
};

const numero = (valor) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtBRL = (valor) => Number(valor || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatarData = (data) => {
  if (!data) return "—";
  const [ano, mes, dia] = String(data).slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
};

const escaparHtml = (valor) => String(valor ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizarTexto = (valor) => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const unidadeBase = (unidade) => {
  const un = normalizarTexto(unidade);
  if (["kg", "g", "quilo", "quilos", "grama", "gramas"].includes(un)) return "g";
  if (["l", "ml", "litro", "litros", "mililitro", "mililitros"].includes(un)) return "ml";
  return "un";
};

const subtrairDias = (data, dias) => {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const gerarIdOperacao = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const numerosFalados = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80,
  noventa: 90, cem: 100,
};

const ACOES_PRODUCAO = ["produzir", "fazer", "planejar", "preciso", "falta", "faltam", "meta"];
const ACOES_CONTAGEM = ["tenho", "tem", "pronto", "pronta", "estoque", "contagem", "sobrou", "sobraram"];

function extrairNumeroFalado(texto) {
  const numeroDigitado = texto.match(/\d+(?:[.,]\d+)?/);
  if (numeroDigitado) return numero(numeroDigitado[0]);
  const palavras = normalizarTexto(texto).split(" ");
  let total = 0;
  let encontrou = false;
  palavras.forEach((palavra) => {
    if (Object.prototype.hasOwnProperty.call(numerosFalados, palavra)) {
      total += numerosFalados[palavra];
      encontrou = true;
    }
  });
  return encontrou ? total : 0;
}

function trechoDepoisDoMarcador(texto, marcadores) {
  let melhor = null;
  marcadores.forEach((marcador) => {
    const correspondencia = new RegExp(`\\b${marcador}\\b`).exec(texto);
    if (correspondencia && (!melhor || correspondencia.index < melhor.indice)) {
      melhor = { indice: correspondencia.index, fim: correspondencia.index + correspondencia[0].length };
    }
  });
  return melhor ? texto.slice(melhor.fim).trim() : texto;
}

function extrairQuantidadeDaVoz(transcricao, ficha, acao) {
  const nome = normalizarTexto(ficha?.nome_receita);
  const semNome = normalizarTexto(transcricao).replace(nome, " ").replace(/\s+/g, " ").trim();
  const marcadores = acao === "planejamento" ? ACOES_PRODUCAO : ACOES_CONTAGEM;
  const depoisDaAcao = trechoDepoisDoMarcador(semNome, marcadores);
  return extrairNumeroFalado(depoisDaAcao) || extrairNumeroFalado(semNome);
}

function interpretarVoz(transcricao, fichas) {
  const texto = normalizarTexto(transcricao);
  const encontradas = fichas
    .map((ficha) => ({ ficha, nome: normalizarTexto(ficha.nome_receita) }))
    .filter(({ nome }) => nome && texto.includes(nome))
    .sort((a, b) => b.nome.length - a.nome.length);
  if (!encontradas.length) return { erro: "Não reconheci o produto. Diga o nome como está na receita." };
  const maiorNome = encontradas[0].nome.length;
  const correspondencias = encontradas.filter(({ nome }) => nome.length === maiorNome);
  if (correspondencias.length !== 1) return { erro: "Encontrei mais de uma receita. Diga um produto por vez." };
  const ficha = correspondencias[0].ficha;

  // Frases como "tenho que produzir" são planejamento, não contagem.
  const acao = new RegExp(`\\b(${ACOES_PRODUCAO.join("|")})\\b`).test(texto)
    ? "planejamento"
    : new RegExp(`\\b(${ACOES_CONTAGEM.join("|")})\\b`).test(texto)
      ? "contagem"
      : null;
  if (!acao) return { erro: "Diga se é uma contagem ou produção. Exemplo: ‘Tenho 3 kg’ ou ‘Produzir 5 kg’." };

  // Remove primeiro o nome da receita para não usar números como o "4" de
  // "molho 4 queijos" e procura a quantidade depois do verbo da ação.
  const quantidade = extrairQuantidadeDaVoz(transcricao, ficha, acao);
  if (quantidade <= 0) return { erro: "Não reconheci a quantidade. Exemplo: ‘Feijão, tenho cinco quilos’." };

  let unidade = unidadePadraoFicha(ficha);
  if (/\b(kg|quilo|quilos)\b/.test(texto)) unidade = "kg";
  else if (/\b(g|grama|gramas)\b/.test(texto)) unidade = "g";
  else if (/\b(ml|mililitro|mililitros)\b/.test(texto)) unidade = "ml";
  else if (/\b(l|litro|litros)\b/.test(texto)) unidade = "L";
  else if (/\b(unidade|unidades|porcao|porcoes)\b/.test(texto)) unidade = "un";

  const familiaEsperada = unidadeBase(unidadePadraoFicha(ficha));
  const familiaInformada = unidadeBase(unidade);
  const quantidadeBase = converterParaBase(quantidade, unidade);
  if (familiaInformada !== familiaEsperada || !Number.isFinite(quantidadeBase)) {
    return { erro: "A unidade informada não combina com essa receita." };
  }
  return { ficha, quantidade, unidade, acao, transcricao };
}

function StatusBadge({ status }) {
  const cfg = STATUS[status] || STATUS.planejado;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${cfg.classe}`}>{cfg.texto}</span>;
}

function Kpi({ icon: Icon, titulo, valor, detalhe, cor = "text-emerald-600", fundo = "bg-emerald-50" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 min-w-0 shadow-sm">
      <div className={`w-10 h-10 ${fundo} ${cor} rounded-xl flex items-center justify-center mb-3`}><Icon size={20} /></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{titulo}</p>
      <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-words">{valor}</p>
      {detalhe && <p className="text-xs font-semibold text-slate-500 mt-1">{detalhe}</p>}
    </div>
  );
}

function ProducaoRunner() {
  const searchParams = useSearchParams();
  const departamento = searchParams.get("dept") === "bar" ? "bar" : "cozinha";
  const { unidadeAtiva, unidadeInfo, abrirMenu } = useERP();
  const [aba, setAba] = useState("planejamento");
  const [periodo, setPeriodo] = useState("dia");
  const [dataReferencia, setDataReferencia] = useState(() => dataSaoPaulo());
  const [fichas, setFichas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [contagens, setContagens] = useState([]);
  const [saldos, setSaldos] = useState([]);
  const [plano, setPlano] = useState({});
  const [loading, setLoading] = useState(true);
  const [dadosConfiaveis, setDadosConfiaveis] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [acaoId, setAcaoId] = useState(null);
  const [erroBanco, setErroBanco] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [modalFinalizar, setModalFinalizar] = useState(null);
  const [finalizacao, setFinalizacao] = useState({ quantidade: "", unidade: "kg", observacoes: "" });
  const [ouvindo, setOuvindo] = useState(false);
  const [rascunhoVoz, setRascunhoVoz] = useState(null);
  const [planoSujo, setPlanoSujo] = useState(false);
  const [hoje, setHoje] = useState(() => dataSaoPaulo());
  const recognitionRef = useRef(null);
  const carregarRequestIdRef = useRef(0);
  const mutacaoRef = useRef(false);
  const chavesContagemRef = useRef(new Map());
  const modoDia = periodo === "dia";
  const contagemEditavel = modoDia && dataReferencia === hoje;
  const mutacaoEmCurso = salvando || acaoId !== null;

  const intervalo = useMemo(() => intervaloPeriodo(dataReferencia, periodo), [dataReferencia, periodo]);
  const lotesDoPeriodo = useMemo(() => lotes.filter((lote) => {
    const data = String(lote.data_producao || lote.created_at || "").slice(0, 10);
    return data >= intervalo.inicio && data <= intervalo.fim;
  }), [lotes, intervalo]);
  const contagensDoPeriodo = useMemo(() => contagens.filter((contagem) => {
    const data = String(contagem.data_contagem || contagem.created_at || "").slice(0, 10);
    return data >= intervalo.inicio && data <= intervalo.fim;
  }), [contagens, intervalo]);

  useEffect(() => {
    const atualizarHoje = () => setHoje((anterior) => {
      const atual = dataSaoPaulo();
      return anterior === atual ? anterior : atual;
    });
    const aoVisibilizar = () => { if (!document.hidden) atualizarHoje(); };
    const timer = window.setInterval(atualizarHoje, 15000);
    document.addEventListener("visibilitychange", aoVisibilizar);
    window.addEventListener("focus", atualizarHoje);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVisibilizar);
      window.removeEventListener("focus", atualizarHoje);
    };
  }, []);

  useEffect(() => {
    chavesContagemRef.current.clear();
  }, [unidadeAtiva, departamento, dataReferencia]);

  const adquirirMutacao = (id = "__global__") => {
    if (mutacaoRef.current) return false;
    if (!dadosConfiaveis) {
      alert("Os dados de produção não estão confirmados. Atualize a tela antes de continuar.");
      return false;
    }
    mutacaoRef.current = true;
    setAcaoId(id);
    return true;
  };

  const liberarMutacao = () => {
    mutacaoRef.current = false;
    setAcaoId(null);
  };

  const carregar = useCallback(async (silencioso = false) => {
    const requestId = ++carregarRequestIdRef.current;
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setFichas([]);
      setColaboradores([]);
      setEstoque([]);
      setLotes([]);
      setContagens([]);
      setSaldos([]);
      setPlano({});
      setErroBanco("");
      setDadosConfiaveis(false);
      setLoading(false);
      return { error: "Selecione uma unidade." };
    }
    if (!silencioso) setLoading(true);
    setDadosConfiaveis(false);
    setErroBanco("");
    try {
      const inicioHistorico = subtrairDias(hoje, 400);
      const fimDoMes = intervaloPeriodo(dataReferencia, "mes").fim;
      const fimDaSemana = intervaloPeriodo(dataReferencia, "semana").fim;
      // Carrega antecipadamente o mês e a semana completa. Assim a alternância
      // Dia/Semana/Mês continua local e não apaga o rascunho diário.
      const fimConsulta = [fimDoMes, fimDaSemana, hoje].sort().at(-1);
      const [rFichas, rColab, rEstoque, rLotes, rContagens, rSaldos] = await Promise.all([
        // Fichas e estoque completos são necessários para resolver sub-receitas
        // e ingredientes compartilhados. O departamento filtra somente os cards.
        fetchFichas(unidadeAtiva),
        fetchColaboradores(unidadeAtiva),
        fetchEstoque(unidadeAtiva),
        fetchLotesProducao(unidadeAtiva, { departamento, inicio: inicioHistorico, fim: fimConsulta, limite: 3000 }),
        fetchContagensProducao(unidadeAtiva, { departamento, inicio: inicioHistorico, fim: fimConsulta, limite: 3000 }),
        fetchSaldosProducao(unidadeAtiva, departamento),
      ]);
      if (requestId !== carregarRequestIdRef.current) return { ignorado: true };
      const respostas = [rFichas, rColab, rEstoque, rLotes, rContagens, rSaldos];
      const respostaComErro = respostas.find((r) => r?.error);
      if (respostaComErro) {
        const erro = new Error(respostaComErro.codigo === "MIGRACAO_PENDENTE"
          ? "A atualização do banco de produção ainda não foi aplicada."
          : respostaComErro.error || "Não foi possível confirmar os dados de produção.");
        erro.codigo = respostaComErro.codigo;
        throw erro;
      }
      setFichas(rFichas.data || []);
      setColaboradores((rColab.data || []).filter((c) => c.ativo !== false && c.status !== "inativo"));
      setEstoque(rEstoque.data || []);
      setLotes(rLotes.data || []);
      setContagens(rContagens.data || []);
      setSaldos(rSaldos.data || []);
      setDadosConfiaveis(true);
      return { error: null };
    } catch (error) {
      if (requestId !== carregarRequestIdRef.current) return { ignorado: true };
      setDadosConfiaveis(false);
      setErroBanco(error?.message || "Não foi possível carregar os dados de produção.");
      return { error: error?.message || "Falha ao carregar" };
    } finally {
      if (requestId === carregarRequestIdRef.current) setLoading(false);
    }
  }, [unidadeAtiva, departamento, dataReferencia, hoje]);

  useEffect(() => { carregar(); }, [carregar]);

  const fichasDoDepartamento = useMemo(() => fichas.filter((ficha) => (
    normalizarTexto(ficha.departamento) === departamento
  )), [fichas, departamento]);
  const medias = useMemo(() => calcularMediasProducao(fichas, lotes, dataReferencia), [fichas, lotes, dataReferencia]);
  const saldoPorFicha = useMemo(() => Object.fromEntries(saldos.map((s) => [s.ficha_id, s])), [saldos]);
  const loteDoDiaPorFicha = useMemo(() => {
    const ativos = lotes.filter((lote) => (
      String(lote.data_producao).slice(0, 10) === dataReferencia
      && ["planejado", "em_producao"].includes(lote.status)
    ));
    return ativos.reduce((mapa, lote) => {
      const atual = mapa[lote.ficha_id];
      const prioridade = lote.status === "em_producao" ? 2 : 1;
      const prioridadeAtual = atual?.status === "em_producao" ? 2 : atual ? 1 : 0;
      const criado = String(lote.updated_at || lote.created_at || "");
      const criadoAtual = String(atual?.updated_at || atual?.created_at || "");
      if (!atual || prioridade > prioridadeAtual || (prioridade === prioridadeAtual && criado > criadoAtual)) {
        mapa[lote.ficha_id] = lote;
      }
      return mapa;
    }, {});
  }, [lotes, dataReferencia]);

  useEffect(() => {
    const proximo = {};
    fichasDoDepartamento.forEach((ficha) => {
      const lote = loteDoDiaPorFicha[ficha.id];
      const unidade = lote?.unidade_planejada || unidadePadraoFicha(ficha);
      // O saldo mostrado é sempre o saldo pronto atual. O valor gravado no lote é
      // apenas um retrato histórico e nunca deve voltar para o campo de contagem.
      const saldoBase = saldoPorFicha[ficha.id]?.quantidade_base ?? 0;
      proximo[ficha.id] = {
        quantidade: lote?.quantidade_planejada ?? "",
        unidade,
        estoquePronto: converterDaBase(saldoBase, unidade),
        responsavelId: lote?.responsavel_planejado_id || "",
        origem: lote?.origem || "manual",
        transcricao: lote?.transcricao_audio || "",
      };
    });
    setPlano(proximo);
    setPlanoSujo(false);
  }, [fichasDoDepartamento, loteDoDiaPorFicha, saldoPorFicha]);

  const mediaDaFicha = useCallback((fichaId) => {
    if (medias instanceof Map) return medias.get(fichaId) || {};
    if (Array.isArray(medias)) return medias.find((m) => m.ficha_id === fichaId) || {};
    return medias?.[fichaId] || {};
  }, [medias]);

  const cards = useMemo(() => fichasDoDepartamento.map((ficha) => {
    const item = plano[ficha.id] || { quantidade: "", unidade: unidadePadraoFicha(ficha), estoquePronto: 0 };
    const media = mediaDaFicha(ficha.id);
    const saldoBase = converterParaBase(numero(item.estoquePronto), item.unidade);
    const mediaDiaBase = numero(media.mediaDiaBase ?? media.mediaDiaSemanaBase ?? media.media_dia_base);
    const mediaSemanaBase = numero(media.mediaSemanaBase ?? media.mediaSemanalBase ?? media.media_semana_base);
    const mediaMesBase = numero(media.mediaMesBase ?? media.mediaMensalBase ?? media.media_mes_base);
    const custoMedioDia = numero(media.custoMedioDia ?? media.custoMedioDiaSemana ?? media.custo_medio_dia);
    const custoMedioSemana = numero(media.custoMedioSemana ?? media.custoMedioSemanal ?? media.custo_medio_semana);
    const custoMedioMes = numero(media.custoMedioMes ?? media.custoMedioMensal ?? media.custo_medio_mes);
    const previsaoBase = periodo === "semana" ? mediaSemanaBase : periodo === "mes" ? mediaMesBase : mediaDiaBase;
    const custoMedioReferencia = periodo === "semana" ? custoMedioSemana : periodo === "mes" ? custoMedioMes : custoMedioDia;
    const quantidadeBase = converterParaBase(numero(item.quantidade), item.unidade);
    const lotesAbertosBase = lotes
      .filter((l) => l.ficha_id === ficha.id && l.status === "em_producao")
      .reduce((s, l) => s + numero(l.quantidade_planejada_base), 0);
    const sugestaoBase = Math.max(0, previsaoBase - saldoBase - lotesAbertosBase);
    const calculo = numero(item.quantidade) > 0
      ? calcularConsumoPorSaida(ficha, numero(item.quantidade), item.unidade, fichas)
      : { itens: [], erros: [], custoTotal: 0 };
    const capacidade = calcularCapacidadePorEstoque(ficha, estoque, fichas, item.unidade);
    const capacidadeBase = Number(capacidade.capacidadeBase ?? capacidade.capacidade_base);
    const capacidadeCalculada = !capacidade.erros?.length
      && (capacidade.itens?.length || 0) > 0
      && Number.isFinite(capacidadeBase)
      && capacidadeBase >= 0;
    const lote = loteDoDiaPorFicha[ficha.id];
    const lotesFichaPeriodo = lotesDoPeriodo.filter((l) => l.ficha_id === ficha.id);
    const produzidoPeriodoBase = lotesFichaPeriodo
      .filter((l) => l.status === "concluido")
      .reduce((total, l) => total + numero(
        l.quantidade_produzida_base
        ?? converterParaBase(l.quantidade_produzida, l.unidade_produzida || item.unidade),
      ), 0);
    const custoRealPeriodo = lotesFichaPeriodo
      .filter((l) => l.status === "concluido")
      .reduce((total, l) => total + numero(l.custo_real ?? l.custo_previsto), 0);
    return {
      ficha, item, media, saldoBase, mediaDiaBase, mediaSemanaBase, mediaMesBase,
      custoMedioDia, custoMedioSemana, custoMedioMes, custoMedioReferencia,
      previsaoBase, quantidadeBase, sugestaoBase, calculo, capacidade,
      capacidadeBase, capacidadeCalculada, lote, lotesFichaPeriodo,
      produzidoPeriodoBase, custoRealPeriodo,
    };
  }), [fichasDoDepartamento, fichas, plano, mediaDaFicha, lotes, estoque, loteDoDiaPorFicha, lotesDoPeriodo, periodo]);

  const concluidosPeriodo = lotesDoPeriodo.filter((l) => l.status === "concluido");
  const emProducao = lotes.filter((l) => l.status === "em_producao");
  const custoPeriodo = concluidosPeriodo.reduce((s, l) => s + numero(l.custo_real ?? l.custo_previsto), 0);
  const planejadosHoje = cards.filter((c) => c.quantidadeBase > 0).length;
  const produtosPrevistos = cards.filter((c) => c.previsaoBase > 0).length;

  const alterarPlano = (fichaId, patch) => {
    if (mutacaoRef.current || !dadosConfiaveis) return;
    setPlanoSujo(true);
    setPlano((atual) => ({
      ...atual,
      [fichaId]: { ...(atual[fichaId] || {}), ...patch },
    }));
  };

  const alterarUnidadePlano = (card, novaUnidade) => {
    const saldoBase = converterParaBase(numero(card.item.estoquePronto), card.item.unidade);
    const quantidadeBase = converterParaBase(numero(card.item.quantidade), card.item.unidade);
    alterarPlano(card.ficha.id, {
      unidade: novaUnidade,
      estoquePronto: Number(converterDaBase(saldoBase, novaUnidade).toFixed(3)),
      quantidade: quantidadeBase > 0 ? Number(converterDaBase(quantidadeBase, novaUnidade).toFixed(3)) : "",
    });
  };

  const montarItensParaSalvar = () => cards.map((card) => {
    const responsavel = colaboradores.find((c) => c.id === card.item.responsavelId);
    const ingredientes = (card.calculo.itens || []).map((i) => ({
      insumo_id: i.insumo?.id || i.insumo_id,
      nome: i.insumo?.nome || i.nome,
      quantidade: numero(i.quantidade),
      unidade: i.insumo?.unidade_medida || i.unidade,
      custo_unitario: numero(i.insumo?.custo_unitario ?? i.custo_unitario),
    })).sort((a, b) => String(a.insumo_id).localeCompare(String(b.insumo_id)));
    return {
      id: card.lote?.id,
      ficha_id: card.ficha.id,
      ficha_nome: card.ficha.nome_receita,
      status: card.lote?.status || "planejado",
      quantidade_planejada: numero(card.item.quantidade),
      unidade_planejada: card.item.unidade,
      quantidade_planejada_base: card.quantidadeBase,
      unidade_base: unidadeBase(card.item.unidade),
      estoque_pronto_informado_base: card.saldoBase,
      media_dia_base: card.mediaDiaBase,
      media_semana_base: card.mediaSemanaBase,
      media_mes_base: card.mediaMesBase,
      margem_seguranca_pct: 0,
      responsavel_planejado_id: responsavel?.id || null,
      responsavel_planejado_nome: responsavel?.nome || "",
      custo_previsto: numero(card.calculo.custoTotal),
      ingredientes_previstos: ingredientes,
      origem: card.item.origem || "manual",
      transcricao_audio: card.item.transcricao || null,
    };
  });

  const chaveContagemEstavel = (item) => {
    const assinatura = JSON.stringify({
      unidadeAtiva,
      departamento,
      dataReferencia,
      fichaId: item.ficha_id,
      quantidadeBase: Number(item.estoque_pronto_informado_base).toFixed(6),
      unidadeBase: item.unidade_base,
      origem: item.origem,
      transcricao: item.transcricao_audio,
      colaboradorId: item.responsavel_planejado_id,
    });
    if (!chavesContagemRef.current.has(assinatura)) {
      chavesContagemRef.current.set(assinatura, `producao-web-${gerarIdOperacao()}`);
    }
    return chavesContagemRef.current.get(assinatura);
  };

  const persistirPlano = async ({ mostrarMensagem = true, mutacaoAdquirida = false } = {}) => {
    if (!modoDia) {
      alert("A semana e o mês são previsões consolidadas. Para salvar ou iniciar, volte para Dia.");
      return { error: "Edição disponível somente no modo Dia." };
    }
    const donaDaMutacao = !mutacaoAdquirida;
    if (donaDaMutacao && !adquirirMutacao("__salvar__")) return { error: "Outra operação está em andamento." };
    setSalvando(true);
    setMensagem("");
    const itens = montarItensParaSalvar();
    let planoFoiSalvo = false;
    try {
      // Primeiro persiste o plano. A contagem do saldo pronto vem depois e só
      // pode alterar o saldo do dia atual.
      const resposta = await salvarPlanoProducao(unidadeAtiva, {
        departamento,
        data_producao: dataReferencia,
      }, itens);
      if (resposta.error) {
        if (resposta.codigo === "MIGRACAO_PENDENTE") setErroBanco("A atualização do banco de produção ainda não foi aplicada.");
        await carregar(true);
        alert(`Não foi possível salvar o plano: ${resposta.error}`);
        return resposta;
      }
      planoFoiSalvo = true;

      if (contagemEditavel) {
        for (const item of itens) {
          const saldoAtual = numero(saldoPorFicha[item.ficha_id]?.quantidade_base);
          if (Math.abs(saldoAtual - item.estoque_pronto_informado_base) > 0.0001) {
            const contagem = await registrarContagemProducao({
              unidadeId: unidadeAtiva,
              fichaId: item.ficha_id,
              dataReferencia,
              quantidadeBase: item.estoque_pronto_informado_base,
              unidadeBase: item.unidade_base,
              origem: item.origem,
              transcricao: item.transcricao_audio,
              colaboradorId: item.responsavel_planejado_id,
              chaveIdempotencia: chaveContagemEstavel(item),
            });
            if (contagem.error) {
              // O plano ou contagens anteriores desta tentativa podem ter sido
              // gravados. Recarregar evita repetir o histórico com saldo antigo.
              await carregar(true);
              alert(`O plano foi salvo, mas não foi possível salvar a contagem: ${contagem.error}`);
              return contagem;
            }
          }
        }
      }

      setPlanoSujo(false);
      if (mostrarMensagem) {
        setMensagem(contagemEditavel
          ? "Plano e contagens de hoje salvos para toda a equipe."
          : "Plano salvo. O saldo pronto é somente leitura fora da data de hoje.");
      }
      const recarga = await carregar(true);
      if (!recarga?.error) chavesContagemRef.current.clear();
      return resposta;
    } catch (error) {
      if (planoFoiSalvo) await carregar(true);
      const detalhe = error?.message || "erro inesperado";
      alert(`Não foi possível concluir o salvamento: ${detalhe}`);
      return { error: detalhe };
    } finally {
      setSalvando(false);
      if (donaDaMutacao) liberarMutacao();
    }
  };

  const usarSugestao = (card) => {
    const quantidade = converterDaBase(card.sugestaoBase, card.item.unidade);
    alterarPlano(card.ficha.id, { quantidade: quantidade > 0 ? Number(quantidade.toFixed(3)) : "" });
  };

  const iniciar = async (card) => {
    if (!modoDia) return alert("A execução é feita por dia. Volte para Dia para iniciar a produção.");
    if (card.quantidadeBase <= 0) return alert("Informe quanto deve ser produzido.");
    if (!card.item.responsavelId) return alert("Selecione o responsável pela produção.");
    if (card.calculo.erros?.length) return alert(card.calculo.erros.join("\n"));
    if (!card.capacidadeCalculada) {
      return alert(card.capacidade.erros?.join("\n") || "Não foi possível calcular a capacidade do estoque para esta receita.");
    }
    if (card.capacidadeBase <= 0) {
      return alert("Não há estoque disponível para iniciar esta produção.");
    }
    if (card.quantidadeBase > card.capacidadeBase + 0.0001) {
      return alert(`O estoque permite produzir no máximo ${formatarQuantidadeBase(card.capacidadeBase, card.item.unidade)}.`);
    }

    if (!adquirirMutacao(card.ficha.id)) return;
    try {
      const salvo = await persistirPlano({ mostrarMensagem: false, mutacaoAdquirida: true });
      if (salvo.error) return;
      const lote = (salvo.data || []).find((l) => l.ficha_id === card.ficha.id)
        || loteDoDiaPorFicha[card.ficha.id];
      if (!lote?.id) return alert("O plano foi salvo. Clique novamente em Iniciar produção.");
      const colaborador = colaboradores.find((c) => c.id === card.item.responsavelId);
      const ingredientes = (card.calculo.itens || []).map((i) => ({
        insumo_id: i.insumo?.id || i.insumo_id,
        nome: i.insumo?.nome || i.nome,
        quantidade: numero(i.quantidade),
        unidade: i.insumo?.unidade_medida || i.unidade,
        custo_unitario: numero(i.insumo?.custo_unitario ?? i.custo_unitario),
      })).sort((a, b) => String(a.insumo_id).localeCompare(String(b.insumo_id)));
      const resposta = await iniciarLoteProducao({
        loteId: lote.id,
        colaboradorId: colaborador?.id,
        colaboradorNome: colaborador?.nome,
        ingredientes,
        custoPrevisto: numero(card.calculo.custoTotal),
      });
      if (resposta.error) return alert(`Não foi possível iniciar: ${resposta.error}`);
      setMensagem(`${card.ficha.nome_receita} iniciado. Os ingredientes foram baixados do estoque.`);
      await carregar(true);
      setAba("andamento");
    } catch (error) {
      alert(`Não foi possível iniciar: ${error?.message || "erro inesperado"}`);
      await carregar(true);
    } finally {
      liberarMutacao();
    }
  };

  const abrirFinalizacao = (lote) => {
    setModalFinalizar(lote);
    setFinalizacao({
      quantidade: lote.quantidade_planejada || "",
      unidade: lote.unidade_planejada || "kg",
      observacoes: "",
    });
  };

  const alterarUnidadeFinalizacao = (novaUnidade) => {
    const base = converterParaBase(numero(finalizacao.quantidade), finalizacao.unidade);
    setFinalizacao((f) => ({
      ...f,
      unidade: novaUnidade,
      quantidade: base > 0 ? Number(converterDaBase(base, novaUnidade).toFixed(3)) : "",
    }));
  };

  const finalizar = async () => {
    const quantidade = numero(finalizacao.quantidade);
    if (quantidade <= 0) return alert("Informe o peso ou quantidade realmente produzida.");
    if (!modalFinalizar?.id || !adquirirMutacao(modalFinalizar.id)) return;
    try {
      const resposta = await finalizarLoteProducao({
        loteId: modalFinalizar.id,
        quantidade,
        unidade: finalizacao.unidade,
        quantidadeBase: converterParaBase(quantidade, finalizacao.unidade),
        observacoes: finalizacao.observacoes,
      });
      if (resposta.error) return alert(`Não foi possível finalizar: ${resposta.error}`);
      setModalFinalizar(null);
      setMensagem("Produção finalizada, pesada e adicionada ao saldo de produto pronto.");
      await carregar(true);
    } catch (error) {
      alert(`Não foi possível finalizar: ${error?.message || "erro inesperado"}`);
      await carregar(true);
    } finally {
      liberarMutacao();
    }
  };

  const cancelar = async (lote) => {
    if (!confirm(`Cancelar a produção de ${lote.ficha_nome} e devolver os ingredientes ao estoque?`)) return;
    if (!adquirirMutacao(lote.id)) return;
    try {
      const resposta = await cancelarLoteProducao({ loteId: lote.id, devolverEstoque: true, motivo: "Cancelado pelo responsável" });
      if (resposta.error) return alert(`Não foi possível cancelar: ${resposta.error}`);
      setMensagem("Produção cancelada e ingredientes devolvidos ao estoque.");
      await carregar(true);
    } catch (error) {
      alert(`Não foi possível cancelar: ${error?.message || "erro inesperado"}`);
      await carregar(true);
    } finally {
      liberarMutacao();
    }
  };

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try { recognition.abort?.(); } catch { /* navegador já encerrou a captura */ }
  }, []);

  const iniciarVoz = () => {
    if (!modoDia) return alert("A entrada por áudio altera o plano diário. Volte para Dia para usar o microfone.");
    if (ouvindo || mutacaoRef.current || !dadosConfiaveis) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("O reconhecimento por áudio não está disponível neste navegador. Use o Chrome atualizado ou preencha manualmente.");
    try { recognitionRef.current?.abort?.(); } catch { /* noop */ }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setOuvindo(true);
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setOuvindo(false);
    };
    recognition.onerror = (evento) => {
      setOuvindo(false);
      if (evento.error !== "aborted") alert("Não consegui ouvir. Confira a permissão do microfone e tente novamente.");
    };
    recognition.onresult = (evento) => {
      const transcricao = evento.results?.[0]?.[0]?.transcript || "";
      setRascunhoVoz({ transcricao, ...interpretarVoz(transcricao, fichasDoDepartamento) });
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setOuvindo(false);
      alert("O microfone já está ocupado ou não pôde ser iniciado. Aguarde um instante e tente novamente.");
    }
  };

  const confirmarVoz = () => {
    if (!rascunhoVoz?.ficha || rascunhoVoz.erro) return;
    if (mutacaoRef.current || !dadosConfiaveis) return alert("Aguarde a atualização dos dados antes de aplicar o áudio.");
    if (rascunhoVoz.acao === "contagem" && !contagemEditavel) {
      alert("A contagem por áudio só pode alterar o saldo pronto de hoje.");
      return;
    }
    const fichaId = rascunhoVoz.ficha.id;
    setPlano((atual) => {
      const anterior = atual[fichaId] || {
        unidade: unidadePadraoFicha(rascunhoVoz.ficha),
        estoquePronto: 0,
        quantidade: "",
      };
      const unidadeAnterior = anterior.unidade || unidadePadraoFicha(rascunhoVoz.ficha);
      const familiaAnterior = unidadeBase(unidadeAnterior);
      const familiaNova = unidadeBase(rascunhoVoz.unidade);
      if (familiaAnterior !== familiaNova) return atual;
      const saldoBase = converterParaBase(numero(anterior.estoquePronto), unidadeAnterior);
      const quantidadeBase = converterParaBase(numero(anterior.quantidade), unidadeAnterior);
      const convertido = {
        ...anterior,
        unidade: rascunhoVoz.unidade,
        estoquePronto: Number(converterDaBase(saldoBase, rascunhoVoz.unidade).toFixed(3)),
        quantidade: quantidadeBase > 0
          ? Number(converterDaBase(quantidadeBase, rascunhoVoz.unidade).toFixed(3))
          : "",
        origem: "audio",
        transcricao: rascunhoVoz.transcricao,
      };
      if (rascunhoVoz.acao === "contagem") convertido.estoquePronto = rascunhoVoz.quantidade;
      else convertido.quantidade = rascunhoVoz.quantidade;
      return { ...atual, [fichaId]: convertido };
    });
    setPlanoSujo(true);
    setRascunhoVoz(null);
    setMensagem("Áudio aplicado ao rascunho. Revise e salve o plano.");
  };

  const imprimir = () => {
    if (mutacaoRef.current || loading || !dadosConfiaveis) return alert("Aguarde a confirmação dos dados antes de imprimir.");
    const tituloPeriodo = periodo === "dia" ? `Dia ${formatarData(dataReferencia)}`
      : periodo === "semana" ? `Semana de ${formatarData(intervalo.inicio)} a ${formatarData(intervalo.fim)}`
        : `Mês de ${formatarData(dataReferencia).slice(3)}`;
    const previsoes = cards.filter((card) => (
      card.previsaoBase > 0
      || card.quantidadeBase > 0
      || card.sugestaoBase > 0
      || card.lotesFichaPeriodo.length > 0
    ));
    if (!previsoes.length && !lotesDoPeriodo.length && !contagensDoPeriodo.length) return alert("Não há previsão nem histórico neste período para imprimir.");
    const linhasPrevisao = previsoes.map((card) => {
      const unidade = card.item.unidade;
      return `<tr>
        <td><b>${escaparHtml(card.ficha.nome_receita)}</b></td>
        <td>${escaparHtml(formatarQuantidadeBase(card.saldoBase, unidade))}</td>
        <td><b>${escaparHtml(formatarQuantidadeBase(card.previsaoBase, unidade))}</b></td>
        <td>${escaparHtml(formatarQuantidadeBase(card.sugestaoBase, unidade))}</td>
        <td>${modoDia && card.quantidadeBase > 0 ? escaparHtml(formatarQuantidadeBase(card.quantidadeBase, unidade)) : "—"}</td>
        <td>${card.produzidoPeriodoBase > 0 ? escaparHtml(formatarQuantidadeBase(card.produzidoPeriodoBase, unidade)) : "—"}</td>
        <td>${escaparHtml(fmtBRL(card.custoMedioReferencia))}</td>
        <td>${escaparHtml(fmtBRL(card.custoRealPeriodo))}</td>
      </tr>`;
    }).join("");
    const linhasHistorico = lotesDoPeriodo.map((lote) => {
      const unidade = lote.unidade_planejada || lote.unidade_produzida || "un";
      const responsavel = lote.colaborador_nome || lote.responsavel_planejado_nome || "—";
      return `<tr>
        <td><b>${escaparHtml(lote.ficha_nome)}</b><small>${escaparHtml(formatarData(lote.data_producao))}</small></td>
        <td>${escaparHtml(`${lote.quantidade_planejada || 0} ${unidade}`)}</td>
        <td>${lote.quantidade_produzida ? escaparHtml(`${lote.quantidade_produzida} ${lote.unidade_produzida || unidade}`) : "—"}</td>
        <td>${escaparHtml(fmtBRL(lote.custo_real ?? lote.custo_previsto))}</td>
        <td>${escaparHtml(responsavel)}</td>
        <td>${escaparHtml(STATUS[lote.status]?.texto || lote.status || "—")}</td>
      </tr>`;
    }).join("");
    const linhasContagens = contagensDoPeriodo.map((contagem) => {
      const unidade = contagem.unidade_base || "un";
      const diferenca = numero(contagem.diferenca_base);
      const sinal = diferenca > 0 ? "+" : "";
      const responsavel = contagem.colaborador_nome || "—";
      return `<tr>
        <td><b>${escaparHtml(contagem.ficha_nome || contagem.fichas_tecnicas?.nome_receita || "Receita")}</b><small>${escaparHtml(formatarData(contagem.data_contagem))}</small></td>
        <td>${escaparHtml(formatarQuantidadeBase(contagem.quantidade_anterior_base, unidade))}</td>
        <td><b>${escaparHtml(formatarQuantidadeBase(contagem.quantidade_base, unidade))}</b></td>
        <td>${escaparHtml(`${sinal}${formatarQuantidadeBase(diferenca, unidade)}`)}</td>
        <td>${escaparHtml(responsavel)}</td>
        <td>${escaparHtml(contagem.origem === "audio" ? "Áudio" : "Manual")}</td>
      </tr>`;
    }).join("");
    const rotuloPrevisao = periodo === "dia" ? "Previsão para este dia da semana" : periodo === "semana" ? "Previsão semanal consolidada" : "Previsão mensal consolidada";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Plano de produção</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;padding:12mm}h1{font-size:22px;margin:2px 0}h2{font-size:14px;margin:16px 0 4px}p{margin:0}.top{display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #111;padding-bottom:8px}.tag{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#555;font-weight:bold}.periodo{text-align:right;font-size:12px;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #333;padding:7px 6px;font-size:10px;text-align:left}th{background:#eee;text-transform:uppercase;font-size:8px}td small{display:block;color:#666;margin-top:2px}.rodape{margin-top:10px;font-size:9px;color:#666}@media print{@page{size:A4 landscape;margin:8mm}body{padding:0}}
    </style></head><body><div class="top"><div><div class="tag">${escaparHtml(departamento === "bar" ? "Produção do Bar" : "Produção da Cozinha")} · ${escaparHtml(unidadeInfo?.nome || "")}</div><h1>Plano e histórico de produção</h1></div><div class="periodo">${escaparHtml(tituloPeriodo)}</div></div><h2>${escaparHtml(rotuloPrevisao)}</h2><table><thead><tr><th>Produto</th><th>Saldo pronto atual</th><th>Previsão</th><th>Falta produzir</th><th>Plano do dia</th><th>Produzido no período</th><th>Custo médio</th><th>Gasto real</th></tr></thead><tbody>${linhasPrevisao || '<tr><td colspan="8">Sem previsão calculada.</td></tr>'}</tbody></table><h2>Histórico de produções</h2><table><thead><tr><th>Data / produto</th><th>Planejado</th><th>Produzido</th><th>Gasto</th><th>Responsável</th><th>Status</th></tr></thead><tbody>${linhasHistorico || '<tr><td colspan="6">Sem execuções neste período.</td></tr>'}</tbody></table><h2>Histórico de contagens do saldo pronto</h2><table><thead><tr><th>Data / produto</th><th>Saldo anterior</th><th>Contagem</th><th>Diferença</th><th>Responsável</th><th>Origem</th></tr></thead><tbody>${linhasContagens || '<tr><td colspan="6">Sem contagens neste período.</td></tr>'}</tbody></table><div class="rodape">Gerado em ${escaparHtml(new Date().toLocaleString("pt-BR"))}. A previsão de semana ou mês é consolidada uma vez por produto; produções e contagens permanecem auditáveis separadamente.</div></body></html>`;
    let win;
    try { win = window.open("", "_blank", "width=1100,height=800"); } catch { win = null; }
    if (win) {
      win.document.write(html); win.document.close(); setTimeout(() => win.print(), 350); return;
    }
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(iframe); iframe.srcdoc = html;
    iframe.onload = () => setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 60000); }, 350);
  };

  const limparPlanejamento = () => {
    if (!modoDia || mutacaoRef.current || !dadosConfiaveis) return;
    if (!confirm("Limpar as quantidades ainda não iniciadas deste dia?")) return;
    setPlano((atual) => Object.fromEntries(Object.entries(atual).map(([id, item]) => {
      const lote = loteDoDiaPorFicha[id];
      const podeLimpar = !lote || lote.status === "planejado";
      return [id, podeLimpar ? { ...item, quantidade: "" } : item];
    })));
    setPlanoSujo(true);
  };

  const trocarData = (novaData) => {
    if (mutacaoRef.current) return;
    if (!novaData || novaData === dataReferencia) return;
    if (planoSujo && !confirm("Há alterações não salvas no plano deste dia. Deseja trocar a data e descartar o rascunho?")) return;
    setPlanoSujo(false);
    setDataReferencia(novaData);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={abrirMenu} disabled={mutacaoEmCurso} className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-40"><ArrowLeft size={20} /></button>
            <div className="w-11 h-11 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 hidden sm:flex items-center justify-center"><ChefHat size={22} /></div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-950 truncate">Produção inteligente · {departamento === "bar" ? "Bar" : "Cozinha"}</h1>
              <p className="text-xs font-bold text-slate-500 mt-0.5">Previsão, estoque, execução, pesagem e histórico</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button onClick={iniciarVoz} disabled={ouvindo || loading || mutacaoEmCurso || !dadosConfiaveis || !modoDia || !unidadeAtiva || unidadeAtiva === "todas"} className={`min-h-11 px-4 rounded-xl border font-black text-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-50 ${ouvindo ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "bg-white border-slate-200 text-slate-700"}`}><Mic size={17} /> {ouvindo ? "Ouvindo..." : "Contar por áudio"}</button>
            <button onClick={imprimir} disabled={loading || mutacaoEmCurso || !dadosConfiaveis} className="min-h-11 px-4 rounded-xl bg-slate-900 text-white font-black text-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-40"><Printer size={17} /> Imprimir</button>
            <button onClick={() => carregar()} disabled={loading || mutacaoEmCurso} className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-40"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 space-y-6">
        {(!unidadeAtiva || unidadeAtiva === "todas") && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex gap-3 text-blue-800"><AlertTriangle className="shrink-0" size={21} /><div><p className="font-black">Selecione uma unidade</p><p className="text-sm font-semibold mt-1">O planejamento de produção usa o estoque e o histórico de uma unidade específica.</p></div></div>}
        {erroBanco && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-amber-800"><AlertTriangle className="shrink-0" size={21} /><div><p className="font-black">Dados de produção indisponíveis</p><p className="text-sm font-semibold mt-1">{erroBanco} As ações desta tela ficam bloqueadas até a atualização ser confirmada; o restante do ERP continua funcionando.</p></div></div>}
        {mensagem && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3 text-emerald-800"><CheckCircle2 className="shrink-0" size={21} /><p className="font-bold text-sm">{mensagem}</p></div>}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi icon={ClipboardList} titulo={modoDia ? "Planejados no dia" : "Produtos previstos"} valor={modoDia ? planejadosHoje : produtosPrevistos} detalhe={modoDia ? formatarData(dataReferencia) : periodo === "semana" ? "Previsão semanal" : "Previsão mensal"} />
          <Kpi icon={Clock3} titulo="Em produção" valor={emProducao.length} detalhe="Lotes aguardando pesagem" cor="text-amber-600" fundo="bg-amber-50" />
          <Kpi icon={CheckCircle2} titulo="Concluídos" valor={concluidosPeriodo.length} detalhe={periodo === "dia" ? "Neste dia" : `Neste ${periodo}`} cor="text-blue-600" fundo="bg-blue-50" />
          <Kpi icon={BarChart3} titulo="Gasto no período" valor={fmtBRL(custoPeriodo)} detalhe="Custo congelado dos ingredientes" cor="text-violet-600" fundo="bg-violet-50" />
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {[
              ["planejamento", "Planejamento", ClipboardList],
              ["andamento", `Em produção (${emProducao.length})`, Clock3],
              ["historico", "Médias e histórico", History],
            ].map(([id, label, Icon]) => <button key={id} disabled={mutacaoEmCurso} onClick={() => setAba(id)} className={`min-h-11 px-4 rounded-xl font-black text-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-50 ${aba === id ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}><Icon size={16} />{label}</button>)}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 min-h-11"><CalendarDays size={17} className="text-slate-400" /><input type="date" disabled={mutacaoEmCurso} value={dataReferencia} onChange={(e) => trocarData(e.target.value)} className="min-w-0 bg-transparent outline-none font-bold text-sm text-slate-700 disabled:opacity-50" /></label>
            <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl">
              {[['dia','Dia'],['semana','Semana'],['mes','Mês']].map(([id,label]) => <button key={id} disabled={mutacaoEmCurso} onClick={() => setPeriodo(id)} className={`px-3 py-2 rounded-lg text-xs font-black disabled:opacity-50 ${periodo === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{label}</button>)}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="py-24 flex flex-col items-center text-slate-500"><Loader2 size={34} className="animate-spin text-emerald-500" /><p className="font-bold mt-3">Calculando produção e estoque...</p></div>
        ) : aba === "planejamento" ? (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
              <div><h2 className="text-2xl font-black text-slate-900">{modoDia ? "O que precisa ser produzido?" : `Previsão consolidada do ${periodo === "semana" ? "período semanal" : "mês"}`}</h2><p className="text-sm font-semibold text-slate-500 mt-1">{modoDia ? "A necessidade usa a média deste dia da semana e o saldo pronto atual." : `Uma única previsão por produto, baseada na média ${periodo === "semana" ? "semanal" : "mensal"}. A execução continua sendo registrada por dia.`}</p></div>
              {modoDia && <button onClick={limparPlanejamento} disabled={mutacaoEmCurso || !dadosConfiaveis} className="text-xs font-black text-slate-500 flex items-center gap-1.5 disabled:opacity-40"><RotateCcw size={14} /> Limpar quantidades</button>}
            </div>
            {!modoDia && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">Visualização somente para previsão e impressão. Seu rascunho do Dia continua preservado; volte para Dia para salvar ou iniciar uma produção.</div>}
            {modoDia && !contagemEditavel && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">O plano desta data pode ser consultado e ajustado, mas o saldo pronto é somente leitura. Contagens só alteram o estoque na data de hoje ({formatarData(hoje)}).</div>}
            {fichasDoDepartamento.length === 0 ? <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center"><ChefHat size={34} className="mx-auto text-slate-300" /><p className="font-black text-slate-700 mt-3">Nenhuma receita cadastrada neste setor.</p></div> : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {cards.map((card) => {
                  const bloqueado = card.lote && card.lote.status !== "planejado";
                  const amostras = numero(card.media.amostrasDia ?? card.media.amostras_dia ?? card.media.diaSemana?.amostras);
                  const podeProduzir = card.capacidadeCalculada
                    && card.capacidadeBase > 0
                    && card.quantidadeBase <= card.capacidadeBase + 0.0001;
                  const erroCapacidade = !card.capacidadeCalculada
                    ? card.capacidade.erros?.join(" ") || "Não foi possível calcular a capacidade desta receita."
                    : card.capacidadeBase <= 0
                      ? "Sem ingredientes disponíveis para produzir."
                      : card.quantidadeBase > card.capacidadeBase + 0.0001
                        ? "A quantidade planejada é maior que o estoque disponível."
                        : "";
                  return <article key={card.ficha.id} className={`bg-white border rounded-3xl p-4 sm:p-5 shadow-sm ${bloqueado ? "border-amber-200" : "border-slate-200"}`}>
                    <div className="flex gap-3 justify-between items-start">
                      <div className="min-w-0"><h3 className="text-xl font-black text-slate-900 truncate">{card.ficha.nome_receita}</h3><p className="text-xs font-bold text-slate-400 mt-1">Rendimento: {card.ficha.rendimento_porcoes || 1} {card.ficha.rendimento_unidade || "porções"}</p></div>
                      {modoDia && card.lote ? <StatusBadge status={card.lote.status} /> : <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{modoDia ? "Novo lote" : "Previsão"}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] font-black uppercase text-emerald-700">Mesmo dia</p><p className="font-black text-emerald-800 mt-1">{formatarQuantidadeBase(card.mediaDiaBase, card.item.unidade)}</p><p className="text-[9px] font-bold text-emerald-700 mt-1">Custo {fmtBRL(card.custoMedioDia)}</p><p className="text-[9px] font-bold text-emerald-600 mt-0.5">{amostras ? `${amostras} registros` : "Histórico insuficiente"}</p></div>
                      <div className="rounded-xl bg-blue-50 p-3"><p className="text-[9px] font-black uppercase text-blue-700">Semana média</p><p className="font-black text-blue-800 mt-1">{formatarQuantidadeBase(card.mediaSemanaBase, card.item.unidade)}</p><p className="text-[9px] font-bold text-blue-700 mt-1">Custo {fmtBRL(card.custoMedioSemana)}</p></div>
                      <div className="rounded-xl bg-violet-50 p-3"><p className="text-[9px] font-black uppercase text-violet-700">Mês médio</p><p className="font-black text-violet-800 mt-1">{formatarQuantidadeBase(card.mediaMesBase, card.item.unidade)}</p><p className="text-[9px] font-bold text-violet-700 mt-1">Custo {fmtBRL(card.custoMedioMes)}</p></div>
                    </div>
                    {!modoDia ? <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-500">Saldo pronto atual</p><p className="text-lg font-black text-slate-800 mt-1">{formatarQuantidadeBase(card.saldoBase, card.item.unidade)}</p></div>
                      <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] font-black uppercase text-emerald-700">Previsão consolidada</p><p className="text-lg font-black text-emerald-800 mt-1">{formatarQuantidadeBase(card.previsaoBase, card.item.unidade)}</p></div>
                      <div className="rounded-xl border border-dashed border-emerald-300 p-3"><p className="text-[9px] font-black uppercase text-emerald-700">Falta para cobrir</p><p className="text-lg font-black text-emerald-800 mt-1">{formatarQuantidadeBase(card.sugestaoBase, card.item.unidade)}</p></div>
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-[9px] font-black uppercase text-slate-500">Realizado no período</p><p className="text-lg font-black text-slate-800 mt-1">{formatarQuantidadeBase(card.produzidoPeriodoBase, card.item.unidade)}</p><p className="text-[10px] font-bold text-slate-500 mt-1">Gasto {fmtBRL(card.custoRealPeriodo)}</p></div>
                    </div> : <>
                      <div className="grid sm:grid-cols-2 gap-3 mt-4">
                        <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Saldo pronto atual {contagemEditavel ? "(contagem de hoje)" : "(somente leitura)"}</span><div className="flex mt-1.5"><input type="number" min="0" step="0.001" disabled={bloqueado || !contagemEditavel || mutacaoEmCurso || !dadosConfiaveis} value={card.item.estoquePronto ?? ""} onChange={(e) => alterarPlano(card.ficha.id, { estoquePronto: e.target.value })} className="min-w-0 w-full h-12 px-3 rounded-l-xl border border-slate-200 bg-slate-50 font-black outline-none focus:border-emerald-400 disabled:text-slate-500" /><select disabled={bloqueado || mutacaoEmCurso || !dadosConfiaveis} value={card.item.unidade} onChange={(e) => alterarUnidadePlano(card, e.target.value)} className="h-12 px-2 rounded-r-xl border-y border-r border-slate-200 bg-white font-black text-sm outline-none disabled:opacity-50">{unidadeBase(unidadePadraoFicha(card.ficha)) === "g" ? <><option value="kg">kg</option><option value="g">g</option></> : unidadeBase(unidadePadraoFicha(card.ficha)) === "ml" ? <><option value="L">L</option><option value="ml">ml</option></> : <option value="un">porção</option>}</select></div></label>
                        <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-3"><p className="text-[10px] font-black uppercase text-emerald-700">Falta sugerida para o dia</p><div className="flex items-center justify-between gap-2 mt-1"><p className="text-xl font-black text-emerald-800">{formatarQuantidadeBase(card.sugestaoBase, card.item.unidade)}</p><button disabled={bloqueado || card.sugestaoBase <= 0 || mutacaoEmCurso || !dadosConfiaveis} onClick={() => usarSugestao(card)} className="text-[10px] font-black bg-white border border-emerald-200 text-emerald-700 rounded-lg px-2 py-1.5 disabled:opacity-40"><Sparkles size={12} className="inline mr-1" />Usar</button></div></div>
                      </div>
                      <div className="grid sm:grid-cols-[1fr_1fr] gap-3 mt-3">
                        <label><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Quanto será produzido?</span><input type="number" min="0" step="0.001" disabled={bloqueado || mutacaoEmCurso || !dadosConfiaveis} value={card.item.quantidade ?? ""} onChange={(e) => alterarPlano(card.ficha.id, { quantidade: e.target.value })} className="w-full h-12 px-3 mt-1.5 rounded-xl border border-slate-200 bg-white font-black text-lg outline-none focus:border-emerald-400 disabled:opacity-50" /></label>
                        <label><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Responsável</span><select disabled={bloqueado || mutacaoEmCurso || !dadosConfiaveis} value={card.item.responsavelId || ""} onChange={(e) => alterarPlano(card.ficha.id, { responsavelId: e.target.value })} className="w-full h-12 px-3 mt-1.5 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none focus:border-emerald-400 disabled:opacity-50"><option value="">Selecionar...</option>{colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div><p className="font-bold text-slate-400">Capacidade do estoque</p><p className={`font-black mt-0.5 ${podeProduzir ? "text-slate-700" : "text-red-600"}`}>{card.capacidadeCalculada ? formatarQuantidadeBase(card.capacidadeBase, card.item.unidade) : "Não calculada"}</p></div>
                        <div><p className="font-bold text-slate-400">Gasto previsto</p><p className="font-black text-slate-700 mt-0.5">{fmtBRL(card.calculo.custoTotal)}</p></div>
                        <div className="col-span-2 sm:col-span-1"><p className="font-bold text-slate-400">Ingredientes</p><p className="font-black text-slate-700 mt-0.5">{card.calculo.itens?.length || 0} itens</p></div>
                      </div>
                      {erroCapacidade && <p className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs font-bold text-red-700">{erroCapacidade}</p>}
                      <button onClick={() => iniciar(card)} disabled={bloqueado || card.quantidadeBase <= 0 || !podeProduzir || mutacaoEmCurso || !dadosConfiaveis} className="w-full min-h-12 mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black flex items-center justify-center gap-2 transition-colors">{acaoId === card.ficha.id ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} {bloqueado ? STATUS[card.lote.status]?.texto : "Iniciar produção e baixar estoque"}</button>
                    </>}
                  </article>;
                })}
              </div>
            )}
            {modoDia && <div className="sticky bottom-4 z-10 bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center gap-3 justify-between"><div><p className="font-black">{planejadosHoje} item(ns) com quantidade {planoSujo ? "· alterações não salvas" : ""}</p><p className="text-xs font-semibold text-slate-300">{contagemEditavel ? "O plano será salvo primeiro; depois, as contagens de hoje atualizam o saldo pronto." : "O plano será salvo sem alterar o saldo pronto atual."}</p></div><button onClick={() => persistirPlano()} disabled={mutacaoEmCurso || !dadosConfiaveis} className="min-h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 font-black flex items-center justify-center gap-2">{salvando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {contagemEditavel ? "Salvar plano e contagens" : "Salvar plano"}</button></div>}
          </section>
        ) : aba === "andamento" ? (
          <section><div className="mb-4"><h2 className="text-2xl font-black text-slate-900">Produções em andamento</h2><p className="text-sm font-semibold text-slate-500 mt-1">Os ingredientes já foram baixados. Finalize informando o peso real.</p></div>{emProducao.length === 0 ? <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center"><PackageCheck size={38} className="mx-auto text-slate-300" /><p className="font-black text-slate-700 mt-3">Nenhuma produção aberta.</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{emProducao.map((lote) => <article key={lote.id} className="bg-white border border-amber-200 rounded-3xl p-5 shadow-sm"><div className="flex justify-between gap-2"><StatusBadge status={lote.status} /><span className="text-xs font-bold text-slate-400">{formatarData(lote.data_producao)}</span></div><h3 className="text-xl font-black text-slate-900 mt-4">{lote.ficha_nome}</h3><p className="text-sm font-bold text-slate-500 mt-1">Planejado: {lote.quantidade_planejada} {lote.unidade_planejada}</p><div className="grid grid-cols-2 gap-2 mt-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">Responsável</p><p className="font-bold text-sm text-slate-700 mt-1">{lote.colaborador_nome || lote.responsavel_planejado_nome || "—"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">Início</p><p className="font-bold text-sm text-slate-700 mt-1">{lote.iniciado_em ? new Date(lote.iniciado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</p></div></div><button onClick={() => abrirFinalizacao(lote)} disabled={mutacaoEmCurso || !dadosConfiaveis} className="w-full min-h-12 mt-4 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"><Scale size={18} /> Pesar e finalizar</button><button onClick={() => cancelar(lote)} disabled={mutacaoEmCurso || !dadosConfiaveis} className="w-full mt-2 py-2 text-xs font-black text-red-500 disabled:opacity-50">Cancelar e devolver ingredientes</button></article>)}</div>}</section>
        ) : (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Médias e histórico</h2>
              <p className="text-sm font-semibold text-slate-500 mt-1">Compare dia da semana, semana e mês. Produções e contagens ficam separadas e auditáveis.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="font-black text-slate-800">Histórico de produções</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr><th className="text-left p-3">Data / produto</th><th className="text-left p-3">Planejado</th><th className="text-left p-3">Produzido real</th><th className="text-left p-3">Gasto</th><th className="text-left p-3">Responsável</th><th className="text-left p-3">Horários</th><th className="text-left p-3">Status</th></tr>
                  </thead>
                  <tbody>
                    {lotesDoPeriodo.length === 0 ? <tr><td colSpan="7" className="p-10 text-center font-bold text-slate-400">Sem produções neste período.</td></tr> : lotesDoPeriodo.map((lote) => <tr key={lote.id} className="border-t border-slate-100"><td className="p-3"><p className="font-black text-slate-800">{lote.ficha_nome}</p><p className="text-xs font-semibold text-slate-400">{formatarData(lote.data_producao)}</p></td><td className="p-3 font-bold">{lote.quantidade_planejada} {lote.unidade_planejada}</td><td className="p-3 font-black text-emerald-700">{lote.quantidade_produzida ? `${lote.quantidade_produzida} ${lote.unidade_produzida}` : "—"}</td><td className="p-3 font-bold">{fmtBRL(lote.custo_real ?? lote.custo_previsto)}</td><td className="p-3 font-bold">{lote.colaborador_nome || lote.responsavel_planejado_nome || "—"}</td><td className="p-3 text-xs font-semibold text-slate-500">{lote.iniciado_em ? new Date(lote.iniciado_em).toLocaleString("pt-BR") : "—"}<br />{lote.finalizado_em ? new Date(lote.finalizado_em).toLocaleString("pt-BR") : ""}</td><td className="p-3"><StatusBadge status={lote.status} /></td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="font-black text-slate-800">Histórico de contagens do saldo pronto</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Mostra cada conferência manual ou feita por áudio, sem misturar com a quantidade produzida.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr><th className="text-left p-3">Data / produto</th><th className="text-left p-3">Saldo anterior</th><th className="text-left p-3">Contagem</th><th className="text-left p-3">Diferença</th><th className="text-left p-3">Responsável</th><th className="text-left p-3">Origem</th></tr>
                  </thead>
                  <tbody>
                    {contagensDoPeriodo.length === 0 ? <tr><td colSpan="6" className="p-10 text-center font-bold text-slate-400">Sem contagens neste período.</td></tr> : contagensDoPeriodo.map((contagem) => {
                      const diferenca = Number(contagem.diferenca_base || 0);
                      return <tr key={contagem.id} className="border-t border-slate-100">
                        <td className="p-3"><p className="font-black text-slate-800">{contagem.ficha_nome || contagem.fichas_tecnicas?.nome_receita || "Produto"}</p><p className="text-xs font-semibold text-slate-400">{formatarData(contagem.data_contagem)} · {contagem.created_at ? new Date(contagem.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</p></td>
                        <td className="p-3 font-bold">{formatarQuantidadeBase(contagem.quantidade_anterior_base, contagem.unidade_base)}</td>
                        <td className="p-3 font-black text-slate-900">{formatarQuantidadeBase(contagem.quantidade_base, contagem.unidade_base)}</td>
                        <td className={`p-3 font-black ${diferenca > 0 ? "text-emerald-700" : diferenca < 0 ? "text-red-600" : "text-slate-500"}`}>{diferenca > 0 ? "+" : ""}{formatarQuantidadeBase(diferenca, contagem.unidade_base)}</td>
                        <td className="p-3 font-bold">{contagem.colaborador_nome || "—"}</td>
                        <td className="p-3"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{contagem.origem === "audio" ? "Áudio" : "Manual"}</span></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      {modalFinalizar && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4 flex items-start sm:items-center justify-center overflow-y-auto"><div className="bg-white rounded-3xl w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-7 shadow-2xl"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Finalizar produção</p><h2 className="text-2xl font-black text-slate-900 mt-1 break-words">{modalFinalizar.ficha_nome}</h2></div><button onClick={() => setModalFinalizar(null)} disabled={mutacaoEmCurso} className="w-10 h-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-40"><X size={19} /></button></div><div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 mt-5"><p className="text-xs font-bold text-amber-800">Planejado: {modalFinalizar.quantidade_planejada} {modalFinalizar.unidade_planejada}. Informe o resultado real após pesar.</p></div><label className="block mt-5"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Quantidade realmente produzida</span><div className="flex mt-2 min-w-0"><input type="number" min="0" step="0.001" disabled={mutacaoEmCurso} value={finalizacao.quantidade} onChange={(e) => setFinalizacao((f) => ({ ...f, quantidade: e.target.value }))} className="min-w-0 flex-1 h-14 px-4 rounded-l-xl border border-slate-200 text-2xl font-black outline-none focus:border-emerald-500 disabled:opacity-50" /><select disabled={mutacaoEmCurso} value={finalizacao.unidade} onChange={(e) => alterarUnidadeFinalizacao(e.target.value)} className="h-14 max-w-[7rem] px-3 rounded-r-xl border-y border-r border-slate-200 bg-slate-50 font-black disabled:opacity-50">{unidadeBase(modalFinalizar.unidade_planejada) === "g" ? <><option value="kg">kg</option><option value="g">g</option></> : unidadeBase(modalFinalizar.unidade_planejada) === "ml" ? <><option value="L">L</option><option value="ml">ml</option></> : <option value="un">un</option>}</select></div></label><label className="block mt-4"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Observações / perdas</span><textarea disabled={mutacaoEmCurso} value={finalizacao.observacoes} onChange={(e) => setFinalizacao((f) => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional" className="w-full min-h-24 mt-2 p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 disabled:opacity-50" /></label><button onClick={finalizar} disabled={mutacaoEmCurso} className="w-full min-h-14 mt-5 rounded-xl bg-emerald-600 text-white text-lg font-black flex items-center justify-center gap-2 disabled:opacity-50">{acaoId === modalFinalizar.id ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />} Confirmar peso e finalizar</button></div></div>}

      {rascunhoVoz && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4 flex items-start sm:items-center justify-center overflow-y-auto"><div className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 shadow-2xl"><div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Mic size={23} /></div><h2 className="text-xl font-black text-slate-900 mt-4">Revisar o que ouvi</h2><p className="mt-2 p-3 rounded-xl bg-slate-50 text-sm font-semibold text-slate-600">“{rascunhoVoz.transcricao}”</p>{rascunhoVoz.erro ? <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm font-bold text-red-700">{rascunhoVoz.erro}</div> : <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-3"><p className="font-black text-emerald-900">{rascunhoVoz.ficha.nome_receita}</p><p className="text-sm font-bold text-emerald-700 mt-1">{rascunhoVoz.acao === "contagem" ? "Contagem pronta" : "Produzir"}: {rascunhoVoz.quantidade} {rascunhoVoz.unidade}</p></div>}<div className="grid grid-cols-2 gap-2 mt-5"><button onClick={() => setRascunhoVoz(null)} className="min-h-12 rounded-xl bg-slate-100 text-slate-600 font-black">Cancelar</button><button onClick={confirmarVoz} disabled={!!rascunhoVoz.erro} className="min-h-12 rounded-xl bg-emerald-600 disabled:bg-slate-200 text-white font-black">Aplicar rascunho</button></div></div></div>}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={34} /></div>}><ProducaoRunner /></Suspense>;
}
