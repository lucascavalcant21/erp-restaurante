import { NextResponse } from "next/server";

// Extrai uma lista de ingredientes (nome, marca, quantidade, unidade, valor pago)
// a partir de texto colado e/ou uma foto (nota fiscal, lista de compras, etiqueta).
// A normalização de unidade (g->kg, ml->l) e o cálculo do custo unitário são feitos
// aqui no servidor (determinístico), não pela IA — evita erro de aritmética do modelo.
export async function POST(request) {
  try {
    const { texto, imagem_base64, imagem_media_type } = await request.json();

    if ((!texto || !texto.trim()) && !imagem_base64) {
      return NextResponse.json({ error: "Envie uma lista de texto ou uma foto." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Insumos] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const prompt = `Você é um assistente de compras de restaurante. Extraia TODOS os ingredientes/insumos mencionados no texto e/ou na imagem (pode ser uma nota fiscal, lista de compras escrita à mão, etiqueta de produto ou print de app de fornecedor).

Para CADA ingrediente, extraia:
- "nome": nome do produto, limpo (ex: "Tomate Carmem", "Filé de Frango", "Vodka Smirnoff"). Não inclua a marca no nome se a marca for algo separável.
- "marca": a marca do produto, se identificável (ex: "Carmem", "Sadia", "Smirnoff"). Use "" se não for possível identificar.
- "quantidade": o número da quantidade comprada, exatamente como está (ex: se for "2kg", quantidade=2; se for "900ml", quantidade=900).
- "unidade": a unidade EXATA como está escrita, normalizada para um destes valores: "kg", "g", "l", "ml", "un". Use "un" para itens contados (unidade, caixa, pacote, dúzia etc. — nesse caso quantidade é a contagem).
- "valor_total": o valor em reais PAGO por essa quantidade (o preço total da linha, não o preço unitário, a menos que só o unitário esteja disponível — nesse caso multiplique mentalmente pela quantidade para dar o valor total).

Ignore linhas que não sejam produtos (totais, descontos, taxas, cabeçalhos, CNPJ etc.).
Se não conseguir identificar um valor confiável para algum campo, ainda assim inclua o item com o que for possível — o humano vai revisar antes de salvar.

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{ "itens": [ { "nome": "...", "marca": "...", "quantidade": 0, "unidade": "kg", "valor_total": 0 } ] }`;

    const contentBlocks = [];
    if (imagem_base64 && imagem_media_type) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: imagem_media_type, data: imagem_base64 },
      });
    }
    contentBlocks.push({ type: "text", text: `${prompt}\n\nTEXTO FORNECIDO PELO USUÁRIO (pode estar vazio se só houver imagem):\n${texto || "(nenhum)"}` });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 4000,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[IA Insumos] Erro da Anthropic:", errorData);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let texto_resp = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto_resp = texto_resp.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(texto_resp);
    } catch {
      const match = texto_resp.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Retorno da IA não é JSON válido.");
      obj = JSON.parse(match[0]);
    }

    const itensBrutos = Array.isArray(obj.itens) ? obj.itens : [];
    if (itensBrutos.length === 0) {
      return NextResponse.json({ error: "Não encontrei nenhum ingrediente no texto/imagem enviado." }, { status: 422 });
    }

    // Normalização determinística: g->kg, ml->l (mesma convenção usada nas fichas técnicas)
    const itens = itensBrutos.map(it => {
      const nome = String(it.nome || "").trim();
      const marca = String(it.marca || "").trim();
      const qtd = Number(it.quantidade) || 0;
      const valorTotal = Number(it.valor_total) || 0;
      let unidadeLida = String(it.unidade || "").toLowerCase().trim();
      if (!["kg", "g", "l", "ml", "un"].includes(unidadeLida)) unidadeLida = "un";

      let unidade_medida = unidadeLida;
      let quantidadeBase = qtd;
      if (unidadeLida === "g") { unidade_medida = "kg"; quantidadeBase = qtd / 1000; }
      if (unidadeLida === "ml") { unidade_medida = "l"; quantidadeBase = qtd / 1000; }

      const custo_unitario = quantidadeBase > 0 ? Math.round((valorTotal / quantidadeBase) * 10000) / 10000 : 0;

      return { nome, marca, unidade_medida, custo_unitario, quantidade_lida: qtd, unidade_lida: unidadeLida, valor_total_lido: valorTotal };
    }).filter(it => it.nome);

    return NextResponse.json({ itens });
  } catch (error) {
    console.error("[IA Insumos] Catch:", error);
    return NextResponse.json({ error: "Não consegui ler a lista/foto. Tente novamente ou digite manualmente." }, { status: 500 });
  }
}
