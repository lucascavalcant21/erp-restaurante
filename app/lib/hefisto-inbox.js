import { hasPermission, canAccessRoute } from "./permissions-catalog.mjs";
import { getProactiveInsights } from "./hefisto-insights.js";
import { getAutomationsForTenant, getAutomationHistory } from "./hefisto-automations.js";
import { fetchEstoque, fetchProducaoDeHoje } from "./estoque.js";
import { fetchContas } from "./financeiro.js";
import { fetchColaboradores } from "./rh.js";
import { fetchPontoHoje } from "./ponto.js";

// Armazenamento em memória do estado de visualização de itens (SEEN)
const seenItemsStore = new Set();

/**
 * Gera fingerprint única determinística para deduplicação global (F10)
 */
export function generateFingerprint(unitId = "matriz", domain = "geral", condition = "alerta", entityId = "") {
  const cleanUnit = String(unitId || "matriz").trim();
  const cleanDomain = String(domain || "geral").trim().toLowerCase();
  const cleanCond = String(condition || "alerta").trim().toLowerCase();
  const cleanEntity = String(entityId || "global").trim().toLowerCase();

  return `${cleanUnit}:${cleanDomain}:${cleanCond}:${cleanEntity}`;
}

/**
 * Marca um item da caixa como VISTO (SEEN)
 * NOTA: SEEN altera o estado de leitura na interface, mas NÃO resolve a condição operacional real.
 */
export function markItemAsSeen(itemId) {
  if (itemId) {
    seenItemsStore.add(itemId);
  }
}

/**
 * Verifica se um item foi marcado como visto
 */
export function isItemSeen(itemId) {
  return seenItemsStore.has(itemId);
}

/**
 * Motor Central da Caixa de Entrada Héfisto ("PRECISA DE VOCÊ" / F10 INBOX)
 */
export async function getHefistoInbox({
  session = null,
  unitId = "unidade-padrao",
  filterDomain = null,
  pendingActions = [] // F2 Ações aguardando confirmação
}) {
  const itemsMap = new Map(); // fingerprint -> InboxItemContract

  const podeVerFinanceiro = !session?.gerenciado || hasPermission(session, "financeiro.cashflow.view") || hasPermission(session, "dashboard.overview.view_values");
  const podeVerContas = !session?.gerenciado || hasPermission(session, "financeiro.cashflow.view");
  const podeVerEstoque = !session?.gerenciado || canAccessRoute(session, "/dashboard/operacao/estoque");
  const podeVerCozinha = !session?.gerenciado || canAccessRoute(session, "/dashboard/operacao/producao");
  const podeVerEquipe = !session?.gerenciado || hasPermission(session, "rh.overview.view");
  const podeVerPonto = !session?.gerenciado || hasPermission(session, "ponto.clock.view");

  const agoraISO = new Date().toISOString();
  const dataHojeISO = agoraISO.slice(0, 10);
  const mesAnoAtual = agoraISO.slice(0, 7);

  // ---------------------------------------------------------------------------
  // FONTE 1: F2 AÇÕES CONTROLADAS AGUARDANDO CONFIRMAÇÃO DO USUÁRIO (APPROVAL)
  // ---------------------------------------------------------------------------
  if (Array.isArray(pendingActions)) {
    for (const act of pendingActions) {
      if (act.actionPreview && act.actionPreview.status === "pending") {
        const fp = generateFingerprint(unitId, "acao", act.actionPreview.actionId, act.actionPreview.productId || act.actionPreview.actionTitle);
        
        itemsMap.set(fp, {
          id: `inbox-act-${act.actionPreview.timestamp || Date.now()}`,
          type: "APPROVAL",
          source: "F2",
          domain: "operacao",
          title: `APROVAÇÃO PENDENTE: ${act.actionPreview.actionTitle}`,
          summary: `${act.actionPreview.productName || ""} — ${act.actionPreview.detailsText || ""}`,
          severity: "CRITICAL",
          status: "WAITING_APPROVAL",
          companyId: unitId,
          userScope: session?.id || "global",
          createdAt: new Date(act.actionPreview.timestamp || Date.now()).toISOString(),
          updatedAt: agoraISO,
          expiresAt: new Date((act.actionPreview.timestamp || Date.now()) + 5 * 60 * 1000).toISOString(),
          evidence: [
            `• Solicitado por: ${session?.nome || "Usuário"}`,
            `• Detalhes: ${act.actionPreview.detailsText}`
          ],
          primaryAction: {
            label: "Revisar / Confirmar",
            type: "REVIEW",
            actionPreview: act.actionPreview
          },
          approvalId: `appr-${act.actionPreview.timestamp}`,
          fingerprint: fp,
          permission: "estoque.overview.view"
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // FONTE 2: OPERACIONAL EXCEÇÕES DIRETAS DOS HUBS (ESTOQUE, FINANCEIRO, RH, COZINHA)
  // ---------------------------------------------------------------------------
  try {
    const [resEstoque, resProducao, resContas, resPonto] = await Promise.allSettled([
      podeVerEstoque ? fetchEstoque(unitId, null) : Promise.resolve(null),
      podeVerCozinha ? fetchProducaoDeHoje(unitId, { departamento: "cozinha" }) : Promise.resolve(null),
      podeVerContas ? fetchContas(unitId, mesAnoAtual) : Promise.resolve(null),
      podeVerPonto ? fetchPontoHoje(unitId) : Promise.resolve(null)
    ]);

    // 1. ESTOQUE CRÍTICO / ABAIXO DO MÍNIMO
    if (resEstoque.status === "fulfilled" && resEstoque.value?.data) {
      const insumos = resEstoque.value.data || [];
      const criticos = insumos.filter(i => {
        const qtd = Number(i.quantidade_atual) || 0;
        const min = Number(i.estoque_minimo) || 0;
        return qtd <= 0 || (min > 0 && qtd <= min);
      });

      if (criticos.length > 0) {
        const fp = generateFingerprint(unitId, "estoque", "abaixo_minimo", "resumo");
        const semEst = criticos.filter(i => (Number(i.quantidade_atual) || 0) <= 0);

        itemsMap.set(fp, {
          id: `inbox-est-critico`,
          type: "OPERATIONAL_PENDING",
          source: "Home",
          domain: "estoque",
          title: "ESTOQUE: Insumos Críticos de Preparo",
          summary: `${criticos.length} produto(s) zerado(s) ou abaixo do estoque mínimo.`,
          severity: semEst.length > 0 ? "CRITICAL" : "ATTENTION",
          status: isItemSeen(`inbox-est-critico`) ? "SEEN" : "NEW",
          companyId: unitId,
          createdAt: agoraISO,
          updatedAt: agoraISO,
          evidence: criticos.slice(0, 3).map(i => `• ${i.nome}: ${i.quantidade_atual} ${i.unidade || "un"} (mín: ${i.estoque_minimo || 0})`),
          primaryAction: {
            label: "Ver Estoque",
            type: "NAVIGATE",
            route: "/dashboard/operacao/estoque"
          },
          secondaryActions: [
            { label: "Entender por quê", type: "EXPLAIN", query: "Por que meu estoque está baixo?" }
          ],
          fingerprint: fp,
          permission: "estoque.overview.view"
        });
      }
    }

    // 2. FINANCEIRO CONTAS VENCIDAS
    if (resContas.status === "fulfilled" && resContas.value?.data) {
      const contas = resContas.value.data || [];
      const vencidas = contas.filter(c => c.status === "pendente" && c.data_vencimento && String(c.data_vencimento).slice(0, 10) < dataHojeISO);

      if (vencidas.length > 0) {
        const valorTotal = vencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0);
        const fp = generateFingerprint(unitId, "financeiro", "contas_vencidas", "resumo");

        itemsMap.set(fp, {
          id: `inbox-fin-vencidas`,
          type: "OPERATIONAL_PENDING",
          source: "Home",
          domain: "financeiro",
          title: "FINANCEIRO: Contas Vencidas",
          summary: `${vencidas.length} conta(s) vencida(s) totalizando R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
          severity: "CRITICAL",
          status: isItemSeen(`inbox-fin-vencidas`) ? "SEEN" : "NEW",
          companyId: unitId,
          createdAt: agoraISO,
          updatedAt: agoraISO,
          evidence: vencidas.slice(0, 3).map(c => `• ${c.descricao || "Conta"}: R$ ${Number(c.valor || 0).toFixed(2)} (venceu ${c.data_vencimento})`),
          primaryAction: {
            label: "Ver Contas",
            type: "NAVIGATE",
            route: "/dashboard/financeiro/contas"
          },
          fingerprint: fp,
          permission: "financeiro.cashflow.view"
        });
      }
    }

    // 3. RH PENDÊNCIAS DE PONTO TRADICIONAL
    if (resPonto.status === "fulfilled" && resPonto.value?.data) {
      const pontos = resPonto.value.data || [];
      const semIntervalo = pontos.filter(p => p.hora_entrada && p.hora_saida && !p.hora_saida_intervalo);

      if (semIntervalo.length > 0) {
        const fp = generateFingerprint(unitId, "rh", "ponto_incompleto", "resumo");

        itemsMap.set(fp, {
          id: `inbox-rh-ponto`,
          type: "OPERATIONAL_PENDING",
          source: "Home",
          domain: "rh",
          title: "RH & EQUIPE: Pendências de Registro de Ponto",
          summary: `${semIntervalo.length} registro(s) de ponto finalizado(s) sem intervalo.`,
          severity: "ATTENTION",
          status: isItemSeen(`inbox-rh-ponto`) ? "SEEN" : "NEW",
          companyId: unitId,
          createdAt: agoraISO,
          updatedAt: agoraISO,
          evidence: semIntervalo.slice(0, 3).map(p => `• Registro ID ${p.id || p.colaborador_id}: entrada ${p.hora_entrada} sem intervalo`),
          primaryAction: {
            label: "Resolver Ponto",
            type: "NAVIGATE",
            route: "/dashboard/rh/ponto"
          },
          fingerprint: fp,
          permission: "ponto.clock.view"
        });
      }
    }
  } catch (_) {
    // Ignora erros de rede na compilação do inbox
  }

  // ---------------------------------------------------------------------------
  // FONTE 3: F5 INSIGHTS PROATIVOS (COM DEDUPLICAÇÃO POR FINGERPRINT)
  // ---------------------------------------------------------------------------
  try {
    const resInsights = await getProactiveInsights({ session, unitId });
    if (resInsights?.success && resInsights.insights) {
      for (const ins of resInsights.insights) {
        const fp = generateFingerprint(unitId, ins.domain || "geral", ins.title, ins.id);

        if (!itemsMap.has(fp)) {
          itemsMap.set(fp, {
            id: `inbox-ins-${ins.id}`,
            type: "INSIGHT",
            source: "F5",
            domain: ins.domain || "geral",
            title: ins.title,
            summary: ins.summary,
            severity: ins.severity === "high" || ins.severity === "crítico" ? "CRITICAL" : "ATTENTION",
            status: isItemSeen(`inbox-ins-${ins.id}`) ? "SEEN" : "NEW",
            companyId: unitId,
            createdAt: agoraISO,
            updatedAt: agoraISO,
            evidence: ins.evidence || [],
            primaryAction: ins.actionRoute ? {
              label: ins.actionText || "Ver detalhes",
              type: "NAVIGATE",
              route: ins.actionRoute
            } : null,
            secondaryActions: ins.analyticsQuery ? [
              { label: "Entender por quê", type: "EXPLAIN", query: ins.analyticsQuery }
            ] : [],
            insightId: ins.id,
            fingerprint: fp,
            permission: null
          });
        }
      }
    }
  } catch (_) {}

  // ---------------------------------------------------------------------------
  // FONTE 4: F9 AUTOMAÇÕES COM FALHA OU STATUS PARCIAL
  // ---------------------------------------------------------------------------
  try {
    const automations = getAutomationsForTenant(unitId, session);
    const history = getAutomationHistory(unitId, 10);

    const falhadas = history.filter(h => h.status === "FAILED" || h.status === "PARTIAL");
    for (const autoErr of falhadas) {
      const fp = generateFingerprint(unitId, "automacao", autoErr.status, autoErr.automationId);

      if (!itemsMap.has(fp)) {
        itemsMap.set(fp, {
          id: `inbox-auto-${autoErr.id}`,
          type: "AUTOMATION_RESULT",
          source: "F9",
          domain: "sistema",
          title: `AUTOMAÇÃO PROGRAMADA: ${autoErr.name}`,
          summary: `Automação finalizou com status ${autoErr.status}. ${autoErr.summaryText || ""}`,
          severity: autoErr.status === "FAILED" ? "CRITICAL" : "ATTENTION",
          status: isItemSeen(`inbox-auto-${autoErr.id}`) ? "SEEN" : "NEW",
          companyId: unitId,
          createdAt: autoErr.executedAt || agoraISO,
          updatedAt: agoraISO,
          evidence: [`• Idempotência: ${autoErr.deduplicationKey}`],
          primaryAction: {
            label: "Ver Automações",
            type: "NAVIGATE",
            route: "/dashboard/configuracoes/automacoes"
          },
          automationId: autoErr.automationId,
          fingerprint: fp,
          permission: "dashboard.overview.view"
        });
      }
    }
  } catch (_) {}

  // Consolidado em Array e Filtragem de Permissões Estritas por Usuário
  const allItems = Array.from(itemsMap.values()).filter(item => {
    // Filtro por empresa
    if (item.companyId !== unitId) return false;

    // Filtro por domínio se solicitado
    if (filterDomain && item.domain !== filterDomain) return false;

    // Filtro por permissão no RBAC
    if (item.permission) {
      if (item.permission.startsWith("financeiro.") && !podeVerFinanceiro && !podeVerContas) return false;
      if (item.permission.startsWith("estoque.") && !podeVerEstoque) return false;
      if (item.permission.startsWith("rh.") && !podeVerEquipe) return false;
      if (item.permission.startsWith("ponto.") && !podeVerPonto) return false;
    }

    return true;
  });

  // Ordenação Determinística: WAITING_APPROVAL (1) > CRITICAL (2) > ATTENTION (3) > FAILED (4) > INFO (5)
  const severityOrder = {
    WAITING_APPROVAL: 1,
    CRITICAL: 2,
    ATTENTION: 3,
    FAILED: 4,
    INFO: 5
  };

  allItems.sort((a, b) => {
    const rankA = a.status === "WAITING_APPROVAL" ? 1 : severityOrder[a.severity] || 9;
    const rankB = b.status === "WAITING_APPROVAL" ? 1 : severityOrder[b.severity] || 9;
    return rankA - rankB;
  });

  const countActionable = allItems.filter(i => i.status === "WAITING_APPROVAL" || i.status === "NEW" || i.severity === "CRITICAL").length;

  return {
    success: true,
    count: allItems.length,
    actionableCount: countActionable,
    items: allItems,
    updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  };
}
