import { NextResponse } from "next/server";

export const maxDuration = 60; // Aumenta o tempo limite da Vercel para 60s (necessário para a IA processar imagens pesadas)

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
            content: "Você é um auditor fiscal especialista em extração de dados. Leia a Nota Fiscal, DANFE ou cupom fiscal e extraia os dados.\nREGRAS PARA OS ITENS:\n1. Leia linha por linha. Nunca agrupe produtos diferentes.\n2. Para o 'nome', remova códigos numéricos longos do início (ex: '00012345 - OLEO DE SOJA' vira apenas 'OLEO DE SOJA').\n3. Para o 'preco', extraia o valor TOTAL daquela linha (e não o valor unitário).\n4. Se a imagem não for uma nota, retorne strings vazias e listas vazias.\nO retorno deve seguir ESTRITAMENTE o formato solicitado."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise a imagem e extraia os dados do cupom/nota fiscal." },
              { type: "image_url", image_url: { url: imageBase64, detail: "high" } }
            ]
          }
        ],
        max_tokens: 2000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "extracao_nota",
            strict: true,
            schema: {
              type: "object",
              properties: {
                fornecedor: { type: "string", description: "Nome ou Razão Social. Vazio se não houver." },
                cnpj: { type: "string", description: "CNPJ formatado." },
                data_emissao: { type: "string", description: "Data no formato YYYY-MM-DD" },
                hora_emissao: { type: "string", description: "Hora no formato HH:MM" },
                categoria: { type: "string", enum: ["Hortifruti", "Açougue/Proteína", "Laticínios", "Secos e Molhados", "Bebidas", "Limpeza", "Embalagens", "Outros"] },
                valor_total: { type: "string", description: "Valor total exato da nota, ex: '219,90'" },
                itens: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string", description: "Nome limpo do produto (sem códigos numéricos)" },
                      qtd: { type: "string", description: "Quantidade comprada, ex: '2,615'" },
                      un: { type: "string", description: "Unidade de medida (UN, KG, CX)" },
                      preco: { type: "string", description: "Valor total do item na linha, ex: '23,51'" }
                    },
                    required: ["nome", "qtd", "un", "preco"],
                    additionalProperties: false
                  }
                }
              },
              required: ["fornecedor", "cnpj", "data_emissao", "hora_emissao", "categoria", "valor_total", "itens"],
              additionalProperties: false
            }
          }
        }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const resultString = data.choices[0].message.content;
    const jsonResult = JSON.parse(resultString);
    
    // Converte os valores string com vírgula para número real para o frontend
    if (jsonResult.valor_total) {
      jsonResult.valor_total = parseFloat(jsonResult.valor_total.replace(/[^\d,-]/g, '').replace(',', '.'));
    }
    if (jsonResult.itens) {
      jsonResult.itens = jsonResult.itens.map(item => ({
        ...item,
        qtd: item.qtd ? parseFloat(String(item.qtd).replace(/[^\d,-]/g, '').replace(',', '.')) : 1,
        preco: item.preco ? parseFloat(String(item.preco).replace(/[^\d,-]/g, '').replace(',', '.')) : 0
      }));
    }

    console.log("RESULTADO OCR:", JSON.stringify(jsonResult, null, 2));

    return NextResponse.json(jsonResult);
  } catch (error) {
    console.error("Erro na API OCR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
