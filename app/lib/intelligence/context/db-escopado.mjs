// BANCO ESCOPADO: o único caminho de leitura do Intelligence Core.
//
// Três camadas, nenhuma confia só na outra:
//   1. O cliente por baixo é o do PRÓPRIO usuário (token dele): o RLS do banco
//      vale como em qualquer tela.
//   2. Toda tabela de tenant recebe .eq("unidade_id", <unidade do escopo>)
//      AUTOMATICAMENTE, logo depois do select — quem escreve a consulta não
//      consegue esquecer o filtro. (As policies antigas tratam escopo
//      "empresa" como rede inteira; por isso o filtro explícito.)
//   3. O resultado é conferido linha a linha: uma linha de outra unidade
//      derruba a consulta inteira (ErroDeIsolamento) — falha fechada, nunca
//      "filtra e segue".
//
// Só leitura: insert/update/delete/upsert/rpc não existem aqui. Escrita é das
// ações (actions/), pelas funções do banco que já conferem permissão.
//
// Cada consulta fica registrada (tabela, filtros, linhas) para a resposta
// mostrar "consulta utilizada" e para a auditoria.

import { exigirEscopo } from "./escopo.mjs";

export class ErroDeIsolamento extends Error {
  constructor(tabela) {
    super(`Falha de isolamento: a consulta a "${tabela}" devolveu dado de outra unidade. A resposta foi bloqueada.`);
    this.name = "ErroDeIsolamento";
    this.codigo = "ISOLAMENTO";
    this.tabela = tabela;
  }
}

export class ErroDeFonte extends Error {
  constructor(tabela, mensagem, { ausente = false } = {}) {
    super(mensagem);
    this.name = "ErroDeFonte";
    this.codigo = ausente ? "FONTE_AUSENTE" : "FONTE_FALHOU";
    this.tabela = tabela;
    this.ausente = ausente;
  }
}

/**
 * Tabelas que a inteligência pode ler. tenant=true: tem unidade_id e é
 * filtrada/conferida. tenant=false: catálogo global (sem dado de cliente).
 */
export const TABELAS = Object.freeze({
  fin_faturamento_diario: { tenant: true, rotulo: "Faturamento diário informado" },
  vw_compras: { tenant: true, rotulo: "Compras (com total)" },
  compras_itens: { tenant: true, rotulo: "Itens de compra" },
  insumos: { tenant: true, rotulo: "Cadastro de produtos" },
  estoques: { tenant: true, rotulo: "Locais de estoque" },
  estoque_itens: { tenant: true, rotulo: "Saldo de estoque" },
  estoque_lotes: { tenant: true, rotulo: "Lotes por validade" },
  estoque_custos: { tenant: true, rotulo: "Custo médio" },
  estoque_contagens: { tenant: true, rotulo: "Inventários" },
  estoque_contagens_itens: { tenant: true, rotulo: "Itens contados" },
  estoque_movimentacoes_multi: { tenant: true, rotulo: "Histórico de estoque" },
  vw_fin_contas_pagar: { tenant: true, rotulo: "Contas a pagar" },
  colaboradores: { tenant: true, rotulo: "Cadastro de colaboradores" },
  rh_recibos_prestacao: { tenant: true, rotulo: "Recibos de extras" },
  fornecedores: { tenant: true, rotulo: "Fornecedores" },
  etiquetas: { tenant: true, rotulo: "Etiquetas de validade" },
  fin_categorias: { tenant: false, rotulo: "Plano de contas" },
});

// Métodos de filtro/ordem permitidos. `or` fica de fora de propósito.
const PERMITIDOS = new Set(["eq", "neq", "in", "gte", "lte", "gt", "lt", "is", "ilike", "order", "limit", "range", "not", "maybeSingle", "single"]);

const tabelaAusente = (e) => /does not exist|não existe|schema cache|could not find|PGRST205|42P01/i.test(String(e?.message || e?.code || e || ""));

function comUnidade(cols) {
  const c = String(cols ?? "*").trim() || "*";
  if (c === "*" || /(^|[\s,])unidade_id([\s,]|$)/.test(c) || /(^|,)\s*\*\s*(,|$)/.test(c)) return c;
  return `${c}, unidade_id`;
}

function resumirArgs(args) {
  return args.map((a) => {
    if (Array.isArray(a)) return a.length > 5 ? `[${a.length} valores]` : a.map(String);
    if (a && typeof a === "object") return "{…}";
    return a;
  });
}

/**
 * @param {object} db       cliente no formato supabase-js (o do usuário)
 * @param {object} escopo   escopo autêntico (escopoDoContexto)
 * @returns {{ from(tabela:string): object, consultas: object[] }}
 */
export function criarDbEscopado(db, escopo) {
  exigirEscopo(escopo);
  if (!db || typeof db.from !== "function") throw new Error("Banco indisponível para a inteligência.");
  const consultas = [];

  function embrulhar(builder, registro, meta) {
    return new Proxy(builder, {
      get(alvo, prop) {
        if (prop === "then") {
          return (resolver, rejeitar) => Promise.resolve(alvo).then((r) => conferir(r, registro, meta)).then(resolver, rejeitar);
        }
        const v = alvo[prop];
        if (typeof v !== "function") return v;
        if (!PERMITIDOS.has(prop)) {
          return () => { throw new Error(`Operação "${String(prop)}" não permitida na leitura da inteligência.`); };
        }
        return (...args) => {
          registro.filtros.push([prop, ...resumirArgs(args)]);
          return embrulhar(v.apply(alvo, args), registro, meta);
        };
      },
    });
  }

  // Erro de leitura volta como veio ({ error }), no formato que os motores de
  // domínio já tratam (ex.: carregarDadosCmv sabe que o faturamento diário é
  // opcional). Só a violação de isolamento lança.
  function conferir(r, registro, meta) {
    if (r?.error) {
      registro.erro = tabelaAusente(r.error) ? "tabela_ausente" : "falha";
      return r;
    }
    const dados = r?.data;
    const linhas = Array.isArray(dados) ? dados : dados ? [dados] : [];
    if (meta.tenant) {
      for (const l of linhas) {
        if (l && typeof l === "object" && String(l.unidade_id) !== escopo.unidadeId) {
          registro.erro = "isolamento";
          throw new ErroDeIsolamento(registro.tabela);
        }
      }
    }
    registro.linhas = linhas.length;
    return r;
  }

  return {
    consultas,
    from(tabela) {
      const meta = TABELAS[tabela];
      if (!meta) throw new Error(`Tabela "${tabela}" fora da lista de leitura da inteligência.`);
      return {
        select(cols = "*", opcoes) {
          const colunas = meta.tenant ? comUnidade(cols) : cols;
          const registro = { tabela, fonte: meta.rotulo, colunas: String(colunas).slice(0, 300), filtros: [], linhas: null, erro: null };
          consultas.push(registro);
          let q = db.from(tabela).select(colunas, opcoes);
          if (meta.tenant) {
            q = q.eq("unidade_id", escopo.unidadeId);
            registro.filtros.push(["eq", "unidade_id", escopo.unidadeId]);
          }
          return embrulhar(q, registro, meta);
        },
      };
    },
  };
}

/** Consultas registradas desde o índice `desde` (para anexar à métrica que as fez). */
export function consultasDesde(dbEscopado, desde) {
  return dbEscopado.consultas.slice(desde).map((c) => ({ ...c, filtros: c.filtros.map((f) => [...f]) }));
}

export const ehFonteAusente = (e) => e instanceof ErroDeFonte && e.ausente;

/** Executa a consulta; erro de leitura vira ErroDeFonte (ausente ou falhou). */
export async function ler(consulta, tabela) {
  const r = await consulta;
  if (r?.error) {
    const ausente = tabelaAusente(r.error);
    const rotulo = TABELAS[tabela]?.rotulo || tabela;
    throw new ErroDeFonte(tabela, ausente ? `A fonte "${rotulo}" não existe neste banco.` : `Não foi possível ler "${rotulo}".`, { ausente });
  }
  return r.data;
}
