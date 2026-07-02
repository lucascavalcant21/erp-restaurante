import { NextResponse } from "next/server";

// Monta uma ficha técnica inteira (nome do prato, rendimento, ingredientes e modo de
// preparo estruturado) a partir de uma receita em texto solto e/ou uma foto (print,
// foto de caderno de receitas, foto do prato com anotação, etc).
export async function POST(request) {
  try {
    const { texto, imagem_base64, imagem_media_type, departamento } = await request.json();

    if ((!texto || !texto.trim()) && !imagem_base64) {
      return NextResponse.json({ error: "Envie a receita em texto ou uma foto." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Ficha] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const prompt = `Você é um chef que transforma uma receita solta (texto e/ou foto) numa Ficha Técnica de cozinha profissional para o departamento "${departamento || "cozinha"}".

Extraia:
1. "nome_receita": o nome do prato, para aparecer no cardápio (ex: "Tacacá", "X-Caboquinho").
2. "rendimento_porcoes": quantas porções essa receita rende (número inteiro; se não estiver claro, use 1).
3. "ingredientes": lista de TODOS os ingredientes usados, cada um com:
   - "nome": nome do ingrediente, limpo e genérico (ex: "Cebola", "Filé de Frango", "Leite de Coco") — sem marca, sem quantidade no nome.
   - "quantidade": o número da quantidade usada NESSA receita, exatamente como está (ex: "200g" -> quantidade=200).
   - "unidade": normalizada para um destes: "kg", "g", "l", "ml", "un".
4. "modo_preparo": lista de etapas numeradas do preparo. Para CADA etapa, deduza:
   - "descricao": o que fazer, direto e no imperativo.
   - "equipamento": qual panela/utensílio (ex: "Panela de fundo grosso", "Frigideira"). "" se não aplicável.
   - "fogo": exatamente um destes: "Não vai ao fogo", "Fogo baixo", "Fogo médio", "Fogo alto".
   - "tempo": tempo estimado da etapa (ex: "5 min"). Use "Rápido" se for instantâneo.
5. "tempo_total": soma estimada de todas as etapas (ex: "35 min").

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{
  "nome_receita": "...",
  "rendimento_porcoes": 1,
  "ingredientes": [ { "nome": "...", "quantidade": 0, "unidade": "kg" } ],
  "modo_preparo": [ { "descricao": "...", "equipamento": "...", "fogo": "...", "tempo": "..." } ],
  "tempo_total": "..."
}`;

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

    const ingredientesBrutos = Array.isArray(obj.ingredientes) ? obj.ingredientes : [];
    if (ingredientesBrutos.length === 0) {
      return NextResponse.json({ error: "Não encontrei ingredientes nessa receita." }, { status: 422 });
    }

    // Normalização determinística de unidade (mesma convenção do resto do app)
    const ingredientes = ingredientesBrutos.map(ing => {
      const nome = String(ing.nome || "").trim();
      const qtd = Number(ing.quantidade) || 0;
      let unidadeLida = String(ing.unidade || "").toLowerCase().trim();
      if (!["kg", "g", "l", "ml", "un"].includes(unidadeLida)) unidadeLida = "un";
      return { nome, quantidade_lida: qtd, unidade_lida: unidadeLida };
    }).filter(ing => ing.nome);

    // Monta o texto final do modo de preparo (mesmo formato usado na ficha técnica)
    const etapas = Array.isArray(obj.modo_preparo) ? obj.modo_preparo : [];
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

    return NextResponse.json({
      nome_receita: String(obj.nome_receita || "").trim(),
      rendimento_porcoes: Number(obj.rendimento_porcoes) || 1,
      ingredientes,
      modo_preparo: linhas.join("\n"),
    });
  } catch (error) {
    console.error("[IA Ficha] Catch:", error);
    return NextResponse.json({ error: "Não consegui montar a ficha a partir dessa receita. Tente reformular ou enviar uma foto mais nítida." }, { status: 500 });
  }
}
