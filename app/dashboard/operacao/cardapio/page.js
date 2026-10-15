"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { ArrowLeft, QrCode, Copy, ExternalLink, Smartphone, ArrowDown, Sparkles, UtensilsCrossed } from "lucide-react";

export default function CardapioGeradorPage() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const { unidadeAtiva, unidadeInfo } = useERP();

  const [tipoCardapio, setTipoCardapio] = useState("experience"); // "experience" ou "delivery"
  const [mesaFiltro, setMesaFiltro] = useState("");
  const [urlPublica, setUrlPublica] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    if (unidadeAtiva && typeof window !== "undefined") {
      const baseUrl = window.location.origin;
      let link = "";

      if (tipoCardapio === "experience") {
        link = mesaFiltro.trim()
          ? `${baseUrl}/experience/${unidadeAtiva}/${encodeURIComponent(mesaFiltro.trim())}`
          : `${baseUrl}/experience/${unidadeAtiva}`;
      } else {
        link = `${baseUrl}/cardapio/${unidadeAtiva}`;
      }

      setUrlPublica(link);
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(link)}&color=0f172a`);
    }
  }, [unidadeAtiva, tipoCardapio, mesaFiltro]);

  const copiarLink = () => {
    navigator.clipboard.writeText(urlPublica);
    alert("Link copiado com sucesso!");
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-hf-bg">
      {/* TOPBAR */}
      <div className="bg-card border-b border-line py-4 sm:py-6 px-4 sm:px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button onClick={() => abrirMenu()} className="p-3 text-fg hover:text-slate-800 bg-white rounded-full border border-line">
              <ArrowLeft size={20} />
            </button>
            <div className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl bg-amber-500/10 text-amber-600 items-center justify-center border border-amber-500/20">
              <Sparkles size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-fg">Héfisto Experience & Cardápio</h1>
              <p className="text-fg-soft font-bold uppercase tracking-widest text-xs mt-1">Gere os QR Codes das mesas e do salão</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        {/* SELETOR DE MODO */}
        <div className="bg-card p-1.5 rounded-2xl border border-line flex gap-1 mb-8 max-w-md shadow-sm">
          <button
            onClick={() => setTipoCardapio("experience")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
              tipoCardapio === "experience"
                ? "bg-amber-600 text-white shadow-md shadow-amber-900/20"
                : "text-subtle hover:text-fg"
            }`}
          >
            <Sparkles size={16} /> Héfisto Experience (Mesas)
          </button>
          <button
            onClick={() => setTipoCardapio("delivery")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
              tipoCardapio === "delivery"
                ? "bg-card text-fg border border-line shadow-sm"
                : "text-subtle hover:text-fg"
            }`}
          >
            Cardápio Web Simples
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* LADO ESQUERDO (Ações e Link) */}
          <div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">
              {tipoCardapio === "experience" ? "O Restaurante na Palma da Mão" : "Cardápio Digital Rápido"}
            </h2>
            <p className="text-fg font-medium mb-6">
              {tipoCardapio === "experience"
                ? "O cliente escaneia o QR Code na mesa e tem acesso a fotos em alta definição, pedidos integrados à comanda, chamada de garçom e consulta de consumo em tempo real."
                : "Link direto para clientes consultarem pratos ou fazerem pedidos rápidos de entrega e balcão."}
            </p>

            {tipoCardapio === "experience" && (
              <div className="bg-card p-4 rounded-2xl border border-line mb-6">
                <label className="text-3xs font-bold uppercase tracking-widest text-fg block mb-1">
                  Mesa Específica (Opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mesaFiltro}
                    onChange={(e) => setMesaFiltro(e.target.value)}
                    placeholder="Ex: 04 ou deixe vazio para geral"
                    className="flex-1 bg-white border border-line rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"
                  />
                  {mesaFiltro && (
                    <button
                      onClick={() => setMesaFiltro("")}
                      className="px-3 py-2 bg-muted text-subtle text-xs font-bold rounded-xl"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="bg-card p-6 rounded-3xl border border-line shadow-sm mb-6">
              <label className="text-3xs font-bold uppercase tracking-widest text-fg mb-2 block">Link Oficial</label>
              <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-line-soft">
                <input
                  type="text"
                  readOnly
                  value={urlPublica}
                  className="flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none truncate"
                />
                <button
                  onClick={copiarLink}
                  className="p-2 bg-card rounded-lg border border-line text-fg hover:text-amber-600 transition-colors"
                  title="Copiar"
                >
                  <Copy size={16} />
                </button>
              </div>

              <a
                href={urlPublica}
                target="_blank"
                rel="noreferrer"
                className="mt-4 w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
              >
                <ExternalLink size={18} /> Testar Héfisto Experience
              </a>
            </div>

            <div className="bg-[#1c1613] text-amber-100 p-6 rounded-3xl shadow-lg border border-amber-900/30">
              <div className="flex gap-4 items-center mb-2">
                <Smartphone size={32} className="text-amber-400 opacity-80" />
                <h3 className="text-xl font-black text-amber-50">Mobile-First & Sem Login</h3>
              </div>
              <p className="text-amber-200/70 text-sm">
                Desenvolvido para máxima velocidade no celular dos clientes. Sem formulários cansativos, com navegação por toques rápidos e suporte a múltiplos idiomas (Português, Inglês e Espanhol).
              </p>
            </div>
          </div>

          {/* LADO DIREITO (QR Code Viewer) */}
          <div className="bg-card p-5 sm:p-8 rounded-3xl sm:rounded-[40px] border border-line shadow-xl flex flex-col items-center justify-center text-center min-w-0">
            <h3 className="text-xl font-black text-slate-800 mb-1">
              QR Code Oficial {mesaFiltro ? `• Mesa ${mesaFiltro}` : "• Salão"}
            </h3>
            <p className="text-sm text-fg font-medium mb-8">
              Imprima para os displays de mesa ou envie para a gráfica.
            </p>

            <div className="bg-white p-4 rounded-3xl border-4 border-line-soft shadow-sm relative group cursor-pointer hover:border-line transition-colors">
              {qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCodeUrl}
                  alt="QR Code Experience"
                  className="w-full max-w-64 aspect-square object-contain transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full max-w-64 aspect-square flex items-center justify-center bg-white text-fg">
                  <QrCode size={64} />
                </div>
              )}
              <div className="absolute inset-0 bg-amber-600/90 text-white rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center font-black">
                <ArrowDown size={32} className="mb-2" />
                Clique p/ Salvar
              </div>
            </div>

            <a
              href={qrCodeUrl}
              download={mesaFiltro ? `QR_Mesa_${mesaFiltro}.png` : "QR_Experience.png"}
              target="_blank"
              rel="noreferrer"
              className="mt-8 text-amber-600 hover:text-amber-700 font-black hover:underline uppercase tracking-widest text-sm"
            >
              Baixar Imagem em Alta Resolução
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
