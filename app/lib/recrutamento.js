import { supabase, isSupabaseReady } from "./supabase";

// ─── ALGORITMO DE AVALIAÇÃO (MOTOR "IA" DO RH) ──────────────────────────────

export const PERGUNTAS_RECRUTAMENTO = [
  {
    id: "q1",
    pergunta: "Como você lida com um cliente irritado reclamando de um atraso?",
    opcoes: [
      { texto: "Mantenho a calma, peço desculpas e busco uma solução com a gerência.", pontos: 10, tag: "Boa Inteligência Emocional" },
      { texto: "Tento me defender e explicar que a culpa não foi minha.", pontos: 3, tag: "Postura Defensiva" },
      { texto: "Fico nervoso(a) e peço para outro funcionário assumir.", pontos: 5, tag: "Insegurança sob pressão" }
    ]
  },
  {
    id: "q2",
    pergunta: "Qual a sua disponibilidade para trabalhar aos finais de semana e feriados (dias de pico)?",
    opcoes: [
      { texto: "Total disponibilidade. Compreendo que são os dias mais importantes no setor de restaurantes.", pontos: 10, tag: "Alta Disponibilidade" },
      { texto: "Posso trabalhar na maioria, mas preciso de 1 final de semana livre ao mês.", pontos: 8, tag: "Disponibilidade Moderada" },
      { texto: "Tenho muita dificuldade de trabalhar aos finais de semana e à noite.", pontos: 0, tag: "Baixa Disponibilidade (Risco)" }
    ]
  },
  {
    id: "q3",
    pergunta: "O restaurante lotou de repente e a operação virou um caos. Como você age?",
    opcoes: [
      { texto: "Foco no que é essencial, sigo os processos e tento agilizar meu setor.", pontos: 10, tag: "Foco e Produtividade" },
      { texto: "Peço ajuda imediatamente para não deixar nada atrasar.", pontos: 7, tag: "Bom Trabalho em Equipe" },
      { texto: "Travo, fico ansioso(a) e tenho dificuldade de continuar no mesmo ritmo.", pontos: 0, tag: "Baixa tolerância ao estresse" }
    ]
  },
  {
    id: "q4",
    pergunta: "Em relação ao seu trajeto até o restaurante:",
    opcoes: [
      { texto: "Moro muito perto, levo menos de 20 minutos ou tenho condução própria.", pontos: 10, tag: "Baixo Risco de Atraso" },
      { texto: "Levo entre 30 e 50 minutos (uso 1 ônibus).", pontos: 7, tag: "Trajeto Normal" },
      { texto: "Moro longe. Preciso pegar mais de 1 ônibus e levo mais de 1 hora.", pontos: 3, tag: "Alto Risco de Atraso (Trajeto Longo)" }
    ]
  }
];

function gerarLaudoIA(respostas, temFilhos) {
  let notaTotal = 0;
  const tags = [];

  for (const [idPergunta, idOpcaoSelecionada] = Object.entries(respostas)) {
    const pergunta = PERGUNTAS_RECRUTAMENTO.find(p => p.id === idPergunta);
    if (pergunta) {
      const opcao = pergunta.opcoes[parseInt(idOpcaoSelecionada)];
      if (opcao) {
        notaTotal += opcao.pontos;
        tags.push(opcao.tag);
      }
    }
  }

  const nota_ia = Math.round((notaTotal / 40) * 100);

  let laudo = "";

  if (nota_ia >= 80) {
    laudo += "🟢 **Candidato(a) com Perfil Excelente!**\nDemonstra inteligência emocional, proatividade e entende a dinâmica acelerada de um restaurante.\n";
  } else if (nota_ia >= 50) {
    laudo += "🟡 **Candidato(a) com Perfil Mediano.**\nPode ter algumas limitações com horários ou trabalho sob pressão, mas é uma opção viável dependendo da vaga.\n";
  } else {
    laudo += "🔴 **Candidato(a) com Perfil de Risco.**\nAs respostas indicam baixa aderência ao ritmo frenético do restaurante, problemas com disponibilidade ou distância excessiva.\n";
  }

  laudo += `\n**Traços Identificados:** ${tags.join(', ')}.\n`;

  if (temFilhos === "Sim") {
    laudo += "\n⚠️ **Atenção Gerencial:** O(a) candidato(a) declarou possuir filhos/dependentes. É extremamente recomendado alinhar muito bem durante a entrevista as expectativas sobre pontualidade, rotinas de creche/escola e plano de ação em caso de emergências de saúde das crianças, para evitar dores de cabeça futuras e absenteísmo.";
  }

  return { nota_ia, avaliacao_ia: laudo };
}

// ─── ACESSO AO BANCO DE DADOS ────────────────────────────────────────────────

export async function fetchCandidatos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  const { data, error } = await supabase
    .from("candidatos")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false });

  return { data: data || [], error: error?.message };
}

export async function atualizarStatusCandidato(id, novoStatus) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("candidatos").update({ status: novoStatus }).eq("id", id);
  return { error: error?.message };
}

export async function enviarCandidatura(unidadeId, dadosPessoais, respostas, fileUrl) {
  if (!isSupabaseReady()) return { error: "Offline" };

  // 1. Roda a "Inteligência"
  const { nota_ia, avaliacao_ia } = gerarLaudoIA(respostas, dadosPessoais.temFilhos);

  // 2. Salva no banco
  const payload = {
    unidade_id: unidadeId,
    nome: dadosPessoais.nome,
    cpf: dadosPessoais.cpf,
    telefone: dadosPessoais.telefone,
    endereco: dadosPessoais.endereco,
    cargo_pretendido: dadosPessoais.cargoPretendido,
    tem_filhos: dadosPessoais.temFilhos,
    experiencia: dadosPessoais.experiencia,
    respostas_comportamentais: respostas,
    url_curriculo: fileUrl,
    avaliacao_ia: avaliacao_ia,
    nota_ia: nota_ia,
    status: 'Novo'
  };

  const { data, error } = await supabase.from("candidatos").insert([payload]).select().single();
  
  return { data, error: error?.message };
}

export async function removerCandidato(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("candidatos").delete().eq("id", id);
  return { error: error?.message };
}
