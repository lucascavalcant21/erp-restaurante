import { NextResponse } from "next/server";

// Lê a FOTO do cardápio e extrai os itens com preço — vira ficha + produto.
export async function POST(request) {
  try {
    const { imagem_base64, media_type } = await request.json();
    if (!imagem_base64) return NextResponse.json({ error: "Envie a foto do cardápio." }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Chave da IA não configurada." }, { status: 500 });

    const prompt = `Esta é a foto de um cardápio de restaurante brasileiro. Extraia TODOS os itens com nome e preço.
Classifique cada um em: "Prato", "Sobremesa", "Suco" ou "Drink".
Preço em número (ex: 32.00). Se houver dois preços (P/G), use o maior. Ignore descrições longas.
Responda ESTRITAMENTE com JSON, sem markdown:
{ "itens": [ { "nome": "...", "categoria": "Prato", "preco": 32.00 }, ... ] }`;

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
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: imagem_base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });
    if (!response.ok) {
      console.error("[IA Cardapio]", await response.text());
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }
    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(texto); } catch { const m = texto.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj?.itens?.length) return NextResponse.json({ error: "Não consegui ler itens no cardápio. Tente uma foto mais nítida." }, { status: 422 });
    const itens = obj.itens
      .filter(i => i && (i.nome || "").trim())
      .map(i => ({ nome: String(i.nome).trim(), categoria: ["Prato", "Sobremesa", "Suco", "Drink"].includes(i.categoria) ? i.categoria : "Prato", preco: Number(i.preco) || 0 }));
    return NextResponse.json({ itens });
  } catch (e) {
    console.error("[IA Cardapio] Catch:", e);
    return NextResponse.json({ error: "Falha ao ler o cardápio." }, { status: 500 });
  }
}
