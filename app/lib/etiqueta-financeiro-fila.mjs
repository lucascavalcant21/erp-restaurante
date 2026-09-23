// Regras puras do drenador da fila de perdas. Sem Supabase aqui: o acesso fica
// em etiqueta-financeiro.js (cliente) e na rota de cron (servidor), e os dois
// usam estas mesmas decisões.

export const STATUS = Object.freeze({
  PENDENTE: "pendente",
  PROCESSANDO: "processando",
  LANCADO: "lancado",
  ERRO: "erro",
  DISPENSADO: "dispensado",
});

// O mesmo teto que etiqueta_financeiro_max_tentativas() usa no banco. Os dois
// precisam concordar; se um dia divergirem, o banco manda — ele é quem decide
// o status final.
export const MAX_TENTATIVAS = 5;

// Autorização do endpoint de cron.
//
// Aceita o header que a Vercel manda nos crons dela e o segredo próprio, que é
// o padrão já usado em /api/hefisto/automation/cron. Sem segredo configurado a
// porta fica FECHADA: um drenador aberto na internet é um jeito de alguém
// encher o financeiro de lançamentos.
export function autorizacaoDoCron({ authorization = "", vercelCron = "", segredoParam = "", segredoEsperado = "" } = {}) {
  const esperado = String(segredoEsperado || "").trim();
  if (!esperado) return { ok: false, motivo: "CRON_SECRET não configurado" };
  if (String(vercelCron || "").trim()) return { ok: true, origem: "vercel-cron" };
  if (String(authorization || "").trim() === `Bearer ${esperado}`) return { ok: true, origem: "bearer" };
  if (String(segredoParam || "") === esperado) return { ok: true, origem: "query" };
  return { ok: false, motivo: "segredo inválido" };
}

// A fila está saudável? Serve para o endpoint responder algo útil e para a
// futura tela mostrar um aviso em vez de deixar a perda sumir em silêncio.
export function saudeDaFila(linhas = [], { agora = new Date(), horasDeAtraso = 24 } = {}) {
  const soma = (campo) => linhas.reduce((s, l) => s + (Number(l?.[campo]) || 0), 0);
  const comErro = soma("com_erro");
  const maisAntiga = linhas
    .map((l) => l?.mais_antiga)
    .filter(Boolean)
    .map((d) => new Date(d))
    .sort((a, b) => a - b)[0] || null;
  const atrasoHoras = maisAntiga ? (agora - maisAntiga) / 3600000 : 0;
  return {
    pendentes: soma("pendentes"),
    processando: soma("processando"),
    comErro,
    valorEmAberto: Math.round(soma("valor_em_aberto") * 100) / 100,
    maisAntiga,
    atrasoHoras: Math.round(atrasoHoras * 10) / 10,
    // Erro é sempre atenção humana; atraso longo também, mesmo sem erro:
    // significa que o cron parou de rodar.
    precisaAtencao: comErro > 0 || atrasoHoras > horasDeAtraso,
  };
}
