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
  return /experi/i.test(String(colaborador?.status_contrato || ""));
}

// Situação do contrato hoje: qual período está correndo, quando vence e
// quantos dias faltam. Devolve null quando não está em experiência.
export function situacaoExperiencia(colaborador, hoje = new Date()) {
  if (!emExperiencia(colaborador)) return null;
  const admissao = dataDe(colaborador?.data_admissao);
  if (!admissao) return { erro: "Sem data de admissão" };

  const prazo = prazoExperiencia(colaborador);
  const base = meiaNoite(hoje);
  const diasCorridos = Math.floor((base - admissao) / DIA);

  const fimPrimeiro = new Date(admissao.getTime() + prazo * DIA);
  // Prazo de 90 dias já é o máximo da lei: não há prorrogação.
  const periodoUnico = prazo >= 90;
  const fimSegundo = periodoUnico ? fimPrimeiro : new Date(admissao.getTime() + Math.min(90, prazo * 2) * DIA);

  const noPrimeiro = periodoUnico || base < fimPrimeiro;
  const fimAtual = noPrimeiro ? fimPrimeiro : fimSegundo;
  const diasRestantes = Math.ceil((fimAtual - base) / DIA);

  return {
    prazo,
    periodoUnico,
    periodo: noPrimeiro ? 1 : 2,
    diasCorridos,
    fimPrimeiro,
    fimSegundo,
    fimAtual,
    diasRestantes,
    // Passou dos 90 dias sem ninguém efetivar: por lei já é indeterminado.
    vencido: base >= fimSegundo,
    // Últimos 7 dias do período: hora de decidir.
    decidirAgora: diasRestantes <= 7 && diasRestantes >= 0,
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

  return { dias, anos, meses, texto: partes.join(" e ") };
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
