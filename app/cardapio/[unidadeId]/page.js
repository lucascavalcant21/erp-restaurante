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
  Flame
} from "lucide-react";
import { fmtBRL } from "../../components/ui";
import { mascaraTelefone } from "../../lib/mascaras.mjs";
import {
  BANNERS_CARROSSEL,
  SUGESTOES_DO_DIA,
  gerarBoasVindasInteligentes,
  CARDAPIO_DIGITAL_DEMO
} from "../../lib/delivery";

export default function CardapioPublicoPage() {
  const { unidadeId } = useParams();
  const [produtos, setProdutos] = useState([]);
  const [unidadeNome, setUnidadeNome] = useState("Carregando...");
  const [lojaAberta, setLojaAberta] = useState(true);
  const [taxaEntrega, setTaxaEntrega] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtros & Busca
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");
  const [humorAtivo, setHumorAtivo] = useState("todos");
  const [termoBusca, setTermoBusca] = useState("");

  // Carrossel
  const [bannerAtual, setBannerAtual] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Modal Customização iFood
  const [pratoModal, setPratoModal] = useState(null);
  const [pontoEscolhido, setPontoEscolhido] = useState("");
  const [acompanhamentosEscolhidos, setAcompanhamentosEscolhidos] = useState([]);
  const [adicionaisEscolhidos, setAdicionaisEscolhidos] = useState([]);
  const [remocoesEscolhidas, setRemocoesEscolhidas] = useState([]);
  const [observacaoCliente, setObservacaoCliente] = useState("");
  const [qtdModal, setQtdModal] = useState(1);

  // Toast
  const [toastMsg, setToastMsg] = useState(null);

  // CARRINHO & CHECKOUT
  const [carrinho, setCarrinho] = useState([]);
  const [modalCart, setModalCart] = useState(false);
  const [telaCheckout, setTelaCheckout] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(false);

  // FORM CHECKOUT
  const [form, setForm] = useState({ tipo: "delivery", nome: "", telefone: "", endereco: "", troco: "" });
  const [mesaUrl, setMesaUrl] = useState(null);

  // Boas-vindas inteligentes
  const infoBoasVindas = useMemo(() => {
    return gerarBoasVindasInteligentes(unidadeNome || "Restaurante");
  }, [unidadeNome]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("mesa");
    if (m) {
      setMesaUrl(m);
      setForm((f) => ({ ...f, tipo: "qrcode" }));
    }
  }, []);

  // Carregar cardápio com fallback automático
  useEffect(() => {
    async function carregarCardapio() {
      setLoading(true);
      try {
        const r = await fetch(`/api/public/cardapio/${encodeURIComponent(unidadeId)}`, { cache: "no-store" });
        const json = r.ok ? await r.json() : null;
        if (json?.unidade) {
          setUnidadeNome(json.unidade.nome || "Sel de Estrela Gastronomia");
          setLojaAberta(json.unidade.aberta !== false);
          setTaxaEntrega(Number(json.unidade.taxa_entrega) || 0);
        } else {
          setUnidadeNome("Sel de Estrela Gastronomia");
        }
        
        if (json?.produtos && json.produtos.length > 0) {
          // Normaliza produtos da API
          const prodsComDetalhes = json.produtos.map((p) => {
            const demoRef = CARDAPIO_DIGITAL_DEMO.find((d) => d.nome.toLowerCase() === (p.nome_produto || "").toLowerCase());
            return {
              id: p.id,
              nome_produto: p.nome_produto,
              preco_venda: Number(p.preco_venda) || 0,
              categoria: p.categoria || "Geral",
              descricao: p.descricao || demoRef?.descricao || "Receita autoral preparada com ingredientes frescos da estação.",
              imagem_url: p.imagem_url || demoRef?.imagem_url || "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
              porcao: demoRef?.porcao || "Serve 1 a 2 pessoas • 500g",
              tempo_preparo: demoRef?.tempo_preparo || "20-25 min",
              avaliacao: demoRef?.avaliacao || 4.9,
              tags: demoRef?.tags || ["🔥 Mais Pedido"],
              opcoes_customizacao: demoRef?.opcoes_customizacao || null,
            };
          });
          setProdutos(prodsComDetalhes);
        } else {
          // Fallback gracioso com catálogo rico
          const demoNormalizado = CARDAPIO_DIGITAL_DEMO.map((d) => ({
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
            opcoes_customizacao: d.opcoes_customizacao,
          }));
          setProdutos(demoNormalizado);
        }
      } catch {
        // Fallback offline
        setUnidadeNome("Sel de Estrela Gastronomia");
        const demoNormalizado = CARDAPIO_DIGITAL_DEMO.map((d) => ({
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
          opcoes_customizacao: d.opcoes_customizacao,
        }));
        setProdutos(demoNormalizado);
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

  // Abrir Modal de Customização
  const abrirModalCustomizacao = (p) => {
    setPratoModal(p);
    setPontoEscolhido(p.opcoes_customizacao?.ponto_carne?.[0] || "");
    setAcompanhamentosEscolhidos([]);
    setAdicionaisEscolhidos([]);
    setRemocoesEscolhidas([]);
    setObservacaoCliente("");
    setQtdModal(1);
  };

  // Preço unitário dinâmico do modal
  const precoTotalUnitarioModal = useMemo(() => {
    if (!pratoModal) return 0;
    const base = Number(pratoModal.preco_venda) || 0;
    const adicionais = adicionaisEscolhidos.reduce((acc, a) => acc + (Number(a.preco) || 0), 0);
    return base + adicionais;
  }, [pratoModal, adicionaisEscolhidos]);

  // Toggle acompanhamentos com limite
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

  // Toggle adicionais
  const toggleAdicional = (adicional) => {
    const existe = adicionaisEscolhidos.some((a) => a.id === adicional.id);
    if (existe) {
      setAdicionaisEscolhidos(adicionaisEscolhidos.filter((a) => a.id !== adicional.id));
    } else {
      setAdicionaisEscolhidos([...adicionaisEscolhidos, adicional]);
    }
  };

  // Confirmar adição pelo modal
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
    mostrarToast(`✓ ${qtdModal}x ${pratoModal.nome_produto} adicionado!`);
  };

  // Adicionar Combo do Chef em 1 clique
  const pedirComboDoDia = (combo) => {
    const itemCombo = {
      id: combo.pratoPrincipal.id || "prod-angus",
      nome_produto: `${combo.titulo} (${combo.pratoPrincipal.nome} + ${combo.bebida.nome})`,
      preco_venda: combo.precoCombo,
      quantidade: 1,
      observacao: `Combo Harmonizado do Chef • Economia de R$ ${combo.economia.toFixed(2)}`,
    };

    setCarrinho((atual) => [...atual, itemCombo]);
    mostrarToast(`✓ Combo do Chef adicionado com economia de R$ ${combo.economia.toFixed(2)}!`);
  };

  // Alteração de quantidade e remoção na sacola
  const alterarQtd = (idx, delta) => {
    setCarrinho((atual) => {
      const novo = [...atual];
      novo[idx].quantidade += delta;
      return novo.filter((i) => i.quantidade > 0);
    });
  };

  const totalCarrinho = carrinho.reduce((acc, it) => acc + (it.preco_venda * it.quantidade), 0);
  const valorTaxa = form.tipo === "delivery" ? taxaEntrega : 0;
  const totalGeral = totalCarrinho + valorTaxa;

  const finalizarPedido = async () => {
    if (!form.nome) return alert("Digite seu nome!");
    if (!form.telefone) return alert("Digite seu WhatsApp com DDD!");
    if (form.tipo === "delivery" && !form.endereco) return alert("Digite seu endereço completo!");

    const payloadForm = { ...form };
    if (form.tipo === "delivery" && taxaEntrega > 0) {
      payloadForm.taxa_entrega = taxaEntrega;
    }
    if (mesaUrl) {
      payloadForm.nome = `[MESA ${mesaUrl}] ${form.nome}`;
    }

    const erro = await enviarPedidoOnline(unidadeId, payloadForm, carrinho);
    if (erro.error) return alert("Erro ao enviar: " + erro.error);

    setPedidoEnviado(true);
    setCarrinho([]);
  };

  // Categorias disponíveis
  const categoriasRaw = useMemo(() => {
    const cats = Array.from(new Set(produtos.map((p) => p.categoria || "Geral")));
    return ["Todas", ...cats];
  }, [produtos]);

  // Filtragem combinada rápida
  const produtosFiltrados = useMemo(() => {
    let res = [...produtos];

    // Humor
    if (humorAtivo === "rapida") {
      res = res.filter((p) => p.tempo_preparo && (p.tempo_preparo.includes("5") || p.tempo_preparo.includes("10") || p.tempo_preparo.includes("15")));
    } else if (humorAtivo === "brasa") {
      res = res.filter((p) => (p.categoria && p.categoria.toLowerCase().includes("brasa")) || (p.nome_produto && p.nome_produto.toLowerCase().includes("brasa")));
    } else if (humorAtivo === "harmonizados") {
      res = res.filter((p) => p.tags && p.tags.some((t) => t.toLowerCase().includes("chef") || t.toLowerCase().includes("mais")));
    } else if (humorAtivo === "leves") {
      res = res.filter((p) => (p.categoria && p.categoria.toLowerCase().includes("peixe")) || (p.tags && p.tags.some((t) => t.toLowerCase().includes("leve"))));
    } else if (humorAtivo === "compartilhar") {
      res = res.filter((p) => p.porcao && (p.porcao.includes("2") || p.porcao.includes("compartilhar")));
    }

    // Categoria
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
          (p.categoria && p.categoria.toLowerCase().includes(q))
      );
    }

    return res;
  }, [produtos, categoriaAtiva, humorAtivo, termoBusca]);

  const comboPrincipal = SUGESTOES_DO_DIA[0];

  if (pedidoEnviado) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center font-sans">
        <CheckCircle size={80} className="mb-6 text-emerald-400 animate-bounce" />
        <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tighter">Pedido Recebido com Sucesso!</h1>
        <p className="text-slate-300 font-medium mb-8 max-w-md text-sm leading-relaxed">
          Nossa equipe da cozinha e o chef já receberam a comanda com todas as suas especificações. Em breve seu pedido estará pronto!
        </p>
        <button
          onClick={() => {
            setPedidoEnviado(false);
            setModalCart(false);
            setTelaCheckout(false);
          }}
          className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl active:scale-95 transition-transform shadow-xl"
        >
          Fazer Novo Pedido
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-36 font-sans">
      
      {/* TOAST FLUTUANTE */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full text-xs font-black shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <Sparkles size={16} className="text-amber-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HEADER DA UNIDADE */}
      <div className="bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 opacity-90"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-3xs font-black uppercase tracking-widest text-emerald-400">
                  {mesaUrl ? `Mesa ${mesaUrl} • Atendimento Presencial` : "Cardápio Digital & Delivery"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                {unidadeNome}
                <span className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  Cardápio Inteligente
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                <Star size={14} className="fill-amber-400 text-amber-400" /> 4.9 (420+ avaliações)
              </span>
              <span className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                <Clock size={14} className="text-amber-400" /> 20-35 min
              </span>
            </div>
          </div>

          {/* MENSAGEM DE BOAS-VINDAS INTELIGENTES */}
          <div className="mt-5 bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 text-xl border border-amber-500/30">
                {infoBoasVindas.icone}
              </div>
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-1.5">
                  {infoBoasVindas.saudacao}
                  <span className="text-3xs text-amber-300 font-bold bg-amber-400/20 px-1.5 py-0.5 rounded">Sugestões do Chef</span>
                </h3>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  {infoBoasVindas.subtitulo}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 text-3xs font-black uppercase text-amber-300 tracking-wider bg-black/30 px-3 py-1.5 rounded-xl border border-amber-500/20">
              <Flame size={14} /> Pontos em Dobro no Clube de Fogo
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* CARROSSEL DINÂMICO DE BANNERS */}
        <div
          className="mt-6 relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-slate-900 group"
          onMouseEnter={() => setAutoPlay(false)}
          onMouseLeave={() => setAutoPlay(true)}
        >
          <div className="relative h-44 sm:h-60 w-full overflow-hidden">
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
                  <span className={`inline-block ${banner.corBadge} text-white text-3xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider mb-2 shadow`}>
                    {banner.tag}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight drop-shadow-md">
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
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setBannerAtual((prev) => (prev + 1) % BANNERS_CARROSSEL.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* SUGESTÃO DO DIA INTELIGENTE (PRATO PRINCIPAL + BEBIDA) */}
        {comboPrincipal && (
          <div className="mt-6 bg-gradient-to-br from-amber-500/10 via-white to-amber-50/50 rounded-3xl p-5 border-2 border-amber-300/80 shadow-md relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-amber-200/60">
              <div className="flex items-center gap-2">
                <span className="bg-amber-600 text-white text-3xs font-black uppercase px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1 shadow-sm">
                  <Sparkles size={12} /> {comboPrincipal.badge}
                </span>
                <span className="text-xs font-bold text-amber-900">Harmonização Especial do Chef</span>
              </div>
              <div className="text-3xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                Economia de R$ {comboPrincipal.economia.toFixed(2).replace(".", ",")}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-4 items-center">
              <div className="md:col-span-5 flex items-center gap-3 bg-white p-3 rounded-2xl border border-amber-100 shadow-sm">
                <img
                  src={comboPrincipal.pratoPrincipal.imagem}
                  alt={comboPrincipal.pratoPrincipal.nome}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 shadow-inner"
                />
                <div className="min-w-0">
                  <span className="text-3xs font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Prato Principal</span>
                  <h4 className="font-black text-slate-800 text-xs sm:text-sm line-clamp-2 mt-0.5">
                    {comboPrincipal.pratoPrincipal.nome}
                  </h4>
                  <p className="text-3xs font-bold text-slate-500 mt-1">
                    {comboPrincipal.pratoPrincipal.porcao}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-black shadow-md">
                  +
                </div>
              </div>

              <div className="md:col-span-5 flex items-center gap-3 bg-white p-3 rounded-2xl border border-amber-100 shadow-sm">
                <img
                  src={comboPrincipal.bebida.imagem}
                  alt={comboPrincipal.bebida.nome}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 shadow-inner"
                />
                <div className="min-w-0">
                  <span className="text-3xs font-black uppercase text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">Bebida Harmonizada</span>
                  <h4 className="font-black text-slate-800 text-xs sm:text-sm line-clamp-2 mt-0.5">
                    {comboPrincipal.bebida.nome}
                  </h4>
                  <p className="text-3xs font-bold text-slate-500 mt-1">
                    Volume: {comboPrincipal.bebida.volume}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-100/60 p-3 rounded-xl border border-amber-200/50 mb-4 text-xs font-medium text-amber-950 flex items-start gap-2">
              <Wine size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-bold">Por que harmoniza:</span> {comboPrincipal.motivoHarmonizacao}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-400 line-through font-bold">
                  R$ {comboPrincipal.precoTotalOriginal.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  R$ {comboPrincipal.precoCombo.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-3xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  15% OFF
                </span>
              </div>

              <button
                onClick={() => pedirComboDoDia(comboPrincipal)}
                className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles size={16} className="text-amber-400" />
                Pedir Combo do Chef (1 Clique)
              </button>
            </div>
          </div>
        )}

        {/* CHIPS RÁPIDOS DE INTENÇÃO DE APETITE */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Filtro Inteligente de Apetite
            </h3>
            {humorAtivo !== "todos" && (
              <button
                onClick={() => setHumorAtivo("todos")}
                className="text-3xs font-black text-amber-600 hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {infoBoasVindas.humorFome.map((h) => (
              <button
                key={h.id}
                onClick={() => setHumorAtivo(h.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-sm ${
                  humorAtivo === h.id
                    ? "bg-amber-500 text-white shadow-amber-500/20 scale-105"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{h.icone}</span>
                <span>{h.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* BARRA DE PESQUISA EM TEMPO REAL */}
        <div className="mt-4 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar prato, carne, risoto, drink, sobremesa..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-slate-800 shadow-sm transition-all"
          />
          {termoBusca && (
            <button
              onClick={() => setTermoBusca("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

      </div>

      {/* BARRA STICKY DE NAVEGAÇÃO DE CATEGORIAS */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-xl border-y border-slate-200/80 py-3 mt-6 shadow-sm">
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
                      ? "bg-slate-900 text-white shadow-md scale-105"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-3xs px-1.5 py-0.2 rounded-full font-bold ${ativa ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {qtd}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* VITRINE DE PRATOS */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {categoriaAtiva === "Todas" ? "Cardápio do Dia" : categoriaAtiva}
            <span className="text-xs font-bold text-slate-400">({produtosFiltrados.length} pratos)</span>
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 font-bold animate-pulse">
            Carregando pratos do cardápio...
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
            <UtensilsCrossed size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-black text-slate-800 text-base">Nenhum prato encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tente alterar os termos da busca ou selecionar outra categoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {produtosFiltrados.map((prato) => (
              <div
                key={prato.id}
                onClick={() => abrirModalCustomizacao(prato)}
                className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex gap-3.5 group relative"
              >
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {prato.tags?.slice(0, 2).map((t, idx) => (
                        <span
                          key={idx}
                          className="text-3xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <h3 className="font-black text-slate-900 text-[15px] leading-snug group-hover:text-amber-600 transition-colors">
                      {prato.nome_produto}
                    </h3>

                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                      {prato.descricao}
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2 text-3xs font-bold text-slate-500 mb-2">
                      {prato.porcao && (
                        <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                          <Users size={11} className="text-slate-400" /> {prato.porcao}
                        </span>
                      )}
                      {prato.tempo_preparo && (
                        <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                          <Clock size={11} className="text-slate-400" /> {prato.tempo_preparo}
                        </span>
                      )}
                      {prato.avaliacao && (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          <Star size={11} className="fill-amber-500 text-amber-500" /> {prato.avaliacao}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-slate-900">
                        {fmtBRL(prato.preco_venda)}
                      </span>
                      <span className="text-3xs font-black text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">
                        +{Math.floor(prato.preco_venda)} 🔥
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative shrink-0 flex flex-col items-center justify-between">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-inner bg-slate-100 border border-slate-100">
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
                    className="mt-2 w-full py-1.5 px-3 bg-slate-900 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE CUSTOMIZAÇÃO DO PRATO ESTILO IFOOD */}
      {pratoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl max-h-[92vh] sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="relative h-48 sm:h-56 w-full bg-slate-900 shrink-0">
              <img
                src={pratoModal.imagem_url}
                alt={pratoModal.nome_produto}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              <button
                onClick={() => setPratoModal(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md shadow-lg"
              >
                <X size={20} />
              </button>

              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-3xs font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-md mb-1 inline-block">
                  {pratoModal.categoria}
                </span>
                <h3 className="text-xl sm:text-2xl font-black leading-tight drop-shadow-md">
                  {pratoModal.nome_produto}
                </h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
              <div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {pratoModal.descricao}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                  {pratoModal.porcao && (
                    <span className="bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
                      <Users size={14} className="text-slate-400" /> {pratoModal.porcao}
                    </span>
                  )}
                  {pratoModal.tempo_preparo && (
                    <span className="bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
                      <Clock size={14} className="text-slate-400" /> {pratoModal.tempo_preparo}
                    </span>
                  )}
                </div>
              </div>

              {/* Ponto da Carne */}
              {pratoModal.opcoes_customizacao?.ponto_carne && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-black text-sm text-slate-900">Ponto da Carne</h4>
                    <span className="text-3xs font-black uppercase text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                      Escolha 1
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pratoModal.opcoes_customizacao.ponto_carne.map((ponto) => (
                      <label
                        key={ponto}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          pontoEscolhido === ponto
                            ? "border-slate-900 bg-white shadow-sm font-black text-slate-900"
                            : "border-slate-200 bg-white/60 hover:bg-white text-slate-700 font-medium"
                        }`}
                      >
                        <span className="text-xs">{ponto}</span>
                        <input
                          type="radio"
                          name="ponto_carne"
                          checked={pontoEscolhido === ponto}
                          onChange={() => setPontoEscolhido(ponto)}
                          className="accent-slate-900 w-4 h-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Acompanhamentos */}
              {pratoModal.opcoes_customizacao?.acompanhamentos && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="font-black text-sm text-slate-900">Acompanhamentos Inclusos</h4>
                      <p className="text-3xs text-slate-500 font-bold">Escolha até 2 opções</p>
                    </div>
                    <span className="text-xs font-black text-slate-700 bg-slate-200 px-2.5 py-1 rounded-full">
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
                              ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-black"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                          }`}
                        >
                          <span className="text-xs">{acomp}</span>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            selecionado ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"
                          }`}>
                            {selecionado && <Check size={14} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Adicionais (+ R$) */}
              {pratoModal.opcoes_customizacao?.adicionais && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-black text-sm text-slate-900">Turbine seu Prato</h4>
                    <span className="text-3xs font-black uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                      Opcionais
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
                              ? "border-purple-600 bg-purple-50/50 text-purple-950 font-black"
                              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                          }`}
                        >
                          <div>
                            <p className="text-xs">{adic.nome}</p>
                            <p className="text-3xs font-black text-purple-700">+ R$ {Number(adic.preco).toFixed(2).replace(".", ",")}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            selecionado ? "bg-purple-600 border-purple-600 text-white" : "border-slate-300"
                          }`}>
                            {selecionado && <Check size={14} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observação */}
              <div>
                <label className="text-xs font-black uppercase text-slate-500 block mb-1">
                  Observações para o Chef
                </label>
                <textarea
                  maxLength={140}
                  placeholder="Ex: Ponto bem tostadinho, molho à parte..."
                  value={observacaoCliente}
                  onChange={(e) => setObservacaoCliente(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium outline-none focus:border-slate-800 h-20 resize-none"
                />
              </div>
            </div>

            {/* Rodapé fixo do modal */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setQtdModal((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-xl bg-white text-slate-700 flex items-center justify-center font-black shadow-sm active:scale-95"
                >
                  <Minus size={16} />
                </button>
                <span className="font-black text-sm text-slate-900 w-5 text-center">
                  {qtdModal}
                </span>
                <button
                  onClick={() => setQtdModal((prev) => prev + 1)}
                  className="w-8 h-8 rounded-xl bg-white text-slate-700 flex items-center justify-center font-black shadow-sm active:scale-95"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                onClick={confirmarAdicaoModal}
                className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between shadow-lg shadow-slate-900/20 active:scale-98 transition-all"
              >
                <span>Adicionar ao Pedido</span>
                <span>{fmtBRL(precoTotalUnitarioModal * qtdModal)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BAR: SACOLA */}
      {carrinho.length > 0 && !modalCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 sm:pb-8 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent z-40 pointer-events-none flex justify-center">
          <div className="pointer-events-auto w-full max-w-md animate-in slide-in-from-bottom-6 duration-300">
            <button
              onClick={() => setModalCart(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-2xl font-black flex items-center justify-between shadow-[0_15px_40px_rgba(15,23,42,0.4)] active:scale-[0.98] transition-all border border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 text-slate-950 rounded-xl flex items-center justify-center relative font-black">
                  <ShoppingBag size={20} />
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-slate-900 text-3xs font-black rounded-full flex items-center justify-center border-2 border-slate-900">
                    {carrinho.reduce((a, b) => a + b.quantidade, 0)}
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-3xs uppercase font-bold text-slate-400 tracking-wider">Seu Pedido</p>
                  <p className="text-sm font-black text-white">Ver Carrinho</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-base font-black text-amber-400">
                  {fmtBRL(totalCarrinho)}
                </span>
                <ChevronRight size={18} className="text-slate-400" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* MODAL CARRINHO E CHECKOUT */}
      {modalCart && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white sticky top-0">
            <h2 className="font-black text-xl text-slate-900">
              {telaCheckout ? "Finalizar Pedido" : "Seu Carrinho"}
            </h2>
            <button
              onClick={() => (telaCheckout ? setTelaCheckout(false) : setModalCart(false))}
              className="p-2.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 custom-scrollbar">
            {!telaCheckout ? (
              <div className="space-y-3 max-w-md mx-auto">
                {carrinho.map((it, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-black text-sm text-slate-900">{it.nome_produto}</h4>
                        <p className="text-xs font-black text-emerald-700 mt-0.5">{fmtBRL(it.preco_venda * it.quantidade)}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => alterarQtd(idx, -1)} className="w-7 h-7 bg-white rounded-lg font-black text-xs text-slate-700 shadow-sm">-</button>
                        <span className="font-black text-xs text-slate-900 w-4 text-center">{it.quantidade}</span>
                        <button onClick={() => alterarQtd(idx, 1)} className="w-7 h-7 bg-white rounded-lg font-black text-xs text-slate-700 shadow-sm">+</button>
                      </div>
                    </div>

                    {it.observacao && (
                      <p className="text-3xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {it.observacao}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-w-md mx-auto">
                {!mesaUrl ? (
                  <div>
                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider block mb-2">Forma de Consumo</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tipo: "delivery" })}
                        className={`p-3.5 rounded-xl font-black text-xs border-2 transition ${
                          form.tipo === "delivery"
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tipo: "qrcode" })}
                        className={`p-3.5 rounded-xl font-black text-xs border-2 transition ${
                          form.tipo === "qrcode"
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        Estou na Mesa
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                    <p className="text-xs font-black text-amber-900">📍 Pedido vinculado à Mesa {mesaUrl}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider block mb-1">Seu Nome</label>
                  <input
                    type="text"
                    placeholder="Como devemos te chamar?"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider block mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(DDD) 99999-9999"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })}
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-slate-800"
                  />
                </div>

                {form.tipo === "delivery" && (
                  <div>
                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider block mb-1">Endereço de Entrega</label>
                    <textarea
                      placeholder="Rua, Número, Bairro, Ponto de Referência"
                      value={form.endereco}
                      onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                      className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-slate-800 h-20 resize-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 bg-white border-t border-slate-200">
            <div className="max-w-md mx-auto">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-slate-500">Total</span>
                <span className="text-2xl font-black text-slate-900">{fmtBRL(totalGeral)}</span>
              </div>

              {!telaCheckout ? (
                <button
                  onClick={() => setTelaCheckout(true)}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl active:scale-95 transition shadow-lg"
                >
                  Continuar Pedido
                </button>
              ) : (
                <button
                  onClick={finalizarPedido}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl active:scale-95 transition shadow-lg flex items-center justify-center gap-2"
                >
                  <Send size={18} /> Enviar Pedido para a Cozinha
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
