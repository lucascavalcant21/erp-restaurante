// Trilha de auditoria do canal WhatsApp (db/whatsapp/WA_002_EVENTOS.sql).
// Sempre registra no log (número mascarado) e, se a tabela existir, no banco
// (service role). Falha de auditoria NUNCA derruba o canal: o envio/recebimento
// segue e o problema fica no log. Nunca grava token, segredo nem texto da mensagem.
import { soDigitos, mascarar } from "./numero.mjs";

const DIRECOES = new Set(["entrada", "saida", "status", "eco", "historico"]);
const corta = (v, n) => (v == null || v === "" ? null : String(v).slice(0, n));
const ausente = (e) => /PGRST20[25]|42P01|does not exist|could not find/i.test(`${e?.code || ""} ${e?.message || ""}`);

/** Normaliza um evento para a linha da tabela (pura, testada). */
export function linhaDeEvento(e) {
  if (!e || !DIRECOES.has(e.direcao)) return null;
  const numero = soDigitos(e.numero);
  const erro = Array.isArray(e.erros) && e.erros.length ? e.erros[0] : (e.erro ? { codigo: null, titulo: e.erro } : null);
  return {
    provedor: e.provedor === "ycloud" ? "ycloud" : "meta",
    direcao: e.direcao,
    wamid: corta(e.wamid, 200),
    numero: numero.length >= 10 && numero.length <= 15 ? numero : null,
    comando: corta(e.comando, 40),
    resultado: corta(e.resultado, 40),
    status: corta(e.status, 20),
    erro_codigo: corta(erro?.codigo, 20),
    erro_titulo: corta(erro?.titulo, 200),
    comando_id: /^[0-9a-f-]{36}$/i.test(String(e.comandoId || "")) ? e.comandoId : null,
  };
}

/** @param {() => object} banco  cliente supabase-js com a service role (ou null: só log) */
export function criarAuditoriaWa(banco) {
  let tabelaAusente = false;
  return async function registrar(e) {
    const linha = linhaDeEvento(e);
    if (!linha) return false;
    console.log(`[whatsapp] ${linha.direcao}`, JSON.stringify({ ...linha, numero: linha.numero ? mascarar(linha.numero) : null }));
    if (!banco || tabelaAusente) return false;
    try {
      const { error } = await banco().from("whatsapp_eventos").insert(linha);
      if (!error || error.code === "23505") return true; // 23505: mesmo recibo de novo (idempotente)
      if (ausente(error)) { tabelaAusente = true; return false; }
      console.error("[whatsapp] auditoria falhou", error.code || "");
      return false;
    } catch {
      console.error("[whatsapp] auditoria indisponível");
      return false;
    }
  };
}
