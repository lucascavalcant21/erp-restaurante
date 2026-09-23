// ═══════════════════════════════════════════════════════════════
// ferramentas.mjs — o que o Héfisto com IA pode CONSULTAR
//
// Toda ferramenta aqui é SOMENTE LEITURA, tem consulta fixa (o modelo nunca
// escreve SQL nem escolhe tabela) e exige uma permissão do catálogo do ERP.
// Quem executa é o servidor, com o cliente Supabase da sessão do próprio
// usuário — então o RLS continua valendo linha a linha.
//
// O modelo só enxerga as ferramentas que a permissão da sessão libera, e a
// permissão é conferida DE NOVO na hora de executar: se o modelo pedir uma
// ferramenta fora da lista (texto malicioso na tela, por exemplo), a execução
// para aqui.
// ═══════════════════════════════════════════════════════════════

import { hasPermission } from "../permissions-catalog.mjs";
import { custoDeProduzirFicha } from "../ficha-calculos.mjs";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const texto = (v) => String(v ?? "").trim();
const brl = (v) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const inicioDoDiaISO = () => {
  const a = new Date();
  return new Date(a.getFullYear(), a.getMonth(), a.getDate()).toISOString();
};

/* Limite de linhas que volta para o modelo: contexto curto é resposta melhor
   e mais barata, e nada aqui precisa de listagem gigante. */
const LIMITE = 25;

async function linhas(consulta) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message || "Falha ao consultar o banco.");
  return data || [];
}

export const FERRAMENTAS = [
  {
    id: "resumo_do_restaurante",
    titulo: "Resumo do restaurante",
    descricao: "Panorama do dia na unidade: itens de estoque abaixo do mínimo, produções registradas hoje e contas vencidas em aberto. Use para 'como está a operação', 'resumo do dia', 'o que merece atenção'.",
    permissao: "dashboard.overview.view",
    parametros: { type: "object", properties: {}, additionalProperties: false },
    async executar({ cliente, unidadeId }) {
      const insumos = await linhas(
        cliente.from("insumos").select("nome, estoque_minimo, unidade_medida, estoque_atual (quantidade_atual)").eq("unidade_id", unidadeId).limit(300)
      );
      const abaixo = insumos.filter((i) => {
        const atual = num(i.estoque_atual?.[0]?.quantidade_atual ?? i.estoque_atual?.quantidade_atual);
        const minimo = num(i.estoque_minimo);
        return minimo > 0 && atual < minimo;
      });
      const producoes = await linhas(
        cliente.from("producao_diaria").select("id").eq("unidade_id", unidadeId).gte("created_at", inicioDoDiaISO()).limit(200)
      );
      const contas = await linhas(
        cliente.from("contas_pagar").select("valor, data_vencimento, status").eq("unidade_id", unidadeId).lt("data_vencimento", hojeISO()).limit(200)
      );
      const vencidas = contas.filter((c) => texto(c.status) !== "pago");
      return {
        unidade: unidadeId,
        itens_abaixo_do_minimo: abaixo.length,
        exemplos_em_falta: abaixo.slice(0, 5).map((i) => texto(i.nome)),
        producoes_registradas_hoje: producoes.length,
        contas_vencidas_em_aberto: vencidas.length,
        valor_das_contas_vencidas: brl(vencidas.reduce((s, c) => s + num(c.valor), 0)),
      };
    },
  },

  {
    id: "estoque_critico",
    titulo: "Estoque crítico",
    descricao: "Lista os insumos com saldo abaixo do estoque mínimo. Aceita o setor (cozinha ou bar).",
    permissao: "estoque.overview.view",
    parametros: {
      type: "object",
      properties: { setor: { type: "string", enum: ["cozinha", "bar"], description: "Setor; omita para ver os dois." } },
      additionalProperties: false,
    },
    async executar({ cliente, unidadeId, args }) {
      let consulta = cliente.from("insumos")
        .select("nome, departamento, unidade_medida, estoque_minimo, estoque_atual (quantidade_atual)")
        .eq("unidade_id", unidadeId);
      if (args?.setor === "cozinha" || args?.setor === "bar") consulta = consulta.eq("departamento", args.setor);
      const dados = await linhas(consulta.limit(300));
      const criticos = dados
        .map((i) => ({
          nome: texto(i.nome),
          setor: texto(i.departamento),
          unidade: texto(i.unidade_medida),
          saldo: num(i.estoque_atual?.[0]?.quantidade_atual ?? i.estoque_atual?.quantidade_atual),
          minimo: num(i.estoque_minimo),
        }))
        .filter((i) => i.minimo > 0 && i.saldo < i.minimo)
        .sort((a, b) => a.saldo / (a.minimo || 1) - b.saldo / (b.minimo || 1));
      return { total: criticos.length, itens: criticos.slice(0, LIMITE) };
    },
  },

  {
    id: "consultar_estoque_produto",
    titulo: "Saldo de um produto",
    descricao: "Saldo atual de um insumo/produto pelo nome (busca parcial).",
    permissao: "estoque.overview.view",
    parametros: {
      type: "object",
      properties: { nome: { type: "string", description: "Nome ou parte do nome do produto." } },
      required: ["nome"],
      additionalProperties: false,
    },
    async executar({ cliente, unidadeId, args }) {
      const alvo = texto(args?.nome);
      if (!alvo) return { encontrado: false, motivo: "Nome do produto não informado." };
      const dados = await linhas(
        cliente.from("insumos")
          .select("nome, departamento, unidade_medida, estoque_minimo, estoque_atual (quantidade_atual)")
          .eq("unidade_id", unidadeId)
          .ilike("nome", `%${alvo}%`)
          .limit(LIMITE)
      );
      if (!dados.length) return { encontrado: false, procurado: alvo };
      return {
        encontrado: true,
        itens: dados.map((i) => ({
          nome: texto(i.nome),
          setor: texto(i.departamento),
          saldo: num(i.estoque_atual?.[0]?.quantidade_atual ?? i.estoque_atual?.quantidade_atual),
          unidade: texto(i.unidade_medida),
          minimo: num(i.estoque_minimo),
        })),
      };
    },
  },

  {
    id: "producao_do_dia",
    titulo: "Produção do dia",
    descricao: "O que a cozinha/bar registrou de produção hoje nesta unidade.",
    permissao: "cozinha.production.view",
    parametros: { type: "object", properties: {}, additionalProperties: false },
    async executar({ cliente, unidadeId }) {
      const dados = await linhas(
        cliente.from("producao_diaria")
          .select("quantidade, created_at, fichas_tecnicas (nome_receita, rendimento_unidade, departamento), colaboradores (nome)")
          .eq("unidade_id", unidadeId)
          .gte("created_at", inicioDoDiaISO())
          .limit(LIMITE)
      );
      return {
        total: dados.length,
        producoes: dados.map((p) => ({
          receita: texto(p.fichas_tecnicas?.nome_receita) || "(ficha removida)",
          quantidade: num(p.quantidade),
          unidade: texto(p.fichas_tecnicas?.rendimento_unidade),
          setor: texto(p.fichas_tecnicas?.departamento),
          responsavel: texto(p.colaboradores?.nome),
        })),
      };
    },
  },

  {
    id: "equipe_trabalhando",
    titulo: "Equipe trabalhando agora",
    descricao: "Quem bateu entrada hoje e ainda não bateu saída nesta unidade.",
    permissao: "rh.overview.view",
    parametros: { type: "object", properties: {}, additionalProperties: false },
    async executar({ cliente, unidadeId }) {
      const dados = await linhas(
        cliente.from("registro_ponto")
          .select("colaborador_id, entrada, saida, data_referencia, colaboradores (nome, cargo)")
          .eq("unidade_id", unidadeId)
          .eq("data_referencia", hojeISO())
          .limit(200)
      );
      const trabalhando = dados.filter((r) => r.entrada && !r.saida);
      return {
        total: trabalhando.length,
        pessoas: trabalhando.slice(0, LIMITE).map((r) => ({
          nome: texto(r.colaboradores?.nome) || "(sem cadastro)",
          cargo: texto(r.colaboradores?.cargo),
          entrada: texto(r.entrada),
        })),
      };
    },
  },

  {
    id: "pendencias_de_ponto",
    titulo: "Pendências de ponto",
    descricao: "Registros de ponto de hoje sem saída batida (jornada aberta).",
    permissao: "ponto.clock.view",
    parametros: { type: "object", properties: {}, additionalProperties: false },
    async executar({ cliente, unidadeId }) {
      const dados = await linhas(
        cliente.from("registro_ponto")
          .select("entrada, saida, data_referencia, colaboradores (nome)")
          .eq("unidade_id", unidadeId)
          .eq("data_referencia", hojeISO())
          .limit(200)
      );
      const abertas = dados.filter((r) => r.entrada && !r.saida);
      return {
        total: abertas.length,
        pendencias: abertas.slice(0, LIMITE).map((r) => ({
          nome: texto(r.colaboradores?.nome) || "(sem cadastro)",
          entrada: texto(r.entrada),
          data: texto(r.data_referencia),
        })),
      };
    },
  },

  {
    id: "contas_vencidas",
    titulo: "Contas vencidas",
    descricao: "Contas a pagar vencidas e ainda em aberto nesta unidade.",
    permissao: "financeiro.cashflow.view",
    parametros: { type: "object", properties: {}, additionalProperties: false },
    async executar({ cliente, unidadeId }) {
      const dados = await linhas(
        cliente.from("contas_pagar")
          .select("descricao, valor, data_vencimento, status, fornecedor")
          .eq("unidade_id", unidadeId)
          .lt("data_vencimento", hojeISO())
          .order("data_vencimento", { ascending: true })
          .limit(100)
      );
      const abertas = dados.filter((c) => texto(c.status) !== "pago");
      return {
        total: abertas.length,
        valor_total: brl(abertas.reduce((s, c) => s + num(c.valor), 0)),
        contas: abertas.slice(0, LIMITE).map((c) => ({
          descricao: texto(c.descricao) || texto(c.fornecedor) || "(sem descrição)",
          valor: brl(c.valor),
          vencimento: texto(c.data_vencimento),
        })),
      };
    },
  },

  {
    id: "cmv_das_fichas",
    titulo: "CMV por prato",
    descricao: "Custo dos ingredientes de cada prato e o CMV em % sobre o preço de venda do cardápio. Use para 'qual o CMV', 'quanto custa essa receita', 'qual prato está com CMV alto'.",
    permissao: "financeiro.cmv.view",
    parametros: {
      type: "object",
      properties: { receita: { type: "string", description: "Nome (ou parte) de uma receita específica; omita para ver as piores." } },
      additionalProperties: false,
    },
    async executar({ cliente, unidadeId, args }) {
      const fichas = await linhas(
        cliente.from("fichas_tecnicas")
          .select("id, nome_receita, departamento, eh_base, rendimento_porcoes, rendimento_unidade, peso_porcao_g, preco_venda, cmv_meta, fichas_ingredientes (insumo_id, subficha_id, quantidade, fator_correcao, insumos (nome, unidade_medida, custo_unitario))")
          .eq("unidade_id", unidadeId)
          .limit(300)
      );
      const produtos = await linhas(
        cliente.from("produtos").select("ficha_id, nome_produto, preco_venda").eq("unidade_id", unidadeId).limit(300)
      );
      const alvo = texto(args?.receita).toLowerCase();
      const escolhidas = fichas.filter((f) => !f.eh_base && (!alvo || texto(f.nome_receita).toLowerCase().includes(alvo)));
      if (!escolhidas.length) return { encontrado: false, procurado: alvo || null };

      const calculadas = escolhidas.map((f) => {
        const custo = custoDeProduzirFicha(f, fichas);
        const produto = produtos.find((p) => p.ficha_id === f.id);
        const preco = num(produto?.preco_venda) || num(f.preco_venda);
        const cmv = preco > 0 ? (custo / preco) * 100 : null;
        return {
          receita: texto(f.nome_receita),
          setor: texto(f.departamento),
          custo_ingredientes: brl(custo),
          preco_venda: preco > 0 ? brl(preco) : null,
          cmv_percentual: cmv === null ? null : Number(cmv.toFixed(1)),
          meta_cmv: num(f.cmv_meta) || null,
        };
      });
      const comCmv = calculadas.filter((c) => c.cmv_percentual !== null).sort((a, b) => b.cmv_percentual - a.cmv_percentual);
      return {
        encontrado: true,
        observacao: "Custo só dos ingredientes; embalagem, imposto e taxa de cartão não entram nesta conta.",
        fichas_sem_preco: calculadas.filter((c) => c.preco_venda === null).length,
        receitas: (alvo ? calculadas : comCmv).slice(0, LIMITE),
      };
    },
  },

  {
    id: "resultado_financeiro",
    titulo: "Resultado do período",
    descricao: "Entradas, saídas e resultado do fluxo de caixa da unidade no período (padrão: mês atual).",
    permissao: "financeiro.dre.view",
    parametros: {
      type: "object",
      properties: {
        de: { type: "string", description: "Data inicial AAAA-MM-DD. Padrão: primeiro dia do mês atual." },
        ate: { type: "string", description: "Data final AAAA-MM-DD. Padrão: hoje." },
      },
      additionalProperties: false,
    },
    async executar({ cliente, unidadeId, args }) {
      const hoje = hojeISO();
      const de = /^\d{4}-\d{2}-\d{2}$/.test(texto(args?.de)) ? texto(args.de) : `${hoje.slice(0, 7)}-01`;
      const ate = /^\d{4}-\d{2}-\d{2}$/.test(texto(args?.ate)) ? texto(args.ate) : hoje;
      const dados = await linhas(
        cliente.from("lancamentos")
          .select("tipo, valor, categoria, data")
          .eq("unidade_id", unidadeId)
          .gte("data", de)
          .lte("data", ate)
          .limit(2000)
      );
      if (!dados.length) return { encontrado: false, periodo: { de, ate } };
      const entradas = dados.filter((l) => texto(l.tipo) === "entrada").reduce((s, l) => s + num(l.valor), 0);
      const saidas = dados.filter((l) => texto(l.tipo) === "saida").reduce((s, l) => s + num(l.valor), 0);
      const porCategoria = {};
      for (const l of dados) {
        if (texto(l.tipo) !== "saida") continue;
        const c = texto(l.categoria) || "(sem categoria)";
        porCategoria[c] = (porCategoria[c] || 0) + num(l.valor);
      }
      return {
        encontrado: true,
        periodo: { de, ate },
        entradas: brl(entradas),
        saidas: brl(saidas),
        resultado: brl(entradas - saidas),
        maiores_despesas: Object.entries(porCategoria)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([categoria, valor]) => ({ categoria, valor: brl(valor) })),
        observacao: "Fluxo de caixa dos lançamentos do período, não o DRE fechado.",
      };
    },
  },

  {
    id: "navegar_para",
    titulo: "Abrir uma tela",
    descricao: "Devolve a rota da tela pedida para o app abrir. Não consulta dado nenhum.",
    permissao: null,
    parametros: {
      type: "object",
      properties: {
        modulo: {
          type: "string",
          enum: ["painel", "estoque", "fichas", "producao", "compras", "financeiro", "rh", "ponto", "etiquetas", "relatorios"],
        },
        setor: { type: "string", enum: ["cozinha", "bar"], description: "Só para estoque, fichas e produção." },
      },
      required: ["modulo"],
      additionalProperties: false,
    },
    async executar({ args }) {
      const setor = args?.setor === "bar" ? "bar" : "cozinha";
      const rotas = {
        painel: "/dashboard",
        estoque: `/dashboard/operacao/estoque?dept=${setor}`,
        fichas: `/dashboard/operacao/fichas?dept=${setor}`,
        producao: "/dashboard/operacao/producao",
        compras: "/dashboard/operacao/compras",
        financeiro: "/dashboard/financeiro",
        rh: "/dashboard/rh",
        ponto: "/dashboard/rh/ponto",
        etiquetas: "/dashboard/operacao/etiquetas",
        relatorios: "/dashboard/relatorios",
      };
      const rota = rotas[texto(args?.modulo)] || null;
      return rota ? { rota } : { rota: null, motivo: "Módulo não reconhecido." };
    },
  },
];

export const FERRAMENTA_POR_ID = new Map(FERRAMENTAS.map((f) => [f.id, f]));

/** Sessão sem contexto do servidor não é ninguém: só sobra navegar. */
function sessaoConfiavel(sessao) {
  return !!(sessao && sessao.gerenciado);
}

/** As ferramentas que ESTA sessão pode usar. É esta lista que vai ao modelo. */
export function ferramentasPermitidas(sessao) {
  return FERRAMENTAS.filter((f) => {
    if (!f.permissao) return true;
    if (!sessaoConfiavel(sessao)) return false;
    return hasPermission(sessao, f.permissao);
  });
}

/** Formato de tool que a Responses API entende. */
export function ferramentasParaOModelo(sessao) {
  return ferramentasPermitidas(sessao).map((f) => ({
    type: "function",
    name: f.id,
    description: f.descricao,
    parameters: f.parametros,
  }));
}

/**
 * Executa uma ferramenta pedida pelo modelo.
 * A permissão é conferida AQUI de novo: o que o modelo pediu é sugestão, não
 * autorização. Ferramenta desconhecida ou sem permissão não roda.
 */
export async function executarFerramenta({ id, args = {}, sessao, unidadeId, cliente }) {
  const ferramenta = FERRAMENTA_POR_ID.get(texto(id));
  if (!ferramenta) {
    return { ok: false, motivo: "ferramenta_desconhecida", mensagem: `Não existe a ferramenta "${texto(id)}".` };
  }
  if (ferramenta.permissao && (!sessaoConfiavel(sessao) || !hasPermission(sessao, ferramenta.permissao))) {
    return { ok: false, motivo: "sem_permissao", mensagem: `Seu acesso não inclui ${ferramenta.titulo.toLowerCase()}.` };
  }
  if (ferramenta.permissao && !texto(unidadeId)) {
    return { ok: false, motivo: "sem_unidade", mensagem: "Nenhuma unidade ativa para consultar." };
  }
  try {
    const dados = await ferramenta.executar({ cliente, unidadeId, args: args || {} });
    return { ok: true, id: ferramenta.id, titulo: ferramenta.titulo, dados };
  } catch (e) {
    return { ok: false, motivo: "falha_na_consulta", mensagem: String(e?.message || e) };
  }
}
