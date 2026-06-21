"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, ChevronRight, Flame, Plus, Minus, Search, CreditCard } from "lucide-react";
import { fetchCardapioDigital } from "../../lib/delivery";

export default function LojaDeliveryPage({ params }) {
  const lojaSlug = params.loja;
  const router = useRouter();
  
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carrinho, setCarrinho] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  
  // Exemplo de como usar o local storage para manter o carrinho (simplificado aqui)
  useEffect(() => {
    carregarMenu();
  }, []);

  const carregarMenu = async () => {
    setLoading(true);
    const { data } = await fetchCardapioDigital(lojaSlug);
    setCatalogo(data || []);
    setLoading(false);
  };

  const addCarrinho = (produto) => {
    const existe = carrinho.find(c => c.id === produto.id);
    if (existe) {
      setCarrinho(carrinho.map(c => c.id === produto.id ? { ...c, qtd: c.qtd + 1 } : c));
    } else {
      setCarrinho([...carrinho, { ...produto, qtd: 1 }]);
    }
  };

  const totalCarrinho = carrinho.reduce((acc, c) => acc + (c.preco * c.qtd), 0);
  const qtdCarrinho = carrinho.reduce((acc, c) => acc + c.qtd, 0);

  const categorias = ["Todos", ...Array.from(new Set(catalogo.map(p => p.categoria)))];
  const filtrados = categoriaAtiva === "Todos" ? catalogo : catalogo.filter(p => p.categoria === categoriaAtiva);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin text-orange-500"><Flame size={40} /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* HEADER DA LOJA */}
      <header className="bg-slate-900 text-white p-6 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 translate-x-1/4 -translate-y-1/4">
          <Flame size={200} />
        </div>
        <div className="relative z-10 flex items-center gap-4 mt-4">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/10">
            <Flame size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight capitalize">{lojaSlug.replace("-", " ")}</h1>
            <p className="text-sm text-slate-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Aberto para Delivery
            </p>
          </div>
        </div>
        
        {/* Banner Gamificação */}
        <div className="mt-6 bg-white/10 border border-white/10 p-3 rounded-xl flex items-center gap-3 backdrop-blur-sm">
          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400">
            <Flame size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-400">Ganhe Pontos de Fogo 🔥</p>
            <p className="text-xs text-slate-300">R$ 1 = 1 Ponto. Troque por pratos e descontos!</p>
          </div>
        </div>
      </header>

      {/* CATEGORIAS (SCROLL HORIZONTAL) */}
      <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md pt-4 pb-3 px-4 border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categorias.map(cat => (
            <button key={cat} onClick={() => setCategoriaAtiva(cat)}
              className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm ${
                categoriaAtiva === cat 
                ? 'bg-slate-900 text-white border-2 border-slate-900' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-500 hover:text-orange-600'
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* LISTAGEM DO CARDÁPIO */}
      <div className="p-4 space-y-4">
        {filtrados.length === 0 ? (
          <p className="text-center text-slate-400 py-10">Nenhum prato encontrado.</p>
        ) : (
          filtrados.map(prato => (
            <div key={prato.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 transition active:scale-95">
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{prato.nome}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{prato.descricao || "Sem descrição"}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-bold text-slate-900">R$ {parseFloat(prato.preco).toFixed(2).replace('.', ',')}</span>
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    +{Math.floor(prato.preco)} 🔥
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col items-end justify-between">
                <div className="w-24 h-24 bg-slate-100 rounded-xl bg-cover bg-center border border-slate-200 flex items-center justify-center text-slate-300"
                     style={{ backgroundImage: prato.imagem_url ? `url(${prato.imagem_url})` : 'none' }}>
                  {!prato.imagem_url && <Flame size={32} className="opacity-20"/>}
                </div>
                <button onClick={() => addCarrinho(prato)} className="mt-[-15px] mr-2 w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:bg-orange-600 transition">
                  <Plus size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FLOAT BUTTON CARRINHO */}
      {carrinho.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 to-transparent z-40 pointer-events-none">
          <button 
            onClick={() => {
              localStorage.setItem("carrinho", JSON.stringify(carrinho));
              router.push(`/delivery/${lojaSlug}/carrinho`);
            }}
            className="pointer-events-auto w-full bg-orange-600 text-white p-4 rounded-2xl font-bold flex items-center justify-between shadow-2xl shadow-orange-600/30 active:scale-95 transition">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <ShoppingBag size={18} />
              </div>
              <span className="text-left">
                <span className="block text-xs font-normal text-white/80">{qtdCarrinho} itens</span>
                <span className="block text-sm">Ver Sacola</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
              <ChevronRight size={20} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
