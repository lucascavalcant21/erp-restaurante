"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Calendar, Users, Building2, ChevronRight, LayoutGrid, List, X, Check, AlertTriangle } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { FASES_FUNIL, normalizarEtapa, rotuloEtapa, faseDaEtapa, etapaAoMoverPara } from "../../../lib/evento-financeiro.mjs";
import { fmtReais, fmtPct } from "../../../lib/valor-percentual.mjs";
import { indicadoresDoFunil } from "../../../lib/evento-orcamento.mjs";
import { mascaraTelefone } from "../../../lib/mascaras.mjs";

// As etapas do funil vêm de evento-financeiro.mjs (a mesma lista do seletor
// dentro do evento): antes eram duas listas e o evento sumia do funil.
//
// São 14 etapas, agrupadas em 5 fases (FASES_FUNIL): o quadro tem 5 colunas
// que cabem na tela e cada card mostra a etapa exata. Arrastar para outra
// fase põe o evento na primeira etapa dela. No celular a lista é o padrão.

const VISAO_KEY = "hefisto_funil_visao";
const ENCERRADAS = ["EVENTO", "FINALIZADO", "CANCELADO"];
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const dataTxt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data");

function visaoInicial() {
  try {
    const salva = localStorage.getItem(VISAO_KEY);
    if (salva === "lista" || salva === "kanban") return salva;
  } catch (_) {}
  return typeof window !== "undefined" && window.innerWidth >= 1024 ? "kanban" : "lista";
}

export default function EventosKanbanPage() {
  const { unidadeAtiva, sessao } = useERP();
  const router = useRouter();
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modoVisao, setModoVisao] = useState("lista");
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState(""); // "" = todos; "YYYY-MM" = mês da data do evento
  const [arrastando, setArrastando] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const [erroMover, setErroMover] = useState("");

  useEffect(() => { setModoVisao(visaoInicial()); }, []);
  const trocarVisao = (v) => {
    setModoVisao(v);
    try { localStorage.setItem(VISAO_KEY, v); } catch (_) {}
  };

  async function carregarEventos() {
    if (!unidadeAtiva) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from("eventos")
      .select("*")
      .eq("unidade_id", unidadeAtiva)
      .neq("tipo_evento", "especial") // Oculta os antigos temáticos legados
      .order("data_evento", { ascending: true });
    setErro(error ? `Não foi possível carregar os eventos: ${error.message}` : "");
    if (!error && data) setEventos(data);
    setCarregando(false);
  }

  useEffect(() => {
    carregarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva]);

  if (!unidadeAtiva) return null;

  // Busca por nome do evento, cliente, telefone ou data (dd/mm).
  const termo = busca.trim().toLowerCase();
  const doMes = !mes ? eventos : eventos.filter(e => String(e.data_evento || "").slice(0, 7) === mes);
  const ind = indicadoresDoFunil(eventos, mes);
  // Meses com evento, do mais recente ao mais antigo, para o filtro.
  const meses = [...new Set(eventos.map(e => String(e.data_evento || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const rotuloMes = (m) => { const [a, mm] = m.split("-"); const t = new Date(Number(a), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
  // Arrastar o card para outra coluna muda a etapa (otimista; desfaz se o banco recusar).
  const moverPara = async (eventoId, etapa) => {
    const antes = eventos.find(e => e.id === eventoId);
    if (!antes || normalizarEtapa(antes.funil_status) === etapa) return;
    setErroMover("");
    setEventos(l => l.map(e => e.id === eventoId ? { ...e, funil_status: etapa } : e));
    const { error } = await supabase.from("eventos").update({ funil_status: etapa }).eq("id", eventoId);
    if (error) { setEventos(l => l.map(e => e.id === eventoId ? antes : e)); setErroMover(`Não mudou a etapa: ${error.message}`); }
  };
  const visiveis = !termo ? doMes : doMes.filter(e => {
    const data = dataTxt(e.data_evento);
    return [e.nome, e.cliente_nome, e.cliente_telefone, data].some(v => String(v || "").toLowerCase().includes(termo));
  });
  const porFase = (faseId) => visiveis.filter(e => faseDaEtapa(e.funil_status).id === faseId)
    .sort((a, b) => FASES_FUNIL.find(f => f.id === faseId).etapas.indexOf(normalizarEtapa(a.funil_status)) - FASES_FUNIL.find(f => f.id === faseId).etapas.indexOf(normalizarEtapa(b.funil_status)) || String(a.data_evento || "").localeCompare(String(b.data_evento || "")));
  const hoje = hojeIso();
  const cartao = (evt, arrastavel) => (
    <CartaoEvento key={evt.id} evt={evt} hoje={hoje} arrastavel={arrastavel} esmaecido={arrastando === evt.id}
      onInicio={(e) => { e.dataTransfer.setData("text/plain", evt.id); e.dataTransfer.effectAllowed = "move"; setArrastando(evt.id); }}
      onFim={() => { setArrastando(null); setAlvo(null); }} />
  );
  const soltar = (faseId) => ({
    onDragOver: (e) => { if (arrastando) { e.preventDefault(); setAlvo(faseId); } },
    onDragLeave: () => setAlvo(a => (a === faseId ? null : a)),
    onDrop: (e) => {
      e.preventDefault(); const idEv = e.dataTransfer.getData("text/plain") || arrastando; setAlvo(null); setArrastando(null);
      const ev = eventos.find(x => x.id === idEv);
      if (ev) moverPara(idEv, etapaAoMoverPara(ev.funil_status, faseId));
    },
  });

  const kpis = [
    ["Eventos", String(ind.eventos)],
    ["Fechados", String(ind.fechados)],
    ["Valor fechado", fmtReais(ind.valor)],
    ["Lucro previsto", ind.lucro === null ? "—" : `${fmtReais(ind.lucro)}${ind.lucroParcial ? "*" : ""}`],
    ["Conversão", ind.conversao === null ? "—" : fmtPct(ind.conversao, 0)],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setModalAberto(true)} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg hover:brightness-110">
          <Plus size={18} /> Novo evento
        </button>
        <div role="tablist" aria-label="Forma de ver o funil" className="ml-auto flex rounded-xl bg-hf-elevated p-1">
          {[["lista", "Lista", List], ["kanban", "Quadro", LayoutGrid]].map(([id, rotulo, Icone]) => (
            <button key={id} type="button" role="tab" aria-selected={modoVisao === id} onClick={() => trocarVisao(id)}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${modoVisao === id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2 hover:text-hf-text"}`}>
              <Icone size={15} /> {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([r, v], i) => (
          <div key={r} className={`min-w-0 rounded-xl border border-hf-border bg-hf-surface px-3 py-2 ${i === kpis.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-hf-muted">{r}</p>
            <p className="truncate text-base font-black tabular-nums text-hf-text">{v}</p>
          </div>
        ))}
      </div>
      {ind.lucroParcial && <p className="-mt-2 text-xs text-hf-muted">* Só dos eventos já abertos no orçamento novo.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select value={mes} onChange={e => setMes(e.target.value)} aria-label="Mês do evento"
          className="min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-semibold text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15">
          <option value="">Todos os meses</option>
          {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" size={16} />
          <input type="search" placeholder="Buscar evento, cliente, telefone ou data" value={busca} onChange={e => setBusca(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface pl-9 pr-3 text-sm text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15" />
        </div>
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {erroMover && <Aviso>{erroMover}</Aviso>}

      {carregando ? (
        <div className="rounded-2xl border border-hf-border bg-hf-surface p-6 text-sm text-hf-muted">Carregando o funil…</div>
      ) : !eventos.length && !erro ? (
        <div className="rounded-2xl border border-dashed border-hf-border-strong bg-hf-surface/60 p-6 text-center">
          <p className="font-bold text-hf-text">Nenhum evento ainda</p>
          <p className="mt-1 text-sm text-hf-muted">Cadastre o primeiro contato: nome do cliente, data e quantas pessoas. O orçamento você monta depois, em etapas.</p>
          <button type="button" onClick={() => setModalAberto(true)} className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg"><Plus size={16} /> Novo evento</button>
        </div>
      ) : !visiveis.length ? (
        <div className="rounded-2xl border border-dashed border-hf-border-strong bg-hf-surface/60 p-6 text-sm text-hf-muted">Nenhum evento com esse filtro.</div>
      ) : modoVisao === "kanban" ? (
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3 xl:grid-cols-5">
          {FASES_FUNIL.map((fase) => {
            const cards = porFase(fase.id);
            const marcado = alvo === fase.id;
            return (
              <section key={fase.id} {...soltar(fase.id)} aria-label={fase.rotulo}
                className={`flex min-w-0 flex-col rounded-2xl border bg-hf-surface/70 transition-colors ${marcado ? "border-hf-accent ring-2 ring-hf-accent/20" : "border-hf-border"}`}>
                <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                  <h3 className="text-sm font-black text-hf-text">{fase.rotulo}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cards.length ? "bg-hf-accent text-hf-accent-fg" : "bg-hf-elevated text-hf-muted"}`}>{cards.length}</span>
                </header>
                <div className="max-h-[65vh] min-h-[120px] space-y-2 overflow-y-auto px-2 pb-2">
                  {cards.length ? cards.map((evt) => cartao(evt, true)) : (
                    <p className="grid min-h-[100px] place-items-center rounded-xl border border-dashed border-hf-border px-3 text-center text-xs font-semibold text-hf-muted">
                      {marcado ? "Solte aqui" : fase.etapas.map(rotuloEtapa).join(" · ")}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {FASES_FUNIL.map((fase) => {
            const cards = porFase(fase.id);
            if (!cards.length) return null;
            return (
              <section key={fase.id} aria-label={fase.rotulo}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-hf-text-2">
                  {fase.rotulo} <span className="rounded-full bg-hf-surface px-2 py-0.5 text-[11px] text-hf-muted">{cards.length}</span>
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {cards.map((evt) => cartao(evt, false))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <NovoEventoModal
          onClose={() => setModalAberto(false)}
          unidadeAtiva={unidadeAtiva}
          usuarioId={sessao?.id}
          onSuccess={(id) => {
            setModalAberto(false);
            if (id) router.push(`/dashboard/reservas-eventos/eventos/${id}`);
            else carregarEventos();
          }}
        />
      )}
    </div>
  );
}

function Aviso({ children }) {
  return (
    <div className="flex gap-2 rounded-xl border border-hf-warning/30 bg-hf-warning/5 px-3 py-2.5 text-sm text-hf-text">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-hf-warning" /><div className="min-w-0">{children}</div>
    </div>
  );
}

function CartaoEvento({ evt, hoje, arrastavel, esmaecido, onInicio, onFim }) {
  const etapa = normalizarEtapa(evt.funil_status);
  const dataIso = String(evt.data_evento || "").slice(0, 10);
  const passou = dataIso && dataIso < hoje && !ENCERRADAS.includes(etapa);
  const resumo = evt.operacao_detalhes?.resumo;
  const valor = Number(evt.valor_contratado) || 0;
  return (
    <Link href={`/dashboard/reservas-eventos/eventos/${evt.id}`} draggable={arrastavel}
      onDragStart={arrastavel ? onInicio : undefined} onDragEnd={arrastavel ? onFim : undefined}
      title={arrastavel ? "Arraste para outra etapa" : undefined}
      className={`group block rounded-xl border border-hf-border bg-hf-surface p-3 shadow-sm transition hover:border-hf-border-strong hover:shadow ${arrastavel ? "cursor-grab" : ""} ${esmaecido ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <strong className="text-sm font-bold leading-snug text-hf-text group-hover:text-hf-accent">{evt.nome || evt.cliente_nome || "Evento sem título"}</strong>
        <ChevronRight size={16} className="mt-0.5 shrink-0 text-hf-muted" />
      </div>
      {evt.cliente_nome && evt.nome && <p className="mt-0.5 truncate text-xs text-hf-text-2">{evt.cliente_nome}</p>}
      <span className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold ${etapa === "CANCELADO" ? "bg-hf-danger/10 text-hf-danger" : "bg-hf-accent/10 text-hf-accent"}`}>{rotuloEtapa(etapa)}</span>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-hf-text-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-hf-elevated px-1.5 py-0.5"><Calendar size={12} /> {dataTxt(evt.data_evento)}</span>
        {Number(evt.capacidade) > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-hf-elevated px-1.5 py-0.5"><Users size={12} /> {evt.capacidade}</span>}
        {valor > 0 && <span className="ml-auto whitespace-nowrap font-bold tabular-nums text-hf-accent">{fmtReais(valor)}</span>}
      </div>
      {typeof resumo?.lucro === "number" && valor > 0 && (
        <p className={`mt-1.5 text-xs font-semibold ${resumo.lucro < 0 ? "text-hf-danger" : "text-hf-text-2"}`}>
          Lucro limpo: {fmtReais(resumo.lucro)}{resumo.lucro_pct !== null && resumo.lucro_pct !== undefined ? ` · ${fmtPct(resumo.lucro_pct)}` : ""}
        </p>
      )}
      {passou && <p className="mt-1.5 text-xs font-semibold text-hf-warning">A data já passou: atualize a etapa.</p>}
    </Link>
  );
}

const campoCls = "min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15";

function NovoEventoModal({ onClose, onSuccess, unidadeAtiva, usuarioId }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    nome: "",
    cliente_nome: "",
    cliente_telefone: "",
    data_evento: "",
    capacidade: "",
    local_evento: "",
    tipo_evento: "buffet",
    funil_status: "NOVO CONTATO",
    status: "ativo"
  });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.name === "cliente_telefone" ? mascaraTelefone(e.target.value) : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvando) return;
    setErro("");
    setSalvando(true);

    const payload = {
      ...form,
      capacidade: Math.max(0, Math.round(Number(form.capacidade) || 0)),
      unidade_id: unidadeAtiva,
      responsavel_id: usuarioId || null
    };

    // 'nome' é not null no banco, então se o usuário não digitar um título,
    // usamos o nome do cliente ou geramos um genérico.
    if (!payload.nome) {
      payload.nome = payload.cliente_nome ? `Evento: ${payload.cliente_nome}` : 'Novo Evento Buffet';
    }

    const { data, error } = await supabase.from("eventos").insert([payload]).select("id").single();
    setSalvando(false);
    if (error) { setErro(`Não foi possível criar o evento: ${error.message}`); return; }
    onSuccess(data?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="novo-evento-titulo" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-hf-surface shadow-xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-hf-border px-5 py-4">
          <h2 id="novo-evento-titulo" className="flex items-center gap-2 text-lg font-black text-hf-text">
            <Building2 size={20} className="text-hf-accent" /> Novo evento
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full text-hf-text-2 hover:bg-hf-elevated">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-5">
          <form id="evento-form" onSubmit={handleSubmit} className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-hf-muted">Cliente</legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-hf-text-2">Nome do cliente ou empresa *</span>
                  <input required type="text" name="cliente_nome" value={form.cliente_nome} onChange={handleChange} className={campoCls} placeholder="Ex.: Ana Souza" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-hf-text-2">Telefone (WhatsApp)</span>
                  <input type="text" inputMode="tel" name="cliente_telefone" value={form.cliente_telefone} onChange={handleChange} className={campoCls} placeholder="(11) 90000-0000" />
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-hf-muted">Evento</legend>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-hf-text-2">Nome do evento (opcional)</span>
                <input type="text" name="nome" value={form.nome} onChange={handleChange} className={campoCls} placeholder="Ex.: Casamento Ana e João" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-hf-text-2">Data *</span>
                  <input required type="date" name="data_evento" value={form.data_evento} onChange={handleChange} className={campoCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-hf-text-2">Convidados</span>
                  <input type="number" inputMode="numeric" min="0" name="capacidade" value={form.capacidade} onChange={handleChange} className={campoCls} placeholder="Ex.: 80" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-hf-text-2">Local</span>
                <input type="text" name="local_evento" value={form.local_evento} onChange={handleChange} className={campoCls} placeholder="Ex.: Salão principal, chácara da família" />
              </label>
            </fieldset>
            {erro && <Aviso>{erro}</Aviso>}
          </form>
        </div>

        <footer className="flex justify-end gap-2 border-t border-hf-border px-5 py-4">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-hf-text-2 hover:bg-hf-elevated">
            Cancelar
          </button>
          <button type="submit" form="evento-form" disabled={salvando} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-hf-accent px-5 text-sm font-bold text-hf-accent-fg hover:brightness-110 disabled:opacity-50">
            {salvando ? "Criando…" : <><Check size={18} /> Criar e montar orçamento</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
