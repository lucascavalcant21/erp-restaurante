// PROCEDIMENTOS DA CASA no Assistente (pedido do dono, 08/11/2026): "No salão,
// aconteceu tal coisa, como é que eu resolvo? Como é que eu vou montar essa
// mesa? E o jardim?". Quando a casa cadastrou o jeito dela
// (Inteligência > Procedimentos da casa), a resposta é esse texto, sem modelo
// de linguagem no meio (REAL: foi o que a casa escreveu). Sem cadastro, o
// agente geral dá a orientação padrão (SUGESTÃO) e a resposta oferece
// "Cadastrar o jeito da casa".
//
// Só leitura, pelo banco escopado da unidade (op_processos → seções → itens).

import { CATEGORIA, MODELOS, montarProcedimentos, procedimentoParaTexto } from "../../procedimentos.mjs";

export const ROTA_PROCEDIMENTOS = "/dashboard/inteligencia/procedimentos";
export const rotaCadastro = (nome) => `${ROTA_PROCEDIMENTOS}${nome ? `?novo=${encodeURIComponent(String(nome).slice(0, 120))}` : ""}`;

/** Procedimentos ativos da unidade. `falha` quando a leitura não deu (a resposta cai no padrão). */
export async function procedimentosDaUnidade(dbe) {
  try {
    const r = await dbe.from("op_processos").select("id, nome, descricao, setor, updated_at").eq("categoria", CATEGORIA).eq("arquivado", false).order("nome").limit(200);
    if (r.error) return { status: "falha", lista: [] };
    const procs = r.data || [];
    if (!procs.length) return { status: "ok", lista: [] };
    const ids = procs.map((p) => p.id);
    const [s, i] = await Promise.all([
      dbe.from("op_secoes").select("id, processo_id, titulo, ordem").in("processo_id", ids),
      dbe.from("op_itens").select("id, processo_id, secao_id, titulo, ordem").in("processo_id", ids).limit(5000),
    ]);
    if (s.error || i.error) return { status: "falha", lista: [] };
    return { status: "ok", lista: montarProcedimentos(procs, s.data, i.data).filter((p) => p.passos.length) };
  } catch (e) {
    if (e?.name === "ErroDeIsolamento") throw e;
    return { status: "falha", lista: [] };
  }
}

/** Resposta com o procedimento cadastrado (bloco "passos"). */
export function respostaDoProcedimento(p, { podeEditar = false } = {}) {
  const linhas = p.passos.map((x, i) => `${i + 1}. ${x}`);
  const texto = [`${p.nome}, do jeito da casa:`, ...linhas, ...(p.gerente.length ? [`Chame o gerente quando: ${p.gerente.join("; ")}.`] : [])].join("\n");
  return {
    tipo: "resposta", texto, natureza: "REAL", agentes: ["operacoes"],
    blocos: [{ tipo: "passos", rotulo: "Procedimento da casa", titulo: p.nome, quando: p.quando || null, passos: p.passos, gerente: p.gerente }],
    acoes: podeEditar ? [{ rotulo: "Editar procedimento", rota: rotaCadastro(p.nome) }] : [],
  };
}

/**
 * Procura o procedimento da casa para a frase. Devolve a resposta pronta ou,
 * sem cadastro, o nome do modelo para o botão "Cadastrar o jeito da casa".
 */
export async function buscarProcedimento({ texto, dbe, podeEditar = false }) {
  const { lista } = await procedimentosDaUnidade(dbe);
  const achado = procedimentoParaTexto(lista, texto);
  if (achado) return { resposta: respostaDoProcedimento(achado, { podeEditar }) };
  const modelo = procedimentoParaTexto(MODELOS, texto);
  return { resposta: null, cadastrar: podeEditar ? { rotulo: "Cadastrar o jeito da casa", rota: rotaCadastro(modelo?.nome || null) } : null, lista };
}
