"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  ArrowLeft,
  QrCode,
  Copy,
  ExternalLink,
  Smartphone,
  ArrowDown,
  Sparkles,
  UtensilsCrossed,
  Palette,
  Clock,
  Calendar,
  Save,
  Plus,
  Trash2,
  Edit3,
  Flame,
  ShieldAlert,
  Image as ImageIcon,
  CheckCircle2
} from "lucide-react";
import {
  fetchCardapioConfig,
  salvarCardapioConfig,
  CARDAPIO_DIGITAL_DEMO,
  BANNERS_CARROSSEL
} from "../../../lib/delivery";

export default function CardapioGeradorPage() {
  const router = useRouter();
  const { abrirMenu, unidadeAtiva, unidadeInfo } = useERP();

  const [abaAtiva, setAbaAtiva] = useState("qr_links"); // "qr_links" | "visual_horarios" | "eventos_promos" | "pratos"
  const [tipoCardapio, setTipoCardapio] = useState("delivery"); // "delivery" | "experience"
  const [mesaFiltro, setMesaFiltro] = useState("");
  const [urlPublica, setUrlPublica] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Configurações Editáveis
  const [config, setConfig] = useState({
    cor_fundo: "#0b0f17",
    nome_restaurante: "Sel de Estrela Gastronomia & Brasa",
    horarios_funcionamento: "Segunda a Domingo: 11h30 às 15h30 • 18h30 às 23h30",
    pratos_customizados: [],
    eventos: [],
  });

  const [salvando, setSalvando] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Modal de Edição de Prato
  const [editandoPrato, setEditandoPrato] = useState(null);

  useEffect(() => {
    const c = fetchCardapioConfig(unidadeAtiva || "seldeestrela");
    if (!c.pratos_customizados || c.pratos_customizados.length === 0) {
      c.pratos_customizados = CARDAPIO_DIGITAL_DEMO;
    }
    setConfig(c);
  }, [unidadeAtiva]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const baseUrl = window.location.origin;
      const unid = unidadeAtiva || "seldeestrela";
      let link = "";

      if (tipoCardapio === "experience") {
        link = mesaFiltro.trim()
          ? `${baseUrl}/experience/${unid}/${encodeURIComponent(mesaFiltro.trim())}`
          : `${baseUrl}/experience/${unid}`;
      } else {
        link = `${baseUrl}/delivery/${unid}`;
      }

      setUrlPublica(link);
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(link)}&color=0f172a`);
    }
  }, [unidadeAtiva, tipoCardapio, mesaFiltro]);

  const mostrarToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const copiarLink = () => {
    navigator.clipboard.writeText(urlPublica);
    mostrarToast("✓ Link copiado com sucesso!");
  };

  const salvarTodasConfigs = () => {
    setSalvando(true);
    salvarCardapioConfig(unidadeAtiva || "seldeestrela", config);
    setSalvando(false);
    mostrarToast("✓ Alterações salvas! O cardápio digital já foi atualizado em tempo real.");
  };

  // Cores de fundo pré-definidas
  const temasCores = [
    { id: "dark_onyx", nome: "Preto Ônix Luxo", hex: "#0b0f17" },
    { id: "carvao_brasa", nome: "Carvão & Brasa Nobre", hex: "#140e0a" },
    { id: "slate_modern", nome: "Dark Slate Elegante", hex: "#0f172a" },
    { id: "borgonha", nome: "Vinho Borgonha", hex: "#1a0910" },
    { id: "clean_white", nome: "Branco Minimalista", hex: "#f8fafc" },
  ];

  // Adicionar novo prato
  const criarNovoPrato = () => {
    const novo = {
      id: `prod-custom-${Date.now()}`,
      nome: "Novo Prato Especial do Chef",
      categoria: "Carnes Nobres & Brasa",
      preco: 75.0,
      preco_antigo: null,
      descricao: "Descrição apetitosa com ingredientes selecionados pelo Chef.",
      porcao: "Serve 1 a 2 pessoas • 500g",
      tempo_preparo: "20-25 min",
      avaliacao: 4.9,
      imagem_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
      pimenta: "Sem Pimenta",
      nivelPimenta: 0,
      camarao: false,
      gluten: false,
      lactose: false,
      alergenicos: "Sem glúten. Sem lactose.",
    };
    setEditandoPrato(novo);
  };

  const salvarPratoEditado = () => {
    if (!editandoPrato) return;
    const lista = [...(config.pratos_customizados || [])];
    const index = lista.findIndex((p) => p.id === editandoPrato.id);
    if (index >= 0) {
      lista[index] = editandoPrato;
    } else {
      lista.unshift(editandoPrato);
    }
    const novaConfig = { ...config, pratos_customizados: lista };
    setConfig(novaConfig);
    salvarCardapioConfig(unidadeAtiva || "seldeestrela", novaConfig);
    setEditandoPrato(null);
    mostrarToast("✓ Prato salvo e publicado no cardápio!");
  };

  const removerPrato = (id) => {
    if (!confirm("Tem certeza que deseja excluir este prato do cardápio?")) return;
    const lista = (config.pratos_customizados || []).filter((p) => p.id !== id);
    const novaConfig = { ...config, pratos_customizados: lista };
    setConfig(novaConfig);
    salvarCardapioConfig(unidadeAtiva || "seldeestrela", novaConfig);
    mostrarToast("✓ Prato removido.");
  };

  return (
    <div className="min-h-screen pb-32 font-sans text-slate-800 bg-slate-50">
      
      {/* TOAST FLUTUANTE */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full text-xs font-black shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 py-4 sm:py-6 px-4 sm:px-6 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => abrirMenu()}
              className="p-2.5 text-slate-700 hover:text-slate-900 bg-slate-100 rounded-xl border border-slate-200"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-black">
              <Sparkles size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Editor do Cardápio Digital
              </h1>
              <p className="text-3xs font-bold uppercase tracking-wider text-slate-500">
                Personalize cores, horários, pratos, fotos, alérgenos e eventos
              </p>
            </div>
          </div>

          <button
            onClick={salvarTodasConfigs}
            disabled={salvando}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Save size={16} /> Salvar Tudo
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">

        {/* NAVEGAÇÃO DE ABAS DO EDITOR */}
        <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto hide-scrollbar">
          {[
            { id: "qr_links", label: "📱 QR Codes & Links", icone: QrCode },
            { id: "visual_horarios", label: "🎨 Cores de Fundo & Horários", icone: Palette },
            { id: "eventos_promos", label: "📅 Promoções & Eventos da Semana", icone: Calendar },
            { id: "pratos", label: "🍽️ Pratos, Fotos & Alérgenos", icone: UtensilsCrossed },
          ].map((tab) => {
            const Icon = tab.icone;
            const ativa = abaAtiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`px-4 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
                  ativa
                    ? "bg-amber-500 text-slate-950 shadow-md scale-102"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ─── ABA 1: QR CODES & LINKS ─── */}
        {abaAtiva === "qr_links" && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-black text-base text-slate-900">Tipo de Cardápio para o QR Code</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTipoCardapio("delivery")}
                    className={`p-3 rounded-xl font-black text-xs border-2 transition ${
                      tipoCardapio === "delivery"
                        ? "border-amber-500 bg-amber-50 text-amber-950"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Cardápio Delivery / Web
                  </button>
                  <button
                    onClick={() => setTipoCardapio("experience")}
                    className={`p-3 rounded-xl font-black text-xs border-2 transition ${
                      tipoCardapio === "experience"
                        ? "border-amber-500 bg-amber-50 text-amber-950"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Héfisto Experience (Mesas)
                  </button>
                </div>

                {tipoCardapio === "experience" && (
                  <div>
                    <label className="text-3xs font-black uppercase text-slate-500 block mb-1">
                      Mesa Específica (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 04 (ou deixe vazio para todas as mesas)"
                      value={mesaFiltro}
                      onChange={(e) => setMesaFiltro(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-slate-800"
                    />
                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <label className="text-3xs font-black uppercase text-slate-500 block">Link Direto</label>
                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <input
                    type="text"
                    readOnly
                    value={urlPublica}
                    className="flex-1 bg-transparent text-xs font-bold text-slate-800 outline-none truncate"
                  />
                  <button
                    onClick={copiarLink}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black"
                  >
                    Copiar
                  </button>
                </div>

                <a
                  href={urlPublica}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <ExternalLink size={16} /> Abrir Cardápio no Navegador
                </a>
              </div>
            </div>

            {/* QR Code */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
              <h3 className="font-black text-base text-slate-900 mb-1">QR Code de Mesa & Displays</h3>
              <p className="text-xs text-slate-500 mb-6">Escaneie com a câmera do celular para testar</p>
              
              <div className="p-4 bg-white border-4 border-slate-100 rounded-3xl shadow-inner">
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="QR Code" className="w-52 h-52 object-contain" />
                )}
              </div>

              <a
                href={qrCodeUrl}
                download="QRCode_Cardapio.png"
                target="_blank"
                rel="noreferrer"
                className="mt-6 text-xs font-black text-amber-600 hover:underline uppercase tracking-wider"
              >
                Baixar Imagem em Alta Resolução
              </a>
            </div>
          </div>
        )}

        {/* ─── ABA 2: CORES DE FUNDO & HORÁRIOS ─── */}
        {abaAtiva === "visual_horarios" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-200">
            {/* Seletor de Cores de Fundo */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="font-black text-base text-slate-900">Cor de Fundo do Cardápio Digital</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escolha o tema visual que melhor combina com a identidade e ambiente do seu restaurante.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {temasCores.map((t) => {
                  const sel = config.cor_fundo === t.hex;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setConfig({ ...config, cor_fundo: t.hex })}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between h-24 ${
                        sel ? "border-amber-500 ring-2 ring-amber-500/20 shadow-md scale-102" : "border-slate-200"
                      }`}
                      style={{ backgroundColor: t.hex }}
                    >
                      <span className={`text-3xs font-black uppercase px-1.5 py-0.5 rounded w-max ${
                        t.hex === "#f8fafc" ? "bg-slate-900 text-white" : "bg-white/20 text-white"
                      }`}>
                        {sel ? "✓ Ativo" : ""}
                      </span>
                      <span className={`text-xs font-black ${
                        t.hex === "#f8fafc" ? "text-slate-900" : "text-white"
                      }`}>
                        {t.nome}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Cor Hexadecimal Livre */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-bold text-slate-600">Ou digite uma cor personalizada (Hex):</span>
                <input
                  type="text"
                  value={config.cor_fundo}
                  onChange={(e) => setConfig({ ...config, cor_fundo: e.target.value })}
                  placeholder="#0b0f17"
                  className="w-28 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-slate-800"
                />
                <div
                  className="w-8 h-8 rounded-xl border border-slate-300 shadow-inner"
                  style={{ backgroundColor: config.cor_fundo }}
                />
              </div>
            </div>

            {/* Nome do Restaurante & Horários de Funcionamento */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-base text-slate-900">Textos Principais & Horários</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                    Nome do Restaurante no Cardápio
                  </label>
                  <input
                    type="text"
                    value={config.nome_restaurante}
                    onChange={(e) => setConfig({ ...config, nome_restaurante: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                    Horários de Funcionamento
                  </label>
                  <input
                    type="text"
                    value={config.horarios_funcionamento}
                    onChange={(e) => setConfig({ ...config, horarios_funcionamento: e.target.value })}
                    placeholder="Segunda a Domingo: 11h30 às 15h30 • 18h30 às 23h30"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <button
                onClick={salvarTodasConfigs}
                className="mt-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md"
              >
                Salvar Configurações Visuais
              </button>
            </div>
          </div>
        )}

        {/* ─── ABA 3: PROMOÇÕES DO DIA & EVENTOS DA SEMANA ─── */}
        {abaAtiva === "eventos_promos" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Banners do Carrossel (Promoção do Dia & Eventos da Semana)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estes slides passam automaticamente no topo do cardápio para os clientes.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {BANNERS_CARROSSEL.map((banner) => (
                  <div
                    key={banner.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex gap-3.5 shadow-sm"
                  >
                    <img
                      src={banner.imagem}
                      alt={banner.titulo}
                      className="w-24 h-24 rounded-xl object-cover shrink-0 shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <span className={`text-3xs font-black uppercase px-2 py-0.5 rounded-full text-white ${banner.corBadge}`}>
                        {banner.tag}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm mt-1 line-clamp-1">
                        {banner.titulo}
                      </h4>
                      <p className="text-3xs text-slate-500 font-medium line-clamp-2 mt-0.5 leading-relaxed">
                        {banner.subtitulo}
                      </p>
                      {banner.dataEvento && (
                        <p className="text-3xs font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded w-max mt-2">
                          {banner.dataEvento}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA 4: PRATOS, FOTOS & ALÉRGENOS ─── */}
        {abaAtiva === "pratos" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Gestão dos Pratos, Fotos, Alérgenos & Pimenta
                  </h3>
                  <p className="text-xs text-slate-500">
                    Edite fotos em alta resolução, tempo de preparo, glúten, lactose, camarão e nível de picância.
                  </p>
                </div>

                <button
                  onClick={criarNovoPrato}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Plus size={16} /> Adicionar Novo Prato
                </button>
              </div>

              {/* Lista de Pratos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {(config.pratos_customizados || []).map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={p.imagem_url}
                        alt={p.nome}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 shadow-inner bg-slate-200"
                      />
                      <div className="min-w-0">
                        <span className="text-3xs font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                          {p.categoria}
                        </span>
                        <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate mt-0.5">
                          {p.nome}
                        </h4>
                        <div className="flex items-center gap-2 text-3xs font-bold text-slate-500 mt-1">
                          <span className="text-emerald-700 font-black">R$ {Number(p.preco).toFixed(2).replace(".", ",")}</span>
                          <span>•</span>
                          <span>{p.tempo_preparo || "20 min"}</span>
                          {p.camarao && <span className="text-amber-700 font-black">🦐 Camarão</span>}
                          {p.gluten === false && <span className="text-emerald-700 font-black">Sem Glúten</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditandoPrato(p)}
                        className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700 hover:text-amber-600 shadow-sm"
                        title="Editar Prato"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => removerPrato(p.id)}
                        className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 shadow-sm"
                        title="Remover Prato"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE EDIÇÃO DE PRATO */}
      {editandoPrato && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl p-6 shadow-2xl overflow-y-auto custom-scrollbar space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base text-slate-900">
                {editandoPrato.id?.includes("novo") ? "Novo Prato" : "Editar Prato"}
              </h3>
              <button
                onClick={() => setEditandoPrato(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                  Nome do Prato
                </label>
                <input
                  type="text"
                  value={editandoPrato.nome}
                  onChange={(e) => setEditandoPrato({ ...editandoPrato, nome: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={editandoPrato.categoria}
                    onChange={(e) => setEditandoPrato({ ...editandoPrato, categoria: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editandoPrato.preco}
                    onChange={(e) => setEditandoPrato({ ...editandoPrato, preco: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                  URL da Foto do Prato (Link de Imagem)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editandoPrato.imagem_url}
                    onChange={(e) => setEditandoPrato({ ...editandoPrato, imagem_url: e.target.value })}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-slate-800 truncate"
                  />
                  {editandoPrato.imagem_url && (
                    <img
                      src={editandoPrato.imagem_url}
                      alt="Preview"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                  Descrição do Prato
                </label>
                <textarea
                  value={editandoPrato.descricao}
                  onChange={(e) => setEditandoPrato({ ...editandoPrato, descricao: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-slate-800 h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                    Tempo de Preparo
                  </label>
                  <input
                    type="text"
                    value={editandoPrato.tempo_preparo}
                    onChange={(e) => setEditandoPrato({ ...editandoPrato, tempo_preparo: e.target.value })}
                    placeholder="20-25 min"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                    Nível de Pimenta
                  </label>
                  <select
                    value={editandoPrato.nivelPimenta ?? 0}
                    onChange={(e) => {
                      const n = parseInt(e.target.value);
                      const rotulos = ["Sem Pimenta", "Levemente Apimentado", "Picante Moderado", "Muito Picante"];
                      setEditandoPrato({ ...editandoPrato, nivelPimenta: n, pimenta: rotulos[n] });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                  >
                    <option value={0}>Sem Pimenta ⚪</option>
                    <option value={1}>Levemente Apimentado 🌶️</option>
                    <option value={2}>Picante Moderado 🌶️🌶️</option>
                    <option value={3}>Muito Picante 🔥</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes de Alérgenos */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-black text-slate-700 text-3xs uppercase tracking-wider block">
                  Informações de Alergia & Restrições
                </span>
                
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(editandoPrato.camarao)}
                      onChange={(e) => setEditandoPrato({ ...editandoPrato, camarao: e.target.checked })}
                      className="accent-amber-600 w-4 h-4"
                    />
                    <span>🦐 Contém Camarão</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(editandoPrato.gluten === false)}
                      onChange={(e) => setEditandoPrato({ ...editandoPrato, gluten: !e.target.checked })}
                      className="accent-emerald-600 w-4 h-4"
                    />
                    <span>🌾 Sem Glúten</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(editandoPrato.lactose === false)}
                      onChange={(e) => setEditandoPrato({ ...editandoPrato, lactose: !e.target.checked })}
                      className="accent-teal-600 w-4 h-4"
                    />
                    <span>🥛 Sem Lactose</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase text-3xs block mb-1">
                  Aviso para Alérgicos (Ingredientes específicos)
                </label>
                <input
                  type="text"
                  value={editandoPrato.alergenicos || ""}
                  onChange={(e) => setEditandoPrato({ ...editandoPrato, alergenicos: e.target.value })}
                  placeholder="Ex: Contém Castanha-do-Pará, Peixe fresco e ovos."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none"
                />
              </div>

            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setEditandoPrato(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={salvarPratoEditado}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md"
              >
                Salvar Prato
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
