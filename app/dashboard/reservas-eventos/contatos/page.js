"use client";

import { MessageSquare } from "lucide-react";

export default function ContatosPage() {
  return (
    <div className="rounded-2xl border border-dashed border-hf-border-strong bg-hf-surface/60 p-8 text-center">
      <MessageSquare size={32} className="mx-auto text-hf-muted" />
      <h2 className="mt-3 text-lg font-black text-hf-text">Novos contatos</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-hf-text-2">
        A caixa de entrada de pedidos vindos de formulários e redes sociais ainda não existe. Por enquanto, cadastre o contato no funil com “Novo evento”.
      </p>
    </div>
  );
}
