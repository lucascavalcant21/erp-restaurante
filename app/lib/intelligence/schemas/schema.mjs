// Esquemas tipados do Intelligence Core: uma definição só serve para
//   1. VALIDAR no servidor tudo o que entra (pedido do cliente, saída do
//      modelo, parâmetros de ação) — parse() devolve valor limpo ou erros;
//   2. GERAR o JSON Schema enviado ao modelo (saída estruturada), no
//      subconjunto que a API aceita: objetos com additionalProperties:false,
//      todos os campos em `required` (opcional = aceita null), sem
//      minimum/maximum/minLength (esses limites são conferidos aqui, no parse).
//
// O projeto não usa Zod; este módulo é pequeno de propósito e sem dependência.

const ok = (valor) => ({ ok: true, valor });
const falha = (caminho, mensagem) => ({ ok: false, erros: [{ caminho: caminho || "(raiz)", mensagem }] });

function base(tipo, validar, json, extra = {}) {
  const s = {
    tipo,
    parse(v, caminho = "") { return validar(v, caminho); },
    json,
    descricao: null,
    descrever(texto) { return { ...this, descricao: texto, json: () => ({ ...json(), description: texto }) }; },
    ...extra,
  };
  return s;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Controles e marcadores bidirecionais não têm uso legítimo em texto do ERP.
const INVISIVEIS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

export const s = {
  string({ max = 500, min = 0, padrao = null, aparar = true } = {}) {
    return base("string", (v, c) => {
      if (typeof v !== "string") return falha(c, "deve ser texto");
      let t = v.replace(INVISIVEIS, "");
      if (aparar) t = t.trim();
      if (t.length < min) return falha(c, min === 1 ? "obrigatório" : `mínimo de ${min} caracteres`);
      if (t.length > max) return falha(c, `máximo de ${max} caracteres`);
      if (padrao && !padrao.test(t)) return falha(c, "formato inválido");
      return ok(t);
    }, () => ({ type: "string" }));
  },

  uuid() {
    return base("uuid", (v, c) => (typeof v === "string" && UUID.test(v) ? ok(v.toLowerCase()) : falha(c, "identificador inválido")),
      () => ({ type: "string", format: "uuid" }));
  },

  dataIso() {
    return base("data", (v, c) => {
      if (typeof v !== "string" || !ISO.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return falha(c, "data inválida (AAAA-MM-DD)");
      return ok(v);
    }, () => ({ type: "string", format: "date" }));
  },

  number({ min = -Infinity, max = Infinity, inteiro = false } = {}) {
    return base("number", (v, c) => {
      const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : v;
      if (typeof n !== "number" || !Number.isFinite(n)) return falha(c, "deve ser número");
      if (inteiro && !Number.isInteger(n)) return falha(c, "deve ser inteiro");
      if (n < min) return falha(c, `mínimo ${min}`);
      if (n > max) return falha(c, `máximo ${max}`);
      return ok(n);
    }, () => ({ type: inteiro ? "integer" : "number" }));
  },

  boolean() {
    return base("boolean", (v, c) => (typeof v === "boolean" ? ok(v) : falha(c, "deve ser verdadeiro/falso")), () => ({ type: "boolean" }));
  },

  enum(valores) {
    const lista = [...valores];
    return base("enum", (v, c) => (lista.includes(v) ? ok(v) : falha(c, `valor fora da lista (${lista.join(", ")})`)),
      () => ({ type: "string", enum: lista }), { valores: lista });
  },

  array(item, { max = 50, min = 0 } = {}) {
    return base("array", (v, c) => {
      if (!Array.isArray(v)) return falha(c, "deve ser lista");
      if (v.length < min) return falha(c, `mínimo de ${min} itens`);
      if (v.length > max) return falha(c, `máximo de ${max} itens`);
      const saida = [];
      for (let i = 0; i < v.length; i++) {
        const r = item.parse(v[i], `${c}[${i}]`);
        if (!r.ok) return r;
        saida.push(r.valor);
      }
      return ok(saida);
    }, () => ({ type: "array", items: item.json() }));
  },

  /** Aceita null/undefined (vira null). No JSON Schema vira anyOf [tipo, null] e continua em `required`. */
  opcional(inner) {
    return base(`${inner.tipo}?`, (v, c) => (v === null || v === undefined ? ok(null) : inner.parse(v, c)),
      () => ({ anyOf: [inner.json(), { type: "null" }] }), { opcional: true });
  },

  /** Objeto fechado: campo desconhecido é ERRO (nada de campo extra passar despercebido). */
  object(forma, { permitirExtras = false } = {}) {
    const chaves = Object.keys(forma);
    return base("object", (v, c) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return falha(c, "deve ser objeto");
      if (!permitirExtras) {
        const extras = Object.keys(v).filter((k) => !chaves.includes(k));
        if (extras.length) return falha(c, `campo não permitido: ${extras.join(", ")}`);
      }
      const saida = {};
      for (const k of chaves) {
        const r = forma[k].parse(v[k], c ? `${c}.${k}` : k);
        if (!r.ok) return r;
        saida[k] = r.valor;
      }
      return ok(saida);
    }, () => ({
      type: "object",
      properties: Object.fromEntries(chaves.map((k) => [k, forma[k].json()])),
      required: chaves,
      additionalProperties: false,
    }), { forma });
  },
};

/** parse que lança: para entradas que, se inválidas, são erro de programação. */
export function exigir(schema, valor, rotulo = "valor") {
  const r = schema.parse(valor);
  if (!r.ok) {
    const e = new Error(`${rotulo} inválido: ${r.erros.map((x) => `${x.caminho}: ${x.mensagem}`).join("; ")}`);
    e.erros = r.erros;
    throw e;
  }
  return r.valor;
}

export function mensagemDeErro(r) {
  return (r?.erros || []).map((x) => `${x.caminho}: ${x.mensagem}`).join("; ");
}
