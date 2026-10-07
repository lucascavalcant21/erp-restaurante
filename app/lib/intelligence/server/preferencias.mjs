// Lógica de /api/intelligence/preferences (a rota só embrulha com atenderInteligencia).
//   obterPreferencias   alertas, sensibilidade, metas e a distribuição SUGERIDA
//   alterarPreferencias só com dashboard.intelligence.settings (conferida no
//                       banco), auditada ANTES de gravar (sem auditoria, não grava)
import { preferenciasSchema, preferenciasDaLinha, linhaDePreferencias, CATEGORIAS_ALERTA, ROTULO_CATEGORIA, SENSIBILIDADES } from "../memory/preferencias.mjs";
import { sugerirDistribuicao } from "../metrics/metas.mjs";
import { auditar, exigirAuditoria, ETAPA_AUDITORIA } from "../audit/auditoria.mjs";

const PERMISSAO_CONFIGURAR = "dashboard.intelligence.settings";

async function estado({ ic, motor, store, autorizar }) {
  const [linha, pode, historico] = await Promise.all([
    store.lerPreferencias(ic.escopo.unidadeId).catch(() => null),
    autorizar(PERMISSAO_CONFIGURAR, "inteligencia.configurar"),
    motor.getRevenueHistory().catch(() => null),
  ]);
  const prefs = preferenciasDaLinha(linha);
  return {
    preferencias: { alertas: prefs.alertas, sensibilidade: prefs.sensibilidade, metas: prefs.metas, atualizadoEm: prefs.atualizadoEm },
    // distribuição só aparece se a pessoa pode ver faturamento (os pesos vêm do histórico de vendas)
    sugestao: sugerirDistribuicao({ metas: prefs.metas, hoje: ic.hoje, historico }),
    podeConfigurar: pode.ok === true,
    opcoes: { categorias: CATEGORIAS_ALERTA.map((id) => ({ id, rotulo: ROTULO_CATEGORIA[id] })), sensibilidades: SENSIBILIDADES },
  };
}

export async function obterPreferencias(h) {
  return { corpo: await estado(h) };
}

export async function alterarPreferencias(h) {
  const { ic, store, persistente, corpo, correlationId, autorizar } = h;
  const pode = await autorizar(PERMISSAO_CONFIGURAR, "inteligencia.configurar");
  if (!pode.ok) {
    await auditar(store, ic.escopo, { correlationId, etapa: ETAPA_AUDITORIA.BLOQUEIO, erro: "configurar inteligência sem permissão" });
    return { corpo: { erro: "Seu perfil não pode alterar as configurações da inteligência.", codigo: pode.codigo || "SEM_PERMISSAO" }, status: pode.status === 503 ? 503 : 403 };
  }
  const p = preferenciasSchema.parse({ alertas: corpo.alertas ?? null, sensibilidade: corpo.sensibilidade ?? null, metas: corpo.metas ?? null });
  if (!p.ok) return { corpo: { erro: "Configuração inválida. Metas devem ser valores positivos em reais.", codigo: "PEDIDO_INVALIDO" }, status: 400 };
  if (!persistente) return { corpo: { erro: "Configurações indisponíveis: o servidor não tem a auditoria da inteligência configurada.", codigo: "NAO_CONFIGURADO" }, status: 503 };

  const mudanca = Object.fromEntries(Object.entries(p.valor).filter(([, v]) => v != null));
  const atual = preferenciasDaLinha(await store.lerPreferencias(ic.escopo.unidadeId));
  const linha = linhaDePreferencias(ic.escopo.unidadeId, atual, mudanca, ic.escopo.userId);
  const resumo = (x) => ({ alertas: x.alertas, sensibilidade: x.sensibilidade, metas: { mensal: x.meta_faturamento_mensal ?? x.metas?.mensal ?? null, semanal: x.meta_faturamento_semanal ?? x.metas?.semanal ?? null, diaria: x.meta_faturamento_diaria ?? x.metas?.diaria ?? null } });
  // sem auditoria, não grava (mudança de configuração é escrita)
  await exigirAuditoria(store, ic.escopo, { correlationId, etapa: ETAPA_AUDITORIA.CONFIGURACAO, entidadeTipo: "preferencias", entidadeId: ic.escopo.unidadeId, antes: resumo(atual), depois: resumo(linha), resultado: { status: "solicitada" } });
  await store.salvarPreferencias(linha);
  await auditar(store, ic.escopo, { correlationId, etapa: ETAPA_AUDITORIA.CONFIGURACAO, entidadeTipo: "preferencias", entidadeId: ic.escopo.unidadeId, resultado: { status: "aplicada" } });
  return { corpo: { ok: true, ...(await estado(h)) } };
}
