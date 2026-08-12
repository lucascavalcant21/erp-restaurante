import { supabase, isSupabaseReady } from "./supabase";

export const PORTAL_VAGAS_PADRAO = {
  titulo: "Trabalhe Conosco",
  subtitulo: "Estamos em busca de talentos apaixonados para integrar nossa equipe. Preencha seus dados e faça o teste de perfil.",
  mensagem_sucesso: "Seu perfil foi recebido com sucesso. Nossa equipe de RH irá analisar seus dados e entraremos em contato pelo WhatsApp se houver compatibilidade com a vaga.",
  vagas: [
    { id: "garcom", cargo: "Garçom", quantidade: 2, salario: "R$ 1.800,00", alimentacao: "R$ 400,00", taxa: "Sim (Variável)", jornada: "6x1 - 16h às 00h", ativa: true },
    { id: "cozinheiro", cargo: "Cozinheiro", quantidade: 1, salario: "R$ 2.500,00", alimentacao: "R$ 400,00", taxa: "Sim (Variável)", jornada: "6x1 - 15h às 23h", ativa: true },
    { id: "limpeza", cargo: "Auxiliar de Limpeza", quantidade: 1, salario: "R$ 1.600,00", alimentacao: "R$ 400,00", taxa: "Não", jornada: "6x1 - 08h às 16h", ativa: true },
  ],
};

function normalizarPortalVagas(config) {
  const base = config && typeof config === "object" ? config : {};
  const vagas = Array.isArray(base.vagas) ? base.vagas : PORTAL_VAGAS_PADRAO.vagas;
  return {
    ...PORTAL_VAGAS_PADRAO,
    ...base,
    vagas: vagas.map((vaga, index) => ({
      id: vaga.id || `vaga-${index + 1}`,
      cargo: String(vaga.cargo || "").trim(),
      quantidade: Math.max(1, Number(vaga.quantidade) || 1),
      salario: String(vaga.salario || ""),
      alimentacao: String(vaga.alimentacao || ""),
      taxa: String(vaga.taxa || ""),
      jornada: String(vaga.jornada || ""),
      ativa: vaga.ativa !== false,
    })).filter(vaga => vaga.cargo),
  };
}

export async function fetchPortalVagasConfig(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { data: normalizarPortalVagas(null), error: null };
  }
  // Página pública (candidato sem conta): a função devolve só o bloco de vagas,
  // sem expor o restante das configurações da empresa.
  try {
    const { data: viaFuncao, error: erroFuncao } = await supabase
      .rpc("portal_vagas_publico", { p_unidade_id: unidadeId });
    if (!erroFuncao && viaFuncao && Object.keys(viaFuncao).length > 0) {
      return { data: normalizarPortalVagas(viaFuncao), error: null };
    }
  } catch { /* função ainda não criada — cai na leitura direta abaixo */ }

  const { data, error } = await supabase
    .from("config_sistema")
    .select("params")
    .eq("unidade_id", unidadeId)
    .limit(1);
  const config = data?.[0]?.params?.portal_vagas;
  return { data: normalizarPortalVagas(config), error: error?.message };
}

export async function salvarPortalVagasConfig(unidadeId, config) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade específica." };
  const portal_vagas = normalizarPortalVagas(config);

  try {
    const { error } = await supabase.rpc("merge_config_sistema_params", {
      p_unidade_id: unidadeId,
      p_patch: { portal_vagas },
    });
    if (!error) return { data: portal_vagas, error: null };
  } catch { /* usa o fallback abaixo */ }

  const { data: registros, error: fetchError } = await supabase
    .from("config_sistema")
    .select("id, params")
    .eq("unidade_id", unidadeId)
    .limit(1);
  if (fetchError) return { error: fetchError.message };

  const registro = registros?.[0];
  const params = { ...(registro?.params || {}), portal_vagas };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params, updated_at: new Date().toISOString() }).eq("id", registro.id);
    return { data: portal_vagas, error: error?.message };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { data: portal_vagas, error: error?.message };
}

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

  for (const [idPergunta, idOpcaoSelecionada] of Object.entries(respostas)) {
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
    respostas_comportamentais: {
      ...respostas,
      _dados_pessoais: dadosPessoais.detalhesCadastro || null,
      _versao_formulario: 2,
    },
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
