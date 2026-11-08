// FICHA TÉCNICA — "como faz o vatapá?", "ficha do risoto", "ingredientes da caipirinha".
//
// Lê a ficha cadastrada (fichas_tecnicas), os ingredientes (fichas_ingredientes,
// só da ficha já conferida desta unidade — regra "pai" do banco escopado), os
// nomes dos produtos (insumos), as etapas do preparo (fichas_etapas), os passos
// de montagem (fichas_montagem_passos) e a tela de Montagem (foto, copo, passo a
// passo) — tudo vira a "folha" do prato/drink (folha-ficha.mjs). Mostra
// o que está cadastrado, sem custo: quem vê a ficha vê como faz. Nada é
// inventado — campo vazio na ficha aparece como "não cadastrado".

import { metrica, insuficiente, CONFIANCA, NATUREZA } from "../core/contratos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { candidatosDoTermo, ehNomeExato, fmtQtd, normalizar } from "./produtos.mjs";
import { montarFolha, passosGravados } from "./folha-ficha.mjs";
import { medir, fonte } from "./base.mjs";

const CAMPOS_FICHA = "id, nome_receita, nome_comercial, nome_interno, departamento, categoria, rendimento_porcoes, rendimento_unidade, peso_porcao_g, modo_preparo, tempo_preparo, tempo_coccao_min, temperatura_preparo, temperatura_servico, validade_dias, observacoes, status, ativo, eh_base, metodo_bar, copo, guarnicao, tipo_gelo";

/** Quantidade na unidade do cadastro, legível: 0,25 kg → "250 g"; 1,5 L → "1,5 L". */
export function quantidadeLegivel(q, unidade) {
  const n = Number(q);
  const u = String(unidade || "un").trim();
  if (!Number.isFinite(n)) return "não cadastrado";
  const ul = u.toLowerCase();
  if (ul === "kg" && n < 1) return `${fmtQtd(Math.round(n * 1000 * 10) / 10)} g`;
  if (ul === "l" && n < 1) return `${fmtQtd(Math.round(n * 1000 * 10) / 10)} ml`;
  return `${fmtQtd(n)} ${ul === "l" ? "L" : u}`;
}

/**
 * Mesmo prato com nome escrito de outro jeito na Montagem: "Moqueca de pirarucu - 2 pessoas"
 * = "Moqueca de pirarucu - 2P". Só acento, caixa, pontuação e "N pessoas" ↔ "NP" mudam.
 */
export function chaveDeNome(nome) {
  return normalizar(nome).replace(/(\d+)\s*(?:pessoas?|pax|p)\b/g, "$1p").replace(/[^a-z0-9]+/g, "");
}

const CAMPOS_FOLHA = "id, nome_comercial, descricao_comercial, imagem, montagem_foto, montagem_sequencia, alergenicos_pode_conter";

/** Leitura opcional: tabela que ainda não existe no banco desta instalação vira lista vazia. */
async function lerOpcional(consulta, tabela) {
  try {
    return (await ler(consulta, tabela)) || [];
  } catch (e) {
    if (e.ausente) return [];
    throw e;
  }
}

/**
 * @param {object} amb
 * @param {{ termo?: string, frase?: string|null, fichaId?: string|null }} op
 *   frase = o pedido inteiro ("como faz a caipirinha clássica?"): o nome do cadastro dito inteiro manda.
 *   tipo  = "base" (a receita/pré-preparo) ou "prato" (o prato ou drink servido): filtra quando a pessoa já disse.
 */
export function fichaDoPrato(amb, { termo, frase = null, fichaId = null, tipo = null } = {}) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: "cadastro atual" };
  return medir(amb, { id: "ficha_tecnica", capacidade: "fichas", periodo }, async (consultas) => {
    const fontes = [fonte("fichas_tecnicas", "Ficha cadastrada"), fonte("fichas_ingredientes", "Ingredientes da ficha"), fonte("fichas_etapas", "Etapas do preparo")];
    const todas = ((await ler(amb.dbe.from("fichas_tecnicas").select(CAMPOS_FICHA), "fichas_tecnicas")) || []).filter((f) => f.ativo !== false && f.status !== "arquivada");
    const comNome = todas.map((f) => ({ ...f, nome: f.nome_receita || f.nome_comercial, nome_interno: f.nome_interno || f.nome_comercial }));
    let achadas = fichaId ? comNome.filter((f) => f.id === fichaId) : candidatosDoTermo(comNome, termo || "", 8, { frase, parcial: true });
    if (tipo && achadas.length > 1) {
      const doTipo = achadas.filter((f) => (tipo === "base") === !!f.eh_base);
      if (doTipo.length) achadas = doTipo; // nenhuma do tipo dito: mostra todas em vez de dizer que não há
    }
    if (!achadas.length) {
      return insuficiente({ metrica: "ficha_tecnica", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `Não há ficha técnica cadastrada com o nome "${termo}" nesta unidade.`, faltando: ["ficha técnica do prato"] });
    }
    // Mais de uma ficha serve ("caipirinha" → Clássica e Morango): pergunta, não escolhe sozinho.
    const exatas = achadas.filter((f) => ehNomeExato(f, termo || ""));
    if (achadas.length > 1 && exatas.length !== 1) {
      return insuficiente({ metrica: "ficha_tecnica", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: tipo === "prato" ? `Encontrei ${achadas.length} pratos com esse nome. Qual deles?` : tipo === "base" ? `Encontrei ${achadas.length} receitas base com esse nome. Qual delas?` : `Encontrei ${achadas.length} fichas com esse nome. Qual delas?`, faltando: ["escolher a ficha"],
        detalhes: { ambiguo: true, tipo, opcoes: achadas.map((f) => ({ id: f.id, nome: String(f.nome || "").trim(), departamento: f.departamento || null, base: !!f.eh_base })) } });
    }
    const ficha = exatas.length === 1 ? exatas[0] : achadas[0];
    const ings = (await ler(amb.dbe.from("fichas_ingredientes").select("ficha_id, insumo_id, subficha_id, quantidade").eq("ficha_id", ficha.id), "fichas_ingredientes")) || [];
    const idsInsumo = [...new Set(ings.map((i) => i.insumo_id).filter(Boolean))];
    const insumos = idsInsumo.length ? new Map(((await ler(amb.dbe.from("insumos").select("id, nome, unidade_medida").in("id", idsInsumo), "insumos")) || []).map((i) => [i.id, i])) : new Map();
    const porId = new Map(todas.map((f) => [f.id, f]));
    // Saldo em estoque de cada produto da ficha (para "tenho tudo?" e adaptar a receita): só com permissão de estoque.
    const saldos = new Map();
    if (idsInsumo.length && (await amb.verificador.pode("saldo_estoque"))) {
      for (const it of (await lerOpcional(amb.dbe.from("estoque_itens").select("insumo_id, quantidade_atual").in("insumo_id", idsInsumo), "estoque_itens"))) {
        saldos.set(it.insumo_id, (saldos.get(it.insumo_id) || 0) + (Number(it.quantidade_atual) || 0));
      }
      if (saldos.size) fontes.push(fonte("estoque_itens", "Saldo em estoque dos ingredientes"));
    }
    const ingredientes = ings.map((i) => {
      const qtd = Number(i.quantidade);
      if (i.subficha_id) {
        const b = porId.get(i.subficha_id);
        const un = b?.rendimento_unidade || "un";
        return { nome: b ? `${b.nome_receita} (base da casa)` : "Base (não encontrada)", quantidade: quantidadeLegivel(i.quantidade, un), qtd: Number.isFinite(qtd) ? qtd : null, unidade: un, base: true, estoque: null };
      }
      const ins = insumos.get(i.insumo_id);
      const un = ins?.unidade_medida || "un";
      return { nome: ins?.nome || "Produto não encontrado no cadastro", quantidade: quantidadeLegivel(i.quantidade, un), qtd: Number.isFinite(qtd) ? qtd : null, unidade: un, base: false,
        estoque: saldos.has(i.insumo_id) ? Math.round(saldos.get(i.insumo_id) * 1000) / 1000 : null };
    });
    let etapas = [];
    try {
      etapas = ((await ler(amb.dbe.from("fichas_etapas").select("ficha_id, ordem, titulo, instrucao, tempo_min, temperatura, equipamento").eq("ficha_id", ficha.id).order("ordem"), "fichas_etapas")) || [])
        .map((e) => ({ titulo: e.titulo || null, instrucao: e.instrucao || "", tempoMin: e.tempo_min ?? null, temperatura: e.temperatura || null, equipamento: e.equipamento || null }));
    } catch (e) {
      if (!e.ausente) throw e;
    }
    // Folha: campos pesados (foto) só da ficha escolhida; passos e tela de Montagem pelo nome.
    const [extra] = await lerOpcional(amb.dbe.from("fichas_tecnicas").select(CAMPOS_FOLHA).eq("id", ficha.id), "fichas_tecnicas");
    const passosTabela = await lerOpcional(amb.dbe.from("fichas_montagem_passos").select("ficha_id, ordem, descricao").eq("ficha_id", ficha.id).order("ordem"), "fichas_montagem_passos");
    const chaves = new Set([ficha.nome_receita, ficha.nome_comercial].filter(Boolean).map(chaveDeNome));
    const montagem = (await lerOpcional(amb.dbe.from("montagem").select("nome, departamento, descritivo, foto_url, estrutura_ia, tempo_preparo, rendimento, observacoes"), "montagem"))
      .find((m) => chaves.has(chaveDeNome(m.nome))) || null;
    if (montagem) fontes.push(fonte("montagem", "Montagem (foto e passo a passo)"));
    // foto do cardápio (produto de venda ligado a esta ficha), quando a ficha e a Montagem não têm
    const [doCardapio] = await lerOpcional(amb.dbe.from("produtos").select("imagem_url").eq("ficha_id", ficha.id).limit(3), "produtos");
    const folha = montarFolha({
      ficha: { ...ficha, ...(extra || {}), nome_receita: ficha.nome_receita },
      ingredientes, etapas, montagem, fotoCardapio: doCardapio?.imagem_url || null,
      passosMontagem: passosGravados(passosTabela, extra?.montagem_sequencia),
    });
    const semPreparo = !etapas.length && !String(ficha.modo_preparo || "").trim();
    const observacoes = [];
    if (semPreparo) observacoes.push("A ficha não tem modo de preparo nem etapas cadastradas.");
    if (!ingredientes.length) observacoes.push("A ficha não tem ingredientes cadastrados.");
    return metrica({
      metrica: "ficha_tecnica", valor: ingredientes.length, unidade: "ingredientes", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: semPreparo || !ingredientes.length ? 0.5 : 1, confianca: semPreparo ? CONFIANCA.MEDIA : CONFIANCA.ALTA, natureza: NATUREZA.REAL,
      apuradoEm: amb.apuradoEm, observacoes: observacoes.length ? observacoes : ["Conforme a ficha técnica cadastrada."],
      detalhes: {
        ficha: {
          id: ficha.id, nome: ficha.nome_receita, departamento: ficha.departamento || null,
          rendimento: ficha.rendimento_porcoes ? `${fmtQtd(ficha.rendimento_porcoes)} ${ficha.rendimento_unidade || "porção(ões)"}` : null,
          porcaoG: ficha.peso_porcao_g ?? null, tempoPreparo: ficha.tempo_preparo ?? null, tempoCoccao: ficha.tempo_coccao_min ?? null,
          temperatura: ficha.temperatura_preparo || null, servico: ficha.temperatura_servico || null, validadeDias: ficha.validade_dias ?? null,
          modoPreparo: String(ficha.modo_preparo || "").trim() || null, observacoes: ficha.observacoes || null,
          bar: ficha.departamento === "bar" ? { metodo: ficha.metodo_bar || null, copo: ficha.copo || null, gelo: ficha.tipo_gelo || null, guarnicao: ficha.guarnicao || null } : null,
        },
        ingredientes, etapas, folha,
        outras: achadas.filter((f) => f.id !== ficha.id).slice(0, 4).map((f) => f.nome_receita),
      },
    });
  });
}

/**
 * Lista de fichas para escolher com um toque (cozinha, bar; receitas base ou pratos/drinks).
 * Só nome, setor e tipo — sem custo nem preço.
 */
export function listarFichas(amb, { departamento = null, base = null } = {}) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: "cadastro atual" };
  return medir(amb, { id: "fichas_lista", capacidade: "fichas", periodo }, async (consultas) => {
    const fontes = [fonte("fichas_tecnicas", "Fichas técnicas cadastradas")];
    const todas = ((await ler(amb.dbe.from("fichas_tecnicas").select("id, nome_receita, nome_comercial, departamento, eh_base, ativo, status, categoria"), "fichas_tecnicas")) || [])
      .filter((f) => f.ativo !== false && f.status !== "arquivada")
      .filter((f) => !departamento || (departamento === "bar" ? f.departamento === "bar" : f.departamento !== "bar"))
      .filter((f) => base == null || !!f.eh_base === base)
      .map((f) => ({ id: f.id, nome: String(f.nome_receita || f.nome_comercial || "").trim(), departamento: f.departamento || null, base: !!f.eh_base, categoria: f.categoria || null }))
      .filter((f) => f.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (!todas.length) {
      return insuficiente({ metrica: "fichas_lista", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: "Não há fichas técnicas cadastradas para isso nesta unidade.", faltando: ["fichas técnicas"] });
    }
    return metrica({ metrica: "fichas_lista", valor: todas.length, unidade: "fichas", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, natureza: NATUREZA.REAL, apuradoEm: amb.apuradoEm, observacoes: ["Conforme o cadastro de fichas."], detalhes: { fichas: todas } });
  });
}

/**
 * "Onde vai o leite de coco?": fichas que usam o produto, direto ou dentro de uma
 * base da casa (até dois níveis: base dentro de base). Quantidade = a da ficha.
 */
export function ondeVai(amb, { termo, frase = null } = {}) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: "cadastro atual" };
  return medir(amb, { id: "fichas_onde_vai", capacidade: "fichas", periodo }, async (consultas) => {
    const fontes = [fonte("insumos", "Cadastro de produtos"), fonte("fichas_tecnicas", "Fichas técnicas"), fonte("fichas_ingredientes", "Ingredientes das fichas")];
    const insumos = (await ler(amb.dbe.from("insumos").select("id, nome, nome_interno, unidade_medida").order("nome"), "insumos")) || [];
    const achados = candidatosDoTermo(insumos, termo || "", 8, { frase, parcial: true });
    if (!achados.length) {
      return insuficiente({ metrica: "fichas_onde_vai", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `Não achei o produto "${termo}" no cadastro desta unidade.`, faltando: ["produto no cadastro"] });
    }
    const exatos = achados.filter((i) => ehNomeExato(i, termo || ""));
    if (achados.length > 1 && exatos.length !== 1) {
      return insuficiente({ metrica: "fichas_onde_vai", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `Achei ${achados.length} produtos com esse nome. Qual deles?`, faltando: ["escolher o produto"],
        detalhes: { ambiguo: true, opcoes: achados.map((i) => ({ id: i.id, nome: String(i.nome).trim() })) } });
    }
    const insumo = exatos[0] || achados[0];
    const fichas = ((await ler(amb.dbe.from("fichas_tecnicas").select("id, nome_receita, nome_comercial, departamento, eh_base, ativo, status, rendimento_unidade"), "fichas_tecnicas")) || [])
      .filter((f) => f.ativo !== false && f.status !== "arquivada");
    const porId = new Map(fichas.map((f) => [f.id, f]));
    const ings = fichas.length ? (await ler(amb.dbe.from("fichas_ingredientes").select("ficha_id, insumo_id, subficha_id, quantidade").in("ficha_id", fichas.map((f) => f.id)), "fichas_ingredientes")) || [] : [];
    const usos = new Map(); // ficha_id → { via, quantidade }
    for (const i of ings) if (i.insumo_id === insumo.id && porId.has(i.ficha_id)) usos.set(i.ficha_id, { via: null, quantidade: quantidadeLegivel(i.quantidade, insumo.unidade_medida) });
    for (let nivel = 0; nivel < 2; nivel++) {
      const bases = new Set([...usos.keys()].filter((id) => porId.get(id)?.eh_base));
      for (const i of ings) {
        if (!i.subficha_id || !bases.has(i.subficha_id) || usos.has(i.ficha_id) || !porId.has(i.ficha_id)) continue;
        usos.set(i.ficha_id, { via: String(porId.get(i.subficha_id).nome_receita || "").trim(), quantidade: null });
      }
    }
    const lista = [...usos.entries()].map(([id, u]) => {
      const f = porId.get(id);
      return { id, nome: String(f.nome_receita || f.nome_comercial || "").trim(), departamento: f.departamento || null, base: !!f.eh_base, via: u.via, quantidade: u.quantidade };
    }).sort((a, b) => Number(a.base) - Number(b.base) || a.nome.localeCompare(b.nome, "pt-BR"));
    return metrica({ metrica: "fichas_onde_vai", valor: lista.length, unidade: "fichas", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, natureza: NATUREZA.REAL, apuradoEm: amb.apuradoEm, observacoes: ["Conforme os ingredientes cadastrados nas fichas."],
      detalhes: { produto: { id: insumo.id, nome: String(insumo.nome).trim() }, fichas: lista } });
  });
}
