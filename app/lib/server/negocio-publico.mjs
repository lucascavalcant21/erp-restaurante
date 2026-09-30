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

export async function lerCardapioPublico({ db, unidade }) {
  if (!idValido(unidade)) return falha(404, "nao_encontrado", "Cardápio não encontrado.");
  try {
    const { data: u, error: eU } = await db.from("unidades")
      .select("id, nome, nome_fantasia, delivery_aberto, taxa_entrega_padrao").eq("id", unidade).maybeSingle();
    if (eU) return falha(503, "indisponivel", "Cardápio indisponível no momento.");
    if (!u) return falha(404, "nao_encontrado", "Cardápio não encontrado.");
    const { data: prods, error: eP } = await db.from("produtos")
      .select("id, nome_produto, preco_venda, categoria")
      .eq("unidade_id", unidade).eq("ativo", true)
      .order("categoria").order("nome_produto");
    if (eP) return falha(503, "indisponivel", "Cardápio indisponível no momento.");
    return {
      ok: true,
      unidade: {
        nome: u.nome_fantasia || u.nome || "",
        aberta: u.delivery_aberto !== false,
        taxa_entrega: numero(u.taxa_entrega_padrao),
      },
      produtos: (prods || []).map((p) => ({
        id: p.id, nome_produto: p.nome_produto, preco_venda: numero(p.preco_venda), categoria: p.categoria || "Outros",
      })),
    };
  } catch {
    return falha(503, "indisponivel", "Cardápio indisponível no momento.");
  }
}

const TIPOS_PEDIDO = ["delivery", "qrcode"];

/** Valida o pedido do cardápio. Só entram id e quantidade dos itens — preço não. */
export function validarPedidoPublico(corpo) {
  const c = corpo && typeof corpo === "object" ? corpo : {};
  if (!idValido(c.unidade)) return falha(400, "unidade_invalida", "Link inválido.");
  const cli = c.cliente && typeof c.cliente === "object" ? c.cliente : {};
  const tipo = TIPOS_PEDIDO.includes(cli.tipo) ? cli.tipo : null;
  if (!tipo) return falha(400, "parametro_invalido", "Escolha delivery ou mesa.");
  let nome = texto(cli.nome, 80);
  if (!nome || nome.length < 2) return falha(400, "parametro_invalido", "Digite seu nome.");
  const tel = soDigitos(cli.telefone);
  if (tel.length < 10 || tel.length > 13) return falha(400, "parametro_invalido", "Digite seu WhatsApp com DDD.");
  const endereco = texto(cli.endereco, 300);
  if (tipo === "delivery" && !endereco) return falha(400, "parametro_invalido", "Digite seu endereço.");
  const mesa = texto(cli.mesa, 10);
  if (mesa && !/^[A-Za-z0-9-]{1,10}$/.test(mesa)) return falha(400, "parametro_invalido", "Mesa inválida.");
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
  return {
    ok: true,
    pedido: {
      unidade: c.unidade, tipo, nome, telefone: texto(cli.telefone, 20),
      endereco: tipo === "delivery" ? endereco : null, troco: texto(cli.troco, 20), itens: limpos,
    },
  };
}

/**
 * Grava o pedido. Preço de cada item e total vêm do banco; o que o navegador
 * mandou de preço é ignorado. Pedido e itens: se os itens falharem, o pedido
 * é apagado — o cliente nunca fica com um pedido vazio na cozinha.
 */
export async function criarPedidoPublico({ db, pedido, agora = Date.now(), limitePorTelefone = 5 }) {
  try {
    const { data: u, error: eU } = await db.from("unidades")
      .select("id, delivery_aberto, taxa_entrega_padrao").eq("id", pedido.unidade).maybeSingle();
    if (eU) return falha(503, "indisponivel", "Não foi possível enviar agora.");
    if (!u) return falha(404, "unidade_invalida", "Link inválido.");
    if (u.delivery_aberto === false) return falha(409, "loja_fechada", "A loja está fechada no momento.");

    const desde = new Date(agora - 10 * 60 * 1000).toISOString();
    const { count, error: eC } = await db.from("pedidos").select("id", { count: "exact", head: true })
      .eq("unidade_id", pedido.unidade).eq("cliente_telefone", pedido.telefone).gte("created_at", desde);
    if (!eC && (count || 0) >= limitePorTelefone) {
      return falha(429, "limite", "Recebemos vários pedidos seguidos deste número. Aguarde alguns minutos.");
    }

    const ids = [...new Set(pedido.itens.map((i) => i.id))];
    const { data: prods, error: eP } = await db.from("produtos")
      .select("id, preco_venda").eq("unidade_id", pedido.unidade).eq("ativo", true).in("id", ids);
    if (eP) return falha(503, "indisponivel", "Não foi possível enviar agora.");
    const preco = new Map((prods || []).map((p) => [String(p.id), numero(p.preco_venda)]));
    if (ids.some((id) => !preco.has(id))) {
      return falha(409, "item_indisponivel", "Um item do carrinho não está mais disponível. Atualize o cardápio.");
    }

    const taxa = pedido.tipo === "delivery" ? numero(u.taxa_entrega_padrao) : 0;
    const total = centavos(pedido.itens.reduce((s, i) => s + preco.get(i.id) * i.quantidade, 0) + taxa);

    const { data: criado, error: eI } = await db.from("pedidos").insert([{
      unidade_id: pedido.unidade,
      status: "novo_online",
      tipo_pedido: pedido.tipo,
      cliente_nome: pedido.nome,
      cliente_telefone: pedido.telefone,
      endereco_entrega: pedido.endereco,
      troco_para: pedido.troco,
      valor_total: total,
    }]).select("id").single();
    if (eI || !criado?.id) return falha(503, "indisponivel", "Não foi possível enviar agora.");

    const { error: eItens } = await db.from("pedidos_itens").insert(pedido.itens.map((i) => ({
      pedido_id: criado.id,
      produto_id: i.id,
      quantidade: i.quantidade,
      valor_unitario: preco.get(i.id),
      observacao: i.observacao,
      status_kds: "aguardando_aceite",
    })));
    if (eItens) {
      await db.from("pedidos").delete().eq("id", criado.id);
      return falha(503, "indisponivel", "Não foi possível enviar agora.");
    }
    return { ok: true, total };
  } catch {
    return falha(503, "indisponivel", "Não foi possível enviar agora.");
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
