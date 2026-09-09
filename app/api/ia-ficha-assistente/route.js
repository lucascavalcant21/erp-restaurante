import { NextResponse } from "next/server";

// Classifica um pedido em linguagem natural sobre uma ficha técnica e devolve a
// INTENÇÃO estruturada. Só isso.
//
// A IA não faz conta e não recebe custo nenhum: ela lê a frase, diz o que a
// pessoa quer e extrai os valores citados. Quem calcula custo, CMV e preço é o
// app, com as funções de ficha-calculos.mjs, que têm teste. Modelo de linguagem
// errando centavo em precificação de restaurante é um erro caro e silencioso —
// e evitável.
//
// A tela só chega aqui quando o interpretador local (ficha-assistente.mjs) não
// reconheceu a frase. O caminho comum não gasta chamada.
//
// Usa fetch direto, como as outras 15 rotas de IA do projeto — não vale trazer
// uma dependência nova para uma rota só.

const INTENCOES = `
- "custo_atual": quer saber quanto a receita custa. Sem campos extras.
- "ingrediente_mais_caro": quer saber qual item mais pesa no custo. Sem campos extras.
- "simular_cmv": quer o preço para um CMV alvo. Campo: "cmv" (número, em %).
- "simular_preco_insumo": quer saber o efeito de um insumo mudar de preço.
  Campos: "insumo" (texto, como a pessoa falou), "preco" (número em reais),
  "unidade" ("kg" | "g" | "l" | "ml" | "un").
- "escalar": quer a receita recalculada para outra quantidade.
  Campos: "alvo" (número), "unidade" ("porcoes" | "kg" | "g" | "l" | "ml" | "un").
- "reduzir_custo": quer cortar um percentual do custo. Campo: "pct" (número, em %).
- "adicionar_ingrediente": quer incluir um item.
  Campos: "nome" (texto), "quantidade" (número), "unidade".
- "trocar_ingrediente": quer substituir um item por outro.
  Campos: "de" (texto), "para" (texto).
`.trim();

const SISTEMA = `Você classifica pedidos de cozinheiros e gerentes sobre uma ficha técnica de restaurante, em português do Brasil.

Devolva a intenção e os valores citados na frase. NÃO calcule nada, NÃO responda a pergunta, NÃO invente valores que a pessoa não disse.

Intenções possíveis:
${INTENCOES}

Se a frase não corresponder a nenhuma, use "desconhecido".

Regras de extração:
- Números vêm no formato brasileiro: "38,90" é 38.90; "1.234,56" é 1234.56.
- "R$ 50 o quilo" → preco 50, unidade "kg".
- Nomes de ingrediente: escreva como está na lista cadastrada quando reconhecer;
  se não reconhecer, escreva como a pessoa falou.
- "para 50 pessoas" e "para 20 porções" são ambos "escalar" com unidade "porcoes".

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois e sem cercas de código.`;

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tipo"],
  properties: {
    tipo: {
      type: "string",
      enum: [
        "custo_atual", "ingrediente_mais_caro", "simular_cmv",
        "simular_preco_insumo", "escalar", "reduzir_custo",
        "adicionar_ingrediente", "trocar_ingrediente", "desconhecido",
      ],
    },
    cmv: { type: "number" },
    pct: { type: "number" },
    alvo: { type: "number" },
    preco: { type: "number" },
    quantidade: { type: "number" },
    unidade: { type: "string", enum: ["porcoes", "kg", "g", "l", "ml", "un"] },
    insumo: { type: "string" },
    nome: { type: "string" },
    de: { type: "string" },
    para: { type: "string" },
  },
};

const desconhecido = () => NextResponse.json({ intencao: { tipo: "desconhecido" } });

export async function POST(request) {
  try {
    const { texto, ingredientes = [] } = await request.json();

    if (!texto || !String(texto).trim()) {
      return NextResponse.json({ error: "Diga o que você quer saber." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[IA Assistente da Ficha] ANTHROPIC_API_KEY não configurada.");
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    // Só os NOMES dos ingredientes, para o modelo escrever o nome do jeito que
    // está cadastrado. Nenhum custo sai daqui.
    const nomes = (Array.isArray(ingredientes) ? ingredientes : [])
      .map(n => String(n || "").trim()).filter(Boolean).slice(0, 60);

    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 1000,
        // Classificar uma frase curta não pede esforço alto.
        output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
        system: SISTEMA,
        messages: [{
          role: "user",
          content: nomes.length
            ? `Ingredientes cadastrados nesta receita: ${nomes.join(", ")}.\n\nPedido: ${texto}`
            : `Pedido: ${texto}`,
        }],
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      console.error("[IA Assistente da Ficha] Erro da Anthropic:", resposta.status, erro.slice(0, 300));
      const mensagem = resposta.status === 429
        ? "A IA está ocupada. Tente de novo em instantes."
        : "A IA não respondeu agora. Tente de novo.";
      return NextResponse.json({ error: mensagem }, { status: resposta.status === 429 ? 429 : 502 });
    }

    const dados = await resposta.json();
    // Recusa de segurança: trata como "não entendi", sem quebrar a tela.
    if (dados.stop_reason === "refusal") return desconhecido();

    let bruto = (dados.content || [])
      .filter(b => b.type === "text").map(b => b.text).join("").trim();
    bruto = bruto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      return NextResponse.json({ intencao: JSON.parse(bruto) });
    } catch {
      console.error("[IA Assistente da Ficha] resposta não era JSON:", bruto.slice(0, 200));
      return desconhecido();
    }
  } catch (erro) {
    console.error("[IA Assistente da Ficha]", erro);
    return NextResponse.json({ error: "Não consegui interpretar o pedido." }, { status: 500 });
  }
}
