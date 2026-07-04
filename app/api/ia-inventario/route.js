import { NextResponse } from "next/server";

// Extrai itens de INVENTÁRIO/patrimônio (talheres, louça, potes, panelas,
// freezers, móveis...) de um texto colado e/ou foto (lista escrita à mão,
// planilha, foto da prateleira). Devolve nome, categoria, quantidade,
// valor unitário (se houver) e localização — o humano revisa antes de salvar.
const CATEGORIAS = [
  "Talheres", "Louça e Copos", "Potes e Armazenamento", "Panelas e Utensílios",
  "Equipamentos", "Eletrodomésticos", "Móveis", "Decoração", "Limpeza", "Outros",
];

export async function POST(request) {
  try {
    const { texto, imagem_base64, imagem_media_type } = await request.json();

    if ((!texto || !texto.trim()) && !imagem_base64) {
      return NextResponse.json({ error: "Envie uma lista de texto ou uma foto." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Inventario] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const prompt = `Você é um assistente de gestão de restaurante fazendo o INVENTÁRIO FÍSICO (patrimônio) de uma loja. Extraia TODOS os itens mencionados no texto e/ou na imagem (lista escrita à mão, planilha, foto de prateleira/cozinha, nota fiscal de utensílios).

São itens como: talheres, pratos, copos, taças, potes, panelas, frigideiras, tábuas, bandejas, freezers, geladeiras, fogões, fritadeiras, liquidificadores, mesas, cadeiras, decoração, material de limpeza etc. NÃO são ingredientes/comida.

Para CADA item, extraia:
- "nome": nome claro do item (ex: "Garfo de mesa inox", "Freezer horizontal 400L", "Pote hermético 2L").
- "categoria": exatamente UMA destas: ${CATEGORIAS.map(c => `"${c}"`).join(", ")}. Escolha a mais adequada; na dúvida use "Outros".
- "quantidade": número de unidades contadas (ex: 48 garfos -> 48). Se não houver contagem, use 1.
- "valor_unitario": valor em reais de UMA unidade, se identificável. Use 0 se não houver.
- "localizacao": onde o item fica, se mencionado (ex: "Cozinha", "Bar", "Depósito"). Use "" se não houver.

Ignore linhas que não sejam itens físicos (totais, cabeçalhos, datas).
Se algum campo não for identificável, inclua o item mesmo assim com o que der — o humano revisa antes de salvar.

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{ "itens": [ { "nome": "...", "categoria": "Talheres", "quantidade": 0, "valor_unitario": 0, "localizacao": "" } ] }`;

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
      console.error("[IA Inventario] Erro da Anthropic:", errorData);
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
      return NextResponse.json({ error: "Não encontrei nenhum item no texto/imagem enviado." }, { status: 422 });
    }

    const itens = itensBrutos.map(it => ({
      nome: String(it.nome || "").trim(),
      categoria: CATEGORIAS.includes(it.categoria) ? it.categoria : "Outros",
      quantidade: Math.max(0, Number(it.quantidade) || 1),
      valor_unitario: Math.max(0, Number(it.valor_unitario) || 0),
      localizacao: String(it.localizacao || "").trim(),
    })).filter(it => it.nome);

    return NextResponse.json({ itens });
  } catch (error) {
    console.error("[IA Inventario] Catch:", error);
    return NextResponse.json({ error: "Não consegui ler a lista/foto. Tente novamente ou cadastre manualmente." }, { status: 500 });
  }
}
