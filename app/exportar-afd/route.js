import { NextResponse } from "next/server";
import { supabase } from "../lib/supabase";
import {
  registro1, registro7, montarAFD, nomeArquivoAFD, soDigitos,
} from "../lib/afd-layout.mjs";

// Arquivo Fonte de Dados (AFD) — Portaria MTP 671/2021, Anexo V, layout REP-P.
//
// Lê do livro de marcações e usa o NSR e o hash GRAVADOS em cada linha. É essa
// a diferença que dá valor ao arquivo: recalcular a numeração na exportação
// anula justamente o que o NSR existe para provar. A versão anterior numerava
// do 1 a cada exportação e usava CPF fixo em zeros.
//
// O layout está coberto por testes de posição: node app/lib/afd-layout.test.mjs
//
// O que ainda falta para o arquivo ser ENTREGÁVEL, e não só correto:
//  · registro do programa no INPI (art. 91) — vai no campo 7 do cabeçalho;
//  · assinatura eletrônica com certificado ICP-Brasil (art. 88);
//  · Atestado Técnico e Termo de Responsabilidade (art. 89).
// Nenhum dos três é código. Sem eles o arquivo serve para conferência interna.

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const unidadeId = searchParams.get("unidadeId");
    if (!unidadeId) return new NextResponse("Faltando unidadeId", { status: 400 });

    // A fiscalização pede um período. Sem parâmetro, o mês corrente.
    const hoje = new Date();
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const inicio = searchParams.get("inicio") || `${mes}-01`;
    const fim = searchParams.get("fim") || `${mes}-${String(ultimo).padStart(2, "0")}`;

    const { data: unidade, error: errUnid } = await supabase
      .from("unidades").select("*").eq("id", unidadeId).single();
    if (errUnid) return new NextResponse("Erro ao buscar unidade: " + errUnid.message, { status: 500 });
    if (!unidade) return new NextResponse("Unidade não encontrada", { status: 404 });

    const { data: marcacoes, error: errMarc } = await supabase
      .from("ponto_marcacao")
      .select("nsr, colaborador_id, tipo, marcado_em, gravado_em, cpf, coletor, online, hash")
      .eq("unidade_id", unidadeId)
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .order("nsr");

    if (errMarc) {
      // Migração não rodada: dizer isso é melhor que devolver arquivo vazio,
      // que passaria por "sem movimento no período".
      if (/ponto_marcacao/i.test(errMarc.message)) {
        return new NextResponse(
          "O livro de marcações ainda não existe neste banco. Rode db/migracao_ponto_nsr.sql antes de exportar o AFD.",
          { status: 503 },
        );
      }
      return new NextResponse("Erro ao buscar marcações: " + errMarc.message, { status: 500 });
    }

    // Campo 7 do cabeçalho: número de registro do programa no INPI. Zeros
    // enquanto o registro não sair — assim fica evidente no arquivo que falta,
    // em vez de parecer preenchido.
    const registroInpi = process.env.REP_P_REGISTRO_INPI || "0".repeat(17);
    const identificador = soDigitos(unidade.cnpj || "");

    const cabecalho = registro1({
      tipoIdentificador: identificador.length === 11 ? "2" : "1",
      identificador,
      caepfCno: unidade.caepf || unidade.cno || "",
      razaoSocial: unidade.nome || "Empresa",
      identificadorRep: registroInpi,
      dataInicial: inicio,
      dataFinal: fim,
      geradoEm: new Date(),
      tipoIdentDesenvolvedor: "1",
      identDesenvolvedor: process.env.REP_P_CNPJ_DESENVOLVEDOR || "",
    });

    // Ajuste não é marcação do trabalhador: ele registra a correção no livro,
    // mas não entra como registro tipo 7 no AFD.
    const linhas = (marcacoes || [])
      .filter(m => m.tipo !== "ajuste")
      .map(m => registro7({
        nsr: m.nsr,
        marcadoEm: m.marcado_em,
        cpf: m.cpf,
        gravadoEm: m.gravado_em || m.marcado_em,
        coletor: m.coletor || "02",
        online: m.online || "0",
        hash: m.hash || "",
      }));

    const conteudo = montarAFD({
      cabecalho,
      marcacoes: linhas,
      assinatura: "", // só com certificado ICP-Brasil (art. 88)
    });

    // Anexo V, item 2: padrão ASCII da norma ISO 8859-1.
    const corpo = Buffer.from(conteudo, "latin1");

    const resposta = new NextResponse(corpo);
    resposta.headers.set("Content-Type", "text/plain; charset=ISO-8859-1");
    resposta.headers.set(
      "Content-Disposition",
      `attachment; filename="${nomeArquivoAFD({ identificadorRep: registroInpi, identificador })}"`,
    );
    resposta.headers.set("X-AFD-Marcacoes", String(linhas.length));
    return resposta;
  } catch (error) {
    console.error("ERRO AFD:", error);
    return new NextResponse("Erro interno: " + error.message, { status: 500 });
  }
}
