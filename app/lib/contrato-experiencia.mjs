// Regras de contrato de experiência, tempo de casa e aniversário.
// CLT: a experiência vai até 90 dias no total e pode ser prorrogada UMA vez
// (o padrão do mercado é 30+30 ou 45+45). Aqui o 1º período vence e o contrato
// entra sozinho na prorrogação; ao fim dela é preciso decidir: efetivar ou
// encerrar. Nada disso muda o cadastro sozinho — o sistema só avisa.

const DIA = 86400000;

const meiaNoite = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dataDe = (iso) => (iso ? meiaNoite(new Date(`${String(iso).slice(0, 10)}T12:00:00`)) : null);

// Quantos dias tem cada período de experiência deste colaborador.
// Aceita "Experiência 30", "Experiência 45", "Experiência" (assume 45).
export function prazoExperiencia(colaborador) {
  const texto = String(colaborador?.status_contrato || "");
  const achado = texto.match(/(\d+)/);
  const n = achado ? Number(achado[1]) : 0;
  if (n === 30 || n === 45 || n === 90) return n;
  return 45;
}

export function emExperiencia(colaborador) {
  const status = String(colaborador?.status_contrato || "");
  if (status.includes("Definitivo") || status.includes("Efetivo")) return false;
  return /experi/i.test(status);
}

// Situação dinâmica do contrato: renova a cada 30 dias até 90 dias, depois vira definitivo.
export function faseContratoCalculada(colaborador, hoje = new Date()) {
  const status = String(colaborador?.status_contrato || "");
  if (status.includes("Definitivo") || status.includes("Efetivo") || colaborador?.tipo_contrato === "Freelancer") {
    return {
      fase: status.includes("Definitivo") || status.includes("Efetivo") ? "Contrato Definitivo" : (colaborador?.tipo_contrato || "CLT"),
      detalhe: "Contrato em vigência por prazo indeterminado.",
      ehDefinitivo: true,
      periodo: null,
      diasCorridos: null,
    };
  }

  const admissao = dataDe(colaborador?.data_admissao);
  if (!admissao) {
    return {
      fase: status || "Experiência (30 dias)",
      detalhe: "Data de admissão não informada.",
      ehDefinitivo: false,
      periodo: 1,
      diasCorridos: 0,
    };
  }

  const base = meiaNoite(hoje);
  const diasCorridos = Math.max(0, Math.floor((base - admissao) / DIA));

  if (diasCorridos <= 30) {
    const faltam = 30 - diasCorridos;
    return {
      fase: "Experiência (1º Período - 30 dias)",
      detalhe: `1º Período (${diasCorridos}/30 dias). Atualiza para +30 dias em ${faltam} dia(s).`,
      ehDefinitivo: false,
      periodo: 1,
      diasCorridos,
      diasRestantesPeriodo: faltam,
    };
  } else if (diasCorridos <= 60) {
    const faltam = 60 - diasCorridos;
    return {
      fase: "Experiência (2º Período renovado +30 dias)",
      detalhe: `Renovado automaticamente (${diasCorridos}/60 dias). Próxima fase em ${faltam} dia(s).`,
      ehDefinitivo: false,
      periodo: 2,
      diasCorridos,
      diasRestantesPeriodo: faltam,
    };
  } else if (diasCorridos <= 90) {
    const faltam = 90 - diasCorridos;
    return {
      fase: "Experiência (3º Período renovado +30 dias)",
      detalhe: `3º Período (${diasCorridos}/90 dias). Torna-se Definitivo em ${faltam} dia(s).`,
      ehDefinitivo: false,
      periodo: 3,
      diasCorridos,
      diasRestantesPeriodo: faltam,
    };
  } else {
    return {
      fase: "Contrato Definitivo",
      detalhe: `Efetivado automaticamente (${diasCorridos} dias de casa - ultrapassou 90 dias).`,
      ehDefinitivo: true,
      automaticoDefinitivo: true,
      periodo: 4,
      diasCorridos,
    };
  }
}

// Situação do contrato hoje: qual período está correndo, quando vence e quantos dias faltam.
export function situacaoExperiencia(colaborador, hoje = new Date()) {
  if (!emExperiencia(colaborador)) return null;
  const admissao = dataDe(colaborador?.data_admissao);
  if (!admissao) return { erro: "Sem data de admissão" };

  const base = meiaNoite(hoje);
  const diasCorridos = Math.floor((base - admissao) / DIA);

  if (diasCorridos > 90) {
    return {
      prazo: 90,
      periodo: 4,
      diasCorridos,
      efetivadoAutomatico: true,
      vencido: false,
      decidirAgora: false,
    };
  }

  const periodo = diasCorridos <= 30 ? 1 : diasCorridos <= 60 ? 2 : 3;
  const limitePeriodo = periodo * 30;
  const diasRestantes = limitePeriodo - diasCorridos;

  return {
    prazo: 30,
    periodo,
    diasCorridos,
    fimAtual: new Date(admissao.getTime() + limitePeriodo * DIA),
    diasRestantes,
    vencido: false,
    decidirAgora: diasRestantes <= 5 && diasRestantes >= 0,
  };
}

// Tempo de casa em dias, com um texto pronto ("1 ano e 3 meses").
export function tempoDeCasa(colaborador, hoje = new Date()) {
  const admissao = dataDe(colaborador?.data_admissao);
  if (!admissao) return null;
  const base = meiaNoite(hoje);
  const dias = Math.max(0, Math.floor((base - admissao) / DIA));

  let anos = base.getFullYear() - admissao.getFullYear();
  let meses = base.getMonth() - admissao.getMonth();
  if (base.getDate() < admissao.getDate()) meses -= 1;
  if (meses < 0) { anos -= 1; meses += 12; }

  const partes = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (meses > 0) partes.push(`${meses} ${meses > 1 ? "meses" : "mês"}`);
  if (!partes.length) partes.push(`${dias} dia${dias === 1 ? "" : "s"}`);

  // O gestor conta em dias: passou de um ano, vira "1 ano e tantos dias".
  const marco = new Date(admissao);
  marco.setFullYear(admissao.getFullYear() + anos);
  const diasDepois = Math.max(0, Math.floor((base - marco) / DIA));
  const textoDias = anos > 0
    ? `${anos} ano${anos > 1 ? "s" : ""}${diasDepois ? ` e ${diasDepois} dia${diasDepois === 1 ? "" : "s"}` : ""}`
    : `${dias} dia${dias === 1 ? "" : "s"}`;

  return { dias, anos, meses, diasDepois, texto: partes.join(" e "), textoDias };
}

// Aniversário: dia/mês, idade e quantos dias faltam para o próximo.
export function aniversario(colaborador, hoje = new Date()) {
  const nascimento = dataDe(colaborador?.data_nascimento);
  if (!nascimento) return null;
  const base = meiaNoite(hoje);

  const proximo = new Date(nascimento);
  proximo.setFullYear(base.getFullYear());
  if (proximo < base) proximo.setFullYear(base.getFullYear() + 1);

  let idade = base.getFullYear() - nascimento.getFullYear();
  const jaFez = (base.getMonth() > nascimento.getMonth())
    || (base.getMonth() === nascimento.getMonth() && base.getDate() >= nascimento.getDate());
  if (!jaFez) idade -= 1;

  const faltam = Math.round((proximo - base) / DIA);
  const p = (n) => String(n).padStart(2, "0");
  return {
    diaMes: `${p(nascimento.getDate())}/${p(nascimento.getMonth() + 1)}`,
    idade,
    faltam,
    ehHoje: faltam === 0,
    proximo,
  };
}

export const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];
export const ESCOLARIDADES = [
  "Fundamental incompleto", "Fundamental completo", "Médio incompleto",
  "Médio completo", "Técnico", "Superior incompleto", "Superior completo",
];
export const GENEROS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
