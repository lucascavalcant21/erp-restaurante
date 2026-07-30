import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { texto, imagem_base64, imagem_media_type, imagens, departamento } = await request.json();

    const listaImagens = Array.isArray(imagens) && imagens.length > 0
      ? imagens
      : (imagem_base64 ? [{ base64: imagem_base64, media_type: imagem_media_type || "image/jpeg" }] : []);

    if ((!texto || !texto.trim()) && listaImagens.length === 0) {
      return NextResponse.json({ error: "Envie texto do cardápio ou ao menos uma foto/print." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave de IA (OPENAI_API_KEY) não configurada no servidor." }, { status: 500 });
    }

    const systemPrompt = `Você é um chef executivo especialista em engenharia de cardápios, fichas técnicas e mixologia para restaurantes e bares.
Sua missão é extrair e estruturar TODAS as fichas técnicas, pratos, drinks e produtos das fotos de cardápios/receitas fornecidas.

REGRAS DE CLASSIFICAÇÃO DE DEPARTAMENTO:
- "bar": Bebidas, cocktails, drinks clássicos, caipirinhas, chopp, cervejas, vinhos, doses, sucos, refrigerantes, xaropes, infusões e pré-preparos de coquetelaria.
- "cozinha": Entradas, petiscos, pratos principais, hambúrgueres, massas, carnes, molhos, sobremesas, acompanhamentos e pré-preparos culinários.

REGRAS DE INGREDIENTES INTERNOS DA FICHA:
- Extraia a lista de ingredientes/insumos de CADA ficha técnica.
- NENHUMA FICHA TÉCNICA PODE TER INGREDIENTES DUPLICADOS. Se um mesmo ingrediente aparecer mais de uma vez na mesma receita, junte-os somando as quantidades.
- Cada ingrediente deve conter:
  - "nome": Nome limpo e descritivo do ingrediente (ex: "Filé Mignon", "Limão Taiti", "Xarope de Açúcar", "Cerveja Heineken").
  - "quantidade": Número da quantidade usada (ex: 200 para 200g, 1 para 1 unidade). Se não souber a quantidade exata, use 1.
  - "unidade": Unidade normalizada ("kg", "g", "l", "ml", "un").

Retorne ESTRITAMENTE em formato JSON válido:
{
  "fichas": [
    {
      "nome_receita": "Nome do Prato ou Drink",
      "departamento": "cozinha" | "bar",
      "categoria": "Categoria do Cardápio (ex: Pratos Principais, Entradas, Sobremesas, Drinks, Cervejas, Xaropes)",
      "preco_venda": 0.00,
      "rendimento_porcoes": 1,
      "rendimento_unidade": "porcao" | "un" | "l" | "kg",
      "modo_preparo": "Instruções de preparo se disponíveis",
      "ingredientes": [
        {
          "nome": "Ingrediente",
          "quantidade": 1,
          "unidade": "kg"
        }
      ]
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
            text: `Analise o(s) ${chunk.length} print(s)/imagem(ns) de cardápio/receitas (Lote ${chunkIdx + 1}/${chunks.length}) e extraia todas as fichas técnicas separando por cozinha e bar.\n\nTEXTO/CARDÁPIO:\n${texto || "(analisar imagens/prints anexas)"}`
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
            console.error(`[IA Fichas Cardápio] Erro OpenAI no lote ${chunkIdx + 1}:`, errText);
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
          return Array.isArray(parsed?.fichas) ? parsed.fichas : [];
        })
      );

      for (const fichasDoChunk of resultadosChunks) {
        todosItensBrutos.push(...fichasDoChunk);
      }
    }

    // Deduplicação determinística no servidor:
    // 1. Se a mesma receita aparecer em várias fotos do cardápio, mantém a versão mais recente/completa.
    // 2. Garante que nenhuma receita possua ingredientes duplicados internamente.
    const mapaFichas = new Map();

    for (const f of todosItensBrutos) {
      const nomeReceita = String(f.nome_receita || "").trim();
      if (!nomeReceita) continue;
      const dept = String(f.departamento || departamento || "cozinha").toLowerCase() === "bar" ? "bar" : "cozinha";
      const chave = `${dept}:${nomeReceita.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;

      // Deduplicação dos ingredientes dentro da própria receita
      const mapaIngredientes = new Map();
      for (const ing of (Array.isArray(f.ingredientes) ? f.ingredientes : [])) {
        const nomeIng = String(ing.nome || "").trim();
        if (!nomeIng) continue;
        const chaveIng = nomeIng.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const qtd = Math.max(0.001, Number(ing.quantidade) || 1);
        let unidade = String(ing.unidade || "un").toLowerCase().trim();
        if (!["kg", "g", "l", "ml", "un"].includes(unidade)) unidade = "un";

        if (!mapaIngredientes.has(chaveIng)) {
          mapaIngredientes.set(chaveIng, { nome: nomeIng, quantidade: qtd, unidade });
        } else {
          // Se o ingrediente for repetido na mesma receita, soma as quantidades se tiverem a mesma unidade
          const ex = mapaIngredientes.get(chaveIng);
          if (ex.unidade === unidade) {
            ex.quantidade = Math.round((ex.quantidade + qtd) * 1000) / 1000;
          }
        }
      }

      const fichaLimpa = {
        nome_receita: nomeReceita,
        departamento: dept,
        categoria: String(f.categoria || (dept === "bar" ? "Drinks" : "Pratos Principais")).trim(),
        preco_venda: Math.max(0, Number(f.preco_venda) || 0),
        rendimento_porcoes: Math.max(1, Number(f.rendimento_porcoes) || 1),
        rendimento_unidade: String(f.rendimento_unidade || "porcao").trim(),
        modo_preparo: String(f.modo_preparo || "").trim(),
        ingredientes: Array.from(mapaIngredientes.values()),
      };

      // Se duplicada entre as fotos, usa a nova adicionada / sobrescreve
      mapaFichas.set(chave, fichaLimpa);
    }

    const fichasFinal = Array.from(mapaFichas.values());

    return NextResponse.json({ fichas: fichasFinal });
  } catch (error) {
    console.error("[IA Fichas Cardápio] Erro:", error);
    return NextResponse.json({ error: error.message || "Erro ao processar cardápios/receitas por IA" }, { status: 500 });
  }
}
