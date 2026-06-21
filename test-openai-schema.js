const fs = require('fs');

async function test() {
  const envFile = fs.readFileSync('.env.local', 'utf-8');
  const key = envFile.match(/OPENAI_API_KEY=(.*)/)[1].trim();

  // URL of a sample Brazilian receipt
  const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/d/d4/Receipt_in_McDonald%27s.jpg";
  
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const imageBase64 = `data:image/jpeg;base64,${base64}`;

  const payload = {
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
            valor_total: { type: "number", description: "Valor total da nota em Reais" },
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string", description: "Nome limpo do produto (sem códigos numéricos)" },
                  qtd: { type: "number", description: "Quantidade comprada" },
                  un: { type: "string", description: "Unidade de medida (UN, KG, CX)" },
                  preco: { type: "number", description: "Valor total do item na linha (qtd * valor unitário)" }
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
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.error) {
    console.error("ERRO DA API:", data.error);
  } else {
    console.log("SUCESSO:", data.choices[0].message.content);
  }
}

test();
