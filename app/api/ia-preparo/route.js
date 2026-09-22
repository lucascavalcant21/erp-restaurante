import { NextResponse } from "next/server";
import { promptDasInstrucoes, textoDasInstrucoesIA } from "../../lib/ficha-ia.mjs";

// "Organizar com IA" no editor da ficha: a pessoa explica com as próprias
// palavras e a IA devolve os passos. No prato, passos de MONTAGEM; no
// pré-preparo, etapas de produção com equipamento, fogo e tempo. Usa Claude
// (Anthropic). O pedido e a limpeza da resposta ficam em lib/ficha-ia.mjs.
export async function POST(request) {
  try {
    const { explicacao, nome_receita, ingredientes, tipo } = await request.json();

    if (!explicacao || explicacao.trim() === "") {
      return NextResponse.json({ error: "Explique com suas palavras como é feito." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Preparo] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    // Sem tipo, vale o uso antigo desta rota: modo de preparo de pré-preparo.
    const tipoFicha = tipo === "prato" ? "prato" : "pre_preparo";
    const prompt = promptDasInstrucoes({
      tipo: tipoFicha,
      explicacao,
      nomeReceita: nome_receita,
      ingredientes: Array.isArray(ingredientes) ? ingredientes : [],
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[IA Preparo] Erro da Anthropic:", errorData);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();

    // Remove cercas de markdown, caso a IA embrulhe o JSON
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(texto);
    } catch {
      // fallback: tenta achar o primeiro bloco { ... }
      const match = texto.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Retorno da IA não é JSON válido.");
      obj = JSON.parse(match[0]);
    }

    const modoPreparo = textoDasInstrucoesIA(obj, { tipo: tipoFicha });
    if (!modoPreparo) throw new Error("A IA não retornou etapas.");

    return NextResponse.json({ modo_preparo: modoPreparo });
  } catch (error) {
    console.error("[IA Preparo] Catch:", error);
    return NextResponse.json({ error: "Não consegui organizar os passos. Tente reformular." }, { status: 500 });
  }
}
