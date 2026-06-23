import { NextResponse } from "next/server";
import { supabase } from "../lib/supabase";

export const dynamic = 'force-dynamic';

const padR = (str, len) => (str || "").toString().substring(0, len).padEnd(len, ' ');
const padL = (str, len) => (str || "").toString().substring(0, len).padStart(len, '0');
const soNumeros = (str) => (str || "").replace(/\D/g, "");

export async function GET(request) {
  try {

    const { searchParams } = new URL(request.url);
    const unidadeId = searchParams.get("unidadeId");

    if (!unidadeId) {
      return new NextResponse("Faltando unidadeId", { status: 400 });
    }

    // 1. Busca dados da Unidade Empregadora
    const { data: unidade, error: errUnid } = await supabase
      .from("unidades")
      .select("*")
      .eq("id", unidadeId)
      .single();

    if (errUnid) {
      return new NextResponse("Erro ao buscar unidade: " + errUnid.message, { status: 200 });
    }
    if (!unidade) {
      return new NextResponse("Unidade não encontrada", { status: 404 });
    }

    // 2. Busca todos os Colaboradores da Unidade
    const { data: colaboradores, error: errColab } = await supabase
      .from("colaboradores")
      .select("id, nome")
      .eq("unidade_id", unidadeId);
      
    if (errColab) {
      return new NextResponse("Erro ao buscar colaboradores: " + errColab.message, { status: 200 });
    }

    const colabMap = {};
    if(colaboradores) {
       colaboradores.forEach(c => colabMap[c.id] = c.nome);
    }

    // 3. Busca os registros de ponto
    const { data: pontos, error: errPontos } = await supabase
      .from("registro_ponto")
      .select("*")
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: true });

    if (errPontos) {
      return new NextResponse("Erro ao buscar pontos: " + errPontos.message, { status: 200 });
    }
    if (!pontos) {
      return new NextResponse("Sem dados", { status: 200 });
    }

    // 4. Construção do AFD
    let nsr = 1;
    const formatterSP = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
      hour12: false
    });
    
    const getParts = (dateObj) => {
       const parts = formatterSP.formatToParts(dateObj);
       return {
          D: parts.find(p => p.type === 'day')?.value || "00",
          M: parts.find(p => p.type === 'month')?.value || "00",
          Y: parts.find(p => p.type === 'year')?.value || "0000",
          h: parts.find(p => p.type === 'hour')?.value || "00",
          m: parts.find(p => p.type === 'minute')?.value || "00"
       };
    };

    const hojeP = getParts(new Date());
    const dataGeracao = hojeP.D + hojeP.M + hojeP.Y;
    const horaGeracao = hojeP.h + hojeP.m;
    
    const cnpjApenasNum = soNumeros(unidade.cnpj || "00000000000000");

    let linhas = [];

    // REGISTRO TIPO 1 (Cabeçalho)
    const header = "1" + 
                   "1" + 
                   padL(cnpjApenasNum, 14) + 
                   padR("", 14) + 
                   padR(unidade.nome || "Empresa", 150) + 
                   "A" + 
                   dataGeracao + 
                   horaGeracao + 
                   padL("1", 9) + 
                   "001";
                   
    linhas.push(header);

    // REGISTRO TIPO 3 (Batidas de Ponto)
    pontos.forEach(pt => {
       const dataFormatada = pt.data_referencia ? pt.data_referencia.split("-").reverse().join("") : "00000000"; // DDMMYYYY
       const nomeColab = padR(colabMap[pt.colaborador_id] || "DESCONHECIDO", 52);
       const cpfMock = padL("00000000000", 11); 

       const adicionarBatida = (horaISO, tipoBatidaChar) => {
          if(!horaISO) return;
          const bp = getParts(new Date(horaISO));
          const horaStr = bp.h + bp.m;
          
          const detalhe = "3" + 
                          padL(nsr.toString(), 9) + 
                          dataFormatada + 
                          horaStr + 
                          cpfMock + 
                          nomeColab;
                          
          linhas.push(detalhe);
          nsr++;
       };

       adicionarBatida(pt.hora_entrada, "E");
       adicionarBatida(pt.hora_saida_intervalo, "S");
       adicionarBatida(pt.hora_retorno_intervalo, "E");
       adicionarBatida(pt.hora_saida, "S");
    });

    const conteudoAFD = linhas.join("\r\n");

    const resposta = new NextResponse(conteudoAFD);
    resposta.headers.set("Content-Type", "text/plain; charset=utf-8");
    resposta.headers.set("Content-Disposition", `attachment; filename="AFD_REPA_${cnpjApenasNum}_${dataGeracao}.txt"`);

    return resposta;
  } catch (error) {
    console.error("ERRO CRÍTICO AFD:", error);
    return new NextResponse("Erro Interno do Servidor: " + error.message, { status: 200 });
  }
}
