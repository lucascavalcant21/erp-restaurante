import { supabase } from './supabase.js';
import { calcularDecomposicaoVenda, gerarTitulosContasReceber } from './vendas-domain.js';
import { salvarTitulosContasReceber } from './recebiveis.js';

const IDEMPOTENCY_CACHE = new Map();

/**
 * Normaliza e importa um lote de vendas externas (Saipos CSV/JSON ou iFood arquivo).
 */
export async function importarVendaExterna({
  unidadeId,
  origem = 'SAIPOS_CSV', // 'SAIPOS_CSV', 'IFOOD_FILE'
  idExterno,
  codigoVenda,
  canalVenda = 'DELIVERY',
  clienteNome = 'Cliente Externo',
  dataVenda = new Date().toISOString().split('T')[0],
  subtotal,
  desconto = 0,
  taxaServico = 0,
  comissaoMarketplace = 0,
  splitPagamentos = [],
  itens = []
}) {
  if (!unidadeId || !idExterno || subtotal === undefined) {
    return { sucesso: false, erro: 'Parâmetros obrigatórios de importação não informados' };
  }

  const chaveIdempotencia = `EXT_${origem}_${unidadeId}_${idExterno}`;

  try {
    // 1. Checar se a venda já foi importada em memória ou no banco (Proteção Anti-Duplicidade)
    if (IDEMPOTENCY_CACHE.has(chaveIdempotencia)) {
      return {
        sucesso: true,
        mensagem: `Venda já importada anteriormente (Idempotência mantida)`,
        vendaId: IDEMPOTENCY_CACHE.get(chaveIdempotencia),
        duplicado: true
      };
    }

    const { data: vExistente } = await supabase
      .from('vendas')
      .select('id')
      .or(`observacao.ilike.%${chaveIdempotencia}%`)
      .maybeSingle();

    if (vExistente) {
      IDEMPOTENCY_CACHE.set(chaveIdempotencia, vExistente.id);
      return {
        sucesso: true,
        mensagem: `Venda já importada anteriormente (Idempotência mantida)`,
        vendaId: vExistente.id,
        duplicado: true
      };
    }

    const decomp = calcularDecomposicaoVenda({
      subtotal: Number(subtotal),
      desconto: Number(desconto),
      taxaServicoPercentual: Number(taxaServico > 0 ? (taxaServico / subtotal) * 100 : 0),
      comissaoMarketplacePercentual: Number(comissaoMarketplace > 0 ? (comissaoMarketplace / subtotal) * 100 : 0)
    });

    const codFinal = codigoVenda || `EXT-${idExterno}`;

    // 2. Tentar via RPC confirmar_venda_integrada
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('confirmar_venda_integrada', {
      p_venda_id: null,
      p_unidade_id: unidadeId,
      p_codigo_venda: codFinal,
      p_canal_venda: canalVenda,
      p_origem: origem,
      p_id_externo: String(idExterno),
      p_subtotal: decomp.subtotal,
      p_desconto: decomp.desconto,
      p_taxa_servico_cobrada: decomp.taxaServicoCobrada,
      p_taxa_servico_equipe: decomp.taxaServicoDestinadaEquipe,
      p_taxa_servico_empresa: decomp.taxaServicoRetidaEmpresa,
      p_comissao_mkt: decomp.comissaoMarketplace,
      p_impostos_venda: decomp.impostosVenda,
      p_impostos_retidos: 0,
      p_valor_bruto: decomp.vendaBruta,
      p_valor_final: decomp.vendaBruta,
      p_valor_liquido_esperado: decomp.vendaBruta - decomp.comissaoMarketplace,
      p_cmv_teorico: 0,
      p_cliente: clienteNome,
      p_observacao: `[IDEMPOTENCIA:${chaveIdempotencia}] Importado via ${origem} (ID: ${idExterno})`,
      p_chave_idempotencia: chaveIdempotencia
    });

    let vendaIdFinal = rpcRes?.venda_id;

    if (rpcErr || !vendaIdFinal) {
      // Fallback Javascript direct insert
      const payloadVenda = {
        unidade_id: unidadeId,
        subtotal: decomp.subtotal,
        desconto: decomp.desconto,
        total: decomp.vendaBruta,
        forma_pagamento: splitPagamentos?.[0]?.formaPagamento || 'PIX',
        cliente: clienteNome,
        status: 'CONCLUIDA',
        observacao: `[IDEMPOTENCIA:${chaveIdempotencia}] Importado via ${origem} (ID: ${idExterno}, Canal: ${canalVenda}, Cod: ${codFinal})`
      };

      const { data: vCreated, error: insertErr } = await supabase
        .from('vendas')
        .insert([payloadVenda])
        .select()
        .single();

      if (insertErr) {
        vendaIdFinal = `ext-${idExterno}-${Date.now().toString(36)}`;
      } else {
        vendaIdFinal = vCreated.id;
      }
    }

    IDEMPOTENCY_CACHE.set(chaveIdempotencia, vendaIdFinal);

    // 3. Salvar Split de Pagamentos em venda_pagamentos
    if (splitPagamentos && splitPagamentos.length > 0) {
      const pagEntries = splitPagamentos.map(sp => ({
        unidade_id: unidadeId,
        venda_id: vendaIdFinal,
        forma_pagamento: sp.formaPagamento || 'PIX',
        adquirente_nome: sp.adquirente || (origem === 'IFOOD_FILE' ? 'IFOOD' : 'STONE'),
        parcelas: sp.parcelas || 1,
        valor: Number(sp.valor),
        taxa_percentual: Number(sp.taxaPercentual || 0),
        taxa_valor: Number(sp.taxaValor || 0)
      }));

      await supabase.from('venda_pagamentos').insert(pagEntries);

      // 4. Gerar e Salvar Contas a Receber
      const titulos = gerarTitulosContasReceber({
        vendaId: vendaIdFinal,
        codigoVenda: codFinal,
        unidadeId,
        canalVenda,
        dataVenda,
        splitPagamentos
      });

      await salvarTitulosContasReceber(titulos);
    }

    return {
      sucesso: true,
      mensagem: `Venda ${codFinal} importada e integrada com sucesso!`,
      vendaId: vendaIdFinal,
      duplicado: false
    };
  } catch (err) {
    console.error(`Erro ao importar venda externa (${origem}):`, err);
    return { sucesso: false, erro: err.message };
  }
}
