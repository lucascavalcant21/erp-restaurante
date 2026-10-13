// CONVENÇÃO COLETIVA DE TRABALHO — Hotéis, Restaurantes, Meios de Hospedagem
// e Gastronomia de Foz do Iguaçu 2026/2027 (HDEV-RH-001).
//
// Fonte: PDF escaneado de 13 páginas fornecido pelo dono em 13/10/2026
// (CCT-2026_2027_.pdf), assinado em 27/05/2026. Lido página a página; cada
// parâmetro abaixo cita a cláusula e a PÁGINA do documento.
//
// Este arquivo é a versão em código da convenção: o cálculo nunca usa um
// número que não esteja aqui com a origem. Status de cada regra:
//   implementada    — o Héfisto calcula/alerta com base nela (regras-cct.mjs)
//   parametrizacao  — depende de dado/escolha da empresa (ex.: regime de
//                     compensação, protocolo no sindicato)
//   juridica        — exige revisão do contador/DP antes de produzir efeito
//                     (descontos, rescisão, cláusulas controversas)
//   informativa     — obrigação acompanhada por checklist, sem cálculo
//
// Aplicabilidade conferida no banco (13/10/2026): unidade Seldeestrela em Foz
// do Iguaçu/PR, atividade restaurante (cl. 2, 5 e 51). PENDENTE: confirmar o
// registro da CCT no Mediador/MTE (o PDF não traz o número de registro).

export const CCT_FOZ_2026_2027 = Object.freeze({
  id: "cct-foz-hoteis-restaurantes-2026-2027",
  versao: 1,
  nome: "CCT Hotéis, Restaurantes, Meios de Hospedagem e Gastronomia de Foz do Iguaçu 2026/2027",
  sindicato_laboral: "STTHFI — Sindicato dos Trabalhadores em Turismo e Hospitalidade de Foz do Iguaçu (CNPJ 77.947.85/0001-65 conforme impresso)",
  sindicato_patronal: "Sindicato de Hotéis, Restaurantes, Bares e Similares de Foz do Iguaçu (CNPJ 76.296.193/0001-31)",
  vigencia: { inicio: "2026-05-01", fim: "2027-04-30", fonte: { clausula: 1, pagina: 1 } },
  data_base: { mes: 5, dia: 1, fonte: { clausula: 1, pagina: 1 } },
  assinatura: { data: "2026-05-27", fonte: { clausula: 56, pagina: 13 } },
  registro_mte: null, // pendente de verificação
  municipios: ["Foz do Iguaçu", "Diamante d'Oeste", "Itaipulândia", "Matelândia", "Medianeira", "Missal", "Ramilândia",
    "Santa Terezinha de Itaipu", "São Miguel do Iguaçu", "Serranópolis do Iguaçu"],

  piso: {
    mensal: 2321.40, desde: "2026-05-01", fonte: { clausula: 3, pagina: 1 },
    aprendiz: { regra: "salario_minimo_federal", fonte: { clausula: 3, paragrafo: "único", pagina: 1 } },
    status: "implementada",
  },
  reajuste: {
    percentual: 6, aplicado_em: "2026-05-01", base: "salários de maio/2025", fonte: { clausula: 4, pagina: 1 },
    admitidos_apos: { data: "2025-05-01", regra: "proporcional_meses_trabalhados", fonte: { clausula: 4, paragrafo: "único", pagina: 1 } },
    status: "parametrizacao", // proporcionalidade (fração de mês) não está definida na cláusula
  },
  adiantamento: {
    ate_dia: 20, minimo_pct: 20, maximo_pct: 40, fonte: { clausula: 7, pagina: 2 },
    dispensa: { menos_de_empregados: 20, ou_recusa_expressa: true, fonte: { clausula: 7, paragrafo: "único", pagina: 2 } },
    status: "implementada",
  },
  hora_extra: { adicional_pct: 100, minimo: true, fonte: { clausula: 10, pagina: 2 }, status: "implementada" },
  compensacao_horas: {
    regimes: ["mensal", "bimestral"], prazo_dias: 60, proporcao: "1:1", fonte: { clausula: 11, paragrafos: ["1º", "2º"], pagina: 2 },
    exige_protocolo_sindicato: true, // sob pena de nulidade (§1º)
    veda_banco_horas_art59: true, fonte_vedacao: { clausula: 11, paragrafo: "3º", pagina: 2 },
    rescisao: { adicional_pct: 100, fonte: { clausula: 11, paragrafo: "4º", pagina: 3 } },
    status: "juridica", // a casa usa "banco de horas"; conflita com §3º se optar pela compensação da CCT
  },
  quinquenio: {
    pct_por_quinquenio: 2, anos: 5, contagem_desde: "2005-07-01", teto_pct: 10, base: "salario_base",
    fonte: { clausula: 12, pagina: 3 }, status: "implementada",
  },
  adicional_noturno: {
    adicional_pct: 25, inicio: "22:00", fim: "07:00", fonte: { clausula: 13, paragrafos: ["caput", "1º"], pagina: 3 },
    nao_noturno_se_inicio_apos: "05:00", fonte_exclusao: { clausula: 13, paragrafo: "2º", pagina: 3 },
    hora_reduzida: { legal: "CLT art. 73 §1º (52min30s)", status: "juridica",
      observacao: "A CCT não trata da hora reduzida na extensão 05h–07h. Calculamos as duas leituras e não fechamos sem o contador." },
    status: "implementada",
  },
  seguro_vida: {
    morte_invalidez: 30000, auxilio_funeral: 10000, custeio: "empregador", fonte: { clausula: 15, pagina: 3 },
    sem_seguradora: "pagar o prêmio integral em parcela única", status: "informativa",
  },
  alimentacao: { exige_acordo_coletivo: true, natureza_salarial: false, fonte: { clausula: 16, pagina: 3 }, status: "informativa" },
  feriados: {
    compensacao: ["antecipacao_no_mesmo_mes", "ate_30_dias_apos"], sem_compensacao: "pagar_em_dobro_sem_prejuizo_do_dsr",
    quais: "leis federais, estaduais e municipais", fonte: { clausula: 17, pagina: "3–4" }, status: "implementada",
    alternativa: {
      folgas_mensais: 5, ferias_dias: 35, exige_assembleia: true, exige_protocolo_sindicato: true,
      fonte: { clausula: 41, paragrafos: ["3º", "4º"], pagina: 9 }, status: "parametrizacao",
    },
  },
  auxilio_creche: {
    teto_mensal: 633.00, ate: "fim do período letivo em que a criança completar 6 anos",
    requerimento_prazo_dias: 30, requerimento: "por escrito, a contar da matrícula, comprovada",
    modalidade: "reembolso não cumulativo, nota fiscal mensal em nome do empregado", reembolso_prazo_dias: 30,
    um_genitor_se_ambos_na_categoria: true, fonte: { clausula: 18, pagina: 4 }, status: "implementada",
  },
  experiencia: {
    minimo_dias: 30, maximo_total_dias: 90, prorrogacao_nao_inferior_ao_primeiro: true, prorrogacoes_max: 1,
    fonte: { clausula: 19, paragrafos: ["1º", "3º"], pagina: 4 },
    vedada_readmissao_mesma_funcao_anos: 2, fonte_readmissao: { clausula: 19, paragrafo: "2º", pagina: 4 },
    exige_contrato_expresso_assinatura_sobre_data: true, entrega_copia_com_recibo: true,
    legal: "CLT art. 445 parágrafo único e art. 451 (uma prorrogação, até 90 dias)", status: "implementada",
  },
  rescisao: {
    prazo_pagamento_dias: 8, documentos: "TRCT, chave de conectividade, seguro-desemprego", fonte: { clausula: 21, paragrafo: "1º", pagina: 5 },
    entregar_trct_sempre: true, fonte_trct: { clausula: 21, pagina: 5 },
    justa_causa_declaracao_motivo: true, fonte_justa_causa: { clausula: 22, pagina: 6 },
    status: "juridica",
  },
  aviso_previo: {
    base_dias: 30, por_ano_dias: 3, maximo_dias: 90, cumprido_maximo_dias: 30, excedente: "indenizado",
    fonte: { clausula: 23, pagina: "6", paragrafo: "1º" }, legal: "Lei 12.506/2011; NT 184/2012 MTE",
    dispensa_novo_emprego_pedido_demissao: { fonte: { clausula: 23, paragrafo: "3º", pagina: "6–7" } },
    status: "implementada",
  },
  intervalo: { minimo_min: 60, maximo_min: 300, jornada_acima_de_min: 360, fonte: { clausula: 25, pagina: 7 }, status: "implementada" },
  descontos_autorizados: { exige_autorizacao_expressa: true, fonte: { clausula: 34, pagina: 8 }, status: "juridica" },
  escala_folgas: { publicar_antecedencia_dias: 7, fonte: { clausula: 35, pagina: 8 }, status: "implementada" },
  dsr_domingo: { minimo_por_mes: 1, fonte: { clausula: 36, pagina: 8 }, status: "implementada" },
  ponto: { marcado_e_assinado_pelo_empregado: true, fonte: { clausula: 37, pagina: 8 }, status: "informativa" },
  estudante: { veda_mudanca_horario_conflitante: true, veda_prorrogacao_sem_interesse: true, fonte: { clausula: 38, pagina: "8–9" }, status: "parametrizacao" },
  refeitorio: { empresas_com_mais_de: 20, fonte: { clausula: 39, pagina: 9 }, status: "informativa" },
  ausencias: {
    casamento_dias: 4, falecimento_1grau_dias: 4, vestibular: "dias de prova, aviso de 72h e comprovação",
    consulta_filho_menor12_dias_ano: 2, paternidade_dias: 5, fonte: { clausula: 40, pagina: 9 }, status: "implementada",
  },
  ferias: {
    proporcionais_avos: "1/12 por mês ou fração superior a 14 dias, salvo justa causa", terco: true,
    nao_iniciar_vespera_de_folga: true, comunicar_antecedencia_dias: 30, fonte: { clausula: 41, pagina: 9 }, status: "implementada",
  },
  uniforme: { gratuito_quando_exigido: true, desconto_so_dano_doloso_comprovado: true, fonte: { clausula: 43, pagina: 10 }, status: "informativa" },
  exames_medicos: { custeio: "empregador", fonte: { clausula: 44, pagina: 10 }, status: "informativa" },
  atestado: { fonte: { clausula: 45, pagina: 10 }, status: "informativa" },
  contribuicao_negocial_laboral: {
    parcelas: 12, valor: 17.00, inicio: "2026-06", recolhimento_ate_dia: 10,
    oposicao: "manuscrita no sindicato em 20 dias da assinatura (fora de Foz: na empresa, que encaminha)",
    fonte: { clausula: 49, pagina: 11 }, status: "juridica", // NUNCA descontar automaticamente
  },
  contribuicao_patronal: {
    faixas: [{ ate_empregados: 5, valor: 307.00 }, { ate_empregados: 10, valor: 441.00 }, { acima_de: 10, por_empregado: 47.00 }],
    vencimentos: ["2026-08-20", "2026-11-20"], multa_atraso_pct: 10, fonte: { clausula: 50, pagina: 12 }, status: "juridica",
  },
  mensalidade_sindical: { exige_autorizacao_escrita: true, repasse_ate_dia: 10, fonte: { clausula: 52, pagina: 12 }, status: "juridica" },
  multa_descumprimento: { pct_piso: 50, fonte: { clausula: 54, pagina: 13 }, status: "informativa" },
});

/** Referência legível: "CCT Foz 2026/2027, cl. 13 §1º, p. 3". */
export function citar(fonte) {
  if (!fonte) return "";
  const um = (p) => (p === "caput" ? "caput" : p === "único" ? "parágrafo único" : `§${p}`);
  const par = fonte.paragrafo ? ` ${um(fonte.paragrafo)}` : fonte.paragrafos ? ` ${fonte.paragrafos.map(um).join(", ")}` : "";
  return `CCT Foz 2026/2027, cl. ${fonte.clausula}${par}, p. ${fonte.pagina}`;
}
