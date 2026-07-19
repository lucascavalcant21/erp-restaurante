import { NextResponse } from "next/server";

// Lê a contagem de estoque: FOTO da planilha preenchida à mão e/ou TEXTO ditado
// por voz ("banana cinco quilos, tomate três caixas"). Devolve item + quantidade.
export async function POST(request) {
  try {
    const { imagem_base64, media_type, texto } = await request.json();
    if (!imagem_base64 && !(texto || "").trim()) {
      return NextResponse.json({ error: "Envie a foto da planilha ou o texto da contagem." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Chave da IA não configurada." }, { status: 500 });

    const prompt = `Isto é uma CONTAGEM DE ESTOQUE de um restaurante brasileiro.
Pode ser: a foto de uma planilha de contagem preenchida à mão (use a coluna "Contagem física" — ignore a coluna "Saldo sistema") e/ou um texto ditado por voz.
Extraia cada item contado:
- "nome": nome do ingrediente/produto como está escrito (ex: "Banana", "Leite Condensado").
- "quantidade": o número contado (aceite decimais: "2,5" -> 2.5). Números por extenso valem ("cinco" -> 5).
Ignore itens sem quantidade preenchida.
Responda ESTRITAMENTE com JSON, sem markdown:
{ "itens": [ { "nome": "...", "quantidade": 0 } ] }`;

    const conteudo = [];
    if (imagem_base64) conteudo.push({ type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: imagem_base64 } });
    conteudo.push({ type: "text", text: prompt + ((texto || "").trim() ? `\n\nContagem ditada:\n${texto.trim()}` : "") });

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
        messages: [{ role: "user", content: conteudo }],
      }),
    });
    if (!response.ok) {
      console.error("[IA Contagem]", await response.text());
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }
    const data = await response.json();
    let saida = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    saida = saida.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(saida); } catch { const m = saida.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj?.itens?.length) return NextResponse.json({ error: "Não consegui ler nenhum item contado. Confira a foto ou o áudio." }, { status: 422 });
    const itens = obj.itens
      .filter(i => i && (i.nome || "").trim() && Number.isFinite(Number(i.quantidade)))
      .map(i => ({ nome: String(i.nome).trim(), quantidade: Number(i.quantidade) }));
    return NextResponse.json({ itens });
  } catch (e) {
    console.error("[IA Contagem] Catch:", e);
    return NextResponse.json({ error: "Falha inesperada ao ler a contagem." }, { status: 500 });
  }
}
