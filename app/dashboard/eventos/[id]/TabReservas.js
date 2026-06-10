"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Edit3, Users, Check, Clock, CreditCard } from "lucide-react";
import { Card, SectionLabel, Btn, Field, TextInput, NumberInput, Select, Modal, fmtBRL } from "../../../components/ui";
import { Reservas, TIME_SLOTS, PAYMENT_METHODS, custoDrink } from "../../../lib/eventos";

const VAZIO = {
  nome: "", mesa: "", horario: "19:00", sinal: 0,
  payment_method: "credit", menu_choices: [], drink_choices: [], extra_drinks: [],
  observacao: "",
};

function FormReserva({ inicial, evento, reservas, pratos, drinks, ingredientes, preparos, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial
      ? { ...inicial, sinal: String(inicial.sinal || 0), mesa: inicial.mesa || "", menu_choices: inicial.menu_choices || [], drink_choices: inicial.drink_choices || [], extra_drinks: inicial.extra_drinks || [] }
      : { ...VAZIO, sinal: String(Number(evento.preco_unit) || 0) },
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  // Mesas ocupadas
  const ocupadas = new Set();
  reservas.forEach((r) => { if (r.mesa && r.id !== inicial?.id) ocupadas.add(Number(r.mesa)); });
  const disponiveis = Array.from({ length: Number(evento.capacidade) || 0 }, (_, i) => i + 1).filter((n) => !ocupadas.has(n));

  // Helpers de escolha
  const inMenu = (id) => f.menu_choices.includes(id);
  const inDrinks = (id) => f.drink_choices.includes(id);
  function toggleMenu(id) {
    set("menu_choices", inMenu(id) ? f.menu_choices.filter((x) => x !== id) : [...f.menu_choices, id]);
  }
  function toggleDrink(id) {
    set("drink_choices", inDrinks(id) ? f.drink_choices.filter((x) => x !== id) : [...f.drink_choices, id]);
  }

  // Extras
  function setExtraQty(drinkId, qty) {
    const num = Number(qty) || 0;
    const existing = f.extra_drinks.find((e) => e.drinkId === drinkId);
    if (num <= 0) {
      set("extra_drinks", f.extra_drinks.filter((e) => e.drinkId !== drinkId));
    } else if (existing) {
      set("extra_drinks", f.extra_drinks.map((e) => e.drinkId === drinkId ? { ...e, qty: num } : e));
    } else {
      set("extra_drinks", [...f.extra_drinks, { drinkId, qty: num }]);
    }
  }
  const getExtraQty = (drinkId) => f.extra_drinks.find((e) => e.drinkId === drinkId)?.qty || 0;

  const totalExtras = f.extra_drinks.reduce((s, e) => {
    const d = drinks.find((dr) => dr.id === e.drinkId);
    return s + (d ? Number(d.preco_venda) * e.qty : 0);
  }, 0);
  const totalValor = Number(evento.preco_unit) + totalExtras;

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    const sinalNum = parseFloat(String(f.sinal).replace(",", ".")) || 0;
    const status = sinalNum >= Number(evento.preco_unit) ? "paid" : "pending";
    onSalvar({
      nome: f.nome.trim(),
      mesa: f.mesa ? Number(f.mesa) : null,
      horario: f.horario,
      sinal: sinalNum,
      status,
      payment_method: f.payment_method,
      menu_choices: f.menu_choices,
      drink_choices: f.drink_choices,
      extra_drinks: f.extra_drinks,
      observacao: f.observacao || null,
    });
  }

  const drinksExtras = drinks.filter((d) => d.is_extra);
  const drinksMenu   = drinks.filter((d) => !d.is_extra);

  return (
    <>
      <Field label="Nome do cliente">
        <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Lucas e Maria" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Mesa">
          <Select value={f.mesa || ""} onChange={(e) => set("mesa", e.target.value ? Number(e.target.value) : "")}>
            <option value="">{disponiveis.length === 0 ? "Todas ocupadas" : `Sel... (${disponiveis.length})`}</option>
            {inicial?.mesa && !disponiveis.includes(Number(inicial.mesa)) && <option value={inicial.mesa}>Mesa {inicial.mesa}</option>}
            {disponiveis.map((n) => <option key={n} value={n}>Mesa {n}</option>)}
          </Select>
        </Field>
        <Field label="Horário">
          <Select value={f.horario} onChange={(e) => set("horario", e.target.value)}>
            {TIME_SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Pagamento">
          <Select value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
            {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
      </div>

      <Field label={`Sinal pago (R$) — Total: ${fmtBRL(totalValor)}`}>
        <NumberInput value={f.sinal} onChange={(e) => set("sinal", e.target.value)} placeholder="0,00" step="0.01" />
      </Field>

      <SectionLabel>Escolha dos pratos ({f.menu_choices.length} selecionados)</SectionLabel>
      <div className="space-y-1" style={{ maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
        {pratos.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 8 }}>Cadastre pratos no Cardápio primeiro</p>
        ) : pratos.map((prato) => (
          <label key={prato.id} className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: inMenu(prato.id) ? "var(--elevated)" : "transparent" }}>
            <input type="checkbox" checked={inMenu(prato.id)} onChange={() => toggleMenu(prato.id)} />
            <div className="flex-1 text-[12px]">
              <strong style={{ color: "var(--fg)" }}>{prato.nome}</strong>
              <span style={{ color: "var(--dim)", marginLeft: 6, fontSize: 10 }}>{prato.categoria}</span>
            </div>
          </label>
        ))}
      </div>

      <SectionLabel>Escolha dos drinks do menu ({f.drink_choices.length} selecionados)</SectionLabel>
      <div className="space-y-1" style={{ maxHeight: 160, overflowY: "auto", marginBottom: 12 }}>
        {drinksMenu.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 8 }}>Cadastre drinks (não-extras) no menu</p>
        ) : drinksMenu.map((drink) => (
          <label key={drink.id} className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: inDrinks(drink.id) ? "var(--elevated)" : "transparent" }}>
            <input type="checkbox" checked={inDrinks(drink.id)} onChange={() => toggleDrink(drink.id)} />
            <div className="flex-1 text-[12px]">
              <strong style={{ color: "var(--fg)" }}>{drink.nome}</strong>
              <span style={{ color: "var(--dim)", marginLeft: 6, fontSize: 10 }}>{drink.has_alcohol ? "🍸" : "🌿"}</span>
            </div>
          </label>
        ))}
      </div>

      {drinksExtras.length > 0 && (
        <>
          <SectionLabel>Drinks extras (à parte)</SectionLabel>
          <div className="space-y-1" style={{ maxHeight: 160, overflowY: "auto", marginBottom: 12 }}>
            {drinksExtras.map((drink) => {
              const qty = getExtraQty(drink.id);
              return (
                <div key={drink.id} className="flex items-center gap-2 p-2 rounded" style={{ background: qty > 0 ? "var(--elevated)" : "transparent" }}>
                  <div className="flex-1 text-[12px]">
                    <strong style={{ color: "var(--fg)" }}>{drink.nome}</strong>
                    <span style={{ color: "var(--accent-fg)", marginLeft: 6, fontWeight: 700 }}>{fmtBRL(drink.preco_venda)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setExtraQty(drink.id, qty - 1)} style={{ background: "var(--surface)", padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", color: "var(--fg)" }}>−</button>
                    <span className="text-[12px]" style={{ color: "var(--fg)", minWidth: 20, textAlign: "center" }}>{qty}</span>
                    <button onClick={() => setExtraQty(drink.id, qty + 1)} style={{ background: "var(--surface)", padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", color: "var(--fg)" }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Field label="Observação">
        <textarea value={f.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--elevated)", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13, resize: "vertical" }}
          placeholder="aniversário, alergia a algo, etc" />
      </Field>

      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

// ─── Componente principal ────────────────────────────────────────────────
export default function TabReservas({ eventoId, evento, reservas, pratos, drinks, ingredientes, preparos, onChange }) {
  const [modal, setModal]   = useState(false);
  const [editar, setEditar] = useState(null);
  const [filterTurno, setFilterTurno] = useState("Todos");

  const filtradas = useMemo(() => filterTurno === "Todos"
    ? reservas
    : reservas.filter((r) => r.horario === filterTurno),
    [reservas, filterTurno]);

  const stats = useMemo(() => {
    const pagas = reservas.filter((r) => r.status === "paid").length;
    const totalSinal = reservas.reduce((s, r) => s + Number(r.sinal || 0), 0);
    const turno1 = reservas.filter((r) => r.horario === "19:00").length;
    const turno2 = reservas.filter((r) => r.horario === "21:30").length;
    return { pagas, totalSinal, turno1, turno2 };
  }, [reservas]);

  async function salvar(dados) {
    if (editar) await Reservas.update(editar.id, dados);
    else        await Reservas.add(eventoId, dados);
    setModal(false); setEditar(null); onChange();
  }
  async function remover(id) {
    if (!confirm("Remover esta reserva?")) return;
    await Reservas.remove(id); onChange();
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div><p className="text-[10px]" style={{ color: "var(--dim)" }}>CONFIRMADAS</p><strong style={{ fontSize: 20, color: "var(--accent-fg)" }}>{reservas.length}/{evento.capacidade}</strong></div>
          <div><p className="text-[10px]" style={{ color: "var(--dim)" }}>PAGAS</p><strong style={{ fontSize: 20, color: "#10B981" }}>{stats.pagas}</strong></div>
          <div><p className="text-[10px]" style={{ color: "var(--dim)" }}>SINAIS</p><strong style={{ fontSize: 16, color: "var(--fg)" }}>{fmtBRL(stats.totalSinal)}</strong></div>
          <div><p className="text-[10px]" style={{ color: "var(--dim)" }}>1º T / 2º T</p><strong style={{ fontSize: 16, color: "var(--fg)" }}>{stats.turno1} / {stats.turno2}</strong></div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}><Users size={16} style={{ display: "inline", marginRight: 6 }} />Reservas ({filtradas.length})</h3>
          <Btn variant="primary" onClick={() => { setEditar(null); setModal(true); }}><Plus size={14} /> Nova reserva</Btn>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          {["Todos", "19:00", "21:30"].map((opt) => (
            <button key={opt} onClick={() => setFilterTurno(opt)} style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: filterTurno === opt ? "var(--accent-fg)" : "var(--elevated)",
              color: filterTurno === opt ? "#000" : "var(--muted)",
              border: "none", cursor: "pointer",
            }}>
              {opt === "19:00" ? "1º turno" : opt === "21:30" ? "2º turno" : opt}
            </button>
          ))}
        </div>

        {filtradas.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 20 }}>Nenhuma reserva ainda.</p>
        ) : (
          <div className="space-y-2">
            {filtradas.map((r) => {
              const pratosEscolhidos = pratos.filter((p) => (r.menu_choices || []).includes(p.id));
              const drinksEscolhidos = drinks.filter((d) => (r.drink_choices || []).includes(d.id));
              const extrasTotal = (r.extra_drinks || []).reduce((s, ed) => {
                const d = drinks.find((dr) => dr.id === ed.drinkId);
                return s + (d ? Number(d.preco_venda) * ed.qty : 0);
              }, 0);
              const totalCobrar = Number(evento.preco_unit) + extrasTotal;
              const restante = Math.max(0, totalCobrar - Number(r.sinal || 0));
              return (
                <div key={r.id} className="p-3 rounded" style={{ background: "var(--elevated)", borderLeft: `3px solid ${r.status === "paid" ? "#10B981" : "#F59E0B"}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <strong style={{ color: "var(--fg)" }}>{r.nome}</strong>
                        {r.mesa && <span className="erp-badge text-[10px]" style={{ background: "var(--surface)", color: "var(--muted)" }}>Mesa {r.mesa}</span>}
                        <span className="erp-badge text-[10px]" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                          <Clock size={9} style={{ display: "inline", marginRight: 2 }} />{r.horario === "19:00" ? "1º turno" : "2º turno"}
                        </span>
                        {r.status === "paid"
                          ? <span className="erp-badge text-[10px]" style={{ background: "#10B98133", color: "#10B981" }}><Check size={9} style={{ display: "inline" }} /> Pago</span>
                          : <span className="erp-badge text-[10px]" style={{ background: "#F59E0B33", color: "#F59E0B" }}>Pendente</span>}
                        <span className="erp-badge text-[10px]" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                          <CreditCard size={9} style={{ display: "inline", marginRight: 2 }} />{PAYMENT_METHODS.find((p) => p.id === r.payment_method)?.label || "?"}
                        </span>
                      </div>
                      {pratosEscolhidos.length > 0 && (
                        <p className="text-[11px]" style={{ color: "var(--dim)" }}>🍽️ {pratosEscolhidos.map((p) => p.nome).join(" + ")}</p>
                      )}
                      {drinksEscolhidos.length > 0 && (
                        <p className="text-[11px]" style={{ color: "var(--dim)" }}>🍹 {drinksEscolhidos.map((d) => d.nome).join(" + ")}</p>
                      )}
                      {extrasTotal > 0 && (
                        <p className="text-[11px]" style={{ color: "#8B5CF6" }}>💰 Extras: {fmtBRL(extrasTotal)}</p>
                      )}
                      {r.observacao && <p className="text-[11px] mt-1" style={{ color: "var(--muted)", fontStyle: "italic" }}>"{r.observacao}"</p>}
                      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                        Sinal: <strong style={{ color: "#10B981" }}>{fmtBRL(r.sinal)}</strong>
                        · Total: <strong style={{ color: "var(--fg)" }}>{fmtBRL(totalCobrar)}</strong>
                        {restante > 0 && <> · A receber: <strong style={{ color: "#F59E0B" }}>{fmtBRL(restante)}</strong></>}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditar(r); setModal(true); }} style={{ background: "var(--surface)", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Edit3 size={12} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => remover(r.id)} style={{ background: "#EF444433", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Trash2 size={12} style={{ color: "#EF4444" }} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar reserva" : "Nova reserva"}>
        <FormReserva inicial={editar} evento={evento} reservas={reservas} pratos={pratos} drinks={drinks} ingredientes={ingredientes} preparos={preparos} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
