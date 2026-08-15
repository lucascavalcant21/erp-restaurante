import { NextResponse } from "next/server";

export const maxDuration = 60;

// INTENT PARSER do Assistente Hefisto.
// Esta rota NÃO executa nada e NÃO gera SQL: ela só transforma linguagem natural
// em uma intenção estruturada. A execução acontece no cliente, através das libs
// internas do ERP (mesmas validações das telas), depois de resolver os registros
// reais e conferir permissões.

const ACOES = `
- "navegar": abrir uma tela. campo "rota" com um dos caminhos abaixo.
- "consultar_estoque": saber saldo de um produto.
- "entrada_estoque": dar entrada/comprar/receber produto.
- "retirada_estoque": baixa/retirada/consumo/perda de produto.
- "responder": dúvida geral que não exige ação no sistema.
- "desconhecido": não deu para entender.
`;

const ROTAS = `
/dashboard                                  painel geral
/dashboard/operacao/estoque?dept=cozinha    estoque da cozinha
/dashboard/operacao/estoque?dept=bar        estoque do bar
/dashboard/operacao/ingredientes?dept=cozinha  ingredientes da cozinha
/dashboard/operacao/ingredientes?dept=bar   produtos do bar
/dashboard/operacao/fichas?dept=cozinha     fichas técnicas
/dashboard/operacao/fichas?dept=bar         fichas de drinks
/dashboard/operacao/compras                 compras
/dashboard/operacao/etiquetas               etiquetas e validade
/dashboard/operacao/rotina                  checklist
/dashboard/financeiro                       financeiro
/dashboard/rh                               RH e equipe
/dashboard/relatorios                       relatórios
`;

export async function POST(request) {
  try {
    const { texto, contexto } = await request.json();
    if (!texto || !String(texto).trim()) {
      return NextResponse.json({ error: "Diga o que você precisa." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

    const prompt = `Você é o interpretador do assistente de um ERP de restaurante (pt-BR).
Transforme o pedido do usuário em UMA intenção estruturada. Você NÃO executa nada.

Ações possíveis:${ACOES}

Rotas válidas para "navegar":${ROTAS}

Contexto da tela atual do usuário (use para resolver referências como "aqui", "deste produto"):
${JSON.stringify(contexto || {})}

Regras:
- Nunca invente produtos, fornecedores, ids ou valores. Se o usuário não disse, deixe null.
- "setor" só pode ser "cozinha" ou "bar" (use o contexto quando o usuário não disser).
- Quantidades: número puro. Unidades: kg, g, l, ml, un, cx, garrafa, lata, pacote.
- Se faltar informação obrigatória, liste em "faltantes".
  Para entrada_estoque, obrigatórios: produto, quantidade. (valor e fornecedor são desejáveis)
  Para retirada_estoque, obrigatórios: produto, quantidade.
- "resposta_curta": uma frase amigável dizendo o que você entendeu (ou a pergunta do que falta).

- Para "etiquetas": o usuário pode pedir VÁRIOS produtos com quantidades diferentes
  numa frase só. Ex.: "imprime 5 etiquetas de alho, 3 de tomate e 10 de cebola"
  vira etiquetas: [{produto:"alho",copias:5},{produto:"tomate",copias:3},{produto:"cebola",copias:10}].
  Quando não disser a quantidade de um item, use copias: 1.

Responda ESTRITAMENTE em JSON, sem markdown:
{
  "acao": "navegar|consultar_estoque|entrada_estoque|retirada_estoque|etiquetas|responder|desconhecido",
  "etiquetas": [{ "produto": "string", "copias": number }],
  "modulo": "inventory|core|...",
  "setor": "cozinha|bar|null",
  "produto": "string|null",
  "quantidade": number|null,
  "unidade": "string|null",
  "valor_unitario": number|null,
  "valor_total": number|null,
  "fornecedor": "string|null",
  "motivo": "string|null",
  "rota": "string|null",
  "faltantes": ["campo"],
  "resposta_curta": "string"
}

Pedido do usuário: """${String(texto).trim()}"""`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1200,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      }),
    });

    if (!response.ok) {
      console.error("[Hefisto]", await response.text());
      return NextResponse.json({ error: "Não consegui falar com a IA agora." }, { status: 502 });
    }

    const data = await response.json();
    let saida = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    saida = saida.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let obj;
    try { obj = JSON.parse(saida); } catch { const m = saida.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    if (!obj) return NextResponse.json({ error: "Não entendi o pedido. Pode reformular?" }, { status: 422 });

    // Whitelist: nunca confiar cegamente no que voltou do modelo.
    const acoesValidas = ["navegar", "consultar_estoque", "entrada_estoque", "retirada_estoque", "etiquetas", "responder", "desconhecido"];
    const intencao = {
      acao: acoesValidas.includes(obj.acao) ? obj.acao : "desconhecido",
      // Lista de etiquetas: vários produtos, cada um com sua quantidade.
      etiquetas: Array.isArray(obj.etiquetas)
        ? obj.etiquetas.slice(0, 30)
            .filter(e => e && e.produto)
            .map(e => ({
              produto: String(e.produto).slice(0, 120),
              copias: Math.max(1, Math.min(100, Number(e.copias) || 1)),
            }))
        : [],
      modulo: typeof obj.modulo === "string" ? obj.modulo : null,
      setor: obj.setor === "bar" || obj.setor === "cozinha" ? obj.setor : null,
      produto: obj.produto ? String(obj.produto).slice(0, 120) : null,
      quantidade: Number.isFinite(Number(obj.quantidade)) ? Number(obj.quantidade) : null,
      unidade: obj.unidade ? String(obj.unidade).slice(0, 12) : null,
      valor_unitario: Number.isFinite(Number(obj.valor_unitario)) ? Number(obj.valor_unitario) : null,
      valor_total: Number.isFinite(Number(obj.valor_total)) ? Number(obj.valor_total) : null,
      fornecedor: obj.fornecedor ? String(obj.fornecedor).slice(0, 120) : null,
      motivo: obj.motivo ? String(obj.motivo).slice(0, 200) : null,
      // Só aceita rota interna do próprio ERP.
      rota: typeof obj.rota === "string" && obj.rota.startsWith("/dashboard") ? obj.rota : null,
      faltantes: Array.isArray(obj.faltantes) ? obj.faltantes.slice(0, 6).map(String) : [],
      resposta_curta: obj.resposta_curta ? String(obj.resposta_curta).slice(0, 400) : "",
    };
    return NextResponse.json({ intencao });
  } catch (e) {
    console.error("[Hefisto] Catch:", e);
    return NextResponse.json({ error: "Falha inesperada ao interpretar o pedido." }, { status: 500 });
  }
}
