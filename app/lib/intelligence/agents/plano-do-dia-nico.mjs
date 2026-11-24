// "Cheguei, o que eu faço agora?" (dono, 14/11/2026): com plano do dia
// aprovado, o Nico responde com ele (REAL: foi o que o dono aprovou), na
// ordem combinada, com "Ver como faz" de cada tarefa. Sem plano, segue o
// caminho de sempre (procedimento de abertura ou orientação padrão).
// Só leitura, pelo banco escopado da unidade.
import { normalizarTarefa, andamento, comandoDaTarefa } from "../../plano-dia.mjs";

export const ehPerguntaDoQueFazer = (texto) =>
  /\b(o que (eu )?(tenho que|preciso|devo) fazer|o que (eu )?fa[cç]o agora|cheguei( agora)?( na cozinha| no bar| no restaurante)?[,.!]? o que|qual (a|e a) (minha )?tarefa|plano (do dia|de hoje))\b/i.test(String(texto || ""));

export async function planoDeHojeDoBanco(dbe, data) {
  try {
    const p = await dbe.from("plano_dia").select("id, aprovado_por, aprovado_em").eq("data", data).eq("status", "ativo").limit(1);
    if (p.error || !p.data?.length) return null;
    const t = await dbe.from("plano_dia_tarefa").select("*").eq("plano_id", p.data[0].id).order("ordem").limit(60);
    if (t.error) return null;
    return { plano: p.data[0], tarefas: (t.data || []).map(normalizarTarefa) };
  } catch (e) {
    if (e?.name === "ErroDeIsolamento") throw e;
    return null;
  }
}

export function respostaDoPlano({ tarefas }) {
  const a = andamento(tarefas);
  const faltam = tarefas.filter((t) => !t.feitoEm);
  const linha = (t) => `${t.ordem}. ${t.titulo}${t.quantidade != null ? ` (${t.quantidade.toLocaleString("pt-BR")} ${t.unidade || ""})`.replace(/ \)$/, ")") : ""}${t.responsavelNome ? `, ${t.responsavelNome}` : ""}${t.depoisDoIntervalo ? ", depois do intervalo" : ""}`;
  const texto = faltam.length
    ? [`Plano de hoje: ${a.feitas} de ${a.total} feitas. Na ordem:`, ...faltam.map(linha), "Marque cada uma quando terminar, na tela inicial do Nico."].join("\n")
    : "O plano de hoje já está todo feito. Confira o fechamento.";
  return {
    tipo: "resposta", texto, natureza: "REAL", agentes: ["operacoes"],
    blocos: faltam.length ? [{
      tipo: "passos", rotulo: "Plano de hoje · combinado com o Jhon", titulo: `${a.total - a.feitas} tarefa(s) para fazer`,
      passos: faltam.map((t) => t.titulo),
      etapas: faltam.map((t) => {
        const comando = comandoDaTarefa(t);
        return {
          texto: t.titulo,
          ...(t.quantidade != null ? { quantidade: `${t.quantidade.toLocaleString("pt-BR")} ${t.unidade || ""}`.trim() } : {}),
          ...(t.responsavelNome ? { produto: t.responsavelNome } : {}),
          ...(t.depoisDoIntervalo ? { detalhe: "Depois do intervalo." } : {}),
          abre: comando ? { nome: t.fichaNome || t.procedimento, comando } : null,
        };
      }),
      gerente: [],
    }] : [],
    acoes: [],
  };
}
