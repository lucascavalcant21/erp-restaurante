import { NextResponse } from "next/server";

// Lê a FOTO de uma lista/planilha de produtos (impressa ou manuscrita) e extrai
// nome, marca, quantidade e unidade de cada item — para dar entrada no estoque.
export async function POST(request) {
  try {
    const { imagem_base64, media_type, texto } = await request.json();
    if (!imagem_base64 && !(texto || "").trim()) {
      return NextResponse.json({ error: "Envie a foto da lista ou digite os itens." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Chave da IA não configurada." }, { status: 500 });

    const prompt = `Isto é uma lista de produtos de um restaurante brasileiro (pode ser planilha impressa, foto de caderno ou texto solto).
Extraia TODOS os itens da lista. Para cada um:
- "nome": nome do produto, limpo (ex: "Leite Condensado", "Coca-Cola 2L") — sem a marca no nome quando a marca vier separada.
- "marca": a marca, se aparecer (ex: "Italac", "Nestlé"). "" se não houver.
- "quantidade": número de unidades/quantidade da lista (ex: 12). Use 1 se não estiver claro.
- "unidade": normalizada para um destes: "UN", "KG", "G", "L", "ML", "CX", "PCT".
Responda ESTRITAMENTE com JSON, sem markdown:
{ "itens": [ { "nome": "...", "marca": "...", "quantidade": 1, "unidade": "UN" } ] }`;

    const conteudo = [];
    if (imagem_base64) conteudo.push({ type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: imagem_base64 } });
    conteudo.push({ type: "text", text: prompt + ((texto || "").trim() ? `\n\nLista em texto:\n${texto.trim()}` : "") });

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
      console.error("[IA Lista Estoque]", await response.text());
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }
    const data = await response.json();
    let saida = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    saida = saida.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(saida); } catch { const m = saida.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj?.itens?.length) return NextResponse.json({ error: "Não consegui ler itens na lista. Tente uma foto mais nítida." }, { status: 422 });
    const UNIDADES = ["UN", "KG", "G", "L", "ML", "CX", "PCT"];
    const itens = obj.itens
      .filter(i => i && (i.nome || "").trim())
      .map(i => ({
        nome: String(i.nome).trim(),
        marca: String(i.marca || "").trim(),
        quantidade: Number(i.quantidade) > 0 ? Number(i.quantidade) : 1,
        unidade: UNIDADES.includes(String(i.unidade || "").toUpperCase()) ? String(i.unidade).toUpperCase() : "UN",
      }));
    return NextResponse.json({ itens });
  } catch (e) {
    console.error("[IA Lista Estoque] Catch:", e);
    return NextResponse.json({ error: "Falha inesperada ao ler a lista." }, { status: 500 });
  }
}
