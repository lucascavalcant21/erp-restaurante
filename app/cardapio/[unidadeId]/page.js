"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { enviarPedidoOnline } from "../../lib/vendas";
import {
  UtensilsCrossed,
  ArrowDown,
  ShoppingBag,
  X,
  CheckCircle,
  CheckCircle2,
  Info,
  Plus,
  Minus,
  Send,
  Star,
  Clock,
  Users,
  Sparkles,
  Wine,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  ShieldAlert,
  SlidersHorizontal,
  Calendar
} from "lucide-react";
import { fmtBRL } from "../../components/ui";
import { mascaraTelefone } from "../../lib/mascaras.mjs";
import {
  BANNERS_CARROSSEL,
  SUGESTOES_DO_DIA,
  gerarBoasVindasInteligentes,
  CARDAPIO_DIGITAL_DEMO,
  fetchCardapioConfig,
  finalizarPedidoDelivery
} from "../../lib/delivery";

export default function CardapioPublicoPage() {
  const { unidadeId } = useParams();
  const [configLoja, setConfigLoja] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [unidadeNome, setUnidadeNome] = useState("Carregando...");
  const [taxaEntrega, setTaxaEntrega] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtros & Busca
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");
  const [humorAtivo, setHumorAtivo] = useState("todos");
  const [termoBusca, setTermoBusca] = useState("");

  // Assistente de Boas-Vindas & Alergias
  const [modalEntrada, setModalEntrada] = useState(true);
  const [etapaAssistente, setEtapaAssistente] = useState("escolha_modo");
  const [alergiasSelecionadas, setAlergiasSelecionadas] = useState([]);
  const [apetiteSelecionado, setApetiteSelecionado] = useState(null);
  const [assistenteAtivo, setAssistenteAtivo] = useState(false);

  // Carrossel
  const [bannerAtual, setBannerAtual] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Modal Customização iFood & Ficha de Alérgenos
  const [pratoModal, setPratoModal] = useState(null);
  const [modalAlergicosDetalhado, setModalAlergicosDetalhado] = useState(null);
  const [pontoEscolhido, setPontoEscolhido] = useState("");
  const [acompanhamentosEscolhidos, setAcompanhamentosEscolhidos] = useState([]);
  const [adicionaisEscolhidos, setAdicionaisEscolhidos] = useState([]);
  const [remocoesEscolhidas, setRemocoesEscolhidas] = useState([]);
  const [observacaoCliente, setObservacaoCliente] = useState("");
  const [qtdModal, setQtdModal] = useState(1);

  // Envio Direto para Cozinha
  const [modalConfirmacaoCozinha, setModalConfirmacaoCozinha] = useState(false);
  const [dadosClienteRapido, setDadosClienteRapido] = useState({ nome: "", mesa: "" });
  const [pedidoEnviadoSucesso, setPedidoEnviadoSucesso] = useState(false);
  const [enviandoCozinha, setEnviandoCozinha] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState(null);

  // CARRINHO & CHECKOUT
  const [carrinho, setCarrinho] = useState([]);
  const [modalCart, setModalCart] = useState(false);
  const [telaCheckout, setTelaCheckout] = useState(false);

  // URL / MESA
  const [mesaUrl, setMesaUrl] = useState(null);

  const infoBoasVindas = useMemo(() => {
    return gerarBoasVindasInteligentes(configLoja?.nome_restaurante || unidadeNome || "Restaurante");
  }, [unidadeNome, configLoja]);

  useEffect(() => {
    const config = fetchCardapioConfig(unidadeId);
    setConfigLoja(config);

    const params = new URLSearchParams(window.location.search);
    const m = params.get("mesa");
    if (m) {
      setMesaUrl(m);
      setDadosClienteRapido((d) => ({ ...d, mesa: m }));
    }

    try {
      const jaRespondeu = sessionStorage.getItem(`hefisto_assistente_cardapio_${unidadeId}`);
      if (jaRespondeu) {
        setModalEntrada(false);
      }
    } catch (e) {}
  }, [unidadeId]);

  useEffect(() => {
    async function carregarCardapio() {
      setLoading(true);
      try {
        const r = await fetch(`/api/public/cardapio/${encodeURIComponent(unidadeId)}`, { cache: "no-store" });
        const json = r.ok ? await r.json() : null;
        if (json?.unidade) {
          setUnidadeNome(json.unidade.nome || "Sel de Estrela Gastronomia");
          setTaxaEntrega(Number(json.unidade.taxa_entrega) || 0);
        } else {
          setUnidadeNome("Sel de Estrela Gastronomia");
        }

        const baseCatalogo = CARDAPIO_DIGITAL_DEMO;
        const listaFinal = (json?.produtos && json.produtos.length > 0) ? json.produtos : baseCatalogo;

        const normalizados = listaFinal.map((p) => {
          const demoRef = baseCatalogo.find((d) => (d.nome || d.nome_produto)?.toLowerCase() === (p.nome_produto || p.nome || "").toLowerCase());
          return {
            id: p.id,
            nome_produto: p.nome_produto || p.nome,
            preco_venda: Number(p.preco_venda || p.preco) || 0,
            categoria: p.categoria || "Geral",
            descricao: p.descricao || demoRef?.descricao || "Receita autoral preparada com ingredientes frescos da estação.",
            imagem_url: p.imagem_url || demoRef?.imagem_url || "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
            porcao: p.porcao || demoRef?.porcao || "Serve 1 a 2 pessoas • 500g",
            tempo_preparo: p.tempo_preparo || demoRef?.tempo_preparo || "20-25 min",
            avaliacao: p.avaliacao || demoRef?.avaliacao || 4.9,
            tags: p.tags || demoRef?.tags || ["🔥 Mais Pedido"],
            pimenta: p.pimenta || demoRef?.pimenta || "Sem Pimenta",
            nivelPimenta: p.nivelPimenta ?? demoRef?.nivelPimenta ?? 0,
            camarao: Boolean(p.camarao ?? demoRef?.camarao),
            gluten: Boolean(p.gluten ?? demoRef?.gluten),
            lactose: Boolean(p.lactose ?? demoRef?.lactose),
            alergenicos: p.alergenicos || demoRef?.alergenicos || null,
            infoNutricional: p.infoNutricional || demoRef?.infoNutricional || null,
            opcoes_customizacao: p.opcoes_customizacao || demoRef?.opcoes_customizacao || null,
          };
        });

        setProdutos(normalizados);
      } catch {
        setUnidadeNome("Sel de Estrela Gastronomia");
        const normalizados = CARDAPIO_DIGITAL_DEMO.map((d) => ({
          id: d.id,
          nome_produto: d.nome,
          preco_venda: d.preco,
          categoria: d.categoria,
          descricao: d.descricao,
          imagem_url: d.imagem_url,
          porcao: d.porcao,
          tempo_preparo: d.tempo_preparo,
          avaliacao: d.avaliacao,
          tags: d.tags,
          pimenta: d.pimenta,
          nivelPimenta: d.nivelPimenta,
          camarao: d.camarao,
          gluten: d.gluten,
          lactose: d.lactose,
          alergenicos: d.alergenicos,
          infoNutricional: d.infoNutricional,
          opcoes_customizacao: d.opcoes_customizacao,
        }));
        setProdutos(normalizados);
      }
      setLoading(false);
    }
    carregarCardapio();
  }, [unidadeId]);

  // Autoplay Carrossel
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

  const aplicarAssistentePersonalizado = () => {
    setAssistenteAtivo(true);
    setModalEntrada(false);
    try {
      sessionStorage.setItem(`hefisto_assistente_cardapio_${unidadeId}`, "true");
    } catch (e) {}
    mostrarToast("✨ Cardápio personalizado com base em suas escolhas e restrições!");
  };

  const pularAssistente = () => {
    setAssistenteAtivo(false);
    setAlergiasSelecionadas([]);
    setApetiteSelecionado(null);
    setModalEntrada(false);
    try {
      sessionStorage.setItem(`hefisto_assistente_cardapio_${unidadeId}`, "true");
    } catch (e) {}
  };

  const toggleAlergia = (alergiaId) => {
    if (alergiasSelecionadas.includes(alergiaId)) {
      setAlergiasSelecionadas(alergiasSelecionadas.filter((a) => a !== alergiaId));
    } else {
      setAlergiasSelecionadas([...alergiasSelecionadas, alergiaId]);
    }
  };

  const abrirModalCustomizacao = (p) => {
    setPratoModal(p);
    setPontoEscolhido(p.opcoes_customizacao?.ponto_carne?.[0] || "");
    setAcompanhamentosEscolhidos([]);
    setAdicionaisEscolhidos([]);
    setRemocoesEscolhidas([]);
    setObservacaoCliente("");
    setQtdModal(1);
  };

  const precoTotalUnitarioModal = useMemo(() => {
    if (!pratoModal) return 0;
    const base = Number(pratoModal.preco_venda) || 0;
    const adicionais = adicionaisEscolhidos.reduce((acc, a) => acc + (Number(a.preco) || 0), 0);
    return base + adicionais;
  }, [pratoModal, adicionaisEscolhidos]);

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

  const confirmarAdicaoModal = () => {
    if (!pratoModal) return;

    const detalhes = [];
    if (pontoEscolhido) detalhes.push(`Ponto: ${pontoEscolhido}`);
    if (acompanhamentosEscolhidos.length) detalhes.push(`Acomp: ${acompanhamentosEscolhidos.join(", ")}`);
    if (adicionaisEscolhidos.length) detalhes.push(`+Adic: ${adicionaisEscolhidos.map((a) => a.nome).join(", ")}`);
    if (remocoesEscolhidas.length) detalhes.push(`Sem: ${remocoesEscolhidas.join(", ")}`);
    if (observacaoCliente.trim()) detalhes.push(`Obs: ${observacaoCliente.trim()}`);

    const itemFormatado = {
      id: pratoModal.id,
      nome_produto: pratoModal.nome_produto,
      preco_venda: precoTotalUnitarioModal,
      quantidade: qtdModal,
      observacao: detalhes.join(" | "),
    };

    setCarrinho((atual) => [...atual, itemFormatado]);
    setPratoModal(null);
    mostrarToast(`✓ ${qtdModal}x ${pratoModal.nome_produto} adicionado à comanda!`);
  };

  const pedirComboDoDia = (combo) => {
    const itemCombo = {
      id: combo.pratoPrincipal.id || "prod-angus",
      nome_produto: `${combo.titulo} (${combo.pratoPrincipal.nome} + ${combo.bebida.nome})`,
      preco_venda: combo.precoCombo,
      quantidade: 1,
      observacao: `Combo Especial Harmonizado • Economia de R$ ${combo.economia.toFixed(2)}`,
    };

    setCarrinho((atual) => [...atual, itemCombo]);
    mostrarToast(`✓ Combo do Chef adicionado com economia de R$ ${combo.economia.toFixed(2)}!`);
  };

  // Enviar Pedido Direto para a Cozinha KDS
  const dispararPedidoParaCozinha = async () => {
    if (!dadosClienteRapido.nome) {
      alert("Por favor, digite seu nome ou número da mesa.");
      return;
    }
    setEnviandoCozinha(true);

    const payload = {
      nome: dadosClienteRapido.nome,
      mesa: dadosClienteRapido.mesa || mesaUrl || "Mesa do Salão",
      endereco: mesaUrl ? `Mesa ${mesaUrl}` : "Atendimento Presencial",
      formaPagamento: "Mesa / Balcão",
      total: totalCarrinho,
      taxaEntrega: 0,
    };

    const res = await finalizarPedidoDelivery(payload, carrinho, unidadeId);
    setEnviandoCozinha(false);

    if (res.ok) {
      setCarrinho([]);
      setModalConfirmacaoCozinha(false);
      setPedidoEnviadoSucesso(true);
    } else {
      alert("Erro ao enviar pedido para a cozinha: " + res.error);
    }
  };

  const alterarQtd = (idx, delta) => {
    setCarrinho((atual) => {
      const novo = [...atual];
      novo[idx].quantidade += delta;
      return novo.filter((i) => i.quantidade > 0);
    });
  };

  const totalCarrinho = carrinho.reduce((acc, it) => acc + (it.preco_venda * it.quantidade), 0);
  const totalItensQtd = carrinho.reduce((acc, it) => acc + it.quantidade, 0);

  const categoriasRaw = useMemo(() => {
    const cats = Array.from(new Set(produtos.map((p) => p.categoria || "Geral")));
    return ["Todas", ...cats];
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    let res = [...produtos];

    // Alergias
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
        res = res.filter((p) => p.nivelPimenta === 0);
      }
      if (alergiasSelecionadas.includes("vegetariano")) {
        res = res.filter((p) => p.tags?.some((t) => t.toLowerCase().includes("vegetariano")));
      }
    }

    // Paladar
    if (apetiteSelecionado) {
      if (apetiteSelecionado === "brasa") {
        res = res.filter((p) => p.categoria?.toLowerCase().includes("brasa") || p.nome_produto?.toLowerCase().includes("picanha") || p.nome_produto?.toLowerCase().includes("angus"));
      } else if (apetiteSelecionado === "peixes") {
        res = res.filter((p) => p.categoria?.toLowerCase().includes("peixe"));
      } else if (apetiteSelecionado === "rapida") {
        res = res.filter((p) => p.tempo_preparo && (p.tempo_preparo.includes("5") || p.tempo_preparo.includes("10") || p.tempo_preparo.includes("15")));
      } else if (apetiteSelecionado === "leves") {
        res = res.filter((p) => p.gluten === false || p.tags?.some((t) => t.toLowerCase().includes("leve")));
      } else if (apetiteSelecionado === "compartilhar") {
        res = res.filter((p) => p.porcao?.includes("2"));
      }
    }

    // Categorias
    if (categoriaAtiva !== "Todas") {
      res = res.filter((p) => p.categoria === categoriaAtiva);
    }

    // Busca
    if (termoBusca.trim()) {
      const q = termoBusca.toLowerCase().trim();
      res = res.filter(
        (p) =>
          p.nome_produto.toLowerCase().includes(q) ||
          (p.descricao && p.descricao.toLowerCase().includes(q)) ||
          (p.categoria && p.categoria.toLowerCase().includes(q)) ||
          (p.alergenicos && p.alergenicos.toLowerCase().includes(q))
      );
    }

    return res;
  }, [produtos, categoriaAtiva, termoBusca, alergiasSelecionadas, apetiteSelecionado]);

  const comboPrincipal = SUGESTOES_DO_DIA[0];
  const corFundo = configLoja?.cor_fundo || "#0b0f17";

  if (pedidoEnviadoSucesso) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 animate-bounce border-2 border-emerald-500/40">
          <CheckCircle2 size={56} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tighter">
          Pedido Enviado Direto para a Cozinha! 🔥
        </h1>
        <p className="text-slate-300 font-medium mb-8 max-w-md text-sm leading-relaxed">
          {mesaUrl ? `Sua comanda da Mesa ${mesaUrl} foi gerada e enviada para o KDS do chef.` : "Sua comanda foi gerada e enviada para o KDS do chef."}
        </p>
        <button
          onClick={() => {
            setPedidoEnviadoSucesso(false);
            setModalCart(false);
          }}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl active:scale-95 transition-all shadow-xl"
        >
          Fazer Novo Pedido
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

      {/* MODAL DE BOAS-VINDAS & PERGUNTAS INICIAIS AO CLIENTE */}
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
                    Bem-vindo ao <strong>{configLoja?.nome_restaurante || unidadeNome}</strong>. Como você prefere explorar nosso cardápio hoje?
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
                    <SlidersHorizontal size={18} /> Personalização do Cardápio
                  </h3>
                  <button
                    onClick={() => setEtapaAssistente("escolha_modo")}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Voltar
                  </button>
                </div>

                <div className="space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
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

      {/* HEADER TOP DA UNIDADE (SEM "COZINHA ABERTA") */}
      <div className="bg-slate-950/70 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black capitalize tracking-tight flex items-center gap-2">
                {configLoja?.nome_restaurante || unidadeNome}
                {mesaUrl && (
                  <span className="text-3xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase">
                    Mesa {mesaUrl}
                  </span>
                )}
              </h1>
              
              <p className="text-xs text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-400 shrink-0" />
                <span>{configLoja?.horarios_funcionamento || "11h30 às 15h30 • 18h30 às 23h30"}</span>
              </p>
            </div>

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
                <span className="text-xs font-bold text-amber-200">Harmonização Especial do Chef</span>
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
            placeholder="Pesquisar prato, peixe, camarão, sem glúten, carne..."
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
              const qtd = cat === "Todas" ? produtos.length : produtos.filter((p) => p.categoria === cat).length;
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

      {/* VITRINE DE PRATOS COM INFORMAÇÕES DE ALERGIA, TEMPO E PIMENTA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            {categoriaAtiva === "Todas" ? "Cardápio do Salão" : categoriaAtiva}
            <span className="text-xs font-bold text-slate-400">({produtosFiltrados.length} pratos)</span>
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-bold animate-pulse">
            Carregando pratos do cardápio...
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="bg-slate-900/60 rounded-3xl p-12 text-center border border-slate-800 shadow-sm">
            <UtensilsCrossed size={40} className="mx-auto text-slate-600 mb-3" />
            <h3 className="font-black text-white text-base">Nenhum prato encontrado com esses filtros</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Tente redefinir as restrições alimentares ou buscar por outro termo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {produtosFiltrados.map((prato) => (
              <div
                key={prato.id}
                onClick={() => abrirModalCustomizacao(prato)}
                className="bg-slate-900/80 rounded-3xl p-4 border border-slate-800 hover:border-slate-700 shadow-md hover:shadow-xl transition-all cursor-pointer flex gap-3.5 group relative overflow-hidden"
              >
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
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
                      {prato.nome_produto}
                    </h3>

                    <p className="text-xs text-slate-400 font-medium line-clamp-2 mt-1 leading-relaxed">
                      {prato.descricao}
                    </p>

                    {/* METADADOS DIDÁTICOS DE SAÚDE, PIMENTA E ALERGIA */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5 text-3xs font-bold">
                      {prato.tempo_preparo && (
                        <span className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                          <Clock size={11} className="text-amber-400" /> {prato.tempo_preparo}
                        </span>
                      )}

                      {prato.nivelPimenta > 0 ? (
                        <span className="flex items-center gap-1 bg-red-950/40 text-red-300 border border-red-800/40 px-2 py-0.5 rounded-md">
                          🌶️ {prato.pimenta || "Apimentado"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-md">
                          Sem pimenta
                        </span>
                      )}

                      {prato.camarao && (
                        <span className="flex items-center gap-1 bg-amber-950/60 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-md font-black animate-pulse">
                          🦐 Contém Camarão
                        </span>
                      )}

                      {prato.gluten === false && (
                        <span className="flex items-center gap-1 bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                          Sem Glúten ✓
                        </span>
                      )}

                      {prato.lactose === false && (
                        <span className="flex items-center gap-1 bg-teal-950/40 text-teal-300 border border-teal-800/40 px-2 py-0.5 rounded-md">
                          Sem Lactose ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preço e Botão Didático */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-base font-black text-amber-400">
                      {fmtBRL(prato.preco_venda)}
                    </span>

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

                <div className="relative shrink-0 flex flex-col items-center justify-between">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-inner bg-slate-800 border border-slate-800">
                    <img
                      src={prato.imagem_url}
                      alt={prato.nome_produto}
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
            ))}
          </div>
        )}
      </div>

      {/* MODAL DETALHADO DE ALERGÊNICOS */}
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
              <h3 className="font-black text-base text-white">{modalAlergicosDetalhado.nome_produto}</h3>
              <p className="text-xs text-slate-400 mt-1">{modalAlergicosDetalhado.descricao}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">🦐 Camarão / Frutos do Mar:</span>
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
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">🌶️ Nível de Pimenta:</span>
                <span className="font-bold text-slate-200">
                  {modalAlergicosDetalhado.pimenta || "Sem pimenta"}
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

      {/* MODAL DE CUSTOMIZAÇÃO DO PRATO ESTILO IFOOD */}
      {pratoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white w-full max-w-xl max-h-[92vh] sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-800 animate-in slide-in-from-bottom duration-300">
            <div className="relative h-48 sm:h-56 w-full bg-slate-950 shrink-0">
              <img
                src={pratoModal.imagem_url}
                alt={pratoModal.nome_produto}
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
                  {pratoModal.nome_produto}
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

              {/* Acompanhamentos */}
              {pratoModal.opcoes_customizacao?.acompanhamentos && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="font-black text-sm text-white">Acompanhamentos Inclusos</h4>
                      <p className="text-3xs text-slate-400 font-bold">Escolha até 2 opções</p>
                    </div>
                    <span className="text-xs font-black text-slate-200 bg-slate-800 px-2.5 py-1 rounded-full">
                      {acompanhamentosEscolhidos.length} / 2
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pratoModal.opcoes_customizacao.acompanhamentos.map((acomp) => {
                      const selecionado = acompanhamentosEscolhidos.includes(acomp);
                      return (
                        <div
                          key={acomp}
                          onClick={() => toggleAcompanhamento(acomp, 2)}
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

              {/* Adicionais */}
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
                            <p className="text-3xs font-black text-purple-400">+ R$ {Number(adic.preco).toFixed(2).replace(".", ",")}</p>
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

              <div>
                <label className="text-xs font-black uppercase text-slate-400 block mb-1">
                  Observações para a Cozinha
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
                <span>Adicionar ao Pedido</span>
                <span>{fmtBRL(precoTotalUnitarioModal * qtdModal)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BAR: SACOLA COM OS DOIS BOTÕES SOLICITADOS */}
      {carrinho.length > 0 && !modalCart && (
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 pb-6 sm:pb-8 bg-gradient-to-t from-black via-black/90 to-transparent z-40 flex justify-center">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 p-3 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-6">
            <div
              onClick={() => setModalCart(true)}
              className="flex items-center gap-3 w-full sm:w-auto cursor-pointer p-1"
            >
              <div className="w-11 h-11 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center relative font-black shrink-0">
                <ShoppingBag size={22} />
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-slate-950 text-3xs font-black rounded-full flex items-center justify-center border-2 border-slate-900">
                  {totalItensQtd}
                </div>
              </div>
              <div className="text-left min-w-0">
                <p className="text-3xs uppercase font-black text-slate-400 tracking-wider">Sua Comanda</p>
                <p className="text-base font-black text-amber-400">
                  {fmtBRL(totalCarrinho)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  window.scrollTo({ top: 300, behavior: "smooth" });
                  mostrarToast("Explore mais pratos e drinks!");
                }}
                className="flex-1 sm:flex-none px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs transition-all active:scale-95 border border-slate-700"
              >
                Pedir Algo Mais
              </button>

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
              Confirme seus dados para que a cozinha receba a comanda imediatamente:
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
                  Número da Mesa
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mesa 04"
                  value={dadosClienteRapido.mesa || mesaUrl || ""}
                  onChange={(e) => setDadosClienteRapido({ ...dadosClienteRapido, mesa: e.target.value })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">{totalItensQtd} itens na comanda</span>
              <span className="font-black text-base text-amber-400">{fmtBRL(totalCarrinho)}</span>
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

      {/* MODAL DETALHE DO CARRINHO */}
      {modalCart && (
        <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900 sticky top-0">
            <h2 className="font-black text-xl text-white">Sua Comanda</h2>
            <button
              onClick={() => setModalCart(false)}
              className="p-2.5 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 custom-scrollbar space-y-3">
            {carrinho.map((it, idx) => (
              <div key={idx} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-black text-sm text-white">{it.nome_produto}</h4>
                    <p className="text-xs font-black text-amber-400 mt-0.5">{fmtBRL(it.preco_venda * it.quantidade)}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl">
                    <button onClick={() => alterarQtd(idx, -1)} className="w-7 h-7 bg-slate-700 rounded-lg font-black text-xs text-white">-</button>
                    <span className="font-black text-xs text-white w-4 text-center">{it.quantidade}</span>
                    <button onClick={() => alterarQtd(idx, 1)} className="w-7 h-7 bg-slate-700 rounded-lg font-black text-xs text-white">+</button>
                  </div>
                </div>

                {it.observacao && (
                  <p className="text-3xs text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {it.observacao}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-400 font-bold block">Total da Comanda</span>
              <span className="text-xl font-black text-amber-400">{fmtBRL(totalCarrinho)}</span>
            </div>
            <button
              onClick={() => {
                setModalCart(false);
                setModalConfirmacaoCozinha(true);
              }}
              className="py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg flex items-center gap-2"
            >
              <Send size={16} /> Enviar para a Cozinha
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
