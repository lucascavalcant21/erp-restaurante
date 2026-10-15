// HÉFISTO DISCOVER — Narrativas Culturais, Botânica e Gastronomia Interativa
// Permite aos clientes explorar a história e os ingredientes dos pratos do restaurante.

export const INGREDIENTES_CULTURAIS = {
  pirarucu: {
    ingrediente: "Pirarucu Grelhado",
    nomeCientifico: "Arapaima gigas",
    familia: "Osteoglossidae",
    origemCultural: "Bacia Amazônica — Rios Solimões e Amazonas",
    historia: "Conhecido como o 'gigante das águas doces', o pirarucu pode atingir mais de 2 metros e 100 kg. É um dos maiores peixes de escama de água doce do planeta e sobrevive respirando oxigênio atmosférico.",
    curiosidades: "Graças ao manejo sustentável implementado por comunidades ribeirinhas e indígenas na Amazônia, a espécie foi salva da extinção e hoje é símbolo de gastronomia de alto padrão com conservação florestal.",
    perfilSabor: "Carne branca, nobre, de textura firme e lascas generosas, com sabor delicado que absorve perfeitamente aromas cítricos e defumados.",
    hotspot: { x: 48, y: 52 }
  },
  tambaqui: {
    ingrediente: "Costela de Tambaqui",
    nomeCientifico: "Colossoma macropomum",
    familia: "Serrasalmidae",
    origemCultural: "Rios e Várzeas da Bacia Amazônica",
    historia: "O tambaqui é um peixe frugívoro: na época das cheias, nada pelas matas inundadas alimentando-se de frutos e sementes caídas das copas das árvores florestais.",
    curiosidades: "Essa dieta rica em sementes e castanhas confere à sua carne uma camada única de gordura nobre e marmorizada, tornando suas costelas uma das maiores iguarias do Brasil.",
    perfilSabor: "Suculento, gordura macia e sabor amanteigado pronunciado.",
    hotspot: { x: 45, y: 55 }
  },
  tucupi: {
    ingrediente: "Molho de Tucupi Amarelo",
    nomeCientifico: "Manihot esculenta (extrato)",
    familia: "Euphorbiaceae",
    origemCultural: "Herança Ancestral Indígena Pan-Amazônica",
    historia: "O tucupi é o sumo extraído da raiz da mandioca brava. Para se tornar esse ouro líquido da culinária, passa por fermentação artesanal e cozimento prolongado de horas para neutralizar o ácido cianídrico natural.",
    curiosidades: "Possui uma concentração extraordinária de ácido glutâmico natural, sendo considerado o 'umami da Amazônia', capaz de despertar o paladar e realçar qualquer preparação de pescados ou aves.",
    perfilSabor: "Acidez brilhante, umami profundo e notas terrosas elegantes.",
    hotspot: { x: 32, y: 68 }
  },
  jambu: {
    ingrediente: "Folhas Frescas de Jambu",
    nomeCientifico: "Acmella oleracea",
    familia: "Asteraceae",
    origemCultural: "Norte do Brasil e Região Amazônica",
    historia: "Também chamado de agrião-do-pará, o jambu é consumido há milênios pelos povos originários em cozidos, tacacás e caldos medicinais.",
    curiosidades: "Contém espilantol, um composto bioativo que provoca uma sensação mágica e única de dormência, leve formigamento e intensa salivação nos lábios e na língua.",
    perfilSabor: "Herbáceo, levemente salgado e sensorialmente vibrante.",
    hotspot: { x: 65, y: 38 }
  },
  castanha: {
    ingrediente: "Farofa de Castanha-do-Pará",
    nomeCientifico: "Bertholletia excelsa",
    familia: "Lecythidaceae",
    origemCultural: "Florestas Nativas Não Inundáveis da Amazônia",
    historia: "A castanheira-do-brasil é uma das árvores mais majestosas da Terra, vivendo mais de 500 anos e atingindo até 50 metros de altura. Seus frutos são dispersos na natureza pela cutia.",
    curiosidades: "É rica em selênio natural e antioxidantes. Toda a castanha comercializada provém de árvores nativas em florestas preservadas, promovendo renda direta aos extrativistas.",
    perfilSabor: "Crocância untuosa, aroma de noz fresca e acabamento adocicado.",
    hotspot: { x: 70, y: 65 }
  },
  dende: {
    ingrediente: "Azeite de Dendê da Moqueca",
    nomeCientifico: "Elaeis guineensis",
    familia: "Arecaceae",
    origemCultural: "Tradição Luso-Afro-Indígena Brasileira",
    historia: "Extraído da polpa do fruto da palmeira-de-dendê, o azeite avermelhado é a espinha dorsal de pratos emblemáticos do litoral e das moquecas brasileiras.",
    curiosidades: "Sua cor vermelho-dourada vibrante se deve à abundância de betacaroteno e tocoferóis. Ele confere corpo aromático e aveludado ao caldo.",
    perfilSabor: "Frutado quente, aromático, persistente e aveludado.",
    hotspot: { x: 38, y: 72 }
  },
  carne_nobre: {
    ingrediente: "Corte Nobre Angus Grelhado na Brasa",
    nomeCientifico: "Bos taurus (Aberdeen Angus)",
    familia: "Bovidae",
    origemCultural: "Pampas e Tradição Sul-Americana de Fogo de Chão",
    historia: "A raça Angus é consagrada mundialmente por seu marmoreio uniforme — finas lâminas de gordura intramuscular que derretem suavemente durante a cocção em alta temperatura.",
    curiosidades: "O corte é selado a mais de 250°C para provocar a Reação de Maillard, gerando centenas de novos compostos aromáticos crocantes na superfície sem perder os sucos internos.",
    perfilSabor: "Rico, amanteigado, defumado sutil e extremamente macio.",
    hotspot: { x: 50, y: 50 }
  }
};

/**
 * Monta o dossiê cultural e gastronômico interativo de um prato.
 */
export function gerarExperienciaPrato({ prato = {}, fichaTecnica = null }) {
  const nome = String(prato.nome_produto || "").toLowerCase();
  const desc = String(prato.descricao || "").toLowerCase();
  const textoGeral = `${nome} ${desc}`;

  const componentesIdentificados = [];

  if (textoGeral.includes("pirarucu") || textoGeral.includes("peixe")) {
    componentesIdentificados.push(INGREDIENTES_CULTURAIS.pirarucu);
  }
  if (textoGeral.includes("tambaqui") || textoGeral.includes("costela")) {
    componentesIdentificados.push(INGREDIENTES_CULTURAIS.tambaqui);
  }
  if (textoGeral.includes("tucupi") || textoGeral.includes("amarelo")) {
    componentesIdentificados.push(INGREDIENTES_CULTURAIS.tucupi);
  }
  if (textoGeral.includes("jambu") || textoGeral.includes("tremor")) {
    componentesIdentificados.push(INGREDIENTES_CULTURAIS.jambu);
  }
  if (textoGeral.includes("castanha") || textoGeral.includes("farofa")) {
    componentesIdentificados.push(INGREDIENTES_CULTURAIS.castanha);
  }
  if (textoGeral.includes("moqueca") || textoGeral.includes("dendê") || textoGeral.includes("dende")) {
    componentesIdentificados.push(INGREDIENTES_CULTURAIS.dende);
  }
  if (textoGeral.includes("carne") || textoGeral.includes("ancho") || textoGeral.includes("picanha") || textoGeral.includes("mignon")) {
    componentesIdentificados.push(INGREDIENTES_CULTURAIS.carne_nobre);
  }

  // Fallback se nenhum termo específico bater
  if (componentesIdentificados.length === 0) {
    componentesIdentificados.push({
      ingrediente: prato.nome_produto || "Prato Autoral da Casa",
      nomeCientifico: "Preparação Gastronômica Artesanal",
      origemCultural: "Cozinha Autoral Seldeestrela",
      historia: prato.descricao || "Elaborado pelo nosso time culinário combinando os melhores insumos frescos locais com técnicas de alta gastronomia.",
      curiosidades: "Cada detalhe de tempero e cocção é controlado na cozinha para garantir o equilíbrio perfeito de textura, aroma e apresentação.",
      perfilSabor: "Equilibrado, fresco e marcante.",
      hotspot: { x: 50, y: 50 }
    });
  }

  return {
    ok: true,
    prato: {
      id: prato.id,
      nome_produto: prato.nome_produto,
      categoria: prato.categoria,
      preco_venda: prato.preco_venda,
      imagem_url: prato.imagem_url,
      descricao: prato.descricao,
      harmonizacao: prato.harmonizacao
    },
    componentes: componentesIdentificados,
    totalComponentes: componentesIdentificados.length
  };
}
