"use client";

// Histórico das conversas com o Jhon e o Nico (dono, 17/11/2026: "todas as
// conversas ficam salvas, nenhuma é apagada, tudo eu consigo ver como um
// histórico"). Só leitura, da auditoria da inteligência: o banco não deixa
// apagar nem alterar (IC-01). Quem tem a auditoria (dono) vê as conversas de
// todos; cada um vê as próprias (RLS).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Mic, Search, ShieldCheck, User } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase, isSupabaseReady } from "../../../lib/supabase";
import { FundoMedway, RotuloSecao, TopoComVoltar } from "../../../components/ui/Medway";
import { ETAPAS_DA_CONVERSA, filtrar, itemDoEvento, porDia, rotuloDoDia } from "../../../lib/intelligence/historico-conversas.mjs";

const PAGINA = 200;
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function Pilula({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${ativo ? "bg-mw-marinho text-white" : "border border-mw-borda bg-mw-card text-mw-marinho"}`}>
      {children}
    </button>
  );
}

function Conversa({ i }) {
  const nomeBot = i.assistente === "nico" ? "Nico" : i.assistente === "jhon" ? "Jhon" : "Assistente";
  if (i.marco) {
    return <p className="text-center text-[12.5px] text-mw-sec">{hora(i.em)} · {i.pessoa} · {i.marco}</p>;
  }
  return (
    <div className="space-y-1.5">
      {i.pergunta && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-[18px] rounded-tr-[6px] bg-mw-agua-claro px-4 py-2.5">
            <p className="flex items-center gap-1 text-[12px] font-semibold text-mw-agua">{i.canal === "voz" ? <Mic size={12} /> : <User size={12} />} {i.pessoa}</p>
            <p className="whitespace-pre-line text-[15px] text-mw-texto">{i.pergunta}</p>
          </div>
        </div>
      )}
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-[18px] rounded-tl-[6px] border border-mw-borda bg-mw-card px-4 py-2.5">
          <p className="flex items-center gap-1 text-[12px] font-semibold text-mw-azul"><Bot size={12} /> {nomeBot} · {hora(i.em)}</p>
          <p className="whitespace-pre-line text-[15px] text-mw-texto">{i.resposta || "Resposta não guardada (conversa anterior a 17/11/2026)."}</p>
        </div>
      </div>
    </div>
  );
}

export default function HistoricoConversas() {
  const { unidadeAtiva } = useERP();
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [assistente, setAssistente] = useState("todos");
  const [pessoa, setPessoa] = useState("todas");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async (antesDe = null) => {
    if (!isSupabaseReady() || !unidadeAtiva || unidadeAtiva === "todas") { setItens([]); return; }
    setCarregando(true);
    let q = supabase.from("intelligence_eventos")
      .select("id, created_at, etapa, auth_user_id, canal, comando, recomendacao, resultado, intencao, acao_tipo, erro")
      .eq("unidade_id", unidadeAtiva).in("etapa", ETAPAS_DA_CONVERSA)
      .order("created_at", { ascending: false }).limit(PAGINA);
    if (antesDe) q = q.lt("created_at", antesDe);
    const { data, error } = await q;
    if (error) { setErro("Não consegui ler o histórico agora."); setCarregando(false); return; }
    const ids = [...new Set((data || []).map((e) => e.auth_user_id).filter(Boolean))];
    const nomes = new Map();
    if (ids.length) {
      const { data: us } = await supabase.from("usuarios_erp").select("auth_user_id, nome").in("auth_user_id", ids);
      for (const u of us || []) nomes.set(u.auth_user_id, u.nome);
    }
    const novos = (data || []).map((e) => itemDoEvento(e, nomes));
    setItens((atual) => (antesDe ? [...(atual || []), ...novos] : novos));
    setFim((data || []).length < PAGINA);
    setErro("");
    setCarregando(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const pessoas = useMemo(() => [...new Set((itens || []).map((i) => i.pessoa))].sort(), [itens]);
  const dias = useMemo(() => porDia(filtrar(itens || [], { assistente, pessoa, busca })), [itens, assistente, pessoa, busca]);
  const maisAntigo = itens?.length ? itens[itens.length - 1].em : null;

  return (
    <FundoMedway>
      <TopoComVoltar titulo="Histórico das conversas" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 sm:px-6">
        <p className="flex items-start gap-2 rounded-2xl border border-mw-borda bg-mw-card px-4 py-3 text-[13.5px] text-mw-sec">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-mw-agua" />
          Todas as conversas com o Jhon e o Nico ficam guardadas. O banco não deixa apagar nem alterar nenhuma.
        </p>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Pilula ativo={assistente === "todos"} onClick={() => setAssistente("todos")}>Todas</Pilula>
          <Pilula ativo={assistente === "jhon"} onClick={() => setAssistente("jhon")}>Jhon</Pilula>
          <Pilula ativo={assistente === "nico"} onClick={() => setAssistente("nico")}>Nico</Pilula>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mw-sec" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar nas conversas" aria-label="Procurar nas conversas"
              className="min-h-[46px] w-full rounded-2xl border border-mw-borda bg-mw-card pl-9 pr-3 text-[15px] text-mw-texto outline-none focus:border-mw-azul" />
          </label>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label="Pessoa"
            className="min-h-[46px] w-full rounded-2xl border border-mw-borda bg-mw-card px-3 text-[15px] text-mw-texto">
            <option value="todas">Todas as pessoas</option>
            {pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {erro && <p className="rounded-2xl border border-hf-danger/30 bg-hf-danger/5 px-4 py-3 text-sm text-hf-danger">{erro}</p>}
        {itens === null && <p className="flex items-center gap-2 text-sm text-mw-sec"><Loader2 size={16} className="animate-spin" /> Carregando…</p>}
        {itens && !dias.length && <p className="rounded-2xl border border-dashed border-mw-borda px-4 py-6 text-center text-sm text-mw-sec">{itens.length ? "Nada com esse filtro." : "Ainda não há conversas guardadas nesta unidade."}</p>}

        {dias.map((d) => (
          <section key={d.dia} className="space-y-3">
            <RotuloSecao>{rotuloDoDia(d.dia, new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }))}</RotuloSecao>
            {d.itens.map((i) => <Conversa key={i.id} i={i} />)}
          </section>
        ))}

        {itens?.length > 0 && !fim && (
          <button type="button" onClick={() => carregar(maisAntigo)} disabled={carregando}
            className="min-h-[48px] w-full rounded-2xl border border-mw-borda bg-mw-card text-sm font-semibold text-mw-marinho disabled:opacity-50">
            {carregando ? "Carregando…" : "Ver conversas mais antigas"}
          </button>
        )}
      </div>
    </FundoMedway>
  );
}
