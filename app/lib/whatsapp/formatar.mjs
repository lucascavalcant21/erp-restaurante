// Respostas do Intelligence Core em texto de WhatsApp. Só reorganiza o que o
// core devolveu: nenhum número é calculado aqui (fraseDaMetrica é a mesma da tela).
import { fraseDaMetrica } from "../intelligence/commands/resposta.mjs";

const ORIGEM_APP = "https://app.hefisto.com.br";

function linhaDeItem(i) {
  if (i == null) return null;
  if (typeof i === "string") return `• ${i}`;
  if (i.rotulo && i.valor != null) return `• ${i.rotulo}: ${i.valor}`;
  return i.texto ? `• ${i.texto}` : null;
}

function bloco(b) {
  if (!b) return [];
  if (b.tipo === "metrica") return [`• ${fraseDaMetrica(b.metrica, b.rotulo)}`];
  if (b.tipo === "lista") return [b.titulo ? `*${b.titulo}*` : null, ...(b.itens || []).slice(0, 8).map(linhaDeItem)].filter(Boolean);
  if (b.tipo === "insight" && b.insight?.titulo) return [`• ${b.insight.titulo}`];
  if (b.tipo === "texto" && b.texto) return [b.qualificador ? `${b.qualificador}: ${b.texto}` : b.texto];
  return [];
}

/** Resposta de /ask (corpo devolvido por processarComando). */
export function formatarResposta(r) {
  if (!r || typeof r !== "object") return "Não consegui responder agora.";
  if (r.erro) return r.erro;
  const linhas = [];
  if (r.texto) linhas.push(r.texto);
  const extras = (Array.isArray(r.blocos) ? r.blocos : []).flatMap(bloco).filter((l) => l && !linhas.includes(l.replace(/^• /, "")));
  if (extras.length) linhas.push("", ...extras.slice(0, 15));
  if (r.tipo === "pergunta" && r.pergunta) {
    const opc = Array.isArray(r.pergunta.opcoes) ? r.pergunta.opcoes.slice(0, 6) : [];
    if (r.pergunta.texto && r.pergunta.texto !== r.texto) linhas.push("", r.pergunta.texto);
    if (opc.length) linhas.push(...opc.map((o) => `• pergunte ao Héfisto: ${o.comando || o.rotulo}`));
  }
  if (r.tipo === "navegacao" && r.rota) linhas.push(`${ORIGEM_APP}${r.rota}`);
  return linhas.join("\n").trim() || "Não consegui responder agora.";
}

/** Daily Brief → "como está minha empresa?". */
export function formatarBrief(brief) {
  if (!brief) return "Não consegui montar o resumo agora.";
  const secao = (titulo, lista, max) => (Array.isArray(lista) && lista.length
    ? ["", `*${titulo}*`, ...lista.slice(0, max).map((i) => `• ${i.titulo}${i.impacto?.texto ? ` (${i.impacto.texto})` : ""}`),
       ...(lista.length > max ? [`• e mais ${lista.length - max} na Central de Inteligência`] : [])]
    : []);
  const linhas = [
    brief.summary || "",
    ...secao("Crítico", brief.critical, 3),
    ...secao("Importante", brief.warnings, 3),
    ...secao("Oportunidades", brief.opportunities, 2),
  ];
  if (!brief.critical?.length && !brief.warnings?.length && !brief.opportunities?.length) linhas.push("", "Nenhum alerta com os dados disponíveis.");
  linhas.push("", `Detalhes: ${ORIGEM_APP}/dashboard/inteligencia`);
  return linhas.join("\n").trim();
}
