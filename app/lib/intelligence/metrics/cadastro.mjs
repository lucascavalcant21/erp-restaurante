// O QUE A PERGUNTA CITA DO CADASTRO — para o agente geral do Assistente
// ("o que dá pra servir com o vatapá?", "tenho como fazer moqueca hoje?").
// Procura, entre as fichas e os produtos DESTA unidade, os nomes que aparecem
// na frase. Só procura onde a pessoa tem permissão; nada vai para fora daqui
// além do nome e do setor (custo e preço ficam de fora).

import { ler } from "../context/db-escopado.mjs";
import { candidatosDoTermo } from "./produtos.mjs";
import { agruparHabituais } from "../../etiquetas-pedido.mjs";
import { somarDias } from "../core/periodos.mjs";

const LIMITE = 6;

/**
 * @returns {Promise<{ fichas: {id,nome,departamento,base}[], produtos: {id,nome,unidade}[] }>}
 */
export async function itensCitados(amb, { frase }) {
  const texto = String(frase || "").slice(0, 500);
  const out = { fichas: [], produtos: [] };
  if (!texto.trim()) return out;
  if (await amb.verificador.pode("fichas")) {
    const fichas = ((await ler(amb.dbe.from("fichas_tecnicas").select("id, nome_receita, nome_comercial, nome_interno, departamento, eh_base, ativo, status"), "fichas_tecnicas")) || [])
      .filter((f) => f.ativo !== false && f.status !== "arquivada")
      .map((f) => ({ ...f, nome: String(f.nome_receita || f.nome_comercial || "").trim(), nome_interno: f.nome_interno || f.nome_comercial }));
    out.fichas = candidatosDoTermo(fichas, texto, LIMITE, { frase: texto, parcial: true })
      .map((f) => ({ id: f.id, nome: f.nome, departamento: f.departamento || null, base: !!f.eh_base }));
  }
  if (await amb.verificador.pode("saldo_estoque")) {
    const insumos = (await ler(amb.dbe.from("insumos").select("id, nome, nome_interno, unidade_medida").order("nome"), "insumos")) || [];
    out.produtos = candidatosDoTermo(insumos, texto, LIMITE, { frase: texto, parcial: true })
      .map((i) => ({ id: i.id, nome: String(i.nome || "").trim(), unidade: i.unidade_medida || null }));
  }
  return out;
}

/**
 * Nomes que a tela de Etiquetas lista nesta unidade: produtos do cadastro
 * (estoque) e pré-preparos (fichas base). Só onde há permissão; só nome e
 * origem. Serve para casar "20 etiquetas de maniçoba" com o nome certo.
 * @returns {Promise<{ itens: {nome:string, origem:string}[], semPermissao: boolean }>}
 */
export async function catalogoDeEtiquetas(amb) {
  const itens = [];
  let algum = false;
  if (await amb.verificador.pode("saldo_estoque")) {
    algum = true;
    const insumos = (await ler(amb.dbe.from("insumos").select("id, nome").order("nome"), "insumos")) || [];
    for (const i of insumos) if (String(i.nome || "").trim()) itens.push({ nome: String(i.nome).trim(), origem: "Ingrediente" });
  }
  if (await amb.verificador.pode("fichas")) {
    algum = true;
    const fichas = (await ler(amb.dbe.from("fichas_tecnicas").select("id, nome_receita, eh_base, ativo, status").eq("eh_base", true), "fichas_tecnicas")) || [];
    for (const f of fichas) if (f.ativo !== false && f.status !== "arquivada" && String(f.nome_receita || "").trim()) itens.push({ nome: String(f.nome_receita).trim(), origem: "Pré-preparo" });
  }
  return { itens, semPermissao: !algum };
}

export const DIAS_HABITUAIS = 60;

/**
 * As etiquetas que esta unidade mais imprimiu nos últimos 60 dias: nome,
 * quantas costuma pedir e a validade mais usada (REAL, do histórico).
 * Sem permissão de validades/etiquetas: lista vazia.
 */
export async function etiquetasHabituais(amb, { limite = 15 } = {}) {
  if (!(await amb.verificador.pode("validade"))) return { itens: [], semPermissao: true };
  const desde = somarDias(amb.hoje, -DIAS_HABITUAIS);
  const linhas = (await ler(amb.dbe.from("etiquetas").select("produto, copias, validade_dias, created_at").gte("created_at", `${desde}T00:00:00Z`).order("created_at", { ascending: false }).limit(3000), "etiquetas")) || [];
  return { itens: agruparHabituais(linhas, limite), semPermissao: false, dias: DIAS_HABITUAIS };
}
