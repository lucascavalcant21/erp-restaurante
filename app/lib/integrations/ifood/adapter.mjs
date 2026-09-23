import { IntegrationAdapter } from '../core/adapter.mjs';
import { getSupabaseServerClient } from '../../server/supabase-server.mjs';
import { encryptCredentials, decryptCredentials } from '../../server/crypto-vault.mjs';

const IFOOD_API_BASE_URL = process.env.IFOOD_API_BASE || "https://merchant-api.ifood.com.br";
const FINANCIAL_API_VERSION = "v2.1";
const ORDERS_API_VERSION = "v1.0";
const MERCHANT_API_VERSION = "v1.0";
export const IFOOD_POLLING_ENDPOINT = "/order/v1.0/orders:polling";
export const IFOOD_ACKNOWLEDGMENT_ENDPOINT = "/order/v1.0/orders:acknowledgment";

export class IFoodAdapter extends IntegrationAdapter {
  constructor() {
    super({ providerId: 'IFOOD', providerName: 'iFood Merchant API' });
    this.tokenMemoryCache = new Map();
  }

  getCapabilities(config = {}) {
    const authFlow = config.authFlow || config.auth_flow || 'DISTRIBUTED';
    const isDistributed = authFlow === 'DISTRIBUTED';

    return {
      merchant: { status: 'available', detail: 'Listagem de merchants autorizados (API v1.0)' },
      orders: { status: 'available', detail: 'Matching e auditoria de pedidos (API v1.0)' },
      events: {
        polling: { status: 'available', detail: 'Polling oficial com Acknowledgment idempotente' },
        webhook: isDistributed 
          ? { status: 'unsupported_for_auth_flow', detail: 'Webhook iFood exige autenticação centralizada em homologação' }
          : { status: 'available', detail: 'Inbox Webhook centralizado' },
      },
      catalog: { status: 'available', detail: 'Mapeamento De/Para de cardápio' },
      financial: { status: 'available', detail: 'Financial API v2.1 (sales, periods, payments, liability)' },
      analytics: { status: 'available', detail: 'Métricas de desempenho e conciliação por canal' },
    };
  }

  /**
   * Passo A do OAuth 2.0 Distribuído: Solicita userCode e verificationUrl.
   */
  async createUserCode({ clientId } = {}) {
    const id = clientId || process.env.IFOOD_CLIENT_ID;
    if (!id) throw new Error("clientId é obrigatório para gerar o userCode.");

    const body = new URLSearchParams({ clientId: id });
    const res = await this.fetchWithRetry(`${IFOOD_API_BASE_URL}/authentication/v1.0/oauth/userCode`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      throw new Error(`Falha ao obter userCode iFood [HTTP ${res.status}]: ${await res.text()}`);
    }

    return res.json(); // { userCode, authorizationCodeVerifier, verificationUrlComplete, expiresIn }
  }

  /**
   * Obtém token OAuth2 sem fallback silencioso entre DISTRIBUTED e CENTRALIZED.
   */
  async getAccessToken(config = {}) {
    const unidadeId = config.unidadeId || config.unidade_id;
    const authFlow = config.authFlow || config.auth_flow || (unidadeId ? 'DISTRIBUTED' : 'CENTRALIZED');

    const agora = Date.now();
    const cacheKey = unidadeId ? `TENANT_${unidadeId}` : 'CENTRALIZED';

    // 1. Memory Cache
    const inMemory = this.tokenMemoryCache.get(cacheKey);
    if (inMemory && agora < inMemory.expiresAt - 60_000) {
      return inMemory.accessToken;
    }

    let clientId = config.clientId || process.env.IFOOD_CLIENT_ID;
    let clientSecret = config.clientSecret || process.env.IFOOD_CLIENT_SECRET;
    let refreshToken = config.refreshToken;

    if (unidadeId && !config.skipServerLookup) {
      try {
        const supabaseServer = getSupabaseServerClient();
        const { data: secretRow } = await supabaseServer
          .from('integration_secrets')
          .select('credentials_payload, security_state')
          .eq('unidade_id', unidadeId)
          .eq('provider', 'IFOOD')
          .maybeSingle();

        if (secretRow?.credentials_payload) {
          const creds = secretRow.credentials_payload;
          if (creds && typeof creds === 'object') {
            clientId = creds.clientId || clientId;
            // Se security_state for DO_NOT_STORE_PRODUCTION_SECRETS, ignora tokens reais por segurança
            if (secretRow.security_state !== 'DO_NOT_STORE_PRODUCTION_SECRETS') {
              clientSecret = creds.clientSecret || clientSecret;
              refreshToken = creds.refreshToken || refreshToken;
            }

            if (creds.accessToken && creds.expiresAt && agora < creds.expiresAt - 60_000) {
              this.tokenMemoryCache.set(cacheKey, { accessToken: creds.accessToken, expiresAt: creds.expiresAt });
              return creds.accessToken;
            }
          }
        }
      } catch (dbErr) {
        // Ignorar falha de lookup no banco em ambiente isolado/offline de teste unitário
      }
    }

    // REGRA RIGOROSA: DISTRIBUTED sem autorização VÁLIDA exige AUTHORIZATION_REQUIRED (Zero fallback)
    if (authFlow === 'DISTRIBUTED') {
      if (!refreshToken) {
        const err = new Error("Integração iFood no modo distribuído aguardando autorização do usuário no Portal do Parceiro.");
        err.code = "AUTHORIZATION_REQUIRED";
        throw err;
      }

      const bodyParams = new URLSearchParams({
        grantType: "refresh_token",
        clientId: clientId || process.env.IFOOD_CLIENT_ID,
        clientSecret: clientSecret || process.env.IFOOD_CLIENT_SECRET,
        refreshToken,
      });

      const res = await this.fetchWithRetry(`${IFOOD_API_BASE_URL}/authentication/v1.0/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyParams,
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Falha na renovação do token iFood [HTTP ${res.status}]: ${errText}`);
        err.code = res.status === 401 ? "AUTH_EXPIRED" : "ERROR";
        throw err;
      }

      const data = await res.json();
      const newAccessToken = data.accessToken || data.access_token;
      const newRefreshToken = data.refreshToken || data.refresh_token || refreshToken;
      const expiresAt = agora + Number(data.expiresIn || 3600) * 1000;

      this.tokenMemoryCache.set(cacheKey, { accessToken: newAccessToken, expiresAt });

      if (unidadeId) {
        try {
          const supabaseServer = getSupabaseServerClient();
          // NUNCA persistir clientSecret, accessToken ou refreshToken em texto puro no banco enquanto security_state = DO_NOT_STORE_PRODUCTION_SECRETS
          await supabaseServer.from('integration_secrets').upsert([{
            unidade_id: unidadeId,
            provider: 'IFOOD',
            credentials_payload: { clientId, storedAt: new Date().toISOString() },
            security_state: 'DO_NOT_STORE_PRODUCTION_SECRETS',
            updated_at: new Date().toISOString(),
          }], { onConflict: 'unidade_id,provider' });
        } catch {
          // Ignorar em ambiente offline de teste
        }
      }

      return newAccessToken;
    }

    // MODO CENTRALIZED: client_credentials
    if (!clientId || !clientSecret) {
      const err = new Error("Credenciais de acesso centralizadas não configuradas.");
      err.code = "NOT_CONFIGURED";
      throw err;
    }

    const bodyParams = new URLSearchParams({
      grantType: "client_credentials",
      clientId,
      clientSecret,
    });

    const res = await this.fetchWithRetry(`${IFOOD_API_BASE_URL}/authentication/v1.0/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams,
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Autenticação iFood Centralizada falhou [HTTP ${res.status}]: ${errText}`);
      err.code = res.status === 401 ? "AUTH_EXPIRED" : "ERROR";
      throw err;
    }

    const data = await res.json();
    const newAccessToken = data.accessToken || data.access_token;
    const expiresAt = agora + Number(data.expiresIn || 3600) * 1000;

    this.tokenMemoryCache.set(cacheKey, { accessToken: newAccessToken, expiresAt });
    return newAccessToken;
  }

  async fetchWithRetry(url, options = {}, retries = 2) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 && retries > 0) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 1500;
        await new Promise((r) => setTimeout(r, delayMs));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      return res;
    } catch (err) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1000));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  }

  /**
   * Executa requisições à API iFood limpando rigorosamente a propriedade 'config' customizada.
   */
  async apiRequest(path, options = {}) {
    const { config, ...fetchOptions } = options;
    const token = await this.getAccessToken(config || {});

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    };

    const res = await this.fetchWithRetry(`${IFOOD_API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`iFood API ${fetchOptions.method || 'GET'} ${path} [HTTP ${res.status}]: ${errText}`);
      err.code = res.status === 401 ? "AUTH_EXPIRED" : "ERROR";
      throw err;
    }

    if (res.status === 204) return null;
    return res.json();
  }

  /**
   * Consulta eventos via Polling Oficial GET /order/v1.0/orders:polling
   * Suporta resposta como Array direto [...] ou Objeto com { events: [...] }.
   */
  async pollEvents(config = {}) {
    const response = await this.apiRequest(IFOOD_POLLING_ENDPOINT, { config });
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.events)) return response.events;
    return [];
  }

  /**
   * Envia Acknowledgment para eventos processados/consumidos POST /order/v1.0/orders:acknowledgment
   * Body oficial: { acknowledgedEventIds: ["id1", "id2"] }
   */
  async acknowledgeEvents(eventIds = [], config = {}) {
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return { acknowledged: 0 };
    }

    const cleanIds = eventIds
      .map(item => (typeof item === 'object' && item !== null ? String(item.id || item.eventId || item.provider_event_id || '') : String(item)))
      .filter(Boolean);

    if (cleanIds.length === 0) return { acknowledged: 0 };

    const payload = { acknowledgedEventIds: cleanIds };
    await this.apiRequest(IFOOD_ACKNOWLEDGMENT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      config,
    });

    return { acknowledged: cleanIds.length };
  }

  async getStatus(config = {}) {
    try {
      await this.getAccessToken(config);
      return { status: 'CONNECTED', message: 'iFood Merchant API autenticada com sucesso.' };
    } catch (err) {
      if (err.code === 'AUTHORIZATION_REQUIRED') {
        return { status: 'AUTHORIZATION_REQUIRED', message: 'Integração distribuída aguardando autorização no Portal do Parceiro iFood.' };
      }
      if (err.code === 'AUTH_EXPIRED') {
        return { status: 'AUTH_EXPIRED', message: 'Credencial ou token iFood expirado. Necessário reautenticar.' };
      }
      if (err.code === 'NOT_CONFIGURED') {
        return { status: 'NOT_CONFIGURED', message: 'Credenciais do iFood não configuradas.' };
      }
      return { status: 'ERROR', message: `Erro ao comunicar com iFood: ${err.message}` };
    }
  }

  async testConnection(config = {}) {
    try {
      await this.getAccessToken(config);
      const merchants = await this.apiRequest(`/merchant/${MERCHANT_API_VERSION}/merchants`, { config });
      const merchantList = Array.isArray(merchants) ? merchants : (merchants?.data || []);

      return {
        ok: true,
        status: 'CONNECTED',
        message: `Conexão efetuada com sucesso! ${merchantList.length} merchant(s) iFood localizado(s).`,
        merchantDetails: merchantList.map(m => ({
          id: m.id,
          name: m.name || m.corporateName,
          status: m.status || 'ACTIVE',
        })),
      };
    } catch (err) {
      const statusRes = await this.getStatus(config);
      return {
        ok: false,
        status: statusRes.status,
        message: statusRes.message,
      };
    }
  }

  normalizeOrder(order) {
    if (!order || typeof order !== 'object') {
      throw new Error("Objeto de pedido iFood inválido.");
    }

    const orderId = String(order.id || order.orderId || order.correlationId);
    const displayId = String(order.displayId || order.shortId || orderId);

    const subtotal = Number(order.total?.subTotal ?? order.subTotal ?? 0);
    const taxaEntrega = Number(order.total?.deliveryFee ?? order.deliveryFee ?? 0);
    const desconto = Number(order.total?.benefits ?? order.benefits ?? 0);
    const totalBruto = Number(order.total?.orderAmount ?? order.totalPrice ?? (subtotal + taxaEntrega - desconto));

    return {
      source_system: 'IFOOD',
      source_external_id: orderId,
      upstream_system: 'IFOOD',
      upstream_external_id: displayId,
      codigo_venda: `IF-${displayId}`,
      canal_venda: 'IFOOD',
      cliente_nome: order.customer?.name || 'Cliente iFood',
      subtotal,
      desconto,
      taxa_entrega: taxaEntrega,
      valor_bruto: totalBruto,
      valor_final: totalBruto,
      chave_idempotencia: `IFOOD_${orderId}`,
      itens: Array.isArray(order.items) ? order.items.map(i => ({
        external_code: String(i.externalCode || i.id || ''),
        nome: i.name,
        quantidade: Number(i.quantity || 1),
        preco_unitario: Number(i.unitPrice || i.price || 0),
      })) : [],
    };
  }

  /**
   * Normalização Financeira Oficial Financial API v2.1.
   * Separa estritamente data_competencia de expected_payment_date e calcula liability.
   */
  normalizeFinancial(financialRecord) {
    if (!financialRecord || typeof financialRecord !== 'object') {
      throw new Error("Registro financeiro iFood inválido.");
    }

    const gmv = Number(financialRecord.gmv || financialRecord.grossAmount || 0);
    const totalCredit = Number(financialRecord.totalCredit ?? financialRecord.grossAmount ?? gmv);
    const totalDebit = Number(financialRecord.totalDebit ?? (financialRecord.commissionAmount || 0) + (financialRecord.paymentFee || 0));
    const repasseNet = totalCredit - totalDebit;

    const liability = String(financialRecord.liability || 'IFOOD').toUpperCase();
    const isIfoodLiability = liability === 'IFOOD';

    // Datas estritamente separadas
    const dataCompetencia = financialRecord.orderDate || financialRecord.competenceDate || new Date().toISOString().split('T')[0];
    const expectedPaymentDate = financialRecord.expectedPaymentDate || financialRecord.payoutDate || null;

    return {
      period_id: financialRecord.periodId || null,
      transaction_id: String(financialRecord.id || financialRecord.orderId),
      upstream_external_id: String(financialRecord.orderId || financialRecord.displayId || ''),
      gmv,
      total_credit: totalCredit,
      total_debit: totalDebit,
      repasse_liquido: repasseNet,
      liability,
      is_ifood_liability: isIfoodLiability,
      data_competencia: dataCompetencia,
      expected_payment_date: expectedPaymentDate,
      forma_pagamento: financialRecord.paymentMethod || 'IFOOD_ONLINE',
    };
  }

  /**
   * Sincronização Financeira v2.1 com Atualização Idempotente da Mesma Venda.
   * REGRA CRÍTICA: Se a venda já existe (ex: veio via Saipos), atualiza o financeiro SEM criar nova venda,
   * SEM dar segunda baixa em estoque e SEM duplicar CMV.
   */
  async syncFinancial({ unidadeId, merchantId, dateStart, dateEnd, config } = {}) {
    if (!merchantId) {
      throw new Error("merchantId é obrigatório para sincronização financeira do iFood.");
    }

    try {
      const queryParams = new URLSearchParams();
      if (dateStart) queryParams.set("beginDate", dateStart);
      if (dateEnd) queryParams.set("endDate", dateEnd);

      const path = `/financial/${FINANCIAL_API_VERSION}/merchants/${merchantId}/sales?${queryParams.toString()}`;
      const data = await this.apiRequest(path, { config });
      const salesList = Array.isArray(data) ? data : (data?.sales || data?.data || []);

      const supabaseServer = getSupabaseServerClient();
      let atualizadas = 0;

      for (const s of salesList) {
        const normFin = this.normalizeFinancial(s);
        if (!normFin.upstream_external_id) continue;

        // Buscar venda existente pelo upstream_external_id
        const { data: vendaExistente } = await supabaseServer
          .from('vendas')
          .select('id, subtotal, valor_bruto')
          .eq('upstream_external_id', normFin.upstream_external_id)
          .maybeSingle();

        if (vendaExistente) {
          // ATUALIZAÇÃO DA MESMA VENDA (Zero nova venda, zero estoque, zero CMV)
          await supabaseServer
            .from('vendas')
            .update({
              comissao_marketplace: normFin.total_debit,
              valor_liquido_esperado: normFin.is_ifood_liability ? normFin.repasse_liquido : 0,
            })
            .eq('id', vendaExistente.id);

          atualizadas++;
        }
      }

      const totalNet = salesList.reduce((acc, item) => {
        const norm = this.normalizeFinancial(item);
        return acc + (norm.is_ifood_liability ? norm.repasse_liquido : 0);
      }, 0);

      return {
        importedSales: salesList.length,
        updatedExistingSales: atualizadas,
        importedPayouts: 0, // REGRA RIGOROSA: 0 até que a API de payments seja consultada
        totalNet,
        errors: [],
      };
    } catch (err) {
      return {
        importedSales: 0,
        updatedExistingSales: 0,
        importedPayouts: 0,
        totalNet: 0,
        errors: [`Erro ao consultar Financial API v2.1 iFood: ${err.message}`],
      };
    }
  }

  async fetchPeriods(merchantId, config = {}) {
    return this.apiRequest(`/financial/${FINANCIAL_API_VERSION}/merchants/${merchantId}/periods`, { config });
  }

  async fetchPayments(merchantId, config = {}) {
    return this.apiRequest(`/financial/${FINANCIAL_API_VERSION}/merchants/${merchantId}/payments`, { config });
  }
}
