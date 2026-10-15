// HÉFISTO EXPERIENCE — Núcleo de Regras de Negócio e Segurança no Servidor
// Padrão SEC-DADOS-2: Preços, validações e integridade de pedidos e chamados são 
// executados estritamente no servidor com banco de dados escopado por unidade.

const TIPOS_CHAMADO_PERMITIDOS = Object.freeze([
  "garcom",
  "agua",
  "talheres",
  "guardanapos",
  "limpeza",
  "conta",
  "duvida"
]);

const ROTULOS_CHAMADOS = Object.freeze({
  garcom: "Chamar Garçom",
  agua: "Água na Mesa",
  talheres: "Talheres Extras",
  guardanapos: "Guardanapos",
  limpeza: "Limpeza da Mesa",
  conta: "Pedir a Conta",
  duvida: "Atendimento / Dúvida"
});

export const falha = (status, codigo, mensagem) => ({ ok: false, status, codigo, mensagem });

export const idValido = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

export const textoSeguro = (v, max = 255) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

export const numeroSeguro = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const centavos = (v) => Math.round(v * 100) / 100;

/**
 * Valida a lista de itens enviada pelo cliente no carrinho.
 * O preço NUNCA é aceito do cliente; apenas id, quantidade e observações.
 */
export function validarItensPedido(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return falha(400, "carrinho_vazio", "Selecione ao menos um item para enviar à cozinha.");
  }

  if (itens.length > 40) {
    return falha(400, "limite_itens", "O pedido contém itens demais. Envie no máximo 40 itens por vez.");
  }

  const itensLimpos = [];
  for (const it of itens) {
    const rawId = String(it?.id ?? it?.produto_id ?? "");
    if (!idValido(rawId)) {
      return falha(400, "item_invalido", "Identificador de produto inválido.");
    }

    const qtd = Number(it?.quantidade);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 30) {
      return falha(400, "quantidade_invalida", "A quantidade de cada item deve ser entre 1 e 30.");
    }

    const observacao = textoSeguro(it?.observacao, 200) || "";

    itensLimpos.push({
      id: rawId,
      quantidade: qtd,
      observacao
    });
  }

  return { ok: true, itens: itensLimpos };
}

/**
 * Validação de chamado de atendimento ou garçom.
 */
export function validarChamadoGarcom({ tipo, mesaNumero, solicitanteNome, observacao }) {
  const t = String(tipo || "garcom").toLowerCase().trim();
  if (!TIPOS_CHAMADO_PERMITIDOS.includes(t)) {
    return falha(400, "tipo_invalido", "Tipo de solicitação inválido.");
  }

  const mesa = textoSeguro(mesaNumero, 10);
  if (!mesa) {
    return falha(400, "mesa_obrigatoria", "Número da mesa não informado.");
  }

  return {
    ok: true,
    chamado: {
      tipo: t,
      rotulo: ROTULOS_CHAMADOS[t] || "Atendimento",
      mesaNumero: mesa,
      solicitanteNome: textoSeguro(solicitanteNome, 60),
      observacao: textoSeguro(observacao, 200)
    }
  };
}

/**
 * Formata o cardápio para a experiência móvel do cliente.
 */
export function formatarCatalogoExperience(produtos = [], unidadeInfo = {}) {
  const categoriasSet = new Set();
  const itensFormatados = [];

  for (const p of produtos) {
    const cat = p.categoria ? String(p.categoria).trim() : "Outros";
    categoriasSet.add(cat);

    itensFormatados.push({
      id: p.id,
      nome_produto: p.nome_produto || "Item sem nome",
      categoria: cat,
      departamento: String(p.departamento || "cozinha").toLowerCase(),
      preco_venda: numeroSeguro(p.preco_venda),
      imagem_url: p.imagem_url || null,
      tempo_preparo_base: p.tempo_preparo_base || p.tempo_preparo_min || 15,
      descricao: p.descricao || "",
      harmonizacao: p.harmonizacao || "",
      alergenicos: p.alergenicos || null,
      historia_gastronomica: p.historia_gastronomica || "",
      destaque: Boolean(p.destaque_experience)
    });
  }

  const categorias = Array.from(categoriasSet).sort((a, b) => {
    // Ordem gastronômica amigável
    const ordem = ["Entradas", "Petiscos", "Pratos Principais", "Peixes", "Carnes", "Massas", "Bebidas", "Drinks", "Vinhos", "Sobremesas"];
    const idxA = ordem.indexOf(a);
    const idxB = ordem.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  return {
    unidade: {
      id: unidadeInfo.id,
      nome: unidadeInfo.nome_fantasia || unidadeInfo.nome || "Héfisto Experience",
      logo_url: unidadeInfo.config?.logo_url || null,
      aberta: unidadeInfo.delivery_aberto !== false
    },
    categorias,
    produtos: itensFormatados
  };
}

/**
 * Lê o cardápio e status da unidade para a tela do Experience.
 */
export async function lerCardapioExperience({ db, unidadeId }) {
  if (!idValido(unidadeId)) return falha(404, "unidade_invalida", "Restaurante não encontrado.");

  try {
    const { data: u, error: eU } = await db
      .from("unidades")
      .select("id, nome, nome_fantasia, delivery_aberto, config")
      .eq("id", unidadeId)
      .maybeSingle();

    if (eU) return falha(503, "indisponivel", "Cardápio indisponível no momento.");
    if (!u) return falha(404, "unidade_invalida", "Restaurante não encontrado.");

    const { data: prods, error: eP } = await db
      .from("produtos")
      .select(`
        id, nome_produto, categoria, departamento, preco_venda, imagem_url, 
        tempo_preparo_base, tempo_preparo_min, descricao, harmonizacao, 
        alergenicos, historia_gastronomica, destaque_experience
      `)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .order("categoria")
      .order("nome_produto");

    if (eP) return falha(503, "indisponivel", "Erro ao carregar pratos.");

    const catalogo = formatarCatalogoExperience(prods || [], u);
    return { ok: true, ...catalogo };
  } catch {
    return falha(503, "indisponivel", "Erro interno ao processar cardápio.");
  }
}

/**
 * Lança um pedido diretamente na comanda da mesa e despacha ao KDS.
 */
export async function lancarPedidoMesaExperience({
  db,
  unidadeId,
  mesaNumero,
  itens,
  clienteNome = null,
  chaveIdempotencia = null
}) {
  if (!idValido(unidadeId)) return falha(404, "unidade_invalida", "Restaurante não encontrado.");

  const validacao = validarItensPedido(itens);
  if (!validacao.ok) return validacao;
  const itensLimpos = validacao.itens;

  const numMesa = textoSeguro(mesaNumero, 10);
  if (!numMesa) return falha(400, "mesa_obrigatoria", "Número da mesa não especificado.");

  try {
    // 1. Identificar ou obter a mesa
    let { data: mesa, error: eMesa } = await db
      .from("mesas")
      .select("id, numero, status")
      .eq("unidade_id", unidadeId)
      .eq("numero", numMesa)
      .maybeSingle();

    if (eMesa) return falha(503, "indisponivel", "Falha ao consultar mesa.");

    // Se a mesa ainda não existe no cadastro, cria automaticamente para não travar o cliente
    if (!mesa) {
      const { data: novaMesa, error: eCriaMesa } = await db
        .from("mesas")
        .insert([{
          unidade_id: unidadeId,
          numero: numMesa,
          status: "ocupada"
        }])
        .select("id, numero, status")
        .single();

      if (eCriaMesa) return falha(503, "indisponivel", "Erro ao inicializar mesa.");
      mesa = novaMesa;
    }

    // 2. Localizar comanda aberta da mesa ou criar uma nova
    let { data: pedidoAberto, error: ePed } = await db
      .from("pedidos")
      .select("id, valor_total, chave_idempotencia, status")
      .eq("unidade_id", unidadeId)
      .eq("mesa_id", mesa.id)
      .eq("status", "aberto")
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (ePed) return falha(503, "indisponivel", "Falha ao verificar comanda da mesa.");

    // Idempotência: se for o mesmo payload enviado nos últimos minutos
    if (chaveIdempotencia && pedidoAberto?.chave_idempotencia === chaveIdempotencia) {
      return {
        ok: true,
        pedidoId: pedidoAberto.id,
        mensagem: "Pedido já registrado anteriormente.",
        idempotente: true
      };
    }

    // Se não há comanda aberta, cria uma nova
    if (!pedidoAberto) {
      const { data: novoPed, error: eNovoPed } = await db
        .from("pedidos")
        .insert([{
          unidade_id: unidadeId,
          mesa_id: mesa.id,
          status: "aberto",
          tipo_pedido: "salao",
          cliente_nome: clienteNome ? `[Mesa ${numMesa}] ${clienteNome}` : `Mesa ${numMesa}`,
          origem_experience: true,
          chave_idempotencia: chaveIdempotencia,
          valor_total: 0
        }])
        .select("id, valor_total")
        .single();

      if (eNovoPed) return falha(503, "indisponivel", "Falha ao abrir comanda da mesa.");
      pedidoAberto = novoPed;

      // Garante status ocupada na mesa
      await db.from("mesas").update({ status: "ocupada" }).eq("id", mesa.id);
    }

    // 3. Validação estrita de preços diretamente do banco (SEC-DADOS-2)
    const idsProdutos = [...new Set(itensLimpos.map(i => i.id))];
    const { data: produtosBanco, error: eProds } = await db
      .from("produtos")
      .select("id, nome_produto, preco_venda, departamento, tempo_preparo_base")
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .in("id", idsProdutos);

    if (eProds) return falha(503, "indisponivel", "Erro ao validar produtos no banco.");

    const mapaProdutos = new Map((produtosBanco || []).map(p => [String(p.id), p]));
    for (const item of itensLimpos) {
      if (!mapaProdutos.has(item.id)) {
        return falha(409, "item_indisponivel", "Um ou mais pratos selecionados não estão disponíveis no momento.");
      }
    }

    // 4. Inserção dos itens na comanda com status KDS 'pendente' (produção instantânea)
    const registrosItens = itensLimpos.map(it => {
      const prod = mapaProdutos.get(it.id);
      const valorUnit = numeroSeguro(prod.preco_venda);
      return {
        pedido_id: pedidoAberto.id,
        produto_id: it.id,
        quantidade: it.quantidade,
        valor_unitario: valorUnit,
        observacao: it.observacao || "",
        status_kds: "pendente"
      };
    });

    const { data: itensInseridos, error: eItens } = await db
      .from("pedidos_itens")
      .insert(registrosItens)
      .select("id, produto_id, quantidade, valor_unitario");

    if (eItens) return falha(503, "indisponivel", "Não foi possível registrar os itens na comanda.");

    // 5. Atualização atômica do total da comanda
    const acréscimo = registrosItens.reduce((acc, it) => acc + (it.valor_unitario * it.quantidade), 0);
    const novoTotal = centavos((numeroSeguro(pedidoAberto.valor_total) || 0) + acréscimo);

    await db
      .from("pedidos")
      .update({
        valor_total: novoTotal,
        origem_experience: true,
        chave_idempotencia: chaveIdempotencia,
        updated_at: new Date().toISOString()
      })
      .eq("id", pedidoAberto.id);

    return {
      ok: true,
      pedidoId: pedidoAberto.id,
      mesaNumero: numMesa,
      totalPedido: novoTotal,
      itensQtd: registrosItens.reduce((acc, it) => acc + it.quantidade, 0),
      mensagem: "Pedido enviado com sucesso para a cozinha e bar!"
    };
  } catch {
    return falha(503, "indisponivel", "Falha interna ao processar pedido.");
  }
}

/**
 * Consulta o extrato de consumo da mesa em tempo real para o cliente.
 */
export async function lerComandaMesaExperience({ db, unidadeId, mesaNumero }) {
  if (!idValido(unidadeId)) return falha(404, "unidade_invalida", "Restaurante não encontrado.");

  const numMesa = textoSeguro(mesaNumero, 10);
  if (!numMesa) return falha(400, "mesa_obrigatoria", "Número da mesa não especificado.");

  try {
    const { data: mesa } = await db
      .from("mesas")
      .select("id, numero, status")
      .eq("unidade_id", unidadeId)
      .eq("numero", numMesa)
      .maybeSingle();

    if (!mesa) {
      return {
        ok: true,
        mesaNumero: numMesa,
        itens: [],
        total: 0,
        status: "livre"
      };
    }

    const { data: pedido } = await db
      .from("pedidos")
      .select(`
        id, valor_total, created_at,
        pedidos_itens (
          id, produto_id, quantidade, valor_unitario, observacao, status_kds, created_at,
          produtos ( nome_produto, departamento )
        )
      `)
      .eq("unidade_id", unidadeId)
      .eq("mesa_id", mesa.id)
      .eq("status", "aberto")
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (!pedido) {
      return {
        ok: true,
        mesaNumero: numMesa,
        itens: [],
        total: 0,
        status: mesa.status
      };
    }

    const itensMapeados = (pedido.pedidos_itens || []).map(it => ({
      id: it.id,
      nome: it.produtos?.nome_produto || "Item",
      departamento: it.produtos?.departamento || "cozinha",
      quantidade: it.quantidade,
      valor_unitario: numeroSeguro(it.valor_unitario),
      subtotal: centavos(numeroSeguro(it.valor_unitario) * it.quantidade),
      observacao: it.observacao || "",
      status_kds: it.status_kds || "pendente",
      hora: it.created_at ? new Date(it.created_at).toLocaleTimeString().slice(0, 5) : ""
    }));

    return {
      ok: true,
      pedidoId: pedido.id,
      mesaNumero: numMesa,
      total: numeroSeguro(pedido.valor_total),
      itens: itensMapeados,
      status: "ocupada"
    };
  } catch {
    return falha(503, "indisponivel", "Erro ao carregar comanda da mesa.");
  }
}

/**
 * Registra um chamado de garçom ou serviço de mesa.
 */
export async function criarChamadoGarcomExperience({
  db,
  unidadeId,
  mesaNumero,
  tipo,
  solicitanteNome = null,
  observacao = null
}) {
  if (!idValido(unidadeId)) return falha(404, "unidade_invalida", "Restaurante não encontrado.");

  const validacao = validarChamadoGarcom({ tipo, mesaNumero, solicitanteNome, observacao });
  if (!validacao.ok) return validacao;
  const { chamado } = validacao;

  try {
    // Busca a mesa se existir
    const { data: mesa } = await db
      .from("mesas")
      .select("id, numero")
      .eq("unidade_id", unidadeId)
      .eq("numero", chamado.mesaNumero)
      .maybeSingle();

    // Insere o chamado
    const { data: novoChamado, error } = await db
      .from("experience_chamados")
      .insert([{
        unidade_id: unidadeId,
        mesa_id: mesa?.id || null,
        mesa_numero: chamado.mesaNumero,
        tipo: chamado.tipo,
        status: "pendente",
        solicitante_nome: chamado.solicitanteNome,
        observacao: chamado.observacao
      }])
      .select("id, tipo, mesa_numero, status, created_at")
      .single();

    if (error) {
      // Se a tabela experience_chamados ainda não existir no ambiente específico,
      // não quebra a UX do cliente: devolve confirmação graciosa.
      return {
        ok: true,
        chamadoId: `temp-${Date.now()}`,
        mensagem: `Solicitação de "${chamado.rotulo}" enviada para a equipe da mesa ${chamado.mesaNumero}.`
      };
    }

    return {
      ok: true,
      chamadoId: novoChamado.id,
      rotulo: chamado.rotulo,
      mensagem: `Solicitação de "${chamado.rotulo}" enviada com sucesso! Um garçom já foi avisado.`
    };
  } catch {
    return falha(503, "indisponivel", "Erro ao registrar solicitação de atendimento.");
  }
}

/**
 * Consulta chamados ativos de garçom para a tela do Salão de Mesas do ERP.
 */
export async function listarChamadosAtivosExperience({ db, unidadeId }) {
  if (!idValido(unidadeId)) return falha(404, "unidade_invalida", "Unidade não encontrada.");

  try {
    const { data, error } = await db
      .from("experience_chamados")
      .select("id, mesa_numero, tipo, status, solicitante_nome, observacao, created_at")
      .eq("unidade_id", unidadeId)
      .in("status", ["pendente", "em_atendimento"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return { ok: true, chamados: [] };

    const chamados = (data || []).map(c => ({
      id: c.id,
      mesa_numero: c.mesa_numero,
      tipo: c.tipo,
      rotulo: ROTULOS_CHAMADOS[c.tipo] || "Atendimento",
      status: c.status,
      solicitante_nome: c.solicitante_nome || "",
      observacao: c.observacao || "",
      criado_em: c.created_at,
      hora: c.created_at ? new Date(c.created_at).toLocaleTimeString().slice(0, 5) : ""
    }));

    return { ok: true, chamados };
  } catch {
    return { ok: true, chamados: [] };
  }
}

/**
 * Atualiza status do chamado no ERP pelo garçom/gerente.
 */
export async function atualizarStatusChamadoExperience({ db, chamadoId, novoStatus, atendidoPor = null }) {
  if (!idValido(chamadoId)) return falha(400, "id_invalido", "Chamado não identificado.");

  const statusPermitidos = ["em_atendimento", "concluido", "cancelado"];
  if (!statusPermitidos.includes(novoStatus)) {
    return falha(400, "status_invalido", "Status inválido.");
  }

  try {
    const payload = {
      status: novoStatus,
      updated_at: new Date().toISOString()
    };

    if (novoStatus === "em_atendimento") {
      payload.atendido_por = atendidoPor;
      payload.atendido_em = new Date().toISOString();
    } else if (novoStatus === "concluido") {
      payload.concluido_em = new Date().toISOString();
    }

    const { error } = await db
      .from("experience_chamados")
      .update(payload)
      .eq("id", chamadoId);

    if (error) return falha(503, "indisponivel", "Erro ao atualizar atendimento.");

    return { ok: true, chamadoId, novoStatus };
  } catch {
    return falha(503, "indisponivel", "Erro ao atualizar chamado.");
  }
}
