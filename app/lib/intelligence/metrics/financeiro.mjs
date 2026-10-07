// CONTAS A PAGAR — fonte: vw_fin_contas_pagar (a mesma da tela Contas a
// Pagar). Conta aberta = pendente, parcial ou vencida; valor = SALDO em aberto.

import { metrica, CONFIANCA } from "../core/contratos.mjs";
import { somarDias, ddmm } from "../core/periodos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { medir, r2, soma, fonte } from "./base.mjs";

const ABERTAS = ["pendente", "parcial", "vencido"];

export function contasAPagar(amb, { dias = 7 } = {}) {
  const limite = somarDias(amb.hoje, dias);
  const periodo = { de: amb.hoje, ate: limite, rotulo: `vencidas e a vencer até ${ddmm(limite)}` };
  return medir(amb, { id: "contas_pagar", capacidade: "contas_pagar", periodo }, async (consultas) => {
    const contas = await ler(amb.dbe.from("vw_fin_contas_pagar")
      .select("id, descricao, fornecedor_id, saldo, valor_original, data_vencimento, situacao, vencida, categoria_codigo")
      .in("situacao", ABERTAS).lte("data_vencimento", limite).order("data_vencimento"), "vw_fin_contas_pagar") || [];
    const ids = [...new Set(contas.map((c) => c.fornecedor_id).filter(Boolean))];
    const fornecedores = ids.length ? new Map(((await ler(amb.dbe.from("fornecedores").select("id, nome").in("id", ids), "fornecedores")) || []).map((f) => [f.id, f.nome])) : new Map();
    const linha = (c) => ({
      id: c.id, descricao: c.descricao || "(sem descrição)", fornecedor: fornecedores.get(c.fornecedor_id) || null,
      vencimento: String(c.data_vencimento).slice(0, 10), saldo: r2(Number(c.saldo) || 0), situacao: c.situacao,
    });
    const vencidas = contas.filter((c) => c.vencida || c.situacao === "vencido").map(linha);
    const hoje = contas.filter((c) => !(c.vencida || c.situacao === "vencido") && String(c.data_vencimento).slice(0, 10) === amb.hoje).map(linha);
    const proximas = contas.filter((c) => !(c.vencida || c.situacao === "vencido") && String(c.data_vencimento).slice(0, 10) > amb.hoje).map(linha);
    const total = r2(soma([...vencidas, ...hoje, ...proximas], (c) => c.saldo));
    return metrica({
      metrica: "contas_pagar", valor: total, unidade: "BRL", periodo,
      fontes: [fonte("vw_fin_contas_pagar", "Contas a pagar em aberto (saldo)")], consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: amb.apuradoEm,
      observacoes: contas.length ? [] : ["Nenhuma conta em aberto vencida ou a vencer no período. Conta não lançada no Héfisto não aparece aqui."],
      detalhes: {
        vencidas: { qtd: vencidas.length, valor: r2(soma(vencidas, (c) => c.saldo)), lista: vencidas.slice(0, 10) },
        hoje: { qtd: hoje.length, valor: r2(soma(hoje, (c) => c.saldo)), lista: hoje.slice(0, 10) },
        proximas: { qtd: proximas.length, valor: r2(soma(proximas, (c) => c.saldo)), lista: proximas.slice(0, 10) },
      },
    });
  });
}
