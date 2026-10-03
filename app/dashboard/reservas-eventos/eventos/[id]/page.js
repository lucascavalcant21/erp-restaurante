"use client";

// Evento: orçamento em etapas, na ordem em que o dono monta um evento:
// tipo → cardápio → equipe → aluguel e extras → cliente → custos e preço →
// DRE → orçamento para o cliente → pagamentos → compras.
// Contas em evento-orcamento.mjs. O orçamento grava sozinho (com uma pausa
// depois da última alteração) em eventos.operacao_detalhes.orcamento, e as
// colunas que o funil, a agenda e a tela inicial leem são atualizadas junto.

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Users, Check, Loader2, CloudOff, AlertTriangle, Copy, BookmarkPlus, X } from "lucide-react";
import ComprasTab from "./ComprasTab";
import { EtapaTipo, EtapaCardapio } from "./orcamento/EtapaCardapio";
import { EtapaEquipe, EtapaExtras, EtapaCliente } from "./orcamento/EtapasCadastro";
import { EtapaFinanceiro, EtapaDRE, EtapaProposta, EtapaPagamentos } from "./orcamento/EtapasFinanceiras";
import { supabase } from "../../../../lib/supabase";
import { useERP } from "../../../../context/ERPContext";
import { fetchFichas } from "../../../../lib/operacao";
import { fetchParams, PARAMS_PADRAO, fetchModelosEvento, adicionarModeloEvento, removerModeloEvento } from "../../../../lib/parametros";
import { FUNIL_ETAPAS, rotuloEtapa, normalizarEtapa } from "../../../../lib/evento-financeiro.mjs";
import {
  orcamentoDoEvento, resumoDoOrcamento, pendenciasDoOrcamento, listaDeComprasDoOrcamento, camposDoEventoParaGravar, CAMPOS_ESSENCIAIS, tipoDoEvento,
  historicoDoCliente, conflitosDeEquipe, sugestoesDeEquipe, modeloDoOrcamento, aplicarModelo, copiaDoOrcamento, resumoParaFunil,
} from "../../../../lib/evento-orcamento.mjs";
import { fmtReais, fmtPct } from "../../../../lib/valor-percentual.mjs";

const ETAPAS = [
  { id: "tipo", rotulo: "Tipo" },
  { id: "cardapio", rotulo: "Cardápio" },
  { id: "equipe", rotulo: "Equipe" },
  { id: "extras", rotulo: "Aluguel e extras" },
  { id: "cliente", rotulo: "Cliente" },
  { id: "financeiro", rotulo: "Custos e preço" },
  { id: "dre", rotulo: "DRE do evento" },
  { id: "proposta", rotulo: "Orçamento" },
  { id: "pagamentos", rotulo: "Pagamentos" },
  { id: "compras", rotulo: "Compras" },
];

// Grava descartando coluna que este banco não tenha (o schema não tem fonte
// canônica); sem as essenciais, não grava.
async function gravarEvento(id, campos) {
  const dados = { ...campos };
  for (let tentativa = 0; tentativa < 15; tentativa++) {
    const { error } = await supabase.from("eventos").update(dados).eq("id", id);
    if (!error) return { ok: true, dados };
    const m = /Could not find the '([a-z_]+)' column|column "?([a-z_]+)"? of relation "?eventos"? does not exist/i.exec(error.message || "");
    const col = m && (m[1] || m[2]);
    if (!col || !(col in dados) || CAMPOS_ESSENCIAIS.includes(col)) return { ok: false, erro: error.message };
    delete dados[col];
  }
  return { ok: false, erro: "Não foi possível gravar o evento." };
}

export default function EventoPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo, user } = useERP();
  const [outrosEventos, setOutrosEventos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [paramsSis, setParamsSis] = useState(PARAMS_PADRAO);
  const [painel, setPainel] = useState(null); // "modelo" | "duplicar"
  const [aviso, setAviso] = useState("");

  const [evento, setEvento] = useState(null);
  const [orc, setOrc] = useState(null);
  const [fichas, setFichas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [etapa, setEtapa] = useState("tipo");
  const [gravacao, setGravacao] = useState({ estado: "salvo", erro: "" });
  const [salvandoPag, setSalvandoPag] = useState(false);
  const carregado = useRef(false);
  const eventoRef = useRef(null);
  eventoRef.current = evento;

  useEffect(() => {
    if (!unidadeAtiva || !id) return;
    let ativo = true;
    carregado.current = false;
    (async () => {
      setCarregando(true);
      const [{ data, error }, resFichas, resParams, resOutros, resModelos] = await Promise.all([
        supabase.from("eventos").select("*").eq("id", id).single(),
        fetchFichas(unidadeAtiva),
        fetchParams(unidadeAtiva),
        // Outros eventos da loja: histórico do cliente, conflito de equipe e nomes já usados.
        supabase.from("eventos").select("id, nome, cliente_nome, cliente_telefone, data_evento, valor_contratado, capacidade, funil_status, operacao_detalhes").eq("unidade_id", unidadeAtiva).neq("id", id),
        fetchModelosEvento(unidadeAtiva),
      ]);
      if (!ativo) return;
      const params = { ...PARAMS_PADRAO, ...(resParams.data || {}) };
      let equipeLegada = [];
      if (!error && data && !data.operacao_detalhes?.orcamento) {
        // Evento de antes do orçamento em etapas: a equipe estava nesta tabela.
        const eq = await supabase.from("evento_equipe").select("*").eq("evento_id", id);
        equipeLegada = eq.error ? [] : eq.data || [];
      }
      if (!ativo) return;
      setFichas(resFichas.data || []);
      setOutrosEventos(resOutros.error ? [] : resOutros.data || []);
      setModelos(resModelos.data || []);
      setParamsSis(params);
      if (!error && data) {
        const o = orcamentoDoEvento(data, params, equipeLegada);
        setEvento(data);
        setOrc(o);
        setEtapa(o.cardapio.length ? "dre" : "tipo");
      }
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [unidadeAtiva, id]);

  const resumo = useMemo(() => (orc ? resumoDoOrcamento(orc, fichas) : null), [orc, fichas]);
  const compras = useMemo(() => (orc && etapa === "compras" ? listaDeComprasDoOrcamento(orc, fichas) : null), [orc, fichas, etapa]);
  const etapaFunil = normalizarEtapa(evento?.funil_status);
  const pagamentos = Array.isArray(evento?.historico_pagamentos) ? evento.historico_pagamentos : [];
  const recebido = pagamentos.reduce((t, p) => t + (Number(p.valor) || 0), 0);
  const pendencias = useMemo(() => (orc && resumo ? pendenciasDoOrcamento(orc, resumo, { hojeIso: new Date().toISOString().slice(0, 10), etapa: etapaFunil, recebido }) : []),
    [orc, resumo, etapaFunil, recebido]);

  // Gravação automática: 900 ms depois da última alteração.
  useEffect(() => {
    if (!orc || !evento) return;
    if (!carregado.current) { carregado.current = true; return; }
    setGravacao({ estado: "pendente", erro: "" });
    const t = setTimeout(async () => {
      setGravacao({ estado: "salvando", erro: "" });
      const atual = eventoRef.current;
      const campos = camposDoEventoParaGravar(orc, resumoDoOrcamento(orc, fichas), atual?.operacao_detalhes);
      const res = await gravarEvento(atual.id, campos);
      if (res.ok) {
        setEvento((e) => ({ ...e, ...res.dados }));
        setGravacao({ estado: "salvo", erro: "" });
      } else {
        setGravacao({ estado: "erro", erro: res.erro });
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orc]);

  // Avisa antes de sair com alteração ainda não gravada.
  useEffect(() => {
    if (gravacao.estado !== "pendente" && gravacao.estado !== "salvando") return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [gravacao.estado]);

  const historico = useMemo(() => (orc ? historicoDoCliente(outrosEventos, orc.cliente, id) : []), [outrosEventos, orc, id]);
  const conflitos = useMemo(() => (orc ? conflitosDeEquipe(orc, outrosEventos) : []), [outrosEventos, orc]);
  const sugestoesEquipe = useMemo(() => sugestoesDeEquipe(outrosEventos), [outrosEventos]);

  const salvarModelo = async (nome) => {
    const m = modeloDoOrcamento(orc, nome);
    const res = await adicionarModeloEvento(unidadeAtiva, m);
    if (res.error) { setAviso(`Não salvou o modelo: ${res.error}`); return; }
    setModelos(res.data);
    setPainel(null);
    setAviso(`Modelo “${m.nome}” salvo. Use em qualquer evento, na etapa Tipo.`);
  };
  const usarModelo = (m) => {
    if (orc.cardapio.length && !window.confirm(`Trocar o cardápio, a equipe, os extras e o preço deste evento pelos do modelo “${m.nome}”?`)) return;
    setOrc((o) => aplicarModelo(o, m, paramsSis));
    setAviso(`Modelo “${m.nome}” aplicado.`);
  };
  const apagarModelo = async (m) => {
    if (!window.confirm(`Apagar o modelo “${m.nome}”? Os eventos que já usaram não mudam.`)) return;
    const res = await removerModeloEvento(unidadeAtiva, m.id);
    if (res.error) setAviso(`Não apagou: ${res.error}`); else setModelos(res.data);
  };
  // Novo evento com tudo deste, menos data, pagamentos e realizado.
  const duplicar = async (dataNova) => {
    const copia = copiaDoOrcamento(orc);
    copia.cliente.data_evento = dataNova;
    const r = resumoDoOrcamento(copia, fichas);
    const { data, error } = await supabase.from("eventos").insert([{
      nome: copia.cliente.nome_evento, cliente_nome: copia.cliente.cliente_nome || null, cliente_telefone: copia.cliente.cliente_telefone || null,
      data_evento: dataNova, capacidade: Math.round(Number(r.convidados) || 0), local_evento: copia.cliente.local_evento || null,
      tipo_evento: "buffet", funil_status: "NOVO CONTATO", status: "ativo", unidade_id: unidadeAtiva, responsavel_id: user?.id || null,
      valor_contratado: r.receita, operacao_detalhes: { orcamento: copia, resumo: resumoParaFunil(r) },
    }]).select("id").single();
    if (error) { setAviso(`Não duplicou: ${error.message}`); return; }
    router.push(`/dashboard/reservas-eventos/eventos/${data.id}`);
  };

  const mudarFunil = async (novo) => {
    setEvento((e) => ({ ...e, funil_status: novo }));
    await supabase.from("eventos").update({ funil_status: novo }).eq("id", evento.id);
  };

  const salvarPagamentos = useCallback(async (lista) => {
    setSalvandoPag(true);
    const { error } = await supabase.from("eventos").update({ historico_pagamentos: lista }).eq("id", evento.id);
    setSalvandoPag(false);
    if (error) { setGravacao({ estado: "erro", erro: error.message }); return false; }
    setEvento((e) => ({ ...e, historico_pagamentos: lista }));
    return true;
  }, [evento?.id]);

  if (!unidadeAtiva) return <div className="p-8 text-center text-slate-900">Selecione uma loja.</div>;
  if (carregando) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>;
  if (!evento || !orc) return <div className="p-8 text-center font-bold text-slate-900">Evento não encontrado.</div>;

  const c = orc.cliente;
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  const feito = {
    tipo: true,
    cardapio: resumo.itens.length > 0,
    equipe: orc.equipe.length > 0,
    extras: orc.extras.length > 0,
    cliente: !!(c.cliente_nome && c.data_evento && resumo.convidados > 0),
    financeiro: resumo.precoPorPessoa > 0,
    dre: resumo.receita > 0,
    proposta: false,
    pagamentos: recebido > 0,
    compras: false,
  };
  const props = { orc, setOrc, resumo, fichas };

  return (
    <main className="min-h-screen bg-slate-50 pb-24 print:bg-white print:pb-0">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard/reservas-eventos/eventos" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900">
              <ArrowLeft size={16} /> Funil de eventos
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <EstadoGravacao g={gravacao} />
              <button type="button" onClick={() => setPainel(painel === "modelo" ? null : "modelo")} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100"><BookmarkPlus size={14} /> Salvar como modelo</button>
              <button type="button" onClick={() => setPainel(painel === "duplicar" ? null : "duplicar")} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100"><Copy size={14} /> Duplicar evento</button>
            </div>
          </div>
          {painel && <PainelAcao tipo={painel} onFechar={() => setPainel(null)} onModelo={salvarModelo} onDuplicar={duplicar} nomeSugerido={c.nome_evento || tipoDoEvento(orc.tipo).rotulo} />}
          {aviso && (
            <p className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
              {aviso}<button type="button" onClick={() => setAviso("")} aria-label="Fechar aviso"><X size={16} /></button>
            </p>
          )}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <select value={etapaFunil} onChange={(e) => mudarFunil(e.target.value)} aria-label="Etapa do funil"
                  className="h-8 cursor-pointer rounded-lg bg-slate-900 px-2.5 text-xs font-black uppercase tracking-widest text-white outline-none">
                  {FUNIL_ETAPAS.map((e) => <option key={e} value={e}>{rotuloEtapa(e).toUpperCase()}</option>)}
                </select>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-emerald-800">{tipoDoEvento(orc.tipo).rotulo}</span>
              </div>
              <h1 className="truncate text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">{c.nome_evento || c.cliente_nome || "Evento sem nome"}</h1>
              {c.cliente_nome && c.nome_evento && <p className="font-semibold text-slate-600">{c.cliente_nome}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Indicador rotulo="Data" valor={<><Calendar size={13} /> {c.data_evento ? new Date(`${c.data_evento}T12:00:00`).toLocaleDateString("pt-BR") : "A definir"}</>} />
              <Indicador rotulo="Pessoas" valor={<><Users size={13} /> {resumo.convidados || "—"}</>} />
              <Indicador rotulo="Por pessoa" valor={resumo.precoPorPessoa > 0 ? fmtReais(resumo.precoPorPessoa) : "—"} />
              <Indicador rotulo="Total" valor={resumo.receita > 0 ? fmtReais(resumo.receita) : "—"} destaque />
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-2 backdrop-blur sm:px-6 print:hidden" aria-label="Etapas do orçamento">
        <ol className="mx-auto flex max-w-7xl gap-1 overflow-x-auto py-2">
          {ETAPAS.map((e, i) => {
            const ativo = e.id === etapa;
            return (
              <li key={e.id} className="shrink-0">
                <button type="button" onClick={() => setEtapa(e.id)} aria-current={ativo ? "step" : undefined}
                  className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold ${ativo ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-black ${ativo ? "bg-white text-slate-900" : feito[e.id] ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                    {feito[e.id] && !ativo ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  {e.rotulo}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] print:block print:p-0">
        <div className="min-w-0">
          {etapa === "tipo" && <EtapaTipo {...props} modelos={modelos} onAplicarModelo={usarModelo} onRemoverModelo={apagarModelo} />}
          {etapa === "cardapio" && <EtapaCardapio {...props} />}
          {etapa === "equipe" && <EtapaEquipe {...props} sugestoesEquipe={sugestoesEquipe} conflitos={conflitos} />}
          {etapa === "extras" && <EtapaExtras {...props} />}
          {etapa === "cliente" && <EtapaCliente {...props} unidadeAtiva={unidadeAtiva} historico={historico} />}
          {etapa === "financeiro" && <EtapaFinanceiro {...props} />}
          {etapa === "dre" && <EtapaDRE {...props} recebido={recebido} />}
          {etapa === "proposta" && <EtapaProposta {...props} casa={unidadeInfo?.nome || ""} />}
          {etapa === "pagamentos" && <EtapaPagamentos pagamentos={pagamentos} salvarPagamentos={salvarPagamentos} resumo={resumo} salvando={salvandoPag} />}
          {etapa === "compras" && compras && <ComprasTab lista={compras} valor={resumo.receita} nItens={resumo.itens.length} />}

          <div className="mt-6 flex items-center justify-between gap-3 print:hidden">
            {idx > 0 ? (
              <button type="button" onClick={() => setEtapa(ETAPAS[idx - 1].id)} className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100">
                <ArrowLeft size={16} /> {ETAPAS[idx - 1].rotulo}
              </button>
            ) : <span />}
            {idx < ETAPAS.length - 1 && (
              <button type="button" onClick={() => setEtapa(ETAPAS[idx + 1].id)} className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700">
                {ETAPAS[idx + 1].rotulo} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-4 print:hidden lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Resumo do evento</h2>
            <Linha rotulo="Cardápio por pessoa" valor={fmtReais(resumo.cmvPorPessoa)} />
            <Linha rotulo="Custo por pessoa" valor={resumo.custoTotalPorPessoa !== null ? fmtReais(resumo.custoTotalPorPessoa) : resumo.custoOperacaoPorPessoa !== null ? fmtReais(resumo.custoOperacaoPorPessoa) : "—"} />
            <Linha rotulo="Valor por pessoa" valor={resumo.precoPorPessoa > 0 ? fmtReais(resumo.precoPorPessoa) : "—"} />
            {resumo.precoSugeridoPorPessoa && <Linha rotulo={`Sugerido (meta ${fmtPct(resumo.meta.pct, 0)})`} valor={fmtReais(resumo.precoSugeridoPorPessoa)} suave />}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lucro limpo</p>
              <p className={`text-2xl font-black tabular-nums ${resumo.prejuizo ? "text-red-600" : resumo.receita > 0 && resumo.meta.atingida ? "text-emerald-700" : "text-slate-900"}`}>
                {resumo.receita > 0 ? fmtReais(resumo.lucro) : "—"}
              </p>
              {resumo.receita > 0 && <p className="text-sm font-bold text-slate-600">{fmtPct(resumo.lucroPct)} do evento</p>}
            </div>
          </section>
          <section className={`rounded-3xl border p-5 ${pendencias.length ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}>
            <h2 className={`mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest ${pendencias.length ? "text-amber-800" : "text-emerald-700"}`}>
              {pendencias.length ? <AlertTriangle size={14} /> : <Check size={14} />} {pendencias.length ? "Falta" : "Tudo preenchido"}
            </h2>
            {pendencias.length > 0 && <ul className="space-y-1">{pendencias.map((p) => <li key={p} className="text-sm font-semibold text-amber-900">• {p}</li>)}</ul>}
          </section>
        </aside>
      </div>
    </main>
  );
}

// Formulário curto no topo: nome do modelo, ou data do evento duplicado.
function PainelAcao({ tipo, onFechar, onModelo, onDuplicar, nomeSugerido }) {
  const [valor, setValor] = useState(tipo === "modelo" ? nomeSugerido : "");
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    if (!valor) return;
    setEnviando(true);
    await (tipo === "modelo" ? onModelo(valor) : onDuplicar(valor));
    setEnviando(false);
  };
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <label className="min-w-[200px] flex-1">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">{tipo === "modelo" ? "Nome do modelo" : "Data do novo evento"}</span>
        <input autoFocus type={tipo === "modelo" ? "text" : "date"} value={valor} onChange={(e) => setValor(e.target.value)} required
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" />
      </label>
      <button type="submit" disabled={enviando || !valor} className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
        {enviando ? "Salvando…" : tipo === "modelo" ? "Salvar modelo" : "Criar cópia"}
      </button>
      <button type="button" onClick={onFechar} className="h-11 rounded-xl px-3 text-sm font-bold text-slate-600 hover:text-slate-900">Cancelar</button>
      <p className="basis-full text-xs font-medium text-slate-500">{tipo === "modelo" ? "Guarda tipo, cardápio, equipe, extras, taxas e preço — sem os dados do cliente." : "O novo evento copia tudo deste (cliente, cardápio, equipe, extras e preço), começa no início do funil e sem pagamentos."}</p>
    </form>
  );
}

function Indicador({ rotulo, valor, destaque = false }) {
  return (
    <div className={`min-w-[110px] rounded-2xl border px-3 py-2 ${destaque ? "border-emerald-100 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${destaque ? "text-emerald-700" : "text-slate-500"}`}>{rotulo}</p>
      <p className={`flex items-center gap-1 whitespace-nowrap text-sm font-black tabular-nums ${destaque ? "text-emerald-900" : "text-slate-900"}`}>{valor}</p>
    </div>
  );
}

function Linha({ rotulo, valor, suave = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={`text-sm ${suave ? "font-medium text-slate-500" : "font-semibold text-slate-700"}`}>{rotulo}</span>
      <span className={`whitespace-nowrap text-sm tabular-nums ${suave ? "font-bold text-slate-500" : "font-black text-slate-900"}`}>{valor}</span>
    </div>
  );
}

function EstadoGravacao({ g }) {
  if (g.estado === "erro") return <span className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700" title={g.erro}><CloudOff size={14} /> Não gravou: {g.erro}</span>;
  if (g.estado === "pendente" || g.estado === "salvando") return <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Loader2 size={14} className="animate-spin" /> Salvando…</span>;
  return <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Check size={14} /> Salvo</span>;
}
