import { NextResponse } from "next/server";
import { exigirSessao } from "./autorizacao-unidade.mjs";

// PORTA DAS ROTAS QUE GASTAM IA OU MEXEM EM DADO (SEC-API-1)
//
// As rotas /api/ia-*, /api/hefisto e /api/ocr chamavam a IA paga sem
// perguntar quem era: qualquer pessoa na internet usava a chave do Héfisto.
// Agora a sessão do Supabase é obrigatória e precisa resolver num cadastro
// ATIVO do ERP (exigirSessao). Falha fechada: sem credencial no servidor,
// nada sai.
//
// Uso:
//   const sessao = await sessaoOuNegar(request);
//   if (sessao.resposta) return sessao.resposta;
export async function sessaoOuNegar(request) {
  const s = await exigirSessao(request);
  if (s.erro) {
    return { resposta: NextResponse.json({ error: s.erro.mensagem, codigo: s.erro.codigo }, { status: s.erro.status }) };
  }
  return s;
}
