"use client";

import { useERP } from "../../../../context/ERPContext";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { fetchPontosMes } from "../../../../lib/ponto";
import { fetchFolgasEsporadicas, fetchBancoHorasColaborador, fetchFeriados, calcularAdicionaisPorDia } from "../../../../lib/rh";
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

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-20 print:bg-white print:pb-0">
      
      {/* Barra de Ações (Oculta na impressão) */}
      <div className="bg-white border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden max-w-[210mm] mx-3 sm:mx-auto mt-4 sm:mt-6 rounded-t-xl">
         <button onClick={() => abrirMenu()} className="flex items-center gap-2 text-slate-600 font-bold hover:text-slate-800">
            <ArrowLeft size={20}/> Voltar
         </button>
         <button onClick={() => window.print()} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
            <Printer size={18}/> Imprimir PDF
         </button>
      </div>

      {/* Folha A4 */}
      <div className="folha-espelho max-w-[210mm] mx-3 sm:mx-auto bg-white py-0 px-3 sm:px-[10mm] shadow-md print:shadow-none print:p-0 print:m-0 min-h-[297mm] print:min-h-0 overflow-x-auto print:overflow-visible">
         <style dangerouslySetInnerHTML={{__html: `
           @media print {
             @page { size: A4 portrait; margin: 5mm; }
             body { -webkit-print-color-adjust: exact; }
             .folha-espelho { page-break-inside: avoid; }

             /* A folha da casa é UMA página, com os 31 dias. As linhas encolhem
                para caber; nada de quebrar o mês no meio. */
             .tabela-ponto th, .tabela-ponto td {
               font-size: 7.5px !important;
               height: 6.4mm !important;
               padding: 0 1px !important;
             }
             .tabela-ponto { page-break-inside: avoid; }

             /* Banco de horas e adicionais são análise interna do ERP, não
                fazem parte do registro de jornada. Ficam na tela e fora do
                papel — senão empurrariam a folha para uma segunda página. */
             .fora-da-folha { display: none !important; }
           }
           .tabela-ponto th, .tabela-ponto td {
             font-size: 9px !important;
             line-height: 1 !important;
             padding: 1px !important;
             height: 12px !important;
           }
           /* O bloco de identificação da folha é datilografado. A fonte de
              largura fixa é o que faz os rótulos pontilhados alinharem os dois
              pontos numa coluna só, como no papel. */
           .bloco-identificacao { font-family: "Courier New", Courier, monospace; }
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
               <div className="bloco-identificacao flex-1 px-1 py-0.5 text-[9px] leading-[1.4]">
                  <p>{rotulo("Lotação")} {colaborador.setor || "Administrativo"}</p>
                  <p>{rotulo("Trabalhador")} {(colaborador.nome || "").toUpperCase()}</p>
                  <p>{rotulo("Admissão")} {dataBR(colaborador.data_admissao)}
                     <span className="ml-8">Cargo: {(colaborador.cargo || "—").toUpperCase()}</span></p>
                  <p>{rotulo("Período")} {periodoBR}</p>
                  <div className="flex">
                     <span className="shrink-0 whitespace-pre">{rotulo("Horário")} </span>
                     <div className="grid flex-1 grid-cols-2 gap-x-3">
                        {linhasHorario.map(l => <span key={l} className="text-[7.5px] leading-[1.5]">{l}</span>)}
                     </div>
                  </div>
               </div>
               {/* Totais do mês. O que depende de conferência da contabilidade
                   fica em branco, como na folha de papel. */}
               <table className="border-l border-slate-800 text-[8px] shrink-0" style={{ width: "38mm" }}>
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
                           <td className={`px-1 ${i < 3 ? "border-b border-slate-800" : ""}`}>{rot}</td>
                           <td className={`border-l border-slate-800 ${i < 3 ? "border-b border-slate-800" : ""}`}></td>
                           <td className={`border-l border-slate-800 ${i < 3 ? "border-b border-slate-800" : ""}`}></td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Tabela de Pontos */}
          <table className="tabela-ponto w-full min-w-[680px] print:min-w-0 border-collapse border border-slate-800 text-center">
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
                  const isFolgaEsporadica = folgasEsporadicas.some(f => f.data_folga === dataString);
                  const isFolga = isFolgaFixa || isFolgaEsporadica;

                  if (isFolga && !reg) {
                      return (
                         <tr key={dia}>
                            <td className="border border-slate-800 !py-0 !px-1 font-bold bg-slate-50 text-slate-500 text-left">{rotuloDia(dia)}</td>
                            <td colSpan={7} className="border border-slate-800 !py-0 !px-1 font-black tracking-[0.4em] text-slate-400 bg-slate-50">FOLGA</td>
                            <td className="border border-slate-800 !py-0 !px-1"></td>
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

         {/* Rodapé de assinatura, igual ao da folha: data em branco à esquerda,
             nome do trabalhador ao centro e o responsável pela lotação. */}
         <div className="mt-4 flex items-end justify-between gap-6 px-1 text-[9px] print:mt-3">
            <div className="w-[38mm] text-center">
               <p>____/____/________</p>
            </div>
            <div className="flex-1 text-center">
               <p className="border-t border-slate-800 pt-0.5 uppercase">{colaborador.nome}</p>
            </div>
            <div className="w-[45mm] text-center">
               <p className="border-t border-slate-800 pt-0.5">Responsável Lotação</p>
            </div>
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
            const dias = calcularAdicionaisPorDia(pontos, feriadosMes);
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
                              <td className="border border-slate-800 !py-0.5 !px-2 text-right font-bold">{fmtM(d.minExtra)}</td>
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
            <b>Descanso Semanal Remunerado (DSR):</b> incluso na remuneração mensal (Lei 605/49). Adicional noturno de 20% entre 23h30 e 00h00; após 00h00, hora extra com acréscimo de 50%; feriado trabalhado com adicional de 100%.
         </div>

         {/* Assinaturas */}
         <div className="mt-6 print:mt-4 flex justify-between w-full px-12 text-[10px] font-bold uppercase text-center gap-10">
            <div className="w-[45%]">
               <div className="border-b border-slate-800 mb-1"></div>
               {colaborador.unidade?.nome ? `Responsável ${colaborador.unidade.nome}` : "Responsável pela Empresa"}
            </div>
            <div className="w-[45%]">
               <div className="border-b border-slate-800 mb-1"></div>
               {colaborador.nome}
            </div>
         </div>
         
         <div className="mt-2 text-[8px] text-center text-slate-500">
            Documento gerado pelo sistema REP-A. Reconhecimento de marcação de ponto nos termos da Portaria MTP nº 671/2021.
         </div>

      </div>

    </div>
  );
}
