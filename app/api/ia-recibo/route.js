import { NextResponse } from "next/server";

// Gera o corpo formal de um RECIBO de prestação de serviço de manutenção
// a partir dos dados informados. Retorna o texto pronto (editável).
export async function POST(request) {
  try {
    const { servico, descricao, valor, prestador, pagador, forma_pagamento, data, unidade_nome } = await request.json();

    if (!servico || !valor) {
      return NextResponse.json({ error: "Informe o serviço e o valor." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const valorFmt = Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dataFmt = data ? String(data).split("-").reverse().join("/") : new Date().toLocaleDateString("pt-BR");

    const prompt = `Redija o corpo de um RECIBO de prestação de serviço de manutenção, formal e claro, em português do Brasil, pronto para impressão e assinatura.

Dados:
- Serviço: ${servico}
${descricao ? `- Detalhes: ${descricao}\n` : ""}- Valor: ${valorFmt}
- Prestador (quem recebe o pagamento): ${prestador || "____________________"}
- Pagador (quem paga): ${pagador || unidade_nome || "____________________"}
- Forma de pagamento: ${forma_pagamento || "____________________"}
- Data: ${dataFmt}

Estrutura do texto (2 a 3 parágrafos, SEM título — o título "RECIBO" já é impresso à parte):
1. "Recebi de [pagador] a importância de [valor por extenso + numérico], referente a [serviço + detalhes]."
2. Frase de quitação: "Para clareza e devida quitação, firmo o presente recibo, dando plena, geral e irrevogável quitação do valor recebido."
3. Local/data e menção à forma de pagamento.

Escreva o valor por extenso corretamente. Não use markdown. Responda ESTRITAMENTE com JSON:
{ "texto": "..." }`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });

    if (!response.ok) {
      console.error("[IA Recibo] Erro:", await response.text());
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data2 = await response.json();
    let texto = (data2.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(texto); } catch { const m = texto.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj?.texto) return NextResponse.json({ error: "A IA não gerou o recibo. Tente novamente." }, { status: 422 });

    return NextResponse.json({ texto: String(obj.texto).trim() });
  } catch (error) {
    console.error("[IA Recibo] Catch:", error);
    return NextResponse.json({ error: "Não consegui gerar o recibo." }, { status: 500 });
  }
}
