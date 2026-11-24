// Leitura dos prints do cardápio de um concorrente (Jhon, pedido do dono 16/11/2026).
//
// Recebe até 6 imagens (os prints do app, já reduzidos no celular) e devolve
// o que está ESCRITO: nome do estabelecimento, plataforma, taxa, mínimo,
// tempo, nota e cada item (prato, combo, adicional, bebida, sobremesa) com o
// preço mostrado. Nada é gravado aqui: o Jhon mostra a prévia e o dono
// confirma. Os números são limpos de novo em cardapioDoOcr (lib/marmitaria/concorrentes.mjs).
//
// Mesma proteção do /api/ocr: só com sessão (sessaoOuNegar); a chave da IA
// fica no servidor (OPENAI_API_KEY), nunca vai ao navegador.

import { NextResponse } from "next/server";
import { sessaoOuNegar } from "../../../lib/server/sessao-rota.mjs";

export const maxDuration = 60;

const MAX_PRINTS = 6;
const MAX_CHARS_PRINT = 3_000_000; // ~2,2 MB de imagem em base64 (o celular manda ~300 KB)
const MAX_CHARS_TOTAL = 4_200_000; // abaixo do limite de corpo da Vercel (4,5 MB)
const IMAGEM = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const SISTEMA = [
  "Você lê prints de cardápio de delivery (iFood, 99Food, Keeta, Rappi, WhatsApp, site) e copia o que está ESCRITO.",
  "REGRAS:",
  "1. Nunca invente nada. Campo que não aparece na imagem fica vazio (\"\"). Preço só se estiver escrito ao lado do item.",
  "2. 'preco' é o preço que o cliente paga hoje (o destacado). 'preco_original' é o riscado, se houver.",
  "   Item com 'a partir de R$ 40,00' e 'R$ 28,00 com cupom': preco = 28,00 (com cupom) e preco_original = 40,00.",
  "3. Adicionais/complementos ('Turbine', 'Adicionais', 'Escolha', '+ R$ 3,00') viram itens com tipo 'adicional' e 'grupo' = título do grupo.",
  "4. 'componentes': o que vem no prato, copiado da descrição (ex.: arroz, feijão, frango grelhado). Não acrescente nada que não esteja escrito.",
  "5. 'peso': só se estiver escrito (ex.: '500g', '1 kg'). 'serve_pessoas' só se estiver escrito.",
  "6. tipo: 'prato' (refeição/marmita/lanche), 'combo', 'adicional', 'bebida', 'sobremesa' ou 'outro'.",
  "7. Se a imagem não for cardápio, devolva a lista de itens vazia.",
  "8. O mesmo item em dois prints entra uma vez só.",
].join("\n");

const texto = { type: "string" };
const SCHEMA = {
  type: "object",
  properties: {
    estabelecimento: { type: "string", description: "Nome do restaurante como aparece. Vazio se não aparecer." },
    plataforma: { type: "string", description: "iFood, 99Food, Keeta, Rappi, aiqfome, WhatsApp, site ou vazio." },
    taxa_entrega: { type: "string", description: "Taxa de entrega, ex.: '6,99'. 'Grátis' vira '0'. Vazio se não aparecer." },
    pedido_minimo: { type: "string", description: "Pedido mínimo, ex.: '20,00'. Vazio se não aparecer." },
    tempo_entrega: { type: "string", description: "Ex.: '40-50 min'. Vazio se não aparecer." },
    avaliacao: { type: "string", description: "Nota de 0 a 5, ex.: '4,7'. Vazio se não aparecer." },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["prato", "combo", "adicional", "bebida", "sobremesa", "outro"] },
          categoria: { ...texto, description: "Seção do cardápio (ex.: 'Marmitas'). Vazio se não houver." },
          grupo: { ...texto, description: "Para adicional: título do grupo (ex.: 'Turbine sua marmita'). Vazio nos outros." },
          nome: texto,
          descricao: { ...texto, description: "Descrição escrita abaixo do nome. Vazio se não houver." },
          componentes: { type: "array", items: texto, description: "O que vem no prato, copiado da descrição." },
          peso: { ...texto, description: "Peso escrito, ex.: '500g'. Vazio se não houver." },
          serve_pessoas: { ...texto, description: "Quantas pessoas serve, se escrito. Vazio se não houver." },
          preco: { ...texto, description: "Preço pago hoje, ex.: '24,90'." },
          preco_original: { ...texto, description: "Preço riscado, se houver. Vazio se não houver." },
        },
        required: ["tipo", "categoria", "grupo", "nome", "descricao", "componentes", "peso", "serve_pessoas", "preco", "preco_original"],
        additionalProperties: false,
      },
    },
  },
  required: ["estabelecimento", "plataforma", "taxa_entrega", "pedido_minimo", "tempo_entrega", "avaliacao", "itens"],
  additionalProperties: false,
};

export async function POST(request) {
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;

  let corpo;
  try { corpo = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const imagens = Array.isArray(corpo?.imagens) ? corpo.imagens : [];
  if (!imagens.length || imagens.length > MAX_PRINTS) {
    return NextResponse.json({ error: `Mande de 1 a ${MAX_PRINTS} prints do cardápio.` }, { status: 400 });
  }
  if (imagens.some((i) => typeof i !== "string" || i.length > MAX_CHARS_PRINT || !IMAGEM.test(i))) {
    return NextResponse.json({ error: "Algum print não é uma imagem válida ou é grande demais." }, { status: 400 });
  }
  if (imagens.reduce((t, i) => t + i.length, 0) > MAX_CHARS_TOTAL) {
    return NextResponse.json({ error: "Os prints juntos ficaram grandes demais. Mande menos de cada vez." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Leitura de imagem não configurada neste ambiente." }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SISTEMA },
          {
            role: "user",
            content: [
              { type: "text", text: `Leia ${imagens.length === 1 ? "este print" : `estes ${imagens.length} prints (são partes do mesmo cardápio)`} e extraia o cardápio.` },
              ...imagens.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } })),
            ],
          },
        ],
        max_tokens: 6000,
        response_format: { type: "json_schema", json_schema: { name: "cardapio_concorrente", strict: true, schema: SCHEMA } },
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const lido = JSON.parse(data.choices[0].message.content);
    // peso escrito ("500g") vai para o mesmo campo que a limpeza entende
    lido.itens = (lido.itens || []).map(({ peso, ...i }) => ({ ...i, peso_g: peso || "" }));
    return NextResponse.json(lido);
  } catch (error) {
    console.error("Erro na leitura do cardápio:", error?.message);
    return NextResponse.json({ error: "Não consegui ler os prints agora." }, { status: 500 });
  }
}
