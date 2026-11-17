// "Jhon, vamos montar uma unidade de delivery" (dono, 17/11/2026): montar o
// delivery do zero, tudo pelo Jhon. Ele confere o que já está pronto nesta
// unidade (apps, custos fixos, equipe, marmitas, vitrine) e puxa o próximo
// passo com um botão; cada passo é uma conversa com prévia e Confirmar
// (channel.register, fixedcost.register, employee.register, marmita.create,
// platform.screen). Só leitura aqui.

import { NIVEL } from "../core/niveis.mjs";
import { ler } from "../context/db-escopado.mjs";
import { CHAVE_PARAMS, normalizarOrganizador } from "../../marmitaria/organizador.mjs";

const tentar = async (p) => { try { return await p; } catch (e) { if (e?.name === "ErroDeIsolamento") throw e; return null; } };

export const PASSOS_DELIVERY = Object.freeze([
  { id: "apps", titulo: "Onde vende (apps ou balcão)", pedido: "Vamos cadastrar as plataformas" },
  { id: "custos", titulo: "Custos fixos do mês", pedido: "Vamos cadastrar os custos fixos" },
  { id: "equipe", titulo: "Equipe", pedido: "Vamos cadastrar funcionários" },
  { id: "marmitas", titulo: "Marmitas (componentes, embalagem, preço por app)", pedido: "Vamos montar umas marmitas" },
  { id: "vitrine", titulo: "Vitrine de cada app (Organizador de plataforma)", pedido: "Vamos organizar a nossa tela" },
]);

/** O que já está feito em cada passo, só com o que existe no banco. */
export async function situacaoDoDelivery(dbe) {
  const cfg = (await tentar(ler(dbe.from("marmitaria_configuracoes").select("canais, rateio").limit(1), "marmitaria_configuracoes")))?.[0] || {};
  const canais = (Array.isArray(cfg.canais) ? cfg.canais : []).filter((c) => c && c.ativo !== false);
  const fixos = (Array.isArray(cfg.rateio?.custos_fixos) ? cfg.rateio.custos_fixos : []).filter((c) => Number(c?.valor) > 0);
  const equipe = ((await tentar(ler(dbe.from("marmitaria_rh_alocacoes").select("colaborador_id, ativo").limit(500), "marmitaria_rh_alocacoes"))) || []).filter((a) => a.ativo !== false);
  const marmitas = ((await tentar(ler(dbe.from("fichas_tecnicas").select("id, departamento, ativo, eh_base").eq("departamento", "marmitaria").limit(500), "fichas_tecnicas"))) || []).filter((f) => f.ativo !== false && !f.eh_base);
  const params = (await tentar(ler(dbe.from("config_sistema").select("params").limit(1), "config_sistema")))?.[0]?.params;
  const org = normalizarOrganizador(params?.[CHAVE_PARAMS]);
  const itensVitrine = Object.values(org.plataformas).reduce((t, v) => t + v.categorias.reduce((x, c) => x + c.itens.length, 0), 0);
  return {
    apps: { feito: canais.length > 0, detalhe: canais.length ? canais.map((c) => c.nome).join(", ") : "nenhum" },
    custos: { feito: fixos.length > 0, detalhe: fixos.length ? `${fixos.length} ${fixos.length === 1 ? "custo" : "custos"}` : "nenhum" },
    equipe: { feito: equipe.length > 0, detalhe: equipe.length ? `${equipe.length} ${equipe.length === 1 ? "pessoa" : "pessoas"}` : "ninguém" },
    marmitas: { feito: marmitas.length > 0, detalhe: marmitas.length ? `${marmitas.length} ${marmitas.length === 1 ? "marmita" : "marmitas"}` : "nenhuma" },
    vitrine: { feito: itensVitrine > 0, detalhe: itensVitrine ? `${itensVitrine} ${itensVitrine === 1 ? "item" : "itens"}` : "vazia" },
  };
}

export const HANDLERS_MONTAR_DELIVERY = {
  async "delivery.montar"({ motor }) {
    const amb = motor.ambiente;
    if (!(await amb.verificador.pode("configurar_delivery"))) return { texto: "Para montar o delivery você precisa de acesso às configurações do delivery desta unidade.", blocos: [], acoes: [], natureza: "REAL", nivel: NIVEL.OBSERVAR, agentes: ["operacoes"] };
    const sit = await situacaoDoDelivery(amb.dbe);
    const proximo = PASSOS_DELIVERY.find((p) => !sit[p.id].feito);
    const itens = PASSOS_DELIVERY.map((p, i) => ({ rotulo: `${i + 1}. ${p.titulo}`, valor: `${sit[p.id].feito ? "pronto" : "falta"} · ${sit[p.id].detalhe}` }));
    let texto;
    let sugestoes;
    if (!proximo) {
      texto = "O delivery desta unidade já tem tudo: apps, custos fixos, equipe, marmitas e vitrine. Quer montar mais marmitas ou ajustar alguma coisa?";
      sugestoes = ["Vamos montar umas marmitas", "Faltou um custo fixo", "Qual app dá mais lucro?"];
    } else if (proximo.id === "apps") {
      texto = "Vamos montar o delivery desta unidade, passo a passo, tudo por aqui. (Para uma unidade nova, crie em Configurações › Negócios e troque para ela no topo.) Primeiro: vai vender por plataforma de delivery (iFood, 99Food, Keeta…) ou no balcão?";
      sugestoes = ["É plataforma de delivery: vamos cadastrar as plataformas", "É balcão: cadastrar o balcão como plataforma sem taxa"];
    } else {
      const feitos = PASSOS_DELIVERY.filter((p) => sit[p.id].feito).map((p) => p.titulo.toLowerCase().split(" (")[0]);
      texto = `Vamos continuar montando o delivery. Já está pronto: ${feitos.join(", ")}. Próximo passo: ${proximo.titulo.toLowerCase()}.`;
      sugestoes = [proximo.pedido, ...PASSOS_DELIVERY.filter((p) => p !== proximo && !sit[p.id].feito).map((p) => p.pedido)].slice(0, 4);
    }
    return { texto, blocos: [{ tipo: "lista", titulo: "Montagem do delivery", itens }], acoes: [{ rotulo: "Abrir o delivery", rota: "/dashboard/marmitaria" }], natureza: "REAL", nivel: NIVEL.OBSERVAR, agentes: ["operacoes"], sugestoes };
  },
};
