import { IntegrationAdapter } from '../core/adapter.mjs';

/**
 * SaiposAdapter — Adaptador para o PDV Saipos no HÉFISTO ERP.
 */
export class SaiposAdapter extends IntegrationAdapter {
  constructor() {
    super({ providerId: 'SAIPOS', providerName: 'Saipos PDV' });
  }

  getCapabilities() {
    return {
      orders: { status: 'pending_credentials', detail: 'Aguardando credenciais e documentação de API oficial da Saipos' },
      sales: { status: 'available', detail: 'Importação via perfil estruturado CSV/JSON (Não é API oficial Saipos)' },
      catalog: { status: 'unknown', detail: 'Sem documentação de catálogo Saipos no ambiente' },
      financial: { status: 'unknown', detail: 'Saipos atua como PDV operacional; financeiro oficial vem do canal/adquirente' },
      events: { status: 'pending_credentials', detail: 'Webhooks/Polling Saipos pendentes de credencial oficial' },
      analytics: { status: 'unsupported', detail: 'Analytics consolidado pelo Héfisto ERP' },
    };
  }

  async getStatus(config = {}) {
    const hasSecret = Boolean(process.env.SAIPOS_INTEGRATION_SECRET || config?.apiKey || config?.secret);
    if (!hasSecret) {
      return {
        status: 'PENDING_CREDENTIALS',
        message: 'Aguardando fornecimento de credenciais oficiais da Saipos API.',
      };
    }

    return {
      status: 'CONFIGURED_UNVERIFIED',
      message: 'Chave de integração Saipos informada, porém pendente de verificação por chamada a endpoint oficial documentado.',
    };
  }

  async testConnection(config = {}) {
    const statusInfo = await this.getStatus(config);

    if (statusInfo.status === 'PENDING_CREDENTIALS') {
      return {
        ok: false,
        status: 'PENDING_CREDENTIALS',
        message: 'Nenhuma credencial ou token oficial da Saipos foi detectado no ambiente.',
      };
    }

    // REGRA RIGOROSA: Não inventar endpoints de health (ex: /health). Responder que não há teste de rede disponível sem endpoint oficial.
    return {
      ok: false,
      status: 'CONFIGURED_UNVERIFIED',
      message: 'Chave configurada. Não existe teste de rede disponível sem endpoint oficial documentado pela Saipos. O estado permanece CONFIGURED_UNVERIFIED até homologação.',
    };
  }

  normalizeOrder(rawData) {
    return this.normalizeImportProfile(rawData);
  }

  /**
   * Normalizador de Perfil Estruturado / Arquivo Legado (IMPORT_PROFILE).
   * EXIGE identificador externo estável (Sem fallback Date.now()).
   */
  normalizeImportProfile(rawData) {
    if (!rawData || typeof rawData !== 'object') {
      throw new Error("Dados da Saipos inválidos para normalização.");
    }

    const saiposId = rawData.id || rawData.saipos_id || rawData.codigo;
    if (!saiposId) {
      return {
        ok: false,
        status: 'NEEDS_REVIEW',
        error: 'MISSING_STABLE_EXTERNAL_ID',
        message: 'O registro recebido não possui um identificador externo estável (id/saipos_id/codigo). Rejeitado para impedir duplicidade.',
      };
    }

    const idEstavel = String(saiposId);
    const canalOriginal = String(rawData.canal || rawData.channel || rawData.origem || 'DELIVERY').toUpperCase();

    // Identifica iFood estritamente por canal ou campo explícito de iFood
    const isIfood = canalOriginal === 'IFOOD' || canalOriginal === 'IFOOD_DELIVERY' || Boolean(rawData.ifood_code || rawData.ifood_id);
    const upstreamSystem = isIfood ? 'IFOOD' : null;
    const upstreamExternalId = isIfood ? String(rawData.ifood_code || rawData.ifood_id || rawData.external_code || '') : null;

    const subtotal = Number(rawData.subtotal || rawData.valor_subtotal || 0);
    const desconto = Number(rawData.desconto || 0);

    // REGRA RIGOROSA: Separação de taxa_entrega (delivery_fee) e taxa_servico (service_charge)
    const taxaEntrega = Number(rawData.delivery_fee || rawData.taxa_entrega || 0);
    const taxaServico = Number(rawData.service_charge || rawData.taxa_servico || 0);
    const comissaoMkt = Number(rawData.comissao_marketplace || 0);
    const totalBruto = subtotal + taxaEntrega + taxaServico - desconto;

    // REGRA RIGOROSA: Pagamento não informado = NAO_INFORMADO (Sem inferir IFOOD_ONLINE automaticamente)
    let formaPagamentoFinal = 'NAO_INFORMADO';
    if (Array.isArray(rawData.pagamentos) && rawData.pagamentos.length > 0) {
      formaPagamentoFinal = String(rawData.pagamentos[0].forma || rawData.pagamentos[0].tipo || 'NAO_INFORMADO').toUpperCase();
    } else if (rawData.forma_pagamento) {
      formaPagamentoFinal = String(rawData.forma_pagamento).toUpperCase();
    }

    return {
      ok: true,
      source_system: 'SAIPOS',
      source_external_id: idEstavel,
      upstream_system: upstreamSystem,
      upstream_external_id: upstreamExternalId,
      codigo_venda: rawData.codigo_venda || `SAIPOS-${idEstavel}`,
      canal_venda: isIfood ? 'IFOOD' : (canalOriginal || 'DELIVERY'),
      cliente_nome: rawData.cliente_nome || rawData.cliente || 'Cliente Saipos',
      subtotal,
      desconto,
      taxa_entrega: taxaEntrega,
      taxa_servico_cobrada: taxaServico,
      comissao_marketplace: comissaoMkt,
      valor_bruto: totalBruto,
      valor_final: totalBruto,
      valor_liquido_esperado: totalBruto - comissaoMkt,
      chave_idempotencia: `SAIPOS_${idEstavel}`,
      split_pagamentos: Array.isArray(rawData.pagamentos) && rawData.pagamentos.length > 0 ? rawData.pagamentos.map(p => ({
        forma_pagamento: String(p.forma || p.tipo || 'NAO_INFORMADO').toUpperCase(),
        adquirente_nome: isIfood ? 'IFOOD' : String(p.adquirente || 'SAIPOS_PDV').toUpperCase(),
        valor: Number(p.valor || totalBruto),
      })) : [{
        forma_pagamento: formaPagamentoFinal,
        adquirente_nome: isIfood ? 'IFOOD' : 'SAIPOS_PDV',
        valor: totalBruto,
      }],
      itens: Array.isArray(rawData.itens) ? rawData.itens.map(i => ({
        external_code: String(i.codigo || i.id || ''),
        nome: i.nome || i.descricao || 'Item Saipos',
        quantidade: Number(i.quantidade || 1),
        preco_unitario: Number(i.preco_unitario || i.preco || 0),
      })) : [],
    };
  }
}
