import { NextResponse } from "next/server";

// Gera a ficha de montagem do prato/drink: a estrutura em camadas (de cima
// para baixo) + um modo de preparo PROFISSIONAL passo a passo, a partir da
// descrição informada. Usa a Anthropic (mesma chave das outras rotas de IA).
export async function POST(request) {
  try {
    const { descritivo, nome, tipo } = await request.json();

    if (!descritivo || !String(descritivo).trim()) {
      return NextResponse.json({ error: "Descreva como o prato/drink é feito." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const ehDrink = String(tipo || "").toLowerCase() === "drink";
    const tiposCamada = ehDrink
      ? `"copo", "gelo", "liquido", "decoracao", "outro"`
      : `"pao_topo", "pao_base", "carne", "queijo", "molho", "vegetal", "bacon", "cebola", "fritura", "outro"`;

    const prompt = `Você é chef/bartender e monta FICHAS DE MONTAGEM profissionais para a equipe da cozinha/bar de um restaurante padronizar o prato${ehDrink ? "/drink" : ""}.

${nome ? `Item: ${nome}\n` : ""}Descrição do preparo (texto do usuário):
"""${descritivo}"""

Produza DOIS resultados:

1) "camadas": a estrutura de montagem do item, DE CIMA PARA BAIXO (o que fica no topo primeiro; a base por último). Para cada camada:
   - "nome": ingrediente + quantidade quando houver (ex: "Coroa do pão", "2 fatias de bacon", "150g de hambúrguer", "Gelo até 3/4 do copo").
   - "tipo": exatamente um destes: ${tiposCamada}.

2) "modo_preparo": um passo a passo PROFISSIONAL e detalhado, numerado, que qualquer cozinheiro${ehDrink ? "/bartender" : ""} consiga seguir para padronizar. Cada passo em uma linha começando por "1. ", "2. "... Inclua: mise en place/pré-aquecimento, ponto/tempo de cada elemento, ordem de montagem, temperatura de saída e finalização/apresentação no prato${ehDrink ? "/copo" : ""}. Seja específico com quantidades e pontos, mas não invente ingredientes que não estejam na descrição.

Responda ESTRITAMENTE com JSON válido, sem texto antes ou depois:
{ "camadas": [ { "nome": "...", "tipo": "..." } ], "modo_preparo": "1. ...\\n2. ..." }`;

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
      console.error("[IA Montagem] Erro da Anthropic:", errorData);
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

    const camadas = Array.isArray(obj.camadas) ? obj.camadas : [];
    const modo_preparo = String(obj.modo_preparo || "").trim();
    if (!camadas.length && !modo_preparo) {
      return NextResponse.json({ error: "A IA não conseguiu montar a ficha. Tente detalhar mais." }, { status: 422 });
    }

    return NextResponse.json({ camadas, modo_preparo });
  } catch (error) {
    console.error("[IA Montagem] Catch:", error);
    return NextResponse.json({ error: "Não consegui gerar a ficha. Tente novamente." }, { status: 500 });
  }
}
