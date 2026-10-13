// PRONTUÁRIO DO COLABORADOR — regras puras do cabeçalho e do resumo
// (HDEV-RH-001, Fase 2). A tela (app/dashboard/rh/funcionario/[id]) só mostra.
//
// Nada aqui inventa dado: campo vazio vira "não informado" e pendência, nunca
// um valor padrão. Experiência e piso usam as regras da convenção quando ela
// está ativa (trabalhista/regras-cct.mjs), com a cláusula citada.

import { faseContratoCalculada, prazoExperiencia, emExperiencia } from "./contrato-experiencia.mjs";
import { alertasExperiencia, conferirPiso, anosCompletos } from "./trabalhista/regras-cct.mjs";
import { cpfValido } from "./colaborador-cadastro.mjs";

const txt = (v) => String(v ?? "").trim();

export const ABAS_PRONTUARIO = [
  { id: "resumo", rotulo: "Resumo" },
  { id: "pessoais", rotulo: "Dados pessoais" },
  { id: "contratos", rotulo: "Contratos e vínculos" },
  { id: "jornada", rotulo: "Jornada, escala e ponto" },
  { id: "remuneracao", rotulo: "Remuneração e benefícios" },
  { id: "pagamentos", rotulo: "Pagamentos e recibos" },
  { id: "ferias", rotulo: "Férias e afastamentos" },
  { id: "documentos", rotulo: "Documentos e treinamentos" },
  { id: "avaliacao", rotulo: "Avaliação profissional" },
  { id: "historico", rotulo: "Histórico e auditoria" },
];

/** Situação do colaborador para o selo do cabeçalho. */
export function statusDoColaborador(c = {}, hoje = new Date()) {
  const inativo = (c.status || "ativo") === "inativo";
  if (inativo || c.data_desligamento) {
    const futuro = c.data_desligamento && c.data_desligamento > new Date(hoje).toISOString().slice(0, 10);
    if (futuro && !inativo) return { id: "desligamento_agendado", rotulo: `Desligamento em ${c.data_desligamento.split("-").reverse().join("/")}`, tom: "aviso" };
    return { id: "desligado", rotulo: c.data_desligamento ? `Desligado em ${c.data_desligamento.split("-").reverse().join("/")}` : "Desligado", tom: "neutro" };
  }
  if (c.em_aviso_previo || c.status_aviso === "cumprindo_aviso") return { id: "aviso", rotulo: "Cumprindo aviso prévio", tom: "aviso" };
  return { id: "ativo", rotulo: "Ativo", tom: "ok" };
}

/** Vínculo atual em linguagem simples, separando categoria e fase. */
export function vinculoAtual(c = {}, hoje = new Date()) {
  const extra = c.tipo_contrato === "Freelancer";
  if (extra) return { categoria: "Trabalho eventual (extra)", fase: "Prestação de serviço avulsa", ehExperiencia: false };
  const fase = faseContratoCalculada(c, hoje);
  return { categoria: "CLT", fase: fase.fase, detalhe: fase.detalhe, ehExperiencia: !fase.ehDefinitivo, periodo: fase.periodo };
}

/** Nomes dos supervisores a partir da lista do quadro. */
export function supervisoresDe(c = {}, lista = []) {
  const ids = Array.isArray(c.supervisores_ids) && c.supervisores_ids.length ? c.supervisores_ids : (c.supervisor_id ? [c.supervisor_id] : []);
  const porId = new Map((lista || []).map((x) => [x.id, x.nome]));
  return ids.map((id) => porId.get(id)).filter(Boolean);
}

/**
 * Pendências do cadastro e alertas do vínculo, do mais grave ao mais leve.
 * cct: convenção ativa (ou null). Cada item: { nivel, texto, fonte? }.
 */
export function pendenciasDoColaborador(c = {}, { hoje = new Date(), cct = null } = {}) {
  const p = [];
  const extra = c.tipo_contrato === "Freelancer";
  if (!txt(c.cpf)) p.push({ nivel: "alto", texto: "CPF não informado." });
  else if (!cpfValido(c.cpf)) p.push({ nivel: "alto", texto: "CPF com dígitos inválidos." });
  if (!extra && !txt(c.data_admissao)) p.push({ nivel: "alto", texto: "Data de início do vínculo não informada." });
  if (!txt(c.telefone)) p.push({ nivel: "medio", texto: "Telefone não informado." });
  if (!txt(c.chave_pix)) p.push({ nivel: "medio", texto: "Chave Pix não informada (pagamentos)." });
  if (!extra && !(Number(c.salario) > 0)) p.push({ nivel: "alto", texto: "Salário não informado." });
  if (!extra && cct && Number(c.salario) > 0) {
    const piso = conferirPiso({ salarioMensal: Number(c.salario) }, cct);
    if (piso.abaixoDoPiso) p.push({ nivel: "alto", texto: `Salário abaixo do piso da convenção (faltam R$ ${piso.diferenca.toFixed(2).replace(".", ",")}).`, fonte: piso.fundamentos[0] });
  }
  if (!extra && emExperiencia(c) && txt(c.data_admissao)) {
    const p1 = prazoExperiencia(c);
    // modelo atual: vencido o 1º período, o contrato segue na prorrogação até 90 dias
    const diasDeCasa = Math.floor((new Date(new Date(hoje).toISOString().slice(0, 10) + "T12:00:00Z") - new Date(c.data_admissao + "T12:00:00Z")) / 86400000);
    const prorrogado = diasDeCasa >= p1;
    const a = alertasExperiencia({ inicio: c.data_admissao, primeiro: p1, prorrogacao: 90 - p1, prorrogado }, new Date(hoje).toISOString().slice(0, 10));
    const qual = prorrogado ? "da prorrogação (fim da experiência)" : "do 1º período";
    const dataFim = a.fim.split("-").reverse().join("/");
    if (a.vencido) p.push({ nivel: "alto", texto: prorrogado ? `Experiência terminou em ${dataFim} sem registro de efetivação ou encerramento.` : `1º período terminou em ${dataFim}: registrar prorrogação, efetivação ou encerramento.` });
    else if (a.faltam <= 15) p.push({ nivel: a.faltam <= 3 ? "alto" : "medio", texto: `Experiência: faltam ${a.faltam} dia(s) para o fim ${qual} (${dataFim}).` });
  }
  const ordem = { alto: 0, medio: 1, baixo: 2 };
  return p.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

/** Tempo de casa legível ("2 anos e 3 meses"); null sem data de início. */
export function tempoDeCasa(c = {}, hoje = new Date()) {
  if (!txt(c.data_admissao)) return null;
  const fim = new Date(hoje).toISOString().slice(0, 10);
  const anos = anosCompletos(c.data_admissao, fim);
  const a = new Date(`${c.data_admissao}T12:00:00Z`), b = new Date(`${fim}T12:00:00Z`);
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) meses--;
  meses = Math.max(0, meses) % 12;
  if (anos === 0 && meses === 0) return "menos de 1 mês";
  return [anos ? `${anos} ano${anos > 1 ? "s" : ""}` : null, meses ? `${meses} ${meses > 1 ? "meses" : "mês"}` : null].filter(Boolean).join(" e ");
}

/** CPF mascarado para tela: ***.***.*89-25. */
export function mascararCpf(cpf) {
  const d = String(cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return txt(cpf) ? "inválido" : "não informado";
  return `***.***.*${d.slice(7, 9)}-${d.slice(9)}`;
}
