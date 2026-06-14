import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API Key não configurada." }, { status: 500 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em ler notas fiscais, DANFEs e cupons fiscais brasileiros. Extraia os dados e retorne EXATAMENTE um objeto JSON com as chaves: 'fornecedor' (string), 'cnpj' (string formatada), 'data_emissao' (string YYYY-MM-DD), 'hora_emissao' (string HH:MM), 'categoria' (escolha entre: Hortifruti, Açougue/Proteína, Laticínios, Secos e Molhados, Bebidas, Limpeza, Embalagens, Outros), 'valor_total' (number), e 'itens' (array de objetos com 'nome', 'qtd', 'un' e 'preco' numérico). Se a imagem não for uma nota ou não der pra ler, tente o melhor e preencha nulo. Responda apenas o JSON puro."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados deste documento." },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
        max_tokens: 1500,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const resultString = data.choices[0].message.content;
    const jsonResult = JSON.parse(resultString);

    return NextResponse.json(jsonResult);
  } catch (error) {
    console.error("Erro na API OCR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
