import { NextResponse } from "next/server";

function limparLista(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function POST(request) {
  try {
    const { cargo, contexto } = await request.json();
    const nomeCargo = String(cargo || "").trim();
    if (!nomeCargo) return NextResponse.json({ error: "Informe o cargo antes de gerar os requisitos." }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });

    const prompt = `Você é especialista em recrutamento para restaurantes brasileiros. Crie requisitos profissionais, objetivos e realistas para a vaga abaixo.

CARGO: ${nomeCargo}
CONTEXTO ADICIONAL: ${String(contexto || "Restaurante e operação de food service").trim()}

Regras:
- Gere de 5 a 8 pré-requisitos curtos e práticos.
- Inclua experiência, conhecimentos técnicos, comportamento profissional, organização, trabalho em equipe e disponibilidade quando fizer sentido.
- Não inclua idade, gênero, estado civil, filhos, aparência, religião ou qualquer critério discriminatório.
- Não invente salário nem valor de taxa de serviço.
- Sugira horário, dias de trabalho e folga apenas de forma editável e prudente; não apresente como obrigação legal.

Responda estritamente em JSON:
{
  "requisitos": ["requisito 1", "requisito 2"],
  "horario_trabalho": "sugestão curta de horário ou vazio",
  "dias_trabalho": "sugestão de escala ou vazio",
  "folga": "sugestão de folga semanal ou vazio",
  "domingo_folga": "1 domingo de folga por mês"
}`;

    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resposta.ok) {
      console.error("[IA requisitos vaga]", await resposta.text());
      return NextResponse.json({ error: "A IA não conseguiu gerar os requisitos agora." }, { status: 502 });
    }

    const json = await resposta.json();
    const conteudo = (json.content || []).filter(bloco => bloco.type === "text").map(bloco => bloco.text).join("").trim();
    const textoJson = conteudo.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const gerado = JSON.parse(textoJson);
    const requisitos = limparLista(gerado.requisitos);
    if (!requisitos.length) return NextResponse.json({ error: "A IA não retornou requisitos válidos." }, { status: 422 });

    return NextResponse.json({
      requisitos,
      horario_trabalho: String(gerado.horario_trabalho || "").trim(),
      dias_trabalho: String(gerado.dias_trabalho || "").trim(),
      folga: String(gerado.folga || "").trim(),
      domingo_folga: String(gerado.domingo_folga || "1 domingo de folga por mês").trim(),
    });
  } catch (error) {
    console.error("[IA requisitos vaga]", error);
    return NextResponse.json({ error: "Não consegui gerar os requisitos. Tente novamente." }, { status: 500 });
  }
}
