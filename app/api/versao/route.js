import { NextResponse } from "next/server";

// Qual commit está publicado AGORA, no servidor.
//
// O app carrega o SHA do próprio build congelado no bundle
// (NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) e compara com o que esta rota devolve.
// Diferente = saiu deploy novo e a janela aberta está atrasada.
//
// Precisa ser dinâmica e sem cache: uma resposta guardada devolveria
// exatamente a versão velha que estamos tentando detectar.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    || "dev";

  return NextResponse.json({ sha }, {
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
