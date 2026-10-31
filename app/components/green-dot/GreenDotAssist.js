"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Settings,
  HelpCircle,
  RotateCcw,
  ArrowUp,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  CalendarClock,
  MapPin,
  Compass,
  Maximize2,
  Minimize2,
  PlusCircle,
  Zap,
  Scale,
  Droplets,
  ClipboardCheck,
  Tag,
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { supabase, isSupabaseReady } from "../../lib/supabase";
import { fetchComSessao } from "../../lib/api-sessao.js";
import { fetchComplementosDeFichas } from "../../lib/ficha-tecnica";
import { fetchGuias } from "../../lib/guias";
import {
  vozDisponivel,
  audioDisponivel,
  criarEscuta,
  falar,
  calarVoz,
} from "../../lib/hefisto-voz";
import {
  RECEITAS_GREEN_DOT,
  ROTINAS_OPERACIONAIS,
  EQUIPAMENTOS_MANUTENCAO,
  CHAMADOS_MANUTENCAO_INICIAIS,
  ESCALA_TURNO_GANTT,
  ESCALA_ORGANOGRAMA_DO_DIA,
  EXTRAS_DISPONIVEIS,
  FORMACAO_PRACAS_BASE,
  recalcularReceitaPorIngrediente,
  detectarIntencaoRecalculo,
  carregarReceitasCustom,
  salvarReceitaCustom,
  removerReceitaCustom,
  carregarEquipamentosCustom,
  salvarEquipamentoCustom,
  removerEquipamentoCustom,
  LOCAIS_ARMAZENAMENTO_PADRAO,
  LOTES_RASTREIO_INICIAIS,
  buscarLocalizacaoProduto,
  interpretarPerguntaColaborador,
  obterTodosRastreios,
} from "../../lib/green-dot-data";
import {
  GreenDotAvatar,
  PartnerBubbleAvatar,
  BrandValueBanner,
  WelcomeGovernanceCard,
  DemandSpikeAlertCard,
  RecipeDetailCard,
  RecipeRecalculatedCard,
  RecipeInteractiveFollowUp,
  CustomizationAndPairingCard,
  OperationalRoutineCard,
  EquipmentVisualSelectorAndGuidesCard,
  EquipmentMaintenanceFlowCard,
  ShiftOrganogramCard,
  ShiftScheduleGanttCard,
  AvailablePartnersOutreachCard,
  PlayCallerStationMapCard,
  CleaningSanitizationGuideCard,
  ShiftChecklistCard,
  EtiquetaQuickGeneratorCard,
  ProductTrackingLocationCard,
  ImmediateSolutionPlanCard,
} from "./GreenDotCards";
import GreenDotAdminModal from "./GreenDotAdminModal";
import MensagemRespostaHefisto from "../intelligence/conversa/MensagemRespostaHefisto";
import { ehPerguntaDoTempo, diaDaPergunta } from "../../lib/clima.mjs";
import { perguntarAoHefisto, confirmarAcao, cancelarAcao, novaChaveDeEnvio } from "../../lib/intelligence/client/api";

function formatarNumeroCurto(valor) {
  const n = Number(valor || 0);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function converterFichaRealParaGreenDot(ficha, complementos = {}) {
  const ings = Array.isArray(ficha?.fichas_ingredientes) ? ficha.fichas_ingredientes : [];
  const etapasBanco = complementos?.etapasPorFicha?.[ficha.id] || [];
  const montagemBanco = complementos?.montagemPorFicha?.[ficha.id] || [];

  const ingredientesBase =
    ings.length > 0
      ? ings.map((item, idx) => {
          const qtdBase = Number(item.quantidade || 1);
          const nomeIng = item.insumos?.nome || item.nome || `Insumo ${idx + 1}`;
          const un = item.unidade_medida || item.insumos?.unidade_medida || "g";
          return {
            id: `ing-real-${ficha.id}-${idx}`,
            nome: nomeIng,
            insumoId: item.insumo_id || item.insumos?.id || null,
            quantidade: qtdBase,
            qtdBase,
            unidade: un,
            sinonimos: [nomeIng.toLowerCase()],
            aliases: [nomeIng.toLowerCase()],
          };
        })
      : [
          {
            id: `ing-real-${ficha.id}-0`,
            nome: "Insumo Principal da Ficha",
            quantidade: 1,
            qtdBase: 1,
            unidade: "kg",
            sinonimos: ["insumo principal", "base"],
            aliases: ["insumo principal", "base"],
          },
        ];

  const majorSteps =
    ingredientesBase.length > 0
      ? ingredientesBase.slice(0, 6).map((item, idx) => {
          const q = Number(item.qtdBase || 1);
          return {
            id: idx + 1,
            etapa: `${item.nome} (${item.unidade})`,
            valores: [
              formatarNumeroCurto(q * 0.25),
              formatarNumeroCurto(q * 0.5),
              formatarNumeroCurto(q * 0.75),
              formatarNumeroCurto(q),
            ],
          };
        })
      : [
          { id: 1, etapa: "Porção base padronizada da ficha", valores: ["0,25", "0,5", "0,75", "1"] },
        ];

  const passosOriginais =
    etapasBanco.length > 0
      ? etapasBanco.map((et, idx) => ({
          ordem: idx + 1,
          titulo: et.titulo || `Etapa ${idx + 1}`,
          detalhe: et.instrucoes || et.descricao || "Siga o padrão técnico da bancada.",
          imagem:
            et.foto_url ||
            ficha.foto_url ||
            "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
          videoUrl: et.video_url || ficha.video_url || "",
          duracaoSeg: et.tempo_seg || 90,
        }))
      : montagemBanco.length > 0
      ? montagemBanco.map((mp, idx) => ({
          ordem: idx + 1,
          titulo: mp.titulo || `Passo ${idx + 1}`,
          detalhe: mp.descricao || "Execute conforme ficha técnica.",
          imagem:
            mp.foto_url ||
            ficha.foto_url ||
            "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
          videoUrl: mp.video_url || ficha.video_url || "",
          duracaoSeg: 60,
        }))
      : [
          {
            ordem: 1,
            titulo: `Mise en place e pesagem de ${ficha.nome}`,
            detalhe:
              ficha.modo_preparo ||
              "Separe os insumos porcionados conforme a tabela de ingredientes e confira a validade PVPS.",
            imagem:
              ficha.foto_url ||
              "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
          },
          {
            ordem: 2,
            titulo: "Finalização e conferência no Pass",
            detalhe:
              "Verifique a temperatura de saída e a apresentação antes de liberar para o salão.",
            imagem:
              "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
          },
        ];

  const depto = String(ficha.departamento || ficha.categoria || "").toLowerCase();
  const setorFormatado = depto.includes("bar")
    ? "Bar & Coquetelaria"
    : "Cozinha Quente · Produção";

  return {
    id: `real-${ficha.id}`,
    codigo: ficha.codigo || `FT-${String(ficha.id).slice(0, 4).toUpperCase()}`,
    nome: ficha.nome || "Ficha Técnica da Casa",
    subtituloNota: "*Ficha Técnica Oficial Sincronizada do Héfisto ERP",
    setor: setorFormatado,
    rendimentoBaseLabel: `${ficha.rendimento_porcoes || 1} porção(ões) (${ficha.peso_final_gramas || 350}g)`,
    rendimentoPorcoesBase: Number(ficha.rendimento_porcoes || 1),
    rendimentoPorcoes: Number(ficha.rendimento_porcoes || 1),
    imagem:
      ficha.foto_url ||
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80",
    videoUrl:
      ficha.video_url || "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0",
    descricao:
      ficha.modo_preparo ||
      ficha.observacoes ||
      `Preparo padronizado da unidade para ${ficha.nome}. Use a calculadora proporcional caso tenha menos de algum ingrediente em estoque.`,
    perfilSensorial: {
      sabor: "Padrão autoral da casa equilibrado",
      aroma: "Fresco e finalizado na hora",
      textura: "Ponto de serviço padronizado",
    },
    basePrincipal:
      ingredientesBase
        .slice(0, 2)
        .map((i) => i.nome)
        .filter(Boolean)
        .join(" + ") || "Insumos Oficiais da Ficha Técnica",
    ingredientesBase,
    colunasTamanho: ["25%", "50%", "75%", "100% (Base)"],
    legendaTamanhos: "Proporção rápida da Ficha Técnica: 25% · 50% · 75% · 100% (Receita Cheia)",
    majorSteps,
    videoSteps: passosOriginais,
    customizacoes: [
      {
        id: "restricao-alergia",
        label: "Adaptação para restrição alimentar / alergênicos",
        opcoes: [
          { id: "sem-lactose", label: "Preparar sem derivados de leite" },
          { id: "sem-gluten", label: "Utensílios exclusivos sem contaminação de glúten" },
        ],
      },
      { id: "molho-parte", label: "Servir molho e finalização à parte" },
      { id: "embalagem-viagem", label: "Montagem reforçada para Delivery" },
    ],
    dicasCategorias: {
      customizacao: "Registre qualquer modificação de insumo na comanda para baixa fiel no estoque.",
      sabor: "Respeite o tempo de cocção e descanso antes de empratar.",
      substituicoes: "Use o botão 'Recalcular por Ingrediente' acima se tiver quantidade menor de algum insumo.",
    },
    harmonizacoes: RECEITAS_GREEN_DOT[0].harmonizacoes,
  };
}

export default function GreenDotAssist({ modoInicial = "boas-vindas" }) {
  const { estoque = [], unidadeAtiva, unidadeInfo, sessao } = useERP() || {};

  // Estado visual do tablet / conversa
  const [molduraTablet, setMolduraTablet] = useState(true);
  const [mostrarBannerProp, setMostrarBannerProp] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [modalAdminAberto, setModalAdminAberto] = useState(false);
  const [abaAdminInicial, setAbaAdminInicial] = useState("receitas");
  const [texto, setTexto] = useState("");
  const [contagemReq, setContagemReq] = useState(0);
  const [carregandoIA, setCarregandoIA] = useState(false);

  // Dados reais do ERP + Customizações salvas pelo gestor
  const [fichasReais, setFichasReais] = useState([]);
  const [complementosFichas, setComplementosFichas] = useState({});
  const [guiasBanco, setGuiasBanco] = useState([]);
  const [receitasCustom, setReceitasCustom] = useState([]);
  const [equipamentosCustom, setEquipamentosCustom] = useState([]);

  // Contexto da última receita consultada (para quando o funcionário falar "só tenho 2L de leite de coco")
  const [ultimaReceitaAtiva, setUltimaReceitaAtiva] = useState(RECEITAS_GREEN_DOT[0]);

  const [chamados, setChamados] = useState(CHAMADOS_MANUTENCAO_INICIAIS);
  const [convidadoExtraId, setConvidadoExtraId] = useState(null);
  const [progressoConvite, setProgressoConvite] = useState(0);
  const [extraConfirmado, setExtraConfirmado] = useState(null);

  // Estados de vídeo/dicas por mensagem de receita
  const [videosAbertos, setVideosAbertos] = useState({});
  const [dicaAtivaPorMsg, setDicaAtivaPorMsg] = useState({});

  // Voz
  const [ouvindo, setOuvindo] = useState(false);
  const [vozAtiva, setVozAtiva] = useState(false);
  const escutaRef = useRef(null);
  const fimChatRef = useRef(null);
  // Conversa com o cérebro do Héfisto (pedido do dono, 29/10/2026: o Green Dot
  // sabe tudo do restaurante). Os números vêm do servidor, com a fonte.
  const referenciaHefisto = useRef(null);
  const [ocupadoHefisto, setOcupadoHefisto] = useState(false);

  // Lista de blocos conversacionais na tela
  const [itensConversa, setItensConversa] = useState(() => {
    if (modoInicial === "manutencao") {
      return [
        {
          id: "init-manut",
          tipo: "pergunta-usuario",
          texto: "Esse liquidificador é 110V ou 220V? E como encaixar o copo, usar e limpar?",
          numReq: 1,
        },
        {
          id: "init-equip-visual",
          tipo: "equipamento-visual-guia",
          filtroCategoria: null,
          abaInicial: "voltagem",
        },
      ];
    }
    return [];
  });

  // Carrega customizações salvas no navegador
  useEffect(() => {
    setReceitasCustom(carregarReceitasCustom());
    setEquipamentosCustom(carregarEquipamentosCustom());
  }, []);

  // Carrega fichas técnicas reais (Cozinha e Bar) + complementos + guias operacionais do Supabase
  useEffect(() => {
    if (!isSupabaseReady() || !unidadeAtiva) return;
    supabase
      .from("fichas_tecnicas")
      .select("*, fichas_ingredientes!ficha_id(*, insumos(id, nome, unidade_medida))")
      .eq("unidade_id", unidadeAtiva)
      .limit(30)
      .then(async ({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          setFichasReais(data);
          try {
            const comp = await fetchComplementosDeFichas(data.map((f) => f.id));
            setComplementosFichas(comp || {});
          } catch (_) {}
        }
      })
      .catch(() => {});

    fetchGuias(unidadeAtiva, "equipamento")
      .then((res) => {
        if (Array.isArray(res?.data)) setGuiasBanco(res.data);
      })
      .catch(() => {});
  }, [unidadeAtiva]);

  // Todas as receitas unificadas (Customizadas pelo gestor + Fichas Reais do ERP + Receitas Oficiais Green Dot)
  const todasAsReceitas = useMemo(() => {
    const convertidasReais = fichasReais.map((f) =>
      converterFichaRealParaGreenDot(f, complementosFichas)
    );
    return [...receitasCustom, ...convertidasReais, ...RECEITAS_GREEN_DOT];
  }, [receitasCustom, fichasReais, complementosFichas]);

  // Todos os equipamentos unificados (Customizados pelo gestor + Guias do Supabase + Equipamentos Oficiais)
  const todosOsEquipamentos = useMemo(() => {
    const idsJaIncluidos = new Set(equipamentosCustom.map((e) => e.id));
    const lista = [...equipamentosCustom];

    for (const g of guiasBanco) {
      const idGuia = `guia-db-${g.id}`;
      if (!idsJaIncluidos.has(idGuia)) {
        const meta = g.passos?.[0] || {};
        lista.push({
          id: idGuia,
          codigo: `EQ-DB-${String(g.id).slice(0, 4)}`,
          nome: g.titulo,
          categoriaTipo: meta.categoriaTipo || "geral",
          setor: g.setor === "bar" ? "Bar & Coquetelaria" : "Cozinha",
          voltagem: meta.voltagem || "220V",
          corTomada: meta.corTomada || "Verificar etiqueta no cabo",
          alertaVoltagem:
            meta.alertaVoltagem ||
            `Equipamento ${meta.voltagem || "220V"} cadastrado nos Guias Operacionais da unidade.`,
          status: "Operacional",
          ultimaManutencao: "Sincronizado do ERP",
          proximaPreventiva: "Conforme cronograma",
          imagem:
            g.fotos?.[0] ||
            "https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=900&q=80",
          videoUrl: g.video_url || "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0",
          guiaEncaixe: meta.guiaEncaixe || EQUIPAMENTOS_MANUTENCAO[0].guiaEncaixe,
          guiaUso: meta.guiaUso || EQUIPAMENTOS_MANUTENCAO[0].guiaUso,
          guiaLimpeza: meta.guiaLimpeza || EQUIPAMENTOS_MANUTENCAO[0].guiaLimpeza,
          hotspots: EQUIPAMENTOS_MANUTENCAO[0].hotspots,
          passosTroubleshooting: EQUIPAMENTOS_MANUTENCAO[0].passosTroubleshooting,
          checklistPreChamado: EQUIPAMENTOS_MANUTENCAO[0].checklistPreChamado,
        });
        idsJaIncluidos.add(idGuia);
      }
    }

    for (const eq of EQUIPAMENTOS_MANUTENCAO) {
      if (!idsJaIncluidos.has(eq.id)) {
        lista.push(eq);
        idsJaIncluidos.add(eq.id);
      }
    }
    return lista;
  }, [equipamentosCustom, guiasBanco]);

  useEffect(() => {
    fimChatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [itensConversa, carregandoIA, convidadoExtraId, progressoConvite]);

  const reiniciarConversa = () => {
    calarVoz();
    setItensConversa([]);
    setContagemReq(0);
    setTexto("");
    setConvidadoExtraId(null);
    setProgressoConvite(0);
  };

  const dispararConviteExtra = (extra) => {
    setConvidadoExtraId(extra.id);
    setProgressoConvite(40);

    setTimeout(() => {
      setProgressoConvite(100);
      setExtraConfirmado(extra);

      setTimeout(() => {
        setItensConversa((prev) => [
          ...prev,
          {
            id: `playcaller-pos-${Date.now()}`,
            tipo: "play-caller",
          },
        ]);
      }, 700);
    }, 1600);
  };

  // Dispara recálculo proporcional direto pelo botão ou pela conversa
  const executarRecalculoReceita = (receitaAlvo, ingredienteIdOuNome, qtdDisponivel, unidade) => {
    const resultado = recalcularReceitaPorIngrediente(
      receitaAlvo,
      ingredienteIdOuNome,
      qtdDisponivel,
      unidade
    );
    if (!resultado) return;

    setUltimaReceitaAtiva(receitaAlvo);
    setItensConversa((prev) => [
      ...prev,
      {
        id: `recalc-${Date.now()}`,
        tipo: "receita-recalculada",
        receita: receitaAlvo,
        calculo: resultado,
      },
    ]);

    if (vozAtiva && audioDisponivel()) {
      falar(
        `Recalculei a ficha técnica de ${receitaAlvo.nome} para ${resultado.percentual}% da receita original, com base em ${resultado.quantidadeDisponivelLimitante} ${resultado.ingredienteLimitante.unidade} de ${resultado.ingredienteLimitante.nome}.`
      );
    }
  };

  const mostrarRespostaHefisto = (dados) => {
    if (dados?.referencia) referenciaHefisto.current = dados.referencia;
    setItensConversa((prev) => [...prev, { id: `hef-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tipo: "resposta-hefisto", resposta: dados }]);
    if (vozAtiva && audioDisponivel() && dados?.texto) falar(dados.texto);
  };
  const executarHefisto = async (chamada, falha) => {
    if (ocupadoHefisto) return;
    setOcupadoHefisto(true);
    try {
      const r = await chamada();
      mostrarRespostaHefisto(r?.ok ? r.dados : { tipo: "erro_acao", texto: r?.dados?.erro || falha });
    } catch (_) {
      mostrarRespostaHefisto({ tipo: "erro_acao", texto: "Falha de conexão. Verifique a internet e tente novamente." });
    } finally {
      setOcupadoHefisto(false);
    }
  };
  const continuarHefisto = (pergunta, valor) => {
    const bruto = String(valor).trim();
    const numero = pergunta.campo === "quantidade" ? Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto) : null;
    const campo = { acaoId: pergunta.acaoId, campo: pergunta.campo, valor: numero == null ? bruto : null, valorNumero: Number.isFinite(numero) ? numero : null };
    return executarHefisto(() => perguntarAoHefisto(unidadeAtiva, { continuar: campo, tela: "green-dot" }), "Não consegui continuar.");
  };

  // Interpreta a pergunta/tópico do colaborador
  const processarPergunta = async (fraseManual, metaTopico = null) => {
    const pergunta = String(fraseManual ?? texto).trim();
    if (!pergunta) return;

    const novaContagem = Math.min(5, contagemReq + 1);
    setContagemReq(novaContagem);
    setTexto("");

    const msgUsuario = {
      id: `usr-${Date.now()}`,
      tipo: "pergunta-usuario",
      texto: pergunta,
      numReq: novaContagem,
    };

    setItensConversa((prev) => [...prev, msgUsuario]);
    const q = pergunta.toLowerCase();

    // 1. Verifica se é um pedido de RECÁLCULO PROPORCIONAL de receita (ex: "tenho todos os ingredientes do vatapá só o leite de coco que era para ser 3L e só tenho 2L")
    if (metaTopico?.id === "recalculo-vatapa-2l") {
      const vatapa =
        todasAsReceitas.find((r) => r.id === "vatapa-baiano") || RECEITAS_GREEN_DOT[0];
      executarRecalculoReceita(vatapa, "leite-coco", 2, "L");
      return;
    }

    const intencaoRecalculo = detectarIntencaoRecalculo(
      pergunta,
      ultimaReceitaAtiva,
      todasAsReceitas
    );
    if (intencaoRecalculo && intencaoRecalculo.calculo) {
      setUltimaReceitaAtiva(intencaoRecalculo.receita);
      setItensConversa((prev) => [
        ...prev,
        {
          id: `recalc-${Date.now()}`,
          tipo: "receita-recalculada",
          receita: intencaoRecalculo.receita,
          calculo: intencaoRecalculo.calculo,
        },
      ]);
      if (vozAtiva && audioDisponivel()) {
        falar(
          `Recalculei a receita de ${intencaoRecalculo.receita.nome} proporcionalmente para ${intencaoRecalculo.calculo.percentual}% com base nos seus ${intencaoRecalculo.calculo.quantidadeDisponivelLimitante} ${intencaoRecalculo.calculo.ingredienteLimitante.unidade} de ${intencaoRecalculo.calculo.ingredienteLimitante.nome}.`
        );
      }
      return;
    }

    // 2. Verifica se é pergunta sobre EQUIPAMENTO VISUAL: Voltagem (110V / 220V), Liquidificador, Como Encaixar Copo e Tampa, Como Usar ou Como Limpar
    const perguntaDeVoltagemOuGuiaEquip =
      metaTopico?.id === "liquidificador-voltagem" ||
      metaTopico?.id === "liquidificador-encaixe-limpeza" ||
      q.includes("110") ||
      q.includes("220") ||
      q.includes("voltagem") ||
      q.includes("tensão") ||
      q.includes("tensao") ||
      q.includes("tomada") ||
      q.includes("liquidificador") ||
      q.includes("encaixar") ||
      q.includes("encaixe") ||
      q.includes("copo") ||
      q.includes("tampa") ||
      (q.includes("como usar") && !q.includes("sistema")) ||
      q.includes("como limpar") ||
      q.includes("higienizar");

    if (perguntaDeVoltagemOuGuiaEquip) {
      const filtroCategoria = q.includes("liquidificador")
        ? "liquidificador"
        : q.includes("forno")
        ? "forno"
        : q.includes("fritadeira")
        ? "fritadeira"
        : q.includes("chopeira")
        ? "chopeira"
        : null;

      const abaSugerida =
        q.includes("encaixar") || q.includes("encaixe") || q.includes("copo") || q.includes("tampa")
          ? "encaixe"
          : q.includes("limpar") || q.includes("higienizar") || q.includes("lavar")
          ? "limpeza"
          : q.includes("como usar") || q.includes("bater") || q.includes("operar")
          ? "uso"
          : "voltagem";

      setItensConversa((prev) => [
        ...prev,
        {
          id: `eq-vis-${Date.now()}`,
          tipo: "equipamento-visual-guia",
          filtroCategoria,
          abaInicial: abaSugerida,
        },
      ]);
      if (vozAtiva && audioDisponivel()) {
        falar(
          "Mostrei as fotos dos equipamentos cadastrados. Clique no equipamento à sua frente para ver se é 110 ou 220 volts e o passo a passo com foto e vídeo de como encaixar, usar e limpar."
        );
      }
      return;
    }

    // 3. Se clicou em uma ficha real do ERP
    if (metaTopico?.fichaReal) {
      const recConvertida = converterFichaRealParaGreenDot(
        metaTopico.fichaReal,
        complementosFichas
      );
      setUltimaReceitaAtiva(recConvertida);
      const idBloco = `rec-${Date.now()}`;
      setVideosAbertos((v) => ({ ...v, [idBloco]: true }));
      setItensConversa((prev) => [
        ...prev,
        { id: idBloco, tipo: "receita-completa", receita: recConvertida },
      ]);
      return;
    }

    // 4. Verifica se é uma das receitas (Vatapá, Risoto, Moscow Mule, Parmegiana, Custom ou Ficha Real pelo nome)
    // Ficha real da casa primeiro (nome inteiro ou a palavra principal: "vatapá" acha "Vatapá Baiano");
    // as receitas de referência do Green Dot só entram quando a casa não tem ficha com esse nome.
    const semAcento = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace("*", "").trim();
    const qn = ` ${semAcento(q).replace(/[^a-z0-9]+/g, " ")} `;
    const daCasa = todasAsReceitas.filter((r) => !RECEITAS_GREEN_DOT.includes(r));
    const receitaDaCasa =
      daCasa.find((r) => (metaTopico?.id && metaTopico.id === r.id) || (semAcento(r.nome) && qn.includes(` ${semAcento(r.nome)} `))) ||
      daCasa.find((r) => {
        const principal = semAcento(r.nome).split(/[^a-z0-9]+/).find((w) => w.length >= 4);
        return principal && qn.includes(` ${principal} `);
      });
    const receitaEncontrada = receitaDaCasa || RECEITAS_GREEN_DOT.find((r) => {
      if (metaTopico?.id && metaTopico.id === r.id) return true;
      const nomeLimpo = String(r.nome || "")
        .toLowerCase()
        .replace("*", "");
      if (nomeLimpo && q.includes(nomeLimpo)) return true;
      if ((q.includes("vatapá") || q.includes("vatapa")) && r.id === "vatapa-baiano") return true;
      if (q.includes("risoto") && r.id === "risoto-camarao") return true;
      if (
        (q.includes("moscow") || q.includes("mule") || q.includes("drink")) &&
        r.id === "moscow-mule"
      )
        return true;
      if (
        (q.includes("parmegiana") || q.includes("filé") || q.includes("file")) &&
        r.id === "file-parmegiana"
      )
        return true;
      return false;
    });

    if (receitaEncontrada) {
      setUltimaReceitaAtiva(receitaEncontrada);
      const idBloco = `rec-${Date.now()}`;
      setVideosAbertos((v) => ({ ...v, [idBloco]: true }));
      setItensConversa((prev) => [
        ...prev,
        { id: idBloco, tipo: "receita-completa", receita: receitaEncontrada },
      ]);
      if (vozAtiva && audioDisponivel()) {
        falar(
          `Aqui está a receita completa de ${receitaEncontrada.nome} com ingredientes ligados ao estoque, passo a passo com foto, vídeo e calculadora proporcional.`
        );
      }
      return;
    }

    // 5. Verifica se é Rotina Operacional (Pull-to-Thaw, Câmara Fria/PVPS, Rotina de Forno)
    if (
      metaTopico?.id === "pull-to-thaw" ||
      q.includes("descongel") ||
      q.includes("pull") ||
      q.includes("thaw")
    ) {
      setItensConversa((prev) => [
        ...prev,
        { id: `rot-${Date.now()}`, tipo: "rotina", rotina: ROTINAS_OPERACIONAIS["pull-to-thaw"] },
      ]);
      return;
    }

    if (
      metaTopico?.id === "organizacao-camara" ||
      q.includes("câmara") ||
      q.includes("camara") ||
      q.includes("pvps") ||
      q.includes("peps") ||
      q.includes("organiza")
    ) {
      setItensConversa((prev) => [
        ...prev,
        {
          id: `rot-${Date.now()}`,
          tipo: "rotina",
          rotina: ROTINAS_OPERACIONAIS["organizacao-camara"],
        },
      ]);
      return;
    }

    if (metaTopico?.id === "rotina-forno" || (q.includes("rotina") && q.includes("forno"))) {
      setItensConversa((prev) => [
        ...prev,
        { id: `rot-${Date.now()}`, tipo: "rotina", rotina: ROTINAS_OPERACIONAIS["rotina-forno"] },
      ]);
      return;
    }

    // 6. Verifica se é Manutenção de Equipamentos / Falhas / Chamado
    if (
      metaTopico?.id === "forno-vapor" ||
      metaTopico?.id === "chopeira-espuma" ||
      q.includes("forno") ||
      q.includes("chopeira") ||
      q.includes("fritadeira") ||
      q.includes("equipamento") ||
      q.includes("manuten") ||
      q.includes("chamado") ||
      q.includes("consert") ||
      q.includes("falha") ||
      q.includes("espuma") ||
      q.includes("vapor")
    ) {
      const equipId =
        metaTopico?.id === "chopeira-espuma" || q.includes("chopeira") || q.includes("espuma")
          ? "chopeira-torre"
          : q.includes("fritadeira") || q.includes("óleo")
          ? "fritadeira-vulcan"
          : metaTopico?.id === "forno-vapor" || q.includes("forno")
          ? "forno-combinado"
          : null;

      setItensConversa((prev) => [
        ...prev,
        {
          id: `manut-${Date.now()}`,
          tipo: "manutencao",
          equipamentoInicialId: equipId,
        },
      ]);
      return;
    }

    // 7. Escala do dia: responde o Héfisto (passo 9) com o cadastro real do RH e as folgas lançadas.

    if (
      q.includes("disponível") ||
      q.includes("disponivel") ||
      q.includes("bruno") ||
      q.includes("extra") ||
      q.includes("apoio") ||
      q.includes("chamar")
    ) {
      setItensConversa((prev) => [
        ...prev,
        { id: `disp-${Date.now()}`, tipo: "extras-disponiveis" },
      ]);
      return;
    }

    // 8. Verifica se é pergunta sobre LIMPEZA, PRODUTO NO CHÃO, QUANTAS ML, COMO LIMPAR PANO, COMO LAVAR AS MÃOS
    const isPerguntaLimpeza =
      metaTopico?.id?.startsWith("limpeza-") ||
      metaTopico?.id === "lavagem-maos" ||
      metaTopico?.id === "sanitizacao-hortifruti" ||
      q.includes("chao") ||
      q.includes("chão") ||
      q.includes("pano") ||
      q.includes("opano") ||
      q.includes("lavar as maos") ||
      q.includes("lavar as mãos") ||
      q.includes("lavar mao") ||
      q.includes("lavar mão") ||
      q.includes("quantas ml") ||
      q.includes("quanto de produto") ||
      q.includes("qual produto") ||
      (q.includes("como limpar") && !q.includes("liquidificador") && !q.includes("forno") && !q.includes("chopeira")) ||
      q.includes("dilui") ||
      q.includes("sanitiz") ||
      q.includes("desinfet");

    if (isPerguntaLimpeza) {
      const rotinaId =
        metaTopico?.id ||
        (q.includes("pano") || q.includes("opano")
          ? "limpeza-panos"
          : q.includes("mao") || q.includes("mão")
          ? "lavagem-maos"
          : q.includes("fruta") || q.includes("hortali") || q.includes("salada")
          ? "sanitizacao-hortifruti"
          : "limpeza-chao");

      setItensConversa((prev) => [
        ...prev,
        { id: `limp-${Date.now()}`, tipo: "guia-limpeza", rotinaInicialId: rotinaId },
      ]);
      if (vozAtiva && audioDisponivel()) {
        if (rotinaId === "limpeza-chao") {
          falar(
            "Para o chão, use 50 ml de desengordurante clorado para cada 5 litros de água morna e deixe agir por 10 minutos antes de esfregar e puxar com rodo."
          );
        } else if (rotinaId === "limpeza-panos") {
          falar(
            "Para panos, use 25 ml de cloro por litro de água fria e deixe de molho por 20 a 30 minutos. Nunca use o pano do chão na bancada de alimentos!"
          );
        } else if (rotinaId === "lavagem-maos") {
          falar(
            "Para lavar as mãos, use sabonete bactericida inodoro por 40 a 60 segundos, seque com papel toalha e finalize com álcool 70%."
          );
        } else {
          falar(
            "Aqui está o guia oficial de higienização, dosagem química em mililitros e regras da ANVISA."
          );
        }
      }
      return;
    }

    // 9. Verifica se é CHECKLIST DE ABERTURA OU SAÍDA / FECHAMENTO DE PRAÇA
    const isPerguntaChecklist =
      metaTopico?.id === "checklist-abertura" ||
      metaTopico?.id === "checklist-fechamento" ||
      q.includes("checklist") ||
      (q.includes("abertura") && (q.includes("praca") || q.includes("praça") || q.includes("cozinha") || q.includes("bar") || q.includes("turno"))) ||
      q.includes("fechamento") ||
      ((q.includes("saida") || q.includes("saída")) && (q.includes("turno") || q.includes("cozinha") || q.includes("bar") || q.includes("checklist")));

    if (isPerguntaChecklist) {
      const tipoCheck =
        metaTopico?.id === "checklist-fechamento" ||
        q.includes("fechamento") ||
        q.includes("saida") ||
        q.includes("saída")
          ? "fechamento"
          : "abertura";

      setItensConversa((prev) => [
        ...prev,
        { id: `chk-${Date.now()}`, tipo: "checklist-turno", tipoInicial: tipoCheck },
      ]);
      if (vozAtiva && audioDisponivel()) {
        falar(
          tipoCheck === "abertura"
            ? "Aqui está o checklist de abertura e mise en place da praça. Marque cada item antes do salão abrir."
            : "Aqui está o checklist de saída e fechamento de turno. Certifique-se de travar o gás e desligar equipamentos."
        );
      }
      return;
    }

    // 10. Verifica se é ETIQUETA DE VALIDADE / ANVISA NO APP
    const isPerguntaEtiqueta =
      metaTopico?.id === "etiqueta-validade" ||
      q.includes("etiqueta") ||
      q.includes("rotul") ||
      q.includes("validade de pote");

    if (isPerguntaEtiqueta) {
      setItensConversa((prev) => [
        ...prev,
        {
          id: `etq-${Date.now()}`,
          tipo: "etiqueta-rapida",
          produtoInicial: ultimaReceitaAtiva?.nome || "Vatapá Tradicional da Casa",
        },
      ]);
      if (vozAtiva && audioDisponivel()) {
        falar(
          "Abri o gerador de etiqueta de validade ANVISA integrado ao seu app com cálculo automático de data de manipulação e conservação."
        );
      }
      return;
    }

    // 11. Verifica se é Play Caller / Mapa de Praças
    if (
      metaTopico?.id === "mapa-pracas" ||
      q.includes("praça") ||
      q.includes("praca") ||
      q.includes("posicionamento") ||
      q.includes("mapa") ||
      q.includes("formação") ||
      q.includes("play")
    ) {
      setItensConversa((prev) => [
        ...prev,
        { id: `play-${Date.now()}`, tipo: "play-caller" },
      ]);
      return;
    }

    // Previsão do tempo da cidade da unidade (Open-Meteo, grátis).
    if (ehPerguntaDoTempo(pergunta)) {
      setCarregandoIA(true);
      let textoTempo = "DADOS INSUFICIENTES: não consegui a previsão agora.";
      try {
        const r = await fetchComSessao("/api/clima", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cidade: unidadeInfo?.cidade || "", uf: unidadeInfo?.uf || "", dia: diaDaPergunta(pergunta) }) });
        const d = await r.json();
        if (d?.texto) textoTempo = d.texto;
      } catch (_) { /* fica a mensagem de dados insuficientes */ }
      setItensConversa((prev) => [...prev, { id: `clima-${Date.now()}`, tipo: "resposta-texto-ia", texto: textoTempo }]);
      if (vozAtiva && audioDisponivel()) falar(textoTempo);
      setCarregandoIA(false);
      return;
    }

    // 9. Pergunta do restaurante (lucro, estoque, CMV, vendas, contas, RH…):
    //    responde o Héfisto com os dados reais. Se ele não entender, segue
    //    para a conversa aberta do Green Dot.
    setCarregandoIA(true);
    if (unidadeAtiva && unidadeAtiva !== "todas") {
      try {
        const r = await perguntarAoHefisto(unidadeAtiva, { texto: pergunta, chave: novaChaveDeEnvio(), canal: vozAtiva ? "voz" : "texto", tela: "green-dot", conversa: referenciaHefisto.current });
        if (r?.ok && r.dados && r.dados.tipo !== "nao_entendi") {
          mostrarRespostaHefisto(r.dados);
          setCarregandoIA(false);
          return;
        }
      } catch (_) {
        // sem resposta do Héfisto: segue para a conversa aberta
      }
    }

    // 10. Consulta conversacional aberta na rota de IA (/api/ia-green-dot)
    try {
      const res = await fetchComSessao("/api/ia-green-dot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta,
          contextoLoja: {
            unidade: unidadeInfo?.nome || "Restaurante Matriz",
            fichas: todasAsReceitas.map((f) => ({ id: f.id, nome: f.nome, setor: f.setor })),
            equipamentos: todosOsEquipamentos.map((e) => ({
              id: e.id,
              nome: e.nome,
              voltagem: e.voltagem,
              setor: e.setor,
            })),
            estoque: estoque.slice(0, 40).map((i) => ({
              nome: i.nome,
              quantidade_atual: i.quantidade_atual,
              unidade: i.unidade_medida,
              estoque_minimo: i.estoque_minimo,
            })),
          },
        }),
      });
      const data = await res.json();
      const textoResposta =
        data?.resposta ||
        "Consultei os manuais da unidade. Você pode usar os botões abaixo para abrir fichas técnicas, recalcular ingredientes ou ver fotos e voltagem dos equipamentos.";
      setItensConversa((prev) => [
        ...prev,
        { id: `ia-${Date.now()}`, tipo: "resposta-texto-ia", texto: textoResposta },
      ]);
      if (vozAtiva && audioDisponivel()) falar(textoResposta);
    } catch (_) {
      setItensConversa((prev) => [
        ...prev,
        {
          id: `ia-err-${Date.now()}`,
          tipo: "resposta-texto-ia",
          texto: "Aqui está o acesso rápido às fichas técnicas, calculadora de ingredientes e manuais de equipamentos da loja.",
        },
      ]);
    } finally {
      setCarregandoIA(false);
    }
  };

  // Controle de microfone
  const alternarMicrofone = () => {
    if (ouvindo) {
      escutaRef.current?.parar();
      escutaRef.current = null;
      setOuvindo(false);
      return;
    }
    if (typeof window === "undefined" || !vozDisponivel()) return;
    calarVoz();
    const s = criarEscuta({
      continuo: false,
      silencioMs: 2500,
      onParcial: (t) => setTexto(t.slice(0, 256)),
      onFinal: (frase) => {
        setOuvindo(false);
        if (frase?.trim()) {
          setTexto(frase.trim().slice(0, 256));
          processarPergunta(frase.trim().slice(0, 256));
        }
      },
      onErro: () => setOuvindo(false),
      onFim: () => setOuvindo(false),
    });
    if (s) {
      escutaRef.current = s;
      setOuvindo(true);
    }
  };

  // Atalhos rápidos na barra superior do iPad
  const abrirFluxoDireto = (fluxo) => {
    if (fluxo === "vatapa") {
      processarPergunta("Como se faz um Vatapá?", {
        id: "vatapa-baiano",
      });
    } else if (fluxo === "recalculo") {
      processarPergunta(
        "Tenho todos os ingredientes do vatapá, só o leite de coco que era para ser 3L e só tenho 2L.",
        { id: "recalculo-vatapa-2l" }
      );
    } else if (fluxo === "liquidificador") {
      processarPergunta(
        "Esse liquidificador é 110V ou 220V? E como encaixar o copo e a tampa, como usar e como limpar?",
        { id: "liquidificador-voltagem" }
      );
    } else if (fluxo === "limpeza") {
      processarPergunta(
        "Qual produto usar no chão, quantas ml e como limpar? E como higienizar panos e lavar as mãos?",
        { id: "limpeza-chao" }
      );
    } else if (fluxo === "checklist") {
      processarPergunta(
        "Abrir o checklist de abertura e fechamento de turno da praça",
        { id: "checklist-abertura" }
      );
    } else if (fluxo === "etiqueta") {
      processarPergunta(
        "Quero gerar uma etiqueta de validade ANVISA conectada ao app",
        { id: "etiqueta-validade" }
      );
    } else if (fluxo === "escala") {
      processarPergunta("Quem trabalha hoje?");
    } else if (fluxo === "admin") {
      setAbaAdminInicial("receitas");
      setModalAdminAberto(true);
    }
  };

  return (
    <div
      className={`min-h-[calc(100dvh-4rem)] w-full flex flex-col items-center justify-center transition-colors ${
        molduraTablet ? "bg-[#244332] py-3 sm:py-6 px-2 sm:px-6" : "bg-[#F4F3EF]"
      }`}
    >
      {/* MOLDURA DE IPAD / TABLET DE LOJA */}
      <div
        className={`w-full flex flex-col bg-[#F4F3EF] text-[#1C2826] overflow-hidden transition-all ${
          molduraTablet
            ? "max-w-4xl rounded-[28px] border-[10px] sm:border-[14px] border-[#1A1D1B] shadow-2xl min-h-[85dvh] max-h-[90dvh]"
            : "max-w-5xl min-h-[calc(100dvh-4rem)]"
        }`}
      >
        {/* BARRA DE TOPO DO TABLET */}
        <header className="px-4 sm:px-6 py-3 bg-[#F4F3EF]/95 backdrop-blur-xs border-b border-[#E4E2DA] flex items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMostrarConfig((v) => !v)}
              title="Configurações do Tablet"
              className="w-9 h-9 rounded-lg border border-[#76847D] bg-white hover:bg-[#EBF3EE] text-[#1E4D3B] flex items-center justify-center shadow-2xs transition"
            >
              <Settings size={18} />
            </button>

            <div className="flex items-center gap-2 pl-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2E6F4E] animate-pulse" />
              <div>
                <h1 className="text-xs sm:text-sm font-black tracking-tight text-[#1E4D3B] flex items-center gap-1.5">
                  Green Dot Assist
                  <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#DCECE3] text-[#1E4D3B]">
                    Cozinha · Bar · Equipamentos
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Pílulas de demonstração rápida dos fluxos */}
          <div className="hidden lg:flex items-center gap-1 bg-[#EAE8E1] p-1 rounded-xl border border-[#DAD8CE]">
            <button
              onClick={() => abrirFluxoDireto("vatapa")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <UtensilsCrossed size={12} /> Receita Vatapá
            </button>
            <button
              onClick={() => abrirFluxoDireto("recalculo")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#8A4200] hover:bg-white transition flex items-center gap-1"
            >
              <Scale size={12} /> Só Tenho 2L (Recálculo)
            </button>
            <button
              onClick={() => abrirFluxoDireto("liquidificador")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <Zap size={12} /> 110V/220V &amp; Encaixe
            </button>
            <button
              onClick={() => abrirFluxoDireto("limpeza")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <Droplets size={12} /> Limpeza (mL)
            </button>
            <button
              onClick={() => abrirFluxoDireto("checklist")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#8C6D23] hover:bg-white transition flex items-center gap-1"
            >
              <ClipboardCheck size={12} /> Checklists
            </button>
            <button
              onClick={() => abrirFluxoDireto("etiqueta")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <Tag size={12} /> Etiqueta ANVISA
            </button>
            <button
              onClick={() => abrirFluxoDireto("admin")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-[#1E4D3B] text-white hover:bg-[#163B2D] transition flex items-center gap-1"
            >
              <PlusCircle size={12} /> Cadastrar Tudo
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setAbaAdminInicial("receitas");
                setModalAdminAberto(true);
              }}
              title="Alimentar Receitas, Fotos, Vídeos e Equipamentos"
              className="lg:hidden px-2.5 h-9 rounded-lg bg-[#1E4D3B] text-white text-[11px] font-extrabold flex items-center gap-1"
            >
              <PlusCircle size={14} /> Cadastrar
            </button>

            <button
              onClick={() => setVozAtiva((v) => !v)}
              title={vozAtiva ? "Desativar leitura em voz" : "Ativar leitura em voz"}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                vozAtiva
                  ? "border-[#2E6F4E] bg-[#2E6F4E] text-white"
                  : "border-[#76847D] bg-white text-[#1E4D3B] hover:bg-[#EBF3EE]"
              }`}
            >
              {vozAtiva ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>

            <button
              onClick={() => setMolduraTablet((v) => !v)}
              title={molduraTablet ? "Expandir tela cheia" : "Mostrar moldura iPad"}
              className="w-9 h-9 rounded-lg border border-[#76847D] bg-white hover:bg-[#EBF3EE] text-[#1E4D3B] flex items-center justify-center shadow-2xs transition"
            >
              {molduraTablet ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>

            <button
              onClick={() => setMostrarBannerProp((v) => !v)}
              title="Sobre o Green Dot Assist"
              className="w-9 h-9 rounded-lg border border-[#76847D] bg-white hover:bg-[#EBF3EE] text-[#1E4D3B] flex items-center justify-center shadow-2xs transition"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </header>

        {/* Painel rápido de configurações quando clica na engrenagem */}
        {mostrarConfig && (
          <div className="px-6 py-3 bg-[#E9F2EC] border-b border-[#C5DDD0] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="font-bold text-[#1E4D3B]">
              Unidade:{" "}
              <span className="font-black underline">
                {unidadeInfo?.nome || "Unidade Matriz"}
              </span>{" "}
              · Fichas ativas: <strong>{todasAsReceitas.length}</strong> · Equipamentos com foto/vídeo:{" "}
              <strong>{todosOsEquipamentos.length}</strong> · Estoque Cozinha &amp; Bar:{" "}
              <strong>{estoque.length} insumos</strong>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => abrirFluxoDireto("vatapa")}
                className="px-2.5 py-1 rounded bg-white border border-[#2E6F4E] text-[#1E4D3B] font-bold"
              >
                Testar Vatapá
              </button>
              <button
                onClick={() => abrirFluxoDireto("recalculo")}
                className="px-2.5 py-1 rounded bg-white border border-[#E5A93C] text-[#8A4200] font-bold"
              >
                Testar Recálculo (3L → 2L)
              </button>
              <button
                onClick={() => abrirFluxoDireto("liquidificador")}
                className="px-2.5 py-1 rounded bg-white border border-[#2E6F4E] text-[#1E4D3B] font-bold"
              >
                Testar 110V/220V &amp; Encaixe
              </button>
              <button
                onClick={() => abrirFluxoDireto("limpeza")}
                className="px-2.5 py-1 rounded bg-white border border-[#2E6F4E] text-[#1E4D3B] font-bold"
              >
                Testar Limpeza (mL)
              </button>
              <button
                onClick={() => abrirFluxoDireto("checklist")}
                className="px-2.5 py-1 rounded bg-white border border-[#8C6D23] text-[#694E0E] font-bold"
              >
                Testar Checklist
              </button>
              <button
                onClick={() => abrirFluxoDireto("etiqueta")}
                className="px-2.5 py-1 rounded bg-white border border-[#2E6F4E] text-[#1E4D3B] font-bold"
              >
                Testar Etiqueta
              </button>
              <button
                onClick={() => abrirFluxoDireto("admin")}
                className="px-2.5 py-1 rounded bg-[#1E4D3B] text-white font-bold"
              >
                + Alimentar Dados
              </button>
            </div>
          </div>
        )}

        {/* ÁREA DE CONTEÚDO ROLÁVEL DO TABLET */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
          {/* Banner Editorial quando ativo */}
          {mostrarBannerProp && <BrandValueBanner />}

          {/* Card de Boas-Vindas e Pílulas de Acesso Rápido + Botão para Alimentar Conhecimento */}
          <WelcomeGovernanceCard
            fichasReais={fichasReais}
            receitasCustom={receitasCustom}
            equipamentosCustom={equipamentosCustom}
            onSelectTopic={(topico) => processarPergunta(topico.prompt, topico)}
            onOpenAdminStudio={() => {
              setAbaAdminInicial("receitas");
              setModalAdminAberto(true);
            }}
          />


          {/* FLUXO DE MENSAGENS E CARDS INTERATIVOS */}
          {itensConversa.map((bloco) => {
            if (bloco.tipo === "pergunta-usuario") {
              return (
                <div key={bloco.id} className="space-y-1">
                  <div className="flex items-center justify-end gap-3">
                    <div className="flex-1 max-w-xl bg-white rounded-2xl border border-[#DFDDD4] shadow-xs px-5 py-3.5 text-sm sm:text-base font-bold text-[#1C2826]">
                      {bloco.texto}
                    </div>
                    <PartnerBubbleAvatar />
                  </div>
                  <div className="pr-14 text-right text-[11px] font-bold text-[#5A655F]">
                    {bloco.numReq} de 5 solicitações
                  </div>
                </div>
              );
            }

            // Ficha Técnica Completa + Ingredientes com Saldo de Estoque + Calculadora Proporcional + Passo a Passo Foto & Vídeo
            if (bloco.tipo === "receita-completa") {
              return (
                <div key={bloco.id} className="space-y-4">
                  <RecipeDetailCard
                    receita={bloco.receita}
                    estoqueReal={estoque}
                    onRecalcularClick={(rec, ing, val) =>
                      executarRecalculoReceita(rec, ing.id, val)
                    }
                  />
                  <RecipeInteractiveFollowUp
                    receita={bloco.receita}
                    mostrarVideo={!!videosAbertos[bloco.id]}
                    onToggleVideo={(val) =>
                      setVideosAbertos((prev) => ({ ...prev, [bloco.id]: val }))
                    }
                    categoriaAtiva={dicaAtivaPorMsg[bloco.id]}
                    onSelectCategoryTip={(cat) =>
                      setDicaAtivaPorMsg((prev) => ({
                        ...prev,
                        [bloco.id]: prev[bloco.id] === cat ? null : cat,
                      }))
                    }
                  />
                  <CustomizationAndPairingCard receita={bloco.receita} />
                </div>
              );
            }

            // Card de Receita Recalculada Proporcionalmente (Ex: 3L -> 2L de Leite de Coco no Vatapá)
            if (bloco.tipo === "receita-recalculada") {
              return (
                <RecipeRecalculatedCard
                  key={bloco.id}
                  calculoInicial={bloco.calculo}
                />
              );
            }

            // Seletor Visual de Equipamento por Foto (110V vs 220V) + Como Encaixar Copo e Tampa + Como Usar + Como Limpar (Foto & Vídeo)
            if (bloco.tipo === "equipamento-visual-guia") {
              return (
                <EquipmentVisualSelectorAndGuidesCard
                  key={bloco.id}
                  equipamentos={todosOsEquipamentos}
                  categoriaFiltro={bloco.filtroCategoria}
                  abaInicial={bloco.abaInicial || "voltagem"}
                  onAbrirManutencao={(eqId) => {
                    setItensConversa((prev) => [
                      ...prev,
                      {
                        id: `manut-${Date.now()}`,
                        tipo: "manutencao",
                        equipamentoInicialId: eqId,
                      },
                    ]);
                  }}
                />
              );
            }

            // Rotinas Operacionais (Pull-to-Thaw / PVPS / Forno)
            if (bloco.tipo === "rotina") {
              return <OperationalRoutineCard key={bloco.id} rotina={bloco.rotina} />;
            }

            // Central de Manutenção de Equipamentos e Chamados
            if (bloco.tipo === "manutencao") {
              return (
                <EquipmentMaintenanceFlowCard
                  key={bloco.id}
                  equipamentos={todosOsEquipamentos}
                  equipamentoInicialId={bloco.equipamentoInicialId}
                  chamados={chamados}
                  onNovoChamado={(novo) => setChamados((prev) => [novo, ...prev])}
                  unidadeInfo={unidadeInfo}
                  sessao={sessao}
                />
              );
            }

            // Escala de Hoje em Organograma por Área & Horários de Trabalho (com toggle para Gantt)
            if (bloco.tipo === "escala-organograma" || bloco.tipo === "escala-gantt") {
              return (
                <ShiftOrganogramCard
                  key={bloco.id}
                  dados={ESCALA_ORGANOGRAMA_DO_DIA}
                  escala={ESCALA_TURNO_GANTT}
                  onAddPartnerClick={() => {
                    const nReq = Math.min(5, contagemReq + 1);
                    setContagemReq(nReq);
                    setItensConversa((prev) => [
                      ...prev,
                      {
                        id: `usr-extra-${Date.now()}`,
                        tipo: "pergunta-usuario",
                        texto:
                          "Sim, vamos chamar mais um colaborador para apoiar no pico. Pode checar quem está disponível? Sugiro o Bruno S. se estiver livre.",
                        numReq: nReq,
                      },
                      {
                        id: `disp-${Date.now()}`,
                        tipo: "extras-disponiveis",
                      },
                    ]);
                  }}
                />
              );
            }

            // Colaboradores disponíveis + progresso 40% -> 100%
            if (bloco.tipo === "extras-disponiveis") {
              return (
                <AvailablePartnersOutreachCard
                  key={bloco.id}
                  extras={EXTRAS_DISPONIVEIS}
                  convidadoId={convidadoExtraId}
                  progressoConvite={progressoConvite}
                  onSendRequest={(extra) => dispararConviteExtra(extra)}
                />
              );
            }

            // Play Caller — Mapa de Posicionamento das Praças
            if (bloco.tipo === "play-caller") {
              return (
                <PlayCallerStationMapCard
                  key={bloco.id}
                  formacao={FORMACAO_PRACAS_BASE}
                  extraConfirmado={extraConfirmado}
                />
              );
            }

            // Guia Oficial de Limpeza, Dosagem em mL e Higienização ANVISA
            if (bloco.tipo === "guia-limpeza") {
              return (
                <CleaningSanitizationGuideCard
                  key={bloco.id}
                  rotinaInicialId={bloco.rotinaInicialId}
                />
              );
            }

            // Checklist de Abertura & Fechamento/Saída de Turno por Praça
            if (bloco.tipo === "checklist-turno") {
              return (
                <ShiftChecklistCard
                  key={bloco.id}
                  tipoInicial={bloco.tipoInicial}
                />
              );
            }

            // Gerador Rápido de Etiqueta de Validade ANVISA integrado ao App
            if (bloco.tipo === "etiqueta-rapida") {
              return (
                <EtiquetaQuickGeneratorCard
                  key={bloco.id}
                  produtoInicial={bloco.produtoInicial}
                  unidadeId={unidadeAtiva}
                />
              );
            }

            // Resposta do Héfisto com os dados reais da unidade
            if (bloco.tipo === "resposta-hefisto") {
              return (
                <div key={bloco.id} className="flex items-start gap-3">
                  <GreenDotAvatar />
                  <div className="min-w-0 flex-1">
                    <MensagemRespostaHefisto r={bloco.resposta} ocupado={ocupadoHefisto}
                      onComando={(t) => processarPergunta(t)}
                      onContinuar={continuarHefisto}
                      onConfirmar={(acaoId, txt) => executarHefisto(() => confirmarAcao(unidadeAtiva, acaoId, txt), "Não consegui confirmar.")}
                      onCancelar={(acaoId) => executarHefisto(() => cancelarAcao(unidadeAtiva, acaoId), "Não consegui cancelar.")} />
                  </div>
                </div>
              );
            }

            // Resposta textual da IA
            if (bloco.tipo === "resposta-texto-ia") {
              return (
                <div key={bloco.id} className="flex items-start gap-3">
                  <GreenDotAvatar />
                  <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 text-sm sm:text-base text-[#1C2826] leading-relaxed whitespace-pre-line font-medium">
                    {bloco.texto}
                  </div>
                </div>
              );
            }

            return null;
          })}

          {carregandoIA && (
            <div className="flex items-start gap-3">
              <GreenDotAvatar />
              <div className="bg-white rounded-2xl border border-[#E2E0D8] px-5 py-4 text-xs sm:text-sm font-bold text-[#2E6F4E] flex items-center gap-2">
                <Sparkles size={16} className="animate-spin" />
                Consultando fichas técnicas, estoque e manuais de equipamentos...
              </div>
            </div>
          )}

          <div ref={fimChatRef} />
        </div>

        {/* BARRA INFERIOR FIXA IDÊNTICA ÀS TELAS DO IPAD */}
        <footer className="p-3 sm:p-4 bg-[#FAF9F6] border-t border-[#E2E0D8] shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-stretch gap-2.5 sm:gap-3">
              {/* Botão Coral "Restart" (Reiniciar) */}
              <button
                onClick={reiniciarConversa}
                className="w-20 sm:w-24 py-2.5 rounded-xl bg-[#E7B5AC] hover:bg-[#DDA399] border border-[#BA7A70] text-[#6E261E] flex flex-col items-center justify-center gap-1 font-extrabold text-xs sm:text-sm transition active:scale-95 shrink-0 shadow-2xs"
              >
                <RotateCcw size={18} strokeWidth={2.4} />
                <span>Reiniciar</span>
              </button>

              {/* Caixa de Texto Central com Microfone */}
              <div className="flex-1 flex flex-col">
                <div className="flex-1 relative flex items-center bg-[#DEDEDE] rounded-xl border border-[#C9C9C7] focus-within:border-[#2E6F4E] focus-within:bg-white transition px-3.5">
                  <input
                    type="text"
                    maxLength={256}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value.slice(0, 256))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        processarPergunta();
                      }
                    }}
                    placeholder={
                      ouvindo
                        ? "Ouvindo sua voz na bancada..."
                        : "Ex: 'Como se faz um vatapá', 'Só tenho 2L de leite de coco', 'Esse liquidificador é 110V ou 220V?'..."
                    }
                    className="w-full py-3 bg-transparent text-xs sm:text-sm font-semibold text-[#1C2826] placeholder:text-[#6B706D] focus:outline-none pr-9"
                  />

                  <button
                    type="button"
                    onClick={alternarMicrofone}
                    title="Falar comando por voz"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                      ouvindo
                        ? "bg-red-600 text-white animate-pulse"
                        : "text-[#4A5550] hover:bg-black/10"
                    }`}
                  >
                    {ouvindo ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold text-[#5C6660] mt-1 px-1">
                  <span>Pergunte qualquer coisa: lucro, estoque, fichas, escala, equipamentos…</span>
                  <span>{texto.length}/256</span>
                </div>
              </div>

              {/* Botão Verde-Floresta "Send" (Enviar) */}
              <button
                onClick={() => processarPergunta()}
                className="w-20 sm:w-24 py-2.5 rounded-xl bg-[#547D65] hover:bg-[#3E634D] text-white flex flex-col items-center justify-center gap-1 font-extrabold text-xs sm:text-sm transition active:scale-95 shrink-0 shadow-2xs"
              >
                <div className="w-5 h-5 rounded-full bg-white text-[#3E634D] flex items-center justify-center">
                  <ArrowUp size={13} strokeWidth={3} />
                </div>
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* MODAL CENTRAL DO GESTOR: CADASTRAR RECEITAS, FOTOS, VÍDEOS E EQUIPAMENTOS */}
      <GreenDotAdminModal
        aberto={modalAdminAberto}
        abaInicial={abaAdminInicial}
        onFechar={() => setModalAdminAberto(false)}
        receitasCustom={receitasCustom}
        equipamentosCustom={equipamentosCustom}
        fichasReais={fichasReais}
        estoqueReal={estoque}
        unidadeId={unidadeAtiva}
        onAtualizarDados={({ receitas, equipamentos }) => {
          if (receitas) {
            setReceitasCustom(receitas);
            if (receitas.length > 0) setUltimaReceitaAtiva(receitas[receitas.length - 1]);
          }
          if (equipamentos) {
            setEquipamentosCustom(equipamentos);
          }
        }}
      />
    </div>
  );
}
