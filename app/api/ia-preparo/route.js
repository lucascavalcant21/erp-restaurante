import { NextResponse } from "next/server";

// Gera um Modo de Preparo estruturado a partir da explicação solta do usuário.
// A IA organiza em etapas com: qual panela/equipamento, se vai ao fogo ou não,
// tempo de cada processo e o tempo total. Usa Claude (Anthropic).
export async function POST(request) {
  try {
    const { explicacao, nome_receita, ingredientes, porcoes } = await request.json();

    if (!explicacao || explicacao.trim() === "") {
      return NextResponse.json({ error: "Explique com suas palavras como o prato é feito." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Preparo] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    // Lista de ingredientes (se houver) para a IA ter contexto do que existe na ficha
    const listaIng = Array.isArray(ingredientes) && ingredientes.length > 0
      ? ingredientes.map(i => `- ${i.nome}${i.quantidade ? ` (${i.quantidade}${i.unidade || ""})` : ""}`).join("\n")
      : "(não informados)";

    const prompt = `Você é um chef que padroniza fichas técnicas de cozinha profissional.
O cozinheiro vai explicar com as próprias palavras, de forma solta, como faz o prato.
Sua tarefa é ORGANIZAR isso num modo de preparo claro, em etapas numeradas.

Para CADA etapa, deduza (com base no que ele descreveu e no bom senso de cozinha):
- "descricao": o que fazer nessa etapa, direto e no imperativo (ex: "Refogue a cebola até dourar").
- "equipamento": qual panela/utensílio usar (ex: "Panela de fundo grosso", "Frigideira", "Liquidificador", "Bowl"). Se a etapa não usa equipamento, use "".
- "fogo": se vai ao fogo e a intensidade. Use exatamente um destes: "Não vai ao fogo", "Fogo baixo", "Fogo médio", "Fogo alto".
- "tempo": tempo estimado dessa etapa (ex: "5 min", "2 min", "30 seg"). Se for instantâneo, use "Rápido".

No final, calcule "tempo_total" somando as etapas (ex: "35 min").

PRATO: ${nome_receita || "(sem nome)"}
RENDIMENTO: ${porcoes || "1"} porção(ões)
INGREDIENTES DA FICHA:
${listaIng}

EXPLICAÇÃO DO COZINHEIRO:
"${explicacao}"

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{
  "etapas": [
    { "descricao": "...", "equipamento": "...", "fogo": "...", "tempo": "..." }
  ],
  "tempo_total": "..."
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[IA Preparo] Erro da Anthropic:", errorData);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();

    // Remove cercas de markdown, caso a IA embrulhe o JSON
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(texto);
    } catch {
      // fallback: tenta achar o primeiro bloco { ... }
      const match = texto.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Retorno da IA não é JSON válido.");
      obj = JSON.parse(match[0]);
    }

    const etapas = Array.isArray(obj.etapas) ? obj.etapas : [];
    if (etapas.length === 0) throw new Error("A IA não retornou etapas.");

    // Monta o texto final que vai para o campo Modo de Preparo
    const linhas = etapas.map((et, idx) => {
      const partes = [`${idx + 1}. ${et.descricao || ""}`.trim()];
      const detalhes = [];
      if (et.equipamento) detalhes.push(et.equipamento);
      if (et.fogo) detalhes.push(et.fogo);
      if (et.tempo) detalhes.push(`⏱ ${et.tempo}`);
      if (detalhes.length) partes.push(`   • ${detalhes.join(" · ")}`);
      return partes.join("\n");
    });

    if (obj.tempo_total) {
      linhas.push("");
      linhas.push(`Tempo total: ${obj.tempo_total}`);
    }

    return NextResponse.json({ modo_preparo: linhas.join("\n") });
  } catch (error) {
    console.error("[IA Preparo] Catch:", error);
    return NextResponse.json({ error: "Não consegui estruturar o preparo. Tente reformular." }, { status: 500 });
  }
}
