import { NextResponse } from "next/server";

// Monta um checklist completo e organizado: título + tarefas divididas em
// CATEGORIAS (tópicos), a partir do setor, momento do dia e um contexto livre.
export async function POST(request) {
  try {
    const { departamento, tipo, contexto, unidade_nome, foto } = await request.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const deptLabel = departamento === "salao" ? "Salão" : departamento === "bar" ? "Bar" : "Cozinha";
    const tipoLabel = {
      abertura: "Abertura", fechamento: "Fechamento", mise_en_place: "Mise en Place",
      pre_preparos: "Pré-preparos para outro dia", limpeza_organizacao: "Limpeza e Organização",
    }[tipo] || tipo;

    const prompt = `Você é um chef/gerente experiente montando um CHECKLIST operacional de restaurante, pronto para o time executar.

Setor: ${deptLabel}
Momento do dia: ${tipoLabel}
${unidade_nome ? `Restaurante: ${unidade_nome}\n` : ""}${contexto ? `Contexto/pedido do gestor: ${contexto}\n` : ""}
Monte um checklist REAL, específico e prático para esse setor e momento. Organize as tarefas em CATEGORIAS (tópicos) claros — por exemplo, no bar: "Destilados e garrafas", "Gelo e insumos", "Limpeza da bancada", "Equipamentos", "Conferência de estoque". Cada categoria com suas tarefas objetivas (verbo no infinitivo, ex: "Conferir validade dos sucos").

Regras:
- Entre 4 e 8 categorias, cada uma com 2 a 6 tarefas.
- Tarefas concretas e verificáveis, sem repetição.
- Sem emojis. Português do Brasil.
- Título curto e direto para o checklist.

${foto ? `
A FOTO ANEXADA é do ambiente real deste restaurante. Olhe o que está nela — equipamentos, bancadas, geladeiras, prateleiras, o que está fora do lugar — e monte o checklist a partir do que você vê, citando os itens concretos da imagem. Não descreva a foto: transforme em tarefas.
` : ""}
Se souber estimar, inclua "minutos" com o tempo médio de cada tarefa (número inteiro, sem unidade). Omita quando não fizer sentido.

Responda ESTRITAMENTE com JSON, sem markdown:
{ "titulo": "...", "itens": [ { "categoria": "Nome da categoria", "texto": "Tarefa a fazer", "minutos": 5 }, ... ] }`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      // Com foto a mensagem vira multimodal: bloco de imagem ANTES do texto, que
      // é a ordem que o modelo lê melhor. foto.data precisa vir em base64 puro,
      // sem o prefixo "data:image/...;base64,".
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: foto?.data
            ? [
                { type: "image", source: { type: "base64", media_type: foto.media_type || "image/jpeg", data: foto.data } },
                { type: "text", text: prompt },
              ]
            : prompt,
        }],
      }),
    });

    if (!response.ok) {
      console.error("[IA Checklist] Erro:", await response.text());
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    texto = texto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(texto); } catch { const m = texto.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj?.itens || !Array.isArray(obj.itens) || obj.itens.length === 0) {
      return NextResponse.json({ error: "A IA não gerou o checklist. Tente novamente." }, { status: 422 });
    }

    const itens = obj.itens
      .filter(i => i && (i.texto || "").trim())
      .map((i, idx) => {
        // A IA às vezes devolve "5 min" ou "5-10". Fica só o primeiro número
        // inteiro; qualquer outra coisa vira vazio, que a tela trata como
        // "sem tempo" em vez de gravar lixo no checklist.
        const bruto = String(i.minutos ?? "").match(/\d+/);
        const minutos = bruto ? Number(bruto[0]) : "";
        return {
          id: Date.now() + idx,
          texto: String(i.texto).trim(),
          categoria: (i.categoria || "").trim(),
          responsavel: "",
          minutos: minutos > 0 ? minutos : "",
          foto_url: null,
          conjunto: false,
        };
      });

    return NextResponse.json({ titulo: String(obj.titulo || "").trim(), itens });
  } catch (error) {
    console.error("[IA Checklist] Catch:", error);
    return NextResponse.json({ error: "Não consegui montar o checklist." }, { status: 500 });
  }
}
