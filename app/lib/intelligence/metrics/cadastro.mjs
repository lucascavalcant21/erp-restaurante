// O QUE A PERGUNTA CITA DO CADASTRO — para o agente geral do Assistente
// ("o que dá pra servir com o vatapá?", "tenho como fazer moqueca hoje?").
// Procura, entre as fichas e os produtos DESTA unidade, os nomes que aparecem
// na frase. Só procura onde a pessoa tem permissão; nada vai para fora daqui
// além do nome e do setor (custo e preço ficam de fora).

import { ler } from "../context/db-escopado.mjs";
import { candidatosDoTermo } from "./produtos.mjs";

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
