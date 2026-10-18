"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ShoppingBag,
  ChevronRight,
  Flame,
  Plus,
  Minus,
  Search,
  Star,
  Clock,
  Users,
  Sparkles,
  Info,
  X,
  ChevronLeft,
  Check,
  Wine,
  UtensilsCrossed,
  Tag,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Send,
  SlidersHorizontal,
  CheckCircle2,
  Trash2,
  Settings
} from "lucide-react";
import {
  fetchCardapioDigital,
  fetchCardapioConfig,
  salvarCardapioConfig,
  BANNERS_CARROSSEL,
  SUGESTOES_DO_DIA,
  gerarBoasVindasInteligentes,
  finalizarPedidoDelivery
} from "../../lib/delivery";

export default function LojaDeliveryPage() {
  const urlParams = useParams();
  const lojaSlug = urlParams?.loja || "seldeestrela";
  const router = useRouter();

  // Configurações Visuais e da Loja
  const [configLoja, setConfigLoja] = useState(null);

  // Estados principais
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carrinho, setCarrinho] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");
  const [humorAtivo, setHumorAtivo] = useState("todos");
  const [termoBusca, setTermoBusca] = useState("");

  // Modal de Boas-Vindas & Preferências de Entrada
  const [modalEntrada, setModalEntrada] = useState(true);
  const [etapaAssistente, setEtapaAssistente] = useState("escolha_modo"); // "escolha_modo" | "perguntas"
  const [alergiasSelecionadas, setAlergiasSelecionadas] = useState([]);
  const [apetiteSelecionado, setApetiteSelecionado] = useState(null);
  const [assistenteAtivo, setAssistenteAtivo] = useState(false);

  // Carrossel
  const [bannerAtual, setBannerAtual] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Modal de Customização iFood
  const [pratoModal, setPratoModal] = useState(null);
  const [modalAlergicosDetalhado, setModalAlergicosDetalhado] = useState(null);
  const [pontoEscolhido, setPontoEscolhido] = useState("");
  const [acompanhamentosEscolhidos, setAcompanhamentosEscolhidos] = useState([]);
  const [adicionaisEscolhidos, setAdicionaisEscolhidos] = useState([]);
  const [remocoesEscolhidas, setRemocoesEscolhidas] = useState([]);
  const [observacaoCliente, setObservacaoCliente] = useState("");
  const [qtdModal, setQtdModal] = useState(1);

  // Modal de Envio Rápido para a Cozinha
  const [modalConfirmacaoCozinha, setModalConfirmacaoCozinha] = useState(false);
  const [dadosClienteRapido, setDadosClienteRapido] = useState({ nome: "", mesaOuEndereco: "" });
  const [pedidoEnviadoSucesso, setPedidoEnviadoSucesso] = useState(false);
  const [enviandoCozinha, setEnviandoCozinha] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState(null);

  // Boas-vindas inteligentes
  const infoBoasVindas = useMemo(() => {
    return gerarBoasVindasInteligentes(configLoja?.nome_restaurante || lojaSlug.replace("-", " "));
  }, [lojaSlug, configLoja]);

  useEffect(() => {
    const config = fetchCardapioConfig(lojaSlug);
    setConfigLoja(config);
    carregarMenu();

    try {
      const sacolaSalva = localStorage.getItem("carrinho");
      if (sacolaSalva) {
        setCarrinho(JSON.parse(sacolaSalva));
      }
      // Se o cliente já dispensou a pergunta de entrada nesta sessão, não abre de novo
      const jaRespondeu = sessionStorage.getItem(`hefisto_assistente_respondido_${lojaSlug}`);
      if (jaRespondeu) {
        setModalEntrada(false);
      }
    } catch (e) {}
  }, [lojaSlug]);

  const carregarMenu = async () => {
    setLoading(true);
    const { data, config } = await fetchCardapioDigital(lojaSlug);
    setCatalogo(data || []);
    if (config) setConfigLoja(config);
    setLoading(false);
  };

  // Autoplay do carrossel
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setBannerAtual((prev) => (prev + 1) % BANNERS_CARROSSEL.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const mostrarToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const salvarCarrinho = (novoCarrinho) => {
    setCarrinho(novoCarrinho);
    try {
      localStorage.setItem("carrinho", JSON.stringify(novoCarrinho));
    } catch (e) {}
  };

  // Finalizar o Assistente de Entrada Personalizado
  const aplicarAssistentePersonalizado = () => {
    setAssistenteAtivo(true);
    setModalEntrada(false);
    try {
      sessionStorage.setItem(`hefisto_assistente_respondido_${lojaSlug}`, "true");
    } catch (e) {}
    mostrarToast("✨ Cardápio personalizado de acordo com suas preferências e restrições!");
  };

  const pularAssistente = () => {
    setAssistenteAtivo(false);
    setAlergiasSelecionadas([]);
    setApetiteSelecionado(null);
    setModalEntrada(false);
    try {
      sessionStorage.setItem(`hefisto_assistente_respondido_${lojaSlug}`, "true");
    } catch (e) {}
  };

  const toggleAlergia = (alergiaId) => {
    if (alergiasSelecionadas.includes(alergiaId)) {
      setAlergiasSelecionadas(alergiasSelecionadas.filter((a) => a !== alergiaId));
    } else {
      setAlergiasSelecionadas([...alergiasSelecionadas, alergiaId]);
    }
  };

  // Abrir modal de customização iFood
  const abrirModalCustomizacao = (prato) => {
    setPratoModal(prato);
    setPontoEscolhido(prato.opcoes_customizacao?.ponto_carne?.[0] || "");
    setAcompanhamentosEscolhidos([]);
    setAdicionaisEscolhidos([]);
    setRemocoesEscolhidas([]);
    setObservacaoCliente("");
    setQtdModal(1);
  };

  // Cálculo dinâmico de preço no modal
  const precoTotalUnitarioModal = useMemo(() => {
    if (!pratoModal) return 0;
    const precoBase = Number(pratoModal.preco) || 0;
    const somaAdicionais = adicionaisEscolhidos.reduce((acc, a) => acc + (Number(a.preco) || 0), 0);
    return precoBase + somaAdicionais;
  }, [pratoModal, adicionaisEscolhidos]);

  const valorTotalItemModal = precoTotalUnitarioModal * qtdModal;

  const toggleAcompanhamento = (acomp, max = 2) => {
    if (acompanhamentosEscolhidos.includes(acomp)) {
      setAcompanhamentosEscolhidos(acompanhamentosEscolhidos.filter((i) => i !== acomp));
    } else {
      if (acompanhamentosEscolhidos.length < max) {
        setAcompanhamentosEscolhidos([...acompanhamentosEscolhidos, acomp]);
      } else {
        mostrarToast(`Você pode escolher no máximo ${max} acompanhamentos inclusos.`);
      }
    }
  };

  const toggleAdicional = (adicional) => {
    const existe = adicionaisEscolhidos.some((a) => a.id === adicional.id);
    if (existe) {
      setAdicionaisEscolhidos(adicionaisEscolhidos.filter((a) => a.id !== adicional.id));
    } else {
      setAdicionaisEscolhidos([...adicionaisEscolhidos, adicional]);
    }
  };

  const toggleRemocao = (rem) => {
    if (remocoesEscolhidas.includes(rem)) {
      setRemocoesEscolhidas(remocoesEscolhidas.filter((r) => r !== rem));
    } else {
      setRemocoesEscolhidas([...remocoesEscolhidas, rem]);
    }
  };

  const confirmarAdicaoModal = () => {
    if (!pratoModal) return;

    const itemCarrinho = {
      id: `${pratoModal.id}-${Date.now()}`,
      produto_id: pratoModal.id,
      nome: pratoModal.nome,
      preco: pratoModal.preco,
      precoTotalUnitario: precoTotalUnitarioModal,
      qtd: qtdModal,
      imagem_url: pratoModal.imagem_url,
      customizacao: {
        ponto: pontoEscolhido || null,
        acompanhamentos: acompanhamentosEscolhidos,
        adicionais: adicionaisEscolhidos,
        remocoes: remocoesEscolhidas,
        obs: observacaoCliente.trim() || null,
      },
    };

    salvarCarrinho([...carrinho, itemCarrinho]);
    setPratoModal(null);
    mostrarToast(`✓ ${qtdModal}x ${pratoModal.nome} adicionado à sacola!`);
  };

  // Adicionar Combo do Dia com 1 clique
  const pedirComboDoDia = (combo) => {
    const itemCombo = {
      id: `${combo.id}-${Date.now()}`,
      produto_id: combo.id,
      nome: `${combo.titulo} (${combo.pratoPrincipal.nome} + ${combo.bebida.nome})`,
      preco: combo.precoCombo,
      precoTotalUnitario: combo.precoCombo,
      qtd: 1,
      imagem_url: combo.pratoPrincipal.imagem,
      customizacao: {
        ponto: "Ao Ponto (Sugestão do Chef)",
        acompanhamentos: ["Harmonização completa do Chef"],
        adicionais: [],
        remocoes: [],
        obs: `Combo Especial Harmonizado: ${combo.motivoHarmonizacao.slice(0, 100)}...`,
      },
    };

    salvarCarrinho([...carrinho, itemCombo]);
    mostrarToast(`✓ Combo do Chef adicionado com economia de R$ ${combo.economia.toFixed(2)}!`);
  };

  // Enviar Pedido Direto para a Cozinha KDS
  const dispararPedidoParaCozinha = async () => {
    if (!dadosClienteRapido.nome) {
      alert("Por favor, digite seu nome ou número da mesa.");
      return;
    }
    setEnviandoCozinha(true);

    const pedido = {
      nome: dadosClienteRapido.nome,
      endereco: dadosClienteRapido.mesaOuEndereco || "Mesa do Salão",
      formaPagamento: "Balcão / Mesa",
      total: totalCarrinho,
      taxaEntrega: 0,
    };

    const res = await finalizarPedidoDelivery(pedido, carrinho, lojaSlug);
    setEnviandoCozinha(false);

    if (res.ok) {
      setCarrinho([]);
      try {
        localStorage.removeItem("carrinho");
      } catch (e) {}
      setModalConfirmacaoCozinha(false);
      setPedidoEnviadoSucesso(true);
    } else {
      alert("Erro ao enviar pedido para a cozinha: " + res.error);
    }
  };

  // Categorias únicas
  const categoriasRaw = useMemo(() => {
    const lista = Array.from(new Set(catalogo.map((p) => p.categoria || "Geral")));
    return ["Todas", ...lista];
  }, [catalogo]);

  // Filtragem combinada inteligente com suporte a Alergias e Paladar
  const itensFiltrados = useMemo(() => {
    let res = [...catalogo];

    // 1. Filtros de Alergias e Restrições Selecionadas no Assistente
    if (alergiasSelecionadas.length > 0) {
      if (alergiasSelecionadas.includes("sem_camarao")) {
        res = res.filter((p) => !p.camarao);
      }
      if (alergiasSelecionadas.includes("sem_gluten")) {
        res = res.filter((p) => p.gluten === false);
      }
      if (alergiasSelecionadas.includes("sem_lactose")) {
        res = res.filter((p) => p.lactose === false);
      }
      if (alergiasSelecionadas.includes("sem_pimenta")) {
        res = res.filter((p) => p.nivelPimenta === 0 || (p.pimenta && p.pimenta.toLowerCase().includes("sem pimenta")));
      }
      if (alergiasSelecionadas.includes("vegetariano")) {
        res = res.filter((p) => p.tags && p.tags.some(t => t.toLowerCase().includes("vegetariano") || t.toLowerCase().includes("vegano")));
      }
    }

    // 2. Filtro do Paladar do Assistente
    if (apetiteSelecionado) {
      if (apetiteSelecionado === "brasa") {
        res = res.filter((p) => p.categoria?.toLowerCase().includes("brasa") || p.nome?.toLowerCase().includes("angus") || p.nome?.toLowerCase().includes("picanha"));
      } else if (apetiteSelecionado === "peixes") {
        res = res.filter((p) => p.categoria?.toLowerCase().includes("peixe"));
      } else if (apetiteSelecionado === "rapida") {
        res = res.filter((p) => p.tempo_preparo && (p.tempo_preparo.includes("5") || p.tempo_preparo.includes("10") || p.tempo_preparo.includes("15")));
      } else if (apetiteSelecionado === "leves") {
        res = res.filter((p) => (p.tags && p.tags.some(t => t.toLowerCase().includes("leve"))) || p.gluten === false);
      } else if (apetiteSelecionado === "compartilhar") {
        res = res.filter((p) => p.porcao && (p.porcao.includes("2") || p.porcao.includes("compartilhar")));
      }
    }

    // 3. Filtro por Humor / Chips de Topo
    if (humorAtivo === "rapida") {
      res = res.filter((p) => p.tempo_preparo && (p.tempo_preparo.includes("5") || p.tempo_preparo.includes("10") || p.tempo_preparo.includes("15")));
    } else if (humorAtivo === "brasa") {
      res = res.filter((p) => p.categoria?.toLowerCase().includes("brasa"));
    } else if (humorAtivo === "harmonizados") {
      res = res.filter((p) => p.destaque);
    } else if (humorAtivo === "leves") {
      res = res.filter((p) => p.categoria?.toLowerCase().includes("peixe") || p.tags?.some(t => t.toLowerCase().includes("leve")));
    } else if (humorAtivo === "compartilhar") {
      res = res.filter((p) => p.porcao?.includes("2"));
    }

    // 4. Filtro por Categoria
    if (categoriaAtiva !== "Todas") {
      res = res.filter((p) => p.categoria === categoriaAtiva);
    }

    // 5. Filtro por Busca Instantânea
    if (termoBusca.trim()) {
      const q = termoBusca.toLowerCase().trim();
      res = res.filter(
        (p) =>
          p.nome?.toLowerCase().includes(q) ||
          (p.descricao && p.descricao.toLowerCase().includes(q)) ||
          (p.categoria && p.categoria.toLowerCase().includes(q)) ||
          (p.alergenicos && p.alergenicos.toLowerCase().includes(q))
      );
    }

    return res;
  }, [catalogo, categoriaAtiva, humorAtivo, termoBusca, alergiasSelecionadas, apetiteSelecionado]);

  // Totais do carrinho
  const totalCarrinho = useMemo(() => {
    return carrinho.reduce((acc, c) => acc + ((c.precoTotalUnitario || c.preco) * c.qtd), 0);
  }, [carrinho]);

  const qtdCarrinho = useMemo(() => {
    return carrinho.reduce((acc, c) => acc + c.qtd, 0);
  }, [carrinho]);

  // Cor de fundo configurável pelo dono
  const corFundo = configLoja?.cor_fundo || "#0b0f17";
  const comboPrincipal = SUGESTOES_DO_DIA[0];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center animate-pulse">
          <Flame size={36} className="animate-bounce" />
        </div>
        <p className="font-black text-sm tracking-widest uppercase text-amber-400">Carregando Cardápio Digital...</p>
      </div>
    );
  }

  // TELA DE SUCESSO: PEDIDO NA COZINHA!
  if (pedidoEnviadoSucesso) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 animate-bounce border-2 border-emerald-500/40">
          <CheckCircle2 size={56} />
        </div>
        <span className="text-3xs font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full mb-3 border border-emerald-500/30">
          Comanda Enviada com Sucesso
        </span>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tighter">
          Pedido Enviado Direto para a Cozinha! 🔥
        </h1>
        <p className="text-slate-300 font-medium mb-8 max-w-md text-sm leading-relaxed">
          O Chef e a equipe da cozinha já receberam o seu ticket com todas as customizações e pontos escolhidos. Seu prato está sendo preparado com todo o carinho!
        </p>
        <button
          onClick={() => setPedidoEnviadoSucesso(false)}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl active:scale-95 transition-all shadow-xl shadow-emerald-950/40"
        >
          Voltar ao Cardápio / Fazer Novo Pedido
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100 pb-44 font-sans transition-colors duration-500"
      style={{ backgroundColor: corFundo }}
    >
      
      {/* TOAST FLUTUANTE */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full text-xs font-black shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <Sparkles size={16} className="text-amber-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* MODAL DE BOAS-VINDAS: PERGUNTA INICIAL AO CLIENTE */}
      {modalEntrada && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 text-white w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-6">
            
            {etapaAssistente === "escolha_modo" ? (
              <>
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center text-3xl border border-amber-500/30">
                    {infoBoasVindas.icone}
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    {infoBoasVindas.saudacao}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-sm mx-auto">
                    Bem-vindo ao <strong>{configLoja?.nome_restaurante || "nosso restaurante"}</strong>. Como você prefere explorar nosso cardápio hoje?
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => setEtapaAssistente("perguntas")}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-left flex items-center justify-between shadow-lg shadow-amber-950/30 active:scale-98 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950/20 flex items-center justify-center text-xl shrink-0">
                        🎯
                      </div>
                      <div>
                        <p className="text-sm font-black">Menu Inteligente & Alergias</p>
                        <p className="text-3xs font-bold text-amber-950/80">
                          Informe suas restrições e o que está a fim de comer
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-950/70 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={pularAssistente}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white font-black text-left flex items-center justify-between border border-slate-700 active:scale-98 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl shrink-0">
                        📜
                      </div>
                      <div>
                        <p className="text-sm font-black">Ver Cardápio Completo</p>
                        <p className="text-3xs font-bold text-slate-400">
                          Explorar todos os pratos, cortes e drinks sem filtro
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-black text-base flex items-center gap-2 text-amber-400">
                    <SlidersHorizontal size={18} /> Personalização do Seu Cardápio
                  </h3>
                  <button
                    onClick={() => setEtapaAssistente("escolha_modo")}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Voltar
                  </button>
                </div>

                <div className="space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                  {/* Pergunta 1: Alergias & Restrições */}
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                      1. Possui alguma alergia ou restrição alimentar?
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { id: "sem_camarao", label: "Alérgico a Camarão 🦐" },
                        { id: "sem_gluten", label: "Sem Glúten (Celíaco) 🌾" },
                        { id: "sem_lactose", label: "Sem Lactose 🥛" },
                        { id: "sem_pimenta", label: "Não tolero Pimenta 🌶️" },
                        { id: "vegetariano", label: "Sou Vegetariano 🌱" },
                      ].map((item) => {
                        const sel = alergiasSelecionadas.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleAlergia(item.id)}
                            className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                              sel
                                ? "bg-red-500/20 border-red-500 text-red-200"
                                : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            {sel ? `✓ ${item.label}` : item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pergunta 2: Apetite / O que quer comer */}
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                      2. O que você está a fim de comer hoje?
                    </label>
                    <div className="space-y-1.5 text-xs">
                      {[
                        { id: "brasa", label: "🥩 Cortes Nobres na Brasa & Carnes Suculentas" },
                        { id: "peixes", label: "🐟 Peixes Frescos & Gastronomia Amazônica" },
                        { id: "rapida", label: "⚡ Prato Rápido & Ágil (< 20 minutos)" },
                        { id: "leves", label: "🥗 Prato Leve, Saudável & Refrescante" },
                        { id: "compartilhar", label: "👨‍👩‍👧‍👦 Pratos Fartos para Compartilhar (2+ pessoas)" },
                      ].map((item) => {
                        const sel = apetiteSelecionado === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setApetiteSelecionado(sel ? null : item.id)}
                            className={`w-full p-2.5 rounded-xl border text-left font-bold transition-all ${
                              sel
                                ? "bg-amber-500/20 border-amber-500 text-amber-300"
                                : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            {sel ? `✓ ${item.label}` : item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={pularAssistente}
                    className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Ver sem filtro
                  </button>
                  <button
                    onClick={aplicarAssistentePersonalizado}
                    className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
                  >
                    Aplicar e Ver Pratos
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* HEADER TOP DA LOJA (SEM "COZINHA ABERTA", COM HORÁRIOS E AVISOS EDITÁVEIS) */}
      <div className="bg-slate-950/70 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black capitalize tracking-tight flex items-center gap-2">
                {configLoja?.nome_restaurante || lojaSlug.replace("-", " ")}
              </h1>
              
              {/* Horários de Funcionamento configuráveis */}
              <p className="text-xs text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-400 shrink-0" />
                <span>{configLoja?.horarios_funcionamento || "11h30 às 15h30 • 18h30 às 23h30"}</span>
              </p>
            </div>

            {/* Badges de Avaliação & Botão Reabrir Assistente */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
                <Star size={14} className="fill-amber-400 text-amber-400" /> 4.9 (420+ avaliações)
              </span>
              <button
                onClick={() => { setEtapaAssistente("perguntas"); setModalEntrada(true); }}
                className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-xl hover:bg-amber-500/25 transition-all text-xs font-black"
              >
                <SlidersHorizontal size={13} />
                <span>Alergias & Paladar</span>
              </button>
            </div>
          </div>

          {/* Banner de Assistente Ativo (se filtrou) */}
          {assistenteAtivo && (
            <div className="mt-4 bg-amber-950/30 border border-amber-600/40 p-3 rounded-2xl flex items-center justify-between gap-2 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400 shrink-0" />
                <span>
                  <strong>Filtro ativo:</strong>{" "}
                  {alergiasSelecionadas.length > 0 && `Protegendo alergias (${alergiasSelecionadas.join(", ")}) • `}
                  {apetiteSelecionado ? `Foco em ${apetiteSelecionado}` : "Pratos selecionados"}
                </span>
              </div>
              <button
                onClick={pularAssistente}
                className="text-3xs font-black underline hover:text-white"
              >
                Limpar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* CARROSSEL DINÂMICO: PROMOÇÃO DO DIA & EVENTOS DA SEMANA PASSANDO */}
        <div 
          className="mt-6 relative rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80 bg-slate-950 group"
          onMouseEnter={() => setAutoPlay(false)}
          onMouseLeave={() => setAutoPlay(true)}
        >
          <div className="relative h-48 sm:h-64 w-full overflow-hidden">
            {BANNERS_CARROSSEL.map((banner, idx) => (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  idx === bannerAtual ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <img
                  src={banner.imagem}
                  alt={banner.titulo}
                  className="w-full h-full object-cover transform scale-105 group-hover:scale-100 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
                
                {/* Textos do Slide */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white z-20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-block ${banner.corBadge} text-white text-3xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow`}>
                      {banner.tag}
                    </span>
                    {banner.dataEvento && (
                      <span className="text-3xs font-black bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/20 text-slate-200">
                        {banner.dataEvento}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight drop-shadow-md text-white">
                    {banner.titulo}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-200 font-medium max-w-xl line-clamp-2 mt-1 drop-shadow">
                    {banner.subtitulo}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setBannerAtual((prev) => (prev - 1 + BANNERS_CARROSSEL.length) % BANNERS_CARROSSEL.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setBannerAtual((prev) => (prev + 1) % BANNERS_CARROSSEL.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots Indicadores */}
          <div className="absolute bottom-3 right-4 z-30 flex items-center gap-1.5">
            {BANNERS_CARROSSEL.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerAtual(i)}
                className={`h-2 rounded-full transition-all ${
                  i === bannerAtual ? "w-6 bg-amber-400" : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* SUGESTÃO DO DIA INTELIGENTE (PRATO + BEBIDA) */}
        {comboPrincipal && (
          <div className="mt-6 bg-gradient-to-br from-amber-950/40 via-slate-900 to-amber-950/20 rounded-3xl p-5 border border-amber-500/40 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-slate-950 text-3xs font-black uppercase px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1 shadow-sm">
                  <Sparkles size={12} /> {comboPrincipal.badge}
                </span>
                <span className="text-xs font-bold text-amber-200">Harmonização Inteligente do Chef</span>
              </div>
              <div className="text-3xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                Economia de R$ {comboPrincipal.economia.toFixed(2).replace(".", ",")}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-4 items-center">
              <div className="md:col-span-5 flex items-center gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
                <img
                  src={comboPrincipal.pratoPrincipal.imagem}
                  alt={comboPrincipal.pratoPrincipal.nome}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 shadow-inner"
                />
                <div className="min-w-0">
                  <span className="text-3xs font-black uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Prato Principal</span>
                  <h4 className="font-black text-white text-xs sm:text-sm line-clamp-2 mt-0.5">
                    {comboPrincipal.pratoPrincipal.nome}
                  </h4>
                  <p className="text-3xs font-bold text-slate-400 mt-1">
                    {comboPrincipal.pratoPrincipal.porcao}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                  +
                </div>
              </div>

              <div className="md:col-span-5 flex items-center gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
                <img
                  src={comboPrincipal.bebida.imagem}
                  alt={comboPrincipal.bebida.nome}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 shadow-inner"
                />
                <div className="min-w-0">
                  <span className="text-3xs font-black uppercase text-teal-400 bg-teal-400/10 px-1.5 py-0.5 rounded">Bebida Especial</span>
                  <h4 className="font-black text-white text-xs sm:text-sm line-clamp-2 mt-0.5">
                    {comboPrincipal.bebida.nome}
                  </h4>
                  <p className="text-3xs font-bold text-slate-400 mt-1">
                    Volume: {comboPrincipal.bebida.volume}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-black/30 p-3 rounded-xl border border-amber-500/20 mb-4 text-xs font-medium text-amber-200/90 flex items-start gap-2">
              <Wine size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-bold text-amber-300">Por que harmoniza:</span> {comboPrincipal.motivoHarmonizacao}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-500 line-through font-bold">
                  R$ {comboPrincipal.precoTotalOriginal.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">
                  R$ {comboPrincipal.precoCombo.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-3xs font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  15% OFF
                </span>
              </div>

              <button
                onClick={() => pedirComboDoDia(comboPrincipal)}
                className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-950/30 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles size={16} />
                Pedir Combo do Chef (1 Clique)
              </button>
            </div>
          </div>
        )}

        {/* BUSCA EM TEMPO REAL */}
        <div className="mt-6 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar prato, picanha, peixe, sem glúten, drink..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full pl-11 pr-10 py-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm font-medium outline-none focus:border-amber-500 text-white placeholder-slate-500 shadow-sm transition-all"
          />
          {termoBusca && (
            <button
              onClick={() => setTermoBusca("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

      </div>

      {/* BARRA STICKY DE NAVEGAÇÃO DE CATEGORIAS */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-y border-slate-800/80 py-3 mt-6 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {categoriasRaw.map((cat) => {
              const qtd = cat === "Todas" ? catalogo.length : catalogo.filter((p) => p.categoria === cat).length;
              const ativa = categoriaAtiva === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaAtiva(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    ativa
                      ? "bg-amber-500 text-slate-950 shadow-lg scale-105"
                      : "bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-3xs px-1.5 py-0.2 rounded-full font-bold ${ativa ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                    {qtd}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* VITRINE PRINCIPAL DE PRATOS COM INFORMAÇÕES DE ALERGIA, TEMPO E PIMENTA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            {categoriaAtiva === "Todas" ? "Cardápio Principal" : categoriaAtiva}
            <span className="text-xs font-bold text-slate-400">({itensFiltrados.length} pratos)</span>
          </h2>
        </div>

        {itensFiltrados.length === 0 ? (
          <div className="bg-slate-900/60 rounded-3xl p-12 text-center border border-slate-800 shadow-sm">
            <UtensilsCrossed size={40} className="mx-auto text-slate-600 mb-3" />
            <h3 className="font-black text-white text-base">Nenhum prato encontrado com esses filtros</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Tente redefinir as restrições alimentares ou buscar por outro termo.
            </p>
            <button
              onClick={() => { setCategoriaAtiva("Todas"); setHumorAtivo("todos"); setTermoBusca(""); setAlergiasSelecionadas([]); setApetiteSelecionado(null); }}
              className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black"
            >
              Ver todo o cardápio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {itensFiltrados.map((prato) => {
              const temDesconto = prato.preco_antigo && prato.preco_antigo > prato.preco;
              return (
                <div
                  key={prato.id}
                  onClick={() => abrirModalCustomizacao(prato)}
                  className="bg-slate-900/80 rounded-3xl p-4 border border-slate-800 hover:border-slate-700 shadow-md hover:shadow-xl transition-all cursor-pointer flex gap-3.5 group relative overflow-hidden"
                >
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      {/* Tags Superiores */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {prato.tags?.slice(0, 2).map((t, idx) => (
                          <span
                            key={idx}
                            className="text-3xs font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      <h3 className="font-black text-white text-[15px] leading-snug group-hover:text-amber-400 transition-colors">
                        {prato.nome}
                      </h3>

                      <p className="text-xs text-slate-400 font-medium line-clamp-2 mt-1 leading-relaxed">
                        {prato.descricao}
                      </p>

                      {/* INFORMAÇÕES DIDÁTICAS DE SAÚDE, PIMENTA E ALERGIA AO LADO DO PRATO */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5 text-3xs font-bold">
                        {/* Tempo de Preparo */}
                        {prato.tempo_preparo && (
                          <span className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                            <Clock size={11} className="text-amber-400" /> {prato.tempo_preparo}
                          </span>
                        )}

                        {/* Nível de Pimenta */}
                        {prato.nivelPimenta > 0 ? (
                          <span className="flex items-center gap-1 bg-red-950/40 text-red-300 border border-red-800/40 px-2 py-0.5 rounded-md">
                            🌶️ {prato.pimenta || "Apimentado"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-md">
                            Sem pimenta
                          </span>
                        )}

                        {/* Camarão / Frutos do Mar */}
                        {prato.camarao && (
                          <span className="flex items-center gap-1 bg-amber-950/60 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-md font-black animate-pulse">
                            🦐 Contém Camarão
                          </span>
                        )}

                        {/* Glúten */}
                        {prato.gluten === false && (
                          <span className="flex items-center gap-1 bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                            Sem Glúten ✓
                          </span>
                        )}

                        {/* Lactose */}
                        {prato.lactose === false && (
                          <span className="flex items-center gap-1 bg-teal-950/40 text-teal-300 border border-teal-800/40 px-2 py-0.5 rounded-md">
                            Sem Lactose ✓
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preço e Botão Didático */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        {temDesconto && (
                          <span className="text-xs text-slate-500 line-through font-bold">
                            R$ {prato.preco_antigo.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                        <span className="text-base font-black text-amber-400">
                          R$ {prato.preco.toFixed(2).replace(".", ",")}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalAlergicosDetalhado(prato);
                        }}
                        className="text-3xs font-black text-slate-400 hover:text-amber-300 underline flex items-center gap-1"
                      >
                        <ShieldAlert size={12} /> Ficha Alérgenos
                      </button>
                    </div>
                  </div>

                  {/* Foto do Prato + Botão de Adicionar */}
                  <div className="relative shrink-0 flex flex-col items-center justify-between">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-inner bg-slate-800 border border-slate-800">
                      <img
                        src={prato.imagem_url}
                        alt={prato.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirModalCustomizacao(prato);
                      }}
                      className="mt-2 w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DETALHADO DE ALERGÊNICOS & SAÚDE (PROTEÇÃO AO CLIENTE) */}
      {modalAlergicosDetalhado && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                <ShieldAlert size={20} /> Informações para Alérgicos & Nutrição
              </div>
              <button
                onClick={() => setModalAlergicosDetalhado(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <h3 className="font-black text-base text-white">{modalAlergicosDetalhado.nome}</h3>
              <p className="text-xs text-slate-400 mt-1">{modalAlergicosDetalhado.descricao}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">🦐 Frutos do Mar / Camarão:</span>
                <span className={modalAlergicosDetalhado.camarao ? "font-black text-amber-400" : "font-bold text-emerald-400"}>
                  {modalAlergicosDetalhado.camarao ? "⚠️ CONTÉM CAMARÃO" : "Livre de Camarão ✓"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">🌾 Glúten (Celíacos):</span>
                <span className={modalAlergicosDetalhado.gluten ? "font-black text-amber-400" : "font-bold text-emerald-400"}>
                  {modalAlergicosDetalhado.gluten ? "Contém Glúten" : "100% Sem Glúten ✓"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">🥛 Lactose (Derivados do Leite):</span>
                <span className={modalAlergicosDetalhado.lactose ? "font-black text-amber-400" : "font-bold text-emerald-400"}>
                  {modalAlergicosDetalhado.lactose ? "Contém Lactose" : "Livre de Lactose ✓"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">🌶️ Nível de Pimenta:</span>
                <span className="font-bold text-slate-200">
                  {modalAlergicosDetalhado.pimenta || "Sem pimenta"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">⏱️ Tempo Estimado:</span>
                <span className="font-bold text-slate-200">
                  {modalAlergicosDetalhado.tempo_preparo || "20 min"}
                </span>
              </div>
            </div>

            {modalAlergicosDetalhado.alergenicos && (
              <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-600/30 text-3xs text-amber-200 leading-relaxed">
                <strong>Alerta da Cozinha:</strong> {modalAlergicosDetalhado.alergenicos}
              </div>
            )}

            <button
              onClick={() => setModalAlergicosDetalhado(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl"
            >
              Fechar Informações
            </button>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER DE CUSTOMIZAÇÃO DO PRATO ESTILO IFOOD */}
      {pratoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white w-full max-w-xl max-h-[92vh] sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-800 animate-in slide-in-from-bottom duration-300">
            
            <div className="relative h-48 sm:h-56 w-full bg-slate-950 shrink-0">
              <img
                src={pratoModal.imagem_url}
                alt={pratoModal.nome}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
              
              <button
                onClick={() => setPratoModal(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md shadow-lg"
              >
                <X size={20} />
              </button>

              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-3xs font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md mb-1 inline-block">
                  {pratoModal.categoria}
                </span>
                <h3 className="text-xl sm:text-2xl font-black leading-tight drop-shadow-md">
                  {pratoModal.nome}
                </h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
              <div>
                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                  {pratoModal.descricao}
                </p>
                
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  {pratoModal.porcao && (
                    <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-xl flex items-center gap-1 border border-slate-700">
                      <Users size={14} className="text-amber-400" /> {pratoModal.porcao}
                    </span>
                  )}
                  {pratoModal.tempo_preparo && (
                    <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-xl flex items-center gap-1 border border-slate-700">
                      <Clock size={14} className="text-amber-400" /> {pratoModal.tempo_preparo}
                    </span>
                  )}
                  {pratoModal.camarao && (
                    <span className="bg-amber-950/60 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-xl flex items-center gap-1 font-black">
                      🦐 Contém Camarão
                    </span>
                  )}
                </div>
              </div>

              {/* Ponto da Carne */}
              {pratoModal.opcoes_customizacao?.ponto_carne && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-black text-sm text-white">Ponto da Carne</h4>
                    <span className="text-3xs font-black uppercase text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded">
                      Escolha 1
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pratoModal.opcoes_customizacao.ponto_carne.map((ponto) => (
                      <label
                        key={ponto}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          pontoEscolhido === ponto
                            ? "border-amber-500 bg-amber-500/10 text-amber-300 font-black shadow-sm"
                            : "border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-medium"
                        }`}
                      >
                        <span className="text-xs">{ponto}</span>
                        <input
                          type="radio"
                          name="ponto_carne"
                          checked={pontoEscolhido === ponto}
                          onChange={() => setPontoEscolhido(ponto)}
                          className="accent-amber-500 w-4 h-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Acompanhamentos Inclusos */}
              {pratoModal.opcoes_customizacao?.acompanhamentos && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="font-black text-sm text-white">Acompanhamentos Inclusos</h4>
                      <p className="text-3xs text-slate-400 font-bold">
                        Escolha até {pratoModal.opcoes_customizacao.max_acompanhamentos || 2} opções
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-200 bg-slate-800 px-2.5 py-1 rounded-full">
                      {acompanhamentosEscolhidos.length} / {pratoModal.opcoes_customizacao.max_acompanhamentos || 2}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pratoModal.opcoes_customizacao.acompanhamentos.map((acomp) => {
                      const selecionado = acompanhamentosEscolhidos.includes(acomp);
                      return (
                        <div
                          key={acomp}
                          onClick={() => toggleAcompanhamento(acomp, pratoModal.opcoes_customizacao.max_acompanhamentos || 2)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            selecionado
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-black"
                              : "border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-medium"
                          }`}
                        >
                          <span className="text-xs">{acomp}</span>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            selecionado ? "bg-emerald-500 border-emerald-500 text-slate-950" : "border-slate-700"
                          }`}>
                            {selecionado && <Check size={14} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Turbine seu Prato (Adicionais) */}
              {pratoModal.opcoes_customizacao?.adicionais && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-black text-sm text-white">Turbine seu Prato</h4>
                    <span className="text-3xs font-black uppercase text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                      Opcionais (+ R$)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pratoModal.opcoes_customizacao.adicionais.map((adic) => {
                      const selecionado = adicionaisEscolhidos.some((a) => a.id === adic.id);
                      return (
                        <div
                          key={adic.id}
                          onClick={() => toggleAdicional(adic)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            selecionado
                              ? "border-purple-500 bg-purple-500/20 text-purple-300 font-black"
                              : "border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-medium"
                          }`}
                        >
                          <div>
                            <p className="text-xs">{adic.nome}</p>
                            <p className="text-3xs font-black text-purple-400">+ R$ {adic.preco.toFixed(2).replace(".", ",")}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            selecionado ? "bg-purple-500 border-purple-500 text-slate-950" : "border-slate-700"
                          }`}>
                            {selecionado && <Check size={14} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Remoções da Cozinha */}
              {pratoModal.opcoes_customizacao?.remocoes && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-black text-sm text-white mb-2">Remoções da Cozinha</h4>
                  <div className="flex flex-wrap gap-2">
                    {pratoModal.opcoes_customizacao.remocoes.map((rem) => {
                      const marcado = remocoesEscolhidas.includes(rem);
                      return (
                        <button
                          key={rem}
                          type="button"
                          onClick={() => toggleRemocao(rem)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            marcado
                              ? "bg-red-600 text-white shadow-sm"
                              : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {marcado ? `✕ ${rem}` : rem}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observação para o Chef */}
              <div>
                <label className="text-xs font-black uppercase text-slate-400 block mb-1">
                  Observações para o Chef (Opcional)
                </label>
                <textarea
                  maxLength={140}
                  placeholder="Ex: Ponto bem tostadinho por fora, molho separado..."
                  value={observacaoCliente}
                  onChange={(e) => setObservacaoCliente(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-medium outline-none focus:border-amber-500 h-20 resize-none text-white"
                />
              </div>

            </div>

            {/* Rodapé fixo do modal com seletor de qtd e totalizador */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setQtdModal((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black active:scale-95"
                >
                  <Minus size={16} />
                </button>
                <span className="font-black text-sm text-white w-5 text-center">
                  {qtdModal}
                </span>
                <button
                  onClick={() => setQtdModal((prev) => prev + 1)}
                  className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black active:scale-95"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                onClick={confirmarAdicaoModal}
                className="flex-1 py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between shadow-lg shadow-amber-950/30 active:scale-98 transition-all"
              >
                <span>Adicionar à Sacola</span>
                <span>R$ {valorTotalItemModal.toFixed(2).replace(".", ",")}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FLOATING ACTION BAR: SACOLA COM OS DOIS BOTÕES SOLICITADOS */}
      {carrinho.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 pb-6 sm:pb-8 bg-gradient-to-t from-black via-black/90 to-transparent z-40 flex justify-center">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 p-3 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-6">
            
            {/* Informações da Sacola */}
            <div
              onClick={() => router.push(`/delivery/${lojaSlug}/carrinho`)}
              className="flex items-center gap-3 w-full sm:w-auto cursor-pointer p-1"
            >
              <div className="w-11 h-11 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center relative font-black shrink-0">
                <ShoppingBag size={22} />
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-slate-950 text-3xs font-black rounded-full flex items-center justify-center border-2 border-slate-900">
                  {qtdCarrinho}
                </div>
              </div>
              <div className="text-left min-w-0">
                <p className="text-3xs uppercase font-black text-slate-400 tracking-wider">Sua Sacola</p>
                <p className="text-base font-black text-amber-400">
                  R$ {totalCarrinho.toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>

            {/* OS 2 BOTÕES SOLICITADOS PELO USUÁRIO */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Botão 1: Pedir Algo Mais */}
              <button
                onClick={() => {
                  window.scrollTo({ top: 300, behavior: "smooth" });
                  mostrarToast("Explore mais pratos e drinks!");
                }}
                className="flex-1 sm:flex-none px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs transition-all active:scale-95 border border-slate-700"
              >
                Pedir Algo Mais
              </button>

              {/* Botão 2: Confirmar Pedido (Vai Direto p/ Cozinha!) */}
              <button
                onClick={() => setModalConfirmacaoCozinha(true)}
                className="flex-1 sm:flex-none px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
              >
                <Send size={15} />
                Confirmar (Cozinha)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO RÁPIDA: ENVIO DIRETO PARA A COZINHA */}
      {modalConfirmacaoCozinha && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-base">
                <Send size={20} /> Enviar Pedido para a Cozinha
              </div>
              <button
                onClick={() => setModalConfirmacaoCozinha(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Confirme seus dados para que a cozinha imprima o seu ticket imediatamente:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 uppercase text-3xs block mb-1">
                  Seu Nome ou Como te chamamos?
                </label>
                <input
                  type="text"
                  placeholder="Ex: Lucas"
                  value={dadosClienteRapido.nome}
                  onChange={(e) => setDadosClienteRapido({ ...dadosClienteRapido, nome: e.target.value })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-400 uppercase text-3xs block mb-1">
                  Número da Mesa ou Endereço de Entrega
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mesa 04 (ou Rua das Flores, 120)"
                  value={dadosClienteRapido.mesaOuEndereco}
                  onChange={(e) => setDadosClienteRapido({ ...dadosClienteRapido, mesaOuEndereco: e.target.value })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">{qtdCarrinho} {qtdCarrinho === 1 ? "item" : "itens"} na comanda</span>
              <span className="font-black text-base text-amber-400">R$ {totalCarrinho.toFixed(2).replace(".", ",")}</span>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setModalConfirmacaoCozinha(false)}
                className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                onClick={dispararPedidoParaCozinha}
                disabled={enviandoCozinha}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {enviandoCozinha ? "Enviando à Cozinha..." : "Confirmar e Enviar Já"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
