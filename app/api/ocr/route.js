import { NextResponse } from "next/server";
import { sessaoOuNegar } from "../../lib/server/sessao-rota.mjs";

export const maxDuration = 60; // Aumenta o tempo limite da Vercel para 60s (necessário para a IA processar imagens pesadas)

export async function POST(request) {
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;

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
                numero: { type: "string", description: "Número da nota (NF-e/NFC-e), só dígitos. Vazio se não houver." },
                serie: { type: "string", description: "Série da nota. Vazio se não houver." },
                chave_acesso: { type: "string", description: "Chave de acesso de 44 dígitos, só números. Vazio se não houver." },
                valor_frete: { type: "string", description: "Valor do frete, ex: '15,00'. Vazio se não houver." },
                valor_desconto: { type: "string", description: "Valor do desconto total da nota. Vazio se não houver." },
                vencimentos: {
                  type: "array",
                  description: "Duplicatas/fatura: cada vencimento e valor. Lista vazia se não houver.",
                  items: {
                    type: "object",
                    properties: { data: { type: "string", description: "Vencimento YYYY-MM-DD" }, valor: { type: "string", description: "Valor da parcela" } },
                    required: ["data", "valor"], additionalProperties: false,
                  },
                },
                itens: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      codigo: { type: "string", description: "Código do produto do fornecedor, se aparecer. Vazio se não houver." },
                      nome: { type: "string", description: "Nome limpo do produto (sem códigos numéricos), com o tamanho se estiver escrito (ex.: 'OLEO SOJA 900ML CX C/20')" },
                      qtd: { type: "string", description: "Quantidade comprada, ex: '2,615'" },
                      un: { type: "string", description: "Unidade de medida (UN, KG, CX)" },
                      valor_unitario: { type: "string", description: "Valor unitário do item, ex: '8,99'" },
                      preco: { type: "string", description: "Valor total do item na linha, ex: '23,51'" }
                    },
                    required: ["codigo", "nome", "qtd", "un", "valor_unitario", "preco"],
                    additionalProperties: false
                  }
                }
              },
              required: ["fornecedor", "cnpj", "data_emissao", "hora_emissao", "categoria", "valor_total", "numero", "serie", "chave_acesso", "valor_frete", "valor_desconto", "vencimentos", "itens"],
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
    
    // Converte os valores string com vírgula ("1.234,56") para número real para o frontend
    const numero = (v) => {
      const t = String(v ?? "").replace(/[^\d,.-]/g, "");
      if (!t) return null;
      const n = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
      return Number.isFinite(n) ? n : null;
    };
    if (jsonResult.valor_total) jsonResult.valor_total = numero(jsonResult.valor_total);
    jsonResult.valor_frete = numero(jsonResult.valor_frete);
    jsonResult.valor_desconto = numero(jsonResult.valor_desconto);
    if (Array.isArray(jsonResult.vencimentos)) jsonResult.vencimentos = jsonResult.vencimentos.map((v) => ({ data: v.data, valor: numero(v.valor) }));
    if (jsonResult.itens) {
      jsonResult.itens = jsonResult.itens.map(item => ({
        ...item,
        qtd: item.qtd ? numero(item.qtd) ?? 1 : 1,
        valor_unitario: numero(item.valor_unitario),
        preco: item.preco ? numero(item.preco) ?? 0 : 0
      }));
    }


    return NextResponse.json(jsonResult);
  } catch (error) {
    console.error("Erro na API OCR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
