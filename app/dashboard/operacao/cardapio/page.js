"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { ArrowLeft, QrCode, Copy, ExternalLink, Smartphone, ArrowDown } from "lucide-react";

export default function CardapioGeradorPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [urlPublica, setUrlPublica] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    if (unidadeAtiva) {
       // Pega a URL raiz atual do navegador (Ex: https://meuerp.com.br ou http://localhost:3000)
       const baseUrl = window.location.origin;
       const link = `${baseUrl}/cardapio/${unidadeAtiva}`;
       
       setUrlPublica(link);
       
       // Usa a API gratuita do goqr.me para gerar o QRCode instantâneo
       setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(link)}&color=0f172a`);
    }
  }, [unidadeAtiva]);

  const copiarLink = () => {
     navigator.clipboard.writeText(urlPublica);
     alert("Link do cardápio copiado!");
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
                 <QrCode size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Cardápio Digital</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Gere o QR Code para as mesas</p>
              </div>
            </div>
         </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-10">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* LADO ESQUERDO (Ações e Link) */}
            <div>
               <h2 className="text-2xl font-black text-slate-800 mb-2">Compartilhe seu Menu</h2>
               <p className="text-slate-500 font-medium mb-8">
                 Seus clientes não precisam baixar aplicativos. Basta eles apontarem a câmera para o QR Code e o seu cardápio será aberto instantaneamente no celular deles.
               </p>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Link Oficial</label>
                  <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <input type="text" readOnly value={urlPublica} className="flex-1 bg-transparent text-sm font-bold text-slate-600 outline-none truncate"/>
                     <button onClick={copiarLink} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600 transition-colors" title="Copiar"><Copy size={16}/></button>
                  </div>

                  <a href={urlPublica} target="_blank" className="mt-4 w-full py-4 bg-slate-50 hover:bg-slate-100 text-emerald-600 font-black rounded-xl transition-all flex items-center justify-center gap-2">
                     <ExternalLink size={18}/> Testar o Cardápio
                  </a>
               </div>

               <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg shadow-emerald-600/20">
                  <div className="flex gap-4 items-center mb-2">
                     <Smartphone size={32} className="opacity-50"/>
                     <h3 className="text-xl font-black">Design Mobile-First</h3>
                  </div>
                  <p className="text-blue-100 text-sm">O cardápio foi construído com a mesma tecnologia de grandes apps. Ele se adapta a qualquer celular e não requer que o cliente faça login para visualizar os pratos.</p>
               </div>
            </div>

            {/* LADO DIREITO (QR Code Viewer) */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl flex flex-col items-center justify-center text-center">
               <h3 className="text-xl font-black text-slate-800 mb-2">O QR Code Oficial</h3>
               <p className="text-sm text-slate-500 font-medium mb-8">Salve a imagem abaixo para enviar para a gráfica imprimir nos displays acrílicos das suas mesas.</p>
               
               <div className="bg-white p-4 rounded-3xl border-4 border-slate-100 shadow-sm relative group cursor-pointer hover:border-slate-200 transition-colors">
                  {qrCodeUrl ? (
                     // eslint-disable-next-line @next/next/no-img-element
                     <img src={qrCodeUrl} alt="QR Code Cardapio" className="w-64 h-64 object-contain transition-transform group-hover:scale-105" />
                  ) : (
                     <div className="w-64 h-64 flex items-center justify-center bg-slate-50 text-slate-500">
                        <QrCode size={64}/>
                     </div>
                  )}
                  <div className="absolute inset-0 bg-emerald-600/90 text-white rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center font-black">
                     <ArrowDown size={32} className="mb-2"/>
                     Clique p/ Salvar
                  </div>
               </div>

               <a href={qrCodeUrl} download="QR_Cardapio.png" target="_blank" className="mt-8 text-emerald-600 font-black hover:underline uppercase tracking-widest text-sm">
                  Baixar Imagem em Alta Resolução
               </a>
            </div>

         </div>
      </div>
    </div>
  );
}
