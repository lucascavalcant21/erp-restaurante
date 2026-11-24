// AÇÕES DE RH PELO JHON (dono, 23/11/2026: "consigo passar tudo isso para o
// Jhon e o Jhon já coloca para mim"): dar folga, funcionário doente (atestado)
// e feriado. Sempre com prévia e Confirmar (risco MEDIUM). O que não foi dito
// é PERGUNTADO, nunca inventado. Grava com o usuário logado nas mesmas tabelas
// da tela Ações rápidas do RH (o RLS do banco confere a permissão).
// Leitura do texto: app/lib/rh-texto.mjs. Regra do domingo: folgas-domingo.mjs.

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { pessoasDoTexto, periodoDoTexto, nomeDoFeriado, somar, dataCurtaBR, diaDaSemanaBR, hojeEmSP } from "../../rh-texto.mjs";
import { ehDomingo, folgasDeDomingoNoMes } from "../../folgas-domingo.mjs";
import { limiteDomingos } from "../../rh-rapido.mjs";

const ROTA = "/dashboard/rh/rapido";
const primeiro = (n) => String(n || "").trim().split(/\s+/)[0];
const quando = (d) => `${diaDaSemanaBR(d)}, ${dataCurtaBR(d)}`;
const periodoTxt = (a, b) => (a === b ? quando(a) : `de ${dataCurtaBR(a)} a ${dataCurtaBR(b)}`);
const diasEntre = (a, b) => { const out = []; for (let d = a; d <= b && out.length < 31; d = somar(d, 1)) out.push(d); return out; };
const semPermissao = (e) => /row-level security|permission denied|42501/i.test(e?.message || "");

export const paramsRh = s.object({
  texto: s.opcional(s.string({ min: 1, max: 500 })),
  pessoaId: s.opcional(s.uuid()),
  inicio: s.opcional(s.string({ min: 1, max: 60 })),
  dias: s.opcional(s.number({ min: 1, max: 30, inteiro: true })),
  nome: s.opcional(s.string({ min: 2, max: 80 })),
});
const CAMPOS = ["texto", "pessoaId", "inicio", "dias", "nome"];

/** A resposta "sábado", "dia 25" ou "2026-11-28" vira data; o resto passa como veio. */
function aplicarResposta(params, campo, valor) {
  const p = { ...params };
  if (campo === "inicio") {
    const v = String(valor || "");
    p.inicio = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : periodoDoTexto(v, hojeEmSP()).inicio || null;
    if (!p.inicio) p.inicioInvalido = true;
  } else p[campo] = valor;
  return p;
}

const pergunta = (campo, texto, opcoes = null) => ({ faltando: { campo, texto, opcoes, livre: !opcoes || campo === "inicio" } });

async function equipe(ctx) {
  return ((await ler(ctx.dbe.from("colaboradores").select("id, nome, status, genero").order("nome").limit(500), "colaboradores")) || [])
    .filter((c) => (c.status || "ativo") === "ativo");
}

function quem(ctx, p, eq, { varias = true } = {}) {
  if (p.pessoaId) {
    const c = eq.find((x) => x.id === p.pessoaId);
    return c ? { pessoas: [c] } : { erro: "Funcionário não encontrado nesta unidade." };
  }
  const r = pessoasDoTexto(p.texto || "", eq);
  const pessoas = r.ids.map((id) => eq.find((c) => c.id === id)).filter(Boolean);
  if (pessoas.length && (varias || pessoas.length === 1)) return { pessoas };
  const opcoes = (r.ambiguos[0]?.opcoes || (pessoas.length > 1 ? pessoas : eq)).slice(0, 24).map((c) => ({ id: c.id, rotulo: c.nome }));
  if (!opcoes.length) return { erro: "Não há funcionário ativo cadastrado nesta unidade." };
  return { pergunta: pergunta("pessoaId", r.ambiguos.length ? `Qual ${primeiro(r.ambiguos[0].termo) || "pessoa"}?` : pessoas.length > 1 ? "Para quem é? (uma pessoa por atestado)" : "Para quem?", opcoes) };
}

function quandoPergunta(texto, hoje, incluirOntem = false) {
  const ops = [...(incluirOntem ? [{ id: somar(hoje, -1), rotulo: "Ontem" }] : []), { id: hoje, rotulo: "Hoje" }, { id: somar(hoje, 1), rotulo: "Amanhã" }, { id: somar(hoje, 2), rotulo: quando(somar(hoje, 2)) }];
  return pergunta("inicio", texto, ops);
}

// ═══ Dar folga ═══════════════════════════════════════════════════════════════

async function prepararFolga(ctx, params) {
  const p = params || {};
  const hoje = hojeEmSP();
  const eq = await equipe(ctx);
  const q = quem(ctx, p, eq);
  if (q.erro) return { erro: q.erro };
  if (q.pergunta) return q.pergunta;
  const lido = periodoDoTexto(p.texto || "", hoje);
  const inicio = p.inicio || lido.inicio;
  if (!inicio) return quandoPergunta(p.inicioInvalido ? "Não entendi a data. Qual dia de folga?" : "Qual dia de folga?", hoje);
  const fim = p.inicio ? inicio : lido.fim || inicio;
  const datas = diasEntre(inicio, fim);
  const ids = q.pessoas.map((c) => c.id);
  const ja = (await ler(ctx.dbe.from("rh_folgas_esporadicas").select("id, colaborador_id, data_folga").in("colaborador_id", ids).gte("data_folga", somar(inicio, -40)).lte("data_folga", somar(fim, 40)), "rh_folgas_esporadicas")) || [];
  const gravar = [];
  const avisos = [];
  for (const c of q.pessoas) {
    for (const d of datas) {
      if (ja.some((f) => f.colaborador_id === c.id && String(f.data_folga).slice(0, 10) === d)) { avisos.push(`${primeiro(c.nome)} já tem folga em ${dataCurtaBR(d)} (não repete).`); continue; }
      gravar.push({ colaborador_id: c.id, nome: primeiro(c.nome), data_folga: d, descricao: ehDomingo(d) ? "Domingo" : "Folga" });
      if (ehDomingo(d)) {
        const n = folgasDeDomingoNoMes([...ja.filter((f) => f.colaborador_id === c.id), ...gravar.filter((g) => g.colaborador_id === c.id)], d.slice(0, 7)).length;
        const lim = limiteDomingos(c);
        if (n > lim) avisos.push(`${primeiro(c.nome)} fica com ${n} folgas de domingo no mês (a regra é ${lim}).`);
      }
    }
  }
  if (inicio < hoje) avisos.push("Data que já passou: folga retroativa muda o espelho de ponto.");
  if (!gravar.length) return { erro: avisos.join(" ") || "Nada para lançar." };
  return {
    pronto: {
      preview: {
        titulo: `Dar folga ${q.pessoas.length === 1 ? `a ${primeiro(q.pessoas[0].nome)}` : `a ${q.pessoas.length} pessoas`}`,
        entidade: null,
        linhas: [
          { rotulo: "Quem", valor: q.pessoas.map((c) => c.nome).join(", ") },
          { rotulo: "Quando", valor: periodoTxt(inicio, fim) },
          { rotulo: "Folgas", valor: String(gravar.length) },
          ...avisos.map((a) => ({ rotulo: "Atenção", valor: a })),
        ],
      },
      payload: { unidade_id: ctx.escopo.unidadeId, folgas: gravar },
    },
  };
}

async function executarFolga(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const feitas = [];
  for (const f of payload.folgas || []) {
    const { error } = await ctx.dbUsuario.from("rh_folgas_esporadicas").insert([{ unidade_id: payload.unidade_id, colaborador_id: f.colaborador_id, data_folga: f.data_folga, descricao: f.descricao }]);
    if (error) return { ok: false, erro: `${semPermissao(error) ? "Só quem tem acesso ao RH pode dar folga." : `Não consegui lançar a folga de ${f.nome} em ${dataCurtaBR(f.data_folga)}: ${error.message}.`}${feitas.length ? ` Já lancei: ${feitas.join(", ")}.` : ""}` };
    feitas.push(`${f.nome} ${dataCurtaBR(f.data_folga)}`);
  }
  return { ok: true, resultado: { feitas }, antes: null, depois: null };
}

const resumoFolga = (rec) => ({
  texto: `Pronto: folga lançada (${(rec.resultado?.feitas || []).join(", ")}). Já aparece no ponto e no espelho.`,
  linhas: (rec.resultado?.feitas || []).map((x) => ({ rotulo: "Folga", valor: x })),
  acoes: [{ rotulo: "Abrir Ações rápidas do RH", rota: ROTA }],
  sugestoes: ["Quem está de folga esta semana?", "Lança feriado"],
  referencia: null,
});

export const darFolga = Object.freeze({
  id: "rh.dayOff", nome: "Dar folga", modulo: "rh", capacidade: "rh_rapido", risco: "MEDIUM", disponivel: true, precisaConfirmacao: true,
  descricao: "Lança folga para uma ou mais pessoas em um ou mais dias (rh_folgas_esporadicas).",
  campos: CAMPOS,
  validacoes: ["funcionário ativo da unidade, dito pelo dono", "data dita pelo dono (sem data, pergunta)", "não repete folga já lançada", "avisa domingo acima da regra e folga retroativa", "grava com o usuário logado (RLS do RH)"],
  rollback: "Tirar a folga em RH › Ações rápidas (aba Folga ou Domingos).",
  paramsSchema: paramsRh, aplicarResposta, preparar: prepararFolga, executar: executarFolga, resumoResultado: resumoFolga,
});

// ═══ Doente (atestado) ═══════════════════════════════════════════════════════

async function prepararAtestado(ctx, params) {
  const p = params || {};
  const hoje = hojeEmSP();
  const eq = await equipe(ctx);
  const q = quem(ctx, p, eq, { varias: false });
  if (q.erro) return { erro: q.erro };
  if (q.pergunta) return q.pergunta;
  const c = q.pessoas[0];
  const lido = periodoDoTexto(p.texto || "", hoje);
  // "o Bruno está doente": está = hoje (dito no presente). Sem isso, pergunta desde quando.
  const noPresente = /(^|\s)(est[aá]|t[aá])\s+(doente|mal|passando mal)/i.test(p.texto || "");
  const inicio = p.inicio || lido.inicio || (noPresente ? hoje : null);
  if (!inicio) return quandoPergunta(p.inicioInvalido ? "Não entendi a data. Desde quando?" : `Desde quando ${primeiro(c.nome)} está com atestado?`, hoje, true);
  const dias = p.dias || (lido.dias && (lido.fim !== lido.inicio || /\bdias?\b/i.test(p.texto || "")) ? lido.dias : null);
  if (!dias) return pergunta("dias", `Quantos dias de atestado para ${primeiro(c.nome)}?`, [1, 2, 3, 5, 7, 15].map((n) => ({ id: String(n), rotulo: n === 1 ? "1 dia" : `${n} dias` })));
  const fim = somar(inicio, dias - 1);
  const ja = (await ler(ctx.dbe.from("rh_atestados").select("id, data_inicio, data_fim").eq("colaborador_id", c.id).lte("data_inicio", fim).gte("data_fim", inicio), "rh_atestados")) || [];
  return {
    pronto: {
      preview: {
        titulo: `Atestado de ${primeiro(c.nome)}`,
        entidade: null,
        linhas: [
          { rotulo: "Quem", valor: c.nome },
          { rotulo: "Período", valor: `${periodoTxt(inicio, fim)} (${dias} dia${dias > 1 ? "s" : ""})` },
          { rotulo: "Efeito", valor: "Não conta como falta e não desconta." },
          ...(ja.length ? [{ rotulo: "Atenção", valor: `Já existe atestado que pega esses dias (${ja.map((a) => `${dataCurtaBR(a.data_inicio)}–${dataCurtaBR(a.data_fim || a.data_inicio)}`).join(", ")}).` }] : []),
          { rotulo: "Foto do atestado", valor: "Anexe depois em RH › Ações rápidas › Doente ou na ficha." },
        ],
      },
      payload: { unidade_id: ctx.escopo.unidadeId, colaborador_id: c.id, nome: primeiro(c.nome), data_inicio: inicio, data_fim: fim },
    },
  };
}

async function executarAtestado(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const { error } = await ctx.dbUsuario.from("rh_atestados").insert([{ unidade_id: payload.unidade_id, colaborador_id: payload.colaborador_id, data_inicio: payload.data_inicio, data_fim: payload.data_fim, parcial: false }]);
  if (error) return { ok: false, erro: semPermissao(error) ? "Só quem tem acesso ao RH pode lançar atestado." : `Não consegui lançar o atestado: ${error.message}.` };
  return { ok: true, resultado: { nome: payload.nome, inicio: payload.data_inicio, fim: payload.data_fim }, antes: null, depois: null };
}

const resumoAtestado = (rec) => {
  const r = rec.resultado || {};
  return {
    texto: `Pronto: atestado de ${r.nome} ${periodoTxt(r.inicio, r.fim)}. Melhoras para ${r.nome}!`,
    linhas: [{ rotulo: "Atestado", valor: `${r.nome} · ${periodoTxt(r.inicio, r.fim)}` }],
    acoes: [{ rotulo: "Anexar a foto do atestado", rota: ROTA }],
    sugestoes: ["Quem cobre o turno?", "Dar folga"],
    referencia: null,
  };
};

export const lancarAtestado = Object.freeze({
  id: "rh.sickLeave", nome: "Funcionário doente (atestado)", modulo: "rh", capacidade: "rh_rapido", risco: "MEDIUM", disponivel: true, precisaConfirmacao: true,
  descricao: "Lança atestado (não conta como falta) para um funcionário, do dia dito pelo número de dias dito.",
  campos: CAMPOS,
  validacoes: ["funcionário ativo da unidade", "início e quantidade de dias ditos pelo dono (sem isso, pergunta)", "avisa atestado sobreposto", "grava com o usuário logado (RLS do RH)"],
  rollback: "Editar ou excluir o atestado na ficha do funcionário (RH).",
  paramsSchema: paramsRh, aplicarResposta, preparar: prepararAtestado, executar: executarAtestado, resumoResultado: resumoAtestado,
});

// ═══ Feriado ═════════════════════════════════════════════════════════════════

async function prepararFeriado(ctx, params) {
  const p = params || {};
  const hoje = hojeEmSP();
  const lido = periodoDoTexto(p.texto || "", hoje);
  const data = p.inicio || lido.inicio;
  if (!data) return quandoPergunta(p.inicioInvalido ? "Não entendi a data. Qual dia é feriado?" : "Qual dia é feriado? (ex.: dia 8, 08/12)", hoje);
  const nome = p.nome || nomeDoFeriado(p.texto || "");
  const ja = (await ler(ctx.dbe.from("rh_feriados").select("id, data, nome").eq("data", data), "rh_feriados")) || [];
  if (ja.length) return { erro: `${quando(data)} já é feriado${ja[0].nome ? ` (${ja[0].nome})` : ""}.` };
  return {
    pronto: {
      preview: {
        titulo: "Lançar feriado",
        entidade: null,
        linhas: [
          { rotulo: "Dia", valor: quando(data) },
          { rotulo: "Nome", valor: nome || "Feriado (sem nome)" },
          { rotulo: "Efeito", valor: "Quem trabalhar nesse dia recebe como feriado no espelho." },
        ],
      },
      payload: { unidade_id: ctx.escopo.unidadeId, data, nome: nome || null },
    },
  };
}

async function executarFeriado(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const { error } = await ctx.dbUsuario.from("rh_feriados").insert([{ unidade_id: payload.unidade_id, data: payload.data, nome: payload.nome }]);
  if (error) return { ok: false, erro: semPermissao(error) ? "Só quem tem acesso ao RH pode lançar feriado." : `Não consegui lançar o feriado: ${error.message}.` };
  return { ok: true, resultado: { data: payload.data, nome: payload.nome }, antes: null, depois: null };
}

const resumoFeriado = (rec) => ({
  texto: `Pronto: ${quando(rec.resultado?.data)} é feriado${rec.resultado?.nome ? ` (${rec.resultado.nome})` : ""}.`,
  linhas: [{ rotulo: "Feriado", valor: dataCurtaBR(rec.resultado?.data) }],
  acoes: [{ rotulo: "Ver os feriados", rota: ROTA }],
  sugestoes: ["Dar folga", "Quem trabalha nesse dia?"],
  referencia: null,
});

export const lancarFeriado = Object.freeze({
  id: "rh.holiday", nome: "Lançar feriado", modulo: "rh", capacidade: "rh_rapido", risco: "MEDIUM", disponivel: true, precisaConfirmacao: true,
  descricao: "Lança um feriado da unidade (rh_feriados), com nome se dito.",
  campos: CAMPOS,
  validacoes: ["data dita pelo dono (sem data, pergunta)", "não repete feriado já lançado", "grava com o usuário logado (RLS do RH)"],
  rollback: "Tirar o feriado em RH › Ações rápidas › Feriados.",
  paramsSchema: paramsRh, aplicarResposta, preparar: prepararFeriado, executar: executarFeriado, resumoResultado: resumoFeriado,
});

/** O texto do pedido vai inteiro: quem e quando são lidos no preparar, com a equipe da unidade. */
export const paramsDoTextoRh = (texto) => ({ texto: String(texto || "").slice(0, 500) });
export const PARAMS_DO_RH = Object.freeze({ "rh.dayOff": paramsDoTextoRh, "rh.sickLeave": paramsDoTextoRh, "rh.holiday": paramsDoTextoRh });

/** "corrigir o ponto da Eduarda de ontem" → link para a correção já na pessoa e no dia (a correção é na tela). */
export function linkCorrigirPonto(texto, colaboradores = [], hoje = hojeEmSP()) {
  const ativos = colaboradores.filter((c) => (c.status || "ativo") === "ativo");
  const r = pessoasDoTexto(texto, ativos);
  const data = periodoDoTexto(texto, hoje).inicio || hoje;
  const c = r.ids.length === 1 ? ativos.find((x) => x.id === r.ids[0]) : null;
  if (!c) {
    const opcoes = (r.ambiguos[0]?.opcoes || ativos).slice(0, 12);
    return { texto: "O ponto de quem? Toque no nome e eu abro a correção no dia certo.", acoes: opcoes.map((x) => ({ rotulo: x.nome, rota: `/dashboard/rh/ponto/corrigir?colab=${x.id}&data=${data}` })) };
  }
  return { texto: `Abro a correção do ponto de ${primeiro(c.nome)} em ${quando(data)}. Lá você ajusta o horário e escreve o motivo; a batida original fica guardada.`, acoes: [{ rotulo: `Corrigir o ponto de ${primeiro(c.nome)}`, rota: `/dashboard/rh/ponto/corrigir?colab=${c.id}&data=${data}` }] };
}
