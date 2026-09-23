/**
 * IntegrationAdapter — Contrato Abstrato Base para Integrações do ERP HÉFISTO.
 * 
 * Todo provedor de integração (iFood, Saipos, WhatsApp, etc.) deve estender esta
 * classe e declarar explicitamente suas capacidades e status real.
 */

export class IntegrationAdapter {
  /**
   * @param {object} params
   * @param {string} params.providerId Identificador único do provedor ('IFOOD', 'SAIPOS', etc.)
   * @param {string} params.providerName Nome legível do provedor
   */
  constructor({ providerId, providerName }) {
    if (!providerId || !providerName) {
      throw new Error("IntegrationAdapter exige providerId e providerName.");
    }
    this.providerId = providerId.toUpperCase();
    this.providerName = providerName;
  }

  /**
   * Declara explicitamente a matriz de capacidades reais suportadas pelo adapter.
   * Valores por capacidade: 'available' | 'pending_credentials' | 'unknown' | 'unsupported'
   * @returns {Record<string, { status: string, detail?: string }>}
   */
  getCapabilities() {
    return {
      orders: { status: 'unknown' },
      sales: { status: 'unknown' },
      catalog: { status: 'unknown' },
      financial: { status: 'unknown' },
      events: { status: 'unknown' },
      analytics: { status: 'unknown' },
    };
  }

  /**
   * Retorna o status de conexão da unidade com este provedor.
   * Status: 'NOT_CONFIGURED' | 'PENDING_CREDENTIALS' | 'CONNECTED' | 'DEGRADED' | 'ERROR' | 'DISABLED'
   * @param {object} config
   * @returns {Promise<{ status: string, lastSyncAt?: string, error?: string }>}
   */
  async getStatus(config = {}) {
    return { status: 'NOT_CONFIGURED' };
  }

  /**
   * Executa teste de conexão real com as credenciais fornecidas (server-side).
   * @param {object} config
   * @returns {Promise<{ ok: boolean, status: string, message: string, merchantDetails?: object }>}
   */
  async testConnection(config = {}) {
    throw new Error(`testConnection não implementado para ${this.providerId}`);
  }

  /**
   * Normaliza um pedido recebido do provedor em objeto padrão Héfisto.
   * Preserva rastreabilidade de source_system e upstream_system.
   * @param {object} rawData
   * @returns {object} Pedido/Venda normalizado
   */
  normalizeOrder(rawData) {
    throw new Error(`normalizeOrder não implementado para ${this.providerId}`);
  }

  /**
   * Normaliza dados financeiros (vendas, comissões, taxas, repasses net).
   * @param {object} rawFinancialData
   * @returns {object} Estrutura financeira normalizada para contas_receber e lotes_repasses
   */
  normalizeFinancial(rawFinancialData) {
    throw new Error(`normalizeFinancial não implementado para ${this.providerId}`);
  }

  /**
   * Sincroniza eventos/pedidos de forma idempotente.
   * @param {object} params
   * @returns {Promise<{ processed: number, skipped: number, errors: string[] }>}
   */
  async syncOrders(params = {}) {
    return { processed: 0, skipped: 0, errors: ["Sincronização de pedidos pendente de credenciais ou não suportada"] };
  }

  /**
   * Sincroniza dados financeiros reais oficiais com a engine de recebíveis do ERP.
   * @param {object} params
   * @returns {Promise<{ importedSales: number, importedPayouts: number, totalNet: number, errors: string[] }>}
   */
  async syncFinancial(params = {}) {
    return { importedSales: 0, importedPayouts: 0, totalNet: 0, errors: ["Sincronização financeira pendente de credenciais ou não suportada"] };
  }

  /**
   * Health Check do adaptador.
   * @returns {Promise<{ healthy: boolean, provider: string, timestamp: string, message: string }>}
   */
  async healthCheck() {
    return {
      healthy: true,
      provider: this.providerId,
      timestamp: new Date().toISOString(),
      message: "Adapter instanciado e operacional.",
    };
  }
}
