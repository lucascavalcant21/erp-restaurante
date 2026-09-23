// ─── DOMÍNIO & REGRAS DE NEGÓCIO DE COMPRAS E RECEBIMENTO ──────────────────────

/**
 * Converte a quantidade na unidade de uso (ex: 50.000g) para unidades de embalagem (ex: 2 sacos de 25kg).
 */
export function converterQuantidadeParaEmbalagem(quantidadeBase, tamanhoEmbalagem) {
  const base = Number(quantidadeBase) || 0;
  const tam = Number(tamanhoEmbalagem) || 1;
  if (base <= 0) return { quantidadeEmbalagem: 0, sobraBase: 0 };
  const emb = Math.ceil(base / tam);
  return {
    quantidadeEmbalagem: emb,
    quantidadeTotalBase: emb * tam,
    sobraBase: (emb * tam) - base
  };
}

/**
 * Detecta se a ação recomendada é COMPRAR (insumo de terceiro) ou PRODUZIR (pré-preparo interno).
 */
export function classificarAcaoItem(insumo) {
  const tipo = String(insumo?.tipo || "").toLowerCase();
  const departamento = String(insumo?.departamento || "").toLowerCase();
  const nome = String(insumo?.nome || "").toLowerCase();
  
  // Se for explicitamente pré-preparo ou produzido na casa
  if (tipo === "pre_preparo" || tipo === "subreceita" || insumo?.tem_ficha || nome.startsWith("molho") || nome.startsWith("xarope artesanal") || nome.startsWith("pré-")) {
    return "PRODUZIR";
  }
  return "COMPRAR";
}

/**
 * Calcula a lista de necessidades de compras cruzando estoque atual, estoque mínimo/máximo e consumo recorrente.
 */
export function calcularNecessidadeCompra(insumos = [], producoesRecentes = [], opcoes = {}) {
  const margemSeguranca = Number(opcoes.margemSegurancaDias) || 3;
  const itens = [];

  for (const ins of insumos) {
    const saldoAtual = Number(ins.quantidade_atual) || 0;
    const estMin = ins.estoque_minimo !== null && ins.estoque_minimo !== undefined ? Number(ins.estoque_minimo) : null;
    const estMax = ins.estoque_maximo !== null && ins.estoque_maximo !== undefined ? Number(ins.estoque_maximo) : null;
    const tamEmbalagem = Number(ins.tamanho_embalagem) || 1;
    const precoUnitario = Number(ins.custo_unitario) || Number(ins.preco_normalizado) || 0;

    // Calcular se há escassez pelo mínimo cadastrado ou falta total
    let precisaReposicao = false;
    let qtdSugeridaBase = 0;

    if (estMin !== null) {
      if (saldoAtual <= estMin) {
        precisaReposicao = true;
        const alvo = estMax && estMax > estMin ? estMax : (estMin * 2 || 1);
        qtdSugeridaBase = Math.max(0, alvo - saldoAtual);
      }
    } else {
      // Se não tem estoque mínimo definido, avisa quando zera
      if (saldoAtual <= 0) {
        precisaReposicao = true;
        qtdSugeridaBase = tamEmbalagem;
      }
    }

    if (!precisaReposicao) continue;

    const acao = classificarAcaoItem(ins);
    const { quantidadeEmbalagem, quantidadeTotalBase } = converterQuantidadeParaEmbalagem(qtdSugeridaBase, tamEmbalagem);
    const custoEstimadoTotal = quantidadeTotalBase * precoUnitario;

    itens.push({
      insumo_id: ins.id || ins.insumo_id,
      nome: ins.nome,
      departamento: ins.departamento || "cozinha",
      unidade_medida: ins.unidade_medida || "un",
      saldo_atual: saldoAtual,
      estoque_minimo: estMin,
      estoque_maximo: estMax,
      tamanho_embalagem: tamEmbalagem,
      quantidade_sugerida_base: qtdSugeridaBase,
      quantidade_sugerida_embalagem: quantidadeEmbalagem,
      preco_unitario_estimado: precoUnitario,
      custo_estimado_total: custoEstimadoTotal,
      fornecedor_id: ins.fornecedor_atual_id || null,
      fornecedor_nome: ins.fornecedor_nome || ins.fornecedor || "Não informado",
      acao: acao, // "COMPRAR" ou "PRODUZIR"
    });
  }

  return itens.sort((a, b) => {
    if (a.acao !== b.acao) return a.acao === "COMPRAR" ? -1 : 1;
    return b.custo_estimado_total - a.custo_estimado_total;
  });
}

/**
 * Agrupa os itens com ação COMPRAR por fornecedor para geração automática de pedidos.
 */
export function agruparNecessidadesPorFornecedor(itensNecessidade = [], fornecedores = []) {
  const mapaForn = new Map(fornecedores.map(f => [f.id, f]));
  const grupos = new Map();

  const apenasComprar = itensNecessidade.filter(i => i.acao === "COMPRAR");

  for (const item of apenasComprar) {
    const fornId = item.fornecedor_id || "sem_fornecedor";
    const fornObj = mapaForn.get(fornId);
    const fornNome = fornObj ? fornObj.nome : (item.fornecedor_nome || "Fornecedor Não Cadastrado");

    if (!grupos.has(fornId)) {
      grupos.set(fornId, {
        fornecedor_id: fornId === "sem_fornecedor" ? null : fornId,
        fornecedor_nome: fornNome,
        telefone: fornObj?.telefone || "",
        itens: [],
        valor_total_estimado: 0
      });
    }

    const grupo = grupos.get(fornId);
    grupo.itens.push(item);
    grupo.valor_total_estimado += item.custo_estimado_total;
  }

  return Array.from(grupos.values());
}

/**
 * Valida divergência de preços entre o contratado/esperado e o valor cobrado na nota.
 */
export function validarDivergenciaPreco(precoEsperado, precoCobrado, toleranciaPct = 5) {
  const esp = Number(precoEsperado) || 0;
  const cob = Number(precoCobrado) || 0;
  if (esp <= 0) return { divergencia: false, percentual: 0, nivel: "normal" };

  const diferenca = cob - esp;
  const percentual = (diferenca / esp) * 100;

  if (Math.abs(percentual) >= toleranciaPct) {
    return {
      divergencia: true,
      percentual: Number(percentual.toFixed(2)),
      nivel: percentual > 0 ? (percentual > 15 ? "critico" : "alerta") : "desconto",
      mensagem: percentual > 0
        ? `⚠️ Preço R$ ${cob.toFixed(2)} está ${percentual.toFixed(1)}% acima do esperado (R$ ${esp.toFixed(2)})`
        : `🎉 Preço R$ ${cob.toFixed(2)} está ${Math.abs(percentual).toFixed(1)}% abaixo do esperado (R$ ${esp.toFixed(2)})`
    };
  }

  return { divergencia: false, percentual: Number(percentual.toFixed(2)), nivel: "normal" };
}

/**
 * Formata o texto do Pedido de Compra para envio direto via WhatsApp.
 */
export function formatarTextoPedidoWhatsApp(pedido, itens = [], nomeEmpresa = "HÉFISTO ERP") {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  let msg = `🛒 *PEDIDO DE COMPRA — ${nomeEmpresa}*\n`;
  msg += `📅 *Data*: ${dataHoje}\n`;
  if (pedido.numero_pedido) msg += `📋 *Pedido Nº*: ${pedido.numero_pedido}\n`;
  if (pedido.fornecedor_nome) msg += `🏢 *Fornecedor*: ${pedido.fornecedor_nome}\n`;
  msg += `─────────────────────────\n\n`;

  let total = 0;
  itens.forEach((item, idx) => {
    const qtdEmb = item.quantidade_pedida_embalagem || item.quantidade_sugerida_embalagem || 1;
    const tamEmb = item.tamanho_embalagem || 1;
    const un = item.unidade_medida || "un";
    const preco = item.preco_unitario_estimado || 0;
    const subtotal = item.valor_total_estimado || (qtdEmb * preco);
    total += subtotal;

    msg += `${idx + 1}. *${item.nome}*\n`;
    msg += `   └ Qtd: *${qtdEmb} cx/saco(s)* (cada com ${tamEmb} ${un})\n`;
    if (preco > 0) msg += `   └ Valor Est.: R$ ${preco.toFixed(2)} | Subtotal: R$ ${subtotal.toFixed(2)}\n`;
    msg += `\n`;
  });

  msg += `─────────────────────────\n`;
  if (total > 0) msg += `💰 *VALOR TOTAL ESTIMADO*: *R$ ${total.toFixed(2)}*\n\n`;
  msg += `Favor confirmar recebimento e previsão de entrega. Obrigado!`;

  return encodeURIComponent(msg);
}
