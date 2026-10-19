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
  BookOpen,
  Heart,
  SlidersHorizontal,
  ShieldAlert,
  Check,
  RotateCcw
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
    favoritos: "Favoritos",
    buscarPrato: "Buscar prato ou bebida...",
    tempoMedio: "Tempo médio",
    adicionar: "Adicionar",
    adicionado: "Adicionado!",
    personalizar: "Observação livre",
    obsPlaceholder: "Ex: observação para o garçom e a cozinha...",
    minhaMesa: "Minha Mesa",
    comandaVazia: "Nenhum pedido lançado nesta mesa ainda.",
    comandaSub: "Faça seu primeiro pedido pelo cardápio!",
    totalConsumo: "Total acumulado",
    repetirPedido: "Pedir mais um",
    dividirConta: "Divisão Inteligente da Conta",
    pessoas: "pessoas na mesa",
    taxaServico: "Taxa de serviço sugerida (10%)",
    valorPorPessoa: "Valor por pessoa",
    solicitarContaDividida: "Pedir Conta com Garçom",
    preferencias: "Minhas Preferências",
    preferenciasDesc: "Personalize sua experiência gastronômica de forma anônima e segura (LGPD):",
    salvarPreferencias: "Aplicar Preferências",
    sugestaoChef: "Sugestão da Casa para seu pedido",
    pontoCarne: "Ponto da Carne",
    estiloBebida: "Serviço de Bebida",
    personalizacaoRapida: "Personalizações Rápidas",
    combinaComVc: "Combina com você",
    alertaAlergenico: "Atenção: contém ingrediente restrito",
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
    favoritos: "Favorites",
    buscarPrato: "Search dish or beverage...",
    tempoMedio: "Est. time",
    adicionar: "Add",
    adicionado: "Added!",
    personalizar: "Custom notes",
    obsPlaceholder: "E.g. special instructions for kitchen and bar...",
    minhaMesa: "My Table",
    comandaVazia: "No orders placed on this table yet.",
    comandaSub: "Make your first order from the menu!",
    totalConsumo: "Accumulated total",
    repetirPedido: "Order another",
    dividirConta: "Smart Bill Splitting",
    pessoas: "people at table",
    taxaServico: "Suggested service fee (10%)",
    valorPorPessoa: "Per person",
    solicitarContaDividida: "Request Bill from Waiter",
    preferencias: "My Preferences",
    preferenciasDesc: "Tailor your dining experience anonymously and privately (LGPD):",
    salvarPreferencias: "Apply Preferences",
    sugestaoChef: "Chef's pairing recommendation",
    pontoCarne: "Meat Temperature",
    estiloBebida: "Beverage Service",
    personalizacaoRapida: "Quick Customizations",
    combinaComVc: "Matches your taste",
    alertaAlergenico: "Notice: contains restricted ingredient",
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
    favoritos: "Favoritos",
    buscarPrato: "Buscar plato o bebida...",
    tempoMedio: "Tiempo est.",
    adicionar: "Agregar",
    adicionado: "¡Agregado!",
    personalizar: "Nota libre",
    obsPlaceholder: "Ej: instrucciones especiales para cocina y bar...",
    minhaMesa: "Mi Mesa",
    comandaVazia: "Aún no hay pedidos en esta mesa.",
    comandaSub: "¡Haga su primer pedido desde la carta!",
    totalConsumo: "Total acumulado",
    repetirPedido: "Pedir otro",
    dividirConta: "División Inteligente de Cuenta",
    pessoas: "personas en la mesa",
    taxaServico: "Servicio sugerido (10%)",
    valorPorPessoa: "Por persona",
    solicitarContaDividida: "Pedir la Cuenta al Camarero",
    preferencias: "Mis Preferencias",
    preferenciasDesc: "Personalice su experiencia de forma anónima y segura (LGPD):",
    salvarPreferencias: "Aplicar Preferencias",
    sugestaoChef: "Sugerencia del Chef para tu pedido",
    pontoCarne: "Término de la Carne",
    estiloBebida: "Servicio de Bebida",
    personalizacaoRapida: "Personalización Rápida",
    combinaComVc: "Ideal para ti",
    alertaAlergenico: "Atención: contiene ingrediente restringido",
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

const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

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
  const [campanhas, setCampanhas] = useState([]);

  // CRM Local & Preferências sem Fricção (Fase 8 - LGPD)
  const [modalPreferencias, setModalPreferencias] = useState(false);
  const [preferencias, setPreferencias] = useState({
    vegetariano: false,
    semLactose: false,
    semGluten: false,
    peixes: false
  });
  const [favoritos, setFavoritos] = useState([]);

  // Filtros
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [busca, setBusca] = useState("");

  // Carrinho
  const [carrinho, setCarrinho] = useState([]);
  const [modalCarrinho, setModalCarrinho] = useState(false);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [alertaSucesso, setAlertaSucesso] = useState(null);

  // Comanda da Mesa & Divisão Inteligente (Fase 6)
  const [comandaMesa, setComandaMesa] = useState(null);
  const [modalComanda, setModalComanda] = useState(false);
  const [carregandoComanda, setCarregandoComanda] = useState(false);
  const [dividirPessoas, setDividirPessoas] = useState(1);
  const [incluirServico, setIncluirServico] = useState(true);

  // Chamada de Garçom
  const [modalChamado, setModalChamado] = useState(false);
  const [enviandoChamado, setEnviandoChamado] = useState(false);

  // Modal Detalhes do Prato & Modificadores (Fase 4)
  const [pratoModal, setPratoModal] = useState(null);
  const [obsPrato, setObsPrato] = useState("");
  const [qtdPrato, setQtdPrato] = useState(1);
  const [pontoCarneModal, setPontoCarneModal] = useState("");
  const [modificadoresModal, setModificadoresModal] = useState([]);

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
        setCampanhas(json.campanhas || []);
      } catch {
        // Fallback resiliente caso haja indisponibilidade temporária de rede
        setUnidadeInfo({
          id: unidadeId || "seldeestrela",
          nome: "Seldeestrela Gastronomia & Brasa",
          aberta: true
        });
        setCategorias([
          "Entradas",
          "Peixes & Frutos do Mar",
          "Carnes & Brasa",
          "Pratos Principais",
          "Drinks & Coquetéis",
          "Bebidas",
          "Sobremesas"
        ]);
        setProdutos([
          {
            id: "prod-pirarucu",
            nome_produto: "Pirarucu Grelhado com Crosta de Castanha-do-Pará",
            categoria: "Peixes & Frutos do Mar",
            departamento: "cozinha",
            preco_venda: 89.0,
            imagem_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
            tempo_preparo_base: 22,
            descricao: "Lombo nobre de Pirarucu amazônico grelhado na brasa de angico, crosta crocante de castanhas e mousseline de mandioquinha defumada.",
            harmonizacao: "Vinho Branco Sauvignon Blanc ou Caipirinha de Cupuaçu",
            alergenicos: "Castanha-do-Pará (oleaginosas), Lactose",
            historia_gastronomica: "O Pirarucu é o gigante das águas amazônicas. Nossa preparação honra as tradições ribeirinhas com um toque contemporâneo da brasa viva.",
            destaque: true
          },
          {
            id: "prod-angus",
            nome_produto: "Costela Angus Braseada com Redução de Tucupi",
            categoria: "Carnes & Brasa",
            departamento: "cozinha",
            preco_venda: 114.0,
            imagem_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
            tempo_preparo_base: 25,
            descricao: "Corte nobre Angus cozido lentamente por 12 horas em baixa temperatura, glaceado com redução aveludada de tucupi negro e purê de cará.",
            harmonizacao: "Vinho Tinto Cabernet Sauvignon ou Cerveja Artesanal IPA",
            alergenicos: "Não contém glúten",
            historia_gastronomica: "Fusão da nobreza do gado Angus do Sul com os segredos ancestrais do tucupi fermentado da bacia amazônica.",
            destaque: true
          },
          {
            id: "prod-ceviche",
            nome_produto: "Ceviche Amazônico de Tambaqui & Jambu",
            categoria: "Entradas",
            departamento: "cozinha",
            preco_venda: 58.0,
            imagem_url: "https://images.unsplash.com/photo-1535400255456-984241443b29?auto=format&fit=crop&w=800&q=80",
            tempo_preparo_base: 12,
            descricao: "Cubos frescos de lombo de Tambaqui marinados em leite de tigre de tucupi amarelo, lâminas de cebola roxa e folhas frescas de jambu.",
            harmonizacao: "Espumante Brut ou Gin Tônica Cítrica",
            alergenicos: "Peixe fresco",
            historia_gastronomica: "O toque vibrante e elétrico do jambu desperta as papilas gustativas para uma experiência sensorial inesquecível.",
            destaque: true
          },
          {
            id: "prod-risoto",
            nome_produto: "Risoto de Cogumelos Nativos & Queijo Canastra",
            categoria: "Pratos Principais",
            departamento: "cozinha",
            preco_venda: 76.0,
            imagem_url: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=800&q=80",
            tempo_preparo_base: 20,
            descricao: "Arroz arbóreo preparado com mix de cogumelos frescos da estação, manteiga de garrafa e lascas generosas de queijo Canastra curado.",
            harmonizacao: "Vinho Tinto Pinot Noir",
            alergenicos: "Lactose, Derivados de leite",
            historia_gastronomica: "Conexão perfeita entre o terroir dos queijos artesanais brasileiros e o umami profundo dos cogumelos de cultivo regenerativo.",
            destaque: false
          },
          {
            id: "prod-caipirinha",
            nome_produto: "Caipirinha Autoral de Cupuaçu & Cachaça Envelhecida",
            categoria: "Drinks & Coquetéis",
            departamento: "bar",
            preco_venda: 36.0,
            imagem_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
            tempo_preparo_base: 6,
            descricao: "Polpa fresca de cupuaçu macerada com açúcar demerara orgânico, cachaça artesanal envelhecida em barril de umburana e gelo translúcido.",
            harmonizacao: "Perfeito com entradas leves e petiscos de brasa",
            alergenicos: "Contém álcool (18+)",
            historia_gastronomica: "O cupuaçu com sua acidez elegante equilibra com maestria as notas de baunilha da madeira umburana.",
            destaque: true
          },
          {
            id: "prod-suco",
            nome_produto: "Suco Natural de Graviola com Hortelã",
            categoria: "Bebidas",
            departamento: "bar",
            preco_venda: 18.0,
            imagem_url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80",
            tempo_preparo_base: 5,
            descricao: "Graviola natural batida com folhas frescas de hortelã fresca e gelo de água mineral.",
            harmonizacao: "Refrescante para qualquer momento da refeição",
            alergenicos: "Sem alérgenos",
            historia_gastronomica: "Fruta tropical aveludada, rica em antioxidantes e com frescor herbal instantâneo.",
            destaque: false
          },
          {
            id: "prod-pudim",
            nome_produto: "Pudim de Tapioca com Calda de Cumaru",
            categoria: "Sobremesas",
            departamento: "cozinha",
            preco_venda: 32.0,
            imagem_url: "https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?auto=format&fit=crop&w=800&q=80",
            tempo_preparo_base: 5,
            descricao: "Textura sedosa de pérolas de tapioca hidratadas em leite de coco artesanal, servido com calda morna perfumada com semente de cumaru.",
            harmonizacao: "Café Especial coado ou Vinho de Sobremesa",
            alergenicos: "Lactose, Coco",
            historia_gastronomica: "O cumaru é conhecido como a baunilha brasileira da floresta, trazendo um aroma inconfundível a esta clássica sobremesa.",
            destaque: true
          }
        ]);
        setCampanhas([
          {
            id: "camp-01",
            produto_id: "prod-pirarucu",
            produto_nome: "Pirarucu Grelhado com Crosta de Castanha",
            foto_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
            mensagem_ia: "Descubra o prato assinatura mais elogiado do Seldeestrela nesta noite!",
            local_exibicao: "abertura",
            prioridade: 10,
            objetivo: "destaque"
          }
        ]);
      } finally {
        setCarregando(false);
      }
    }
    carregarCardapio();

    // Carregar preferências e favoritos do localStorage de forma segura
    try {
      const prefSalvas = localStorage.getItem("hefisto_experience_pref");
      if (prefSalvas) setPreferencias(JSON.parse(prefSalvas));

      const favsSalvos = localStorage.getItem("hefisto_experience_favs");
      if (favsSalvos) setFavoritos(JSON.parse(favsSalvos));
    } catch {
      // Ignora erro de storage desabilitado
    }
  }, [unidadeId]);

  // Salvar preferências do cliente no localStorage (LGPD)
  const atualizarPreferencia = (chave, valor) => {
    setPreferencias(prev => {
      const novo = { ...prev, [chave]: valor };
      try {
        localStorage.setItem("hefisto_experience_pref", JSON.stringify(novo));
      } catch {}
      return novo;
    });
  };

  // Alternar favorito no localStorage
  const toggleFavorito = (produtoId, e) => {
    if (e) e.stopPropagation();
    setFavoritos(prev => {
      const existe = prev.includes(produtoId);
      const novo = existe ? prev.filter(id => id !== produtoId) : [...prev, produtoId];
      try {
        localStorage.setItem("hefisto_experience_favs", JSON.stringify(novo));
      } catch {}
      return novo;
    });
  };

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

  // Contagem de preferências ativas
  const totalPreferenciasAtivas = useMemo(() => {
    return Object.values(preferencias).filter(Boolean).length;
  }, [preferencias]);

  // Produtos Filtrados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      if (categoriaAtiva === "Favoritos") {
        if (!favoritos.includes(p.id)) return false;
      } else if (categoriaAtiva !== "Todos" && p.categoria !== categoriaAtiva) {
        return false;
      }

      if (busca) {
        const termo = busca.toLowerCase();
        const matchNome = p.nome_produto.toLowerCase().includes(termo);
        const matchDesc = p.descricao && p.descricao.toLowerCase().includes(termo);
        if (!matchNome && !matchDesc) return false;
      }

      return true;
    });
  }, [produtos, categoriaAtiva, busca, favoritos]);

  // Manipulação do Detalhe do Prato & Modificadores Rápidos (Fase 4)
  const abrirModalPrato = (p) => {
    setPratoModal(p);
    setQtdPrato(1);
    setObsPrato("");
    setPontoCarneModal("");
    setModificadoresModal([]);
  };

  const toggleModificador = (mod) => {
    setModificadoresModal(prev => {
      return prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod];
    });
  };

  const adicionarAoCarrinho = (p, qtd = 1, obsCustom = null) => {
    // Monta a observação estruturada combinando ponto da carne, modificadores selecionados e texto livre
    let obsFinal = "";
    if (obsCustom !== null) {
      obsFinal = obsCustom;
    } else {
      const partes = [];
      if (pontoCarneModal) partes.push(pontoCarneModal);
      if (modificadoresModal.length > 0) partes.push(modificadoresModal.join(", "));
      if (obsPrato.trim()) partes.push(obsPrato.trim());
      obsFinal = partes.join(" • ");
    }

    setCarrinho(prev => {
      const existenteIdx = prev.findIndex(item => item.id === p.id && item.observacao === obsFinal);
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
        observacao: obsFinal,
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

  // Sugestão de Upsell de Campanha IA no Carrinho (Fase 7b)
  const sugestaoCampanhaCarrinho = useMemo(() => {
    if (!campanhas || campanhas.length === 0) return null;
    const idsNoCarrinho = new Set(carrinho.map(it => String(it.id)));
    const campanhaAtiva = campanhas.find(c => {
      const ehFinalizacao = c.local_exibicao === "finalizacao" || c.local_exibicao === "ambos";
      return ehFinalizacao && !idsNoCarrinho.has(String(c.produto_id));
    });

    if (!campanhaAtiva) return null;
    const prod = produtos.find(p => String(p.id) === String(campanhaAtiva.produto_id));
    if (!prod) return null;

    return {
      campanha: campanhaAtiva,
      produto: prod
    };
  }, [campanhas, carrinho, produtos]);

  // Cálculos de Divisão de Conta (Fase 6)
  const calculoDivisao = useMemo(() => {
    const subtotal = comandaMesa?.total || 0;
    const pessoas = Math.max(1, Math.min(20, Number(dividirPessoas) || 1));
    const taxaServico = incluirServico ? centavos(subtotal * 0.10) : 0;
    const totalGeral = centavos(subtotal + taxaServico);
    const porPessoa = centavos(totalGeral / pessoas);

    return {
      subtotal,
      pessoas,
      taxaServico,
      totalGeral,
      porPessoa
    };
  }, [comandaMesa, dividirPessoas, incluirServico]);

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

  // Enviar Chamado de Garçom ou Conta Dividida
  const dispararChamado = async (tipo, observacaoExtra = null) => {
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
          tipo,
          observacao: observacaoExtra
        })
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.erro || "Falha ao solicitar atendimento.");
        return;
      }

      setModalChamado(false);
      setModalComanda(false);
      setAlertaSucesso(t.chamadoEnviado);
      setTimeout(() => setAlertaSucesso(null), 4000);
    } catch {
      alert("Falha de conexão ao chamar garçom.");
    } finally {
      setEnviandoChamado(false);
    }
  };

  // Verificador de compatibilidade com preferências do cliente
  const checarCompatibilidadePrato = (prato) => {
    const nome = (prato.nome_produto || "").toLowerCase();
    const desc = (prato.descricao || "").toLowerCase();
    const cat = (prato.categoria || "").toLowerCase();
    const alerg = (prato.alergenicos || "").toLowerCase();

    const ePeixe = cat.includes("peixe") || nome.includes("peixe") || nome.includes("pirarucu") || nome.includes("tambaqui") || desc.includes("peixe");
    const eCarne = cat.includes("carne") || nome.includes("carne") || nome.includes("picanha") || nome.includes("filé") || nome.includes("bife") || nome.includes("costela");
    const temLactose = desc.includes("queijo") || desc.includes("manteiga") || desc.includes("leite") || desc.includes("creme") || alerg.includes("lactose");
    const temGluten = desc.includes("farinha de trigo") || desc.includes("massa") || desc.includes("pão") || desc.includes("cerveja") || alerg.includes("glúten");

    let combina = false;
    let avisoAlergeno = null;

    if (preferencias.vegetariano) {
      if (eCarne || ePeixe) avisoAlergeno = "Contém proteína animal";
      else if (!eCarne && !ePeixe) combina = true;
    }

    if (preferencias.semLactose && temLactose) {
      avisoAlergeno = "Contém lactose";
    }

    if (preferencias.semGluten && temGluten) {
      avisoAlergeno = "Contém glúten";
    }

    if (preferencias.peixes && ePeixe) {
      combina = true;
    }

    return { combina, avisoAlergeno };
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
        <div className="fixed inset-x-4 z-50 flex items-center justify-center animate-bounce" style={{ top: "calc(var(--erp-safe-top, 0px) + 0.75rem)" }}>
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
      <header className="sticky top-0 z-30 bg-[#1c1613]/90 backdrop-blur-md border-b border-amber-900/20 px-4 pb-3" style={{ paddingTop: "calc(var(--erp-safe-top, 0px) + 0.75rem)" }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-md shadow-amber-950/40 text-amber-100 font-black text-lg overflow-hidden border border-amber-500/20">
              {unidadeInfo?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={unidadeInfo.logo_url} alt={unidadeInfo.nome || "Logo"} className="w-full h-full object-cover" />
              ) : (
                unidadeInfo?.nome?.slice(0, 1) || "H"
              )}
            </div>
            <div>
              <p className="text-3xs tracking-widest uppercase font-bold text-amber-400/80">{t.bemVindo}</p>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-amber-50 leading-tight">
                {unidadeInfo?.nome || "Seldeestrela"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Preferências do Cliente (LGPD) */}
            <button
              onClick={() => setModalPreferencias(true)}
              className={`p-2 rounded-xl border transition relative ${
                totalPreferenciasAtivas > 0
                  ? "bg-amber-600/20 border-amber-500/50 text-amber-300"
                  : "bg-[#251e1a] border-amber-900/30 text-amber-400/60 hover:text-amber-200"
              }`}
              title="Preferências Alimentares (LGPD)"
            >
              <SlidersHorizontal size={16} />
              {totalPreferenciasAtivas > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </button>

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
        <div className="relative mb-3">
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

        {/* Carrossel de Categorias & Favoritos */}
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

          {favoritos.length > 0 && (
            <button
              onClick={() => setCategoriaAtiva("Favoritos")}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shadow-sm flex items-center gap-1.5 ${
                categoriaAtiva === "Favoritos"
                  ? "bg-rose-600 text-white shadow-rose-950/40"
                  : "bg-[#211a16] text-rose-300/80 border border-rose-900/30 hover:bg-[#2b221d]"
              }`}
            >
              <Heart size={13} className="fill-current text-rose-400" />
              <span>{t.favoritos} ({favoritos.length})</span>
            </button>
          )}

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
            produtosFiltrados.map(prod => {
              const { combina, avisoAlergeno } = checarCompatibilidadePrato(prod);
              const eFavorito = favoritos.includes(prod.id);

              return (
                <div
                  key={prod.id}
                  onClick={() => abrirModalPrato(prod)}
                  className="bg-[#1b1512] border border-amber-900/25 rounded-3xl p-3.5 sm:p-4 hover:border-amber-700/50 transition-all cursor-pointer shadow-lg shadow-black/20 flex gap-3.5 sm:gap-4 group active:scale-[0.99] relative"
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

                    {/* Botão de Favorito no Canto Superior da Foto */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorito(prod.id, e)}
                      className={`absolute top-1.5 right-1.5 p-1 rounded-lg backdrop-blur-md transition ${
                        eFavorito
                          ? "bg-rose-950/80 text-rose-400"
                          : "bg-black/40 text-amber-200/60 hover:text-white"
                      }`}
                      title="Salvar como Favorito"
                    >
                      <Heart size={14} className={eFavorito ? "fill-current" : ""} />
                    </button>

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

                      {/* Badges de CRM / Preferências do Cliente */}
                      {(combina || avisoAlergeno) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {combina && (
                            <span className="inline-flex items-center gap-1 text-3xs px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-700/40 text-emerald-300 font-bold">
                              <Sparkles size={10} /> {t.combinaComVc}
                            </span>
                          )}
                          {avisoAlergeno && (
                            <span className="inline-flex items-center gap-1 text-3xs px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-600/40 text-amber-300 font-bold">
                              <ShieldAlert size={10} className="text-amber-400" /> {avisoAlergeno}
                            </span>
                          )}
                        </div>
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
              );
            })
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

      {/* MODAL DETALHES / MODIFICADORES DO PRATO (Fase 4) */}
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
                <span className="text-xl font-black text-amber-400 font-mono">
                  {fmtMoeda(pratoModal.preco_venda)}
                </span>
              </div>

              {pratoModal.descricao && (
                <p className="text-sm text-amber-200/80 leading-relaxed">
                  {pratoModal.descricao}
                </p>
              )}

              {/* Informações de Alergênicos Conhecidos */}
              {pratoModal.alergenicos && (
                <div className="bg-amber-950/30 border border-amber-800/30 p-2.5 rounded-2xl flex items-center gap-2 text-xs text-amber-300">
                  <ShieldAlert size={16} className="text-amber-400 shrink-0" />
                  <span><strong>Alergênicos conhecidos:</strong> {pratoModal.alergenicos}</span>
                </div>
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

              {/* MODIFICADORES INTELIGENTES (Fase 4) */}
              {/* Opções de Ponto da Carne se for prato de carne */}
              {(pratoModal.categoria?.toLowerCase().includes("carne") ||
                pratoModal.nome_produto?.toLowerCase().includes("picanha") ||
                pratoModal.nome_produto?.toLowerCase().includes("filé") ||
                pratoModal.nome_produto?.toLowerCase().includes("hambúrguer")) && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Flame size={14} className="text-orange-400" />
                    <span>{t.pontoCarne}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Mal passada", "Ao ponto", "Bem passada"].map(ponto => (
                      <button
                        key={ponto}
                        type="button"
                        onClick={() => setPontoCarneModal(prev => prev === ponto ? "" : ponto)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border ${
                          pontoCarneModal === ponto
                            ? "bg-amber-600 text-white border-amber-500 shadow-sm"
                            : "bg-[#14100e] text-amber-200/80 border-amber-900/30 hover:border-amber-700/50"
                        }`}
                      >
                        {ponto}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Opções de Bebidas/Drinks se for departamento bar */}
              {pratoModal.departamento === "bar" && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Wine size={14} className="text-rose-400" />
                    <span>{t.estiloBebida}</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["Com gelo e limão", "Sem gelo", "Gelo à parte", "Sem açúcar", "Com adoçante"].map(mod => {
                      const sel = modificadoresModal.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => toggleModificador(mod)}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition border ${
                            sel
                              ? "bg-amber-600 text-white border-amber-500 shadow-sm"
                              : "bg-[#14100e] text-amber-200/80 border-amber-900/30 hover:border-amber-700/50"
                          }`}
                        >
                          {mod}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modificadores de Cozinha Frequentes */}
              {pratoModal.departamento !== "bar" && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-amber-300 block">
                    {t.personalizacaoRapida}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["Sem cebola", "Sem pimenta", "Sem coentro", "Sem alho", "Molho à parte"].map(mod => {
                      const sel = modificadoresModal.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => toggleModificador(mod)}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition border ${
                            sel
                              ? "bg-amber-600 text-white border-amber-500 shadow-sm"
                              : "bg-[#14100e] text-amber-200/80 border-amber-900/30 hover:border-amber-700/50"
                          }`}
                        >
                          {mod}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações Livres */}
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
                  onClick={() => adicionarAoCarrinho(pratoModal, qtdPrato)}
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

      {/* MODAL DO CARRINHO / ENVIAR PEDIDO COM UPSELL IA (Fase 7b) */}
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
                <>
                  {carrinho.map((it, idx) => (
                    <div key={idx} className="bg-[#14100e] border border-amber-900/20 rounded-2xl p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-amber-100 truncate">{it.nome_produto}</h4>
                        {it.observacao && (
                          <p className="text-3xs text-amber-400/80 italic mt-0.5 font-medium">Obs: {it.observacao}</p>
                        )}
                        <p className="text-xs font-black text-amber-400 mt-1 font-mono">
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
                  ))}

                  {/* UPSELL INTELIGENTE DE CAMPANHA IA (Fase 7b) */}
                  {sugestaoCampanhaCarrinho && (
                    <div className="bg-gradient-to-r from-amber-950/70 via-[#271d17] to-[#1c1511] border border-amber-600/45 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md mt-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-[#1b1512] overflow-hidden shrink-0 border border-amber-800/40">
                          {sugestaoCampanhaCarrinho.produto.imagem_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sugestaoCampanhaCarrinho.produto.imagem_url}
                              alt={sugestaoCampanhaCarrinho.produto.nome_produto}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-amber-500">
                              <Sparkles size={18} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-3xs uppercase tracking-wider font-black text-amber-400 flex items-center gap-1">
                            <Sparkles size={10} className="animate-pulse" /> {t.sugestaoChef}
                          </span>
                          <h4 className="text-xs font-bold text-amber-100 truncate">
                            {sugestaoCampanhaCarrinho.produto.nome_produto}
                          </h4>
                          <p className="text-3xs text-amber-300/80 line-clamp-1">
                            {sugestaoCampanhaCarrinho.campanha.mensagem_ia}
                          </p>
                          <span className="text-xs font-black text-amber-400 font-mono">
                            {fmtMoeda(sugestaoCampanhaCarrinho.produto.preco_venda)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => adicionarAoCarrinho(sugestaoCampanhaCarrinho.produto, 1, "Sugestão da Casa")}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shrink-0 transition active:scale-95 flex items-center gap-1 shadow-md shadow-amber-950/40"
                      >
                        <Plus size={14} />
                        <span>Adicionar</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {carrinho.length > 0 && (
              <div className="p-4 border-t border-amber-900/25 bg-[#221a16] space-y-3">
                <div className="flex justify-between items-center text-sm font-bold text-amber-200">
                  <span>{t.subtotal}</span>
                  <span className="text-lg font-black text-amber-400 font-mono">{fmtMoeda(totalCarrinho)}</span>
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

      {/* MODAL MINHA MESA / COMANDA & DIVIDIR CONTA (Fase 6) */}
      {modalComanda && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1b1512] border border-amber-900/40 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-amber-900/25 flex items-center justify-between bg-[#221a16]">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-amber-400" />
                <h2 className="text-lg font-black text-amber-50">{t.minhaMesa} — {t.mesa} {mesa}</h2>
              </div>
              <button onClick={() => setModalComanda(false)} className="p-2 text-amber-300 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {carregandoComanda ? (
                <div className="py-12 text-center text-amber-300/50 font-bold">Atualizando comanda...</div>
              ) : !comandaMesa || comandaMesa.itens.length === 0 ? (
                <div className="py-12 text-center text-amber-300/40">
                  <Receipt size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="font-bold text-sm">{t.comandaVazia}</p>
                  <p className="text-xs text-amber-400/50 mt-1">{t.comandaSub}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {comandaMesa.itens.map((it, idx) => (
                      <div key={idx} className="bg-[#14100e] border border-amber-900/20 rounded-2xl p-3 flex justify-between items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-400 text-sm">{it.quantidade}x</span>
                            <h4 className="font-bold text-sm text-amber-100 truncate">{it.nome}</h4>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-3xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-300 border border-amber-800/30">
                              {t.statusKds[it.status_kds] || it.status_kds}
                            </span>
                            {it.hora && <span className="text-3xs text-amber-500/60 font-mono">{it.hora}</span>}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
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
                              className="flex items-center gap-1.5 text-3xs font-bold text-amber-400 hover:text-amber-200 transition"
                            >
                              <BookOpen size={12} />
                              <span>Descubra a história ✨</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const prodRel = produtos.find(p => String(p.id) === String(it.produto_id) || p.nome_produto === it.nome) || {
                                  id: it.produto_id || idx,
                                  nome_produto: it.nome,
                                  preco_venda: it.subtotal / (it.quantidade || 1)
                                };
                                adicionarAoCarrinho(prodRel, 1, it.observacao || "");
                                setAlertaSucesso(`+1x ${it.nome} adicionado ao seu pedido!`);
                                setTimeout(() => setAlertaSucesso(null), 3000);
                              }}
                              className="flex items-center gap-1 text-3xs font-bold text-emerald-400 hover:text-emerald-200 transition bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg active:scale-95"
                              title="Pedir mais uma unidade deste item"
                            >
                              <RotateCcw size={11} />
                              <span>{t.repetirPedido}</span>
                            </button>
                          </div>
                        </div>
                        <span className="font-black text-sm text-amber-300 font-mono">{fmtMoeda(it.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  {/* CALCULADORA DE DIVISÃO DE CONTA (Fase 6) */}
                  <div className="bg-gradient-to-b from-[#201814] to-[#17110e] border border-amber-700/40 rounded-3xl p-4 space-y-3.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={18} className="text-amber-400" />
                        <h3 className="text-sm font-black text-amber-50">{t.dividirConta}</h3>
                      </div>
                      
                      {/* Seletor de Pessoas */}
                      <div className="flex items-center gap-2 bg-[#120e0c] border border-amber-900/40 rounded-xl p-1">
                        <button
                          onClick={() => setDividirPessoas(Math.max(1, dividirPessoas - 1))}
                          className="w-7 h-7 rounded-lg bg-amber-900/30 text-amber-200 flex items-center justify-center font-bold hover:bg-amber-800/40"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-black text-sm w-7 text-center text-amber-100 font-mono">
                          {dividirPessoas}
                        </span>
                        <button
                          onClick={() => setDividirPessoas(Math.min(20, dividirPessoas + 1))}
                          className="w-7 h-7 rounded-lg bg-amber-900/30 text-amber-200 flex items-center justify-center font-bold hover:bg-amber-800/40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Toggle de Serviço Sugerido (10%) */}
                    <label className="flex items-center justify-between text-xs text-amber-200/90 cursor-pointer pt-1 border-t border-amber-900/20">
                      <span>{t.taxaServico}</span>
                      <input
                        type="checkbox"
                        checked={incluirServico}
                        onChange={(e) => setIncluirServico(e.target.checked)}
                        className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                      />
                    </label>

                    {/* Resumo Financeiro da Divisão */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-amber-900/20">
                      <div>
                        <span className="text-3xs text-amber-400/70 block">Total da Mesa</span>
                        <span className="font-black text-amber-200 font-mono">{fmtMoeda(calculoDivisao.totalGeral)}</span>
                      </div>
                      <div className="text-right bg-amber-950/40 border border-amber-700/40 rounded-xl p-2">
                        <span className="text-3xs text-amber-300 font-bold block">{t.valorPorPessoa}</span>
                        <span className="text-base font-black text-amber-400 font-mono">
                          {fmtMoeda(calculoDivisao.porPessoa)}
                        </span>
                      </div>
                    </div>

                    {/* Botão de Solicitar Fechamento com Garçom */}
                    <button
                      onClick={() => {
                        const obsConta = `Mesa ${mesa}: Dividir em ${calculoDivisao.pessoas} pessoas (${fmtMoeda(calculoDivisao.porPessoa)} cada)${incluirServico ? ' com 10%' : ' sem 10%'}`;
                        dispararChamado("conta", obsConta);
                      }}
                      disabled={enviandoChamado}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-950/40 transition active:scale-98 flex items-center justify-center gap-2 text-xs"
                    >
                      <Receipt size={16} />
                      <span>{t.solicitarContaDividida}</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {comandaMesa && comandaMesa.itens.length > 0 && (
              <div className="p-4 border-t border-amber-900/25 bg-[#221a16] flex justify-between items-center">
                <span className="text-sm font-bold text-amber-200">{t.totalConsumo}</span>
                <span className="text-xl font-black text-amber-400 font-mono">{fmtMoeda(comandaMesa.total)}</span>
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

      {/* MODAL CRM LOCAL & PREFERÊNCIAS (Fase 8 - LGPD) */}
      {modalPreferencias && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1c1613] border border-amber-800/40 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-900/30 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={20} className="text-amber-400" />
                <h3 className="text-base font-black text-amber-50">{t.preferencias}</h3>
              </div>
              <button onClick={() => setModalPreferencias(false)} className="p-1 text-amber-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-amber-200/70 leading-relaxed">
              {t.preferenciasDesc}
            </p>

            <div className="space-y-2.5 pt-1">
              {[
                { chave: "vegetariano", rotulo: "🌿 Vegetariano", desc: "Priorizar receitas sem carne ou peixe" },
                { chave: "semLactose", rotulo: "🚫 Sem Lactose", desc: "Destacar pratos livres de derivados do leite" },
                { chave: "semGluten", rotulo: "🌾 Sem Glúten", desc: "Alertar ingredientes com farinha e trigo" },
                { chave: "peixes", rotulo: "🐟 Foco em Peixes Amazônicos", desc: "Destacar Pirarucu, Tambaqui e pescados" }
              ].map(opt => {
                const ativo = Boolean(preferencias[opt.chave]);
                return (
                  <button
                    key={opt.chave}
                    type="button"
                    onClick={() => atualizarPreferencia(opt.chave, !ativo)}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      ativo
                        ? "bg-amber-600/20 border-amber-500/60 text-amber-100"
                        : "bg-[#14100e] border-amber-900/30 text-amber-300/60 hover:border-amber-700/40"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block text-amber-100">{opt.rotulo}</span>
                      <span className="text-3xs text-amber-300/60 block">{opt.desc}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                      ativo ? "bg-amber-600 border-amber-500 text-white" : "border-amber-800/40 bg-black/20"
                    }`}>
                      {ativo && <Check size={13} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setModalPreferencias(false)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-900/40 transition active:scale-95 text-xs"
            >
              {t.salvarPreferencias}
            </button>
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
