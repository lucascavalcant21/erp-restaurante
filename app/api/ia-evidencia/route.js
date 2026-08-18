import { NextResponse } from "next/server";

// Confere a foto de evidência contra o critério escrito no item do checklist.
// A IA não decide sozinha se o funcionário fez o serviço: ela diz se a FOTO
// comprova o que o item pede. Quando fica em dúvida devolve "revisar", porque
// reprovar por engano gera não conformidade injusta e mina a confiança no módulo.
export async function POST(request) {
  try {
    const { imagem_base64, imagem_media_type, criterios, item_titulo } = await request.json();

    if (!imagem_base64 || !imagem_media_type) {
      return NextResponse.json({ error: "Envie a foto da evidência." }, { status: 400 });
    }
    if (!criterios || !String(criterios).trim()) {
      return NextResponse.json({ error: "Este item não tem critério de conferência." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Evidência] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const prompt = `Você confere fotos de evidência de um checklist operacional de restaurante.

ITEM DO CHECKLIST: ${item_titulo || "(sem título)"}
O QUE A FOTO PRECISA MOSTRAR: ${criterios}

Olhe a foto e decida:
- "aprovada": a foto mostra claramente o que o critério pede.
- "reprovada": a foto contradiz o critério (ex.: pede bancada limpa e está suja) ou mostra outra coisa.
- "revisar": a foto está escura, tremida, cortada, distante demais, ou você não tem certeza.

Regras:
- Na dúvida use "revisar". Nunca reprove por suspeita fraca.
- "confianca" é de 0 a 100, o quanto você tem certeza da sua própria decisão.
- "motivo" é uma frase curta em português, dirigida a quem tirou a foto, dizendo o que viu e — se não aprovou — o que refazer.

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois:
{ "status": "aprovada", "confianca": 0, "motivo": "..." }`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imagem_media_type, data: imagem_base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const detalhe = await response.text();
      console.error("[IA Evidência] Erro da Anthropic:", detalhe);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(texto);
    } catch {
      const bloco = texto.match(/\{[\s\S]*\}/);
      if (!bloco) {
        console.error("[IA Evidência] Retorno fora do formato:", texto.slice(0, 300));
        return NextResponse.json({ status: "revisar", confianca: null, motivo: "A IA não respondeu no formato esperado." });
      }
      obj = JSON.parse(bloco[0]);
    }

    // A coluna ia_status só aceita estes três valores; qualquer criatividade do
    // modelo vira "revisar" em vez de derrubar o insert da evidência.
    const status = ["aprovada", "reprovada", "revisar"].includes(String(obj.status || "").toLowerCase())
      ? String(obj.status).toLowerCase()
      : "revisar";
    const bruta = Number(obj.confianca);
    const confianca = Number.isFinite(bruta) ? Math.min(100, Math.max(0, Math.round(bruta))) : null;

    return NextResponse.json({
      status,
      confianca,
      motivo: String(obj.motivo || "").trim().slice(0, 400) || null,
    });
  } catch (e) {
    console.error("[IA Evidência] Falha inesperada:", e);
    return NextResponse.json({ error: "Não consegui conferir a foto." }, { status: 500 });
  }
}
