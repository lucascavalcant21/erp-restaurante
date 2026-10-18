import { NextResponse } from "next/server";

const SISTEMA = `Você é o Green Dot Assist, o assistente operacional inteligente de restaurante do sistema Héfisto ERP, utilizado em tablets/iPads pela equipe de cozinha, bar e salão em tempo real.
Responda SEMPRE em português do Brasil, de forma prática, direta, acolhedora e estruturada para leitura rápida no chão de loja.
Classifique também a intenção do colaborador em um dos fluxos visuais quando aplicável:
- "receita": dúvidas sobre fichas técnicas, pratos, drinks, ingredientes, preparo, alergênicos ou harmonização.
- "manutencao": falhas em equipamentos (forno combinado, fritadeira, chopeira, câmara fria, impressora, fogão) ou abertura de chamado.
- "escala": pico de movimento, escala de turno, chamar colaborador extra ou mapa de posicionamento nas praças (Play Caller).
- "estoque": descongelamento seguro (Pull-to-Thaw), organização de câmara fria, validade PVPS ou consulta de insumos.
- "geral": qualquer outra dúvida operacional de restaurante.`;

export async function POST(request) {
  try {
    const body = await request.json();
    const pergunta = String(body?.pergunta || "").trim();
    const contextoLoja = body?.contextoLoja || {};

    if (!pergunta) {
      return NextResponse.json({ error: "Digite uma pergunta ou tópico." }, { status: 400 });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 700,
            system: SISTEMA,
            messages: [
              {
                role: "user",
                content: `Contexto da unidade: ${JSON.stringify(contextoLoja)}\n\nPergunta do colaborador no tablet: ${pergunta}`,
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const textoIA = data?.content?.[0]?.text || "";
          if (textoIA) {
            return NextResponse.json({ resposta: textoIA, fonte: "anthropic" });
          }
        }
      } catch (_) {
        // Fallback silencioso para o motor local caso a API externa falhe
      }
    }

    return NextResponse.json({
      resposta: gerarRespostaLocalRestaurante(pergunta, contextoLoja),
      fonte: "local-rag",
    });
  } catch (err) {
    return NextResponse.json(
      { resposta: "Posso ajudar com fichas técnicas, manutenção de equipamentos, escala de pico ou rotinas de estoque.", fonte: "fallback" },
      { status: 200 }
    );
  }
}

function gerarRespostaLocalRestaurante(pergunta, contextoLoja) {
  const q = pergunta.toLowerCase();
  const fichasCadastradas = Array.isArray(contextoLoja?.fichas) ? contextoLoja.fichas : [];
  const itensEstoque = Array.isArray(contextoLoja?.estoque) ? contextoLoja.estoque : [];

  // Verifica se perguntou sobre alguma ficha cadastrada no ERP
  const fichaEncontrada = fichasCadastradas.find(
    (f) => f?.nome && q.includes(String(f.nome).toLowerCase())
  );
  if (fichaEncontrada) {
    return `Encontrei a ficha técnica cadastrada no Héfisto para **${fichaEncontrada.nome}**! Abaixo você confere o porcionamento por tamanho, passos principais de bancada e sugestões de adaptação.`;
  }

  // Verifica se perguntou sobre saldo de algum item do estoque real
  const insumoEncontrado = itensEstoque.find(
    (i) => i?.nome && q.includes(String(i.nome).toLowerCase())
  );
  if (insumoEncontrado) {
    return `Consulta em tempo real no estoque da unidade: temos **${insumoEncontrado.quantidade_atual ?? 0} ${insumoEncontrado.unidade || "un"}** de **${insumoEncontrado.nome}** (Estoque mínimo: ${insumoEncontrado.estoque_minimo ?? "não definido"}). Lembre-se de seguir a regra PVPS ao retirar da câmara!`;
  }

  if (q.includes("alerg") || q.includes("lactose") || q.includes("glúten") || q.includes("gluten")) {
    return "Protocolo de Alergênicos na Cozinha: 1) Utilize utensílios, tábuas e frigideiras higienizadas separadamente (cor roxa/alergênicos); 2) Para restrição a lactose, substitua manteiga tradicional por Manteiga Ghee sem lactose ou emulsão de azeite extravirgem; 3) Identifique o prato no Pass com o palito sinalizador de alergia.";
  }

  if (q.includes("temperatura") || q.includes("anvisa") || q.includes("validade")) {
    return "Padrão Térmico ANVISA RDC 216: • Cocção/Regeneração no centro geométrico: mínimo 74°C. • Espera quente (Pass/Banho-maria): acima de 60°C por no máximo 6h. • Resfriamento rápido: de 60°C a 10°C em até 2 horas. • Câmara fria de resfriados: 0°C a 4°C.";
  }

  return "Consultei os manuais operacionais da loja! Selecione abaixo um dos cards interativos para ver a ficha técnica detalhada, iniciar o diagnóstico de um equipamento ou ajustar o posicionamento da equipe no turno.";
}
