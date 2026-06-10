"use client";

import { useState } from "react";
import { Plus, Trash2, Edit3, ChefHat, FlaskConical, Save, X, Search } from "lucide-react";
import { Card, SectionLabel, Btn, Field, TextInput, NumberInput, Select, Modal, fmtBRL, fmtPct } from "../../../components/ui";
import { Ingredientes, Preparos, Pratos, CATEGORIAS_PRATO, DISH_TAGS, custoIngrediente, custoPreparoUnit, custoItem, custoPrato } from "../../../lib/eventos";

const VAZIO_ING = { tipo: "food", nome: "", custo_unit: "", peso_unit: 1000, unidade: "g" };
const VAZIO_PREP = { tipo: "food", nome: "", rendimento: 1000, unidade: "g", base_ingredients: [] };
const VAZIO_PRATO = { nome: "", categoria: "Principal", rendimento: 1, descricao: "", tags: [], ingredients: [] };

// ─── Form Ingrediente ────────────────────────────────────────────────────
function FormIngrediente({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial ? { ...inicial, custo_unit: String(inicial.custo_unit || ""), peso_unit: String(inicial.peso_unit || "") } : VAZIO_ING,
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    onSalvar({
      tipo: "food",
      nome: f.nome.trim(),
      custo_unit: parseFloat(String(f.custo_unit).replace(",", ".")) || 0,
      peso_unit: parseFloat(String(f.peso_unit).replace(",", ".")) || 1,
      unidade: f.unidade,
    });
  }
  return (
    <>
      <Field label="Nome do ingrediente"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Filé Mignon" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Custo (R$)"><NumberInput value={f.custo_unit} onChange={(e) => set("custo_unit", e.target.value)} placeholder="95,00" step="0.01" /></Field>
        <Field label="Peso/Volume"><NumberInput value={f.peso_unit} onChange={(e) => set("peso_unit", e.target.value)} placeholder="1000" step="1" /></Field>
        <Field label="Unidade">
          <Select value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>
            <option value="g">g</option><option value="ml">ml</option><option value="un">un</option>
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

// ─── Form Preparo ────────────────────────────────────────────────────────
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
      : [...f.base_ingredients, { id: ingId, qty: 100 }]);
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
      tipo: "food",
      nome: f.nome.trim(),
      rendimento: parseFloat(String(f.rendimento).replace(",", ".")) || 1,
      unidade: f.unidade,
      base_ingredients: f.base_ingredients,
    });
  }
  return (
    <>
      <Field label="Nome do preparo"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Molho de tomate caseiro" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rendimento"><NumberInput value={f.rendimento} onChange={(e) => set("rendimento", e.target.value)} placeholder="1000" step="1" /></Field>
        <Field label="Unidade">
          <Select value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>
            <option value="g">g</option><option value="ml">ml</option>
          </Select>
        </Field>
      </div>

      <SectionLabel>Ingredientes do preparo ({f.base_ingredients.length})</SectionLabel>
      <div className="space-y-1" style={{ maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
        {ingredientes.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 12 }}>Cadastre ingredientes primeiro</p>
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

// ─── Form Prato ──────────────────────────────────────────────────────────
function FormPrato({ inicial, ingredientes, preparos, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial ? { ...inicial, rendimento: String(inicial.rendimento || ""), tags: inicial.tags || [], ingredients: inicial.ingredients || [] } : VAZIO_PRATO,
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function toggleItem(id, type) {
    const exists = f.ingredients.find((i) => i.id === id && i.type === type);
    set("ingredients", exists
      ? f.ingredients.filter((i) => !(i.id === id && i.type === type))
      : [...f.ingredients, { id, type, qty: 100 }]);
  }
  function setQty(id, type, qty) {
    set("ingredients", f.ingredients.map((i) => i.id === id && i.type === type ? { ...i, qty: Number(qty) || 0 } : i));
  }
  function toggleTag(tag) {
    set("tags", f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag]);
  }

  const custoTotal = f.ingredients.reduce((s, item) => s + custoItem(item, ingredientes, preparos), 0);
  const custoPorPorcao = f.rendimento > 0 ? custoTotal / Number(f.rendimento) : 0;

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    onSalvar({
      nome: f.nome.trim(),
      categoria: f.categoria,
      rendimento: parseFloat(String(f.rendimento).replace(",", ".")) || 1,
      descricao: f.descricao || null,
      tags: f.tags,
      ingredients: f.ingredients,
    });
  }
  return (
    <>
      <Field label="Nome do prato"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Filé Wellington" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {CATEGORIAS_PRATO.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Rendimento (porções)"><NumberInput value={f.rendimento} onChange={(e) => set("rendimento", e.target.value)} placeholder="1" step="1" /></Field>
      </div>
      <Field label="Descrição">
        <textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--elevated)", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13, resize: "vertical" }}
          placeholder="ex: Filé mignon envolto em massa folhada com trufas negras" />
      </Field>

      <SectionLabel>Tags</SectionLabel>
      <div className="flex flex-wrap gap-2 mb-3">
        {DISH_TAGS.map((tag) => (
          <button key={tag} onClick={() => toggleTag(tag)} style={{
            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: f.tags.includes(tag) ? "var(--accent-fg)" : "var(--elevated)",
            color: f.tags.includes(tag) ? "#000" : "var(--muted)",
            border: "none", cursor: "pointer",
          }}>{tag}</button>
        ))}
      </div>

      <SectionLabel>Ingredientes e Preparos ({f.ingredients.length})</SectionLabel>
      <div className="space-y-1" style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
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
        <p className="text-[10px] font-bold" style={{ color: "var(--muted)", textTransform: "uppercase", padding: "4px 8px" }}>Ingredientes</p>
        {ingredientes.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 12 }}>Cadastre ingredientes primeiro</p>
        ) : ingredientes.map((ing) => {
          const sel = f.ingredients.find((i) => i.id === ing.id && i.type === "food");
          return (
            <div key={`food-${ing.id}`} className="flex items-center gap-2 p-2 rounded" style={{ background: sel ? "var(--elevated)" : "transparent" }}>
              <input type="checkbox" checked={!!sel} onChange={() => toggleItem(ing.id, "food")} />
              <div className="flex-1 text-[12px]">
                <strong style={{ color: "var(--fg)" }}>{ing.nome}</strong>
                <span style={{ color: "var(--dim)", marginLeft: 6 }}>{fmtBRL((ing.custo_unit / ing.peso_unit) * 1000)}/{ing.unidade === "g" ? "kg" : "L"}</span>
              </div>
              {sel && (
                <div className="flex items-center gap-1">
                  <NumberInput value={sel.qty} onChange={(e) => setQty(ing.id, "food", e.target.value)} style={{ width: 70 }} step="1" />
                  <span className="text-[10px]" style={{ color: "var(--dim)" }}>{ing.unidade}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="erp-panel p-3 mb-3 flex justify-between">
        <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
          CMV total: {fmtBRL(custoTotal)}
          {f.rendimento > 1 && <> · por porção: {fmtBRL(custoPorPorcao)}</>}
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
export default function TabCardapio({ eventoId, ingredientes, preparos, pratos, onChange }) {
  const [modal, setModal]   = useState(null);  // 'ing' | 'prep' | 'prato'
  const [editar, setEditar] = useState(null);
  const [busca, setBusca]   = useState("");

  const ingFood   = ingredientes.filter((i) => i.tipo === "food");
  const prepFood  = preparos.filter((p) => p.tipo === "food");

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
  async function salvarPrato(dados) {
    if (editar) await Pratos.update(editar.id, dados);
    else        await Pratos.add(eventoId, dados);
    setModal(null); setEditar(null); onChange();
  }
  async function removerIng(id) {
    if (!confirm("Remover este ingrediente?")) return;
    await Ingredientes.remove(id); onChange();
  }
  async function removerPrep(id) {
    if (!confirm("Remover este preparo?")) return;
    await Preparos.remove(id); onChange();
  }
  async function removerPrato(id) {
    if (!confirm("Remover este prato?")) return;
    await Pratos.remove(id); onChange();
  }

  const pratosFiltrados = pratos.filter((p) => p.nome?.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Pratos */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}><ChefHat size={16} style={{ display: "inline", marginRight: 6 }} />Pratos ({pratos.length})</h3>
          <Btn variant="primary" onClick={() => { setEditar(null); setModal("prato"); }}><Plus size={14} /> Novo prato</Btn>
        </div>
        <div className="relative mb-3">
          <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--muted)" }} />
          <TextInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato..." style={{ paddingLeft: 30 }} />
        </div>
        {pratosFiltrados.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 20 }}>Nenhum prato cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {pratosFiltrados.map((prato) => {
              const cmv = custoPrato(prato, ingredientes, preparos);
              return (
                <div key={prato.id} className="p-3 rounded" style={{ background: "var(--elevated)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <strong style={{ color: "var(--fg)" }}>{prato.nome}</strong>
                        <span className="erp-badge text-[10px]" style={{ background: "var(--surface)", color: "var(--muted)" }}>{prato.categoria}</span>
                        {(prato.tags || []).map((t) => (
                          <span key={t} className="erp-badge text-[10px]" style={{ background: "var(--surface)", color: "var(--muted)" }}>{t}</span>
                        ))}
                      </div>
                      {prato.descricao && <p className="text-[11px]" style={{ color: "var(--dim)" }}>{prato.descricao}</p>}
                      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                        CMV: <strong style={{ color: "var(--accent-fg)" }}>{fmtBRL(cmv)}</strong>
                        {prato.rendimento > 1 && <> · por porção: {fmtBRL(cmv / prato.rendimento)}</>}
                        · {(prato.ingredients || []).length} item{(prato.ingredients || []).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditar(prato); setModal("prato"); }} style={{ background: "var(--surface)", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Edit3 size={12} style={{ color: "var(--muted)" }} /></button>
                      <button onClick={() => removerPrato(prato.id)} style={{ background: "#EF444433", padding: 6, borderRadius: 6, border: "none", cursor: "pointer" }}><Trash2 size={12} style={{ color: "#EF4444" }} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Preparos */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>🧪 Preparos / Sub-receitas ({prepFood.length})</h3>
          <Btn variant="ghost" onClick={() => { setEditar(null); setModal("prep"); }}><Plus size={14} /> Novo preparo</Btn>
        </div>
        {prepFood.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 12 }}>Crie preparos para reutilizar em pratos (ex: molho de tomate).</p>
        ) : (
          <div className="space-y-2">
            {prepFood.map((prep) => {
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

      {/* Ingredientes */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>🥕 Ingredientes ({ingFood.length})</h3>
          <Btn variant="ghost" onClick={() => { setEditar(null); setModal("ing"); }}><Plus size={14} /> Novo ingrediente</Btn>
        </div>
        {ingFood.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 12 }}>Adicione ingredientes base para usar em preparos e pratos.</p>
        ) : (
          <div className="space-y-2">
            {ingFood.map((ing) => (
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

      <Modal open={modal === "ing"} onClose={() => { setModal(null); setEditar(null); }} title={editar ? "Editar ingrediente" : "Novo ingrediente"}>
        <FormIngrediente inicial={editar} onSalvar={salvarIng} onCancelar={() => { setModal(null); setEditar(null); }} />
      </Modal>
      <Modal open={modal === "prep"} onClose={() => { setModal(null); setEditar(null); }} title={editar ? "Editar preparo" : "Novo preparo"}>
        <FormPreparo inicial={editar} ingredientes={ingFood} onSalvar={salvarPrep} onCancelar={() => { setModal(null); setEditar(null); }} />
      </Modal>
      <Modal open={modal === "prato"} onClose={() => { setModal(null); setEditar(null); }} title={editar ? "Editar prato" : "Novo prato"}>
        <FormPrato inicial={editar} ingredientes={ingFood} preparos={prepFood} onSalvar={salvarPrato} onCancelar={() => { setModal(null); setEditar(null); }} />
      </Modal>
    </div>
  );
}
