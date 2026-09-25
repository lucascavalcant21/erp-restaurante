"use client";

import { MessageSquare } from "lucide-react";

export default function ContatosPage() {
  return (
    <main className="p-8 max-w-7xl mx-auto h-full flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
        <MessageSquare size={40} />
      </div>
      <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Novos Contatos</h1>
      <p className="text-slate-500 font-medium max-w-md">
        A caixa de entrada de leads vindos de formulários e redes sociais está em construção.
      </p>
    </main>
  );
}
