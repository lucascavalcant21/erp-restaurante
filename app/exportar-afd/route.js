import { NextResponse } from "next/server";
import { supabase } from "../lib/supabase";

// Arquivo Fonte de Dados (AFD) — o arquivo que a fiscalização pede.
//
// Lê do livro de marcações (ponto_marcacao), não de registro_ponto. A diferença
// é o que dá valor ao arquivo: o NSR vem gravado em cada marcação, sequencial e
// imutável. A versão anterior numerava do 1 a cada exportação — dois arquivos
// do mesmo período saíam com numeração diferente, o oposto do que o NSR existe
// para provar. O CPF também era fixo em zeros.
//
// ATENÇÃO ao layout: os tamanhos de campo abaixo seguem a estrutura que já
// estava no projeto. Antes de entregar o arquivo numa fiscalização, valide o
// layout com o contador contra o anexo vigente da Portaria MTP 671/2021 — um
// campo fora de posição invalida o arquivo inteiro.

export const dynamic = "force-dynamic";

const padR = (str, len) => (str || "").toString().substring(0, len).padEnd(len, " ");
const padL = (str, len) => (str || "").toString().substring(0, len).padStart(len, "0");
const soNumeros = (str) => (str || "").replace(/\D/g, "");

// Como o AFD identifica o sentido de cada marcação.
const SENTIDO = {
  entrada: "E",
  saida_intervalo: "S",
  retorno_intervalo: "E",
  saida_trabalho: "S",
  ajuste: "A",
};

function partesSP(data) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = fmt.formatToParts(data);
  const pega = (t) => p.find(x => x.type === t)?.value || "00";
  return { D: pega("day"), M: pega("month"), Y: pega("year"), h: pega("hour"), m: pega("minute") };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const unidadeId = searchParams.get("unidadeId");
    if (!unidadeId) return new NextResponse("Faltando unidadeId", { status: 400 });

    // A fiscalização pede um período, não o histórico inteiro. Sem parâmetro,
    // o mês corrente.
    const hoje = new Date();
    const mesPadrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const inicio = searchParams.get("inicio") || `${mesPadrao}-01`;
    const fim = searchParams.get("fim") || `${mesPadrao}-${String(ultimoDia).padStart(2, "0")}`;

    const { data: unidade, error: errUnid } = await supabase
      .from("unidades").select("*").eq("id", unidadeId).single();
    if (errUnid) return new NextResponse("Erro ao buscar unidade: " + errUnid.message, { status: 500 });
    if (!unidade) return new NextResponse("Unidade não encontrada", { status: 404 });

    const { data: colaboradores } = await supabase
      .from("colaboradores").select("id, nome, cpf").eq("unidade_id", unidadeId);
    const porId = new Map((colaboradores || []).map(c => [c.id, c]));

    const { data: marcacoes, error: errMarc } = await supabase
      .from("ponto_marcacao")
      .select("nsr, colaborador_id, tipo, marcado_em, data_referencia")
      .eq("unidade_id", unidadeId)
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .order("nsr");

    if (errMarc) {
      // Migração não rodada: dizer isso é melhor do que devolver um arquivo
      // vazio, que passaria por "sem movimento no período".
      if (/ponto_marcacao/i.test(errMarc.message)) {
        return new NextResponse(
          "O livro de marcações ainda não existe neste banco. Rode db/migracao_ponto_nsr.sql antes de exportar o AFD.",
          { status: 503 },
        );
      }
      return new NextResponse("Erro ao buscar marcações: " + errMarc.message, { status: 500 });
    }

    const agora = partesSP(new Date());
    const dataGeracao = agora.D + agora.M + agora.Y;
    const horaGeracao = agora.h + agora.m;
    const cnpj = soNumeros(unidade.cnpj || "");

    const linhas = [];

    // Registro tipo 1 — cabeçalho.
    linhas.push(
      "1" + "1" +
      padL(cnpj, 14) +
      padR("", 14) +
      padR(unidade.nome || "Empresa", 150) +
      "A" +
      dataGeracao + horaGeracao +
      padL("1", 9) +
      "001",
    );

    // Registro tipo 3 — marcações, na ordem do NSR gravado.
    for (const m of (marcacoes || [])) {
      const colab = porId.get(m.colaborador_id);
      const p = partesSP(new Date(m.marcado_em));
      linhas.push(
        "3" +
        padL(String(m.nsr), 9) +
        p.D + p.M + p.Y +
        p.h + p.m +
        padL(soNumeros(colab?.cpf), 11) +
        padR(colab?.nome || "DESCONHECIDO", 52) +
        (SENTIDO[m.tipo] || "E"),
      );
    }

    // Registro tipo 9 — trailer. É ele que fecha o arquivo e diz quantas
    // marcações deveriam estar dentro; sem trailer, truncar o arquivo passa
    // despercebido.
    linhas.push(
      "9" +
      padL("0", 9) + padL("0", 9) + padL("0", 9) +
      padL(String((marcacoes || []).length), 9) +
      "9",
    );

    const resposta = new NextResponse(linhas.join("\r\n") + "\r\n");
    resposta.headers.set("Content-Type", "text/plain; charset=utf-8");
    resposta.headers.set(
      "Content-Disposition",
      `attachment; filename="AFD_${cnpj || "SEMCNPJ"}_${inicio}_a_${fim}.txt"`,
    );
    return resposta;
  } catch (error) {
    console.error("ERRO AFD:", error);
    return new NextResponse("Erro interno: " + error.message, { status: 500 });
  }
}
