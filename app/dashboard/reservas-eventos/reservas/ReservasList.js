"use client";

// Reservas de mesa: próximas por dia, com busca, confirmar e cancelar.
// Antes "Filtros", a busca, o "Kanban" e o "…" de cada linha eram só
// desenho (não faziam nada) e a tabela quebrava o telefone em 4 linhas no
// celular. Regras da lista em reservas-lista.mjs.

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, CalendarDays, Users, Clock, Phone, X, Check, AlertTriangle } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { mascaraTelefone } from "../../../lib/mascaras.mjs";
import { rotuloStatusReserva, filtrarReservas, agruparPorDia, pessoasDasReservas, reservaCancelada, reservaConfirmada } from "../../../lib/reservas-lista.mjs";

const PERIODOS = [["proximas", "Próximas"], ["passadas", "Passadas"], ["todas", "Todas"]];
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const rotuloDia = (dIso, hoje) => {
  const txt = new Date(`${dIso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return dIso === hoje ? `Hoje · ${txt}` : txt.charAt(0).toUpperCase() + txt.slice(1);
};

export default function ReservasPage() {
  const { unidadeAtiva, sessao } = useERP();
  const [reservas, setReservas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [periodo, setPeriodo] = useState("proximas");
  const [busca, setBusca] = useState("");
  const [mudando, setMudando] = useState(null);

  async function carregarReservas() {
    if (!unidadeAtiva) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("unidade_id", unidadeAtiva)
      .order("data_reserva", { ascending: true })
      .order("horario", { ascending: true });
    setErro(error ? `Não foi possível carregar as reservas: ${error.message}` : "");
    if (!error && data) setReservas(data);
    setCarregando(false);
  }

  useEffect(() => {
    carregarReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva]);

  const hoje = hojeIso();
  const lista = useMemo(() => filtrarReservas(reservas, { periodo, termo: busca, hojeIso: hoje }), [reservas, periodo, busca, hoje]);
  const dias = useMemo(() => agruparPorDia(lista), [lista]);

  // Grava o status no mesmo vocabulário das ações do assistente
  // (reservas-domain-action.js): confirmed / cancelled.
  async function mudarStatus(r, status) {
    if (status === "cancelled" && !window.confirm(`Cancelar a reserva de ${r.cliente_nome || "cliente"}?`)) return;
    setMudando(r.id);
    const { error } = await supabase.from("reservas").update({ status, updated_at: new Date().toISOString() }).eq("id", r.id);
    setMudando(null);
    if (error) { setErro(`Não mudou a reserva: ${error.message}`); return; }
    setReservas((l) => l.map((x) => (x.id === r.id ? { ...x, status } : x)));
  }

  if (!unidadeAtiva) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setModalAberto(true)} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg hover:brightness-110">
          <Plus size={18} /> Nova reserva
        </button>
        <div role="tablist" aria-label="Período" className="ml-auto flex rounded-xl bg-hf-elevated p-1">
          {PERIODOS.map(([id, rotulo]) => (
            <button key={id} type="button" role="tab" aria-selected={periodo === id} onClick={() => setPeriodo(id)}
              className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${periodo === id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2 hover:text-hf-text"}`}>
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="relative sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" size={16} />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, telefone ou mesa"
          className="min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface pl-9 pr-3 text-sm text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15" />
      </div>

      {erro && (
        <div className="flex gap-2 rounded-xl border border-hf-warning/30 bg-hf-warning/5 px-3 py-2.5 text-sm text-hf-text">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-hf-warning" /> {erro}
        </div>
      )}

      {carregando ? (
        <div className="rounded-2xl border border-hf-border bg-hf-surface p-6 text-sm text-hf-muted">Carregando reservas…</div>
      ) : !lista.length ? (
        <div className="rounded-2xl border border-dashed border-hf-border-strong bg-hf-surface/60 p-6 text-center">
          <CalendarDays size={28} className="mx-auto text-hf-muted" />
          <p className="mt-2 font-bold text-hf-text">{busca ? "Nenhuma reserva com essa busca" : periodo === "proximas" ? "Nenhuma reserva marcada" : "Nenhuma reserva"}</p>
          {periodo === "proximas" && !busca && <p className="mt-1 text-sm text-hf-muted">Toque em “Nova reserva” para marcar uma mesa.</p>}
        </div>
      ) : (
        <>
          <p className="text-sm text-hf-text-2">{lista.length} reserva(s) · {pessoasDasReservas(lista).toLocaleString("pt-BR")} pessoa(s)</p>
          <div className="space-y-5">
            {dias.map(([data, doDia]) => (
              <section key={data}>
                <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${data === hoje ? "text-hf-accent" : "text-hf-text-2"}`}>{rotuloDia(data, hoje)}</h2>
                <ul className="grid gap-2 lg:grid-cols-2">
                  {doDia.map((r) => {
                    const cancelada = reservaCancelada(r);
                    const confirmada = reservaConfirmada(r);
                    const futura = String(r.data_reserva).slice(0, 10) >= hoje;
                    return (
                      <li key={r.id} className={`rounded-xl border border-hf-border bg-hf-surface p-3 ${cancelada ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-bold text-hf-text ${cancelada ? "line-through" : ""}`}>{r.cliente_nome || "Cliente"}</p>
                            {r.telefone && <a href={`tel:${String(r.telefone).replace(/\D/g, "")}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-hf-text-2 hover:text-hf-accent"><Phone size={12} /> {r.telefone}</a>}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${cancelada ? "bg-hf-danger/10 text-hf-danger" : confirmada ? "bg-hf-accent/10 text-hf-accent" : "bg-hf-warning/10 text-hf-warning"}`}>{rotuloStatusReserva(r.status)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-hf-text-2">
                          {r.horario && <span className="inline-flex items-center gap-1 rounded-md bg-hf-elevated px-1.5 py-0.5"><Clock size={12} /> {String(r.horario).slice(0, 5)}</span>}
                          <span className="inline-flex items-center gap-1 rounded-md bg-hf-elevated px-1.5 py-0.5"><Users size={12} /> {r.qtd_pessoas || "—"}</span>
                          {r.mesa && <span className="rounded-md bg-hf-elevated px-1.5 py-0.5">Mesa {r.mesa}</span>}
                          {r.ocasiao && <span className="rounded-md bg-hf-elevated px-1.5 py-0.5">{r.ocasiao}</span>}
                        </div>
                        {(r.observacoes || r.alergias) && <p className="mt-2 text-xs text-hf-text-2">{[r.alergias && `Alergias: ${r.alergias}`, r.observacoes].filter(Boolean).join(" · ")}</p>}
                        {futura && !cancelada && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {!confirmada && (
                              <button type="button" disabled={mudando === r.id} onClick={() => mudarStatus(r, "confirmed")}
                                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-hf-accent/30 px-3 text-xs font-bold text-hf-accent hover:bg-hf-accent/5 disabled:opacity-50"><Check size={14} /> Confirmar</button>
                            )}
                            <button type="button" disabled={mudando === r.id} onClick={() => mudarStatus(r, "cancelled")}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-hf-danger hover:bg-hf-danger/5 disabled:opacity-50"><X size={14} /> Cancelar</button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {modalAberto && (
        <NovaReservaModal
          onClose={() => setModalAberto(false)}
          unidadeAtiva={unidadeAtiva}
          sessao={sessao}
          onSuccess={() => {
            setModalAberto(false);
            carregarReservas();
          }}
        />
      )}
    </div>
  );
}

const campoCls = "min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15";

function Campo({ rotulo, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-hf-text-2">{rotulo}</span>
      {children}
    </label>
  );
}

function NovaReservaModal({ onClose, onSuccess, unidadeAtiva, sessao }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    cliente_nome: "",
    telefone: "",
    data_reserva: "",
    horario: "",
    qtd_pessoas: 2,
    ocasiao: "",
    mesa: "",
    observacoes: "",
    origem: "manual",
    status: "nova"
  });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.name === "telefone" ? mascaraTelefone(e.target.value) : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvando) return;
    setErro("");
    setSalvando(true);
    const { error } = await supabase.from("reservas").insert([{
      ...form,
      qtd_pessoas: Math.max(1, Math.round(Number(form.qtd_pessoas) || 1)),
      unidade_id: unidadeAtiva,
      responsavel_id: sessao?.id || null,
      responsavel_nome: sessao?.nome || "Equipe"
    }]);
    setSalvando(false);
    if (error) { setErro(`Não foi possível salvar a reserva: ${error.message}`); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="nova-reserva-titulo" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-hf-surface shadow-xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-hf-border px-5 py-4">
          <h2 id="nova-reserva-titulo" className="text-lg font-black text-hf-text">Nova reserva</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full text-hf-text-2 hover:bg-hf-elevated">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-5">
          <form id="reserva-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Campo rotulo="Cliente *"><input required type="text" name="cliente_nome" value={form.cliente_nome} onChange={handleChange} className={campoCls} placeholder="Nome completo" /></Campo>
              <Campo rotulo="Telefone (WhatsApp)"><input type="text" inputMode="tel" name="telefone" value={form.telefone} onChange={handleChange} className={campoCls} placeholder="(11) 90000-0000" /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Campo rotulo="Data *"><input required type="date" name="data_reserva" value={form.data_reserva} onChange={handleChange} className={campoCls} /></Campo>
              <Campo rotulo="Horário *"><input required type="time" name="horario" value={form.horario} onChange={handleChange} className={campoCls} /></Campo>
              <Campo rotulo="Pessoas"><input required type="number" inputMode="numeric" min="1" name="qtd_pessoas" value={form.qtd_pessoas} onChange={handleChange} className={campoCls} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Mesa (opcional)"><input type="text" name="mesa" value={form.mesa} onChange={handleChange} className={campoCls} placeholder="Ex.: T2" /></Campo>
              <Campo rotulo="Ocasião">
                <select name="ocasiao" value={form.ocasiao} onChange={handleChange} className={campoCls}>
                  <option value="">Comum</option>
                  <option value="Aniversário">Aniversário</option>
                  <option value="Encontro">Encontro romântico</option>
                  <option value="Negócios">Negócios</option>
                  <option value="Outro">Outro</option>
                </select>
              </Campo>
            </div>
            <Campo rotulo="Observações e restrições">
              <textarea name="observacoes" value={form.observacoes} onChange={handleChange} rows={3} className={`${campoCls} resize-none py-2`} placeholder="Alergias, crianças, pedido especial…" />
            </Campo>
            {erro && (
              <div className="flex gap-2 rounded-xl border border-hf-warning/30 bg-hf-warning/5 px-3 py-2.5 text-sm text-hf-text">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-hf-warning" /> {erro}
              </div>
            )}
          </form>
        </div>

        <footer className="flex justify-end gap-2 border-t border-hf-border px-5 py-4">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-hf-text-2 hover:bg-hf-elevated">Cancelar</button>
          <button type="submit" form="reserva-form" disabled={salvando} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-hf-accent px-5 text-sm font-bold text-hf-accent-fg hover:brightness-110 disabled:opacity-50">
            {salvando ? "Salvando…" : <><Check size={18} /> Confirmar reserva</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
