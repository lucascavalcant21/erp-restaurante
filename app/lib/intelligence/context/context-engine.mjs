// CONTEXT ENGINE: quem pergunta, em que empresa/unidade, com que função e
// permissões, de que tela, olhando qual registro, sobre qual período e fuso.
//
// Duas origens, com confiança diferente:
//   CONFIÁVEL  (servidor/banco): usuário, empresa, unidade, perfil, permissões
//              — vêm do RequestContext (resolverContexto); o cliente não opina.
//   INDICATIVA (tela do cliente): rota, entidade aberta, filtros — servem para
//              entender "por que aumentou?" olhando a Picanha. São limpas,
//              limitadas e NUNCA autorizam nada: a entidade só vale depois de
//              ser reencontrada no banco dentro do escopo (verificada=false até lá).
//
// Campos de tenant enviados pelo cliente (empresa_id, unidade_id, tenant…)
// são descartados aqui e registrados como tentativa ignorada.

import { s } from "../schemas/schema.mjs";
import { escopoDoContexto } from "./escopo.mjs";
import { FUSO_PADRAO, fusoValido, hojeNoFuso } from "../core/periodos.mjs";

export const TIPOS_ENTIDADE = Object.freeze(["produto", "conta_pagar", "fornecedor", "colaborador", "ficha", "evento", "compra"]);

const CAMPOS_DE_TENANT = ["empresa_id", "empresaId", "unidade_id", "unidadeId", "tenant", "tenantId", "company_id", "companyId", "user_id", "userId"];

const telaSchema = s.object({
  rota: s.opcional(s.string({ max: 200, padrao: /^\/dashboard(\/[A-Za-z0-9_\-\/\[\]]*)?(\?[A-Za-z0-9_=&\-%.]*)?$/ })),
  entidade: s.opcional(s.object({
    tipo: s.enum(TIPOS_ENTIDADE),
    id: s.opcional(s.string({ max: 64, padrao: /^[A-Za-z0-9_\-]+$/ })),
    nome: s.opcional(s.string({ max: 80 })),
  })),
  filtros: s.opcional(s.object({
    periodo: s.opcional(s.string({ max: 20, padrao: /^[a-z_0-9]+$/ })),
    departamento: s.opcional(s.string({ max: 30, padrao: /^[a-z_]+$/ })),
  })),
  fuso: s.opcional(s.string({ max: 64 })),
});

/** Módulo pela rota — decidido aqui, não pelo que o cliente diz. */
export function moduloDaRota(rota = "") {
  const r = String(rota || "");
  if (/\/estoque|\/ingredientes|\/validade|\/etiquetas|\/contagens/.test(r)) return "estoque";
  if (/\/compras|\/notas|\/fornecedores/.test(r)) return "compras";
  if (/\/financeiro|\/dre|\/cmv/.test(r)) return "financeiro";
  if (/\/rh|\/ponto|\/colaborador/.test(r)) return "rh";
  if (/\/fichas|\/producao|\/cardapio|\/cozinha|\/montagem/.test(r)) return "producao";
  if (/\/vendas|\/mesas|\/delivery/.test(r)) return "vendas";
  if (/\/eventos|\/reservas/.test(r)) return "eventos";
  if (/\/inteligencia/.test(r)) return "inteligencia";
  return "geral";
}

/**
 * Limpa a tela enviada pelo cliente. Nunca lança: o que for inválido é
 * descartado e anotado em `descartados`.
 */
export function limparTela(bruta) {
  const descartados = [];
  if (!bruta || typeof bruta !== "object" || Array.isArray(bruta)) {
    return { tela: { rota: null, entidade: null, filtros: null, fuso: null }, descartados: bruta == null ? [] : ["tela"] };
  }
  const copia = {};
  for (const [k, v] of Object.entries(bruta)) {
    if (CAMPOS_DE_TENANT.includes(k)) { descartados.push(`tenant:${k}`); continue; }
    if (["rota", "entidade", "filtros", "fuso"].includes(k)) copia[k] = v;
    else descartados.push(k);
  }
  if (copia.entidade && typeof copia.entidade === "object") {
    for (const k of Object.keys(copia.entidade)) {
      if (CAMPOS_DE_TENANT.includes(k)) { descartados.push(`tenant:entidade.${k}`); delete copia.entidade[k]; }
    }
  }
  if (copia.filtros && typeof copia.filtros === "object") {
    for (const k of Object.keys(copia.filtros)) {
      if (!["periodo", "departamento"].includes(k)) { descartados.push(`filtros.${k}`); delete copia.filtros[k]; }
    }
  }
  const r = telaSchema.parse({ rota: null, entidade: null, filtros: null, fuso: null, ...copia });
  if (r.ok) return { tela: r.valor, descartados };
  // Campo a campo: o que não passa sai, o resto fica.
  const tela = { rota: null, entidade: null, filtros: null, fuso: null };
  for (const k of Object.keys(tela)) {
    const um = telaSchema.forma[k].parse(copia[k]);
    if (um.ok) tela[k] = um.valor; else descartados.push(k);
  }
  return { tela, descartados };
}

/**
 * @param {object} p
 * @param {object} p.requestContext  RequestContext do servidor (resolverContexto)
 * @param {object} [p.tela]          contexto de tela enviado pelo cliente (não confiável)
 * @param {Date}   [p.agora]
 * @param {string} [p.fusoEmpresa]   fuso configurado da empresa (servidor)
 */
export function montarContextoInteligencia({ requestContext, tela = null, agora = new Date(), fusoEmpresa = FUSO_PADRAO }) {
  const escopo = escopoDoContexto(requestContext);
  const { tela: limpa, descartados } = limparTela(tela);
  // O fuso da empresa vem do servidor; o do aparelho só se for válido e
  // quando a empresa não tiver um configurado.
  const fuso = fusoValido(fusoEmpresa) ? fusoEmpresa : (fusoValido(limpa.fuso) ? limpa.fuso : FUSO_PADRAO);
  const entidade = limpa.entidade
    ? Object.freeze({ tipo: limpa.entidade.tipo, id: limpa.entidade.id, nome: limpa.entidade.nome, verificada: false })
    : null;

  return Object.freeze({
    escopo,
    usuario: Object.freeze({
      id: requestContext.userId,
      usuarioErpId: requestContext.usuarioErpId || null,
      perfil: requestContext.perfil?.codigo || null,
      superAdmin: requestContext.superAdmin === true,
    }),
    // Permissões efetivas do banco (só para negar cedo; o "sim" é do banco).
    permissoes: requestContext.permissions,
    canal: requestContext.channel,
    tela: Object.freeze({ rota: limpa.rota, modulo: moduloDaRota(limpa.rota), filtros: limpa.filtros ? Object.freeze({ ...limpa.filtros }) : null }),
    entidade,
    fuso,
    agora: agora.toISOString(),
    hoje: hojeNoFuso(agora, fuso),
    descartados: Object.freeze([...descartados]),
  });
}
