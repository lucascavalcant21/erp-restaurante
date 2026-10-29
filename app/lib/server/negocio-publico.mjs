// PÁGINAS PÚBLICAS DO NEGÓCIO — o que antes o navegador anônimo lia e gravava
// direto nas tabelas agora passa pelo servidor (SEC-DADOS-2).
//
//   /cardapio/[unidade]  → lerCardapioPublico, criarPedidoPublico
//   /chamada/[unidade]   → lerChamadaPublica
//   /rastreio/[codigo]   → lerRastreioPublico
//   /eventos/[unidade]   → lerUnidadePublica
//
// Por que: com leitura anônima, qualquer visitante lia `pedidos` inteiro (nome,
// telefone e endereço de clientes), `unidades` inteiro (inclusive o token da
// NF-e) e todas as etiquetas. E o pedido do cardápio chegava com o PREÇO
// calculado no navegador — dava para pedir qualquer prato por R$ 0,01.
//
// Regras comuns: lista fechada de campos na saída; preço e total sempre do
// banco; nenhuma mensagem interna do banco na resposta. Módulo sem Next: o
// banco entra por parâmetro, para dar para testar.

import { montarCardapioPublico, juntarProdutosEFichas, totalDoCarrinho, linhasDoCombo, cardapioDoCanal, canalDoPedido, aplicarFotosDaMontagem } from "../cardapio-digital.mjs";
import { trocoEmReais } from "../troco.mjs";
import {
  cashbackUsavel, descontoDoCadastro, normalizarFidelidade, normalizarTelefone, saldoDoCliente, STATUS_CONCLUIDO, validarCadastro,
} from "../fidelidade.mjs";

const falha = (status, codigo, mensagem) => ({ ok: false, status, codigo, mensagem });
const idValido = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const texto = (v, max) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const centavos = (v) => Math.round(v * 100) / 100;

// ─── CARDÁPIO ────────────────────────────────────────────────────────────────
//
// O cardápio é montado a partir do produto de venda ligado à ficha técnica
// (nome comercial, descrição, categoria e alergênicos da ficha; preço do
// produto) e da vitrine que o dono configurou (config_sistema.params
// .cardapio_digital). Regras em app/lib/cardapio-digital.mjs. Daqui só sai a
// lista fechada que montarCardapioPublico devolve — nada de custo, CMV,
// parâmetros financeiros nem dado fiscal da loja.

const COLUNA_FALTANDO = /column|could not find|does not exist|schema cache/i;

/** Tenta as colunas da mais completa à mínima (bancos antigos não têm todas). */
async function selecionar(consulta, opcoes) {
  let r = null;
  for (const colunas of opcoes) {
    r = await consulta(colunas);
    if (!r.error || !COLUNA_FALTANDO.test(r.error.message || "")) return r;
  }
  return r;
}

async function emLotes(ids, consulta, tamanho = 100) {
  const data = [];
  for (let i = 0; i < ids.length; i += tamanho) {
    const r = await consulta(ids.slice(i, i + tamanho));
    if (r.error) return { data: null, error: r.error };
    data.push(...(r.data || []));
  }
  return { data, error: null };
}

export const fotoDaFichaUrl = (unidade, produtoId) =>
  `/api/public/cardapio/${encodeURIComponent(unidade)}/foto/${encodeURIComponent(produtoId)}`;

/**
 * Tudo o que monta o cardápio de uma unidade. Ficha, alergênico e
 * configuração são complementos: se a tabela ou a coluna faltar, o cardápio
 * sai só dos produtos (nunca com dado inventado).
 */
export async function carregarCardapio({ db, unidade, agora = new Date() }) {
  const rU = await selecionar((c) => db.from("unidades").select(c).eq("id", unidade).maybeSingle(), [
    "id, nome, nome_fantasia, delivery_aberto, taxa_entrega_padrao, cidade, uf, bairro, endereco, numero, horario_funcionamento, telefone_contato",
    "id, nome, nome_fantasia, delivery_aberto, taxa_entrega_padrao",
  ]);
  const { data: u, error: eU } = rU;
  if (eU) return falha(503, "indisponivel", "Cardápio indisponível no momento.");
  if (!u) return falha(404, "nao_encontrado", "Cardápio não encontrado.");

  const rP = await selecionar((c) => db.from("produtos").select(c).eq("unidade_id", unidade).eq("ativo", true).order("nome_produto"), [
    "id, nome_produto, preco_venda, categoria, departamento, imagem_url, ficha_id",
    "id, nome_produto, preco_venda, categoria",
  ]);
  if (rP.error) return falha(503, "indisponivel", "Cardápio indisponível no momento.");
  const produtos = rP.data || [];

  const fichaIds = [...new Set(produtos.map((p) => p.ficha_id).filter((id) => id != null).map(String))];
  let fichas = [];
  let alergenicos = [];
  let fichasComFoto = [];
  if (fichaIds.length) {
    // Sempre filtrado pela unidade: ficha de outra loja nunca entra, mesmo
    // que um produto aponte para ela.
    const rF = await emLotes(fichaIds, (lote) => selecionar((c) => db.from("fichas_tecnicas").select(c).eq("unidade_id", unidade).in("id", lote), [
      "id, nome_comercial, nome_receita, descricao_comercial, categoria, departamento, ativo, status, alergenicos_pode_conter",
      "id, nome_comercial, descricao_comercial, categoria, departamento, ativo, status, alergenicos_pode_conter",
      "id, categoria, departamento",
      "id",
    ]));
    if (!rF.error) fichas = rF.data;
    // A foto da ficha pode ser um texto enorme (base64): aqui só se pergunta
    // quais têm foto; a foto em si sai pela rota /foto, uma de cada vez.
    const rFoto = await emLotes(fichaIds, (lote) => db.from("fichas_tecnicas").select("id")
      .eq("unidade_id", unidade).in("id", lote).not("imagem", "is", null).neq("imagem", ""));
    if (!rFoto.error) fichasComFoto = rFoto.data.map((f) => f.id);
    const rA = await emLotes(fichaIds, (lote) => db.from("fichas_alergenicos").select("ficha_id, alergenico")
      .eq("unidade_id", unidade).in("ficha_id", lote));
    if (!rA.error) alergenicos = rA.data;
  }

  let config = {};
  const rC = await db.from("config_sistema").select("params").eq("unidade_id", unidade).limit(1);
  const params = !rC.error && Array.isArray(rC.data) ? rC.data[0]?.params : null;
  if (params && typeof params === "object" && params.cardapio_digital && typeof params.cardapio_digital === "object") {
    config = params.cardapio_digital;
  }

  // Foto do prato que está só na Montagem (mesmo nome). Sem a tabela, segue sem.
  const rM = await db.from("montagem").select("nome, foto_url").eq("unidade_id", unidade).not("foto_url", "is", null);
  const comFotos = aplicarFotosDaMontagem(produtos, { fichas, fichasComFoto, montagens: rM.error ? [] : rM.data || [] });

  const juntos = juntarProdutosEFichas(comFotos, fichas, alergenicos, {
    fichasComFoto,
    fotoDaFicha: (id) => fotoDaFichaUrl(unidade, id),
  });
  const cardapio = montarCardapioPublico({
    // Endereço e telefone só saem se o dono ligar em "Mais informações" (o filtro está em montarCardapioPublico).
    unidade: {
      nome: u.nome_fantasia || u.nome || "",
      delivery_aberto: u.delivery_aberto !== false,
      taxa_entrega: numero(u.taxa_entrega_padrao),
      cidade: u.cidade || "",
      uf: u.uf || "",
      horario: u.horario_funcionamento || "",
      endereco: [[u.endereco, u.numero].filter(Boolean).join(", "), u.bairro].filter((x) => String(x || "").trim()).join(" · "),
      telefone: u.telefone_contato || "",
    },
    produtos: juntos,
    config,
    fidelidade: params?.fidelidade,
    agora,
  });
  return { ok: true, cardapio, loja: u, fidelidade: normalizarFidelidade(params?.fidelidade) };
}

export async function lerCardapioPublico({ db, unidade, agora = new Date() }) {
  if (!idValido(unidade)) return falha(404, "nao_encontrado", "Cardápio não encontrado.");
  // Sem banco não há cardápio: nada de pratos de demonstração para o cliente.
  if (!db) return falha(503, "indisponivel", "Cardápio indisponível no momento.");
  try {
    const r = await carregarCardapio({ db, unidade, agora });
    return r.ok ? { ok: true, cardapio: r.cardapio } : r;
  } catch {
    return falha(503, "indisponivel", "Cardápio indisponível no momento.");
  }
}

const TIPOS_IMAGEM = [
  ["image/jpeg", /^\/9j\//], ["image/png", /^iVBORw0KGgo/], ["image/webp", /^UklGR/], ["image/gif", /^R0lGOD/],
];

/** Decodifica a foto guardada na ficha (data URL ou base64 puro). Só imagem. */
export function decodificarFotoDaFicha(valor, limiteBytes = 4 * 1024 * 1024) {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  let tipo = null;
  let b64 = s;
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/is.exec(s);
  if (m) { tipo = m[1].toLowerCase().replace("jpg", "jpeg"); b64 = m[2]; }
  b64 = b64.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const detectado = TIPOS_IMAGEM.find(([, re]) => re.test(b64))?.[0];
  if (!detectado || (tipo && tipo !== detectado)) return null;
  const bytes = Buffer.from(b64, "base64");
  if (!bytes.length || bytes.length > limiteBytes) return null;
  return { tipo: detectado, bytes };
}

/**
 * Foto do prato guardada na ficha técnica. Só de produto ativo da unidade e
 * de ficha da mesma unidade.
 */
export async function lerFotoPublica({ db, unidade, produto }) {
  const nao = falha(404, "nao_encontrado", "Foto não encontrada.");
  if (!idValido(unidade) || !idValido(produto) || !db) return nao;
  try {
    const { data: p, error: eP } = await db.from("produtos").select("id, ficha_id")
      .eq("id", produto).eq("unidade_id", unidade).eq("ativo", true).maybeSingle();
    if (eP) return falha(503, "indisponivel", "Indisponível no momento.");
    if (!p?.ficha_id) return nao;
    const { data: f, error: eF } = await db.from("fichas_tecnicas").select("imagem")
      .eq("id", p.ficha_id).eq("unidade_id", unidade).maybeSingle();
    if (eF) return falha(503, "indisponivel", "Indisponível no momento.");
    const foto = decodificarFotoDaFicha(f?.imagem);
    return foto ? { ok: true, ...foto } : nao;
  } catch {
    return falha(503, "indisponivel", "Indisponível no momento.");
  }
}

const TIPOS_PEDIDO = ["delivery", "retirada", "qrcode"];
const FORMAS = ["dinheiro", "cartao", "pix", "vale"];
// A mesma conta de troco da tela (o aviso) e do servidor (a trava).
export { trocoEmReais };

/**
 * Valida o pedido do cardápio. Só entram id e quantidade dos itens — preço
 * não. Na mesa (tipo qrcode com número da mesa) o WhatsApp é opcional; no
 * delivery é obrigatório.
 */
export function validarPedidoPublico(corpo) {
  const c = corpo && typeof corpo === "object" ? corpo : {};
  if (!idValido(c.unidade)) return falha(400, "unidade_invalida", "Link inválido.");
  const cli = c.cliente && typeof c.cliente === "object" ? c.cliente : {};
  const tipo = TIPOS_PEDIDO.includes(cli.tipo) ? cli.tipo : null;
  if (!tipo) return falha(400, "parametro_invalido", "Escolha entrega, retirada ou mesa.");
  let nome = texto(cli.nome, 80);
  if (!nome || nome.length < 2) return falha(400, "parametro_invalido", "Digite seu nome.");
  const mesa = texto(cli.mesa, 10);
  if (mesa && !/^[A-Za-z0-9-]{1,10}$/.test(mesa)) return falha(400, "parametro_invalido", "Mesa inválida.");
  const tel = soDigitos(cli.telefone);
  const telefoneOpcional = tipo === "qrcode" && Boolean(mesa);
  if (tel.length || !telefoneOpcional) {
    if (tel.length < 10 || tel.length > 13) return falha(400, "parametro_invalido", "Digite seu WhatsApp com DDD.");
  }
  const endereco = texto(cli.endereco, 300);
  if (tipo === "delivery" && !endereco) return falha(400, "parametro_invalido", "Digite seu endereço.");
  // Forma de pagamento (entrega e retirada). Se a loja aceita essa forma,
  // quem confere é criarPedidoPublico (precisa da configuração da loja).
  const pagamento = tipo !== "qrcode" && FORMAS.includes(cli.pagamento) ? cli.pagamento : null;
  if (tipo !== "qrcode" && cli.pagamento != null && !pagamento) return falha(400, "parametro_invalido", "Forma de pagamento inválida.");
  if (mesa) nome = `[MESA ${mesa}] ${nome}`;

  const itens = Array.isArray(c.itens) ? c.itens : [];
  if (!itens.length || itens.length > 50) return falha(400, "parametro_invalido", "Carrinho vazio ou grande demais.");
  const limpos = [];
  for (const it of itens) {
    const qtd = Number(it?.quantidade);
    if (!idValido(String(it?.id ?? "")) || !Number.isInteger(qtd) || qtd < 1 || qtd > 50) {
      return falha(400, "parametro_invalido", "Item inválido no carrinho.");
    }
    limpos.push({ id: String(it.id), quantidade: qtd, observacao: texto(it.observacao, 200) || "" });
  }
  // Cashback da fidelidade: o cliente só diz "quero usar" e manda os pedidos
  // que este aparelho fez (a prova). Quanto usar, o servidor decide.
  const cb = c.cashback && typeof c.cashback === "object" ? c.cashback : null;
  const cashback = cb?.usar === true
    ? { usar: true, prova: [...new Set((Array.isArray(cb.prova) ? cb.prova : []).map(String).filter((id) => UUID_RE.test(id)))].slice(0, 10) }
    : null;
  if (cashback && !tel.length) return falha(400, "parametro_invalido", "Digite seu WhatsApp para usar o cashback.");
  return {
    ok: true,
    pedido: {
      unidade: c.unidade, tipo, nome, mesa: mesa || null, telefone: tel.length ? texto(cli.telefone, 20) : null,
      endereco: tipo === "delivery" ? endereco : null, troco: !pagamento || pagamento === "dinheiro" ? texto(cli.troco, 20) : "",
      pagamento, itens: limpos, cashback,
    },
  };
}

/**
 * Grava o pedido. O preço de cada item é o do CARDÁPIO montado agora, no
 * servidor: preço do produto, com a promoção que estiver valendo neste
 * minuto. Prato oculto, sem preço ou com a ficha desativada é recusado. O que
 * o navegador mandou de preço é ignorado. Se os itens falharem, o pedido é
 * apagado — o cliente nunca fica com um pedido vazio na cozinha.
 */
export async function criarPedidoPublico({ db, pedido, agora = Date.now(), limitePorTelefone = 5, limitePorMesa = 8 }) {
  try {
    const carga = await carregarCardapio({ db, unidade: pedido.unidade, agora: new Date(agora) });
    if (!carga.ok) {
      if (carga.status === 404) return falha(404, "unidade_invalida", "Link inválido.");
      return falha(503, "indisponivel", "Não foi possível enviar agora.");
    }
    const { loja } = carga;
    // Só vale o que o canal do pedido mostra (prato desligado no canal não entra).
    const cardapio = cardapioDoCanal(carga.cardapio, canalDoPedido(pedido.tipo));
    if ((pedido.tipo === "delivery" || pedido.tipo === "retirada") && loja.delivery_aberto === false) {
      return falha(409, "loja_fechada", "O delivery está fechado no momento.");
    }
    if (pedido.tipo === "retirada" && !cardapio.entrega?.retirada) {
      return falha(409, "retirada_desligada", "A loja não está aceitando retirada agora.");
    }
    if (pedido.pagamento && !(cardapio.entrega?.formas || []).includes(pedido.pagamento)) {
      return falha(409, "pagamento_indisponivel", "Esta forma de pagamento não está disponível. Escolha outra.");
    }

    const desde = new Date(agora - 10 * 60 * 1000).toISOString();
    const freio = pedido.telefone
      ? { coluna: "cliente_telefone", valor: pedido.telefone, limite: limitePorTelefone, msg: "Recebemos vários pedidos seguidos deste número. Aguarde alguns minutos." }
      : { coluna: "cliente_nome", valor: `[MESA ${pedido.mesa}]%`, limite: limitePorMesa, msg: "Recebemos vários pedidos seguidos desta mesa. Chame a equipe, por favor." };
    let contagem = db.from("pedidos").select("id", { count: "exact", head: true }).eq("unidade_id", pedido.unidade).gte("created_at", desde);
    contagem = pedido.telefone ? contagem.eq(freio.coluna, freio.valor) : contagem.like(freio.coluna, freio.valor);
    const { count, error: eC } = await contagem;
    if (!eC && (count || 0) >= freio.limite) return falha(429, "limite", freio.msg);

    const preco = new Map(cardapio.produtos.map((p) => [p.id, p.preco]));
    if (pedido.itens.some((i) => !preco.has(i.id))) {
      return falha(409, "item_indisponivel", "Um item do carrinho não está mais disponível. Atualize o cardápio.");
    }

    // Mínimo e grátis-acima do dono: a mesma conta que a página mostra.
    // Promoções de pedido ("pegue X, leve Y", frete grátis) entram na mesma conta da tela.
    const regras = totalDoCarrinho(pedido.itens, cardapio, { tipo: pedido.tipo });
    if (regras.falta_minimo > 0) {
      return falha(409, "pedido_minimo", `O pedido mínimo para entrega é R$ ${cardapio.entrega.pedido_minimo.toFixed(2).replace(".", ",")}.`);
    }
    const descontoPromo = regras.desconto_promocoes;
    const bruto = regras.total;

    // Desconto do cadastro pelo QR: o banco diz se este telefone tem e quanto
    // (primeiro pedido ou todos, validade). Sem a migração, não há desconto.
    let descontoCadastro = 0;
    if (pedido.telefone && carga.fidelidade?.ativo && carga.fidelidade.cadastro?.ativo) {
      const { data: pct, error: eD } = await db.rpc("fidelidade_desconto_cadastro", { p_unidade: pedido.unidade, p_telefone: pedido.telefone });
      if (!eD && Number(pct) > 0) descontoCadastro = descontoDoCadastro(regras.base_cadastro, pct);
    }

    // Cashback: telefone provado por pedido concluído deste aparelho, saldo do
    // livro e teto do dono. A baixa no livro é feita pelo banco, sob trava.
    let cashbackUsado = 0;
    if (pedido.cashback?.usar) {
      const tel = normalizarTelefone(pedido.telefone);
      const prova = await telefoneProvado({ db, unidade: pedido.unidade, ids: pedido.cashback.prova });
      if (!prova.ok) return falha(503, "indisponivel", "Não foi possível enviar agora.");
      if (!tel || prova.telefone !== tel) {
        return falha(409, "cashback_telefone", "O cashback fica no WhatsApp dos seus pedidos anteriores. Use o mesmo número ou envie sem o cashback.");
      }
      const s = await saldoNoLivro({ db, unidade: pedido.unidade, telefone: tel, cfg: carga.fidelidade });
      cashbackUsado = s.ok && s.disponivel ? cashbackUsavel(s.saldo.cashback.saldo, centavos(bruto - descontoCadastro), carga.fidelidade) : 0;
      if (!(cashbackUsado > 0)) return falha(409, "cashback_sem_saldo", "Não há cashback disponível agora. Envie sem ele.");
    }
    const total = centavos(bruto - descontoCadastro - cashbackUsado);
    const desconto = centavos(descontoPromo + descontoCadastro + cashbackUsado);
    const origem = [descontoPromo > 0 ? "promocao" : "", descontoCadastro > 0 ? "cadastro" : "", cashbackUsado > 0 ? "cashback" : ""].filter(Boolean).join("+");
    // Troco para menos que o total não serve para nada: o cliente corrige antes.
    const troco = pedido.pagamento === "dinheiro" ? trocoEmReais(pedido.troco) : null;
    if (troco != null && troco < total) {
      return falha(409, "troco_menor", `O troco precisa ser para R$ ${total.toFixed(2).replace(".", ",")} ou mais.`);
    }

    const { data: criado, error: eI } = await db.from("pedidos").insert([{
      unidade_id: pedido.unidade,
      status: "novo_online",
      tipo_pedido: pedido.tipo,
      cliente_nome: pedido.nome,
      cliente_telefone: pedido.telefone,
      endereco_entrega: pedido.endereco,
      troco_para: pedido.troco,
      ...(pedido.pagamento ? { forma_pagamento: pedido.pagamento } : {}),
      valor_total: total,
      // Só com desconto: sem a FIDELIDADE-1 estas colunas não existem (e aí não há desconto).
      ...(desconto > 0 ? { desconto, desconto_origem: origem } : {}),
    }]).select("id").single();
    if (eI || !criado?.id) return falha(503, "indisponivel", "Não foi possível enviar agora.");

    // Combo: cobra o preço do combo e manda cada prato para a cozinha/bar
    // (uma linha por prato, o valor repartido; soma = preço do combo).
    const porIdCardapio = new Map(cardapio.produtos.map((p) => [p.id, p]));
    const linhas = pedido.itens.flatMap((i) => {
      const prod = porIdCardapio.get(i.id);
      if (prod?.combo) {
        const obs = [`Combo: ${prod.nome}`, i.observacao].filter(Boolean).join(" · ").slice(0, 200);
        return linhasDoCombo(prod, i.quantidade).map((l) => ({ ...l, observacao: obs }));
      }
      return [{ produto_id: i.id, quantidade: i.quantidade, valor_unitario: preco.get(i.id), observacao: i.observacao }];
    });
    const { error: eItens } = await db.from("pedidos_itens").insert(linhas.map((l) => ({
      pedido_id: criado.id,
      produto_id: l.produto_id,
      quantidade: l.quantidade,
      valor_unitario: l.valor_unitario,
      observacao: l.observacao,
      status_kds: "aguardando_aceite",
    })));
    if (eItens) {
      await db.from("pedidos").delete().eq("id", criado.id);
      return falha(503, "indisponivel", "Não foi possível enviar agora.");
    }
    if (cashbackUsado > 0) {
      const { error: eR } = await db.rpc("fidelidade_reservar_cashback", {
        p_unidade: pedido.unidade, p_telefone: pedido.telefone, p_pedido: criado.id, p_valor: cashbackUsado,
      });
      if (eR) {
        // Saldo mudou entre a conta e a baixa: o pedido não fica com desconto sem lastro.
        await db.from("pedidos_itens").delete().eq("pedido_id", criado.id);
        await db.from("pedidos").delete().eq("id", criado.id);
        return falha(409, "cashback_mudou", "Seu saldo de cashback mudou. Confira e envie de novo.");
      }
    }
    return {
      ok: true, id: criado.id, total, taxa: regras.taxa, cashback: cashbackUsado, desconto: descontoCadastro,
      itens: pedido.itens.map((i) => ({ id: i.id, quantidade: i.quantidade, preco: preco.get(i.id) })),
    };
  } catch {
    return falha(503, "indisponivel", "Não foi possível enviar agora.");
  }
}

// ─── MEUS PEDIDOS (andamento no aparelho do cliente) ─────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ETAPAS = {
  novo_online: "recebido", aguardando: "recebido",
  preparando_delivery: "preparo", preparando: "preparo", aberto: "preparo", pendente: "preparo",
  pronto: "pronto", saiu: "saiu", entregue: "entregue", pago: "entregue", fechado: "entregue",
  cancelado: "cancelado", recusado: "cancelado",
};
/** Status do banco → etapa que o cliente entende. Desconhecido: "andamento". */
export const etapaDoPedido = (status) => ETAPAS[String(status || "").toLowerCase()] || "andamento";

/**
 * Andamento dos pedidos que ESTE aparelho fez (ele guarda os ids que o
 * servidor devolveu). Sem id, nada sai: não dá para listar pedidos de
 * ninguém. Nome, telefone e endereço nunca saem.
 */
export async function lerPedidosPublicos({ db, unidade, ids }) {
  if (!idValido(unidade)) return falha(404, "nao_encontrado", "Não encontrado.");
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((id) => UUID_RE.test(id)))].slice(0, 10);
  if (!lista.length) return { ok: true, pedidos: [] };
  try {
    const { data: peds, error } = await db.from("pedidos").select("id, status, valor_total, created_at, tipo_pedido")
      .eq("unidade_id", unidade).in("id", lista);
    if (error) return falha(503, "indisponivel", "Indisponível no momento.");
    const achados = (peds || []).map((p) => String(p.id));
    let itens = [];
    if (achados.length) {
      const r = await db.from("pedidos_itens").select("pedido_id, produto_id, quantidade, valor_unitario").in("pedido_id", achados);
      if (!r.error) itens = r.data || [];
    }
    return {
      ok: true,
      pedidos: (peds || []).map((p) => ({
        id: String(p.id),
        etapa: etapaDoPedido(p.status),
        tipo: p.tipo_pedido === "delivery" ? "delivery" : "mesa",
        total: numero(p.valor_total),
        criado_em: p.created_at || null,
        itens: itens.filter((i) => String(i.pedido_id) === String(p.id))
          .map((i) => ({ produto_id: String(i.produto_id), quantidade: Number(i.quantidade) || 0, preco: numero(i.valor_unitario) })),
      })).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))),
    };
  } catch {
    return falha(503, "indisponivel", "Indisponível no momento.");
  }
}

// ─── FIDELIDADE (saldo no aparelho do cliente) ───────────────────────────────
//
// O saldo é de um TELEFONE, mas o telefone nunca entra pela requisição: o
// aparelho manda os ids dos pedidos que ELE fez (o servidor devolveu na hora
// do envio) e o servidor acha o telefone de um desses pedidos que já foi
// CONCLUÍDO. Pedido falso com o telefone de outra pessoa nunca é concluído —
// então não abre o saldo de ninguém. Do telefone, só saem os 4 últimos dígitos.

const LIVRO_FALTANDO = /fidelidade_movimentos|relation .* does not exist|could not find the table|schema cache/i;

/** Telefone provado pelos pedidos concluídos deste aparelho (o mais recente). */
async function telefoneProvado({ db, unidade, ids }) {
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((id) => UUID_RE.test(id)))].slice(0, 10);
  if (!lista.length) return { ok: true, telefone: "" };
  const { data, error } = await db.from("pedidos").select("id, status, cliente_telefone, created_at")
    .eq("unidade_id", unidade).in("id", lista).in("status", [...STATUS_CONCLUIDO]);
  if (error) return falha(503, "indisponivel", "Indisponível no momento.");
  const achado = (data || []).map((p) => ({ tel: normalizarTelefone(p.cliente_telefone), em: String(p.created_at || "") }))
    .filter((p) => p.tel).sort((a, b) => b.em.localeCompare(a.em))[0];
  return { ok: true, telefone: achado?.tel || "" };
}

async function saldoNoLivro({ db, unidade, telefone, cfg }) {
  const { data, error } = await db.from("fidelidade_movimentos").select("tipo, cartao_id, selos, valor, created_at")
    .eq("unidade_id", unidade).eq("cliente_tel", telefone).order("created_at", { ascending: true }).limit(2000);
  if (error) return LIVRO_FALTANDO.test(error.message || "") ? { ok: true, disponivel: false } : falha(503, "indisponivel", "Indisponível no momento.");
  return { ok: true, disponivel: true, saldo: saldoDoCliente(data || [], cfg) };
}

/**
 * Saldo de fidelidade deste aparelho. Sem pedido concluído: só as regras
 * (o cardápio já mostra). Livro ainda não criado no banco: disponivel=false.
 */
export async function lerFidelidadePublica({ db, unidade, ids }) {
  if (!idValido(unidade)) return falha(404, "nao_encontrado", "Não encontrado.");
  try {
    const { data: rC, error: eC } = await db.from("config_sistema").select("params").eq("unidade_id", unidade).limit(1);
    if (eC) return falha(503, "indisponivel", "Indisponível no momento.");
    const cfg = normalizarFidelidade(rC?.[0]?.params?.fidelidade);
    if (!cfg.ativo) return { ok: true, ativo: false };
    const prova = await telefoneProvado({ db, unidade, ids });
    if (!prova.ok) return prova;
    if (!prova.telefone) return { ok: true, ativo: true, identificado: false };
    const s = await saldoNoLivro({ db, unidade, telefone: prova.telefone, cfg });
    if (!s.ok) return s;
    if (!s.disponivel) return { ok: true, ativo: true, identificado: true, disponivel: false, final: prova.telefone.slice(-4) };
    return { ok: true, ativo: true, identificado: true, disponivel: true, final: prova.telefone.slice(-4), cartoes: s.saldo.cartoes, cashback: s.saldo.cashback };
  } catch {
    return falha(503, "indisponivel", "Indisponível no momento.");
  }
}

// ─── CADASTRO PELO QR (CRM) ──────────────────────────────────────────────────
//
// O cliente lê o QR do restaurante e se cadastra: vira cliente do CRM e ganha
// o desconto do dono nos pedidos pelo cardápio. A unidade vem do link (e o
// banco confere que existe); quem grava é o banco (fidelidade_cadastrar), que
// nunca troca o nome de quem já se cadastrou. A resposta é a mesma para
// cadastro novo ou repetido: não dá para descobrir se um telefone é cliente.

const FUNCAO_FALTANDO = /function .* does not exist|could not find the function|schema cache/i;
const ERROS_CADASTRO = {
  nome: "Digite seu nome.", telefone: "Digite seu WhatsApp com DDD.", email: "Confira o e-mail.",
  aniversario: "Confira a data do aniversário.", aceite: "Para se cadastrar, aceite o uso dos seus dados.",
};

export async function cadastrarClientePublico({ db, unidade, corpo }) {
  if (!idValido(unidade)) return falha(404, "nao_encontrado", "Link inválido.");
  try {
    const { data: rC, error: eC } = await db.from("config_sistema").select("params").eq("unidade_id", unidade).limit(1);
    if (eC) return falha(503, "indisponivel", "Cadastro indisponível no momento.");
    const cfg = normalizarFidelidade(rC?.[0]?.params?.fidelidade);
    const v = validarCadastro(corpo, cfg);
    if (!v.ok) {
      if (v.codigo === "cadastro_fechado") return falha(404, "cadastro_fechado", "O cadastro não está aberto nesta casa.");
      return { ...falha(400, v.codigo, ERROS_CADASTRO[v.codigo] || "Confira os dados."), campo: v.codigo };
    }
    const c = v.cadastro;
    const { error } = await db.rpc("fidelidade_cadastrar", {
      p_unidade: unidade, p_nome: c.nome, p_telefone: c.telefone, p_email: c.email, p_aniversario: c.aniversario, p_novidades: c.novidades,
    });
    if (error) {
      if (FUNCAO_FALTANDO.test(error.message || "")) return falha(503, "cadastro_indisponivel", "O cadastro ainda não está disponível.");
      if (/Unidade inválida/i.test(error.message || "")) return falha(404, "nao_encontrado", "Link inválido.");
      return falha(503, "indisponivel", "Cadastro indisponível no momento.");
    }
    return { ok: true, desconto_pct: cfg.cadastro.desconto_pct, aplica: cfg.cadastro.aplica, final: c.telefone.slice(-4) };
  } catch {
    return falha(503, "indisponivel", "Cadastro indisponível no momento.");
  }
}

// ─── CHAMADA (TV do balcão) ──────────────────────────────────────────────────

const STATUS_CHAMADA = ["preparando", "preparando_delivery", "aberto", "pronto", "pago"];
const TIPOS_CHAMADA = ["balcao", "ifood", "delivery", "cardapio"];

/** Como o nome aparece na TV: primeiro nome em maiúsculas, ou o número. */
export function rotuloDaChamada(p) {
  const nome = String(p?.cliente_nome || "").replace(/^\[[^\]]*\]\s*/, "").trim();
  if (nome) return nome.split(/\s+/)[0].toUpperCase().slice(0, 20);
  return `#${p?.numero_pedido || String(p?.id || "").slice(0, 4)}`;
}

/** Só rótulo, status e horário. Telefone, endereço e valor nunca saem. */
export async function lerChamadaPublica({ db, unidade }) {
  if (!idValido(unidade)) return falha(404, "nao_encontrado", "Unidade não encontrada.");
  try {
    const { data, error } = await db.from("pedidos")
      // numero_pedido não existe em produção (a tela antiga pedia e ficava vazia).
      .select("id, cliente_nome, status, updated_at, tipo_pedido")
      .eq("unidade_id", unidade).in("tipo_pedido", TIPOS_CHAMADA).in("status", STATUS_CHAMADA)
      .order("updated_at", { ascending: false }).limit(60);
    if (error) return falha(503, "indisponivel", "Chamada indisponível no momento.");
    return {
      ok: true,
      pedidos: (data || []).map((p) => ({ id: p.id, rotulo: rotuloDaChamada(p), status: p.status, updated_at: p.updated_at })),
    };
  } catch {
    return falha(503, "indisponivel", "Chamada indisponível no momento.");
  }
}

// ─── RASTREIO (QR da etiqueta) ───────────────────────────────────────────────

/** O que já está impresso no papel da etiqueta — e nada de custo, saldo ou lote de produção. */
const CAMPOS_RASTREIO = ["codigo", "produto", "lote", "quantidade", "unidade", "conservacao", "manipulacao_em", "validade_em", "status"];

export async function lerRastreioPublico({ db, codigo }) {
  const naoEncontrada = falha(404, "nao_encontrado", "Etiqueta não encontrada.");
  if (typeof codigo !== "string" || !/^[A-Za-z0-9_-]{3,40}$/.test(codigo)) return naoEncontrada;
  try {
    // select("*") só aqui dentro: o nome de algumas colunas varia entre bancos;
    // o que SAI é a lista fechada abaixo.
    const { data, error } = await db.from("etiquetas").select("*").eq("codigo", codigo).maybeSingle();
    if (error) return falha(503, "indisponivel", "Rastreio indisponível no momento.");
    if (!data) return naoEncontrada;
    const etiqueta = {};
    for (const c of CAMPOS_RASTREIO) etiqueta[c] = data[c] ?? null;
    return { ok: true, etiqueta };
  } catch {
    return falha(503, "indisponivel", "Rastreio indisponível no momento.");
  }
}

// ─── UNIDADE (cabeçalho de páginas públicas) ─────────────────────────────────

/** Nome e logo. CNPJ, endereço fiscal, token da NF-e e afins nunca saem. */
export async function lerUnidadePublica({ db, unidade }) {
  if (!idValido(unidade)) return falha(404, "nao_encontrado", "Unidade não encontrada.");
  try {
    const { data, error } = await db.from("unidades").select("nome, nome_fantasia, config").eq("id", unidade).maybeSingle();
    if (error) {
      // `config` pode não existir em bancos antigos: tenta só o nome.
      const r = await db.from("unidades").select("nome, nome_fantasia").eq("id", unidade).maybeSingle();
      if (r.error) return falha(503, "indisponivel", "Indisponível no momento.");
      if (!r.data) return falha(404, "nao_encontrado", "Unidade não encontrada.");
      return { ok: true, unidade: { nome: r.data.nome_fantasia || r.data.nome || "", logo_url: null } };
    }
    if (!data) return falha(404, "nao_encontrado", "Unidade não encontrada.");
    const logo = data.config && typeof data.config === "object" ? data.config.logo_url : null;
    return {
      ok: true,
      unidade: { nome: data.nome_fantasia || data.nome || "", logo_url: typeof logo === "string" && /^https?:\/\//.test(logo) ? logo : null },
    };
  } catch {
    return falha(503, "indisponivel", "Indisponível no momento.");
  }
}
