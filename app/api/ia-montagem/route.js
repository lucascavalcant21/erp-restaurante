import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { descritivo } = await request.json();

    if (!descritivo || descritivo.trim() === "") {
      return NextResponse.json({ error: "Descritivo não fornecido" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("[IA Montagem] OPENAI_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da OpenAI não configurada no servidor." }, { status: 500 });
    }

    const prompt = `
Você é um assistente de engenharia de cardápio especializado em explodir ingredientes de pratos (hambúrgueres, drinks, etc) em camadas visuais.
O usuário vai enviar o texto de como o prato é feito.
Você deve retornar estritamente um JSON estruturado com as camadas, DE CIMA PARA BAIXO (a camada mais alta do prato primeiro, e a base por último).
Para cada camada, extraia:
- "nome": O nome e a quantidade do ingrediente (ex: "Coroa Pão", "2 Fatias de Bacon", "150g Hambúrguer", "Alface").
- "tipo": Classifique o ingrediente EXATAMENTE em um destes tipos: 
  "pao_topo", "pao_base", "carne", "queijo", "molho", "vegetal", "bacon", "cebola", "fritura", "outro". (Para drinks: "copo", "liquido", "gelo", "decoracao").

Exemplo de entrada:
"cheese burguer: 1 hamburguer 150g 2 queijos cheddar , 20g molho especial , alface, 1 fatia de tomate , molho na tampa"

Exemplo de saída esperada (SEMPRE EM JSON, formato array de objetos):
[
  { "nome": "Coroa Pão", "tipo": "pao_topo" },
  { "nome": "Molho Especial na tampa (20g)", "tipo": "molho" },
  { "nome": "1 Fatia de Tomate", "tipo": "vegetal" },
  { "nome": "Alface", "tipo": "vegetal" },
  { "nome": "2 Queijos Cheddar", "tipo": "queijo" },
  { "nome": "1 Hambúrguer (150g)", "tipo": "carne" },
  { "nome": "Base Pão", "tipo": "pao_base" }
]

TEXTO DO USUÁRIO:
${descritivo}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // ou "gpt-3.5-turbo" / "gpt-4o"
        messages: [
          { role: "system", content: "Você é um assistente que sempre responde exclusivamente com JSON válido." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[IA Montagem] Erro da OpenAI:", errorData);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let resContent = data.choices[0].message.content;
    
    // Como pedimos json_object, a resposta deve ser um objeto.
    // Vamos garantir que devolvemos o array.
    const obj = JSON.parse(resContent);
    const arrayCamadas = Array.isArray(obj) ? obj : (obj.camadas || obj.layers || Object.values(obj)[0]);

    if (!Array.isArray(arrayCamadas)) {
      throw new Error("O retorno da IA não é um array válido.");
    }

    return NextResponse.json({ camadas: arrayCamadas });
  } catch (error) {
    console.error("[IA Montagem] Catch:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
