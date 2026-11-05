import { NextResponse } from "next/server";
import { sessaoOuNegar } from "../../../lib/server/sessao-rota.mjs";
import { motorDeLucro } from "../../../lib/server/motor-lucro.mjs";

// Motor de Lucro: só com login. Recebe números do Cardápio, não lê o banco e
// não grava nada, então não há dado de outra empresa envolvido.
export async function POST(request) {
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;
  try {
    const entrada = await request.json();
    const lista = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
    const recomendacoes = motorDeLucro({ metaPct: entrada?.metaPct ?? null, itens: lista(entrada?.itens, 300), combos: lista(entrada?.combos, 100), promocoes: lista(entrada?.promocoes, 100), mudancas: lista(entrada?.mudancas, 100) });
    return NextResponse.json({ recomendacoes });
  } catch {
    return NextResponse.json({ error: "Não foi possível calcular as recomendações." }, { status: 400 });
  }
}
