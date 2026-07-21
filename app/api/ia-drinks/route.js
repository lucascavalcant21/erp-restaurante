import { NextResponse } from "next/server";

// Receitas em lote demoram: estende o tempo máximo da função na Vercel.
export const maxDuration = 60;

// Recebe uma LISTA de nomes de bebidas do bar e devolve, numa chamada só, a
// receita clássica de cada drink (copo, ingredientes com dosagem e preparo).
// Bebidas engarrafadas prontas (água, cerveja, refrigerante) voltam marcadas
// como "engarrafada" e não ganham receita.
export async function POST(request) {
  try {
    const { nomes } = await request.json();
    const lista = Array.isArray(nomes) ? nomes.map((n) => String(n || "").trim()).filter(Boolean) : [];
    if (!lista.length) return NextResponse.json({ error: "Envie os nomes das bebidas." }, { status: 400 });
    if (lista.length > 60) return NextResponse.json({ error: "Máximo de 60 bebidas por vez." }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Chave da IA não configurada." }, { status: 500 });

    const prompt = `Você é um bartender profissional brasileiro. Para CADA bebida da lista abaixo:

- Se for um DRINK/COQUETEL preparado no bar (caipirinha, mojito, gin tônica, combinações como "Aperol com Corona"...), monte a receita CLÁSSICA:
  - "copo": o copo/taça correto (ex: "Copo Long Drink", "Taça Coupette").
  - "ingredientes": lista com DOSAGEM em cada item (ex: "50 ml de vodka", "2 colheres (chá) de açúcar", "Cubos de gelo").
  - "preparo": lista de passos curtos e objetivos, na ordem de execução.
- Se for uma bebida ENGARRAFADA/pronta que só se abre e serve (água, cerveja, refrigerante, energético, suco de caixa), retorne apenas: { "nome": "...", "engarrafada": true }.

Lista de bebidas:
${lista.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Responda ESTRITAMENTE com JSON válido, sem markdown, mantendo os nomes EXATAMENTE como estão na lista:
{ "drinks": [ { "nome": "...", "engarrafada": false, "copo": "...", "ingredientes": ["..."], "preparo": ["..."] } ] }`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      console.error("[IA Drinks]", await response.text());
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }
    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(texto); } catch { const m = texto.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj?.drinks?.length) return NextResponse.json({ error: "A IA não conseguiu montar as receitas. Tente novamente." }, { status: 422 });

    const drinks = obj.drinks
      .filter(d => d && (d.nome || "").trim())
      .map(d => ({
        nome: String(d.nome).trim(),
        engarrafada: !!d.engarrafada,
        copo: String(d.copo || "").trim(),
        ingredientes: Array.isArray(d.ingredientes) ? d.ingredientes.map(i => String(i).trim()).filter(Boolean) : [],
        preparo: Array.isArray(d.preparo) ? d.preparo.map(p => String(p).trim()).filter(Boolean) : [],
      }));
    return NextResponse.json({ drinks });
  } catch (e) {
    console.error("[IA Drinks] Catch:", e);
    return NextResponse.json({ error: "Falha inesperada ao montar as receitas." }, { status: 500 });
  }
}
