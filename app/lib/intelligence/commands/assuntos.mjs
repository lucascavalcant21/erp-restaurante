// Mensagem curta que é só um assunto ("Marmita", "plataformas", "custos") —
// dono, 17/11/2026: "ele demora muito para pensar, quero mais instantâneo" e
// "nunca deixa sem resposta". Sem ir à IA nem varrer os dados: responde na
// hora com o que dá para fazer naquele assunto, em botões. Palavra com uma
// letra errada também vale ("marmta", "funcionaros").
import { palavras, palavraMaisParecida } from "./interpretador-regras.mjs";

export const ASSUNTOS = Object.freeze([
  {
    chaves: ["marmita", "marmitas", "quentinha", "quentinhas", "delivery", "marmitaria"],
    texto: "Sobre as marmitas e o delivery, o que vamos fazer?",
    sugestoes: ["Vamos montar umas marmitas", "Como são nossas marmitas?", "Qual app dá mais lucro?", "Vamos organizar a nossa tela", "Vamos montar o delivery"],
  },
  {
    chaves: ["plataforma", "plataformas", "app", "apps", "aplicativo", "aplicativos", "ifood", "keeta", "99food", "rappi"],
    texto: "Sobre as plataformas, o que vamos fazer?",
    sugestoes: ["Vamos cadastrar as plataformas", "Qual app dá mais lucro?", "Vamos organizar a nossa tela"],
  },
  {
    chaves: ["custo", "custos", "conta", "contas", "despesa", "despesas", "gasto", "gastos"],
    texto: "Sobre os custos, o que vamos fazer?",
    sugestoes: ["Vamos cadastrar os custos fixos", "Quanto comprei esta semana?", "Como foi minha empresa hoje?"],
  },
  {
    chaves: ["funcionario", "funcionarios", "funcionaria", "funcionarias", "equipe", "colaborador", "colaboradores"],
    texto: "Sobre a equipe, o que vamos fazer?",
    sugestoes: ["Vamos cadastrar funcionários", "Meus funcionários chegaram no horário?"],
  },
  {
    chaves: ["vitrine", "tela", "cardapio", "organizador"],
    texto: "Sobre a vitrine dos apps, o que vamos fazer?",
    sugestoes: ["Vamos organizar a nossa tela", "Vou te mandar o cardápio de um concorrente"],
  },
  {
    chaves: ["concorrente", "concorrentes", "concorrencia"],
    texto: "Sobre os concorrentes, o que vamos fazer?",
    sugestoes: ["Vou te mandar o cardápio de um concorrente", "Compare os concorrentes com as nossas marmitas"],
  },
  {
    chaves: ["estoque", "estoques"],
    texto: "Sobre o estoque, o que você quer ver?",
    sugestoes: ["O que está acabando no estoque?", "Quanto tenho no estoque de óleo?", "O que vence esta semana?"],
  },
  {
    chaves: ["venda", "vendas", "faturamento"],
    texto: "Sobre as vendas, o que você quer ver?",
    sugestoes: ["Quanto vendi hoje?", "Quanto vendi esta semana?", "Como foi minha empresa hoje?"],
  },
  {
    chaves: ["compra", "compras"],
    texto: "Sobre as compras, o que vamos fazer?",
    sugestoes: ["Quanto comprei esta semana?", "Minha lista de compras para hoje", "Qual produto teve maior aumento de preço?"],
  },
]);

const RUIDO = new Set(["jhon", "john", "nico", "o", "a", "os", "as", "e", "de", "do", "da", "dos", "das", "meu", "minha", "meus", "minhas", "nosso", "nossa", "nossos", "nossas", "sobre", "ai", "ok", "e", "agora"]);

/** "Marmita", "Jhon, plataformas", "custos?" → { texto, sugestoes } ; frase de verdade → null. */
export function menuDoAssunto(texto) {
  const ps = palavras(texto).filter((w) => !RUIDO.has(w));
  if (!ps.length || ps.length > 2) return null;
  for (const w of ps) {
    const alvo = ASSUNTOS.find((a) => a.chaves.includes(w)) || ASSUNTOS.find((a) => a.chaves.includes(palavraMaisParecida(w) || ""));
    if (alvo) return { texto: alvo.texto, sugestoes: [...alvo.sugestoes] };
  }
  return null;
}
