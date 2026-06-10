"use client";

import { useMemo, useState } from "react";
import { ShoppingCart, ChefHat, Wine, Printer, Activity } from "lucide-react";
import { Card, SectionLabel, Btn, NumberInput, Field, fmtBRL } from "../../../components/ui";

function imprimirLista(food, bar, totalCost, evento, safetyMargin) {
  const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Lista de Compras — ${evento.nome}</title>
<style>
body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 24px auto; padding: 20px; color: #111; }
h1 { margin: 0 0 4px; font-size: 24px; }
h2 { margin-top: 24px; font-size: 16px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
.meta { font-size: 12px; color: #64748b; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
.qty { font-weight: 600; }
.cost { text-align: right; color: #be123c; font-weight: 700; }
.total-row { background: #fef2f2; font-weight: 800; font-size: 14px; }
.grand-total { margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #fef2f2, #fff7ed); border-radius: 12px; text-align: center; }
.grand-total strong { font-size: 28px; color: #be123c; display: block; margin-top: 4px; }
@media print { body { margin: 0; padding: 12px; } }
</style></head><body>
<h1>Lista de Compras — ${evento.nome}</h1>
<div class="meta">${new Date(evento.data_evento + "T00:00:00").toLocaleDateString("pt-BR")} · ${evento.tag || ""} · Margem de segurança: +${safetyMargin}%</div>

${food.length > 0 ? `
<h2>🍽️ Cozinha</h2>
<table><thead><tr><th>Item</th><th>Necessário</th><th>Com buffer</th><th class="cost">Custo</th></tr></thead><tbody>
${food.map(i => `<tr><td><strong>${i.name}</strong></td><td>${i.qty.toFixed(0)}${i.unit}</td><td class="qty">${i.qtyWithBuffer.toFixed(0)}${i.unit}</td><td class="cost">${fmtBRL(i.cost)}</td></tr>`).join("")}
<tr class="total-row"><td colspan="3">Subtotal Cozinha</td><td class="cost">${fmtBRL(food.reduce((s, i) => s + i.cost, 0))}</td></tr>
</tbody></table>` : ""}

${bar.length > 0 ? `
<h2>🍷 Bar</h2>
<table><thead><tr><th>Item</th><th>Necessário</th><th>Com buffer</th><th class="cost">Custo</th></tr></thead><tbody>
${bar.map(i => `<tr><td><strong>${i.name}</strong></td><td>${i.qty.toFixed(0)}${i.unit}</td><td class="qty">${i.qtyWithBuffer.toFixed(0)}${i.unit}</td><td class="cost">${fmtBRL(i.cost)}</td></tr>`).join("")}
<tr class="total-row"><td colspan="3">Subtotal Bar</td><td class="cost">${fmtBRL(bar.reduce((s, i) => s + i.cost, 0))}</td></tr>
</tbody></table>` : ""}

<div class="grand-total">
  Total a comprar
  <strong>${fmtBRL(totalCost)}</strong>
</div>

<script>window.onload = () => { window.print(); }</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

export default function TabCompras({ evento, reservas, pratos, drinks, ingredientes, preparos }) {
  const [safetyMargin, setSafetyMargin] = useState(Number(evento.margem_seg) || 10);

  const shopping = useMemo(() => {
    const couples = reservas.length;
    if (couples === 0) return { food: [], bar: [], totalCost: 0 };

    // Distribui porções de pratos por categoria
    const portionsCategoria = (categoria, included) => {
      const inCat = pratos.filter((p) => p.categoria === categoria);
      if (!inCat.length) return new Map();
      const portionsPerDish = (couples * Number(included)) / inCat.length;
      const map = new Map();
      inCat.forEach((d) => map.set(d.id, portionsPerDish));
      return map;
    };

    const dishPortions = new Map([
      ...portionsCategoria("Entrada", evento.entradas_inc),
      ...portionsCategoria("Principal", evento.principais_inc),
      ...portionsCategoria("Sobremesa", evento.sobremesas_inc),
    ]);
    const drinksMenu = drinks.filter((d) => !d.is_extra);
    const drinkPortions = drinksMenu.length > 0
      ? (couples * Number(evento.drinks_inc)) / drinksMenu.length : 0;

    // Acumular necessidades por ingrediente (food e bar)
    const foodNeeded = new Map();
    const barNeeded = new Map();

    function addItemNeed(item, portions, isBar) {
      if (portions === 0) return;
      if (item.type === "prep") {
        const prep = preparos.find((p) => p.id === item.id);
        if (!prep || !prep.rendimento) return;
        // multiplica os ingredientes do preparo
        const factor = (Number(item.qty) * portions) / Number(prep.rendimento);
        (prep.base_ingredients || []).forEach((bi) => {
          const target = prep.tipo === "bar" ? barNeeded : foodNeeded;
          target.set(bi.id, (target.get(bi.id) || 0) + Number(bi.qty) * factor);
        });
      } else {
        const target = isBar ? barNeeded : foodNeeded;
        target.set(item.id, (target.get(item.id) || 0) + Number(item.qty) * portions);
      }
    }

    pratos.forEach((p) => {
      const portions = dishPortions.get(p.id) || 0;
      (p.ingredients || []).forEach((i) => addItemNeed(i, portions, false));
    });
    drinksMenu.forEach((d) => {
      (d.ingredients || []).forEach((i) => addItemNeed(i, drinkPortions, true));
    });

    // Extras
    reservas.forEach((r) => {
      (r.extra_drinks || []).forEach((ed) => {
        const drink = drinks.find((d) => d.id === ed.drinkId);
        if (!drink) return;
        (drink.ingredients || []).forEach((i) => addItemNeed(i, ed.qty, true));
      });
    });

    const safety = 1 + Number(safetyMargin) / 100;

    const food = Array.from(foodNeeded.entries()).map(([id, qty]) => {
      const ing = ingredientes.find((i) => i.id === id);
      if (!ing) return null;
      const qtyWithBuffer = qty * safety;
      const cost = (Number(ing.custo_unit) / Number(ing.peso_unit)) * qtyWithBuffer;
      return {
        id, name: ing.nome, qty, qtyWithBuffer, unit: ing.unidade, cost,
        pricePerKg: (Number(ing.custo_unit) / Number(ing.peso_unit)) * 1000,
      };
    }).filter(Boolean).sort((a, b) => b.cost - a.cost);

    const bar = Array.from(barNeeded.entries()).map(([id, qty]) => {
      const ing = ingredientes.find((i) => i.id === id);
      if (!ing) return null;
      const qtyWithBuffer = qty * safety;
      const cost = (Number(ing.custo_unit) / Number(ing.peso_unit)) * qtyWithBuffer;
      return {
        id, name: ing.nome, qty, qtyWithBuffer, unit: ing.unidade, cost,
        pricePerL: (Number(ing.custo_unit) / Number(ing.peso_unit)) * 1000,
      };
    }).filter(Boolean).sort((a, b) => b.cost - a.cost);

    const totalCost = [...food, ...bar].reduce((s, i) => s + i.cost, 0);
    return { food, bar, totalCost };
  }, [reservas, pratos, drinks, ingredientes, preparos, evento, safetyMargin]);

  if (reservas.length === 0) {
    return (
      <Card className="!p-6 text-center">
        <ShoppingCart size={40} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--muted)" }}>Adicione reservas para gerar a lista de compras automaticamente.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 style={{ fontWeight: 700, color: "var(--fg)" }}><ShoppingCart size={16} style={{ display: "inline", marginRight: 6 }} />Lista de Compras</h3>
            <p className="text-[11px]" style={{ color: "var(--dim)" }}>
              Calculado a partir de {reservas.length} {evento.charge_mode === "couple" ? "casais" : "pessoas"} × menu do evento
            </p>
          </div>
          <Field label="Margem segurança (%)">
            <NumberInput value={safetyMargin} onChange={(e) => setSafetyMargin(Number(e.target.value) || 0)} step="1" style={{ width: 100 }} />
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        <Card className="!p-3"><p className="text-[10px]" style={{ color: "var(--dim)" }}>CUSTO ESTIMADO</p><strong style={{ fontSize: 16, color: "#EF4444" }}>{fmtBRL(shopping.totalCost)}</strong></Card>
        <Card className="!p-3"><p className="text-[10px]" style={{ color: "var(--dim)" }}>ITENS COZINHA</p><strong style={{ fontSize: 20, color: "var(--fg)" }}>{shopping.food.length}</strong></Card>
        <Card className="!p-3"><p className="text-[10px]" style={{ color: "var(--dim)" }}>ITENS BAR</p><strong style={{ fontSize: 20, color: "var(--fg)" }}>{shopping.bar.length}</strong></Card>
        <Card className="!p-3"><p className="text-[10px]" style={{ color: "var(--dim)" }}>MARGEM</p><strong style={{ fontSize: 20, color: "var(--accent-fg)" }}>+{safetyMargin}%</strong></Card>
      </div>

      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <ChefHat size={16} style={{ color: "#EF4444" }} />
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>Cozinha ({shopping.food.length} itens)</h3>
        </div>
        {shopping.food.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)" }}>Nenhum item.</p>
        ) : (
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 10, textTransform: "uppercase" }}>
              <th style={{ padding: 6 }}>Item</th><th style={{ padding: 6 }}>Necessário</th><th style={{ padding: 6 }}>+ Buffer</th><th style={{ padding: 6, textAlign: "right" }}>Custo</th>
            </tr></thead>
            <tbody>
              {shopping.food.map((i) => (
                <tr key={i.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: 8 }}><strong style={{ color: "var(--fg)" }}>{i.name}</strong><div style={{ fontSize: 10, color: "var(--dim)" }}>{fmtBRL(i.pricePerKg)}/kg</div></td>
                  <td style={{ padding: 8, color: "var(--muted)" }}>{i.qty.toFixed(0)}{i.unit}</td>
                  <td style={{ padding: 8, color: "var(--fg)", fontWeight: 600 }}>{i.qtyWithBuffer.toFixed(0)}{i.unit}</td>
                  <td style={{ padding: 8, textAlign: "right", color: "#EF4444", fontWeight: 700 }}>{fmtBRL(i.cost)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--elevated)" }}>
                <td colSpan={3} style={{ padding: 8, fontWeight: 700 }}>Subtotal Cozinha</td>
                <td style={{ padding: 8, textAlign: "right", fontWeight: 800, color: "#EF4444" }}>{fmtBRL(shopping.food.reduce((s, i) => s + i.cost, 0))}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wine size={16} style={{ color: "#8B5CF6" }} />
          <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>Bar ({shopping.bar.length} itens)</h3>
        </div>
        {shopping.bar.length === 0 ? (
          <p className="text-sm text-center" style={{ color: "var(--dim)" }}>Nenhum item.</p>
        ) : (
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 10, textTransform: "uppercase" }}>
              <th style={{ padding: 6 }}>Item</th><th style={{ padding: 6 }}>Necessário</th><th style={{ padding: 6 }}>+ Buffer</th><th style={{ padding: 6, textAlign: "right" }}>Custo</th>
            </tr></thead>
            <tbody>
              {shopping.bar.map((i) => (
                <tr key={i.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: 8 }}><strong style={{ color: "var(--fg)" }}>{i.name}</strong><div style={{ fontSize: 10, color: "var(--dim)" }}>{fmtBRL(i.pricePerL)}/L</div></td>
                  <td style={{ padding: 8, color: "var(--muted)" }}>{i.qty.toFixed(0)}{i.unit}</td>
                  <td style={{ padding: 8, color: "var(--fg)", fontWeight: 600 }}>{i.qtyWithBuffer.toFixed(0)}{i.unit}</td>
                  <td style={{ padding: 8, textAlign: "right", color: "#8B5CF6", fontWeight: 700 }}>{fmtBRL(i.cost)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--elevated)" }}>
                <td colSpan={3} style={{ padding: 8, fontWeight: 700 }}>Subtotal Bar</td>
                <td style={{ padding: 8, textAlign: "right", fontWeight: 800, color: "#8B5CF6" }}>{fmtBRL(shopping.bar.reduce((s, i) => s + i.cost, 0))}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card className="!p-4" style={{ background: "linear-gradient(135deg, #EF444411, #F59E0B11)", border: "1px solid #EF444433" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Total a comprar</p>
            <strong style={{ fontSize: 32, color: "#EF4444" }}>{fmtBRL(shopping.totalCost)}</strong>
            <p className="text-[11px]" style={{ color: "var(--dim)" }}>{reservas.length} {evento.charge_mode === "couple" ? "casais" : "pessoas"} com +{safetyMargin}% de margem</p>
          </div>
          <Btn variant="primary" onClick={() => imprimirLista(shopping.food, shopping.bar, shopping.totalCost, evento, safetyMargin)}>
            <Printer size={14} /> Imprimir lista
          </Btn>
        </div>
      </Card>
    </div>
  );
}
