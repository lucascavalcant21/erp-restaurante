// POST /api/intelligence/voz — áudio gravado no aparelho → texto.
//
// Mesma porta da Inteligência: sessão + unidade (resolverContexto), permissão
// "dashboard.intelligence.view" confirmada no banco e limite por minuto,
// porque usa a IA paga. Não grava nada e não vê dados: o texto volta para o
// celular, que o manda ao /api/intelligence/ask como qualquer mensagem (canal "voz").
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolverContexto } from "../../../lib/server/contexto.mjs";
import { authorizeAction } from "../../../lib/server/autorizacao.mjs";
import { dentroDoLimite } from "../../../lib/server/limite-por-ip.mjs";
import { depsDoContexto } from "../../../lib/intelligence/context/servidor.mjs";
import { transcrever, MAX_BYTES_AUDIO } from "../../../lib/server/transcricao.mjs";

export const maxDuration = 60;
export const runtime = "nodejs";

const SEM_CACHE = { "Cache-Control": "no-store" };
const erro = (status, mensagem) => NextResponse.json({ erro: mensagem }, { status, headers: SEM_CACHE });

export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() || null;
  const deps = depsDoContexto();
  const r = await resolverContexto({ token, unidadeSolicitada: request.headers.get("x-hefisto-unidade"), canal: "agente", requestId: randomUUID(), deps });
  if (!r.ok) return erro(r.status, r.mensagem);
  const ctx = r.contexto;
  const porta = await authorizeAction(ctx, "dashboard.intelligence.view", { acao: "inteligencia.voz", deps });
  if (!porta.ok) return erro(porta.status, porta.status === 403 ? "Seu perfil não tem acesso ao Assistente." : porta.mensagem);
  if (!dentroDoLimite(`inteligencia-voz:${ctx.userId}`, { maximo: 20, janelaMs: 60_000 })) return erro(429, "Muitos áudios em sequência. Aguarde um minuto.");

  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES_AUDIO + 64 * 1024) return erro(413, "Áudio grande demais. Fale em mensagens de até 1 minuto.");
  let arquivo = null;
  try {
    arquivo = (await request.formData()).get("audio");
  } catch {
    return erro(400, "Envio de áudio inválido.");
  }
  const t = await transcrever({ arquivo, chave: process.env.OPENAI_API_KEY, modelo: process.env.HEFISTO_MODELO_TRANSCRICAO || undefined });
  if (!t.ok) return erro(t.status, t.erro);
  return NextResponse.json({ texto: t.texto }, { headers: SEM_CACHE });
}
