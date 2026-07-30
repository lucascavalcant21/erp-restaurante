import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { tema, assuntos, data, hora, local, condutor, unidade_nome, imagem_base64, imagem_media_type, imagens } = await request.json();

    const listaImagens = Array.isArray(imagens) && imagens.length > 0
      ? imagens
      : (imagem_base64 ? [{ base64: imagem_base64, media_type: imagem_media_type || "image/jpeg" }] : []);

    const temImagem = listaImagens.length > 0;
    const temTexto = tema && String(tema).trim().length > 0;

    if (!temTexto && !temImagem) {
      return NextResponse.json({ error: "Informe o tema da reunião ou envie uma foto/print da ata." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    // Se houver imagem, transcreve a foto mantendo exatamente a estrutura do documento
    if (process.env.OPENAI_API_KEY && temImagem) {
      const messagesContent = [];
      for (const imgObj of listaImagens) {
        const mediaType = imgObj.media_type || "image/jpeg";
        const b64 = imgObj.base64 || imgObj;
        const dataUrl = typeof b64 === "string" && b64.startsWith("data:") ? b64 : `data:${mediaType};base64,${b64}`;
        messagesContent.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "high" }
        });
      }

      messagesContent.push({
        type: "text",
        text: `Analise a(s) imagem(ns) da Ata de Reunião ou anotação anexada e TRANSCREVA O CONTEÚDO MANTENDO INTEGRALMENTE A SUA ESTRUTURA ORIGINAL (títulos, tópicos, decisões, plano de ação, listas numeradas e participantes).

Extraia e estruture em JSON:
1. "tema": Título ou tema principal da reunião identificado na foto.
2. "data_reuniao": Data da reunião em formato YYYY-MM-DD se constar na foto (ou null se não houver).
3. "hora": Horário da reunião se constar na foto (ex: "15:00").
4. "local": Local da reunião se constar na foto (ex: "Sala de Reuniões / Cozinha").
5. "condutor": Nome da pessoa que conduziu ou líder responsável.
6. "participantes_texto": Lista dos nomes dos participantes/presentes mencionados na foto.
7. "texto": A transcrição COMPLETA e fiel do conteúdo da ata, organizando em parágrafos e seções estruturadas exatamente como na foto (Abertura, Pauta/Assuntos, Decisões Tomadas, Plano de Ação, Encerramento e Assinaturas).

TEXTO ADICIONAL FORNECIDO:
${tema ? `Tema: ${tema}\n` : ""}${assuntos ? `Pauta: ${assuntos}\n` : ""}`
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
            {
              role: "system",
              content: "Você é um especialista em transcrição e organização formal de Atas de Reunião empresariais para restaurantes. Sua função é transcrever fotos de atas manuscritas, quadros ou documentos mantendo fielmente sua estrutura e legibilidade."
            },
            { role: "user", content: messagesContent }
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[IA Ata Vision] Erro OpenAI:", errText);
        throw new Error("Erro na chamada da API de IA.");
      }

      const resData = await response.json();
      const rawText = resData.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawText);

      return NextResponse.json({
        tema: String(parsed.tema || tema || "Ata de Reunião").trim(),
        data_reuniao: parsed.data_reuniao || data || new Date().toISOString().split("T")[0],
        hora: String(parsed.hora || hora || "").trim(),
        local: String(parsed.local || local || "").trim(),
        condutor: String(parsed.condutor || condutor || "").trim(),
        participantes_texto: String(parsed.participantes_texto || "").trim(),
        texto: String(parsed.texto || "").trim(),
      });
    }

    // Redação formal via texto puro
    const dataFmt = data ? String(data).split("-").reverse().join("/") : "(data a definir)";
    const prompt = `Você é assistente administrativo de um restaurante brasileiro chamado "${unidade_nome || "a empresa"}". Redija uma ATA DE REUNIÃO formal, em português do Brasil, clara e objetiva, pronta para ser lida e assinada pelos funcionários.

DADOS DA REUNIÃO:
- Tema: ${tema}
- Data: ${dataFmt}${hora ? ` · Horário: ${hora}` : ""}
- Local: ${local || "sede da empresa"}
- Conduzida por: ${condutor || "a gerência"}
- Pauta / assuntos tratados (um por linha):
${assuntos || "(não detalhada — desenvolva a partir do tema)"}

ESTRUTURA OBRIGATÓRIA do texto:
1. Parágrafo de abertura: "Aos [data por extenso], às [hora], reuniram-se nas dependências de [local] os colaboradores de ${unidade_nome || "empresa"}, sob condução de [condutor], para tratar de: [tema]."
2. Um parágrafo curto para CADA assunto da pauta, desenvolvendo o que foi apresentado/definido de forma profissional (2 a 4 frases cada). Use numeração (1., 2., 3.).
3. Parágrafo de encerramento: nada mais havendo a tratar, a reunião foi encerrada, e a presente ata segue assinada pelos presentes.

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois:
{ "texto": "..." }`;

    let textoFinal = "";

    if (process.env.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 3000,
        })
      });
      if (!response.ok) throw new Error("Erro na chamada OpenAI");
      const resData = await response.json();
      const parsed = JSON.parse(resData.choices[0]?.message?.content || "{}");
      textoFinal = parsed.texto || "";
    } else if (process.env.ANTHROPIC_API_KEY) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-8",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) throw new Error("Erro Anthropic");
      const dataResp = await response.json();
      let raw = (dataResp.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(raw);
      textoFinal = parsed.texto || "";
    }

    if (!textoFinal || !textoFinal.trim()) {
      return NextResponse.json({ error: "A IA não gerou o texto da ata. Tente novamente." }, { status: 422 });
    }

    return NextResponse.json({
      tema,
      data_reuniao: data,
      hora,
      local,
      condutor,
      texto: textoFinal.trim()
    });
  } catch (error) {
    console.error("[IA Ata] Catch:", error);
    return NextResponse.json({ error: "Não consegui gerar/transcrever a ata. Tente novamente." }, { status: 500 });
  }
}
