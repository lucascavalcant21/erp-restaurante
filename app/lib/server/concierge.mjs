// HÉFISTO CONCIERGE — Garçom Virtual e Inteligência Gastronômica
// Suporta navegação guiada por botões e conversa inteligente opcional (PT, EN, ES)

import { numeroSeguro, centavos } from "./experience.mjs";

const TEXTOS_BOAS_VINDAS = {
  pt: {
    saudacao: "Bem-vindo ao",
    subtitulo: "Sou o seu Concierge Gastronômico. O que você gostaria de explorar hoje?",
    botoes: [
      { id: "sugestoes", rotulo: "✨ Sugestões da Casa", icone: "sparkles" },
      { id: "peixes", rotulo: "🐟 Peixes Amazônicos", icone: "fish" },
      { id: "carnes", rotulo: "🥩 Carnes Nobres", icone: "meat" },
      { id: "drinks", rotulo: "🍸 Drinks & Coquetéis", icone: "drink" },
      { id: "compartilhar", rotulo: "👥 Para Compartilhar", icone: "users" },
      { id: "sem_alcool", rotulo: "🍃 Opções Sem Álcool", icone: "leaf" }
    ],
    perguntasFrequentes: [
      "Quais pratos não têm glúten ou lactose?",
      "Qual drink harmoniza com peixe?",
      "Sugira um jantar para duas pessoas até R$ 200"
    ]
  },
  en: {
    saudacao: "Welcome to",
    subtitulo: "I am your Gastronomic Concierge. What would you like to explore today?",
    botoes: [
      { id: "sugestoes", rotulo: "✨ House Specials", icone: "sparkles" },
      { id: "peixes", rotulo: "🐟 Amazonian Fish", icone: "fish" },
      { id: "carnes", rotulo: "🥩 Prime Steaks", icone: "meat" },
      { id: "drinks", rotulo: "🍸 Cocktails & Drinks", icone: "drink" },
      { id: "compartilhar", rotulo: "👥 To Share", icone: "users" },
      { id: "sem_alcool", rotulo: "🍃 Non-Alcoholic", icone: "leaf" }
    ],
    perguntasFrequentes: [
      "Which dishes are gluten-free or dairy-free?",
      "Which cocktail pairs well with fish?",
      "Suggest a dinner for two under R$ 200"
    ]
  },
  es: {
    saudacao: "Bienvenido a",
    subtitulo: "Soy su Concierge Gastronómico. ¿Qué le gustaría explorar hoy?",
    botoes: [
      { id: "sugestoes", rotulo: "✨ Sugerencias de la Casa", icone: "sparkles" },
      { id: "peixes", rotulo: "🐟 Pescados Amazónicos", icone: "fish" },
      { id: "carnes", rotulo: "🥩 Carnes Nobles", icone: "meat" },
      { id: "drinks", rotulo: "🍸 Cócteles & Bebidas", icone: "drink" },
      { id: "compartilhar", rotulo: "👥 Para Compartir", icone: "users" },
      { id: "sem_alcool", rotulo: "🍃 Sin Alcohol", icone: "leaf" }
    ],
    perguntasFrequentes: [
      "¿Cuáles platos no tienen gluten o lactosa?",
      "¿Qué cóctel marida bien con pescado?",
      "Sugiera una cena para dos hasta R$ 200"
    ]
  }
};

const SUB_OPCOES_DRINKS = {
  pt: [
    { id: "doce", rotulo: "🍓 Frutado & Doce" },
    { id: "citrico", rotulo: "🍋 Cítrico & Marcante" },
    { id: "refrescante", rotulo: "🌿 Refrescante & Leve" },
    { id: "intenso", rotulo: "🥃 Intenso & Seco" },
    { id: "sem_alcool", rotulo: "🍹 Mocktail (Sem Álcool)" },
    { id: "surpreenda", rotulo: "✨ Surpreenda-me" }
  ],
  en: [
    { id: "doce", rotulo: "🍓 Fruity & Sweet" },
    { id: "citrico", rotulo: "🍋 Citrus & Crisp" },
    { id: "refrescante", rotulo: "🌿 Refreshing & Light" },
    { id: "intenso", rotulo: "🥃 Bold & Spirit-Forward" },
    { id: "sem_alcool", rotulo: "🍹 Mocktail (Zero Proof)" },
    { id: "surpreenda", rotulo: "✨ Surprise Me" }
  ],
  es: [
    { id: "doce", rotulo: "🍓 Frutal & Dulce" },
    { id: "citrico", rotulo: "🍋 Cítrico & Fresco" },
    { id: "refrescante", rotulo: "🌿 Refrescante & Ligero" },
    { id: "intenso", rotulo: "🥃 Intenso & Fuerte" },
    { id: "sem_alcool", rotulo: "🍹 Mocktail (Sin Alcohol)" },
    { id: "surpreenda", rotulo: "✨ Sorpréndeme" }
  ]
};

/**
 * Retorna as opções iniciais e estrutura de boas-vindas do Concierge.
 */
export function obterBoasVindasConcierge({ unidadeNome = "Seldeestrela", idioma = "pt" }) {
  const lang = ["pt", "en", "es"].includes(idioma) ? idioma : "pt";
  const base = TEXTOS_BOAS_VINDAS[lang];

  return {
    ok: true,
    idioma: lang,
    titulo: `${base.saudacao} ${unidadeNome}!`,
    subtitulo: base.subtitulo,
    botoes: base.botoes,
    perguntasFrequentes: base.perguntasFrequentes
  };
}

/**
 * Processa uma ação rápida de botão (Navegação guiada).
 */
export function processarAcaoConcierge({ acao, subOpcao = null, produtos = [], idioma = "pt" }) {
  const lang = ["pt", "en", "es"].includes(idioma) ? idioma : "pt";
  const prods = Array.isArray(produtos) ? produtos : [];

  let produtosFiltrados = [];
  let mensagem = "";
  let subBotoes = null;

  switch (acao) {
    case "drinks":
      if (!subOpcao) {
        mensagem = lang === "en" ? "Which cocktail style do you prefer?" : lang === "es" ? "¿Qué estilo de trago prefiere?" : "Qual estilo de drink você prefere?";
        subBotoes = SUB_OPCOES_DRINKS[lang];
        produtosFiltrados = prods.filter(p => p.departamento === "bar" || p.categoria?.toLowerCase().includes("drink"));
      } else {
        produtosFiltrados = filtrarDrinksPorEstilo(prods, subOpcao);
        mensagem = lang === "en" ? "Here are our cocktail recommendations:" : lang === "es" ? "Aquí tiene nuestras recomendaciones de bebidas:" : "Aqui estão as nossas recomendações especiais de drinks:";
      }
      break;

    case "peixes":
      produtosFiltrados = prods.filter(p => {
        const txt = `${p.nome_produto} ${p.categoria || ""} ${p.descricao || ""}`.toLowerCase();
        return txt.includes("peixe") || txt.includes("pirarucu") || txt.includes("tambaqui") || txt.includes("salm") || txt.includes("moqueca") || txt.includes("pescado");
      });
      if (produtosFiltrados.length === 0) {
        produtosFiltrados = prods.filter(p => p.categoria?.toLowerCase().includes("principal"));
      }
      mensagem = lang === "en" ? "Explore our finest Amazonian and fresh fish dishes:" : lang === "es" ? "Descubra nuestros mejores pescados amazónicos y frescos:" : "Descubra nossos destaques em peixes amazônicos e preparações exclusivas:";
      break;

    case "carnes":
      produtosFiltrados = prods.filter(p => {
        const txt = `${p.nome_produto} ${p.categoria || ""} ${p.descricao || ""}`.toLowerCase();
        return txt.includes("carne") || txt.includes("picanha") || txt.includes("ancho") || txt.includes("mignon") || txt.includes("costela") || txt.includes("bife");
      });
      mensagem = lang === "en" ? "Our prime cuts, grilled to your preference:" : lang === "es" ? "Nuestros cortes nobles preparados al punto de su preferencia:" : "Nossos cortes nobres preparados no ponto exato da sua preferência:";
      break;

    case "compartilhar":
      produtosFiltrados = prods.filter(p => {
        const txt = `${p.nome_produto} ${p.categoria || ""} ${p.descricao || ""}`.toLowerCase();
        return txt.includes("compartilh") || txt.includes("2 pessoas") || txt.includes("duas") || txt.includes("petisco") || txt.includes("tábua") || txt.includes("moqueca");
      });
      if (produtosFiltrados.length === 0) {
        produtosFiltrados = prods.slice(0, 4);
      }
      mensagem = lang === "en" ? "Generous dishes and platters perfect for sharing at the table:" : lang === "es" ? "Platos generosos ideales para compartir en la mesa:" : "Pratos generosos e porções perfeitas para compartilhar na mesa:";
      break;

    case "sem_alcool":
      produtosFiltrados = prods.filter(p => {
        const txt = `${p.nome_produto} ${p.categoria || ""} ${p.descricao || ""}`.toLowerCase();
        return txt.includes("suco") || txt.includes("sem álcool") || txt.includes("mocktail") || txt.includes("refrigerante") || txt.includes("água") || txt.includes("cha");
      });
      mensagem = lang === "en" ? "Refreshing non-alcoholic beverages and specialty mocktails:" : lang === "es" ? "Bebidas sin alcohol y mocktails refrescantes:" : "Bebidas refrescantes, sucos naturais e mocktails autorais sem álcool:";
      break;

    case "sugestoes":
    default:
      produtosFiltrados = prods.filter(p => p.destaque_experience || p.destaque);
      if (produtosFiltrados.length === 0) {
        produtosFiltrados = prods.slice(0, 4);
      }
      mensagem = lang === "en" ? "Here are our Chef's signature selections for you today:" : lang === "es" ? "Aquí tiene las selecciones especiales de nuestro Chef:" : "Aqui estão as criações mais aclamadas e sugestões do nosso Chef para hoje:";
      break;
  }

  return {
    ok: true,
    mensagem,
    subBotoes,
    produtos: produtosFiltrados.slice(0, 6).map(p => ({
      id: p.id,
      nome_produto: p.nome_produto,
      categoria: p.categoria,
      preco_venda: numeroSeguro(p.preco_venda),
      imagem_url: p.imagem_url,
      descricao: p.descricao,
      harmonizacao: p.harmonizacao,
      tempo_preparo_base: p.tempo_preparo_base || 15,
      departamento: p.departamento
    }))
  };
}

function filtrarDrinksPorEstilo(produtos, estilo) {
  const drinks = produtos.filter(p => p.departamento === "bar" || p.categoria?.toLowerCase().includes("drink") || p.categoria?.toLowerCase().includes("bebida"));
  if (drinks.length === 0) return produtos.slice(0, 3);

  const est = String(estilo).toLowerCase();
  const combinados = drinks.filter(d => {
    const txt = `${d.nome_produto} ${d.descricao || ""}`.toLowerCase();
    if (est === "doce") return txt.includes("morango") || txt.includes("fruta") || txt.includes("doce") || txt.includes("mel") || txt.includes("licor");
    if (est === "citrico") return txt.includes("lim") || txt.includes("maracuj") || txt.includes("citric") || txt.includes("tangerina") || txt.includes("caju");
    if (est === "refrescante") return txt.includes("hortel") || txt.includes("gin") || txt.includes("tônica") || txt.includes("gelo") || txt.includes("menta");
    if (est === "intenso") return txt.includes("whisky") || txt.includes("bourbon") || txt.includes("negroni") || txt.includes("amargo") || txt.includes("cachaça");
    if (est === "sem_alcool") return txt.includes("sem álcool") || txt.includes("suco") || txt.includes("virgem") || txt.includes("mocktail");
    return true; // surpreenda
  });

  return combinados.length > 0 ? combinados : drinks.slice(0, 4);
}

/**
 * Atende perguntas livres do cliente sobre o cardápio e harmonizações.
 * Usa inteligência contextual estrita com os dados reais dos produtos do restaurante.
 */
export async function responderPerguntaConcierge({
  pergunta,
  produtos = [],
  unidadeNome = "Seldeestrela",
  idioma = "pt"
}) {
  const lang = ["pt", "en", "es"].includes(idioma) ? idioma : "pt";
  const perg = String(pergunta || "").trim();
  if (!perg) {
    return {
      ok: false,
      resposta: lang === "en" ? "Please enter a question." : lang === "es" ? "Por favor ingrese su consulta." : "Por favor, digite sua dúvida ou preferência."
    };
  }

  // Se a chave Anthropic estiver configurada no ambiente, podemos consultar o modelo com catálogo real
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && process.env.HEFISTO_IA_DESLIGADA !== "1") {
    try {
      const respostaIA = await chamarModeloAnthropic({
        apiKey,
        pergunta: perg,
        produtos,
        unidadeNome,
        idioma: lang
      });
      if (respostaIA?.resposta) {
        return {
          ok: true,
          origem: "ai_anthropic",
          resposta: respostaIA.resposta,
          produtosRecomendados: respostaIA.produtosRecomendados || []
        };
      }
    } catch {
      // Falha graciosa para o motor determinístico inteligente
    }
  }

  // Motor Gastronômico Semântico Determinístico (Sem dependência de rede externa)
  return responderSemanticamente({ pergunta: perg, produtos, unidadeNome, idioma: lang });
}

function responderSemanticamente({ pergunta, produtos, unidadeNome, idioma }) {
  const pLower = pergunta.toLowerCase();
  let recomendados = [];
  let texto = "";

  // 1. Dúvidas sobre Alergênicos / Lactose / Glúten
  if (pLower.includes("lactose") || pLower.includes("leite") || pLower.includes("glúten") || pLower.includes("gluten") || pLower.includes("alerg")) {
    recomendados = produtos.filter(p => {
      const txt = `${p.nome_produto} ${p.descricao || ""} ${p.alergenicos || ""}`.toLowerCase();
      return !txt.includes("leite") && !txt.includes("queijo") && !txt.includes("lactose") && (p.departamento === "cozinha" || p.categoria?.toLowerCase().includes("prato"));
    }).slice(0, 3);

    if (idioma === "en") {
      texto = `At ${unidadeNome}, we prioritize your safety. Our fish and meat dishes are prepared fresh. Please inform our staff of any severe allergies. Here are great options naturally prepared without dairy:`;
    } else if (idioma === "es") {
      texto = `En ${unidadeNome} cuidamos su bienestar. La mayoría de nuestros pescados y carnes se preparan frescos. Por favor notifique a nuestro equipo ante alergias severas. Aquí tiene excelentes opciones sin lácteos:`;
    } else {
      texto = `No ${unidadeNome}, cuidamos de cada detalhe com rigor. Nossos peixes e cortes nobres são preparados com ingredientes frescos. Caso possua alergias severas, por favor avise também o garçom. Aqui estão ótimas opções sem derivados de leite:`;
    }
  }
  // 2. Harmonização de Bebidas com Pratos
  else if (pLower.includes("harmoniz") || pLower.includes("combina") || pLower.includes("beber") || pLower.includes("drink")) {
    const drinks = produtos.filter(p => p.departamento === "bar").slice(0, 3);
    recomendados = drinks;

    if (idioma === "en") {
      texto = `For fresh fish or seafood dishes (such as Moqueca or Pirarucu), we recommend refreshing citrus cocktails, cachaça infusions or chilled white wine. Here are top pairings from our bar:`;
    } else if (idioma === "es") {
      texto = `Para platos de pescado y frutos de mar (como Moqueca o Pirarucú), recomendamos tragos cítricos, caipirinhas artesanales o vino blanco bien fresco. Aquí tiene excelentes maridajes de nuestro bar:`;
    } else {
      texto = `Para preparações com peixes amazônicos ou moqueca, recomendamos drinks cítricos e refrescantes (com limão, maracujá ou caju) que equilibram a riqueza dos sabores. Veja as harmonizações do nosso bar:`;
    }
  }
  // 3. Orçamento / Preço ("até R$ 200", "gastar", etc.)
  else if (pLower.includes("200") || pLower.includes("150") || pLower.includes("gastar") || pLower.includes("jantar para") || pLower.includes("duas pessoas")) {
    const pratosPrincipais = produtos.filter(p => p.departamento === "cozinha" && numeroSeguro(p.preco_venda) > 0);
    const acessiveis = pratosPrincipais.filter(p => numeroSeguro(p.preco_venda) <= 90).slice(0, 3);
    recomendados = acessiveis;

    if (idioma === "en") {
      texto = `For a complete experience for two within your budget, we suggest starting with our sharing options followed by signature dishes. Here are recommendations:`;
    } else if (idioma === "es") {
      texto = `Para una experiencia completa para dos dentro de su presupuesto, sugerimos nuestros platos generosos. Aquí tiene excelentes opciones:`;
    } else {
      texto = `Para uma excelente refeição para duas pessoas mantendo uma ótima relação custo-benefício, sugerimos combinar pratos que valorizam os ingredientes da casa. Confira essas opções:`;
    }
  }
  // 4. Peixes / Sugestões Gerais
  else {
    const destacados = produtos.filter(p => p.destaque_experience || p.destaque).slice(0, 3);
    recomendados = destacados.length > 0 ? destacados : produtos.slice(0, 3);

    if (idioma === "en") {
      texto = `Here are signature highlights from ${unidadeNome}'s menu crafted by our culinary team:`;
    } else if (idioma === "es") {
      texto = `Aquí tiene algunos de los platos más aclamados de la carta de ${unidadeNome}:`;
    } else {
      texto = `Com base na tradição gastronômica do ${unidadeNome}, selecionamos pratos e bebidas preparados com técnicas autênticas e os melhores insumos:`;
    }
  }

  return {
    ok: true,
    origem: "semantic_engine",
    resposta: texto,
    produtosRecomendados: recomendados.map(p => ({
      id: p.id,
      nome_produto: p.nome_produto,
      categoria: p.categoria,
      preco_venda: numeroSeguro(p.preco_venda),
      imagem_url: p.imagem_url,
      descricao: p.descricao,
      tempo_preparo_base: p.tempo_preparo_base || 15,
      departamento: p.departamento
    }))
  };
}

async function chamarModeloAnthropic({ apiKey, pergunta, produtos, unidadeNome, idioma }) {
  const catalogoResumido = produtos.slice(0, 30).map(p => 
    `- [ID: ${p.id}] ${p.nome_produto} (${p.categoria || 'Geral'}): R$ ${numeroSeguro(p.preco_venda).toFixed(2)}. ${p.descricao || ''} ${p.harmonizacao ? 'Harmonização: ' + p.harmonizacao : ''}`
  ).join("\n");

  const promptSistema = `Você é o Concierge Gastronômico do restaurante ${unidadeNome} no Héfisto Experience.
Seu objetivo é orientar o cliente na mesa com sofisticação, simpatia e clareza.
IDIOMA DA RESPOSTA: ${idioma === 'en' ? 'Inglês' : idioma === 'es' ? 'Espanhol' : 'Português'}.
REGRAS FUNDAMENTAIS:
1. Responda em no máximo 3 frases concisas e acolhedoras.
2. Use SOMENTE os produtos reais abaixo. NUNCA invente preços ou pratos que não estejam listados.
3. Se o cliente perguntar de alérgenos ou lactose, seja transparente.
4. Ao final, liste os IDs dos produtos recomendados no formato exato: [RECOMENDADOS: id1, id2].

CARDÁPIO REAL DO RESTAURANTE:
${catalogoResumido}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.HEFISTO_IA_MODELO || "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      temperature: 0.3,
      system: promptSistema,
      messages: [{ role: "user", content: pergunta }]
    })
  });

  if (!res.ok) return null;
  const json = await res.json();
  const rawText = json?.content?.[0]?.text || "";

  const matchIds = rawText.match(/\[RECOMENDADOS:\s*([^\]]+)\]/i);
  let idsRecomendados = [];
  if (matchIds?.[1]) {
    idsRecomendados = matchIds[1].split(",").map(s => s.trim());
  }

  const respostaLimpa = rawText.replace(/\[RECOMENDADOS:\s*[^\]]+\]/i, "").trim();
  const prods = produtos.filter(p => idsRecomendados.includes(String(p.id)));

  return {
    resposta: respostaLimpa,
    produtosRecomendados: prods.map(p => ({
      id: p.id,
      nome_produto: p.nome_produto,
      categoria: p.categoria,
      preco_venda: numeroSeguro(p.preco_venda),
      imagem_url: p.imagem_url,
      descricao: p.descricao,
      tempo_preparo_base: p.tempo_preparo_base || 15,
      departamento: p.departamento
    }))
  };
}
