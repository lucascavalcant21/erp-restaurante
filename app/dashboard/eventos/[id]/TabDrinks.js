"use client";

import { useState } from "react";
import { Plus, Trash2, Edit3, Beer, Search, Download } from "lucide-react";
import { Card, SectionLabel, Btn, Field, TextInput, NumberInput, Select, Modal, fmtBRL, fmtPct } from "../../../components/ui";
import { Ingredientes, Preparos, Drinks, custoIngrediente, custoPreparoUnit, custoItem, custoDrink } from "../../../lib/eventos";
import ModalImportar from "./ModalImportar";

const VAZIO_ING = { tipo: "bar", nome: "", custo_unit: "", peso_unit: 750, unidade: "ml" };
const VAZIO_PREP = { tipo: "bar", nome: "", rendimento: 1000, unidade: "ml", base_ingredients: [] };
const VAZIO_DRINK = { nome: "", has_alcohol: true, is_extra: false, preco_venda: 0, descricao: "", ingredients: [] };

// ─── Form Ingrediente (bar) ──────────────────────────────────────────────
function FormIngrediente({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial ? { ...inicial, custo_unit: String(inicial.custo_unit || ""), peso_unit: String(inicial.peso_unit || "") } : VAZIO_ING,
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    onSalvar({
      tipo: "bar",
      nome: f.nome.trim(),
      custo_unit: parseFloat(String(f.custo_unit).replace(",", ".")) || 0,
      peso_unit: parseFloat(String(f.peso_unit).replace(",", ".")) || 1,
      unidade: f.unidade,
    });
  }
  return (
    <>
      <Field label="Nome do ingrediente"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Gin Beefeater, Tônica" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Custo (R$)"><NumberInput value={f.custo_unit} onChange={(e) => set("custo_unit", e.target.value)} placeholder="120,00" step="0.01" /></Field>
        <Field label="Volume"><NumberInput value={f.peso_unit} onChange={(e) => set("peso_unit", e.target.value)} placeholder="750" step="1" /></Field>
        <Field label="Unidade">
          <Select value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>
            <option value="ml">ml</option><option value="g">g</option><option value="un">un</option>
          </Select>
        </Field>
      </div>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

// ─── Form Preparo (bar) ──────────────────────────────────────────────────
function FormPreparo({ inicial, ingredientes, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial ? { ...inicial, rendimento: String(inicial.rendimento || "") } : VAZIO_PREP,
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function toggleIng(ingId) {
    const exists = f.base_ingredients.find((i) => i.id === ingId);
    set("base_ingredients", exists
      ? f.base_ingredients.filter((i) => i.id !== ingId)
      : [...f.base_ingredients, { id: ingId, qty: 50 }]);
  }
  function setQty(ingId, qty) {
    set("base_ingredients", f.base_ingredients.map((i) => i.id === ingId ? { ...i, qty: Number(qty) || 0 } : i));
  }

  const custoTotal = f.base_ingredients.reduce((s, item) => {
    const ing = ingredientes.find((i) => i.id === item.id);
    return s + custoIngrediente(ing, item.qty);
  }, 0);
  const custoPorUnit = f.rendimento > 0 ? custoTotal / Number(f.rendimento) : 0;

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    if (!f.base_ingredients.length) return setErro("Adicione ao menos 1 ingrediente.");
    onSalvar({
      tipo: "bar",
      nome: f.nome.trim(),
      rendimento: parseFloat(String(f.rendimento).replace(",", ".")) || 1,
      unidade: f.unidade,
      base_ingredients: f.base_ingredients,
    });
  }
  return (
    <>
      <Field label="Nome do preparo"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Xarope de morango caseiro" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rendimento"><NumberInput value={f.rendimento} onChange={(e) => set("rendimento", e.target.value)} placeholder="1000" step="1" /></Field>
        <Field label="Unidade">
          <Select value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>
            <option value="ml">ml</option><option value="g">g</option>
          </Select>
        </Field>
      </div>

      <SectionLabel>Ingredientes do preparo ({f.base_ingredients.length})</SectionLabel>
      <div className="space-y-1" style={{ maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
        {ingredientes.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 12 }}>Cadastre ingredientes de bar primeiro</p>
        ) : ingredientes.map((ing) => {
          const sel = f.base_ingredients.find((i) => i.id === ing.id);
          return (
            <div key={ing.id} className="flex items-center gap-2 p-2 rounded" style={{ background: sel ? "var(--elevated)" : "transparent" }}>
              <input type="checkbox" checked={!!sel} onChange={() => toggleIng(ing.id)} />
              <div className="flex-1 text-[12px]">
                <strong style={{ color: "var(--fg)" }}>{ing.nome}</strong>
                <span style={{ color: "var(--dim)", marginLeft: 6 }}>{fmtBRL((ing.custo_unit / ing.peso_unit) * 1000)}/{ing.unidade === "g" ? "kg" : "L"}</span>
              </div>
              {sel && (
                <div className="flex items-center gap-1">
                  <NumberInput value={sel.qty} onChange={(e) => setQty(ing.id, e.target.value)} style={{ width: 70 }} step="1" />
                  <span className="text-[10px]" style={{ color: "var(--dim)" }}>{ing.unidade}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="erp-panel p-3 mb-3 flex justify-between">
        <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
          Custo total: {fmtBRL(custoTotal)} · Custo por {f.unidade}: {fmtBRL(custoPorUnit)}
        </span>
      </div>

      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

// ─── Form Drink ──────────────────────────────────────────────────────────
function FormDrink({ inicial, ingredientes, preparos, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial ? { ...inicial, preco_venda: String(inicial.preco_venda || ""), ingredients: inicial.ingredients || [] } : VAZIO_DRINK,
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function toggleItem(id, type) {
    const exists = f.ingredients.find((i) => i.id === id && i.type === type);
    set("ingredients", exists
      ? f.ingredients.filter((i) => !(i.id === id && i.type === type))
      : [...f.ingredients, { id, type, qty: 50 }]);
  }
  function setQty(id, type, qty) {
    set("ingredients", f.ingredients.map((i) => i.id === id && i.type === type ? { ...i, qty: Number(qty) || 0 } : i));
  }

  const custo = f.ingredients.reduce((s, item) => s + custoItem(item, ingredientes, preparos), 0);
  const precoV = parseFloat(String(f.preco_venda).replace(",", ".")) || 0;
  const margem = precoV > 0 ? ((precoV - custo) / precoV) * 100 : 0;

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    if (f.is_extra && precoV <= 0) return setErro("Drinks extras precisam ter preço de venda.");
    onSalvar({
      nome: f.nome.trim(),
      has_alcohol: f.has_alcohol,
      is_extra: f.is_extra,
      preco_venda: precoV,
      descricao: f.descricao || null,
      ingredients: f.ingredients,
    });
  }
  return (
    <>
      <Field label="Nome do drink"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Gin Tônica, Mojito" /></Field>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: "var(--elevated)" }}>
          <input type="checkbox" checked={f.has_alcohol} onChange={(e) => set("has_alcohol", e.target.checked)} />
          <span className="text-[12px]" style={{ color: "var(--fg)" }}>🍸 Com álcool</span>
        </label>
        <label className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: "var(--elevated)" }}>
          <input type="checkbox" checked={f.is_extra} onChange={(e) => set("is_extra", e.target.checked)} />
          <span className="text-[12px]" style={{ color: "var(--fg)" }}>💰 Drink extra (vende à parte)</span>
        </label>
      </div>

      {f.is_extra && (
        <Field label="Preço de venda (R$)">
          <NumberInput value={f.preco_venda} onChange={(e) => set("preco_venda", e.target.value)} placeholder="28,00" step="0.01" />
        </Field>
      )}

      <Field label="Descrição">
        <textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--elevated)", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13, resize: "vertical" }}
          placeholder="ex: Clássico refrescante com toque cítrico" />
      </Field>

      <SectionLabel>Ingredientes e Preparos ({f.ingredients.length})</SectionLabel>
      <div className="space-y-1" style={{ maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
        {preparos.length > 0 && (
          <>
            <p className="text-[10px] font-bold" style={{ color: "var(--muted)", textTransform: "uppercase", padding: "4px 8px" }}>Preparos</p>
            {preparos.map((prep) => {
              const sel = f.ingredients.find((i) => i.id === prep.id && i.type === "prep");
              const unitCost = custoPreparoUnit(prep, ingredientes);
              return (
                <div key={`prep-${prep.id}`} className="flex items-center gap-2 p-2 rounded" style={{ background: sel ? "var(--elevated)" : "transparent" }}>
                  <input type="checkbox" checked={!!sel} onChange={() => toggleItem(prep.id, "prep")} />
                  <div className="flex-1 text-[12px]">
                    <strong style={{ color: "var(--fg)" }}>🧪 {prep.nome}</strong>
                    <span style={{ color: "var(--dim)", marginLeft: 6 }}>{fmtBRL(unitCost)}/{prep.unidade}</span>
                  </div>
                  {sel && (
                    <div className="flex items-center gap-1">
                      <NumberInput value={sel.qty} onChange={(e) => setQty(prep.id, "prep", e.target.value)} style={{ width: 70 }} step="1" />
                      <span className="text-[10px]" style={{ color: "var(--dim)" }}>{prep.unidade}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        <p className="text-[10px] font-bold" style={{ color: "var(--muted)", textTransform: "uppercase", padding: "4px 8px" }}>Ingredientes do bar</p>
        {ingredientes.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 12 }}>Cadastre ingredientes de bar primeiro</p>
        ) : ingredientes.map((ing) => {
          const sel = f.ingredients.find((i) => i.id === ing.id && i.type === "bar");
          return (
            <div key={`bar-${ing.id}`} className="flex items-center gap-2 p-2 rounded" style={{ background: sel ? "var(--elevated)" : "transparent" }}>
              <input type="checkbox" checked={!!sel} onChange={() => toggleItem(ing.id, "bar")} />
              <div className="flex-1 text-[12px]">
                <strong style={{ color: "var(--fg)" }}>{ing.nome}</strong>
                <span style={{ color: "var(--dim)", marginLeft: 6 }}>{fmtBRL((ing.custo_unit / ing.peso_unit) * 1000)}/{ing.unidade === "g" ? "kg" : ing.unidade === "ml" ? "L" : "un"}</span>
              </div>
              {sel && (
                <div className="flex items-center gap-1">
                  <NumberInput value={sel.qty} onChange={(e) => setQty(ing.id, "bar", e.target.value)} style={{ width: 70 }} step="1" />
                  <span className="text-[10px]" style={{ color: "var(--dim)" }}>{ing.unidade}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="erp-panel p-3 mb-3 flex justify-between">
        <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
          Custo: {fmtBRL(custo)}
          {f.is_extra && precoV > 0 && <> · Margem: <span style={{ color: margem >= 30 ? "var(--accent-fg)" : "#EF4444" }}>{fmtPct(margem)}</span></>}
        </span>
      </div>

      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

// ─── Componente principal da aba ─────────────────────────────────────────
export default function TabDrinks({ eventoId, ingredientes, preparos, drinks, onChange }) {
  const [modal, setModal]   = useState(null);
  const [importar, setImportar] = useState(null);
  const [editar, setEditar] = useState(null);
  const [busca, setBusca]   = useState("");

  const ingBar  = ingredientes.filter((i) => i.tipo === "bar");
  const prepBar = preparos.filter((p) => p.tipo === "bar");

  async function salvarIng(dados) {
    if (editar) await Ingredientes.update(editar.id, dados);
    else        await Ingredientes.add(eventoId, dados);
    setModal(null); setEditar(null); onChange();
  }
  async function salvarPrep(dados) {
    if (editar) await Preparos.update(editar.id, dados);
    else        await Preparos.add(eventoId, dados);
    setModal(null); setEditar(null); onChange();
  }
  async function salvarDrink(dados) {
    if (editar) await Drinks.update(editar.id, dados);
    else        await Drinks.add(eventoId, dados);
    setModal(null); setEditar(null); onChange();
  }
  async function removerIng(id) { if (confirm("Remover este ingrediente?")) { await Ingredientes.remove(id); onChange(); } }
  async function removerPrep(id) { if (confirm("Remover este preparo?")) { await Preparos.remove(id); onChange(); } }
  async function removerDrink(id) { if (confirm("Remover este drink?")) { await Drinks.remove(id); onChange(); } }

  const drinksFiltrados = drinks.filter((d) => d.nome?.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Alerta de fluxo */}
      <Card className="!p-3" style={{ background: "linear-gradient(135deg, #8B5CF622, #F59E0B22)", borderLeft: "3px solid #8B5CF6" }}>
        <p className="text-[12px]" style={{ color: "var(--fg)" }}>
          <strong>🍹 Fluxo do Bar:</strong> 1️⃣ Cadastre <strong>ingredientes</strong> (bebidas, destilados, xaropes) → 2️⃣ Crie <strong>preparos</strong> (opcional, ex: xarope caseiro) → 3️⃣ Monte os <strong>drinks</strong>
        </p>
      </Card>

      {/* 1) Ingredientes do Bar (PRIMEIRO) */}
      <Card className="!p-4" style={{ borderTop: "3px solid #10B981" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>🍾 1️⃣ Ingredientes do Bar ({ingBar.length})</h3>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setImportar("ingredientes-bar")}><Download size={14} /> Importar do ERP</Btn>
            <Btn variant="primary" onClick={() => { setEditar(null); setModal("ing"); }}><Plus size={14} /> Novo ingrediente</Btn>
          </div>
        </div>
        {ingBar.length === 0 ? (
          <div className="text-center" style={{ padding: 20 }}>
            <p style={{ color: "var(--muted)", marginBottom: 8 }}>Nenhum ingrediente do bar cadastrado.</p>
            <p className="text-[12px]" style={{ color: "var(--dim)" }}>
              Comece pelas bebidas (gin, vodka, vinho, tônica, xaropes).
              Serão usados em <strong>preparos</strong> e <strong>drinks</strong>, e aparecerão na <strong>Lista de Compras</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ingBar.map((ing) => (
              <div key={ing.id} className="p-2 rounded flex items-center justify-between" style={{ background: "var(--elevated)" }}>
                <div>
                  <strong style={{ color: "var(--fg)", fontSize: 13 }}>{ing.nome}</strong>
                  <p className="text-[11px]" style={{ color: "var(--dim)" }}>
                    {fmtBRL(ing.custo_unit)} / {ing.peso_unit}{ing.unidade} · {fmtBRL((ing.custo_unit / ing.peso_unit) * 1000)}/{ing.unidade === "g" ? "kg" : ing.unidade === "ml" ? "L" : "un"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditar(ing); setModal("ing"); }} style={{ background: "var(--surface)", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Edit3 size={12} style={{ color: "var(--muted)" }} /></button>
                  <button onClick={() => removerIng(ing.id)} style={{ background: "#EF444433", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Trash2 size={12} style={{ color: "#EF4444" }} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 2) Preparos do Bar */}
      <Card className="!p-4" style={{ borderTop: "3px solid #8B5CF6" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>🧪 2️⃣ Preparos / Sub-receitas ({prepBar.length})</h3>
          <Btn variant="ghost" onClick={() => { setEditar(null); setModal("prep"); }} disabled={ingBar.length === 0}><Plus size={14} /> Novo preparo</Btn>
        </div>
        {prepBar.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 12 }}>
            {ingBar.length === 0
              ? "Cadastre ingredientes primeiro para criar preparos."
              : "Opcional. Crie preparos para reutilizar em drinks (ex: xarope de morango caseiro)."}
          </p>
        ) : (
          <div className="space-y-2">
            {prepBar.map((prep) => {
              const unitCost = custoPreparoUnit(prep, ingredientes);
              return (
                <div key={prep.id} className="p-2 rounded flex items-center justify-between" style={{ background: "var(--elevated)" }}>
                  <div>
                    <strong style={{ color: "var(--fg)", fontSize: 13 }}>{prep.nome}</strong>
                    <p className="text-[11px]" style={{ color: "var(--dim)" }}>
                      Rendimento: {prep.rendimento}{prep.unidade} · {fmtBRL(unitCost)}/{prep.unidade}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditar(prep); setModal("prep"); }} style={{ background: "var(--surface)", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Edit3 size={12} style={{ color: "var(--muted)" }} /></button>
                    <button onClick={() => removerPrep(prep.id)} style={{ background: "#EF444433", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Trash2 size={12} style={{ color: "#EF4444" }} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 3) Drinks (FINAL) */}
      <Card className="!p-4" style={{ borderTop: "3px solid #F59E0B" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}><Beer size={16} style={{ display: "inline", marginRight: 6 }} />3️⃣ Drinks do Menu ({drinks.length})</h3>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setImportar("drinks")}><Download size={14} /> Importar do cardápio</Btn>
            <Btn variant="primary" onClick={() => { setEditar(null); setModal("drink"); }} disabled={ingBar.length === 0}><Plus size={14} /> Novo drink</Btn>
          </div>
        </div>
        <div className="relative mb-3">
          <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--muted)" }} />
          <TextInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar drink..." style={{ paddingLeft: 30 }} />
        </div>
        {drinksFiltrados.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 20 }}>Nenhum drink cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {drinksFiltrados.map((drink) => {
              const cmv = custoDrink(drink, ingredientes, preparos);
              const precoV = Number(drink.preco_venda) || 0;
              const margem = precoV > 0 ? ((precoV - cmv) / precoV) * 100 : 0;
              return (
                <div key={drink.id} className="p-3 rounded" style={{ background: "var(--elevated)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <strong style={{ color: "var(--fg)" }}>{drink.nome}</strong>
                        {drink.has_alcohol ? (
                          <span className="erp-badge text-[10px]" style={{ background: "#F59E0B33", color: "#F59E0B" }}>🍸 Com álcool</span>
                        ) : (
                          <span className="erp-badge text-[10px]" style={{ background: "#10B98133", color: "#10B981" }}>🌿 Sem álcool</span>
                        )}
                        {drink.is_extra && <span className="erp-badge text-[10px]" style={{ background: "#8B5CF633", color: "#8B5CF6" }}>💰 Extra</span>}
                      </div>
                      {drink.descricao && <p className="text-[11px]" style={{ color: "var(--dim)" }}>{drink.descricao}</p>}
                      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                        Custo: <strong style={{ color: "var(--accent-fg)" }}>{fmtBRL(cmv)}</strong>
                        {drink.is_extra && precoV > 0 && (
                          <> · Venda: {fmtBRL(precoV)} · Margem: <strong style={{ color: margem >= 30 ? "var(--accent-fg)" : "#EF4444" }}>{fmtPct(margem)}</strong></>
                        )}
                        · {(drink.ingredients || []).length} item{(drink.ingredients || []).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditar(drink); setModal("drink"); }} style={{ background: "var(--surface)", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Edit3 size={12} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => removerDrink(drink.id)} style={{ background: "#EF444433", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Trash2 size={12} style={{ color: "#EF4444" }} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={modal === "ing"} onClose={() => { setModal(null); setEditar(null); }} title={editar ? "Editar ingrediente" : "Novo ingrediente do bar"}>
        <FormIngrediente inicial={editar} onSalvar={salvarIng} onCancelar={() => { setModal(null); setEditar(null); }} />
      </Modal>
      <Modal open={modal === "prep"} onClose={() => { setModal(null); setEditar(null); }} title={editar ? "Editar preparo" : "Novo preparo do bar"}>
        <FormPreparo inicial={editar} ingredientes={ingBar} onSalvar={salvarPrep} onCancelar={() => { setModal(null); setEditar(null); }} />
      </Modal>
      <Modal open={modal === "drink"} onClose={() => { setModal(null); setEditar(null); }} title={editar ? "Editar drink" : "Novo drink"}>
        <FormDrink inicial={editar} ingredientes={ingBar} preparos={prepBar} onSalvar={salvarDrink} onCancelar={() => { setModal(null); setEditar(null); }} />
      </Modal>

      {importar && (
        <ModalImportar
          open={!!importar}
          onClose={() => setImportar(null)}
          tipo={importar}
          eventoId={eventoId}
          existentes={importar === "drinks" ? drinks : ingBar}
          onSuccess={(count) => { alert(`✓ ${count} item(ns) importado(s) com sucesso!`); onChange(); }}
        />
      )}
    </div>
  );
}
