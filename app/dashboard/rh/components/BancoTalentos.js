import { useState, useEffect } from "react";
import { fetchCandidatos, atualizarStatusCandidato, removerCandidato, fetchPortalVagasConfig, salvarPortalVagasConfig, PERGUNTAS_RECRUTAMENTO } from "../../../lib/recrutamento";
import { supabase } from "../../../lib/supabase";
import { Loader2, Search, ExternalLink, FileText, Trash2, ShieldAlert, X, Phone, MapPin, Briefcase, Pencil, Plus, Save, UserRound, GraduationCap, Baby, Car, MessageSquareText, CalendarDays, RefreshCw, Copy, Check, Sparkles } from "lucide-react";
import { imprimirHtml } from "../../../lib/imprimir";

const valorOuTraco = valor => valor === null || valor === undefined || valor === "" ? "Não informado" : String(valor);

function respostasDoCandidato(candidato) {
  const respostas = candidato?.respostas_comportamentais;
  if (!respostas) return {};
  if (typeof respostas === "object") return respostas;
  try {
    return JSON.parse(respostas);
  } catch {
    return {};
  }
}

function detalhesDoCandidato(candidato) {
  const respostas = respostasDoCandidato(candidato);
  const salvos = respostas._dados_pessoais && typeof respostas._dados_pessoais === "object"
    ? respostas._dados_pessoais
    : {};
  const detalhes = {
    ...salvos,
    cpf: salvos.cpf || candidato?.cpf,
    telefone: salvos.telefone || candidato?.telefone,
    enderecoCompleto: salvos.enderecoCompleto || candidato?.endereco,
    cargoPretendido: salvos.cargoPretendido || candidato?.cargo_pretendido,
    temFilhos: salvos.temFilhos || candidato?.tem_filhos,
    experiencia: salvos.experiencia || candidato?.experiencia,
  };

  if (!respostas._dados_pessoais && typeof candidato?.experiencia === "string" && candidato.experiencia.includes("|")) {
    const legado = {};
    candidato.experiencia.split("|").forEach(parte => {
      const [chave, ...resto] = parte.split(":");
      legado[chave.trim().toLowerCase()] = resto.join(":").trim();
    });
    detalhes.genero = detalhes.genero || legado["gênero"] || legado.genero;
    detalhes.escolaridade = detalhes.escolaridade || legado.escolaridade;
    const automovel = legado.carro;
    detalhes.temAutomovel = detalhes.temAutomovel || (automovel && automovel !== "Não" ? "Sim" : "Não");
    detalhes.qualAutomovel = detalhes.qualAutomovel || (automovel !== "Não" ? automovel : "");
    detalhes.qtdFilhos = detalhes.qtdFilhos || legado.filhos;
    detalhes.temFilhos = detalhes.temFilhos || (legado.filhos && legado.filhos !== "0" ? "Sim" : "Não");
    detalhes.experiencia = legado.exp || candidato.experiencia;
  }

  return detalhes;
}

function respostaFormatada(candidato, pergunta) {
  const resposta = respostasDoCandidato(candidato)[pergunta.id];
  const indice = Number(resposta);
  if (Number.isInteger(indice) && pergunta.opcoes[indice]) return pergunta.opcoes[indice];
  if (typeof resposta === "string" && resposta.trim()) {
    return pergunta.opcoes.find(opcao => opcao.texto === resposta) || { texto: resposta, tag: "" };
  }
  return null;
}

function dataHora(valor) {
  if (!valor) return "Data não informada";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

function dataNascimento(valor) {
  if (!valor) return "Não informado";
  const partes = String(valor).slice(0, 10).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(valor);
}

export default function BancoTalentos({ unidadeAtiva }) {
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [candidatoAberto, setCandidatoAberto] = useState(null);
  const [editorPortal, setEditorPortal] = useState(null);
  const [salvandoPortal, setSalvandoPortal] = useState(false);
  const [gerandoRequisitos, setGerandoRequisitos] = useState(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const carregar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setCandidatos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await fetchCandidatos(unidadeAtiva);
    setCandidatos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const canal = supabase
      .channel(`candidatos-portal-${unidadeAtiva}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "candidatos",
        filter: `unidade_id=eq.${unidadeAtiva}`,
      }, carregar)
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [unidadeAtiva]);

  // Decidir um candidato de uma vez. Marcar vários continua existindo abaixo,
  // para quando a decisão é a mesma para a lista inteira.
  const decidir = async (id, novoStatus) => {
    setCandidatos(prev => prev.map(c => c.id === id ? { ...c, status: novoStatus } : c));
    const { error } = await atualizarStatusCandidato(id, novoStatus);
    // Sem isto a tela mentiria: mostraria aprovado com o banco dizendo o
    // contrário, e ninguém saberia até recarregar.
    if (error) { await carregar(); alert("Não deu para gravar a decisão. Tente de novo."); }
  };

  // Abre em 'A decidir': e a unica aba com trabalho a fazer.
  const [abaSituacao, setAbaSituacao] = useState("decidir");
  const [selecionados, setSelecionados] = useState({});
  const [movendo, setMovendo] = useState(false);
  const idsSelecionados = Object.keys(selecionados).filter(id => selecionados[id]);

  const alternarSelecao = (id) => setSelecionados(atual => {
    const proximo = { ...atual };
    if (proximo[id]) delete proximo[id]; else proximo[id] = true;
    return proximo;
  });

  const moverSelecionados = async (novoStatus) => {
    if (!idsSelecionados.length) return;
    setMovendo(true);
    const ids = [...idsSelecionados];
    // Otimista: a coluna reage na hora, e o que falhar volta abaixo.
    setCandidatos(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: novoStatus } : c));
    const falhas = [];
    for (const id of ids) {
      const { error } = await atualizarStatusCandidato(id, novoStatus);
      if (error) falhas.push(id);
    }
    setMovendo(false);
    if (falhas.length) {
      // Desfaz só o que não gravou, para a tela não mentir sobre o que moveu.
      await carregar();
      alert(`${falhas.length} candidato(s) não foram gravados. Tente de novo.`);
      setSelecionados(Object.fromEntries(falhas.map(id => [id, true])));
      return;
    }
    setSelecionados({});
  };

  // A tela responde uma pergunta só: aprovado ou não. O que era "Novo",
  // "Em Contato / Entrevista", "Banco de Talentos" e "Descartado" virou
  // A DECIDIR / APROVADO / REPROVADO.
  //
  // Os valores GRAVADOS continuam os mesmos de antes, de propósito: a tabela
  // de candidatos não foi criada por aqui, então não dá para saber se o campo
  // status aceita valores novos. Reaproveitando os que já existem, a mudança é
  // só de tela e nada pode falhar na hora de gravar.
  const APROVADO = "Banco de Talentos";
  const REPROVADO = "Reprovado";
  const A_DECIDIR = "Novo";

  // "Entrevista Marcada" é de antes desta simplificação: quem chegou lá já
  // tinha passado, então lê como aprovado em vez de sumir da tela.
  const situacaoDe = (c) =>
    c.status === REPROVADO ? "reprovado"
    : (c.status === APROVADO || c.status === "Entrevista Marcada") ? "aprovado"
    : "decidir";

  const ABAS = [
    { id: "decidir",   nome: "A decidir",  status: A_DECIDIR, ativo: "bg-slate-800 text-white" },
    { id: "aprovado",  nome: "Aprovados",  status: APROVADO,  ativo: "bg-emerald-600 text-white" },
    { id: "reprovado", nome: "Reprovados", status: REPROVADO, ativo: "bg-slate-500 text-white" },
  ];

  // Dentro de cada etapa, os candidatos vêm separados pela vaga que querem:
  // o gestor olha "Garçom" de uma vez, em vez de caçar nome por nome.
  const agruparPorVaga = (lista) => {
    const grupos = new Map();
    lista.forEach(c => {
      const vaga = String(c.cargo_pretendido || "").trim() || "Sem vaga definida";
      if (!grupos.has(vaga)) grupos.set(vaga, []);
      grupos.get(vaga).push(c);
    });
    return [...grupos.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"));
  };

  const getCorNota = (nota) => {
    if (nota >= 80) return "text-emerald-600 bg-emerald-100";
    if (nota >= 50) return "text-amber-600 bg-amber-100";
    return "text-rose-600 bg-rose-100";
  };

  const abrirChecagemAntecedentes = (cpf) => {
    if (!cpf) return alert("Este candidato não informou o CPF.");
    // Copiar para o clipboard
    const cpfLimpo = cpf.replace(/\D/g, "");
    navigator.clipboard.writeText(cpfLimpo);
    alert(`O CPF ${cpf} foi copiado para a sua área de transferência!\n\nVocê será redirecionado para o portal do Governo (Gov.br) para emitir a certidão. Basta colar o CPF lá.`);
    window.open("https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais", "_blank");
  };

  const abrirEditorPortal = async () => {
    const { data, error } = await fetchPortalVagasConfig(unidadeAtiva);
    if (error) return alert("Não foi possível carregar a configuração: " + error);
  };

  const salvarEditorPortal = async () => {
    if (!editorPortal?.titulo?.trim()) return alert("Informe o título do portal.");
    if (!editorPortal.vagas?.some(vaga => vaga.cargo?.trim())) return alert("Cadastre pelo menos uma vaga.");
    setSalvandoPortal(true);
    const { error, data } = await salvarPortalVagasConfig(unidadeAtiva, editorPortal);
    setSalvandoPortal(false);
    if (error) return alert("Não foi possível salvar: " + error);
    // Salvou: fecha o editor. O aviso era um alert que ficava por cima do
    // modal aberto, e a tela parecia travada em "Salvando...".
    setEditorPortal(null);
    carregar();
  };

  const atualizarVaga = (index, alteracoes) => {
    setEditorPortal(atual => ({
      ...atual,
      vagas: atual.vagas.map((item, i) => i === index ? { ...item, ...alteracoes } : item),
    }));
  };

  const gerarRequisitosIA = async (vaga, index) => {
    if (!vaga.cargo?.trim()) return alert("Informe o cargo antes de gerar os pré-requisitos.");
    setGerandoRequisitos(vaga.id);
    try {
      const resposta = await fetch("/api/ia-requisitos-vaga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargo: vaga.cargo,
          contexto: [vaga.horario_trabalho, vaga.dias_trabalho].filter(Boolean).join("; "),
        }),
      });
      const gerado = await resposta.json();
      if (!resposta.ok) throw new Error(gerado.error || "Não foi possível gerar os pré-requisitos.");
      atualizarVaga(index, {
        requisitos: gerado.requisitos || [],
        horario_trabalho: vaga.horario_trabalho || gerado.horario_trabalho || "",
        dias_trabalho: vaga.dias_trabalho || gerado.dias_trabalho || "",
        folga: vaga.folga || gerado.folga || "",
        domingo_folga: vaga.domingo_folga || gerado.domingo_folga || "1 domingo de folga por mês",
      });
    } catch (error) {
      alert(error.message);
    } finally {
      setGerandoRequisitos(null);
    }
  };

  const copiarLinkPortal = async () => {
    const link = `${window.location.origin}/vagas/${unidadeAtiva}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      window.prompt("Copie o link do Portal de Vagas:", link);
    }
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="p-10 text-center font-bold text-slate-500 bg-white rounded-3xl border border-slate-200">Selecione uma loja específica no menu lateral para ver os candidatos.</div>;
  }

  const filtrados = candidatos.filter(c =>
    String(c.nome || "").toLowerCase().includes(busca.toLowerCase())
    || String(c.cargo_pretendido || "").toLowerCase().includes(busca.toLowerCase())
  );
  const detalhesAbertos = candidatoAberto ? detalhesDoCandidato(candidatoAberto) : null;

  // Ficha de uma página: o navegador salva como PDF e daí a pessoa envia por
  // WhatsApp. O site não consegue anexar arquivo na conversa sozinho.
  const imprimirFichaCandidato = (c) => {
    const d = detalhesDoCandidato(c);
    const esc = (v) => String(v ?? "").replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
    const linha = (rot, val) => val ? `<tr><th>${esc(rot)}</th><td>${esc(val)}</td></tr>` : "";
    imprimirHtml(`<meta charset='utf-8'/><title>${esc(c.nome)}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:14mm}
        h1{font-size:24px}
        .cargo{margin-top:2px;font-size:13px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:1px}
        .nota{margin-top:10px;display:inline-block;border:2px solid #047857;border-radius:8px;padding:4px 10px;font-weight:bold;color:#047857}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}
        th,td{border:1px solid #cbd5e1;padding:6px 9px;text-align:left;vertical-align:top}
        th{width:38%;background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#475569}
        h2{margin-top:16px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#475569}
        p.txt{margin-top:6px;font-size:12px;white-space:pre-wrap}
        .rodape{margin-top:18px;font-size:10px;color:#64748b}
      </style>
      <h1>${esc(c.nome)}</h1>
      <p class='cargo'>${esc(d.cargoPretendido || c.cargo_pretendido || "Candidato")}</p>
      ${Number.isFinite(Number(c.nota_ia)) ? `<p class='nota'>${Number(c.nota_ia)} pontos na triagem</p>` : ""}
      <table>
        ${linha("Telefone / WhatsApp", d.telefone)}
        ${linha("CPF", d.cpf)}
        ${linha("Escolaridade", d.escolaridade)}
        ${linha("Tem filhos", d.temFilhos)}
        ${linha("Transporte próprio", d.temTransporte)}
        ${linha("Endereço", d.enderecoCompleto)}
      </table>
      ${d.experiencia ? `<h2>Experiência</h2><p class="txt">${esc(d.experiencia)}</p>` : ""}
      <p class='rodape'>Ficha gerada pelo ERP em ${new Date().toLocaleString("pt-BR")}. Para enviar por WhatsApp, salve como PDF na janela de impressão.</p>`,
      { aoFalhar: () => alert("Não consegui abrir a impressão neste aparelho.") });
  };

  return (
    <div className="animate-in fade-in">
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3 w-full max-w-md shadow-sm">
            <Search size={18} className="text-slate-500" />
            <input type="text" placeholder="Buscar por nome ou cargo..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-medium text-slate-700 text-sm" />
         </div>
         <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button type="button" onClick={carregar} disabled={loading} className="flex items-center justify-center gap-2 bg-white text-slate-600 px-4 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-colors border border-slate-200 disabled:opacity-60 whitespace-nowrap">
               <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
            <button type="button" onClick={abrirEditorPortal} className="flex items-center justify-center gap-2 bg-white text-slate-700 px-4 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-colors border border-slate-200 whitespace-nowrap">
               <Pencil size={18} /> Editar portal
            </button>
            <a href={`/vagas/${unidadeAtiva}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-3 rounded-2xl font-bold hover:bg-indigo-100 transition-colors border border-indigo-200 whitespace-nowrap">
               <ExternalLink size={18} /> Abrir portal
            </a>
            <button type="button" onClick={copiarLinkPortal} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-colors border whitespace-nowrap ${linkCopiado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"}`}>
               {linkCopiado ? <Check size={18} /> : <Copy size={18} />} {linkCopiado ? "Link copiado" : "Copiar link"}
            </button>
         </div>
      </div>

      {loading ? (
        <div className="p-20 text-center flex flex-col items-center text-slate-500">
           <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
           <p className="font-bold">Carregando banco de talentos...</p>
        </div>
      ) : (
        // Uma lista só, dividida por aba. Quatro colunas lado a lado não cabiam
        // no tablet e obrigavam a rolar de lado para achar alguém.
        <div className={idsSelecionados.length > 0 ? "pb-32" : "pb-10"}>
           <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-none">
              {ABAS.map(a => {
                 const n = filtrados.filter(c => situacaoDe(c) === a.id).length;
                 const ativa = abaSituacao === a.id;
                 return (
                   <button key={a.id} type="button" onClick={() => setAbaSituacao(a.id)}
                     className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${ativa ? a.ativo : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                     {a.nome}
                     <span className={`rounded-full px-2 py-0.5 text-[11px] ${ativa ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>{n}</span>
                   </button>
                 );
              })}
           </div>

           {(() => {
              const lista = filtrados.filter(c => situacaoDe(c) === abaSituacao);
              if (!lista.length) return (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                   <p className="text-sm font-bold text-slate-400">Nenhum candidato nesta situação.</p>
                </div>
              );
              return agruparPorVaga(lista).map(([vaga, daVaga]) => (
                <div key={vaga} className="mb-5">
                   <div className="mb-2 flex items-center gap-2 px-1">
                      <h4 className="text-[13px] font-black text-slate-700">{vaga}</h4>
                      <span className="text-[11px] font-black text-slate-400">{daVaga.length}</span>
                   </div>
                   <div className="space-y-2">
                      {daVaga.map(c => {
                         const sit = situacaoDe(c);
                         return (
                         <div key={c.id} onClick={() => setCandidatoAberto(c)}
                            className={`cursor-pointer rounded-2xl border bg-white p-3 shadow-sm transition-all hover:shadow-md sm:p-4 ${selecionados[c.id] ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"}`}>
                            <div className="flex flex-wrap items-center gap-3">
                               <div className="min-w-0 flex-1">
                                  <p className="text-sm font-black leading-snug text-slate-800">
                                     {c.nome}
                                     {c.cargo_pretendido && <span className="font-bold text-slate-400"> ({c.cargo_pretendido})</span>}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                     <span className={`rounded px-1.5 py-0.5 text-[10px] font-black ${getCorNota(c.nota_ia)}`}>{c.nota_ia} pts</span>
                                     {c.url_curriculo && <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"><FileText size={10}/> Tem CV</span>}
                                     {c.tem_filhos === "Sim" && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Tem filhos</span>}
                                  </div>
                               </div>

                               {/* Situação e decisão. Aqui o clique não abre a ficha. */}
                               <div className="flex shrink-0 items-center gap-2" onClick={e => e.stopPropagation()}>
                                  {sit === "aprovado" && <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">Aprovado</span>}
                                  {sit === "reprovado" && <span className="rounded-lg bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">Reprovado</span>}
                                  {sit !== "aprovado" && (
                                    <button type="button" onClick={() => decidir(c.id, APROVADO)}
                                       className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700">Aprovar</button>
                                  )}
                                  {sit !== "reprovado" && (
                                    <button type="button" onClick={() => decidir(c.id, REPROVADO)}
                                       className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">Reprovar</button>
                                  )}
                               </div>
                            </div>

                            {/* Aprovado: falar com a pessoa tem que ser um toque. */}
                            {sit === "aprovado" && c.telefone && (
                              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3" onClick={e => e.stopPropagation()}>
                                <a href={`https://wa.me/55${String(c.telefone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100">
                                  <Phone size={13} /> Chamar
                                </a>
                                <button type="button" title="Compartilhar contato"
                                  onClick={() => {
                                    const texto = `${c.nome} — ${c.cargo_pretendido || "candidato"} — ${c.telefone}`;
                                    if (navigator.share) navigator.share({ text: texto }).catch(() => {});
                                    else navigator.clipboard?.writeText(texto);
                                  }}
                                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-200">
                                  Compartilhar
                                </button>
                                <button type="button" title="Ficha em PDF para enviar" onClick={() => imprimirFichaCandidato(c)}
                                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-200">
                                  PDF
                                </button>
                              </div>
                            )}
                         </div>
                         );
                      })}
                   </div>
                </div>
              ));
           })()}
        </div>
      )}

      {/* Barra de ação: só existe quando há alguém marcado. Fica presa no rodapé
          porque no celular a coluna de destino pode estar telas abaixo. */}
      {idsSelecionados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-black text-slate-700">
              {idsSelecionados.length} marcado{idsSelecionados.length > 1 ? "s" : ""}
            </span>
            <button type="button" disabled={movendo} onClick={() => moverSelecionados(APROVADO)}
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50">
              Aprovar
            </button>
            <button type="button" disabled={movendo} onClick={() => moverSelecionados(REPROVADO)}
              className="rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Reprovar
            </button>
            <button type="button" disabled={movendo} onClick={() => moverSelecionados(A_DECIDIR)}
              className="rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 disabled:opacity-50">
              Voltar para a decidir
            </button>
            <button type="button" onClick={() => setSelecionados({})} disabled={movendo}
              className="ml-auto rounded-xl px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-800 disabled:opacity-50">
              {movendo ? "Movendo..." : "Limpar"}
            </button>
          </div>
        </div>
      )}

      {editorPortal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5">
          <div className="bg-white rounded-[28px] w-full max-w-4xl max-h-[94vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="font-black text-xl sm:text-2xl text-slate-800">Editar Portal de Vagas</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">As alterações aparecem no portal público desta unidade.</p>
              </div>
              <button type="button" onClick={() => setEditorPortal(null)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 grid place-items-center hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Título</span>
                  <input value={editorPortal.titulo} onChange={e => setEditorPortal({ ...editorPortal, titulo: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:border-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Mensagem depois da candidatura</span>
                  <input value={editorPortal.mensagem_sucesso} onChange={e => setEditorPortal({ ...editorPortal, mensagem_sucesso: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-medium outline-none focus:border-indigo-500" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Apresentação do portal</span>
                  <textarea rows={3} value={editorPortal.subtitulo} onChange={e => setEditorPortal({ ...editorPortal, subtitulo: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-medium outline-none focus:border-indigo-500 resize-y" />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-black text-lg text-slate-800">Vagas disponíveis</h3>
                    <p className="text-xs text-slate-500">Configure remuneração, escala, folgas e pré-requisitos de cada função.</p>
                  </div>
                  <button type="button" onClick={() => setEditorPortal({
                    ...editorPortal,
                    vagas: [...editorPortal.vagas, {
                      id: `vaga-${Date.now()}`, cargo: "", quantidade: 1, salario: "", alimentacao: "", taxa: "",
                      horario_trabalho: "", dias_trabalho: "", folga: "", domingo_folga: "1 domingo de folga por mês",
                      requisitos: [], ativa: true,
                    }],
                  })} className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-2 text-xs font-black">
                    <Plus size={15} /> Nova vaga
                  </button>
                </div>

                <div className="space-y-3">
                  {editorPortal.vagas.map((vaga, index) => (
                    <div key={vaga.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          ["cargo", "Cargo"],
                          ["salario", "Salário / faixa salarial"],
                          ["alimentacao", "Vale-alimentação"],
                          ["taxa", "Média da taxa de serviço"],
                          ["horario_trabalho", "Horário de trabalho"],
                          ["dias_trabalho", "Dias de trabalho / escala"],
                          ["folga", "Folga semanal"],
                          ["domingo_folga", "Domingo de folga"],
                        ].map(([campo, label]) => (
                          <label key={campo} className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                            <input value={vaga[campo] || ""} onChange={e => atualizarVaga(index, { [campo]: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-bold outline-none focus:border-indigo-500" />
                          </label>
                        ))}
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade</span>
                          <input type="number" min="1" value={vaga.quantidade} onChange={e => atualizarVaga(index, { quantidade: Number(e.target.value) || 1 })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-bold outline-none focus:border-indigo-500" />
                        </label>
                      </div>
                      <div className="mt-4 rounded-2xl border border-indigo-100 bg-white p-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pré-requisitos da função</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Um requisito por linha. Você pode editar tudo que a IA sugerir.</p>
                          </div>
                          <button type="button" disabled={gerandoRequisitos === vaga.id} onClick={() => gerarRequisitosIA(vaga, index)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                            {gerandoRequisitos === vaga.id ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            {gerandoRequisitos === vaga.id ? "Gerando..." : "Gerar com IA"}
                          </button>
                        </div>
                        <textarea
                          rows={5}
                          value={(Array.isArray(vaga.requisitos) ? vaga.requisitos : String(vaga.requisitos || "").split(/\r?\n/)).join("\n")}
                          onChange={e => atualizarVaga(index, { requisitos: e.target.value.split(/\r?\n/) })}
                          placeholder="Ex.: Experiência com atendimento ao cliente&#10;Boa comunicação e trabalho em equipe"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-relaxed outline-none focus:border-indigo-500 resize-y"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <input type="checkbox" checked={vaga.ativa} onChange={e => atualizarVaga(index, { ativa: e.target.checked })} />
                          Exibir no portal
                        </label>
                        <button type="button" onClick={() => setEditorPortal({ ...editorPortal, vagas: editorPortal.vagas.filter((_, i) => i !== index) })} className="flex items-center gap-1.5 text-xs font-black text-rose-600 hover:text-rose-700">
                          <Trash2 size={14} /> Excluir vaga
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-7 py-4 border-t border-slate-100 bg-white">
              <button type="button" onClick={() => setEditorPortal(null)} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-slate-600">Fechar</button>
              <button type="button" disabled={salvandoPortal} onClick={salvarEditorPortal} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {salvandoPortal ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Perfil Completo */}
      {candidatoAberto && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-4xl p-5 sm:p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] overflow-hidden">
               <div className="flex justify-between items-start mb-6 shrink-0 border-b border-slate-100 pb-4">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">{candidatoAberto.nome}</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">{candidatoAberto.cargo_pretendido}</p>
                     <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5"><CalendarDays size={13} /> Candidatura recebida em {dataHora(candidatoAberto.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={async () => {
                        if(confirm("Tem certeza que deseja apagar este candidato?")) {
                           await removerCandidato(candidatoAberto.id);
                           setCandidatos(prev => prev.filter(c => c.id !== candidatoAberto.id));
                           setCandidatoAberto(null);
                        }
                     }} className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-100"><Trash2 size={18}/></button>
                     <button onClick={() => setCandidatoAberto(null)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6 custom-scrollbar">
                  
                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3">Dados pessoais</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                           { label: "Telefone / WhatsApp", value: detalhesAbertos.telefone, icon: Phone },
                           { label: "CPF", value: detalhesAbertos.cpf, icon: UserRound },
                           { label: "Data de nascimento", value: dataNascimento(detalhesAbertos.nascimento), icon: CalendarDays },
                           { label: "Escolaridade", value: detalhesAbertos.escolaridade, icon: GraduationCap },
                           { label: "Tem filhos", value: detalhesAbertos.temFilhos, icon: Baby },
                           { label: "Transporte próprio", value: detalhesAbertos.temTransporte, icon: Car },
                        ].map(({ label, value, icon: Icon }) => (
                           <div key={label} className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 min-w-0">
                              <Icon size={19} className="text-slate-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                                 <p className="font-black text-sm text-slate-700 break-words">{valorOuTraco(value)}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </section>

                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3">Endereço informado</h3>
                     <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <MapPin size={20} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                           <p className="font-black text-slate-700 break-words">{valorOuTraco(detalhesAbertos.enderecoCompleto)}</p>
                           {(detalhesAbertos.cidade || detalhesAbertos.estado) && (
                              <p className="text-xs font-bold text-slate-500 mt-1">
                                 {[detalhesAbertos.rua, detalhesAbertos.numero, detalhesAbertos.bairro, detalhesAbertos.cidade, detalhesAbertos.estado].filter(Boolean).join(" • ")}
                              </p>
                           )}
                        </div>
                     </div>
                  </section>

                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3">Vaga e experiência profissional</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-start gap-3 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                           <Briefcase size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                           <div>
                              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Cargo pretendido</p>
                              <p className="font-black text-indigo-800">{valorOuTraco(detalhesAbertos.cargoPretendido)}</p>
                           </div>
                        </div>
                        <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Experiência declarada</p>
                           <p className="font-bold text-sm text-slate-700 whitespace-pre-wrap">{valorOuTraco(detalhesAbertos.experiencia)}</p>
                        </div>
                     </div>
                  </section>

                  <section>
                     <h3 className="font-black text-lg text-slate-800 mb-3 flex items-center gap-2"><MessageSquareText size={20} className="text-indigo-500" /> Respostas do teste de perfil</h3>
                     <div className="space-y-3">
                        {PERGUNTAS_RECRUTAMENTO.map((pergunta, index) => {
                           const resposta = respostaFormatada(candidatoAberto, pergunta);
                           return (
                              <div key={pergunta.id} className="rounded-2xl border border-slate-200 p-4 bg-white">
                                 <p className="text-xs font-black text-slate-500 mb-2">{index + 1}. {pergunta.pergunta}</p>
                                 {resposta ? (
                                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                                       <p className="font-bold text-sm text-emerald-900">{resposta.texto}</p>
                                       {resposta.tag && <span className="inline-flex mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-white border border-emerald-200 rounded-full px-2 py-1">{resposta.tag}</span>}
                                    </div>
                                 ) : (
                                    <p className="text-sm font-bold text-slate-400 bg-slate-50 rounded-xl p-3">Resposta não disponível neste cadastro antigo.</p>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  </section>

                  {/* Laudo IA */}
                  <div>
                     <h3 className="font-black text-lg text-slate-800 mb-3 flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded-lg ${getCorNota(candidatoAberto.nota_ia)}`}>Nota: {candidatoAberto.nota_ia}</span>
                        Parecer do Sistema
                     </h3>
                     <div className="bg-slate-800 text-slate-200 p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {candidatoAberto.avaliacao_ia}
                     </div>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                     <button onClick={() => abrirChecagemAntecedentes(candidatoAberto.cpf)} className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-4 py-4 rounded-xl font-black transition-colors">
                        <ShieldAlert size={18} />
                        Checar Antecedentes
                     </button>
                     {candidatoAberto.url_curriculo ? (
                        <a href={candidatoAberto.url_curriculo} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-4 py-4 rounded-xl font-black transition-colors">
                           <FileText size={18} />
                           Visualizar Currículo (PDF)
                        </a>
                     ) : (
                        <div className="flex items-center justify-center gap-2 bg-slate-50 text-slate-400 border border-slate-200 px-4 py-4 rounded-xl font-black cursor-not-allowed">
                           <FileText size={18} />
                           Sem Currículo Anexado
                        </div>
                     )}
                  </div>

               </div>
            </div>
         </div>
      )}

    </div>
  );
}
