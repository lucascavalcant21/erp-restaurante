// "O Jhon também analisa cardápios de delivery e monta o que vem em cada um e
// o valor para comparar com os nossos, incluindo os adicionais ofertados" — e
// "ficam salvos em um banco de dados" (dono, 17/11/2026).
//
//   marmitaria.concorrente_ler  → explica como mandar os prints (a leitura em si
//                                  é a ação competitor.menu, que guarda no banco)
//   marmitaria.concorrentes     → compara o último cardápio guardado de cada
//                                  concorrente com as nossas marmitas e adicionais
//
// Só leitura. Os preços deles são REAL (lidos do print, com a data em que foram
// vistos); os nossos vêm do preço por app cadastrado na marmitaria e dos
// adicionais do cardápio digital. Sem dado: DADOS INSUFICIENTES.

import { NIVEL } from "../core/niveis.mjs";
import { ler } from "../context/db-escopado.mjs";
import { carregarDadosDaMarmitaria } from "./marmitaria-agente.mjs";
import { canalDaPergunta, precoNoCanal } from "../../marmitaria/raio-x.mjs";
import {
  MAX_PRINTS, compararComNossas, linhasDaComparacao, linhasDosAdicionais, nossosAdicionaisDaConfig, rotuloPlataforma, textoDaComparacao,
} from "../../marmitaria/concorrentes.mjs";

const ROTA = "/dashboard/marmitaria/concorrentes";
const MAX_COMPARADOS = 3;
const r = (texto, blocos = [], acoes = [], natureza = "REAL") => ({ texto, blocos, acoes, natureza, nivel: NIVEL.OBSERVAR, agentes: ["operacoes"] });
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tentar = async (p) => { try { return await p; } catch (e) { if (e?.name === "ErroDeIsolamento") throw e; return null; } };

export const TEXTO_COMO_MANDAR = `Mande os prints do cardápio do concorrente (até ${MAX_PRINTS} de uma vez): toque no + ao lado do campo de mensagem, escolha "Cardápio de concorrente" e selecione as imagens. Pegue o nome do restaurante, os pratos com a descrição e o preço, e a tela dos adicionais. Eu leio o que vem em cada prato, o peso, o preço e os adicionais, te mostro para conferir e guardo com a data de hoje.`;

/** Concorrente citado na frase ("compare com a Marmitaria da Ana"): o que mais casa pelo nome. */
export function concorrenteDaFrase(concorrentes, texto) {
  const f = fold(texto);
  const notas = concorrentes.map((c) => {
    const tokens = fold(c.nome).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !["marmitaria", "restaurante", "cozinha", "delivery", "marmitas", "comida"].includes(t));
    const inteiro = fold(c.nome).length >= 3 && f.includes(fold(c.nome));
    return { c, nota: inteiro ? 100 : tokens.filter((t) => f.includes(t)).length };
  }).filter((x) => x.nota > 0).sort((a, b) => b.nota - a.nota);
  if (!notas.length || (notas[1] && notas[1].nota === notas[0].nota)) return null;
  return notas[0].c;
}

// peso servido da marmita: peso_final_g (ficha) ou peso_porcao_g (o que o raio-x carrega; na marmita é o mesmo valor)
const pesoDaMarmita = (m) => [m.peso_final_g, m.peso_porcao_g].map(Number).find((v) => v > 0) || null;

/** Nossas marmitas no formato da comparação, com o preço do app em que o concorrente está. */
export function nossasParaComparar(d, plataforma) {
  const rotulo = plataforma ? rotuloPlataforma(plataforma) : "";
  return d.marmitas.map((m) => {
    const canal = canalDaPergunta(d.canais, `${rotulo} ${plataforma || ""}`, m);
    const casou = !!canal && !!plataforma && (fold(canal.nome).includes(fold(rotulo)) || fold(canal.id).includes(fold(plataforma)));
    const preco = casou ? Number(m.precos?.[canal.id]) || null : null;
    const componentes = (m.itens || []).map((it) => (it.subficha_id ? d.fichas.find((f) => f.id === it.subficha_id)?.nome_receita : d.insumos.get(it.insumo_id)?.nome)).filter(Boolean);
    return { id: m.id, nome: m.nome_receita || m.nome_comercial || "Marmita", preco, peso_g: pesoDaMarmita(m), componentes, canal: casou ? canal : null, precoBase: precoNoCanal(m, canal) || null };
  });
}

/** Último cardápio guardado de cada concorrente (mais recente primeiro). */
export async function ultimasLeituras(dbe, limite = 20) {
  const concorrentes = (await ler(dbe.from("delivery_concorrentes").select("id, nome, plataforma, bairro, segmento"), "delivery_concorrentes")) || [];
  if (!concorrentes.length) return { concorrentes, leituras: [] };
  const lidas = (await ler(dbe.from("delivery_concorrentes_leituras").select("id, concorrente_id, observado_em, created_at, taxa_entrega, pedido_minimo, tempo_entrega, avaliacao, qtd_itens").order("observado_em", { ascending: false }).order("created_at", { ascending: false }).limit(200), "delivery_concorrentes_leituras")) || [];
  const ultima = new Map();
  for (const l of lidas) if (!ultima.has(l.concorrente_id)) ultima.set(l.concorrente_id, l);
  const porId = new Map(concorrentes.map((c) => [c.id, c]));
  const leituras = [...ultima.values()].filter((l) => porId.has(l.concorrente_id)).slice(0, limite).map((l) => ({ ...l, concorrente: porId.get(l.concorrente_id) }));
  return { concorrentes, leituras };
}

export async function itensDaLeitura(dbe, leituraId) {
  return (await ler(dbe.from("delivery_concorrentes_itens").select("tipo, categoria, grupo, nome, descricao, componentes, peso_g, serve_pessoas, preco, preco_original, ordem").eq("leitura_id", leituraId).order("ordem"), "delivery_concorrentes_itens")) || [];
}

export const HANDLERS_CONCORRENTES = {
  // "Jhon, vou te mandar o cardápio de um concorrente"
  async "marmitaria.concorrente_ler"({ motor }) {
    if (!(await motor.ambiente.verificador.pode("concorrentes_gravar"))) {
      return r("Você não tem permissão para guardar cardápio de concorrente nesta unidade.");
    }
    return { ...r(TEXTO_COMO_MANDAR, [], [{ rotulo: "Abrir concorrentes", rota: ROTA }]), sugestoes: ["Compare os concorrentes com as nossas marmitas"] };
  },

  // "Compare o cardápio da X com as nossas marmitas", "os adicionais deles × os nossos"
  async "marmitaria.concorrentes"({ motor, params }) {
    const amb = motor.ambiente;
    if (!(await amb.verificador.pode("concorrentes_ver"))) return r("Você não tem acesso aos cardápios dos concorrentes desta unidade.");
    const texto = params.texto || "";
    let base;
    try {
      base = await ultimasLeituras(amb.dbe);
    } catch (e) {
      if (e?.ausente) return r("DADOS INSUFICIENTES: este banco ainda não tem a parte de concorrentes do delivery (migração CONC-1).");
      throw e;
    }
    if (!base.leituras.length) {
      return { ...r(`DADOS INSUFICIENTES: ainda não há cardápio de concorrente guardado nesta unidade. ${TEXTO_COMO_MANDAR}`), sugestoes: [] };
    }
    const citado = concorrenteDaFrase(base.concorrentes, texto);
    const alvo = citado ? base.leituras.filter((l) => l.concorrente_id === citado.id) : base.leituras.slice(0, MAX_COMPARADOS);
    if (citado && !alvo.length) return r(`DADOS INSUFICIENTES: a ${citado.nome} está cadastrada, mas sem cardápio lido.`);

    const d = await carregarDadosDaMarmitaria(amb.dbe, amb.hoje);
    const cfg = await tentar(ler(amb.dbe.from("config_sistema").select("params").limit(1), "config_sistema"));
    const nossosAdicionais = nossosAdicionaisDaConfig(cfg?.[0]?.params);

    const textos = [];
    const blocos = [];
    for (const l of alvo) {
      const itens = await itensDaLeitura(amb.dbe, l.id);
      const leitura = { concorrente: l.concorrente.nome, plataforma: l.concorrente.plataforma, observado_em: l.observado_em, itens: itens.map((i) => ({ ...i, preco: Number(i.preco), peso_g: i.peso_g != null ? Number(i.peso_g) : null })) };
      const nossas = nossasParaComparar(d, l.concorrente.plataforma);
      const cmp = compararComNossas({ nossas, nossosAdicionais, leitura });
      let t = textoDaComparacao(cmp);
      const semApp = nossas.length && nossas.every((n) => !n.canal);
      if (semApp) t += ` DADOS INSUFICIENTES do nosso preço no ${rotuloPlataforma(l.concorrente.plataforma)}: não há esse app em Custos e apps, então não comparo o valor.`;
      textos.push(t);
      const pratos = linhasDaComparacao(cmp);
      const adic = linhasDosAdicionais(cmp);
      if (pratos.length) blocos.push({ tipo: "lista", titulo: `Nossas marmitas × ${cmp.concorrente}`, itens: pratos });
      if (cmp.semPar.length) blocos.push({ tipo: "lista", titulo: `Pratos da ${cmp.concorrente} sem parecido aqui`, itens: cmp.semPar.slice(0, 10).map((i) => ({ rotulo: i.nome, detalhe: (i.componentes || []).slice(0, 5).join(", ") || undefined, valor: Number(i.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) })) });
      if (adic.length) blocos.push({ tipo: "lista", titulo: `Adicionais: ${cmp.concorrente}${cmp.adicionais ? " × nossos" : ""}`, itens: adic.slice(0, 20) });
    }
    const outros = !citado && base.leituras.length > alvo.length ? ` Comparei os ${alvo.length} cardápios lidos mais recentemente; peça pelo nome para ver outro.` : "";
    return {
      ...r(textos.join("\n\n") + outros, blocos, [{ rotulo: "Abrir concorrentes", rota: ROTA }]),
      sugestoes: [
        ...base.leituras.filter((l) => !alvo.includes(l)).slice(0, 2).map((l) => `Compare o cardápio da ${l.concorrente.nome} com as nossas marmitas`),
        "Vou mandar o cardápio de outro concorrente",
      ],
    };
  },
};
