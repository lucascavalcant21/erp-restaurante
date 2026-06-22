"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, ChevronRight, Flame, Plus, Minus, Search, CreditCard, Star, Clock, Info } from "lucide-react";
import { fetchCardapioDigital } from "../../lib/delivery";

export default function LojaDeliveryPage({ params }) {
  const lojaSlug = params.loja;
  const router = useRouter();
  
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carrinho, setCarrinho] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState("Destaques");
  
  useEffect(() => {
    carregarMenu();
    // Recuperar sacola local
    const sacola = localStorage.getItem("carrinho");
    if (sacola) setCarrinho(JSON.parse(sacola));
  }, []);

  const carregarMenu = async () => {
    setLoading(true);
    const { data } = await fetchCardapioDigital(lojaSlug);
    setCatalogo(data || []);
    setLoading(false);
  };

  const addCarrinho = (produto) => {
    const existe = carrinho.find(c => c.id === produto.id);
    let novoCarrinho = [];
    if (existe) {
      novoCarrinho = carrinho.map(c => c.id === produto.id ? { ...c, qtd: c.qtd + 1 } : c);
    } else {
      novoCarrinho = [...carrinho, { ...produto, qtd: 1 }];
    }
    setCarrinho(novoCarrinho);
    localStorage.setItem("carrinho", JSON.stringify(novoCarrinho));
  };

  const totalCarrinho = carrinho.reduce((acc, c) => acc + (c.preco * c.qtd), 0);
  const qtdCarrinho = carrinho.reduce((acc, c) => acc + c.qtd, 0);

  // Organizar categorias
  const categoriasRaw = Array.from(new Set(catalogo.map(p => p.categoria)));
  const categorias = ["Destaques", ...categoriasRaw];
  
  // Filtragem
  const filtrados = categoriaAtiva === "Destaques" 
    ? catalogo.slice(0, 5) // Mock de destaques
    : catalogo.filter(p => p.categoria === categoriaAtiva);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin text-orange-600"><Flame size={48} /></div>
      </div>
    );
  }

  // Capa Dinâmica do Restaurante (Poderia vir do DB)
  const coverUrl = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1200&h=400";
  const logoUrl = "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?auto=format&fit=crop&q=80&w=200&h=200";

  return (
    <div className="min-h-screen bg-slate-50 pb-28 font-sans">
      
      {/* HERO HEADER - Estilo UberEats / iFood */}
      <div className="relative bg-white pb-6 shadow-sm">
        {/* Imagem de Capa */}
        <div className="h-40 md:h-56 w-full bg-slate-200 relative">
          <img src={coverUrl} alt="Capa" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>

        {/* Info do Restaurante (Logo por cima) */}
        <div className="px-5 relative">
          <div className="absolute -top-12 md:-top-16 left-5">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full p-1.5 shadow-xl">
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-full" />
            </div>
          </div>
          
          <div className="pt-14 md:pt-20">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 capitalize tracking-tight">
              {lojaSlug.replace("-", " ")}
            </h1>
            
            <div className="flex items-center gap-3 mt-2 text-sm font-bold text-slate-500">
              <span className="flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">
                <Star size={14} className="fill-orange-500" /> 4.9
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} /> 30-45 min
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Aberto
              </span>
            </div>
            
            {/* Banner Gamificação */}
            <div className="mt-5 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 p-3 rounded-[16px] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Flame size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-orange-700">Clube de Fogo</p>
                  <p className="text-xs font-bold text-orange-500/80">R$ 1 = 1 Ponto. Peça e ganhe!</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO DE CATEGORIAS (STICKY) */}
      <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-xl py-3 px-5 border-b border-slate-200">
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {categorias.map(cat => (
            <button 
              key={cat} 
              onClick={() => setCategoriaAtiva(cat)}
              className={`px-5 py-2.5 rounded-full text-[13px] font-black tracking-wide whitespace-nowrap transition-all shadow-sm ${
                categoriaAtiva === cat 
                ? 'bg-slate-900 text-white shadow-lg scale-105' 
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* VITRINE DE PRODUTOS */}
      <div className="px-5 py-6 max-w-3xl mx-auto">
        <h2 className="text-xl font-black text-slate-800 mb-4">{categoriaAtiva}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtrados.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              <p className="font-bold">Nenhum prato nesta categoria.</p>
            </div>
          ) : (
            filtrados.map((prato, idx) => (
              <div key={prato.id} className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 flex gap-4 transition-transform active:scale-[0.98] relative overflow-hidden group">
                
                {/* Info Textual */}
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-black text-slate-800 text-[15px] leading-tight mb-1">{prato.nome}</h3>
                  <p className="text-[12px] font-medium text-slate-500 line-clamp-2 leading-relaxed mb-3">
                    {prato.descricao || "Acompanha molho especial da casa e aquele toque de chef."}
                  </p>
                  <div className="flex items-center gap-3 mt-auto">
                    <span className="font-black text-slate-900 text-[15px]">
                      R$ {parseFloat(prato.preco).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                      +{Math.floor(prato.preco)} 🔥
                    </span>
                  </div>
                </div>
                
                {/* Imagem do Produto + Botão Adicionar */}
                <div className="relative">
                  <div className="w-28 h-28 bg-slate-100 rounded-[20px] bg-cover bg-center border border-slate-100 shadow-inner flex items-center justify-center text-slate-300 overflow-hidden"
                       style={{ backgroundImage: prato.imagem_url ? `url(${prato.imagem_url})` : 'none' }}>
                    {!prato.imagem_url && <Flame size={32} className="opacity-20"/>}
                  </div>
                  
                  {/* Plus Button flutuante sobre a imagem */}
                  <button 
                    onClick={() => addCarrinho(prato)} 
                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.1)] border border-slate-100 hover:scale-110 hover:bg-slate-900 hover:text-white transition-all z-10"
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* FLOAT BUTTON CARRINHO (SACOLA) - Premium Animado */}
      {carrinho.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 md:pb-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-40 pointer-events-none flex justify-center">
          <div className="pointer-events-auto w-full max-w-md animate-in slide-in-from-bottom-6 duration-300">
            <button 
              onClick={() => router.push(`/delivery/${lojaSlug}/carrinho`)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-[20px] font-black flex items-center justify-between shadow-[0_15px_40px_rgba(15,23,42,0.3)] active:scale-[0.98] transition-all overflow-hidden relative group"
            >
              {/* Efeito de brilho de fundo no botão */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center relative">
                  <ShoppingBag size={20} />
                  {/* Badge de Quantidade saltando */}
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-slate-900 animate-bounce">
                    {qtdCarrinho}
                  </div>
                </div>
                <span className="text-left text-[15px] tracking-wide">Ver Sacola</span>
              </div>
              
              <div className="flex items-center gap-2 relative z-10">
                <span className="text-[16px]">R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
                <ChevronRight size={20} className="text-slate-400" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Style in-line para o shimmer effect */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
