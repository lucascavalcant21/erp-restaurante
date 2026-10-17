"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Flame, AlertCircle, Plus, Minus, Trash2 } from "lucide-react";
import { calcularTaxaEntrega, gerarCheckoutPagSeguro, finalizarPedidoDelivery } from "../../../lib/delivery";
import { mascaraTelefone } from "../../../lib/mascaras.mjs";

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
    try {
      const salvo = localStorage.getItem("carrinho");
      if (salvo) setCarrinho(JSON.parse(salvo));
    } catch (e) {}
  }, []);

  const salvarCarrinho = (novo) => {
    setCarrinho(novo);
    try {
      localStorage.setItem("carrinho", JSON.stringify(novo));
    } catch (e) {}
  };

  const alterarQtd = (id, delta) => {
    const atualizado = carrinho
      .map((it) => {
        if (it.id === id) {
          return { ...it, qtd: it.qtd + delta };
        }
        return it;
      })
      .filter((it) => it.qtd > 0);
    salvarCarrinho(atualizado);
  };

  const removerItem = (id) => {
    salvarCarrinho(carrinho.filter((it) => it.id !== id));
  };

  const totalItens = carrinho.reduce(
    (acc, c) => acc + (Number(c.precoTotalUnitario || c.preco) * c.qtd),
    0
  );
  const totalGeral = totalItens + (taxa?.taxaReais || 0);
  const totalPontos = Math.floor(totalGeral);

  // Busca a taxa quando o CEP tem 8 dígitos
  useEffect(() => {
    const cepLimpo = form.cep.replace(/\D/g, "");
    if (cepLimpo.length === 8) {
      setLoadingTaxa(true);
      fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
        .then((res) => res.json())
        .then(async (data) => {
          if (data.erro) {
            setErro("CEP não encontrado");
            setLoadingTaxa(false);
            return;
          }
          const endStr = `${data.logradouro}, ${data.bairro}, ${data.localidade}-${data.uf}`;
          setForm((f) => ({ ...f, endereco: endStr }));

          const resTaxa = await calcularTaxaEntrega("Endereço Loja", cepLimpo);
          setTaxa(resTaxa);
          setErro("");
          setLoadingTaxa(false);
        })
        .catch(() => {
          setErro("Falha ao consultar CEP");
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
      setErro("Preencha todos os dados e valide o CEP.");
      return;
    }
    setProcessando(true);
    setErro("");

    const pedido = { ...form, total: totalGeral, taxaEntrega: taxa.taxaReais };
    const pgto = await gerarCheckoutPagSeguro(pedido);

    const resHefisto = await finalizarPedidoDelivery(pedido, carrinho, "seldeestrela");

    setProcessando(false);

    if (resHefisto.ok) {
      setPagamentoInfo(pgto);
      setEtapa("sucesso");
      try {
        localStorage.removeItem("carrinho");
      } catch (e) {}
    } else {
      setErro("Erro ao finalizar: " + resHefisto.error);
    }
  };

  if (etapa === "sucesso") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Pedido na Cozinha!</h1>
        <p className="text-slate-400 mb-8 max-w-sm">
          Seu pedido já foi impresso para o chef e está sendo preparado com muito cuidado. O motoboy sairá em breve.
        </p>

        <div className="bg-white/10 p-6 rounded-2xl border border-white/10 w-full max-w-sm mb-6">
          <p className="text-amber-400 font-bold mb-1 flex items-center justify-center gap-2">
            <Flame size={20} /> Você ganhou +{totalPontos} Pontos no Clube de Fogo!
          </p>
          <p className="text-xs text-slate-400">Esses pontos já estão registrados com o seu número de WhatsApp.</p>
        </div>

        {pagamentoInfo?.metodo === "PIX" && (
          <div className="bg-white text-slate-800 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-xl">
            <h2 className="font-bold">Pagamento Inteligente (PIX)</h2>
            <div className="p-3 bg-slate-100 rounded-lg text-xs break-all border border-slate-300 font-mono">
              {pagamentoInfo.pixCopiaECola}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(pagamentoInfo.pixCopiaECola);
                alert("Código PIX copiado com sucesso!");
              }}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold"
            >
              Copiar PIX Copia e Cola
            </button>
            <p className="text-xs text-slate-500 mt-2">Pague agora para liberar a entrega rápida.</p>
          </div>
        )}

        {pagamentoInfo?.metodo === "CARTAO" && (
          <div className="w-full max-w-sm mt-4">
            <button
              onClick={() => window.open(pagamentoInfo.linkCheckout, "_blank")}
              className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <CreditCard size={20} /> Pagar com Cartão Seguramente
            </button>
          </div>
        )}

        <button
          onClick={() => router.push(`/delivery/${lojaSlug}`)}
          className="mt-8 text-sm text-slate-400 underline hover:text-white"
        >
          Voltar para o Cardápio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <header className="bg-white px-4 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-sm border-b border-slate-200">
        <button
          onClick={() => (etapa === "checkout" ? setEtapa("sacola") : router.back())}
          className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-black">
          {etapa === "sacola" ? "Sua Sacola" : "Finalizar Pedido"}
        </h1>
      </header>

      <main className="flex-1 p-4 pb-36 max-w-md mx-auto w-full">
        {etapa === "sacola" && (
          <div className="space-y-4">
            {carrinho.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl p-6 border border-slate-200">
                <p className="font-bold text-slate-500">Sua sacola está vazia.</p>
                <button
                  onClick={() => router.push(`/delivery/${lojaSlug}`)}
                  className="mt-4 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black"
                >
                  Ver Cardápio
                </button>
              </div>
            ) : (
              carrinho.map((c) => {
                const itemPreco = Number(c.precoTotalUnitario || c.preco);
                const custom = c.customizacao;
                return (
                  <div
                    key={c.id}
                    className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-900 text-sm leading-snug">
                          {c.nome}
                        </h3>
                        <p className="text-xs font-black text-slate-800 mt-1">
                          R$ {(itemPreco * c.qtd).toFixed(2).replace(".", ",")}
                          <span className="text-slate-400 font-normal ml-1">
                            (R$ {itemPreco.toFixed(2).replace(".", ",")} cada)
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => removerItem(c.id)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Detalhes de Customização iFood */}
                    {custom && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-3xs font-medium text-slate-600 space-y-1">
                        {custom.ponto && (
                          <p><span className="font-bold text-slate-800">Ponto:</span> {custom.ponto}</p>
                        )}
                        {custom.acompanhamentos?.length > 0 && (
                          <p><span className="font-bold text-slate-800">Acompanhamentos:</span> {custom.acompanhamentos.join(", ")}</p>
                        )}
                        {custom.adicionais?.length > 0 && (
                          <p><span className="font-bold text-purple-700">Adicionais:</span> {custom.adicionais.map((a) => `${a.nome} (+R$ ${Number(a.preco).toFixed(2)})`).join(", ")}</p>
                        )}
                        {custom.remocoes?.length > 0 && (
                          <p><span className="font-bold text-red-600">Sem:</span> {custom.remocoes.join(", ")}</p>
                        )}
                        {custom.obs && (
                          <p><span className="font-bold text-slate-800">Obs:</span> {custom.obs}</p>
                        )}
                      </div>
                    )}

                    {/* Controles de Quantidade */}
                    <div className="flex items-center justify-end gap-3 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => alterarQtd(c.id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-xs text-slate-900 w-4 text-center">
                        {c.qtd}
                      </span>
                      <button
                        onClick={() => alterarQtd(c.id, 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {carrinho.length > 0 && (
              <>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-amber-900">Total em Pontos</p>
                    <p className="text-3xs text-amber-700">Você acumulará no Clube de Fogo</p>
                  </div>
                  <div className="flex items-center gap-1 font-black text-lg text-amber-600">
                    +{Math.floor(totalItens)} <Flame size={20} />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2 mt-4">
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <span>Subtotal</span>
                    <span>R$ {totalItens.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {etapa === "checkout" && (
          <div className="space-y-5 animate-in slide-in-from-right duration-300">
            {/* Dados do Cliente */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-black text-sm border-b pb-2 text-slate-900">Seus Dados de Contato</h2>
              <input
                type="text"
                placeholder="Nome Completo"
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium outline-none focus:border-slate-800"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
              <input
                type="tel"
                placeholder="WhatsApp (DDD) 99999-9999"
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium outline-none focus:border-slate-800"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })}
              />
            </div>

            {/* Endereço de Entrega */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-black text-sm border-b pb-2 flex items-center gap-2 text-slate-900">
                <MapPin size={18} className="text-amber-500" /> Endereço de Entrega
              </h2>
              <input
                type="text"
                placeholder="CEP (Apenas números)"
                maxLength={8}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-slate-800 font-bold tracking-widest text-center text-xs"
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
              />

              {loadingTaxa && (
                <p className="text-xs text-slate-400 text-center animate-pulse">
                  Calculando distância e rota...
                </p>
              )}

              {form.endereco && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-200">
                  <p className="font-medium text-slate-700">{form.endereco}</p>
                  <input
                    type="text"
                    placeholder="Número e Complemento (Apto, Bloco)"
                    className="w-full bg-white border border-slate-200 p-2.5 rounded-lg outline-none text-xs"
                    onChange={(e) =>
                      setForm({ ...form, endereco: `${form.endereco}, ${e.target.value}` })
                    }
                  />
                </div>
              )}

              {taxa && (
                <div className="flex justify-between bg-emerald-50 text-emerald-800 p-3 rounded-xl text-xs font-bold border border-emerald-200">
                  <span>Taxa de Entrega ({taxa.distanciaKm} km)</span>
                  <span>R$ {taxa.taxaReais.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
            </div>

            {/* Pagamento */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-black text-sm border-b pb-2 flex items-center gap-2 text-slate-900">
                <CreditCard size={18} className="text-amber-500" /> Forma de Pagamento
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, formaPagamento: "PIX" })}
                  className={`flex-1 py-3 rounded-xl font-black text-xs border-2 transition ${
                    form.formaPagamento === "PIX"
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  PIX Instantâneo
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, formaPagamento: "CARTAO" })}
                  className={`flex-1 py-3 rounded-xl font-black text-xs border-2 transition ${
                    form.formaPagamento === "CARTAO"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  Cartão Online
                </button>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl flex items-center gap-2 text-xs font-bold border border-red-100">
                <AlertCircle size={18} /> {erro}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER TOTAL E BOTÃO FIXO */}
      {carrinho.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 px-4 sm:px-6 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-end mb-3">
              <span className="text-xs text-slate-500 font-bold">Total do Pedido</span>
              <span className="text-xl font-black text-slate-900">
                R$ {totalGeral.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {etapa === "sacola" ? (
              <button
                onClick={finalizarSacola}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-2xl font-black text-xs sm:text-sm active:scale-95 transition shadow-lg shadow-slate-900/20"
              >
                Continuar para Entrega
              </button>
            ) : (
              <button
                onClick={confirmarPedido}
                disabled={processando || !taxa}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black text-xs sm:text-sm active:scale-95 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processando ? "Enviando à Cozinha..." : "Confirmar e Enviar Pedido"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
