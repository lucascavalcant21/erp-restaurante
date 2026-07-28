"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

// O auto cadastro antigo permitia que o visitante escolhesse o próprio papel,
// inclusive Administrador. As contas agora são criadas somente pelo painel
// administrativo e já nascem com perfil, escopo e senha temporária.
export default function CadastroPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: "var(--surface)" }}>
      <div className="erp-card w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <ShieldCheck size={27} />
        </div>
        <h1 className="text-xl font-black" style={{ color: "var(--fg)" }}>Acesso controlado</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed" style={{ color: "var(--dim)" }}>
          Por segurança, novos usuários são criados pelo administrador do Hefisto,
          com o perfil e as unidades corretas.
        </p>
        <p className="mt-3 text-sm font-bold" style={{ color: "var(--muted)" }}>
          Solicite seu login ao responsável pela sua unidade.
        </p>
        <button onClick={() => router.replace("/login")} className="erp-btn erp-btn-primary mt-6 w-full !h-12">
          <ArrowLeft size={16} /> Voltar ao login
        </button>
      </div>
    </div>
  );
}
