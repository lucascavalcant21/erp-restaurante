import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const padR = (str, len) => (str || "").toString().substring(0, len).padEnd(len, ' ');
const padL = (str, len) => (str || "").toString().substring(0, len).padStart(len, '0');
const soNumeros = (str) => (str || "").replace(/\D/g, "");

export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl || "", supabaseKey || "");

  const { searchParams } = new URL(request.url);
  const unidadeId = searchParams.get("unidadeId");

  if (!unidadeId) {
    return new NextResponse("Faltando unidadeId", { status: 400 });
  }

  // 1. Busca dados da Unidade Empregadora
  const { data: unidade } = await supabase
    .from("unidades")
    .select("*")
    .eq("id", unidadeId)
    .single();

  if (!unidade) {
    return new NextResponse("Unidade não encontrada", { status: 404 });
  }

  // 2. Busca todos os Colaboradores da Unidade
  const { data: colaboradores } = await supabase
    .from("colaboradores")
    .select("id, nome")
    .eq("unidade_id", unidadeId);
    
  const colabMap = {};
  if(colaboradores) {
     colaboradores.forEach(c => colabMap[c.id] = c.nome);
  }

  // 3. Busca os registros de ponto
  const { data: pontos } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: true });

  if (!pontos) {
    return new NextResponse("Sem dados", { status: 200 });
  }

  // 4. Construção do AFD
  let nsr = 1;
  const dataHoje = new Date();
  const dataGeracao = padL(dataHoje.getDate(), 2) + padL(dataHoje.getMonth() + 1, 2) + dataHoje.getFullYear();
  const horaGeracao = padL(dataHoje.getHours(), 2) + padL(dataHoje.getMinutes(), 2);
  
  const cnpjApenasNum = soNumeros(unidade.cnpj || "00000000000000");

  let linhas = [];

  // REGISTRO TIPO 1 (Cabeçalho)
  // 1(Tipo) + 1(IDEmpregador) + 14(CNPJ) + 14(CEI) + 150(Razao) + 1(TipoREP) + 8(Data) + 4(Hora) + 9(Seq) + 3(Versão)
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
  // Desdobrar cada registro em até 4 batidas.
  pontos.forEach(pt => {
     const dataFormatada = pt.data_referencia ? pt.data_referencia.split("-").reverse().join("") : "00000000"; // DDMMYYYY
     const nomeColab = padR(colabMap[pt.colaborador_id] || "DESCONHECIDO", 52);
     // No AFD oficial de REP-A, a PIS/CPF fica com 11 caracteres. Usaremos o ID ou um mock para cumprir o tamanho, já que o MVP não coleta CPF
     const cpfMock = padL("00000000000", 11); 

     const adicionarBatida = (horaISO, tipoBatidaChar) => {
        if(!horaISO) return;
        const d = new Date(horaISO);
        const horaStr = padL(d.getHours(), 2) + padL(d.getMinutes(), 2);
        
        // 3(Tipo) + 9(NSR) + 8(Data) + 4(Hora) + 11(CPF) + 52(Nome)
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

  // Juntar linhas com quebra de linha do Windows
  const conteudoAFD = linhas.join("\r\n");

  const resposta = new NextResponse(conteudoAFD);
  resposta.headers.set("Content-Type", "text/plain; charset=utf-8");
  resposta.headers.set("Content-Disposition", `attachment; filename="AFD_REPA_${cnpjApenasNum}_${dataGeracao}.txt"`);

  return resposta;
}
