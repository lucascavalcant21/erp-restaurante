import { NextResponse } from "next/server";
import { sessaoOuNegar } from "../../../lib/server/sessao-rota.mjs";

// CHAVE PIX DAS ASSINATURAS (pedido do dono, 14/11/2026: "por enquanto vai ser
// no Nubank, chave Pix"). A chave é dado pessoal do dono, então NÃO vai no
// código (repositório público) nem no JavaScript do navegador: fica na
// variável HEFISTO_PIX_CHAVE do servidor e só sai para o administrador de uma
// empresa logado, na hora de pagar.

export const dynamic = "force-dynamic";

export async function GET(request) {
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;

  const { data: cadastro } = await sessao.db
    .from("usuarios_erp")
    .select("tipo_acesso, super_admin")
    .eq("auth_user_id", sessao.authUserId)
    .maybeSingle();
  if (!cadastro || !(cadastro.super_admin || cadastro.tipo_acesso === "administrador")) {
    return NextResponse.json({ error: "Só o administrador da empresa paga a assinatura." }, { status: 403 });
  }

  const chave = String(process.env.HEFISTO_PIX_CHAVE || "").trim();
  if (!chave) {
    return NextResponse.json({ error: "Pagamento por Pix ainda não configurado." }, { status: 503 });
  }
  return NextResponse.json(
    { chave, banco: String(process.env.HEFISTO_PIX_BANCO || "").trim() || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
