// Registro de integrações: quem pode chamar o ERP SEM usuário logado, como
// prova que é quem diz ser e o que pode fazer.
//
// Regras:
//   - Cada integração tem identidade própria (aparece nos logs e na auditoria
//     como "integracao:<id>") e segredo próprio, em variável de ambiente própria.
//     Nada de segredo compartilhado entre integrações, nem da service role.
//   - Sem o segredo configurado, a integração fica FECHADA (503), nunca aberta.
//   - Webhook prova origem por assinatura HMAC do CORPO BRUTO, comparada em
//     tempo constante. URL "difícil de adivinhar" não é autenticação.
//   - Permissões da integração são uma lista explícita e curta; vazia = nenhuma.
//   - O Agent Core NÃO é uma integração com poderes próprios: ele age com o
//     RequestContext do usuário que pediu (canal "agente"), sujeito às mesmas
//     permissões, unidade e RLS.
//
// Os detalhes de cabeçalho/formato de cada fornecedor marcados em `confirmar`
// precisam ser conferidos na documentação oficial antes de ligar a integração.

import crypto from "node:crypto";
import { CODIGOS, recusa } from "./codigos.mjs";
import { contextoDeIntegracao } from "./contexto.mjs";

export const INTEGRACOES = Object.freeze({
  cron: Object.freeze({
    nome: "Agendador (Vercel Cron)",
    canal: "sistema",
    situacao: "ativa",
    autenticacao: Object.freeze({ tipo: "bearer", variavel: "CRON_SECRET" }),
    permissoes: Object.freeze([]),
  }),
  "ifood-webhook": Object.freeze({
    nome: "iFood — eventos de pedido",
    canal: "integracao",
    situacao: "nao_implementada",
    autenticacao: Object.freeze({ tipo: "hmac-sha256", variavel: "IFOOD_WEBHOOK_SECRET", cabecalho: "x-ifood-signature", formato: "hex", prefixo: "" }),
    permissoes: Object.freeze([]),
    confirmar: "nome do cabeçalho e formato da assinatura na documentação do iFood",
  }),
  whatsapp: Object.freeze({
    nome: "WhatsApp Business (Meta)",
    canal: "integracao",
    situacao: "planejada",
    autenticacao: Object.freeze({ tipo: "hmac-sha256", variavel: "WHATSAPP_APP_SECRET", cabecalho: "x-hub-signature-256", formato: "hex", prefixo: "sha256=" }),
    permissoes: Object.freeze([]),
    confirmar: "cabeçalho e prefixo na documentação da Meta",
  }),
  instagram: Object.freeze({
    nome: "Instagram (Meta)",
    canal: "integracao",
    situacao: "planejada",
    autenticacao: Object.freeze({ tipo: "hmac-sha256", variavel: "INSTAGRAM_APP_SECRET", cabecalho: "x-hub-signature-256", formato: "hex", prefixo: "sha256=" }),
    permissoes: Object.freeze([]),
    confirmar: "cabeçalho e prefixo na documentação da Meta",
  }),
  saipos: Object.freeze({
    nome: "Saipos",
    canal: "integracao",
    situacao: "planejada",
    autenticacao: Object.freeze({ tipo: "bearer", variavel: "SAIPOS_INTEGRACAO_SECRET" }),
    permissoes: Object.freeze([]),
    confirmar: "forma de acesso oferecida pela Saipos (a fonte da verdade de vendas ainda não foi decidida)",
  }),
});

/** Comparação em tempo constante que não vaza o tamanho por exceção. */
export function igualEmTempoConstante(a, b) {
  const x = Buffer.from(String(a ?? ""), "utf8");
  const y = Buffer.from(String(b ?? ""), "utf8");
  const tamanho = Math.max(x.length, y.length, 1);
  const px = Buffer.alloc(tamanho); x.copy(px);
  const py = Buffer.alloc(tamanho); y.copy(py);
  return crypto.timingSafeEqual(px, py) && x.length === y.length;
}

export function verificarBearer(cabecalhoAuthorization, segredo) {
  const m = /^Bearer\s+(\S{16,})$/i.exec(String(cabecalhoAuthorization || "").trim());
  return Boolean(m && segredo && igualEmTempoConstante(m[1], segredo));
}

export function assinaturaHmac(segredo, corpoBruto, formato = "hex") {
  return crypto.createHmac("sha256", String(segredo)).update(corpoBruto ?? "").digest(formato === "base64" ? "base64" : "hex");
}

export function verificarHmac({ segredo, corpoBruto, assinatura, prefixo = "", formato = "hex" }) {
  if (!segredo || !assinatura) return false;
  const recebida = String(assinatura).trim();
  if (prefixo && !recebida.toLowerCase().startsWith(prefixo.toLowerCase())) return false;
  const valor = prefixo ? recebida.slice(prefixo.length) : recebida;
  const esperada = assinaturaHmac(segredo, corpoBruto, formato);
  return igualEmTempoConstante(formato === "hex" ? valor.toLowerCase() : valor, esperada);
}

/**
 * Autentica uma chamada de integração.
 * @param {object} p
 * @param {string} p.id  chave em INTEGRACOES
 * @param {{get:(nome:string)=>string|null}} p.cabecalhos
 * @param {string} [p.corpoBruto]  obrigatório para HMAC
 * @param {object} [p.env]  process.env por padrão
 * @param {string} p.requestId
 */
export function autenticarIntegracao({ id, cabecalhos, corpoBruto = "", env = process.env, requestId }) {
  const cfg = INTEGRACOES[id];
  if (!cfg) return recusa(500, CODIGOS.INTEGRACAO_DESCONHECIDA, "Integração não registrada.");
  const segredo = env?.[cfg.autenticacao.variavel];
  if (!segredo) return recusa(503, CODIGOS.NAO_CONFIGURADO, "Integração desativada: segredo não configurado.");

  let valida = false;
  if (cfg.autenticacao.tipo === "bearer") {
    valida = verificarBearer(cabecalhos.get("authorization"), segredo);
  } else if (cfg.autenticacao.tipo === "hmac-sha256") {
    valida = verificarHmac({
      segredo, corpoBruto,
      assinatura: cabecalhos.get(cfg.autenticacao.cabecalho),
      prefixo: cfg.autenticacao.prefixo, formato: cfg.autenticacao.formato,
    });
  }
  if (!valida) return recusa(401, CODIGOS.ASSINATURA_INVALIDA, "não autorizado");

  return {
    ok: true,
    status: 200,
    integracao: id,
    contexto: contextoDeIntegracao({ integracao: id, canal: cfg.canal, permissoes: cfg.permissoes, requestId }),
  };
}
