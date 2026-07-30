import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { texto, imagem_base64, imagem_media_type, imagens } = await request.json();

    const listaImagens = Array.isArray(imagens) && imagens.length > 0
      ? imagens
      : (imagem_base64 ? [{ base64: imagem_base64, media_type: imagem_media_type || "image/jpeg" }] : []);

    if ((!texto || !texto.trim()) && listaImagens.length === 0) {
      return NextResponse.json({ error: "Envie uma lista de texto ou ao menos um print/imagem." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave de IA (OPENAI_API_KEY) não configurada no servidor." }, { status: 500 });
    }

    const systemPrompt = `Você é um especialista em gestão de suprimentos e compras para restaurantes e bares.
Extraia TODOS os ingredientes e produtos das imagens/prints/notas fiscais fornecidas.

Para CADA item, identifique:
1. "nome": Nome limpo e descritivo do produto (ex: "Tomate Carmem", "Vodka Smirnoff", "Picanha Bovina", "Heineken Long Neck").
2. "marca": Marca do produto se houver (ex: "Heineken", "Smirnoff", "Friboi"). Se não constar, use "".
3. "quantidade": Quantidade ou tamanho da embalagem/produto (número maior que 0). Se não especificado, use 1.
4. "unidade": Unidade de medida normalizada ("kg", "g", "l", "ml", "un", "cx", "maco", "lata", "garrafa").
5. "valor_total": Valor pago ou preço total do item em Reais (número).
6. "departamento": Identifique se o item pertence ao "bar" (bebidas alcoólicas, cervejas, refrigerantes, vinhos, destilados, xaropes, coquetelaria) ou "cozinha" (carnes, vegetais, temperos, laticínios, secos, farinhas, hortifrúti).
7. "categoria": Categoria aproximada do item (ex: "Cervejas", "Destilados", "Refrigerantes", "Ingredientes", "Carne vermelha", "Aves", "Peixes", "Hortifrúti", "Laticínios", "Secos", "Temperos", "Outros").

REGRA DE DEDUPLICAÇÃO DE ITENS NO RETORNO:
Se houver produtos repetidos/duplicados no texto ou entre as várias imagens/prints, junte-os mantendo o de MAIOR VALOR TOTAL / MAIOR PREÇO (maior valor pago).

Retorne ESTRITAMENTE em formato JSON:
{
  "itens": [
    {
      "nome": "string",
      "marca": "string",
      "quantidade": number,
      "unidade": "string",
      "valor_total": number,
      "departamento": "bar" | "cozinha",
      "categoria": "string"
    }
  ]
}`;

    const todosItensBrutos = [];

    if (process.env.OPENAI_API_KEY) {
      const CHUNK_SIZE = 4;
      const chunks = [];
      for (let i = 0; i < listaImagens.length; i += CHUNK_SIZE) {
        chunks.push(listaImagens.slice(i, i + CHUNK_SIZE));
      }
      if (chunks.length === 0 && texto) {
        chunks.push([]);
      }

      const resultadosChunks = await Promise.all(
        chunks.map(async (chunk, chunkIdx) => {
          const messagesContent = [];
          for (const imgObj of chunk) {
            const mediaType = imgObj.media_type || "image/jpeg";
            const b64 = imgObj.base64 || imgObj;
            const dataUrl = typeof b64 === "string" && b64.startsWith("data:") ? b64 : `data:${mediaType};base64,${b64}`;
            messagesContent.push({
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" }
            });
          }

          messagesContent.push({
            type: "text",
            text: `Analise o(s) ${chunk.length} print(s)/imagem(ns) (Lote ${chunkIdx + 1}/${chunks.length}) e extraia todos os ingredientes/produtos separando por bar e cozinha com nome, marca, quantidade, unidade, valor_total pago, departamento e categoria.\n\nTEXTO/LISTA:\n${texto || "(analisar imagens/prints anexas)"}`
          });

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: messagesContent }
              ],
              response_format: { type: "json_object" },
              max_tokens: 4000,
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`[IA Insumos] Erro OpenAI no lote ${chunkIdx + 1}:`, errText);
            let msg = "Erro na chamada da API OpenAI";
            try {
              const errObj = JSON.parse(errText);
              if (errObj.error?.message) msg = errObj.error.message;
            } catch (_) {}
            throw new Error(msg);
          }

          const resData = await response.json();
          const rawText = resData.choices[0]?.message?.content || "{}";
          const parsed = JSON.parse(rawText);
          return Array.isArray(parsed?.itens) ? parsed.itens : [];
        })
      );

      for (const itensDoChunk of resultadosChunks) {
        todosItensBrutos.push(...itensDoChunk);
      }
    }

    const itensBrutos = todosItensBrutos;

    // Deduplicação determinística no servidor: consolida por (nome normalizado + departamento) mantendo o de MAIOR VALOR
    const mapaItens = new Map();

    for (const it of itensBrutos) {
      const nome = String(it.nome || "").trim();
      if (!nome) continue;
      const dept = String(it.departamento || "cozinha").toLowerCase() === "bar" ? "bar" : "cozinha";
      const chave = `${dept}:${nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
      
      const qtd = Math.max(0.001, Number(it.quantidade) || 1);
      const valorTotal = Math.max(0, Number(it.valor_total) || 0);
      let unidade = String(it.unidade || "un").toLowerCase().trim();
      const marca = String(it.marca || "").trim();
      const categoria = String(it.categoria || "").trim();

      const itemExistente = mapaItens.get(chave);
      if (!itemExistente) {
        mapaItens.set(chave, {
          nome,
          marca,
          quantidade: qtd,
          unidade,
          valor_total: valorTotal,
          departamento: dept,
          categoria
        });
      } else {
        // Se já existe duplicado entre as imagens, mantém o de MAIOR VALOR
        if (valorTotal > itemExistente.valor_total) {
          mapaItens.set(chave, {
            nome,
            marca: marca || itemExistente.marca,
            quantidade: qtd,
            unidade,
            valor_total: valorTotal,
            departamento: dept,
            categoria: categoria || itemExistente.categoria
          });
        }
      }
    }

    const itensFinal = Array.from(mapaItens.values());

    return NextResponse.json({ itens: itensFinal });
  } catch (error) {
    console.error("[IA Insumos] Erro:", error);
    return NextResponse.json({ error: error.message || "Erro ao processar imagens/texto" }, { status: 500 });
  }
}
