"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { supabase, isSupabaseReady } from "../../lib/supabase";
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
  EXTRAS_DISPONIVEIS,
  FORMACAO_PRACAS_BASE,
} from "../../lib/green-dot-data";
import {
  GreenDotAvatar,
  PartnerBubbleAvatar,
  BrandValueBanner,
  WelcomeGovernanceCard,
  DemandSpikeAlertCard,
  RecipeDetailCard,
  RecipeInteractiveFollowUp,
  CustomizationAndPairingCard,
  OperationalRoutineCard,
  EquipmentMaintenanceFlowCard,
  ShiftScheduleGanttCard,
  AvailablePartnersOutreachCard,
  PlayCallerStationMapCard,
} from "./GreenDotCards";

function converterFichaRealParaGreenDot(ficha) {
  const ings = Array.isArray(ficha?.fichas_ingredientes) ? ficha.fichas_ingredientes : [];
  const majorSteps =
    ings.length > 0
      ? ings.slice(0, 5).map((item, idx) => {
          const qtdBase = Number(item.quantidade || 1);
          const nomeIng = item.insumos?.nome || item.nome || `Insumo ${idx + 1}`;
          const un = item.unidade_medida || item.insumos?.unidade_medida || "g";
          return {
            id: idx + 1,
            etapa: `${nomeIng} (${un})`,
            valores: [
              String(Math.round(qtdBase * 0.75 * 10) / 10),
              String(Math.round(qtdBase * 10) / 10),
              String(Math.round(qtdBase * 1.8 * 10) / 10),
              String(Math.round(qtdBase * 3 * 10) / 10),
            ],
          };
        })
      : [
          { id: 1, etapa: "Porção base padronizada da ficha", valores: ["0.75", "1", "2", "3"] },
          { id: 2, etapa: "Guarnição / Molho principal", valores: ["1", "1.5", "3", "4.5"] },
        ];

  return {
    id: `real-${ficha.id}`,
    codigo: ficha.codigo || `FT-${String(ficha.id).slice(0, 4).toUpperCase()}`,
    nome: ficha.nome || "Ficha Técnica da Casa",
    subtituloNota: "*Ficha Técnica Oficial Sincronizada do Héfisto ERP",
    setor: ficha.departamento || ficha.categoria || "Cozinha & Bar",
    imagem:
      ficha.foto_url ||
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80",
    descricao:
      ficha.modo_preparo ||
      ficha.observacoes ||
      `Preparo padronizado da unidade para ${ficha.nome}. Siga rigorosamente o porcionamento por tamanho para manter o CMV da loja.`,
    perfilSensorial: {
      sabor: "Padrão autoral da casa equilibrado",
      aroma: "Fresco e temperado na hora",
      textura: "Ponto de serviço padronizado",
    },
    basePrincipal:
      ings
        .slice(0, 2)
        .map((i) => i.insumos?.nome || i.nome)
        .filter(Boolean)
        .join(" + ") || "Insumos Oficiais da Ficha Técnica",
    colunasTamanho: ["P", "M", "G", "FAM"],
    legendaTamanhos: "P = Executivo · M = Individual Padrão · G = Duplo · FAM = Família",
    majorSteps,
    videoSteps: [
      {
        ordem: 1,
        titulo: `Mise en place e pesagem de ${ficha.nome}`,
        detalhe: "Separe os insumos porcionados conforme a tabela de etapas principais acima.",
        imagem:
          ficha.foto_url ||
          "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80",
      },
      {
        ordem: 2,
        titulo: "Finalização e conferência no Pass",
        detalhe: "Verifique a temperatura de saída e limpe as bordas do prato antes de liberar para o garçom.",
        imagem:
          "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
      },
    ],
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
      customizacao: "Registe qualquer modificação de insumo na comanda para baixa fiel no estoque.",
      sabor: "Respeite o tempo de descanso da proteína antes de fatiar ou empratar.",
      substituicoes: "Consulte o líder de cozinha antes de substituir itens de alto custo na ficha.",
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
  const [texto, setTexto] = useState("");
  const [contagemReq, setContagemReq] = useState(0);
  const [carregandoIA, setCarregandoIA] = useState(false);

  // Dados reais do ERP e estado dos fluxos interativos
  const [fichasReais, setFichasReais] = useState([]);
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

  // Lista de blocos conversacionais na tela
  const [itensConversa, setItensConversa] = useState(() => {
    if (modoInicial === "manutencao") {
      return [
        {
          id: "init-manut",
          tipo: "pergunta-usuario",
          texto: "O Forno Combinado não está mantendo o vapor constante. Alguma ideia de como resolver?",
          numReq: 1,
        },
        {
          id: "init-manut-card",
          tipo: "manutencao",
          equipamentoInicialId: null,
        },
      ];
    }
    return [];
  });

  // Carrega fichas técnicas reais do Supabase para enriquecer o RAG
  useEffect(() => {
    if (!isSupabaseReady() || !unidadeAtiva) return;
    supabase
      .from("fichas_tecnicas")
      .select("*, fichas_ingredientes!ficha_id(*, insumos(id, nome, unidade_medida))")
      .eq("unidade_id", unidadeAtiva)
      .limit(12)
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) setFichasReais(data);
      })
      .catch(() => {});
  }, [unidadeAtiva]);

  useEffect(() => {
    fimChatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [itensConversa, carregandoIA, convidadoExtraId, progressoConvite]);

  // Reiniciar conversa (Botão Coral "Restart" na barra inferior)
  const reiniciarConversa = () => {
    calarVoz();
    setItensConversa([]);
    setContagemReq(0);
    setTexto("");
    setConvidadoExtraId(null);
    setProgressoConvite(0);
  };

  // Dispara convite ao vivo para um colaborador/extra (Telas 16 -> 17 -> 18 -> 19)
  const dispararConviteExtra = (extra) => {
    setConvidadoExtraId(extra.id);
    setProgressoConvite(40); // Tela 17: Notification Opened 40%

    setTimeout(() => {
      setProgressoConvite(100); // Tela 18: Confirmed - Arriving in 6 mins 100%
      setExtraConfirmado(extra);

      // Adiciona automaticamente o Play Caller atualizado com o colaborador posicionado (Tela 19)
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

  // Interpreta a pergunta/tópico e monta os cards fiéis às 20 telas
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

    // 1. Se clicou em uma ficha real do ERP
    if (metaTopico?.fichaReal) {
      const recConvertida = converterFichaRealParaGreenDot(metaTopico.fichaReal);
      const idBloco = `rec-${Date.now()}`;
      setVideosAbertos((v) => ({ ...v, [idBloco]: true }));
      setItensConversa((prev) => [
        ...prev,
        { id: idBloco, tipo: "receita-completa", receita: recConvertida },
      ]);
      return;
    }

    // 2. Verifica se é uma das receitas (Risoto, Moscow Mule, Parmegiana ou ficha real pelo nome)
    const receitaDemo = RECEITAS_GREEN_DOT.find(
      (r) =>
        metaTopico?.id === r.id ||
        q.includes(r.nome.toLowerCase().replace("*", "")) ||
        (q.includes("risoto") && r.id === "risoto-camarao") ||
        ((q.includes("moscow") || q.includes("mule") || q.includes("drink")) &&
          r.id === "moscow-mule") ||
        ((q.includes("parmegiana") || q.includes("filé") || q.includes("file")) &&
          r.id === "file-parmegiana")
    );

    if (receitaDemo) {
      const idBloco = `rec-${Date.now()}`;
      setVideosAbertos((v) => ({ ...v, [idBloco]: true }));
      setItensConversa((prev) => [
        ...prev,
        { id: idBloco, tipo: "receita-completa", receita: receitaDemo },
      ]);
      if (vozAtiva && audioDisponivel()) {
        falar(`Aqui está a ficha técnica e passo a passo para ${receitaDemo.nome}.`);
      }
      return;
    }

    // Verifica fichas reais pelo nome digitado
    const fichaRealMatch = fichasReais.find(
      (f) => f?.nome && q.includes(String(f.nome).toLowerCase())
    );
    if (fichaRealMatch) {
      const recConvertida = converterFichaRealParaGreenDot(fichaRealMatch);
      const idBloco = `rec-${Date.now()}`;
      setVideosAbertos((v) => ({ ...v, [idBloco]: true }));
      setItensConversa((prev) => [
        ...prev,
        { id: idBloco, tipo: "receita-completa", receita: recConvertida },
      ]);
      return;
    }

    // 3. Verifica se é Rotina Operacional (Pull-to-Thaw, Câmara Fria/PVPS, Rotina de Forno)
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

    // 4. Verifica se é Manutenção de Equipamentos / Falhas / Chamado (Telas 7 a 13)
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

    // 5. Verifica se é Escala Gantt / Pico / Chamar Colaborador Extra (Telas 14, 15, 16, 17, 18)
    if (
      metaTopico?.id === "escala-turno" ||
      q.includes("escala") ||
      q.includes("gantt") ||
      q.includes("horário")
    ) {
      setItensConversa((prev) => [
        ...prev,
        { id: `esc-${Date.now()}`, tipo: "escala-gantt" },
      ]);
      return;
    }

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

    // 6. Verifica se é Play Caller / Mapa de Praças (Telas 1 & 19)
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

    // 7. Consulta conversacional aberta na rota de IA (/api/ia-green-dot)
    setCarregandoIA(true);
    try {
      const res = await fetch("/api/ia-green-dot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta,
          contextoLoja: {
            unidade: unidadeInfo?.nome || "Restaurante Matriz",
            fichas: fichasReais.map((f) => ({ id: f.id, nome: f.nome })),
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
        "Consultei os manuais da unidade. Você pode usar os botões abaixo para abrir fichas técnicas, manutenção ou escala.";
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
          texto: "Aqui está o acesso rápido aos manuais da cozinha, bar e manutenção da loja.",
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

  // Atalhos rápidos na barra superior do iPad para testar todas as 20 telas em 1 clique
  const abrirFluxoDireto = (fluxo) => {
    if (fluxo === "receita") {
      processarPergunta("Quero aprender a fazer o Risoto de Camarão Trufado perfeito.", {
        id: "risoto-camarao",
      });
    } else if (fluxo === "manutencao") {
      processarPergunta(
        "O Forno Combinado não está mantendo o vapor constante. Alguma ideia de como resolver?",
        { id: "forno-vapor" }
      );
    } else if (fluxo === "escala") {
      setItensConversa((prev) => [
        ...prev,
        { id: `esc-${Date.now()}`, tipo: "escala-gantt" },
      ]);
    } else if (fluxo === "playcaller") {
      setItensConversa((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          tipo: "pergunta-usuario",
          texto: "Sugiro escalar o Bruno S. se ele estiver livre.",
          numReq: Math.min(5, contagemReq + 1),
        },
        { id: `play-${Date.now()}`, tipo: "play-caller" },
      ]);
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
        {/* BARRA DE TOPO DO TABLET (Ícone Engrenagem à esquerda + Seletor Rápido + Ícone ? à direita) */}
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
                    Restaurante · iPad Loja
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Pílulas de demonstração rápida dos 4 fluxos das imagens */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#EAE8E1] p-1 rounded-xl border border-[#DAD8CE]">
            <button
              onClick={() => abrirFluxoDireto("receita")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <UtensilsCrossed size={12} /> Ficha &amp; Upsell
            </button>
            <button
              onClick={() => abrirFluxoDireto("manutencao")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <Wrench size={12} /> Equipamentos
            </button>
            <button
              onClick={() => abrirFluxoDireto("escala")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <CalendarClock size={12} /> Escala Gantt
            </button>
            <button
              onClick={() => abrirFluxoDireto("playcaller")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#1E4D3B] hover:bg-white transition flex items-center gap-1"
            >
              <MapPin size={12} /> Mapa de Praças
            </button>
          </div>

          <div className="flex items-center gap-2">
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
              Unidade Conectada:{" "}
              <span className="font-black underline">
                {unidadeInfo?.nome || "Unidade Matriz"}
              </span>{" "}
              · Fichas sincronizadas: <strong>{fichasReais.length + RECEITAS_GREEN_DOT.length}</strong> · Itens de estoque:{" "}
              <strong>{estoque.length}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => abrirFluxoDireto("receita")}
                className="px-2.5 py-1 rounded bg-white border border-[#2E6F4E] text-[#1E4D3B] font-bold"
              >
                Testar Receita
              </button>
              <button
                onClick={() => abrirFluxoDireto("manutencao")}
                className="px-2.5 py-1 rounded bg-white border border-[#2E6F4E] text-[#1E4D3B] font-bold"
              >
                Testar Manutenção
              </button>
              <button
                onClick={() => abrirFluxoDireto("escala")}
                className="px-2.5 py-1 rounded bg-white border border-[#2E6F4E] text-[#1E4D3B] font-bold"
              >
                Testar Escala
              </button>
            </div>
          </div>
        )}

        {/* ÁREA DE CONTEÚDO ROLÁVEL DO TABLET */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
          {/* TELA 20: Banner Editorial quando ativo */}
          {mostrarBannerProp && <BrandValueBanner />}

          {/* TELA 2: Card de Boas-Vindas e Pílulas de Acesso Rápido */}
          <WelcomeGovernanceCard
            fichasReais={fichasReais}
            onSelectTopic={(topico) => processarPergunta(topico.prompt, topico)}
          />

          {/* TELA 14: Alerta Proativo de Pico de Demanda */}
          <DemandSpikeAlertCard
            onViewDetails={() => {
              setItensConversa((prev) => [
                ...prev,
                { id: `esc-${Date.now()}`, tipo: "escala-gantt" },
              ]);
            }}
          />

          {/* FLUXO DE MENSAGENS E CARDS INTERATIVOS */}
          {itensConversa.map((bloco) => {
            // Bolha do colaborador (alinhada à direita com avatar de avental e contador "1 of 5 requests")
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

            // Telas 3, 4, 5 e 6: Ficha Técnica Completa + Vídeo Passo a Passo + Dicas + Checklist + Harmonização
            if (bloco.tipo === "receita-completa") {
              return (
                <div key={bloco.id} className="space-y-4">
                  <RecipeDetailCard receita={bloco.receita} />
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

            // Rotinas Operacionais (Pull-to-Thaw / PVPS / Forno)
            if (bloco.tipo === "rotina") {
              return <OperationalRoutineCard key={bloco.id} rotina={bloco.rotina} />;
            }

            // Telas 7 a 13: Central de Manutenção de Equipamentos e Chamados
            if (bloco.tipo === "manutencao") {
              return (
                <EquipmentMaintenanceFlowCard
                  key={bloco.id}
                  equipamentos={EQUIPAMENTOS_MANUTENCAO}
                  equipamentoInicialId={bloco.equipamentoInicialId}
                  chamados={chamados}
                  onNovoChamado={(novo) => setChamados((prev) => [novo, ...prev])}
                  unidadeInfo={unidadeInfo}
                  sessao={sessao}
                />
              );
            }

            // Tela 15: Escala Horária Gantt com Pico
            if (bloco.tipo === "escala-gantt") {
              return (
                <ShiftScheduleGanttCard
                  key={bloco.id}
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

            // Telas 16, 17 e 18: Colaboradores disponíveis + progresso 40% -> 100%
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

            // Telas 1 e 19: Play Caller — Mapa de Posicionamento das Praças
            if (bloco.tipo === "play-caller") {
              return (
                <PlayCallerStationMapCard
                  key={bloco.id}
                  formacao={FORMACAO_PRACAS_BASE}
                  extraConfirmado={extraConfirmado}
                />
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
                Consultando manuais e fichas técnicas da unidade...
              </div>
            </div>
          )}

          <div ref={fimChatRef} />
        </div>

        {/* BARRA INFERIOR FIXA IDÊNTICA ÀS TELAS DO IPAD (Restart Coral | Input 0/256 | Send Verde) */}
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
                        : "Digite uma pergunta ou tópico (ex: Risoto, Forno, Escala, Praças)..."
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
                  <span>Digite uma pergunta ou selecione um tópico acima</span>
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
    </div>
  );
}
