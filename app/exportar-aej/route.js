import { NextResponse } from "next/server";
import { supabase } from "../lib/supabase";
import {
  registro01, registro02, registro03, registro04, registro05, registro07,
  registro08, montarAEJ, nomeArquivoAEJ, soDigitos,
} from "../lib/aej-layout.mjs";
import { jornadaContratadaMin, minutosNoturnosRelogio, comHoraFicta } from "../lib/jornada-calculo.mjs";

// Arquivo Eletrônico de Jornada (AEJ) — Portaria MTP 671/2021, Anexo VI.
//
// É a saída do Programa de Tratamento de Registro de Ponto (art. 82): pega as
// marcações do livro e acrescenta o que o AFD não tem — horário contratual,
// ausências e movimentos do banco de horas.
//
// O art. 82, parágrafo único, limita o tratamento a "acrescentar informações
// para complementar eventuais omissões" ou "indicar marcações indevidas". Por
// isso nada aqui altera a hora de uma marcação: correção entra como marcação
// de fonte "I", com motivo, ao lado da original.
//
// Layout coberto por testes: node app/lib/aej-layout.test.mjs

export const dynamic = "force-dynamic";

// Ordem das marcações no par entrada/saída do dia.
const COMO_MARCA = {
  entrada:           { tp: "E", seq: 1 },
  saida_intervalo:   { tp: "S", seq: 1 },
  retorno_intervalo: { tp: "E", seq: 2 },
  saida_trabalho:    { tp: "S", seq: 2 },
};

// Um código por combinação de horário, para o registro 04 não repetir.
function codigoHorario(c, ehDomingo) {
  const ent = (ehDomingo && c.horario_dom_entrada) || c.horario_entrada || "0000";
  const sai = (ehDomingo && c.horario_dom_saida) || c.horario_saida || "0000";
  const int = Number(c.tempo_intervalo) || 0;
  return `${soDigitos(ent)}-${soDigitos(sai)}-I${int}`.slice(0, 30);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const unidadeId = searchParams.get("unidadeId");
    if (!unidadeId) return new NextResponse("Faltando unidadeId", { status: 400 });

    const hoje = new Date();
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const inicio = searchParams.get("inicio") || `${mes}-01`;
    const fim = searchParams.get("fim") || `${mes}-${String(ultimo).padStart(2, "0")}`;

    const { data: unidade } = await supabase
      .from("unidades").select("*").eq("id", unidadeId).single();
    if (!unidade) return new NextResponse("Unidade não encontrada", { status: 404 });

    const { data: marcacoes, error: errMarc } = await supabase
      .from("ponto_marcacao")
      .select("nsr, colaborador_id, tipo, tipo_alvo, marcado_em, cpf, origem, motivo, data_referencia")
      .eq("unidade_id", unidadeId)
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .order("nsr");

    if (errMarc) {
      if (/ponto_marcacao/i.test(errMarc.message)) {
        return new NextResponse(
          "O livro de marcações ainda não existe neste banco. Rode db/migracao_ponto_nsr.sql antes de exportar o AEJ.",
          { status: 503 },
        );
      }
      return new NextResponse("Erro ao buscar marcações: " + errMarc.message, { status: 500 });
    }

    const { data: colaboradores } = await supabase
      .from("colaboradores").select("*").eq("unidade_id", unidadeId);

    const { data: folgas } = await supabase
      .from("rh_folgas_esporadicas").select("colaborador_id, data_folga")
      .gte("data_folga", inicio).lte("data_folga", fim);

    const { data: banco } = await supabase
      .from("rh_banco_horas").select("colaborador_id, data, minutos, tipo")
      .gte("data", inicio).lte("data", fim);

    // Só entram no arquivo os vínculos que têm marcação no período: vínculo sem
    // marcação nenhuma polui o arquivo e não prova nada.
    const comMarcacao = new Set((marcacoes || []).map(m => m.colaborador_id));
    const vinculos = new Map();
    let idVinculo = 0;
    for (const c of (colaboradores || [])) {
      if (!comMarcacao.has(c.id)) continue;
      vinculos.set(c.id, { id: ++idVinculo, colaborador: c });
    }

    const registros = [];
    const registroInpi = process.env.REP_P_REGISTRO_INPI || "0".repeat(17);
    const identificador = soDigitos(unidade.cnpj || "");

    registros.push(registro01({
      tpIdtEmpregador: identificador.length === 11 ? "2" : "1",
      idtEmpregador: identificador,
      caepf: unidade.caepf || "", cno: unidade.cno || "",
      razaoOuNome: unidade.nome || "Empresa",
      dataInicial: inicio, dataFinal: fim, geradoEm: new Date(),
    }));

    registros.push(registro02({ idRepAej: 1, tpRep: "3", nrRep: registroInpi }));

    for (const { id, colaborador } of vinculos.values()) {
      registros.push(registro03({ idtVinculoAej: id, cpf: colaborador.cpf, nomeEmp: colaborador.nome }));
    }

    // ── Horários contratuais, um registro por combinação usada ──────────────
    const horarios = new Map();
    const registrarHorario = (c, ehDomingo) => {
      const cod = codigoHorario(c, ehDomingo);
      if (horarios.has(cod)) return cod;

      const ent = (ehDomingo && c.horario_dom_entrada) || c.horario_entrada;
      const sai = (ehDomingo && c.horario_dom_saida) || c.horario_saida;
      if (!ent || !sai) return "";

      const iniInt = (ehDomingo && c.intervalo_dom_inicio) || c.intervalo_inicio;
      const fimInt = (ehDomingo && c.intervalo_dom_fim) || c.intervalo_fim;
      const pares = (iniInt && fimInt) ? [[ent, iniInt], [fimInt, sai]] : [[ent, sai]];

      // A duração vai com a hora noturna reduzida (observação 3 do Anexo VI):
      // é a jornada contratada convertida, não o tempo de relógio.
      const dataBase = `${inicio.slice(0, 8)}01`;
      const contratada = jornadaContratadaMin(c, dataBase) || 0;
      const hoje0 = new Date(`${dataBase}T00:00:00`);
      const [hE, mE] = String(ent).split(":").map(Number);
      const [hS, mS] = String(sai).split(":").map(Number);
      const entradaD = new Date(hoje0); entradaD.setHours(hE || 0, mE || 0, 0, 0);
      const saidaD = new Date(entradaD);
      saidaD.setHours(hS || 0, mS || 0, 0, 0);
      if (saidaD <= entradaD) saidaD.setDate(saidaD.getDate() + 1);
      const noturnoRelogio = minutosNoturnosRelogio(entradaD, saidaD);
      const duracao = contratada + (comHoraFicta(noturnoRelogio) - noturnoRelogio);

      horarios.set(cod, true);
      registros.push(registro04({ codHorContratual: cod, durJornada: duracao, pares }));
      return cod;
    };

    // ── Marcações tratadas ──────────────────────────────────────────────────
    for (const m of (marcacoes || [])) {
      const v = vinculos.get(m.colaborador_id);
      if (!v) continue;

      // Ajuste entra como marcação incluída manualmente, ao lado da original:
      // o art. 82 não autoriza reescrever a marcação, só complementar.
      const ehAjuste = m.tipo === "ajuste";
      const chave = ehAjuste ? (m.tipo_alvo || "entrada") : m.tipo;
      const como = COMO_MARCA[chave];
      if (!como) continue;

      const ehDomingo = new Date(`${m.data_referencia}T12:00:00`).getDay() === 0;
      const cod = (como.tp === "E" && como.seq === 1) ? registrarHorario(v.colaborador, ehDomingo) : "";

      registros.push(registro05({
        idtVinculoAej: v.id,
        dataHoraMarc: m.marcado_em,
        idRepAej: 1,
        tpMarc: como.tp,
        seqEntSaida: como.seq,
        // "O" só quando a marcação veio mesmo do REP; importação e ajuste são
        // inclusão manual, e declarar o contrário é o que a fiscalização
        // procura.
        fonteMarc: (ehAjuste || m.origem === "manual" || m.origem === "importacao") ? "I" : "O",
        codHorContratual: cod,
        motivo: (ehAjuste || m.origem === "manual") ? (m.motivo || "Inclusão manual pelo RH") : "",
      }));
    }

    // ── Ausências: folga semanal como DSR ───────────────────────────────────
    for (const f of (folgas || [])) {
      const v = vinculos.get(f.colaborador_id);
      if (!v) continue;
      registros.push(registro07({
        idtVinculoAej: v.id, tipo: 1, data: String(f.data_folga).slice(0, 10),
      }));
    }

    // ── Banco de horas ──────────────────────────────────────────────────────
    for (const b of (banco || [])) {
      const v = vinculos.get(b.colaborador_id);
      if (!v) continue;
      registros.push(registro07({
        idtVinculoAej: v.id, tipo: 3, data: String(b.data).slice(0, 10),
        qtMinutos: Math.abs(Number(b.minutos) || 0),
        // "excesso" é intervalo passado do horário: sai do banco, não entra.
        tipoMovBH: b.tipo === "excesso" ? 2 : 1,
      }));
    }

    registros.push(registro08({
      nomeProg: "Hefisto — Tratamento de Registro de Ponto",
      versaoProg: process.env.PTRP_VERSAO || "1.0",
      idtDesenv: process.env.REP_P_CNPJ_DESENVOLVEDOR || identificador,
      razaoNomeDesenv: process.env.PTRP_DESENVOLVEDOR || unidade.nome || "",
      emailDesenv: process.env.PTRP_EMAIL || "",
    }));

    const conteudo = montarAEJ({ registros, assinatura: "" });
    const resposta = new NextResponse(Buffer.from(conteudo, "latin1"));
    resposta.headers.set("Content-Type", "text/plain; charset=ISO-8859-1");
    resposta.headers.set(
      "Content-Disposition",
      `attachment; filename="${nomeArquivoAEJ({ identificador, inicio, fim })}"`,
    );
    return resposta;
  } catch (error) {
    console.error("ERRO AEJ:", error);
    return new NextResponse("Erro interno: " + error.message, { status: 500 });
  }
}
