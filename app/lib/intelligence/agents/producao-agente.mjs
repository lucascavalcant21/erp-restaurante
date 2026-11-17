// Produção do dia pelo Jhon (HDEV-015, dono 17/11/2026).
//   - carregarProducao: fichas, insumos, saldo e espelho da marmitaria, lidos
//     pelo banco escopado da unidade (a conta e o plano usam o mesmo dado);
//   - "marmitaria.estoque_pronto": "quanto tenho de frango empanado no estoque…
//     se eu vender, quanto ganho? e molho? e batata porcionada?" (só leitura).
// O plano em si é a ação production.plan (prévia e confirmação).

import { NIVEL } from "../core/niveis.mjs";
import { ler } from "../context/db-escopado.mjs";
import { carregarDadosDaMarmitaria } from "./marmitaria-agente.mjs";
import { custoDaMarmita, fatorSaldo } from "../../marmitaria/nucleo.mjs";
import { SLUGS_MARMITARIA, ESTOQUE_LIMPEZA } from "../../marmitaria/cozinha.mjs";
import { canalDaPergunta, raioXDaMarmita } from "../../marmitaria/raio-x.mjs";
import { estoqueDasCoisas, lucroDoPronto } from "../../marmitaria/planejamento.mjs";

const r = (texto, blocos = [], acoes = [], natureza = "REAL") => ({ texto, blocos, acoes, natureza, nivel: NIVEL.OBSERVAR, agentes: ["operacoes"] });
const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (v, c = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: c });
const ROTA_ESTOQUE = "/dashboard/marmitaria/estoque";

/** O que a conta da produção e o estoque precisam, na unidade da sessão. */
export async function carregarProducao(dbe, hoje) {
  const d = await carregarDadosDaMarmitaria(dbe, hoje);
  const [estoques, todosInsumos] = await Promise.all([
    ler(dbe.from("estoques").select("id, slug, nome, status"), "estoques"),
    ler(dbe.from("insumos").select("id, nome, unidade_medida, ficha_tecnica_id, departamento, categoria, tamanho_embalagem, custo_unitario").limit(3000), "insumos"),
  ]);
  const locais = (estoques || []).filter((e) => SLUGS_MARMITARIA.includes(e.slug) && (e.status || "ativo") === "ativo");
  const itens = locais.length ? ((await ler(dbe.from("estoque_itens").select("estoque_id, insumo_id, quantidade_atual").in("estoque_id", locais.map((e) => e.id)), "estoque_itens")) || []) : [];
  // os ingredientes das fichas já vêm com custo; o resto do cadastro completa (pré-preparos, limpeza…)
  const insumos = new Map(d.insumos);
  for (const i of todosInsumos || []) if (!insumos.has(i.id)) insumos.set(i.id, i); else insumos.set(i.id, { ...i, ...insumos.get(i.id), ficha_tecnica_id: i.ficha_tecnica_id ?? insumos.get(i.id).ficha_tecnica_id });
  const espelho = new Map([...insumos.values()].filter((i) => i.ficha_tecnica_id).map((i) => [i.ficha_tecnica_id, i.id]));
  const saldo = new Map();
  for (const it of itens) {
    const ins = insumos.get(it.insumo_id);
    saldo.set(it.insumo_id, (saldo.get(it.insumo_id) || 0) + (Number(it.quantidade_atual) || 0) / fatorSaldo(ins));
  }
  return { ...d, insumos, espelho, saldo, locais, temEstoque: locais.length > 0, limpezaId: locais.find((e) => e.slug === ESTOQUE_LIMPEZA)?.id || null };
}

function raioXDe(d, texto) {
  return (marmita) => {
    const canal = canalDaPergunta(d.canais, texto, marmita);
    const custo = custoDaMarmita({ itens: marmita.itens, embalagens: marmita.embalagens, fichas: d.fichas, insumos: d.insumos });
    return raioXDaMarmita({ marmita, custo, canal, tributosPct: d.tributosPct, embutidos: d.embutidos, pessoasEquipe: d.pessoas });
  };
}

export const HANDLERS_PRODUCAO = {
  async "marmitaria.estoque_pronto"({ motor, params }) {
    const amb = motor.ambiente;
    if (!(await amb.verificador.pode("producao_marmitaria"))) return r("Você não tem acesso ao estoque da marmitaria nesta unidade.");
    const texto = params.texto || "";
    const d = await carregarProducao(amb.dbe, amb.hoje);
    if (!d.temEstoque) return r("DADOS INSUFICIENTES: esta unidade não tem o estoque da marmitaria. Abra Marmitaria > Estoque para criar os locais.", [], [{ rotulo: "Abrir estoque", rota: ROTA_ESTOQUE }]);
    const achados = estoqueDasCoisas({ texto, insumos: d.insumos, saldo: d.saldo, fichas: d.fichas });
    if (!achados.length) return r("DADOS INSUFICIENTES: não achei esse produto no cadastro da marmitaria. Diga o nome como está no estoque (ex.: \"frango empanado\", \"molho\", \"batata porcionada\").");
    const veLucro = await amb.verificador.pode("lucro_marmitaria");
    const rx = raioXDe(d, texto);
    const linhas = [];
    const blocos = [];
    let estimativa = false;
    for (const a of achados.slice(0, 8)) {
      const qtd = a.comSaldo ? `${num(a.quantidade)} ${a.unidade}`.trim() : "sem saldo lançado";
      let frase = `${a.nome}: ${qtd}.`;
      if (a.preparo && a.quantidade > 0 && veLucro) {
        const usos = lucroDoPronto({ fichaId: a.fichaId, quantidade: a.quantidade, marmitas: d.marmitas, raioX: rx });
        const u = usos[0];
        if (u && u.lucroTotal != null) {
          estimativa = true;
          frase += ` Dá ${num(u.possiveis, 0)} ${u.marmita}${u.canal ? ` no ${u.canal}` : ""}; vendendo tudo, lucro de ${brl(u.lucroTotal)} (${brl(u.lucroUnit)} cada, ESTIMATIVA).`;
          blocos.push({ tipo: "lista", titulo: `Se vender o ${a.nome.toLowerCase()} pronto`, itens: usos.slice(0, 5).map((x) => ({ rotulo: x.marmita, detalhe: `${num(x.porMarmita)} ${a.unidade} por marmita · ${num(x.possiveis, 0)} marmitas${x.canal ? ` · ${x.canal}` : ""}`, valor: x.lucroTotal != null ? brl(x.lucroTotal) : "sem preço" })) });
        } else if (u) {
          frase += ` Vai em ${u.marmita}, mas o lucro está sem dado: ${u.faltando.join(", ") || "falta preço"}.`;
        }
      }
      linhas.push(frase);
    }
    blocos.unshift({ tipo: "lista", titulo: "Estoque da marmitaria agora", itens: achados.slice(0, 12).map((a) => ({ rotulo: a.nome, detalhe: a.preparo ? "pronto (produzido aqui)" : undefined, valor: a.comSaldo ? `${num(a.quantidade)} ${a.unidade}`.trim() : "sem saldo" })) });
    return { ...r(linhas.join("\n"), blocos, [{ rotulo: "Abrir estoque", rota: ROTA_ESTOQUE }], estimativa ? "ESTIMATIVA" : "REAL"), sugestoes: ["Amanhã precisamos produzir 100 frangos empanados"] };
  },
};
