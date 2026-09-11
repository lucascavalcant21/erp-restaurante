import { NextResponse } from "next/server";

// Função para estruturar texto localmente (fallback sem IA ou sem internet/chave)
function parseTextLocal(contexto, departamento, tipo) {
  const deptLabel = departamento === "salao" ? "Salão" : departamento === "bar" ? "Bar" : "Cozinha";
  const linhas = String(contexto || "")
    .split(/\r?\n+/)
    .map(l => l.trim().replace(/^[-*•\d+.)\s]*(\[[ xX]\])?\s*/, "").trim())
    .filter(Boolean);

  if (linhas.length === 0) return null;

  let faseAtual = tipo && ["abertura", "durante_turno", "fechamento"].includes(tipo) ? tipo : "abertura";
  const itens = [];

  linhas.forEach((linha, idx) => {
    const lLower = linha.toLowerCase();
    
    // Detecta se a linha marca o início de um grupo/seção de fase
    if (lLower.includes("abertura") || lLower.includes("início") || lLower.includes("inicio") || lLower.includes("abrir")) {
      faseAtual = "abertura";
      if (linha.endsWith(":") || lLower.startsWith("fase") || lLower.startsWith("etapa") || lLower === "abertura") return;
    } else if (lLower.includes("durante") || lLower.includes("operação") || lLower.includes("operacao") || lLower.includes("turno")) {
      faseAtual = "durante_turno";
      if (linha.endsWith(":") || lLower.startsWith("fase") || lLower.startsWith("etapa") || lLower === "durante o turno") return;
    } else if (lLower.includes("fechamento") || lLower.includes("encerramento") || lLower.includes("fim do turno") || lLower.includes("fechar")) {
      faseAtual = "fechamento";
      if (linha.endsWith(":") || lLower.startsWith("fase") || lLower.startsWith("etapa") || lLower === "fechamento") return;
    }

    let itemFase = faseAtual;
    if (lLower.includes("fechar") || lLower.includes("fechamento") || lLower.includes("lixo") || lLower.includes("desligar") || lLower.includes("trancar") || lLower.includes("conferência final") || lLower.includes("conferencia final")) {
      itemFase = "fechamento";
    } else if (lLower.includes("abrir") || lLower.includes("abertura") || lLower.includes("ligar") || lLower.includes("misa") || lLower.includes("mise") || lLower.includes("conferir portas")) {
      itemFase = "abertura";
    }

    const matchHora = linha.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
    const horario = matchHora ? matchHora[0] : (itemFase === "abertura" ? "08:00" : itemFase === "durante_turno" ? "14:00" : "22:00");

    const matchMin = linha.match(/\b(\d+)\s*(min|m|minutos)\b/i);
    const tempoMin = matchMin ? Math.max(1, parseInt(matchMin[1], 10)) : 5;

    const textoLimpo = linha.replace(/\b([01]?\d|2[0-3]):[0-5]\d\b/g, "").replace(/\b(\d+)\s*(min|m|minutos)\b/gi, "").trim() || linha;

    itens.push({
      id: Date.now() + idx,
      texto: textoLimpo,
      categoria: itemFase === "abertura" ? "Abertura & Preparação" : itemFase === "durante_turno" ? "Operação & Manutenção" : "Fechamento & Limpeza",
      fase_turno: itemFase,
      horario_previsto: horario,
      tempo_minutos: tempoMin,
      responsavel: "",
      foto_antes: "",
      foto_final: "",
    });
  });

  if (itens.length === 0) return null;

  return {
    titulo: `Checklist de ${deptLabel}`,
    itens,
  };
}

export async function POST(request) {
  try {
    const { departamento, tipo, contexto, imagem, unidade_nome } = await request.json();

    const deptLabel = departamento === "salao" ? "Salão" : departamento === "bar" ? "Bar" : "Cozinha";
    const tipoLabel = {
      abertura: "Abertura / Início do Turno",
      durante_turno: "Durante o Turno",
      fechamento: "Fechamento / Fim do Turno",
      mise_en_place: "Mise en Place",
      pre_preparos: "Pré-preparos",
      limpeza_organizacao: "Limpeza e Organização",
    }[tipo] || tipo || "Rotina Geral";

    const promptText = `Você é um chef/gerente especialista em operacional de restaurantes e food service.
Sua missão é extrair, interpretar e criar um CHECKLIST OPERACIONAL COMPLETO e impecável para a equipe executar.

${imagem ? "ATENÇÃO: Analise cuidadosamente a IMAGEM enviada (que pode ser a foto de um quadro branco, folha impressa, papel manuscrito ou documento)." : ""}
${contexto ? `Texto / Instruções / Checklist colado pelo gestor:\n"${contexto}"\n` : ""}
Setor: ${deptLabel}
Fase foco: ${tipoLabel}
${unidade_nome ? `Restaurante: ${unidade_nome}\n` : ""}

REGRAS OBRIGATÓRIAS:
1. Extraia todas as tarefas mencionadas no texto ou na foto. Se o texto/imagem for genérico, crie o checklist completo para o setor.
2. Divida e classifique cada tarefa estritamente em uma das 3 fases do turno:
   - "abertura" (Início do Turno / Preparação)
   - "durante_turno" (Durante o Turno / Operação / Manutenção)
   - "fechamento" (Fim do Turno / Encerramento / Limpeza pesada)
3. Defina um horário previsto sugerido realista no formato "HH:MM" para cada tarefa (ex: "08:00", "11:30", "15:00", "22:30").
4. Agrupe por categorias claras (ex: "Equipamentos", "Higiene & Sanitização", "Estoque & Validades", "Salão & Mesas", "Bancada & Bebidas").
5. Informe tempo estimado realista em minutos para cada tarefa.
6. Texto claro, objetivo, iniciando com verbo no infinitivo (ex: "Sanitizar bancadas de inox").

Responda ESTRITAMENTE em formato JSON sem markdown:
{
  "titulo": "Título curto e profissional do checklist",
  "itens": [
    {
      "categoria": "Nome da Categoria",
      "texto": "Descrição objetiva da tarefa",
      "fase_turno": "abertura | durante_turno | fechamento",
      "horario_previsto": "08:30",
      "tempo_minutos": 10
    }
  ]
}`;

    let resultObj = null;

    // 1. Tenta OpenAI se a chave estiver configurada
    if (process.env.OPENAI_API_KEY) {
      try {
        const userMessageContent = [];
        if (imagem && typeof imagem === "string") {
          let dataUrl = imagem;
          if (!imagem.startsWith("data:")) {
            dataUrl = `data:image/jpeg;base64,${imagem}`;
          }
          userMessageContent.push({
            type: "image_url",
            image_url: { url: dataUrl, detail: "low" },
          });
        }
        userMessageContent.push({ type: "text", text: promptText });

        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: imagem ? "gpt-4o" : "gpt-4o-mini",
            messages: [{ role: "user", content: userMessageContent }],
            response_format: { type: "json_object" },
            max_tokens: 3500,
          }),
        });

        if (openAiRes.ok) {
          const openAiData = await openAiRes.json();
          const raw = openAiData.choices?.[0]?.message?.content;
          if (raw) resultObj = JSON.parse(raw);
        } else {
          console.error("[IA Checklist] OpenAI API Error:", await openAiRes.text());
        }
      } catch (errOpenAi) {
        console.error("[IA Checklist] OpenAI Exception:", errOpenAi);
      }
    }

    // 2. Tenta Anthropic Claude se OpenAI não respondeu ou não configurada
    if (!resultObj && process.env.ANTHROPIC_API_KEY) {
      const userMessageContent = [];
      if (imagem && typeof imagem === "string") {
        let mediaType = "image/jpeg";
        let base64Pure = imagem;
        if (imagem.includes(";base64,")) {
          const parts = imagem.split(";base64,");
          mediaType = parts[0].replace("data:", "") || "image/jpeg";
          base64Pure = parts[1];
        }
        userMessageContent.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Pure },
        });
      }
      userMessageContent.push({ type: "text", text: promptText });

      const modelosValidos = ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-haiku-20240307"];
      for (const modelName of modelosValidos) {
        try {
          const antRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: 3500,
              messages: [{ role: "user", content: userMessageContent }],
            }),
          });

          if (antRes.ok) {
            const data = await antRes.json();
            let rawText = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
            rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            try {
              resultObj = JSON.parse(rawText);
            } catch {
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) resultObj = JSON.parse(match[0]);
            }
            if (resultObj) break;
          } else {
            console.error(`[IA Checklist] Anthropic API Error (${modelName}):`, await antRes.text());
          }
        } catch (errAnt) {
          console.error(`[IA Checklist] Anthropic Exception (${modelName}):`, errAnt?.message || String(errAnt));
        }
      }
    }

    // 3. Fallback: se nenhuma IA respondeu (ou chaves ausentes), tenta converter texto localmente
    if ((!resultObj || !resultObj.itens || resultObj.itens.length === 0) && contexto && contexto.trim()) {
      resultObj = parseTextLocal(contexto, departamento, tipo);
    }

    if (!resultObj?.itens || !Array.isArray(resultObj.itens) || resultObj.itens.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível extrair o checklist. Se estiver usando foto, verifique a chave da IA ou digite/cole o texto das tarefas." },
        { status: 422 }
      );
    }

    const fasesValidas = new Set(["abertura", "durante_turno", "fechamento"]);

    const itens = resultObj.itens
      .filter(i => i && (i.texto || "").trim())
      .map((i, idx) => {
        const fase = fasesValidas.has(String(i.fase_turno).toLowerCase())
          ? String(i.fase_turno).toLowerCase()
          : "abertura";
        return {
          id: Date.now() + idx,
          texto: String(i.texto).trim(),
          categoria: String(i.categoria || "Geral").trim(),
          fase_turno: fase,
          horario_previsto: String(i.horario_previsto || "").trim() || (fase === "abertura" ? "08:00" : fase === "durante_turno" ? "14:00" : "22:00"),
          tempo_minutos: Math.max(1, Number(i.tempo_minutos) || 5),
          responsavel: "",
          foto_antes: "",
          foto_final: "",
        };
      });

    return NextResponse.json({
      titulo: String(resultObj.titulo || "").trim() || `Checklist de ${deptLabel}`,
      itens,
    });
  } catch (error) {
    console.error("[IA Checklist] Catch:", error);
    return NextResponse.json({ error: "Não foi possível processar o checklist com IA." }, { status: 500 });
  }
}
