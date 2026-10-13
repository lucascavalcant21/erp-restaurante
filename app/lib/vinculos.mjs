// VÍNCULOS DE TRABALHO — fase e ações possíveis (HDEV-RH-001, Fase 3).
//
// O banco (rh_vinculos, RH-4) guarda a CATEGORIA jurídica, a REGRA de
// remuneração e as datas. A FASE é calculada aqui, a partir das datas, e diz
// o que pode ser solicitado. Quem valida de verdade é o banco
// (rh_transicao_solicitar / rh_transicao_decidir); esta parte serve para a
// tela mostrar só o que faz sentido e explicar por quê.

export const CATEGORIAS = {
  eventual: "Trabalho eventual (extra)",
  intermitente: "CLT intermitente",
  clt_experiencia: "CLT — contrato de experiência",
  clt_indeterminado: "CLT — prazo indeterminado",
  outro: "Outra modalidade",
};
export const REGRAS_REMUNERACAO = { mensal: "Mensal", diaria: "Por diária", hora: "Por hora", servico: "Por serviço" };
export const TIPOS_TRANSICAO = {
  prorrogacao: "Prorrogação da experiência",
  efetivacao: "Efetivação (prazo indeterminado)",
  mudanca_categoria: "Mudança de modalidade",
  alteracao_salarial: "Alteração salarial",
};

const DIA = 86400000;
const d = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00Z`);
const iso = (x) => x.toISOString().slice(0, 10);
const soma = (s, n) => iso(new Date(d(s).getTime() + n * DIA));
const br = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const entre = (a, b) => Math.round((d(b) - d(a)) / DIA);

/**
 * Fase do vínculo em `hoje` ("AAAA-MM-DD"). Retorna
 * { id, rotulo, detalhe, alerta, acoes: [tipos de transição permitidos] }.
 */
export function faseDoVinculo(v, hoje) {
  if (!v) return { id: "sem_vinculo", rotulo: "Sem vínculo registrado", detalhe: "", alerta: null, acoes: [] };
  const hojeIso = String(hoje).slice(0, 10);
  if (v.fim) return { id: "encerrado", rotulo: `Encerrado em ${br(v.fim)}`, detalhe: v.motivo_fim || "", alerta: null, acoes: [] };
  const salarial = ["clt_experiencia", "clt_indeterminado", "intermitente"].includes(v.categoria) ? ["alteracao_salarial"] : [];
  if (v.categoria === "clt_indeterminado") return { id: "indeterminado", rotulo: "Prazo indeterminado", detalhe: `Desde ${br(v.inicio)}`, alerta: null, acoes: ["mudanca_categoria", ...salarial] };
  if (v.categoria !== "clt_experiencia") return { id: v.categoria, rotulo: CATEGORIAS[v.categoria] || v.categoria, detalhe: `Desde ${br(v.inicio)}${v.inicio_estimado ? " (data estimada)" : ""}`, alerta: null, acoes: ["mudanca_categoria", "efetivacao", ...salarial] };

  const fim1 = soma(v.inicio, Number(v.experiencia_dias) - 1);
  if (!v.prorrogacao_dias) {
    if (hojeIso <= fim1) {
      const faltam = entre(hojeIso, fim1);
      return { id: "experiencia_1", rotulo: `Experiência: 1º período (${v.experiencia_dias} dias)`, detalhe: `Termina em ${br(fim1)} · faltam ${faltam} dia(s)`,
        alerta: [15, 7, 3, 1].includes(faltam) || faltam <= 3 ? `Decidir até ${br(fim1)}: prorrogar, efetivar ou encerrar.` : null,
        acoes: ["prorrogacao", "efetivacao", ...salarial], fim: fim1, faltam };
    }
    return { id: "experiencia_sem_prorrogacao", rotulo: "Experiência: 1º período terminado", detalhe: `Terminou em ${br(fim1)} e não há prorrogação registrada.`,
      alerta: "Se o contrato assinado previa a prorrogação, registre-a anexando o contrato; se não, o vínculo já é por prazo indeterminado: registre a efetivação.",
      acoes: ["prorrogacao", "efetivacao", ...salarial], fim: fim1, faltam: -entre(fim1, hojeIso) };
  }
  const fimTotal = soma(v.inicio, Number(v.experiencia_dias) + Number(v.prorrogacao_dias) - 1);
  if (hojeIso <= fimTotal) {
    const faltam = entre(hojeIso, fimTotal);
    return { id: "experiencia_2", rotulo: `Experiência prorrogada (${v.experiencia_dias} + ${v.prorrogacao_dias} dias)`, detalhe: `Termina em ${br(fimTotal)} · faltam ${faltam} dia(s)`,
      alerta: faltam <= 15 ? `Decidir até ${br(fimTotal)}: efetivar ou encerrar.` : null, acoes: ["efetivacao", ...salarial], fim: fimTotal, faltam };
  }
  return { id: "experiencia_vencida", rotulo: "Experiência terminada", detalhe: `Terminou em ${br(fimTotal)} sem efetivação ou encerramento registrados.`,
    alerta: "Continuou trabalhando após o fim da experiência: o vínculo é por prazo indeterminado. Registre a efetivação.", acoes: ["efetivacao", ...salarial], fim: fimTotal, faltam: -entre(fimTotal, hojeIso) };
}

/** Prorrogação fora do prazo só com o contrato assinado anexado (a decisão é de quem aprova). */
export function prorrogacaoExigeDocumento(v, hoje) {
  if (!v || v.categoria !== "clt_experiencia" || v.prorrogacao_dias) return false;
  return String(hoje).slice(0, 10) > soma(v.inicio, Number(v.experiencia_dias) - 1);
}
