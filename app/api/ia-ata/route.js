import { NextResponse } from "next/server";

// Gera o texto formal de uma ATA DE REUNIÃO a partir do tema e da pauta
// (assuntos) informados. O texto volta editável — o humano revisa antes
// de salvar/imprimir.
export async function POST(request) {
  try {
    const { tema, assuntos, data, hora, local, condutor, unidade_nome } = await request.json();

    if (!tema || !String(tema).trim()) {
      return NextResponse.json({ error: "Informe o tema da reunião." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Ata] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

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

REGRAS:
- Tom formal mas simples, sem juridiquês exagerado.
- NÃO invente decisões específicas com números/valores que não estejam na pauta; desenvolva o assunto de forma genérica e profissional quando faltar detalhe.
- Não use markdown, títulos ou listas com hífen — apenas parágrafos numerados quando for a pauta.

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois:
{ "texto": "..." }`;

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

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[IA Ata] Erro da Anthropic:", errorData);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const dataResp = await response.json();
    let texto = (dataResp.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(texto);
    } catch {
      const match = texto.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Retorno da IA não é JSON válido.");
      obj = JSON.parse(match[0]);
    }

    if (!obj.texto || !String(obj.texto).trim()) {
      return NextResponse.json({ error: "A IA não gerou o texto da ata. Tente novamente." }, { status: 422 });
    }

    return NextResponse.json({ texto: String(obj.texto).trim() });
  } catch (error) {
    console.error("[IA Ata] Catch:", error);
    return NextResponse.json({ error: "Não consegui gerar a ata. Tente novamente." }, { status: 500 });
  }
}
