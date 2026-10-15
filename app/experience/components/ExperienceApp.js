"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  UtensilsCrossed,
  Bell,
  Receipt,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  X,
  Search,
  Clock,
  Sparkles,
  Wine,
  Coffee,
  HelpCircle,
  GlassWater,
  Trash2,
  ChevronRight,
  Send,
  Globe,
  Flame,
  Info,
  Fish,
  Users,
  BookOpen
} from "lucide-react";
import ConciergeModal from "./ConciergeModal";
import DiscoverModal from "./DiscoverModal";

// Dicionário de Idiomas
const I18N = {
  pt: {
    bemVindo: "Bem-vindo ao",
    mesa: "Mesa",
    semMesa: "Sem Mesa",
    definirMesa: "Identificar Mesa",
    selecioneMesa: "Qual o número da sua mesa?",
    confirmarMesa: "Entrar na Mesa",
    todasCategorias: "Todos",
    buscarPrato: "Buscar prato ou bebida...",
    tempoMedio: "Tempo médio",
    adicionar: "Adicionar",
    adicionado: "Adicionado!",
    personalizar: "Observação",
    obsPlaceholder: "Ex: sem cebola, ponto da carne, sem gelo...",
    minhaMesa: "Minha Mesa",
    comandaVazia: "Nenhum pedido lançado nesta mesa ainda.",
    comandaSub: "Faça seu primeiro pedido pelo cardápio!",
    totalConsumo: "Total acumulado",
    carrinho: "Meu Pedido",
    carrinhoVazio: "Seu carrinho está vazio",
    carrinhoSub: "Toque em um prato para adicioná-lo ao seu pedido.",
    subtotal: "Subtotal",
    enviarCozinha: "Enviar para a Cozinha",
    enviando: "Enviando...",
    pedidoEnviadoTitulo: "Pedido Enviado!",
    pedidoEnviadoDesc: "Seu pedido foi despachado para a produção da cozinha e do bar.",
    chamarGarcom: "Chamar Atendimento",
    chamarGarcomDesc: "Toque no serviço que você precisa na mesa:",
    opcaoGarcom: "Chamar Garçom",
    opcaoAgua: "Água na Mesa",
    opcaoTalheres: "Talheres Extras",
    opcaoGuardanapos: "Guardanapos",
    opcaoLimpeza: "Limpeza da Mesa",
    opcaoConta: "Pedir a Conta",
    opcaoDuvida: "Tirar Dúvida",
    solicitar: "Solicitar",
    chamadoEnviado: "Solicitação enviada! A equipe já está a caminho.",
    statusKds: {
      pendente: "Na fila da cozinha",
      em_preparo: "Em preparo",
      pronto: "Pronto / Servindo",
      entregue: "Entregue na mesa",
      cancelado: "Cancelado"
    },
    fechar: "Fechar"
  },
  en: {
    bemVindo: "Welcome to",
    mesa: "Table",
    semMesa: "No Table",
    definirMesa: "Set Table",
    selecioneMesa: "What is your table number?",
    confirmarMesa: "Confirm Table",
    todasCategorias: "All",
    buscarPrato: "Search dish or beverage...",
    tempoMedio: "Est. time",
    adicionar: "Add",
    adicionado: "Added!",
    personalizar: "Notes",
    obsPlaceholder: "E.g. no onions, meat temperature, no ice...",
    minhaMesa: "My Table",
    comandaVazia: "No orders placed on this table yet.",
    comandaSub: "Make your first order from the menu!",
    totalConsumo: "Accumulated total",
    carrinho: "My Order",
    carrinhoVazio: "Your cart is empty",
    carrinhoSub: "Tap on a dish to add it to your order.",
    subtotal: "Subtotal",
    enviarCozinha: "Send to Kitchen",
    enviando: "Sending...",
    pedidoEnviadoTitulo: "Order Sent!",
    pedidoEnviadoDesc: "Your order was dispatched to our kitchen and bar staff.",
    chamarGarcom: "Call Service",
    chamarGarcomDesc: "Tap the service you need at your table:",
    opcaoGarcom: "Call Waiter",
    opcaoAgua: "Water for Table",
    opcaoTalheres: "Extra Cutlery",
    opcaoGuardanapos: "Napkins",
    opcaoLimpeza: "Clean Table",
    opcaoConta: "Request Bill",
    opcaoDuvida: "Ask a Question",
    solicitar: "Request",
    chamadoEnviado: "Request sent! Staff is on the way.",
    statusKds: {
      pendente: "In kitchen queue",
      em_preparo: "Preparing",
      pronto: "Ready / Serving",
      entregue: "Delivered",
      cancelado: "Cancelled"
    },
    fechar: "Close"
  },
  es: {
    bemVindo: "Bienvenido a",
    mesa: "Mesa",
    semMesa: "Sin Mesa",
    definirMesa: "Identificar Mesa",
    selecioneMesa: "¿Cuál es el número de su mesa?",
    confirmarMesa: "Entrar a la Mesa",
    todasCategorias: "Todos",
    buscarPrato: "Buscar plato o bebida...",
    tempoMedio: "Tiempo est.",
    adicionar: "Agregar",
    adicionado: "¡Agregado!",
    personalizar: "Nota",
    obsPlaceholder: "Ej: sin cebolla, término de carne, sin hielo...",
    minhaMesa: "Mi Mesa",
    comandaVazia: "Aún no hay pedidos en esta mesa.",
    comandaSub: "¡Haga su primer pedido desde la carta!",
    totalConsumo: "Total acumulado",
    carrinho: "Mi Pedido",
    carrinhoVazio: "Tu pedido está vacío",
    carrinhoSub: "Toca un plato para agregarlo a tu pedido.",
    subtotal: "Subtotal",
    enviarCozinha: "Enviar a la Cocina",
    enviando: "Enviando...",
    pedidoEnviadoTitulo: "¡Pedido Enviado!",
    pedidoEnviadoDesc: "Su pedido fue despachado a la cocina y bar.",
    chamarGarcom: "Llamar Servicio",
    chamarGarcomDesc: "Seleccione el servicio que necesita en la mesa:",
    opcaoGarcom: "Llamar Camarero",
    opcaoAgua: "Agua en la Mesa",
    opcaoTalheres: "Cubiertos Extras",
    opcaoGuardanapos: "Servilletas",
    opcaoLimpeza: "Limpiar Mesa",
    opcaoConta: "Pedir la Cuenta",
    opcaoDuvida: "Pregunta / Duda",
    solicitar: "Solicitar",
    chamadoEnviado: "¡Solicitud enviada! El equipo ya va en camino.",
    statusKds: {
      pendente: "En cola de cocina",
      em_preparo: "En preparación",
      pronto: "Listo / Sirviendo",
      entregue: "Entregado",
      cancelado: "Cancelado"
    },
    fechar: "Cerrar"
  }
};

const fmtMoeda = (val) => {
  return Number(val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

export default function ExperienceApp({ unidadeId, mesaInicial = null }) {
  const [idioma, setIdioma] = useState("pt");
  const t = I18N[idioma] || I18N.pt;

  // Estado de Mesa
  const [mesa, setMesa] = useState(mesaInicial || "");
  const [modalMesa, setModalMesa] = useState(!mesaInicial);
  const [inputMesa, setInputMesa] = useState(mesaInicial || "");

  // Dados do Cardápio
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [unidadeInfo, setUnidadeInfo] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);

  // Filtros
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [busca, setBusca] = useState("");

  // Carrinho
  const [carrinho, setCarrinho] = useState([]);
  const [modalCarrinho, setModalCarrinho] = useState(false);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [alertaSucesso, setAlertaSucesso] = useState(null);

  // Comanda da Mesa
  const [comandaMesa, setComandaMesa] = useState(null);
  const [modalComanda, setModalComanda] = useState(false);
  const [carregandoComanda, setCarregandoComanda] = useState(false);

  // Chamada de Garçom
  const [modalChamado, setModalChamado] = useState(false);
  const [enviandoChamado, setEnviandoChamado] = useState(false);

  // Modal Detalhes do Prato
  const [pratoModal, setPratoModal] = useState(null);
  const [obsPrato, setObsPrato] = useState("");
  const [qtdPrato, setQtdPrato] = useState(1);

  // Concierge & Discover
  const [modalConcierge, setModalConcierge] = useState(false);
  const [modalDiscover, setModalDiscover] = useState(false);
  const [pratoDiscover, setPratoDiscover] = useState(null);

  // Carregar cardápio ao montar
  useEffect(() => {
    async function carregarCardapio() {
      setCarregando(true);
      setErro(null);
      try {
        const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/cardapio`, {
          cache: "no-store"
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.erro || "Não foi possível carregar o cardápio.");
        }
        setUnidadeInfo(json.unidade);
        setCategorias(json.categorias || []);
        setProdutos(json.produtos || []);
      } catch (err) {
        setErro(err.message || "Erro de conexão ao abrir cardápio.");
      } finally {
        setCarregando(false);
      }
    }
    carregarCardapio();
  }, [unidadeId]);

  // Carregar Comanda da Mesa quando a mesa estiver definida
  const carregarComanda = async () => {
    if (!mesa) return;
    setCarregandoComanda(true);
    try {
      const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/mesa?mesa=${encodeURIComponent(mesa)}`, {
        cache: "no-store"
      });
      if (res.ok) {
        const json = await res.json();
        setComandaMesa(json);
      }
    } catch {
      // Ignora erro momentâneo de rede
    } finally {
      setCarregandoComanda(false);
    }
  };

  useEffect(() => {
    if (mesa) {
      carregarComanda();
    }
  }, [mesa, unidadeId]);

  // Produtos Filtrados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchCat = categoriaAtiva === "Todos" || p.categoria === categoriaAtiva;
      const matchBusca = !busca || p.nome_produto.toLowerCase().includes(busca.toLowerCase()) || (p.descricao && p.descricao.toLowerCase().includes(busca.toLowerCase()));
      return matchCat && matchBusca;
    });
  }, [produtos, categoriaAtiva, busca]);

  // Manipulação do Carrinho
  const abrirModalPrato = (p) => {
    setPratoModal(p);
    setQtdPrato(1);
    setObsPrato("");
  };

  const adicionarAoCarrinho = (p, qtd = 1, obs = "") => {
    setCarrinho(prev => {
      const existenteIdx = prev.findIndex(item => item.id === p.id && item.observacao === obs);
      if (existenteIdx >= 0) {
        const novo = [...prev];
        novo[existenteIdx].quantidade += qtd;
        return novo;
      }
      return [...prev, {
        id: p.id,
        nome_produto: p.nome_produto,
        preco_venda: p.preco_venda,
        quantidade: qtd,
        observacao: obs,
        departamento: p.departamento
      }];
    });

    setPratoModal(null);
  };

  const alterarQtdCarrinho = (index, delta) => {
    setCarrinho(prev => {
      const novo = [...prev];
      novo[index].quantidade += delta;
      if (novo[index].quantidade <= 0) {
        novo.splice(index, 1);
      }
      return novo;
    });
  };

  const removerDoCarrinho = (index) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  const totalCarrinho = useMemo(() => {
    return carrinho.reduce((acc, it) => acc + (it.preco_venda * it.quantidade), 0);
  }, [carrinho]);

  const totalQtdCarrinho = useMemo(() => {
    return carrinho.reduce((acc, it) => acc + it.quantidade, 0);
  }, [carrinho]);

  // Enviar Pedido para a Cozinha
  const confirmarPedido = async () => {
    if (!mesa) {
      setModalMesa(true);
      return;
    }
    if (carrinho.length === 0) return;

    setEnviandoPedido(true);
    try {
      const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa,
          itens: carrinho.map(it => ({
            id: it.id,
            quantidade: it.quantidade,
            observacao: it.observacao
          })),
          chaveIdempotencia: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        })
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.erro || "Não foi possível enviar o pedido.");
        return;
      }

      setCarrinho([]);
      setModalCarrinho(false);
      setAlertaSucesso(t.pedidoEnviadoDesc);
      await carregarComanda();

      setTimeout(() => {
        setAlertaSucesso(null);
      }, 5000);
    } catch {
      alert("Falha de conexão ao enviar pedido.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  // Enviar Chamado de Garçom
  const dispararChamado = async (tipo) => {
    if (!mesa) {
      setModalMesa(true);
      return;
    }

    setEnviandoChamado(true);
    try {
      const res = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/chamado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa,
          tipo
        })
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.erro || "Falha ao solicitar atendimento.");
        return;
      }

      setModalChamado(false);
      setAlertaSucesso(t.chamadoEnviado);
      setTimeout(() => setAlertaSucesso(null), 4000);
    } catch {
      alert("Falha de conexão ao chamar garçom.");
    } finally {
      setEnviandoChamado(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#14100e] text-[#f7efe8] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full border-4 border-amber-600/30 border-t-amber-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight text-amber-100">Carregando Héfisto Experience</h2>
        <p className="text-sm text-amber-200/60 mt-1">Conectando ao cardápio gastronômico...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-[#14100e] text-[#f7efe8] flex flex-col items-center justify-center p-6 text-center">
        <UtensilsCrossed size={48} className="text-amber-500/60 mb-4" />
        <h2 className="text-xl font-bold text-amber-200">{erro}</h2>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl transition shadow-lg shadow-amber-900/40"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#130f0d] text-[#f9f4ef] font-sans pb-28 select-none">
      
      {/* ALERTA DE SUCESSO TOAST */}
      {alertaSucesso && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center justify-center animate-bounce">
          <div className="bg-emerald-600/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 max-w-md w-full">
            <CheckCircle2 size={24} className="shrink-0 text-emerald-200" />
            <span className="text-sm font-semibold flex-1">{alertaSucesso}</span>
            <button onClick={() => setAlertaSucesso(null)} className="text-emerald-200 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* HEADER SOFISTICADO */}
      <header className="sticky top-0 z-30 bg-[#1c1613]/90 backdrop-blur-md border-b border-amber-900/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-md shadow-amber-950/40 text-amber-100 font-black text-lg">
              {unidadeInfo?.nome?.slice(0, 1) || "H"}
            </div>
            <div>
              <p className="text-3xs tracking-widest uppercase font-bold text-amber-400/80">{t.bemVindo}</p>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-amber-50 leading-tight">
                {unidadeInfo?.nome || "Seldeestrela"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de Idioma */}
            <div className="flex items-center bg-[#251e1a] rounded-xl p-1 border border-amber-900/30 text-xs">
              <button
                onClick={() => setIdioma("pt")}
                className={`px-2 py-1 rounded-lg font-bold transition ${idioma === "pt" ? "bg-amber-600 text-white shadow-sm" : "text-amber-300/60 hover:text-amber-200"}`}
                title="Português"
              >
                PT
              </button>
              <button
                onClick={() => setIdioma("en")}
                className={`px-2 py-1 rounded-lg font-bold transition ${idioma === "en" ? "bg-amber-600 text-white shadow-sm" : "text-amber-300/60 hover:text-amber-200"}`}
                title="English"
              >
                EN
              </button>
              <button
                onClick={() => setIdioma("es")}
                className={`px-2 py-1 rounded-lg font-bold transition ${idioma === "es" ? "bg-amber-600 text-white shadow-sm" : "text-amber-300/60 hover:text-amber-200"}`}
                title="Español"
              >
                ES
              </button>
            </div>

            {/* Badge da Mesa */}
            <button
              onClick={() => {
                setInputMesa(mesa);
                setModalMesa(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-900/40 to-amber-800/30 border border-amber-600/40 hover:border-amber-500 rounded-xl text-amber-200 text-xs font-bold transition shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{mesa ? `${t.mesa} ${mesa}` : t.definirMesa}</span>
            </button>
          </div>
        </div>
      </header>

      {/* BANNER / BUSCA E CATEGORIAS */}
      <main className="max-w-2xl mx-auto px-4 mt-4">
        {/* BANNER HÉFISTO CONCIERGE — GARÇOM VIRTUAL */}
        <div className="mb-4 bg-gradient-to-r from-[#241a14] via-[#2c1e17] to-[#201612] border border-amber-600/35 rounded-3xl p-4 shadow-xl shadow-amber-950/30 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-amber-950 flex items-center justify-center shadow-lg shadow-amber-900/40 shrink-0">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <span className="text-3xs font-black uppercase tracking-widest text-amber-400 block">
                  Garçom Virtual Inteligente
                </span>
                <h3 className="text-sm sm:text-base font-black text-amber-50 mt-0.5">
                  {idioma === "en" ? "Explore Amazonian flavors & Chef pairings" : idioma === "es" ? "Descubra los sabores de la Amazonía" : "Descubra os sabores e segredos da Amazônia"}
                </h3>
                <p className="text-3xs text-amber-200/70 mt-0.5">
                  {idioma === "en" ? "Instant dish and drink suggestions curated by our Chef" : idioma === "es" ? "Sugerencias y maridajes especiales guiados por IA" : "Sugestões guiadas por botões, estilos de drinks e harmonizações"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setModalConcierge(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shrink-0 transition active:scale-95 shadow-md shadow-amber-950/40 flex items-center gap-1.5"
            >
              <span>Explorar</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Atalhos rápidos do Concierge */}
          <div className="flex gap-1.5 overflow-x-auto pt-3 mt-3 border-t border-amber-900/20 scrollbar-none">
            <button
              onClick={() => setModalConcierge(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-900/25 hover:bg-amber-800/40 border border-amber-700/30 text-amber-200 text-3xs font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <Sparkles size={11} className="text-amber-400" />
              <span>Sugestões da Casa</span>
            </button>
            <button
              onClick={() => setModalConcierge(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-900/25 hover:bg-amber-800/40 border border-amber-700/30 text-amber-200 text-3xs font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <Fish size={11} className="text-cyan-400" />
              <span>Peixes Amazônicos</span>
            </button>
            <button
              onClick={() => setModalConcierge(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-900/25 hover:bg-amber-800/40 border border-amber-700/30 text-amber-200 text-3xs font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <Flame size={11} className="text-orange-400" />
              <span>Carnes Nobres</span>
            </button>
            <button
              onClick={() => setModalConcierge(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-900/25 hover:bg-amber-800/40 border border-amber-700/30 text-amber-200 text-3xs font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <Wine size={11} className="text-rose-400" />
              <span>Drinks & Estilos</span>
            </button>
            <button
              onClick={() => setModalConcierge(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-900/25 hover:bg-amber-800/40 border border-amber-700/30 text-amber-200 text-3xs font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <Users size={11} className="text-emerald-400" />
              <span>Para Compartilhar</span>
            </button>
          </div>
        </div>

        {/* Barra de Busca */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400/50" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t.buscarPrato}
            className="w-full bg-[#1c1613] border border-amber-900/30 rounded-2xl py-3 pl-10 pr-4 text-sm text-amber-100 placeholder:text-amber-400/40 outline-none focus:border-amber-500 transition shadow-inner"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-400/60 hover:text-amber-200">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Carrossel de Categorias */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          <button
            onClick={() => setCategoriaAtiva("Todos")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
              categoriaAtiva === "Todos"
                ? "bg-amber-600 text-white shadow-amber-900/40"
                : "bg-[#211a16] text-amber-200/70 border border-amber-900/20 hover:bg-[#2b221d]"
            }`}
          >
            {t.todasCategorias}
          </button>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                categoriaAtiva === cat
                  ? "bg-amber-600 text-white shadow-amber-900/40"
                  : "bg-[#211a16] text-amber-200/70 border border-amber-900/20 hover:bg-[#2b221d]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* LISTAGEM DE PRATOS */}
        <div className="mt-4 space-y-4">
          {produtosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-amber-300/50">
              <UtensilsCrossed size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Nenhum item encontrado nesta categoria.</p>
            </div>
          ) : (
            produtosFiltrados.map(prod => (
              <div
                key={prod.id}
                onClick={() => abrirModalPrato(prod)}
                className="bg-[#1b1512] border border-amber-900/25 rounded-3xl p-3.5 sm:p-4 hover:border-amber-700/50 transition-all cursor-pointer shadow-lg shadow-black/20 flex gap-3.5 sm:gap-4 group active:scale-[0.99]"
              >
                {/* Imagem do Prato */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#261e19] shrink-0 relative border border-amber-950/40">
                  {prod.imagem_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={prod.imagem_url}
                      alt={prod.nome_produto}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-amber-700/40">
                      <UtensilsCrossed size={28} />
                    </div>
                  )}
                  {prod.destaque && (
                    <span className="absolute top-1.5 left-1.5 bg-amber-500 text-amber-950 text-3xs font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow">
                      Chef
                    </span>
                  )}
                </div>

                {/* Dados do Prato */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-sm sm:text-base text-amber-50 leading-snug group-hover:text-amber-300 transition-colors line-clamp-1">
                        {prod.nome_produto}
                      </h3>
                      <span className="font-black text-sm sm:text-base text-amber-400 shrink-0">
                        {fmtMoeda(prod.preco_venda)}
                      </span>
                    </div>

                    {prod.descricao && (
                      <p className="text-xs text-amber-200/60 line-clamp-2 mt-1 leading-relaxed">
                        {prod.descricao}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-900/15 mt-2">
                    <div className="flex items-center gap-2 text-3xs text-amber-300/60 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-amber-500/70" />
                        {prod.tempo_preparo_base} min
                      </span>
                      {prod.departamento === "bar" ? (
                        <span className="flex items-center gap-0.5 text-amber-400/80">
                          <Wine size={12} /> Bar
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-orange-400/80">
                          <Flame size={12} /> Cozinha
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        adicionarAoCarrinho(prod, 1, "");
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-amber-900/30 transition-all active:scale-95"
                    >
                      <Plus size={14} />
                      <span>{t.adicionar}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* BARRA INFERIOR DE NAVEGAÇÃO FLUTUANTE */}
      <nav className="fixed bottom-3 inset-x-4 max-w-xl mx-auto z-40 bg-[#1e1713]/95 backdrop-blur-lg border border-amber-600/30 rounded-3xl p-2 shadow-2xl shadow-black/80 flex items-center justify-around">
        {/* Cardápio */}
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex flex-col items-center gap-1 px-2.5 py-1.5 text-amber-300 hover:text-amber-100 transition"
        >
          <UtensilsCrossed size={18} />
          <span className="text-3xs font-bold uppercase tracking-wider">Cardápio</span>
        </button>

        {/* Concierge IA */}
        <button
          onClick={() => setModalConcierge(true)}
          className="flex flex-col items-center gap-1 px-2.5 py-1.5 text-amber-300 hover:text-amber-100 transition relative"
        >
          <Sparkles size={18} className="text-amber-400 animate-pulse" />
          <span className="text-3xs font-black uppercase tracking-wider text-amber-300">Concierge</span>
        </button>

        {/* Chamar Garçom */}
        <button
          onClick={() => setModalChamado(true)}
          className="flex flex-col items-center gap-1 px-3 py-1.5 text-amber-400 hover:text-amber-200 transition relative"
        >
          <Bell size={20} />
          <span className="text-3xs font-bold uppercase tracking-wider">{t.chamarGarcom}</span>
        </button>

        {/* Minha Mesa / Comanda */}
        <button
          onClick={() => {
            carregarComanda();
            setModalComanda(true);
          }}
          className="flex flex-col items-center gap-1 px-3 py-1.5 text-amber-400 hover:text-amber-200 transition relative"
        >
          <Receipt size={20} />
          <span className="text-3xs font-bold uppercase tracking-wider">{t.minhaMesa}</span>
          {comandaMesa?.itens?.length > 0 && (
            <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        {/* Carrinho */}
        <button
          onClick={() => setModalCarrinho(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-amber-900/50 transition-all active:scale-95"
        >
          <ShoppingCart size={18} />
          <span className="bg-amber-950/60 px-1.5 py-0.5 rounded-lg text-amber-200 text-3xs font-bold">
            {totalQtdCarrinho}
          </span>
          <span className="hidden sm:inline font-mono">{fmtMoeda(totalCarrinho)}</span>
        </button>
      </nav>

      {/* MODAL DETALHES / PERSONALIZAÇÃO DO PRATO */}
      {pratoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1b1512] border border-amber-900/40 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Imagem Superior */}
            <div className="h-48 sm:h-56 bg-[#261e19] relative shrink-0">
              {pratoModal.imagem_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pratoModal.imagem_url} alt={pratoModal.nome_produto} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-amber-700/30">
                  <UtensilsCrossed size={48} />
                </div>
              )}
              <button
                onClick={() => setPratoModal(null)}
                className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-xl font-black text-amber-50">{pratoModal.nome_produto}</h2>
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                    {pratoModal.categoria} • {pratoModal.tempo_preparo_base} min
                  </p>
                </div>
                <span className="text-xl font-black text-amber-400">
                  {fmtMoeda(pratoModal.preco_venda)}
                </span>
              </div>

              {pratoModal.descricao && (
                <p className="text-sm text-amber-200/80 leading-relaxed">
                  {pratoModal.descricao}
                </p>
              )}

              {pratoModal.harmonizacao && (
                <div className="bg-amber-950/40 border border-amber-800/30 p-3 rounded-2xl flex items-start gap-2.5">
                  <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-3xs font-black uppercase text-amber-300 tracking-wider block">Harmonização Sugerida</span>
                    <p className="text-xs text-amber-100/90 mt-0.5">{pratoModal.harmonizacao}</p>
                  </div>
                </div>
              )}

              {/* Botão Discover: História do Prato */}
              <button
                type="button"
                onClick={() => {
                  setPratoDiscover(pratoModal);
                  setModalDiscover(true);
                }}
                className="w-full py-2.5 px-3.5 bg-gradient-to-r from-amber-950/70 to-amber-900/50 hover:from-amber-900/70 hover:to-amber-800/60 border border-amber-600/40 rounded-2xl flex items-center justify-between text-amber-200 transition shadow-sm active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-amber-400" />
                  <span className="text-xs font-bold">Descubra a história e ingredientes deste prato</span>
                </div>
                <ChevronRight size={16} className="text-amber-400/80" />
              </button>

              {/* Observações / Personalização */}
              <div>
                <label className="text-xs font-bold text-amber-300 block mb-1.5">{t.personalizar}</label>
                <textarea
                  value={obsPrato}
                  onChange={(e) => setObsPrato(e.target.value)}
                  placeholder={t.obsPlaceholder}
                  rows={2}
                  className="w-full bg-[#14100e] border border-amber-900/30 rounded-2xl p-3 text-sm text-amber-100 placeholder:text-amber-500/30 outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Quantidade e Ação */}
              <div className="flex items-center justify-between pt-3 border-t border-amber-900/20">
                <div className="flex items-center gap-3 bg-[#14100e] border border-amber-900/30 rounded-2xl p-1.5">
                  <button
                    onClick={() => setQtdPrato(Math.max(1, qtdPrato - 1))}
                    className="w-8 h-8 rounded-xl bg-amber-900/40 text-amber-200 flex items-center justify-center font-bold hover:bg-amber-800/50"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-black text-base w-6 text-center text-amber-100">{qtdPrato}</span>
                  <button
                    onClick={() => setQtdPrato(qtdPrato + 1)}
                    className="w-8 h-8 rounded-xl bg-amber-900/40 text-amber-200 flex items-center justify-center font-bold hover:bg-amber-800/50"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  onClick={() => adicionarAoCarrinho(pratoModal, qtdPrato, obsPrato)}
                  className="flex-1 ml-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-amber-900/40 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  <span>{t.adicionar} • {fmtMoeda(pratoModal.preco_venda * qtdPrato)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CARRINHO / ENVIAR PEDIDO */}
      {modalCarrinho && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1b1512] border border-amber-900/40 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-amber-900/25 flex items-center justify-between bg-[#221a16]">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-amber-400" />
                <h2 className="text-lg font-black text-amber-50">{t.carrinho} ({totalQtdCarrinho})</h2>
              </div>
              <button onClick={() => setModalCarrinho(false)} className="p-2 text-amber-300 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {carrinho.length === 0 ? (
                <div className="py-12 text-center text-amber-300/40">
                  <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="font-bold text-sm">{t.carrinhoVazio}</p>
                  <p className="text-xs text-amber-400/50 mt-1">{t.carrinhoSub}</p>
                </div>
              ) : (
                carrinho.map((it, idx) => (
                  <div key={idx} className="bg-[#14100e] border border-amber-900/20 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-amber-100 truncate">{it.nome_produto}</h4>
                      {it.observacao && (
                        <p className="text-3xs text-amber-400/70 italic mt-0.5">Obs: {it.observacao}</p>
                      )}
                      <p className="text-xs font-black text-amber-400 mt-1">
                        {fmtMoeda(it.preco_venda * it.quantidade)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => alterarQtdCarrinho(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-amber-900/30 text-amber-200 flex items-center justify-center font-bold hover:bg-amber-800/40"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold text-sm w-5 text-center text-amber-100">{it.quantidade}</span>
                      <button
                        onClick={() => alterarQtdCarrinho(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-amber-900/30 text-amber-200 flex items-center justify-center font-bold hover:bg-amber-800/40"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => removerDoCarrinho(idx)}
                        className="p-1.5 text-amber-400/50 hover:text-red-400 ml-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {carrinho.length > 0 && (
              <div className="p-4 border-t border-amber-900/25 bg-[#221a16] space-y-3">
                <div className="flex justify-between items-center text-sm font-bold text-amber-200">
                  <span>{t.subtotal}</span>
                  <span className="text-lg font-black text-amber-400">{fmtMoeda(totalCarrinho)}</span>
                </div>

                <button
                  onClick={confirmarPedido}
                  disabled={enviandoPedido}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black rounded-2xl shadow-xl shadow-amber-900/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={18} />
                  <span>{enviandoPedido ? t.enviando : t.enviarCozinha}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL MINHA MESA / COMANDA */}
      {modalComanda && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1b1512] border border-amber-900/40 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-amber-900/25 flex items-center justify-between bg-[#221a16]">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-amber-400" />
                <h2 className="text-lg font-black text-amber-50">{t.minhaMesa} — {t.mesa} {mesa}</h2>
              </div>
              <button onClick={() => setModalComanda(false)} className="p-2 text-amber-300 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {carregandoComanda ? (
                <div className="py-12 text-center text-amber-300/50 font-bold">Atualizando comanda...</div>
              ) : !comandaMesa || comandaMesa.itens.length === 0 ? (
                <div className="py-12 text-center text-amber-300/40">
                  <Receipt size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="font-bold text-sm">{t.comandaVazia}</p>
                  <p className="text-xs text-amber-400/50 mt-1">{t.comandaSub}</p>
                </div>
              ) : (
                comandaMesa.itens.map((it, idx) => (
                  <div key={idx} className="bg-[#14100e] border border-amber-900/20 rounded-2xl p-3 flex justify-between items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-400 text-sm">{it.quantidade}x</span>
                        <h4 className="font-bold text-sm text-amber-100">{it.nome}</h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-3xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-300 border border-amber-800/30">
                          {t.statusKds[it.status_kds] || it.status_kds}
                        </span>
                        {it.hora && <span className="text-3xs text-amber-500/60 font-mono">{it.hora}</span>}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const prodRel = produtos.find(p => String(p.id) === String(it.produto_id) || p.nome_produto === it.nome) || {
                            id: it.produto_id || idx,
                            nome_produto: it.nome,
                            preco_venda: it.subtotal / (it.quantidade || 1)
                          };
                          setPratoDiscover(prodRel);
                          setModalDiscover(true);
                        }}
                        className="mt-2 flex items-center gap-1.5 text-3xs font-bold text-amber-400 hover:text-amber-200 transition"
                      >
                        <BookOpen size={12} />
                        <span>Descubra a história deste prato ✨</span>
                      </button>
                    </div>
                    <span className="font-black text-sm text-amber-300">{fmtMoeda(it.subtotal)}</span>
                  </div>
                ))
              )}
            </div>

            {comandaMesa && comandaMesa.itens.length > 0 && (
              <div className="p-4 border-t border-amber-900/25 bg-[#221a16] flex justify-between items-center">
                <span className="text-sm font-bold text-amber-200">{t.totalConsumo}</span>
                <span className="text-xl font-black text-amber-400">{fmtMoeda(comandaMesa.total)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CHAMAR GARÇOM */}
      {modalChamado && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1b1512] border border-amber-900/40 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-amber-900/25 flex items-center justify-between bg-[#221a16]">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-amber-400" />
                <h2 className="text-lg font-black text-amber-50">{t.chamarGarcom}</h2>
              </div>
              <button onClick={() => setModalChamado(false)} className="p-2 text-amber-300 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-amber-200/70">{t.chamarGarcomDesc}</p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => dispararChamado("garcom")}
                  disabled={enviandoChamado}
                  className="p-3.5 bg-[#221a16] hover:bg-[#2e231e] border border-amber-900/30 rounded-2xl text-left transition flex flex-col justify-between gap-2 active:scale-95"
                >
                  <Bell size={22} className="text-amber-400" />
                  <span className="text-xs font-bold text-amber-100">{t.opcaoGarcom}</span>
                </button>

                <button
                  onClick={() => dispararChamado("agua")}
                  disabled={enviandoChamado}
                  className="p-3.5 bg-[#221a16] hover:bg-[#2e231e] border border-amber-900/30 rounded-2xl text-left transition flex flex-col justify-between gap-2 active:scale-95"
                >
                  <GlassWater size={22} className="text-sky-400" />
                  <span className="text-xs font-bold text-amber-100">{t.opcaoAgua}</span>
                </button>

                <button
                  onClick={() => dispararChamado("talheres")}
                  disabled={enviandoChamado}
                  className="p-3.5 bg-[#221a16] hover:bg-[#2e231e] border border-amber-900/30 rounded-2xl text-left transition flex flex-col justify-between gap-2 active:scale-95"
                >
                  <UtensilsCrossed size={22} className="text-amber-300" />
                  <span className="text-xs font-bold text-amber-100">{t.opcaoTalheres}</span>
                </button>

                <button
                  onClick={() => dispararChamado("guardanapos")}
                  disabled={enviandoChamado}
                  className="p-3.5 bg-[#221a16] hover:bg-[#2e231e] border border-amber-900/30 rounded-2xl text-left transition flex flex-col justify-between gap-2 active:scale-95"
                >
                  <Sparkles size={22} className="text-emerald-400" />
                  <span className="text-xs font-bold text-amber-100">{t.opcaoGuardanapos}</span>
                </button>

                <button
                  onClick={() => dispararChamado("limpeza")}
                  disabled={enviandoChamado}
                  className="p-3.5 bg-[#221a16] hover:bg-[#2e231e] border border-amber-900/30 rounded-2xl text-left transition flex flex-col justify-between gap-2 active:scale-95"
                >
                  <Sparkles size={22} className="text-yellow-400" />
                  <span className="text-xs font-bold text-amber-100">{t.opcaoLimpeza}</span>
                </button>

                <button
                  onClick={() => dispararChamado("conta")}
                  disabled={enviandoChamado}
                  className="p-3.5 bg-[#221a16] hover:bg-[#2e231e] border border-amber-900/30 rounded-2xl text-left transition flex flex-col justify-between gap-2 active:scale-95"
                >
                  <Receipt size={22} className="text-emerald-400" />
                  <span className="text-xs font-bold text-amber-100">{t.opcaoConta}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEFINIR MESA */}
      {modalMesa && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1c1613] border border-amber-800/40 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-600/20 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-600/30">
              <UtensilsCrossed size={24} />
            </div>

            <h3 className="text-lg font-black text-amber-50">{t.definirMesa}</h3>
            <p className="text-xs text-amber-200/60 mt-1 mb-4">{t.selecioneMesa}</p>

            <input
              type="text"
              value={inputMesa}
              onChange={(e) => setInputMesa(e.target.value)}
              placeholder="Ex: 04"
              className="w-full bg-[#14100e] border border-amber-900/40 rounded-2xl py-3 px-4 text-center font-black text-2xl text-amber-200 outline-none focus:border-amber-500 mb-4"
              autoFocus
            />

            <button
              onClick={() => {
                if (inputMesa.trim()) {
                  setMesa(inputMesa.trim());
                  setModalMesa(false);
                }
              }}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-900/40 transition active:scale-95"
            >
              {t.confirmarMesa}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DO CONCIERGE — GARÇOM VIRTUAL */}
      <ConciergeModal
        aberto={modalConcierge}
        onClose={() => setModalConcierge(false)}
        unidadeId={unidadeId}
        unidadeNome={unidadeInfo?.nome || "Seldeestrela"}
        idioma={idioma}
        setIdioma={setIdioma}
        onAdicionarAoCarrinho={(p, obs) => adicionarAoCarrinho(p, 1, obs)}
        onChamarGarcom={() => setModalChamado(true)}
      />

      {/* MODAL DO DISCOVER — HISTÓRIA E BOTÂNICA DO PRATO */}
      <DiscoverModal
        aberto={modalDiscover}
        onClose={() => {
          setModalDiscover(false);
          setPratoDiscover(null);
        }}
        unidadeId={unidadeId}
        prato={pratoDiscover}
        onAdicionarAoCarrinho={(p, obs) => adicionarAoCarrinho(p, 1, obs)}
      />

    </div>
  );
}
