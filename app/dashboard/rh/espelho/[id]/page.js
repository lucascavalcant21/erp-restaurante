"use client";

import { useERP } from "../../../../context/ERPContext";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { fetchPontosMes } from "../../../../lib/ponto";
import { fetchFolgasEsporadicas, fetchBancoHorasColaborador, fetchFeriados, calcularAdicionaisPorDia, entradaContratadaDoDia, jornadaContratadaMin, fetchEspelhoFechado, fecharEspelho } from "../../../../lib/rh";
import { Printer, ArrowLeft } from "lucide-react";

export default function EspelhoDePonto() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { abrirMenu } = useERP();
  
  const colabId = params.id;
  const mesParam = searchParams.get("mes") || new Date().toISOString().slice(0, 7); // ex: 2026-06

  const [colaborador, setColaborador] = useState(null);
  const [pontos, setPontos] = useState([]);
  const [folgasEsporadicas, setFolgasEsporadicas] = useState([]);
  const [bancoMes, setBancoMes] = useState([]);
  const [feriadosMes, setFeriadosMes] = useState([]);
  const [fechamento, setFechamento] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!colabId) return;
      
      // Busca Colaborador
      const { data: colab } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("id", colabId)
        .single();
        
      if (colab) {
        if (colab.unidade_id) {
           const { data: unid } = await supabase.from("unidades").select("nome, cnpj").eq("id", colab.unidade_id).single();
           colab.unidade = unid;
        }
        // Mês encerrado: a folha tem que sair igual à que foi assinada. Se já
        // existe retrato do contrato, ele manda; se não existe, tira um agora e
        // congela. Mês corrente segue ao vivo, porque ainda está sendo formado.
        const mesAtual = new Date().toISOString().slice(0, 7);
        if (mesParam < mesAtual) {
          const { data: fechado } = await fetchEspelhoFechado(colabId, mesParam);
          if (fechado?.contrato) {
            Object.assign(colab, fechado.contrato);
            setFechamento(fechado);
          } else {
            // Best-effort: se o fechamento falhar (rede, permissão), a folha
            // ainda imprime com o cadastro atual em vez de não abrir.
            const res = await fecharEspelho(colab, mesParam);
            if (!res?.error) {
              const { data: novo } = await fetchEspelhoFechado(colabId, mesParam);
              if (novo) setFechamento(novo);
            }
          }
        }
        setColaborador(colab);
      }

      // Busca Pontos
      const { data: pts } = await fetchPontosMes(colabId, mesParam);
      setPontos(pts || []);

      // Busca Folgas Esporádicas
      const resFolgas = await fetchFolgasEsporadicas(colabId);
      setFolgasEsporadicas(resFolgas.data || []);

      // Banco de horas do mês (intervalos não tirados)
      const resBanco = await fetchBancoHorasColaborador(colabId, mesParam);
      setBancoMes(resBanco.data || []);

      // Feriados do mês (para o relatório de adicionais dia a dia)
      if (colab?.unidade_id) {
        const resFer = await fetchFeriados(colab.unidade_id, mesParam);
        setFeriadosMes(resFer.data || []);
      }

      setLoading(false);
    }
    carregar();
  }, [colabId, mesParam]);

  if (loading) return <div className="p-10 font-bold text-center text-slate-500">Carregando relatório...</div>;
  if (!colaborador) return <div className="p-10 font-bold text-center text-red-500">Colaborador não encontrado.</div>;

  const diasNoMes = new Date(mesParam.slice(0,4), mesParam.slice(5,7), 0).getDate();
  const arrayDias = Array.from({length: diasNoMes}, (_, i) => i + 1);

  // ── Cabeçalho no formato da folha oficial ─────────────────────────────────
  // "Lotação....:" — os pontos preenchem até a mesma coluna em todos os
  // rótulos, que é como a folha datilografada alinha os dois pontos.
  const rotulo = (texto) => `${texto}${".".repeat(Math.max(0, 11 - texto.length))}:`;
  const dataBR = (iso) => iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—";
  const periodoBR = `${dataBR(`${mesParam}-01`)} à ${dataBR(`${mesParam}-${String(diasNoMes).padStart(2, "0")}`)}`;

  // "01 SÁB" — o dia da semana ao lado do número, como na folha de papel.
  const SIGLA_DIA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const rotuloDia = (dia) => {
    const d = new Date(`${mesParam}-${String(dia).padStart(2, "0")}T12:00:00`);
    return `${String(dia).padStart(2, "0")} ${SIGLA_DIA[d.getDay()]}`;
  };

  // A jornada contratada, dia a dia. O domingo pode ter horário próprio; os
  // demais seguem o padrão. O intervalo sai pela duração quando a janela não
  // está cadastrada — o sistema guarda os minutos, não as horas de início e fim.
  const NOME_DIA = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
  const trabalhaNo = (n) => String(colaborador.dias_trabalho || "0,1,2,3,4,5,6").split(",").includes(String(n));

  // A janela do intervalo é o que a folha mostra ("int: 17:00 as 18:00"). Quem
  // ainda não tem a janela cadastrada cai na duração, para a linha não sair
  // vazia — mas o certo é preencher as duas horas no RH.
  const janelaIntervalo = (ehDom) => {
    const ini = (ehDom && colaborador.intervalo_dom_inicio) || colaborador.intervalo_inicio;
    const fim = (ehDom && colaborador.intervalo_dom_fim) || colaborador.intervalo_fim;
    if (ini && fim) return ` - int: ${ini} as ${fim}`;
    return colaborador.tempo_intervalo ? ` - int: ${colaborador.tempo_intervalo} min` : "";
  };

  const linhasHorario = [2, 3, 4, 5, 6, 0]
    .filter(trabalhaNo)
    .map(n => {
      const ehDom = n === 0;
      const ent = (ehDom && colaborador.horario_dom_entrada) || colaborador.horario_entrada || "—";
      const sai = (ehDom && colaborador.horario_dom_saida) || colaborador.horario_saida || "—";
      return `${NOME_DIA[n]} Ent: ${ent} Sai: ${sai}${janelaIntervalo(ehDom)}`;
    });

  // Calcula horas
  const calcularHorasDecimais = (h1, h2) => {
    if (!h1 || !h2) return 0;
    const diff = new Date(h2) - new Date(h1);
    if (diff < 0) return 0;
    return diff / (1000 * 60 * 60);
  };

  const fmtHoras = (horasDecimais) => {
    const h = Math.floor(horasDecimais);
    const m = Math.round((horasDecimais - h) * 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  };

  let totalHorasMes = 0;

  const mascaraCNPJ = (v) => {
    if(!v) return "";
    v = v.replace(/\D/g, "");
    if (v.length > 14) v = v.substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
    return v;
  };

  // Descarta o retrato antigo e grava o cadastro de agora no lugar.
  const refazerRetrato = async () => {
    if (refazendo || !colaborador) return;
    if (!confirm("Refazer o retrato do contrato deste mês com os dados atuais do cadastro?")) return;
    setRefazendo(true);
    const { error } = await refazerEspelho(colaborador, mesParam);
    setRefazendo(false);
    if (error) { alert(error); return; }
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-20 print:bg-white print:pb-0">
      
      {/* Barra de Ações (Oculta na impressão) */}
      <div className="bg-white border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden max-w-[210mm] mx-3 sm:mx-auto mt-4 sm:mt-6 rounded-t-xl">
         <button onClick={() => abrirMenu()} className="flex items-center gap-2 text-slate-600 font-bold hover:text-slate-800">
            <ArrowLeft size={20}/> Voltar
         </button>
         <div className="flex items-center gap-3">
            {/* Congelar um mês antigo usa o cadastro de hoje. Se o contrato já
                tinha mudado antes de alguém abrir a folha, o retrato nasce
                errado — e sem isto não haveria como corrigir. */}
            {fechamento && (
               <button onClick={refazerRetrato} disabled={refazendo}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline underline-offset-2 disabled:opacity-40">
                  {refazendo ? "Atualizando..." : "Refazer retrato do contrato"}
               </button>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
               <Printer size={18}/> Imprimir PDF
            </button>
         </div>
      </div>

      {/* Folha A4 */}
      <div className="folha-espelho max-w-[210mm] mx-3 sm:mx-auto bg-white py-0 px-3 sm:px-[10mm] shadow-md print:shadow-none print:p-0 print:m-0 min-h-[297mm] print:min-h-0 overflow-x-auto print:overflow-visible">
         <style dangerouslySetInnerHTML={{__html: `
           @media print {
             @page { size: A4 portrait; margin: 5mm; }
             body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

             /* A folha ocupa o papel inteiro: A4 (297mm) menos as margens.
                Em coluna, so a tabela cresce - cabecalho e assinaturas ficam do
                tamanho do conteudo. As 31 linhas se distribuem no espaco que
                sobra, entao o mes cabe numa pagina so E sem faixa branca no
                rodape. Altura fixa por linha nao servia: ou sobrava papel, ou
                estourava para a segunda folha. */
             .folha-espelho {
               display: flex;
               flex-direction: column;
               height: 287mm;
               page-break-inside: avoid;
             }
             .tabela-ponto { flex: 1 1 auto; page-break-inside: avoid; }
             .tabela-ponto th, .tabela-ponto td {
               font-size: 8.5px !important;
               padding: 0 2px !important;
               height: auto !important;
             }
             .bloco-identificacao { font-size: 10.5px !important; }

             /* Banco de horas e adicionais sao analise interna do ERP, nao
                fazem parte do registro de jornada. Ficam na tela e fora do
                papel - senao empurrariam a folha para uma segunda pagina. */
             .fora-da-folha { display: none !important; }
           }

           /* Tela: linha curta para caber o mes sem rolagem vertical longa. */
           .tabela-ponto th, .tabela-ponto td {
             font-size: 9px !important;
             line-height: 1 !important;
             padding: 1px !important;
             height: 12px !important;
           }

           /* Tinta cheia. A folha e assinada, fotocopiada e arquivada, e o
              cinza claro do tema some na copia - o dado do trabalhador tem que
              sair legivel na terceira via. */
           .folha-espelho { color: #000; }
           .folha-espelho th, .folha-espelho td { color: #000; font-weight: 700; }

           /* O bloco de identificacao e datilografado. A fonte de largura fixa
              e o que faz os rotulos pontilhados alinharem os dois pontos numa
              coluna so, como no papel. */
           .bloco-identificacao {
             font-family: "Courier New", Courier, monospace;
             color: #000;
             font-weight: 700;
           }
         `}} />
         
         {/* Cabeçalho no formato da folha oficial da casa: título, dados do
             trabalhador à esquerda e o quadro de totais à direita. */}
         <div className="border border-slate-800 mb-1">
            <h1 className="text-[15px] font-black text-center uppercase tracking-[0.25em] py-0.5">
               Registro de Jornada Diária
            </h1>
            <div className="flex items-start justify-between border-t border-slate-800 px-1 py-0.5">
               <p className="text-[11px] font-black uppercase">{colaborador.unidade?.nome || "Empresa"}</p>
               <p className="text-[10px] font-bold">CNPJ: {mascaraCNPJ(colaborador.unidade?.cnpj) || "—"}</p>
            </div>
            <div className="flex items-stretch border-t border-slate-800">
               <div className="bloco-identificacao flex-1 px-1 py-1 text-[10.5px] leading-[1.5]">
                  <p>{rotulo("Lotação")} {colaborador.setor || "Administrativo"}</p>
                  <p>{rotulo("Trabalhador")} {(colaborador.nome || "").toUpperCase()}</p>
                  <p>{rotulo("Admissão")} {dataBR(colaborador.data_admissao)}
                     <span className="ml-8">Cargo: {(colaborador.cargo || "—").toUpperCase()}</span></p>
                  <p>{rotulo("Período")} {periodoBR}</p>
                  <div className="flex">
                     <span className="shrink-0 whitespace-pre">{rotulo("Horário")} </span>
                     <div className="grid flex-1 grid-cols-2 gap-x-3">
                        {linhasHorario.map(l => <span key={l} className="text-[9.5px] leading-[1.5]">{l}</span>)}
                     </div>
                  </div>
               </div>
               {/* Totais do mês. O que depende de conferência da contabilidade
                   fica em branco, como na folha de papel. */}
               <table data-print-table className="tabela-totais border-l border-slate-800 text-[8px] shrink-0" style={{ width: "38mm" }}>
                  <thead>
                     <tr>
                        <th className="border-b border-slate-800 px-1 font-black">TOTAIS</th>
                        <th className="border-b border-l border-slate-800 px-1 w-8">%</th>
                        <th className="border-b border-l border-slate-800 px-1 w-8">%</th>
                     </tr>
                  </thead>
                  <tbody>
                     {["H. E. Diurna", "H. E. Noturna", "Adic.Noturno", "Faltas"].map((rot, i) => (
                        <tr key={rot}>
                           <td className={`px-1 whitespace-nowrap ${i < 3 ? "border-b border-slate-800" : ""}`}>{rot}</td>
                           <td className={`border-l border-slate-800 ${i < 3 ? "border-b border-slate-800" : ""}`}></td>
                           <td className={`border-l border-slate-800 ${i < 3 ? "border-b border-slate-800" : ""}`}></td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Tabela de Pontos */}
          <table data-print-table className="tabela-ponto w-full min-w-[680px] print:min-w-0 border-collapse border border-slate-800 text-center">
            <thead>
               {/* Duas linhas de cabeçalho, como na folha: INTERVALO e HORAS
                   EXTRAS são grupos com subcolunas. */}
               <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-800 !py-0 !px-1 w-14">DIAS</th>
                  <th rowSpan={2} className="border border-slate-800 !py-0 !px-1 w-16">ENTRADA</th>
                  <th colSpan={2} className="border border-slate-800 !py-0 !px-1">INTERVALO</th>
                  <th rowSpan={2} className="border border-slate-800 !py-0 !px-1 w-16">SAÍDA</th>
                  <th colSpan={3} className="border border-slate-800 !py-0 !px-1">HORAS EXTRAS</th>
                  <th rowSpan={2} className="border border-slate-800 !py-0 !px-1">ASSINATURA<br/>DO TRABALHADOR</th>
               </tr>
               <tr className="bg-slate-100">
                  <th className="border border-slate-800 !py-0 !px-1 w-16">INÍCIO</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-16">FIM</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-12">ENTRADA</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-12">SAÍDA</th>
                  <th className="border border-slate-800 !py-0 !px-1 w-12">TOTAIS</th>
               </tr>
            </thead>
            <tbody>
               {arrayDias.map(dia => {
                  const dataString = `${mesParam}-${dia.toString().padStart(2,'0')}`;
                  const reg = pontos.find(p => p.data_referencia === dataString);
                  
                  // Verifica se é folga
                  const dataObj = new Date(dataString + "T12:00:00Z");
                  const diaSemana = dataObj.getUTCDay().toString();
                  const isFolgaFixa = colaborador?.dias_trabalho ? !colaborador.dias_trabalho.split(',').includes(diaSemana) : false;
                  const esporadica = folgasEsporadicas.find(f => String(f.data_folga).slice(0, 10) === dataString);
                  const isFolgaEsporadica = !!esporadica;
                  const isFolga = isFolgaFixa || isFolgaEsporadica;
                  const feriado = feriadosMes.find(f => String(f.data).slice(0, 10) === dataString);

                  // Tres folgas diferentes, e a casa trata cada uma de um jeito:
                  // a semanal esta no contrato, a de domingo e a escala que roda
                  // entre a equipe e a programada e combinada caso a caso. Escrever
                  // "FOLGA" em todas apagava a diferenca justamente para quem
                  // confere a folha. Feriado aparece junto, porque muda o calculo.
                  const partesFolga = [];
                  if (isFolgaFixa) partesFolga.push("FOLGA SEMANAL");
                  else if (isFolgaEsporadica) partesFolga.push(diaSemana === "0" ? "FOLGA DE DOMINGO" : "FOLGA PROGRAMADA");
                  if (feriado) partesFolga.push(`FERIADO${feriado.nome ? " - " + String(feriado.nome).toUpperCase() : ""}`);
                  const textoFolga = partesFolga.join("   ·   ");

                  if ((isFolga || feriado) && !reg) {
                      return (
                         <tr key={dia}>
                            <td className="border border-slate-800 !py-0 !px-1 font-bold bg-slate-50 text-slate-500 text-left">{rotuloDia(dia)}</td>
                            <td colSpan={7} className="border border-slate-800 !py-0 !px-1 font-black tracking-[0.18em] bg-slate-50">{textoFolga}</td>
                            <td className="border border-slate-800 !py-0 !px-1 font-black tracking-[0.12em] bg-slate-50 text-[8px]">{partesFolga[0]} — NÃO ASSINAR</td>
                         </tr>
                      );
                  }
                  
                  // Calculando horas do dia
                  let horasDia = 0;
                  if (reg && reg.hora_entrada && reg.hora_saida_intervalo) {
                     horasDia += calcularHorasDecimais(reg.hora_entrada, reg.hora_saida_intervalo);
                  }
                  if (reg && reg.hora_retorno_intervalo && reg.hora_saida) {
                     horasDia += calcularHorasDecimais(reg.hora_retorno_intervalo, reg.hora_saida);
                  }
                  totalHorasMes += horasDia;

                  const horaStr = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR').slice(0,5) : "";

                  return (
                     <tr key={dia}>
                        <td className="border border-slate-800 !py-0 !px-1 font-bold text-left">{rotuloDia(dia)}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_entrada)}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_saida_intervalo)}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_retorno_intervalo)}</td>
                        <td className="border border-slate-800 !py-0 !px-1">{horaStr(reg?.hora_saida)}</td>
                        {/* Hora extra é conferência da contabilidade: a folha
                            de papel também sai em branco para preenchimento. */}
                        <td className="border border-slate-800 !py-0 !px-1"></td>
                        <td className="border border-slate-800 !py-0 !px-1"></td>
                        <td className="border border-slate-800 !py-0 !px-1"></td>
                        <td className="border border-slate-800 !py-0 !px-1"></td>
                     </tr>
                  );
               })}
            </tbody>
            <tfoot>
               <tr className="bg-slate-100">
                  <td colSpan={5} className="border border-slate-800 !py-1 !px-2 text-right font-black uppercase text-[10px]">Total de Horas no Mês:</td>
                  <td colSpan={4} className="border border-slate-800 !py-1 !px-2 text-left font-black text-[11px]">{fmtHoras(totalHorasMes)} hrs</td>
               </tr>
            </tfoot>
         </table>

         {/* Rodape de assinatura: tres campos iguais - mesma largura, mesma
             linha, mesmo rotulo embaixo. A data ficava mais baixa e mais
             estreita que as assinaturas, e a folha parecia montada em dois
             momentos. Quem assina espera os tres campos no mesmo nivel. */}
         <div className="mt-14 grid grid-cols-3 items-end gap-8 px-1 text-[9px] print:mt-[18mm]">
            {[
               { chave: "data", rotulo: "Data", comBarras: true },
               { chave: "trabalhador", rotulo: colaborador.nome },
               { chave: "responsavel", rotulo: "Responsável Lotação" },
            ].map(campo => (
               <div key={campo.chave} className="text-center">
                  {/* As barras fazem parte da linha, nao ficam em cima dela:
                      a linha preta e a mesma das outras duas colunas, so
                      dividida em dia / mes / ano. Sem as barras quem preenche
                      a mao nao sabe onde termina um campo e comeca o outro. */}
                  {campo.comBarras ? (
                     <div className="flex items-end">
                        <span className="flex-1 border-t border-slate-800" />
                        <span className="px-1 leading-[0.4] text-black">/</span>
                        <span className="flex-1 border-t border-slate-800" />
                        <span className="px-1 leading-[0.4] text-black">/</span>
                        <span className="flex-[1.6] border-t border-slate-800" />
                     </div>
                  ) : (
                     <div className="border-t border-slate-800" />
                  )}
                  <p className="pt-1 uppercase font-bold tracking-wide text-black">{campo.rotulo}</p>
               </div>
            ))}
         </div>

         {/* Banco de Horas do mês (intervalos não tirados) */}
         {bancoMes.length > 0 && (() => {
            const totalMin = bancoMes.filter(b => b.tipo !== "excesso").reduce((s, b) => s + (Number(b.minutos) || 0), 0);
            const fmtM = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
            return (
               <div className="fora-da-folha mt-2 print:mt-1">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-0.5">Banco de Horas — intervalos não tirados (limite 8h/mês)</p>
                  <table className="w-full border-collapse text-[9px]">
                     <thead>
                        <tr className="bg-slate-100">
                           <th className="border border-slate-800 !py-1 !px-2 text-left">Data</th>
                           <th className="border border-slate-800 !py-1 !px-2 text-left">Motivo</th>
                           <th className="border border-slate-800 !py-1 !px-2 text-right">Minutos</th>
                        </tr>
                     </thead>
                     <tbody>
                        {bancoMes.map(b => (
                           <tr key={b.id}>
                              <td className="border border-slate-800 !py-0.5 !px-2">{b.data ? b.data.split("-").reverse().join("/") : "—"}</td>
                              <td className="border border-slate-800 !py-0.5 !px-2">{b.tipo === "excesso" ? `OCORRÊNCIA: ${b.observacao || "passou do intervalo"}` : (b.observacao || "Intervalo não tirado")}</td>
                              <td className="border border-slate-800 !py-0.5 !px-2 text-right font-bold">{b.tipo === "excesso" ? `(+${b.minutos} min além)` : `${b.minutos} min`}</td>
                           </tr>
                        ))}
                     </tbody>
                     <tfoot>
                        <tr className="bg-slate-100">
                           <td colSpan={2} className="border border-slate-800 !py-1 !px-2 text-right font-black uppercase text-[10px]">Total acumulado no mês:</td>
                           <td className="border border-slate-800 !py-1 !px-2 text-right font-black text-[11px]">{fmtM(totalMin)}</td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
            );
         })()}

         {/* Hora extra e adicional noturno — dia a dia */}
         {(() => {
            // entradaDoDia: quem bate antes do turno não ganha hora extra por
            // ter chegado cedo. A batida real continua no espelho e no livro;
            // o corte é só na conta.
            const dias = calcularAdicionaisPorDia(pontos, feriadosMes, {
              contratadaDoDia: (d) => jornadaContratadaMin(colaborador, d),
              entradaDoDia: (d) => entradaContratadaDoDia(colaborador, d),
            });
            if (!dias.length) return null;
            const tot = dias.reduce((a, d) => ({ e: a.e + d.minExtra, n: a.n + d.minNoturno, f: a.f + d.minFeriado }), { e: 0, n: 0, f: 0 });
            const fmtM = (m) => m > 0 ? `${m} min` : "—";
            return (
               <div className="fora-da-folha mt-2 print:mt-1">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-0.5">Hora extra e adicionais — dia a dia</p>
                  <table className="w-full border-collapse text-[9px]">
                     <thead>
                        <tr className="bg-slate-100">
                           <th className="border border-slate-800 !py-1 !px-2 text-left">Dia</th>
                           <th className="border border-slate-800 !py-1 !px-2 text-right">Hora extra (+50%)</th>
                           <th className="border border-slate-800 !py-1 !px-2 text-right">Ad. noturno (+20%)</th>
                           <th className="border border-slate-800 !py-1 !px-2 text-right">Feriado (+100%)</th>
                        </tr>
                     </thead>
                     <tbody>
                        {dias.map(d => (
                           <tr key={d.data}>
                              <td className="border border-slate-800 !py-0.5 !px-2">{d.data ? d.data.split("-").reverse().join("/") : "—"}</td>
                              {/* Passou de 2h no dia: os minutos continuam
                                  devidos, mas o art. 59 da CLT limita o
                                  acréscimo a duas horas — e é esse também o
                                  teto do acordo de banco de horas da casa.
                                  Quem monta a escala precisa ver o dia. */}
                              <td className={`border border-slate-800 !py-0.5 !px-2 text-right font-bold ${d.extraAcimaDoLimite > 0 ? "text-red-700" : ""}`}>
                                 {fmtM(d.minExtra)}
                                 {d.extraAcimaDoLimite > 0 && <span className="ml-1 font-black">· {d.extraAcimaDoLimite} min acima do limite</span>}
                              </td>
                              <td className="border border-slate-800 !py-0.5 !px-2 text-right font-bold">{fmtM(d.minNoturno)}</td>
                              <td className="border border-slate-800 !py-0.5 !px-2 text-right font-bold">{fmtM(d.minFeriado)}</td>
                           </tr>
                        ))}
                     </tbody>
                     <tfoot>
                        <tr className="bg-slate-100">
                           <td className="border border-slate-800 !py-1 !px-2 text-right font-black uppercase text-[10px]">Totais:</td>
                           <td className="border border-slate-800 !py-1 !px-2 text-right font-black">{fmtM(tot.e)}</td>
                           <td className="border border-slate-800 !py-1 !px-2 text-right font-black">{fmtM(tot.n)}</td>
                           <td className="border border-slate-800 !py-1 !px-2 text-right font-black">{fmtM(tot.f)}</td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
            );
         })()}

         <div className="mt-2 text-[8px] text-slate-600 leading-snug">
            <b>Descanso Semanal Remunerado (DSR):</b> incluso na remuneração mensal (Lei 605/49). Adicional noturno de 20% das 22h00 às 05h00, com hora noturna reduzida de 52min30s (CLT art. 73). Hora extra além da jornada contratada com acréscimo de 50%; tolerância de 5 min por marcação, limitada a 10 min diários (CLT art. 58, §1º). Feriado trabalhado com adicional de 100%.
         </div>

         
         <div className="mt-2 text-[8px] text-center text-slate-500">
            Documento gerado pelo sistema REP-A. Reconhecimento de marcação de ponto nos termos da Portaria MTP nº 671/2021.
            {fechamento?.fechado_em && ` Mês encerrado em ${new Date(fechamento.fechado_em).toLocaleDateString("pt-BR")} — jornada contratada congelada nesta data.`}
         </div>

      </div>

    </div>
  );
}
