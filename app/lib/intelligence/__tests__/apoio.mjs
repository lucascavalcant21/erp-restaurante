// APOIO DE TESTE do Intelligence Core (não é usado pelo app).
//
// - bancoFalso(): tabelas em memória com a interface do supabase-js
//   (from/select/eq/in/gte/lte/…/order/limit/single/maybeSingle + rpc).
//   `ignorarFiltros: true` simula RLS/filtro quebrado: devolve TODAS as linhas,
//   inclusive de outras empresas — o Intelligence Core tem de bloquear.
// - contexto(): RequestContext REAL (resolverContexto) com dependências falsas
//   de banco, para dois tenants: empresa A (loja-a) e empresa B (loja-b).

import { resolverContexto } from "../../server/contexto.mjs";

export const UID_A = "11111111-1111-4111-8111-111111111111";
export const UID_B = "22222222-2222-4222-8222-222222222222";
export const EMPRESA_A = "aaaaaaaa-0000-4000-8000-00000000000a";
export const EMPRESA_B = "bbbbbbbb-0000-4000-8000-00000000000b";

const USUARIOS = {
  [`tok-${UID_A}`]: { id: UID_A, unidades: ["loja-a"], empresa: EMPRESA_A, permissoes: ["*"] },
  [`tok-${UID_B}`]: { id: UID_B, unidades: ["loja-b"], empresa: EMPRESA_B, permissoes: ["*"] },
  "tok-restrito": { id: "33333333-3333-4333-8333-333333333333", unidades: ["loja-a"], empresa: EMPRESA_A, permissoes: ["estoque.overview.view"] },
};

export function depsFalsas({ negar = [] } = {}) {
  return {
    async validarToken(token) { return USUARIOS[token] ? { id: USUARIOS[token].id } : null; },
    async contextoDoBanco(token, unidade) {
      const u = USUARIOS[token];
      if (!u) return { autenticado: false };
      const permitida = !unidade || u.unidades.includes(unidade);
      return {
        autenticado: true, cadastrado: true, valido: true, auth_user_id: u.id, usuario_erp_id: `erp-${u.id}`,
        super_admin: false, perfil_id: "p1", perfil_codigo: "gerente",
        unidade_id: permitida ? unidade : null, unidade_permitida: permitida,
        empresa_id: u.empresa, unidades: u.unidades, permissoes: u.permissoes, negacoes: [],
      };
    },
    async podeFazer(token, permissao, unidade) {
      const u = USUARIOS[token];
      if (!u || (unidade && !u.unidades.includes(unidade))) return false;
      if (negar.includes(permissao)) return false;
      return u.permissoes.includes("*") || u.permissoes.includes(permissao);
    },
  };
}

export async function contexto(token = `tok-${UID_A}`, unidade = "loja-a", deps = depsFalsas()) {
  const r = await resolverContexto({ token, unidadeSolicitada: unidade, canal: "agente", requestId: "req-teste-0001", deps });
  if (!r.ok) throw new Error(`contexto recusado: ${r.codigo}`);
  return r.contexto;
}

// ─── Banco falso ─────────────────────────────────────────────────────────────

const cmp = (a, b) => (a === b ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : 1);

export function bancoFalso(tabelas = {}, { ignorarFiltros = false, erros = {}, rpcs = {} } = {}) {
  const chamadas = [];
  const dados = Object.fromEntries(Object.entries(tabelas).map(([k, v]) => [k, v.map((x) => ({ ...x }))]));

  function consulta(tabela) {
    const st = { filtros: [], ordem: [], limite: null, unico: null, colunas: "*" };
    const executar = () => {
      chamadas.push({ tabela, filtros: st.filtros.map((f) => [...f]), colunas: st.colunas });
      if (erros[tabela]) return { data: null, error: erros[tabela] };
      if (!(tabela in dados)) return { data: null, error: { message: `relation "public.${tabela}" does not exist`, code: "42P01" } };
      let linhas = [...dados[tabela]];
      if (!ignorarFiltros) {
        for (const [op, col, val] of st.filtros) {
          linhas = linhas.filter((l) => {
            const v = l[col];
            switch (op) {
              case "eq": return String(v) === String(val);
              case "neq": return String(v) !== String(val);
              case "in": return val.map(String).includes(String(v));
              case "gte": return v != null && v >= val;
              case "lte": return v != null && v <= val;
              case "gt": return v != null && v > val;
              case "lt": return v != null && v < val;
              case "is": return val === null ? v == null : v === val;
              default: return true;
            }
          });
        }
      }
      for (const [col, asc] of [...st.ordem].reverse()) linhas.sort((a, b) => (asc ? 1 : -1) * cmp(a[col], b[col]));
      if (st.limite != null) linhas = linhas.slice(0, st.limite);
      if (st.unico === "single") return linhas.length === 1 ? { data: linhas[0], error: null } : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      if (st.unico === "maybe") return { data: linhas[0] ?? null, error: null };
      return { data: linhas, error: null };
    };
    const b = {
      select(cols = "*") { st.colunas = cols; return b; },
      eq(c, v) { st.filtros.push(["eq", c, v]); return b; },
      neq(c, v) { st.filtros.push(["neq", c, v]); return b; },
      in(c, v) { st.filtros.push(["in", c, v]); return b; },
      gte(c, v) { st.filtros.push(["gte", c, v]); return b; },
      lte(c, v) { st.filtros.push(["lte", c, v]); return b; },
      gt(c, v) { st.filtros.push(["gt", c, v]); return b; },
      lt(c, v) { st.filtros.push(["lt", c, v]); return b; },
      is(c, v) { st.filtros.push(["is", c, v]); return b; },
      ilike() { return b; },
      or() { return b; },
      not() { return b; },
      order(c, o = {}) { st.ordem.push([c, o.ascending !== false]); return b; },
      limit(n) { st.limite = n; return b; },
      range(a, z) { st.limite = z - a + 1; return b; },
      single() { st.unico = "single"; return b; },
      maybeSingle() { st.unico = "maybe"; return b; },
      insert(linhas) {
        const lista = Array.isArray(linhas) ? linhas : [linhas];
        (dados[tabela] ||= []).push(...lista.map((l) => ({ ...l })));
        chamadas.push({ tabela, op: "insert", linhas: lista.length });
        return { select: () => ({ single: async () => ({ data: lista[0], error: null }) }), then: (r) => Promise.resolve({ data: null, error: null }).then(r) };
      },
      update() { throw new Error("update não suportado no banco falso"); },
      then(resolver, rejeitar) { return Promise.resolve().then(executar).then(resolver, rejeitar); },
    };
    return b;
  }

  return {
    dados,
    chamadas,
    from: (t) => consulta(t),
    async rpc(nome, args) {
      chamadas.push({ rpc: nome, args });
      if (!rpcs[nome]) return { data: null, error: { message: `could not find the function public.${nome}`, code: "PGRST202" } };
      try { return { data: await rpcs[nome](args, dados), error: null }; }
      catch (e) { return { data: null, error: { message: e.message } }; }
    },
  };
}

/** Data/hora fixa: 07/10/2026 15:00 em São Paulo (quarta-feira). */
export const AGORA = new Date("2026-10-07T18:00:00Z");
