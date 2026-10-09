// Comandos do canal WhatsApp (HDEV-WA-001). Lista fechada: o que não estiver
// aqui recebe a ajuda. Nada da mensagem vira tenant, permissão ou id de usuário.
//
// destino:
//   "agente"  → fila → ponte no PC do dono (scripts/hefisto-agent/ponte-whatsapp.mjs)
//   "hefisto" → Intelligence Core no servidor, como o usuário do dono
//   "local"   → respondido aqui mesmo (ajuda)

const DEF = [
  { comando: "ajuda", destino: "local", re: /^(ajuda|menu|comandos|help|oi|ola|bom dia|boa tarde|boa noite)$/ },
  { comando: "status", destino: "agente", re: /^status( do agente)?$/ },
  { comando: "desenvolvimento", destino: "agente", re: /^como (esta|vai|anda) o (desenvolvimento|dev)$/ },
  { comando: "continuar", destino: "agente", re: /^(continue|continuar|continua|segue|siga|pode continuar)$/ },
  { comando: "parar", destino: "agente", re: /^(pare|parar|para|stop|pausa|pausar)$/ },
  { comando: "missoes", destino: "agente", re: /^miss(oes|ao)$/ },
  { comando: "bloqueadores", destino: "agente", re: /^bloqueador(es)?$/ },
  { comando: "aprovacoes", destino: "agente", re: /^aprovac(oes|ao)( pendentes)?$/ },
  { comando: "empresa", destino: "hefisto", re: /^como (esta|vai|anda) (a )?(minha )?empresa$/ },
];

export const COMANDOS = Object.freeze(DEF.map((d) => d.comando).concat(["aprovar", "rejeitar", "perguntar"]));

/** minúsculas, sem acento, sem pontuação no fim, espaços simples */
export function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\s+/g, " ").trim().replace(/[\s?!.…]+$/, "");
}

const RE_PERGUNTA = /^\s*(?:pergunt[ae]|pergunta)\s+(?:ao|pro|para o|pra o)\s+h[eé]fisto\s*[:,\-–—]?\s*([\s\S]+)$/i;
const RE_DECISAO = /^\s*(aprovar|aprovo|aprova|rejeitar|rejeito|rejeita|recusar)\s+(apr\s*-?\s*\d{1,4})\b\s*([\s\S]*)$/i;

/** @returns {{ comando: string, destino: string, args?: object }} */
export function interpretar(texto) {
  const bruto = String(texto ?? "").normalize("NFC").trim().slice(0, 1000);
  const p = RE_PERGUNTA.exec(bruto);
  if (p) {
    const pergunta = p[1].trim();
    return pergunta ? { comando: "perguntar", destino: "hefisto", args: { pergunta: pergunta.slice(0, 500) } } : { comando: "ajuda", destino: "local" };
  }
  const d = RE_DECISAO.exec(bruto);
  if (d) {
    const id = `APR-${String(Number(d[2].replace(/\D/g, ""))).padStart(3, "0")}`;
    return { comando: /^aprov/i.test(d[1]) ? "aprovar" : "rejeitar", destino: "agente", args: { id, nota: d[3].trim().slice(0, 200) } };
  }
  const n = normalizar(bruto);
  const def = DEF.find((x) => x.re.test(n));
  return def ? { comando: def.comando, destino: def.destino } : { comando: "ajuda", destino: "local", args: { desconhecido: true } };
}

export const AJUDA = [
  "*Héfisto pelo WhatsApp*",
  "",
  "*Desenvolvimento*",
  "• status",
  "• como está o desenvolvimento?",
  "• continue · pare",
  "• missões · bloqueadores · aprovações",
  "• aprovar APR-003 · rejeitar APR-003 motivo",
  "",
  "*Empresa*",
  "• como está minha empresa?",
  "• pergunte ao Héfisto: <sua pergunta>",
].join("\n");
