"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Edit3, DollarSign, Target, CreditCard, Users } from "lucide-react";
import { Card, SectionLabel, Btn, Field, TextInput, NumberInput, Select, Modal, fmtBRL, fmtPct } from "../../../components/ui";
import { CustosFixos, atualizarEvento, FIXED_COST_CATEGORIES, CMO_AREAS } from "../../../lib/eventos";

const VAZIO = { nome: "", categoria: "cmo", area: "cozinha", role: "", is_extra: false, person_count: 1, value_per_person: 0 };

function FormCustoFixo({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial
      ? { ...inicial, person_count: String(inicial.person_count || ""), value_per_person: String(inicial.value_per_person || "") }
      : VAZIO,
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  const isCmo = f.categoria === "cmo";
  const area = CMO_AREAS.find((a) => a.id === f.area);

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    const pc = parseFloat(String(f.person_count).replace(",", ".")) || 0;
    const vpp = parseFloat(String(f.value_per_person).replace(",", ".")) || 0;
    if (pc <= 0 || vpp <= 0) return setErro("Informe quantidade e valor válidos.");
    onSalvar({
      nome: f.nome.trim(),
      categoria: f.categoria,
      area: isCmo ? f.area : null,
      role: isCmo ? (f.role || null) : null,
      is_extra: !!f.is_extra,
      person_count: pc,
      value_per_person: vpp,
    });
  }

  return (
    <>
      <Field label="Nome / Descrição">
        <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Garçom, Decoração temática" />
      </Field>
      <Field label="Categoria">
        <Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
          {FIXED_COST_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </Field>

      {isCmo && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Área">
            <Select value={f.area} onChange={(e) => { set("area", e.target.value); set("role", ""); }}>
              {CMO_AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </Field>
          <Field label="Cargo">
            <Select value={f.role || ""} onChange={(e) => set("role", e.target.value)}>
              <option value="">— sem cargo —</option>
              {area?.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </Select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Qtd pessoas / unidades">
          <NumberInput value={f.person_count} onChange={(e) => set("person_count", e.target.value)} placeholder="2" step="1" />
        </Field>
        <Field label="Valor por pessoa (R$)">
          <NumberInput value={f.value_per_person} onChange={(e) => set("value_per_person", e.target.value)} placeholder="200,00" step="0.01" />
        </Field>
      </div>

      {isCmo && (
        <label className="flex items-center gap-2 p-2 rounded cursor-pointer mb-3" style={{ background: "var(--elevated)" }}>
          <input type="checkbox" checked={f.is_extra} onChange={(e) => set("is_extra", e.target.checked)} />
          <span className="text-[12px]" style={{ color: "var(--fg)" }}>Contratação extra (só para o evento)</span>
        </label>
      )}

      <div className="erp-panel p-3 mb-3 flex justify-between">
        <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>Total:</span>
        <strong style={{ color: "var(--accent-fg)" }}>{fmtBRL(Number(f.person_count || 0) * Number(f.value_per_person || 0))}</strong>
      </div>

      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

export default function TabFinanceiro({ eventoId, evento, custosFixos, reservas, calc, onChange }) {
  const [modal, setModal]   = useState(false);
  const [editar, setEditar] = useState(null);
  const [meta, setMeta]     = useState(String(evento.meta_lucro || 0));

  const itemAmount = (c) => Number(c.person_count || 0) * Number(c.value_per_person || 0);

  // Agrupado por categoria
  const grupos = useMemo(() => {
    return FIXED_COST_CATEGORIES.map((cat) => {
      const items = custosFixos.filter((c) => c.categoria === cat.id);
      const total = items.reduce((s, c) => s + itemAmount(c), 0);
      let groups = null;
      if (cat.id === "cmo") {
        groups = CMO_AREAS.map((area) => {
          const areaItems = items.filter((it) => it.area === area.id);
          return { ...area, items: areaItems, total: areaItems.reduce((s, c) => s + itemAmount(c), 0) };
        }).filter((g) => g.items.length > 0);
      }
      return { ...cat, items, total, groups };
    }).filter((cat) => cat.items.length > 0);
  }, [custosFixos]);

  async function salvar(dados) {
    if (editar) await CustosFixos.update(editar.id, dados);
    else        await CustosFixos.add(eventoId, dados);
    setModal(false); setEditar(null); onChange();
  }
  async function remover(id) {
    if (!confirm("Remover este custo?")) return;
    await CustosFixos.remove(id); onChange();
  }
  async function salvarMeta() {
    const num = parseFloat(String(meta).replace(",", ".")) || 0;
    await atualizarEvento(eventoId, { meta_lucro: num });
    onChange();
  }

  const totalSinal = reservas.reduce((s, r) => s + Number(r.sinal || 0), 0);
  const totalReceber = Math.max(0, calc.totalRevenue - totalSinal);
  const pagamentoPct = calc.totalRevenue > 0 ? (totalSinal / calc.totalRevenue) * 100 : 0;
  const metaNum = Number(meta) || 0;
  const metaPct = metaNum > 0 ? Math.max(0, (calc.profit / metaNum) * 100) : 0;
  const contrib = calc.contributionPerUnit;
  const unidadesFaltam = contrib > 0
    ? Math.max(0, Math.ceil((calc.totalFixos + metaNum - (calc.totalRevenue - calc.totalCMV - calc.impostos - calc.machineFee)) / contrib))
    : null;

  return (
    <div className="space-y-4">
      {/* Resumo financeiro */}
      <Card className="!p-4">
        <h3 style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 12 }}>Resumo por {calc.unitName}</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><p className="text-[10px]" style={{ color: "var(--dim)" }}>PREÇO POR {calc.unitName.toUpperCase()}</p><strong style={{ fontSize: 20, color: "#10B981" }}>{fmtBRL(evento.preco_unit)}</strong></div>
          <div><p className="text-[10px]" style={{ color: "var(--dim)" }}>LUCRO POR {calc.unitName.toUpperCase()}</p><strong style={{ fontSize: 20, color: calc.contributionPerUnit > 0 ? "#10B981" : "#EF4444" }}>{fmtBRL(calc.contributionPerUnit - (reservas.length > 0 ? calc.totalFixos / reservas.length : 0))}</strong></div>
        </div>
        <div className="space-y-2 text-[12px]">
          <div className="flex justify-between"><span style={{ color: "#10B981" }}>+ Preço</span><strong>{fmtBRL(evento.preco_unit)}</strong></div>
          <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>− CMV</span><strong>{fmtBRL(calc.cmvUnit)}</strong></div>
          <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>− Mão de Obra rateada</span><strong>{fmtBRL(reservas.length > 0 ? calc.laborTotal / reservas.length : 0)}</strong></div>
          <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>− Outros fixos rateados</span><strong>{fmtBRL(reservas.length > 0 ? (calc.totalFixos - calc.laborTotal) / reservas.length : 0)}</strong></div>
          <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>− Impostos ({(Number(evento.impostos_rate) * 100).toFixed(1)}%)</span><strong>{fmtBRL(Number(evento.preco_unit) * Number(evento.impostos_rate))}</strong></div>
          <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>− Maquininha ({(calc.machineRate * 100).toFixed(2)}%)</span><strong>{fmtBRL(Number(evento.preco_unit) * calc.machineRate)}</strong></div>
        </div>
      </Card>

      {/* Status pagamento + Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={16} style={{ color: "#10B981" }} />
            <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>Status de Pagamento</h3>
          </div>
          <div className="flex justify-between text-[12px] mb-1"><span style={{ color: "#10B981" }}>✓ Recebido</span><strong>{fmtBRL(totalSinal)}</strong></div>
          <div className="flex justify-between text-[12px] mb-1"><span style={{ color: "#F59E0B" }}>⌛ A receber</span><strong>{fmtBRL(totalReceber)}</strong></div>
          <div className="flex justify-between text-[12px] mb-2 pb-2" style={{ borderBottom: "1px solid var(--line)" }}><span style={{ color: "var(--muted)" }}>Total esperado</span><strong>{fmtBRL(calc.totalRevenue)}</strong></div>
          <div style={{ height: 6, background: "var(--elevated)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ width: `${pagamentoPct}%`, height: "100%", background: "linear-gradient(90deg, #10B981, #F59E0B)" }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--dim)" }}>
            <span>{pagamentoPct.toFixed(0)}% pago</span><span>{(100 - pagamentoPct).toFixed(0)}% pendente</span>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} style={{ color: "var(--accent-fg)" }} />
            <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>Meta de Lucro</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <NumberInput value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="2000,00" step="0.01" />
            <Btn variant="primary" onClick={salvarMeta}>Salvar</Btn>
          </div>
          <div className="flex justify-between text-[12px] mb-1"><span style={{ color: "var(--muted)" }}>Lucro atual</span><strong style={{ color: calc.profit >= 0 ? "#10B981" : "#EF4444" }}>{fmtBRL(calc.profit)}</strong></div>
          <div className="flex justify-between text-[12px] mb-2"><span style={{ color: "var(--muted)" }}>Meta</span><strong>{fmtBRL(metaNum)}</strong></div>
          <div style={{ height: 6, background: "var(--elevated)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, metaPct)}%`, height: "100%", background: calc.profit >= metaNum ? "#10B981" : "linear-gradient(90deg, #EF4444, #F59E0B)" }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--dim)" }}>
            <span>{metaPct.toFixed(0)}% da meta</span>
            {unidadesFaltam !== null && unidadesFaltam > 0 && calc.profit < metaNum && (
              <span>Faltam <strong style={{ color: "var(--accent-fg)" }}>{unidadesFaltam}</strong> {calc.unitName}</span>
            )}
            {calc.profit >= metaNum && metaNum > 0 && <span style={{ color: "#10B981" }}>Meta batida 🎯</span>}
          </div>
        </Card>
      </div>

      {/* Custos Fixos */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}><DollarSign size={16} style={{ display: "inline", marginRight: 6 }} />Custos Fixos ({custosFixos.length}) · {fmtBRL(calc.totalFixos)}</h3>
          <Btn variant="primary" onClick={() => { setEditar(null); setModal(true); }}><Plus size={14} /> Novo custo</Btn>
        </div>

        {grupos.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 20 }}>Nenhum custo fixo cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {grupos.map((grupo) => (
              <div key={grupo.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: grupo.cor }} />
                    <strong style={{ color: "var(--fg)" }}>{grupo.label}</strong>
                  </div>
                  <span className="text-[12px] font-bold" style={{ color: grupo.cor }}>{fmtBRL(grupo.total)}</span>
                </div>
                {grupo.groups ? (
                  // CMO com sub-áreas
                  <div className="space-y-2">
                    {grupo.groups.map((area) => (
                      <div key={area.id}>
                        <div className="flex items-center justify-between mb-1 text-[11px]" style={{ color: "var(--muted)", paddingLeft: 16 }}>
                          <span>{area.label} ({area.items.length})</span>
                          <strong>{fmtBRL(area.total)}</strong>
                        </div>
                        {area.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded text-[12px]" style={{ background: "var(--elevated)", marginLeft: 16 }}>
                            <div>
                              <strong style={{ color: "var(--fg)" }}>{item.nome}</strong>
                              {item.is_extra && <span className="erp-badge text-[9px]" style={{ background: "#F59E0B33", color: "#F59E0B", marginLeft: 4 }}>extra</span>}
                              <div style={{ color: "var(--dim)", fontSize: 10 }}>{item.person_count}× {fmtBRL(item.value_per_person)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <strong style={{ color: "var(--fg)" }}>{fmtBRL(itemAmount(item))}</strong>
                              <button onClick={() => { setEditar(item); setModal(true); }} style={{ background: "var(--surface)", padding: 4, borderRadius: 4, border: "none", cursor: "pointer" }}><Edit3 size={10} style={{ color: "var(--muted)" }} /></button>
                              <button onClick={() => remover(item.id)} style={{ background: "#EF444433", padding: 4, borderRadius: 4, border: "none", cursor: "pointer" }}><Trash2 size={10} style={{ color: "#EF4444" }} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Outras categorias
                  <div className="space-y-1">
                    {grupo.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded text-[12px]" style={{ background: "var(--elevated)" }}>
                        <div>
                          <strong style={{ color: "var(--fg)" }}>{item.nome}</strong>
                          <div style={{ color: "var(--dim)", fontSize: 10 }}>{item.person_count}× {fmtBRL(item.value_per_person)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <strong style={{ color: "var(--fg)" }}>{fmtBRL(itemAmount(item))}</strong>
                          <button onClick={() => { setEditar(item); setModal(true); }} style={{ background: "var(--surface)", padding: 4, borderRadius: 4, border: "none", cursor: "pointer" }}><Edit3 size={10} style={{ color: "var(--muted)" }} /></button>
                          <button onClick={() => remover(item.id)} style={{ background: "#EF444433", padding: 4, borderRadius: 4, border: "none", cursor: "pointer" }}><Trash2 size={10} style={{ color: "#EF4444" }} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar custo" : "Novo custo fixo"}>
        <FormCustoFixo inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
