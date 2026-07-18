import { NextResponse } from "next/server";

// Lê a FOTO da ficha de controle do extra preenchida à mão e extrai os dados.
export async function POST(request) {
  try {
    const { imagem_base64, media_type } = await request.json();
    if (!imagem_base64) return NextResponse.json({ error: "Envie a foto da ficha." }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Chave da IA não configurada." }, { status: 500 });

    const prompt = `Esta é a foto de uma FICHA DE CONTROLE DE FREELANCER/EXTRA de restaurante, preenchida à mão.
Extraia o que conseguir ler: nome completo, CPF, telefone, chave PIX, valor da diária (número) e observações relevantes.
Se um campo estiver ilegível ou vazio, retorne "".
Responda ESTRITAMENTE com JSON, sem markdown:
{ "nome": "...", "cpf": "...", "telefone": "...", "chave_pix": "...", "diaria": 120.00, "observacoes": "..." }`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1200,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: imagem_base64 } },
          { type: "text", text: prompt },
        ] }],
      }),
    });
    if (!response.ok) { console.error("[IA FichaExtra]", await response.text()); return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 }); }
    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(texto); } catch { const m = texto.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj?.nome) return NextResponse.json({ error: "Não consegui ler o nome na ficha. Tire uma foto mais nítida." }, { status: 422 });
    return NextResponse.json({
      nome: String(obj.nome).trim(), cpf: String(obj.cpf || "").trim(), telefone: String(obj.telefone || "").trim(),
      chave_pix: String(obj.chave_pix || "").trim(), diaria: Number(obj.diaria) || 0, observacoes: String(obj.observacoes || "").trim(),
    });
  } catch (e) {
    console.error("[IA FichaExtra] Catch:", e);
    return NextResponse.json({ error: "Falha ao ler a ficha." }, { status: 500 });
  }
}
