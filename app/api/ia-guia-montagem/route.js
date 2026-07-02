import { NextResponse } from "next/server";

// Gera um GUIA DE MONTAGEM/EMPRATAMENTO padronizado de um prato, para os
// funcionários seguirem: qual louça usar, quantidades exatas, ordem de montagem,
// finalização e o visual esperado. Pensado para imprimir e colar na parede.
export async function POST(request) {
  try {
    const { nome_prato, categoria, ingredientes, observacoes } = await request.json();

    if (!nome_prato || !nome_prato.trim()) {
      return NextResponse.json({ error: "Informe o nome do prato." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Guia] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const listaIng = Array.isArray(ingredientes) && ingredientes.length > 0
      ? ingredientes.map(i => `- ${i.nome}${i.quantidade ? ` (${i.quantidade}${i.unidade || ""} por porção)` : ""}`).join("\n")
      : "(não informados)";

    const prompt = `Você é um chef que cria guias de montagem/empratamento para padronizar um prato na cozinha, para os funcionários seguirem SEMPRE do mesmo jeito.

Com base no prato e nos ingredientes, gere um guia claro e prático de execução na hora de servir.

PRATO: ${nome_prato}
CATEGORIA: ${categoria || "(não informada)"}
INGREDIENTES DA FICHA (por porção):
${listaIng}
OBSERVAÇÕES DO CHEF: ${observacoes || "(nenhuma)"}

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{
  "louca": "Qual prato/travessa/recipiente usar e o tamanho (ex: 'Prato fundo branco 22cm')",
  "porcionamento": [
    { "item": "nome do componente", "quantidade": "quantidade exata a colocar (ex: '150g', '2 conchas', '5 unidades')" }
  ],
  "montagem": [
    "Passo 1 da montagem, direto e no imperativo",
    "Passo 2..."
  ],
  "finalizacao": "Como finalizar (molho por cima, ervas, azeite, ordem de saída, temperatura)",
  "visual": "Descrição do visual esperado do prato pronto (como deve ficar para sair bonito e padronizado)",
  "dicas": ["Dica de padronização/erro comum a evitar"]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[IA Guia] Erro da Anthropic:", errorData);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(texto);
    } catch {
      const match = texto.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Retorno da IA não é JSON válido.");
      obj = JSON.parse(match[0]);
    }

    return NextResponse.json({
      louca: String(obj.louca || "").trim(),
      porcionamento: Array.isArray(obj.porcionamento) ? obj.porcionamento : [],
      montagem: Array.isArray(obj.montagem) ? obj.montagem : [],
      finalizacao: String(obj.finalizacao || "").trim(),
      visual: String(obj.visual || "").trim(),
      dicas: Array.isArray(obj.dicas) ? obj.dicas : [],
    });
  } catch (error) {
    console.error("[IA Guia] Catch:", error);
    return NextResponse.json({ error: "Não consegui gerar o guia. Tente novamente." }, { status: 500 });
  }
}
