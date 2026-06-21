"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Flame, AlertCircle } from "lucide-react";
import { calcularTaxaEntrega, gerarCheckoutPagSeguro, finalizarPedidoDelivery } from "../../../lib/delivery";

export default function CarrinhoPage({ params }) {
  const lojaSlug = params.loja;
  const router = useRouter();

  const [carrinho, setCarrinho] = useState([]);
  const [etapa, setEtapa] = useState("sacola"); // sacola -> checkout -> sucesso
  
  // Dados Checkout
  const [form, setForm] = useState({ nome: "", telefone: "", cep: "", endereco: "", formaPagamento: "PIX" });
  const [taxa, setTaxa] = useState(null);
  const [loadingTaxa, setLoadingTaxa] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [pagamentoInfo, setPagamentoInfo] = useState(null); // Retorno do PagSeguro

  useEffect(() => {
    const salvo = localStorage.getItem("carrinho");
    if (salvo) setCarrinho(JSON.parse(salvo));
  }, []);

  const totalItens = carrinho.reduce((acc, c) => acc + (c.preco * c.qtd), 0);
  const totalGeral = totalItens + (taxa?.taxaReais || 0);
  const totalPontos = Math.floor(totalGeral);

  // Busca a taxa quando o CEP tem 8 dígitos
  useEffect(() => {
    const cepLimpo = form.cep.replace(/\D/g, "");
    if (cepLimpo.length === 8) {
      setLoadingTaxa(true);
      // Pega endereço real pela API ViaCEP
      fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
        .then(res => res.json())
        .then(async (data) => {
          if (data.erro) { setErro("CEP não encontrado"); setLoadingTaxa(false); return; }
          const endStr = `${data.logradouro}, ${data.bairro}, ${data.localidade}-${data.uf}`;
          setForm(f => ({ ...f, endereco: endStr }));
          
          // Calcular Taxa via API do Google (simulada na lib)
          const resTaxa = await calcularTaxaEntrega("Endereço Loja", cepLimpo);
          setTaxa(resTaxa);
          setErro("");
          setLoadingTaxa(false);
        });
    }
  }, [form.cep]);

  const finalizarSacola = () => {
    if (carrinho.length === 0) return;
    setEtapa("checkout");
  };

  const confirmarPedido = async () => {
    if (!form.nome || !form.telefone || !form.endereco || !taxa) {
      setErro("Preencha todos os dados e valide o CEP."); return;
    }
    setProcessando(true); setErro("");

    // 1. Gera o Checkout no PagSeguro (Simulado)
    const pedido = { ...form, total: totalGeral, taxaEntrega: taxa.taxaReais };
    const pgto = await gerarCheckoutPagSeguro(pedido);
    
    // 2. Salva no KDS do Hefisto e processa Gamificação
    // A unidade precisaria ser a real, mas como não temos auth aqui, vamos simular ou buscar do slug.
    const resHefisto = await finalizarPedidoDelivery(pedido, carrinho, "todas"); // "todas" ou o ID real da loja

    setProcessando(false);

    if (resHefisto.ok) {
      setPagamentoInfo(pgto);
      setEtapa("sucesso");
      localStorage.removeItem("carrinho");
    } else {
      setErro("Erro ao finalizar: " + resHefisto.error);
    }
  };

  if (etapa === "sucesso") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Pedido na Cozinha!</h1>
        <p className="text-slate-400 mb-8 max-w-sm">
          Seu pedido já foi impresso para o chef e está sendo preparado. O motoboy sairá em breve.
        </p>

        <div className="bg-white/10 p-6 rounded-2xl border border-white/10 w-full max-w-sm mb-6">
          <p className="text-orange-400 font-bold mb-1 flex items-center justify-center gap-2">
            <Flame size={20} /> Você ganhou +{totalPontos} Pontos!
          </p>
          <p className="text-xs text-slate-300">Esses pontos de fogo já estão na sua carteira digital.</p>
        </div>

        {pagamentoInfo?.metodo === "PIX" && (
          <div className="bg-white text-slate-900 p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h2 className="font-bold">Pagamento Inteligente (PagSeguro)</h2>
            <div className="p-3 bg-slate-100 rounded-lg text-xs break-all border border-slate-300 font-mono">
              {pagamentoInfo.pixCopiaECola}
            </div>
            <button onClick={() => navigator.clipboard.writeText(pagamentoInfo.pixCopiaECola)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">
              Copiar PIX Copia e Cola
            </button>
            <p className="text-xs text-slate-500 mt-2">Pague agora para liberar a entrega.</p>
          </div>
        )}

        {pagamentoInfo?.metodo === "CARTAO" && (
          <div className="w-full max-w-sm mt-4">
            <button onClick={() => window.open(pagamentoInfo.linkCheckout, "_blank")} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">
              <CreditCard size={20} /> Pagar com Cartão Seguramente
            </button>
          </div>
        )}

        <button onClick={() => router.push(`/delivery/${lojaSlug}`)} className="mt-8 text-sm text-slate-400 underline">
          Voltar para a loja
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white px-4 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-sm border-b border-slate-200">
        <button onClick={() => etapa === "checkout" ? setEtapa("sacola") : router.back()} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">
          {etapa === "sacola" ? "Sua Sacola" : "Finalizar Pedido"}
        </h1>
      </header>

      <main className="flex-1 p-4 pb-32 max-w-md mx-auto w-full">
        {etapa === "sacola" && (
          <div className="space-y-4">
            {carrinho.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">{c.qtd}x {c.nome}</h3>
                  <p className="text-sm font-bold text-slate-600 mt-2">R$ {(c.preco * c.qtd).toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
            ))}
            
            <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-orange-800">Total em Pontos</p>
                <p className="text-xs text-orange-600">O que você ganha com este pedido</p>
              </div>
              <div className="flex items-center gap-1 font-bold text-xl text-orange-600">
                +{Math.floor(totalItens)} <Flame size={24} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2 mt-6">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>R$ {totalItens.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </div>
        )}

        {etapa === "checkout" && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            {/* Dados do Cliente */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-bold text-lg border-b pb-2">Seus Dados</h2>
              <input type="text" placeholder="Nome Completo" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-slate-400"
                value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
              <input type="tel" placeholder="WhatsApp (DDD) 99999-9999" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-slate-400"
                value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
            </div>

            {/* Entrega (Integração Google Maps Simulado) */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-bold text-lg border-b pb-2 flex items-center gap-2"><MapPin size={20}/> Endereço de Entrega</h2>
              <input type="text" placeholder="CEP (Apenas números)" maxLength={8} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-slate-400 font-bold tracking-widest text-center"
                value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} />
              
              {loadingTaxa && <p className="text-sm text-slate-500 text-center animate-pulse">Calculando distância (Google Maps)...</p>}
              
              {form.endereco && (
                <div className="p-3 bg-slate-100 rounded-xl text-sm">
                  <p className="font-medium text-slate-700">{form.endereco}</p>
                  <input type="text" placeholder="Número e Complemento" className="w-full mt-2 bg-white border border-slate-200 p-2 rounded-lg outline-none text-sm"
                    onChange={e => setForm({...form, endereco: `${form.endereco}, ${e.target.value}`})} />
                </div>
              )}

              {taxa && (
                <div className="flex justify-between bg-emerald-50 text-emerald-800 p-3 rounded-xl text-sm font-bold border border-emerald-200">
                  <span>Taxa de Entrega ({taxa.distanciaKm} km)</span>
                  <span>R$ {taxa.taxaReais.toFixed(2).replace('.',',')}</span>
                </div>
              )}
            </div>

            {/* Pagamento (PagSeguro) */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-bold text-lg border-b pb-2 flex items-center gap-2"><CreditCard size={20}/> Pagamento (PagSeguro)</h2>
              <div className="flex gap-2">
                <button onClick={() => setForm({...form, formaPagamento: "PIX"})} className={`flex-1 py-3 rounded-xl font-bold border-2 transition ${form.formaPagamento === "PIX" ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-100 text-slate-400'}`}>PIX</button>
                <button onClick={() => setForm({...form, formaPagamento: "CARTAO"})} className={`flex-1 py-3 rounded-xl font-bold border-2 transition ${form.formaPagamento === "CARTAO" ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'}`}>CARTÃO</button>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 text-sm font-bold">
                <AlertCircle size={20} /> {erro}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER TOTAL */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 px-6 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-end mb-4">
          <span className="text-slate-500 font-medium">Total a Pagar</span>
          <span className="text-2xl font-bold text-slate-900">R$ {totalGeral.toFixed(2).replace('.', ',')}</span>
        </div>
        
        {etapa === "sacola" ? (
          <button onClick={finalizarSacola} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold active:scale-95 transition shadow-lg">
            Continuar para Endereço
          </button>
        ) : (
          <button onClick={confirmarPedido} disabled={processando || !taxa} className="w-full bg-orange-600 text-white p-4 rounded-2xl font-bold active:scale-95 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {processando ? "Processando Pagamento..." : "Confirmar e Pagar"}
          </button>
        )}
      </div>
    </div>
  );
}
