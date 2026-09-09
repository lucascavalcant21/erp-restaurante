// ASSISTENTE DA RECEITA — interpretação de comandos e execução das respostas.
//
// Duas partes, de propósito separadas:
//
//   interpretar(texto)  → descobre a INTENÇÃO e os valores citados. Puro regex,
//                         sem rede: as frases do dia a dia da cozinha são poucas
//                         e previsíveis, então resposta é instantânea e de graça.
//                         Quando não reconhece, devolve null e a tela chama a IA,
//                         que faz só isto — classificar — e devolve o mesmo
//                         formato de intenção.
//
//   executar(intencao)  → calcula a resposta AQUI, com as funções de
//                         ficha-calculos.mjs.
//
// A IA nunca faz aritmética. Custo, CMV e preço saem de código testado, não de
// um modelo de linguagem: errar centavo em precificação de restaurante é caro e
// silencioso.

import {
  parseNumero, custoDeProduzirFicha, custoPorPorcao, custoTotalReceita,
  cmvPercentual, precoSugerido, margemBruta, custoUnitarioEfetivoInsumo,
  converterParaBaseDoInsumo, tipoDaFicha,
} from "./ficha-calculos.mjs";
import { unidadeNormalizada as unidadeBaseDoInsumo } from "./ingredientes-utils.mjs";

// ─── Leitura de números em português ────────────────────────────────────────

// "R$ 50,00", "50 reais", "1.234,56" → número.
export function lerValor(texto) {
  const m = String(texto || "").match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d+|\d+,\d+|\d+(?:\.\d+)?)/i);
  return m ? parseNumero(m[1]) : 0;
}

export function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const UNIDADES_TEXTO = "kg|quilos?|g|gramas?|l|litros?|ml|mililitros?|un|unidades?";

function unidadeCanonica(texto) {
  const u = normalizar(texto);
  if (/^(kg|quilos?)$/.test(u)) return "kg";
  if (/^(g|gramas?)$/.test(u)) return "g";
  if (/^(l|litros?)$/.test(u)) return "l";
  if (/^(ml|mililitros?)$/.test(u)) return "ml";
  return "un";
}

// ─── Interpretação ──────────────────────────────────────────────────────────

// Devolve { tipo, ...dados } ou null quando não reconhece a frase.
export function interpretar(texto) {
  const t = normalizar(texto);
  if (!t) return null;

  // "quanto custa essa receita hoje" / "qual o custo"
  if (/\b(quanto custa|qual (e |eh )?o custo|custo (atual|de hoje|hoje))\b/.test(t)) {
    return { tipo: "custo_atual" };
  }

  // "qual ingrediente mais pesa no custo" / "o que mais encarece"
  if (/\b(qual|quais).*(ingrediente|item).*(pesa|caro|encarece|custa mais)\b/.test(t)
      || /\b(mais pesa no custo|o que mais encarece|maior custo)\b/.test(t)) {
    return { tipo: "ingrediente_mais_caro" };
  }

  // "simule CMV de 30%" / "quero cmv 30"
  const mCmv = t.match(/\bcmv\b[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*%?/);
  if (mCmv && /\b(simul|quero|para|de|em)\b/.test(t)) {
    return { tipo: "simular_cmv", cmv: parseNumero(mCmv[1]) };
  }

  // "se a carne subir para R$ 50/kg quanto fica o custo"
  const mPreco = t.match(
    new RegExp(`\\bse (?:o |a |os |as )?(.+?)\\s+(?:subir|for|passar|custar|ficar|baixar|cair)\\s*(?:para|a|em|pra)?\\s*(?:r\\$\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(?:reais)?\\s*(?:\\/|por|o)?\\s*(${UNIDADES_TEXTO})?`)
  );
  if (mPreco) {
    return {
      tipo: "simular_preco_insumo",
      insumo: mPreco[1].trim(),
      preco: parseNumero(mPreco[2]),
      unidade: unidadeCanonica(mPreco[3] || "kg"),
    };
  }

  // "transforme esta receita para 20 porções"
  const mPorcoes = t.match(/\b(?:transform\w*|converta|ajust\w*|mud\w*|refaca|recalcul\w*)\b.*?\b(\d+(?:[.,]\d+)?)\s*(porcoes?|porcao|pessoas?|unidades?|kg|l|g|ml)\b/);
  if (mPorcoes) {
    return { tipo: "escalar", alvo: parseNumero(mPorcoes[1]), unidade: unidadeCanonica(mPorcoes[2]) };
  }

  // "quanto preciso produzir para 50 pessoas"
  const mPessoas = t.match(/\bquanto\b.*\b(?:produzir|fazer|preparar|render)\b.*?\b(\d+(?:[.,]\d+)?)\s*(pessoas?|porcoes?|convidados?)\b/);
  if (mPessoas) {
    return { tipo: "escalar", alvo: parseNumero(mPessoas[1]), unidade: "porcoes" };
  }

  // "reduza o custo da receita em 10%"
  const mReduz = t.match(/\b(?:reduz\w*|corte|diminu\w*|baix\w*)\b.*?\bcusto\b.*?(\d+(?:[.,]\d+)?)\s*%/);
  if (mReduz) {
    return { tipo: "reduzir_custo", pct: parseNumero(mReduz[1]) };
  }

  // "adicione 150 g de carne"
  const mAdd = t.match(
    new RegExp(`\\b(?:adicion\\w*|acrescent\\w*|inclu\\w*|coloc\\w*|pon\\w*)\\b\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIDADES_TEXTO})?\\s*(?:de\\s+)?(.+)`)
  );
  if (mAdd) {
    return {
      tipo: "adicionar_ingrediente",
      quantidade: parseNumero(mAdd[1]),
      unidade: unidadeCanonica(mAdd[2] || "g"),
      nome: mAdd[3].trim(),
    };
  }

  // "troque o queijo cheddar por queijo prato"
  const mTroca = t.match(/\b(?:troqu\w*|substitu\w*|trocar)\b\s*(?:o |a |os |as )?(.+?)\s+(?:por|pelo|pela)\s+(.+)/);
  if (mTroca) {
    return { tipo: "trocar_ingrediente", de: mTroca[1].trim(), para: mTroca[2].trim() };
  }

  return null;
}

// ─── Busca de ingrediente por nome ──────────────────────────────────────────

// Casamento tolerante: "carne" acha "Carne de sol", "queijo prato" acha
// "Queijo prato fatiado". Devolve o item da ficha, não o insumo do catálogo.
export function acharIngrediente(nome, ingredientes = []) {
  const alvo = normalizar(nome);
  if (!alvo) return null;
  const lista = ingredientes.map(i => ({ item: i, nome: normalizar(i.nome) }));

  const exato = lista.find(x => x.nome === alvo);
  if (exato) return exato.item;

  const comeca = lista.find(x => x.nome.startsWith(alvo));
  if (comeca) return comeca.item;

  const contem = lista.filter(x => x.nome.includes(alvo));
  if (contem.length === 1) return contem[0].item;
  if (contem.length > 1) {
    // Empate: fica com o nome mais curto, que costuma ser o mais genérico.
    return contem.sort((a, b) => a.nome.length - b.nome.length)[0].item;
  }

  // Última tentativa: alguma palavra do pedido bate com o começo do nome.
  const palavras = alvo.split(" ").filter(p => p.length > 3);
  const porPalavra = lista.find(x => palavras.some(p => x.nome.includes(p)));
  return porPalavra ? porPalavra.item : null;
}

// ─── Execução ───────────────────────────────────────────────────────────────

const brl = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;
const brlFino = (v) => {
  const n = Number(v) || 0;
  return `R$ ${n.toFixed(Math.abs(n) < 0.1 && n !== 0 ? 4 : 2).replace(".", ",")}`;
};
const pct = (v) => `${(Number(v) || 0).toFixed(1).replace(".", ",")}%`;

// Custo de cada linha da ficha, para ranquear e simular.
export function custosPorLinha(ficha, todasFichas = []) {
  return (ficha?.fichas_ingredientes || []).map((fi, i) => {
    const sub = fi.subficha_id ? todasFichas.find(f => f.id === fi.subficha_id) : null;
    return {
      indice: i,
      nome: fi.insumos?.nome || sub?.nome_receita || "Item removido",
      unidade: fi.insumos?.unidade_medida || sub?.rendimento_unidade || "",
      quantidade: parseNumero(fi.quantidade),
      subreceita: Boolean(sub),
      insumo: fi.insumos || null,
      custo: custoDeProduzirFicha({ id: `linha-${i}`, fichas_ingredientes: [fi] }, todasFichas),
    };
  });
}

// `contexto` = { ficha, todasFichas, custos } — `custos` é o resultado de
// custoTotalReceita já calculado pela tela, para os dois falarem o mesmo número.
export function executar(intencao, contexto = {}) {
  const { ficha, todasFichas = [], custos = {} } = contexto;
  if (!intencao || !ficha) return { texto: "Não entendi o pedido." };

  const linhas = custosPorLinha(ficha, todasFichas);
  const custoTotal = parseNumero(custos.custoTotal);
  const porcoes = Math.max(parseNumero(ficha.rendimento_porcoes), 0);
  const custoPorcao = custoPorPorcao(custoTotal, porcoes);
  const preco = parseNumero(ficha.preco_venda);
  const preparo = tipoDaFicha(ficha) === "preparo";
  const unidade = ficha.rendimento_unidade || "porção";

  switch (intencao.tipo) {
    case "custo_atual": {
      const partes = [`Hoje esta receita custa **${brl(custoTotal)}**.`];
      if (porcoes > 1) {
        partes.push(preparo
          ? `São ${porcoes} ${unidade} no lote, ${brlFino(custoPorcao)} por ${unidade}.`
          : `Rende ${porcoes} ${unidade}, ${brl(custoPorcao)} por porção.`);
      }
      if (!preparo && preco > 0) {
        partes.push(`Com preço de ${brl(preco)}, o CMV está em ${pct(cmvPercentual(custoPorcao, preco))} e a margem em ${brl(margemBruta(custoPorcao, preco))}.`);
      }
      return { texto: partes.join(" ") };
    }

    case "ingrediente_mais_caro": {
      if (!linhas.length) return { texto: "Esta ficha ainda não tem ingredientes." };
      const ordenadas = [...linhas].sort((a, b) => b.custo - a.custo);
      const top = ordenadas.slice(0, 3).filter(l => l.custo > 0);
      if (!top.length) return { texto: "Nenhum ingrediente tem custo cadastrado ainda." };
      const linhaTexto = top.map(l => {
        const share = custoTotal > 0 ? ` (${pct((l.custo / custoTotal) * 100)} do total)` : "";
        return `**${l.nome}** — ${brl(l.custo)}${share}`;
      });
      return {
        texto: `O que mais pesa é ${linhaTexto[0]}.` +
          (linhaTexto.length > 1 ? ` Depois vêm ${linhaTexto.slice(1).join(" e ")}.` : ""),
      };
    }

    case "simular_cmv": {
      if (preparo) return { texto: "Pré-preparo não é vendido, então não tem CMV. Ele entra no custo dos pratos que o usam." };
      const alvo = parseNumero(intencao.cmv);
      const sugerido = precoSugerido(custoPorcao, alvo);
      if (!sugerido) return { texto: `Não consegui simular: preciso do custo por porção e de um CMV entre 0% e 100%.` };
      const hoje = preco > 0 ? ` Hoje o preço é ${brl(preco)} (CMV de ${pct(cmvPercentual(custoPorcao, preco))}).` : "";
      return {
        texto: `Para fechar em ${pct(alvo)} de CMV com custo de ${brl(custoPorcao)} por porção, o preço precisa ser **${brl(sugerido)}**.${hoje}`,
        proposta: { campo: "preco_venda", valor: +sugerido.toFixed(2), rotulo: `Definir preço de venda em ${brl(sugerido)}` },
      };
    }

    case "simular_preco_insumo": {
      const alvo = acharIngrediente(intencao.insumo, linhas);
      if (!alvo) return { texto: `Não achei "${intencao.insumo}" nos ingredientes desta receita.` };
      if (alvo.subreceita) return { texto: `"${alvo.nome}" é uma subreceita. Para simular, altere o custo dentro da ficha dela.` };

      // Refaz o custo da ficha trocando SÓ o preço daquele insumo.
      //
      // A `unidade_medida` do insumo não pode ser tocada: a quantidade da
      // receita está expressa nela. Trocá-la fazia 150 gramas virarem 150
      // quilos e o hambúrguer custar R$ 7.503.
      //
      // O preço dito ("R$ 50/kg") é convertido para a unidade-base do insumo,
      // que é onde o custo mora.
      const unBase = unidadeBaseDoInsumo(alvo.insumo?.unidade_medida)
        || String(alvo.insumo?.unidade_medida || "un").toLowerCase();
      const umaUnidadeInformadaEmBase = converterParaBaseDoInsumo(1, intencao.unidade, unBase) || 1;
      const precoNaBase = parseNumero(intencao.preco) / umaUnidadeInformadaEmBase;
      const novoInsumo = { ...alvo.insumo, preco_normalizado: precoNaBase, custo_unitario: precoNaBase };
      const linhasSimuladas = (ficha.fichas_ingredientes || []).map((fi, i) =>
        i === alvo.indice ? { ...fi, insumos: novoInsumo } : fi
      );
      const novoDireto = custoDeProduzirFicha({ ...ficha, fichas_ingredientes: linhasSimuladas }, todasFichas);
      const novo = custoTotalReceita({
        custoIngredientes: novoDireto,
        custoEmbalagem: 0,
        indiretos: { tipo: ficha.custo_indireto_tipo || "percentual", valor: parseNumero(ficha.custo_indireto_valor) },
      });
      const novoPorcao = custoPorPorcao(novo.custoTotal, porcoes);
      const delta = novo.custoTotal - custoTotal;

      const partes = [
        `Com ${alvo.nome} a ${brl(intencao.preco)}/${intencao.unidade}, a receita passaria de ${brl(custoTotal)} para **${brl(novo.custoTotal)}**`,
        delta >= 0 ? `(${brl(delta)} a mais).` : `(${brl(Math.abs(delta))} a menos).`,
      ];
      if (!preparo && preco > 0) {
        partes.push(`O CMV iria de ${pct(cmvPercentual(custoPorcao, preco))} para ${pct(cmvPercentual(novoPorcao, preco))}.`);
      }
      return { texto: partes.join(" "), simulacao: true };
    }

    case "escalar": {
      if (porcoes <= 0) return { texto: "Preciso do rendimento da ficha para recalcular." };
      const alvo = parseNumero(intencao.alvo);
      if (alvo <= 0) return { texto: "Diga para quantas porções devo converter." };
      const fator = alvo / porcoes;
      const itens = linhas.map(l => {
        const q = l.quantidade * fator;
        const qTexto = q >= 100 ? Math.round(q) : +q.toFixed(2);
        return `• ${l.nome}: ${qTexto} ${l.unidade}`.trim();
      });
      return {
        texto: `Para **${alvo} ${intencao.unidade === "porcoes" ? "porções" : unidade}** (${fator.toFixed(2).replace(".", ",")}× a receita atual), o custo vai para **${brl(custoTotal * fator)}**:\n\n${itens.join("\n")}`,
        nota: "Isto é uma conta de produção; a ficha não foi alterada.",
      };
    }

    case "reduzir_custo": {
      const meta = parseNumero(intencao.pct);
      if (meta <= 0 || meta >= 100) return { texto: "Diga uma redução entre 1% e 99%." };
      const alvoValor = custoTotal * (meta / 100);
      const ordenadas = [...linhas].sort((a, b) => b.custo - a.custo).filter(l => l.custo > 0);
      if (!ordenadas.length) return { texto: "Nenhum ingrediente tem custo cadastrado para eu analisar." };
      const candidatos = ordenadas.slice(0, 3).map(l =>
        `• **${l.nome}** — ${brl(l.custo)} (${pct(custoTotal > 0 ? (l.custo / custoTotal) * 100 : 0)} do custo)`
      );
      return {
        texto: `Cortar ${pct(meta)} significa tirar **${brl(alvoValor)}** do custo, indo de ${brl(custoTotal)} para ${brl(custoTotal - alvoValor)}.\n\nOnde há mais o que mexer:\n${candidatos.join("\n")}\n\nO caminho costuma ser renegociar o preço destes itens, reduzir gramatura ou trocar por equivalente mais barato.`,
        nota: "Não altero a receita sozinho: a decisão de gramatura e substituição é sua.",
      };
    }

    case "adicionar_ingrediente":
      return {
        texto: `Adicionar **${intencao.quantidade} ${intencao.unidade} de ${intencao.nome}** muda a lista de ingredientes, que é editada na tela de fichas para não haver dois lugares gravando a mesma coisa.`,
        acao: { tipo: "ir_para_ingredientes", busca: ficha.nome_receita },
      };

    case "trocar_ingrediente": {
      const alvo = acharIngrediente(intencao.de, linhas);
      const onde = alvo ? `"${alvo.nome}" custa ${brl(alvo.custo)} nesta receita. ` : "";
      return {
        texto: `${onde}Trocar **${intencao.de}** por **${intencao.para}** muda a lista de ingredientes, que é editada na tela de fichas.`,
        acao: { tipo: "ir_para_ingredientes", busca: ficha.nome_receita },
      };
    }

    default:
      return { texto: "Entendi o pedido, mas ainda não sei executar esse tipo de comando." };
  }
}

// Exemplos mostrados na tela quando o assistente abre.
export const EXEMPLOS = [
  "Quanto custa essa receita hoje?",
  "Qual ingrediente mais pesa no custo?",
  "Simule CMV de 30%",
  "Se a carne subir para R$ 50/kg, quanto fica?",
  "Transforme esta receita para 20 porções",
  "Reduza o custo da receita em 10%",
];
