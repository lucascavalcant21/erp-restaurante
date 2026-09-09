import { NextResponse } from "next/server";

// Monta ou converte um checklist completo a partir de texto (instruções, cópia/cola)
// e/ou imagem (foto de quadro, documento ou papel anotado), dividindo as tarefas em:
// - Abertura (Início do turno)
// - Durante o turno
// - Fechamento (Fim do turno)
export async function POST(request) {
  try {
    const { departamento, tipo, contexto, imagem, unidade_nome } = await request.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Chave da IA não configurada no servidor." }, { status: 500 });
    }

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

    const userMessageContent = [];

    // Se veio imagem (Base64 pura ou Data URL)
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
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Pure,
        },
      });
    }

    userMessageContent.push({ type: "text", text: promptText });

    const modelosParaTestar = ["claude-opus-4-8", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"];
    let response = null;
    let errorDetail = "";

    for (const modelName of modelosParaTestar) {
      try {
        response = await fetch("https://api.anthropic.com/v1/messages", {
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

        if (response.ok) {
          break;
        }

        errorDetail = await response.text();
        console.error(`[IA Checklist] Erro API Anthropic com modelo (${modelName}):`, errorDetail);
      } catch (err) {
        errorDetail = err?.message || String(err);
        console.error(`[IA Checklist] Exceção com modelo (${modelName}):`, errorDetail);
      }
    }

    if (!response || !response.ok) {
      console.error("[IA Checklist] Todos os modelos falharam. Detalhe do último erro:", errorDetail);
      return NextResponse.json({ error: "Erro ao comunicar com a IA." }, { status: 500 });
    }

    const data = await response.json();
    let rawText = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let obj;
    try {
      obj = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      obj = match ? JSON.parse(match[0]) : null;
    }

    if (!obj?.itens || !Array.isArray(obj.itens) || obj.itens.length === 0) {
      return NextResponse.json({ error: "Não foi possível extrair o checklist da imagem/texto enviado." }, { status: 422 });
    }

    const fasesValidas = new Set(["abertura", "durante_turno", "fechamento"]);

    const itens = obj.itens
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
      titulo: String(obj.titulo || "").trim() || `Checklist de ${deptLabel}`,
      itens,
    });
  } catch (error) {
    console.error("[IA Checklist] Catch:", error);
    return NextResponse.json({ error: "Não foi possível processar o checklist com IA." }, { status: 500 });
  }
}
