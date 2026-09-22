import { NextResponse } from "next/server";
import { promptDaFichaIA, normalizarFichaIA } from "../../lib/ficha-ia.mjs";

// "Criar com IA": monta uma ficha a partir de uma receita em texto solto e/ou
// uma foto (print, caderno de receitas, foto do prato com anotação).
//
// O tipo manda no que a IA devolve. Em Pratos, sai uma ficha de MONTAGEM
// (ingredientes de um prato e como montar); em Pré-preparos, uma ficha de
// PRODUÇÃO (tempo, modo de preparo, equipamentos, alergênicos). O pedido e a
// limpeza da resposta ficam em lib/ficha-ia.mjs, com teste.
export async function POST(request) {
  try {
    const { texto, imagem_base64, imagem_media_type, departamento, tipo } = await request.json();

    if ((!texto || !texto.trim()) && !imagem_base64) {
      return NextResponse.json({ error: "Envie a receita em texto ou uma foto." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Ficha] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const prompt = promptDaFichaIA({ tipo, departamento });

    const contentBlocks = [];
    if (imagem_base64 && imagem_media_type) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: imagem_media_type, data: imagem_base64 },
      });
    }
    contentBlocks.push({ type: "text", text: `${prompt}\n\nRECEITA FORNECIDA PELO USUÁRIO (pode estar vazia se só houver imagem):\n${texto || "(nenhum)"}` });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 4000,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[IA Ficha] Erro da Anthropic:", errorData);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let texto_resp = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto_resp = texto_resp.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(texto_resp);
    } catch {
      const match = texto_resp.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Retorno da IA não é JSON válido.");
      obj = JSON.parse(match[0]);
    }

    const ficha = normalizarFichaIA(obj, { tipo });
    if (!ficha.ingredientes.length) {
      return NextResponse.json({ error: "Não encontrei ingredientes nessa receita." }, { status: 422 });
    }
    return NextResponse.json(ficha);
  } catch (error) {
    console.error("[IA Ficha] Catch:", error);
    return NextResponse.json({ error: "Não consegui montar a ficha a partir dessa receita. Tente reformular ou enviar uma foto mais nítida." }, { status: 500 });
  }
}
