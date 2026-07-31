const fs = require('fs');

// 1. UPDATE app/dashboard/operacao/estoque/page.js
const estoqueFile = 'app/dashboard/operacao/estoque/page.js';
let estoqueContent = fs.readFileSync(estoqueFile, 'utf8');

const targetSelect = `<Campo label="Unidade comercial">
                    <select value={formItem.unidade_comercial || ""} onChange={e => setFormItem({ ...formItem, unidade_comercial: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">
                      <option value="">Selecione...</option>
                      {["garrafa", "lata", "unidade", "caixa", "pacote", "fardo", "barril", "outro"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </Campo>`;

const replacementSelect = `<Campo label="Unidade comercial">
                    {(() => {
                      const ehBar = estoqueAtual?.departamento === "bar" || modal?.item?.departamento === "bar" || formItem?.departamento === "bar";
                      const cat = String(formItem?.categoria || modal?.item?.categoria || "").toLowerCase();
                      const nome = String(formItem?.nome || modal?.item?.nome || "").toLowerCase();
                      const ehFruta = cat.includes("fruta") || cat.includes("horti") || cat.includes("fresco") ||
                                      nome.includes("limão") || nome.includes("laranja") || nome.includes("abacaxi") ||
                                      nome.includes("hortelã") || nome.includes("morango") || nome.includes("maracujá") ||
                                      nome.includes("fruta");
                      let opcoes = ["garrafa", "lata", "unidade", "caixa", "pacote", "fardo", "barril", "outro"];
                      if (ehBar) {
                        opcoes = ehFruta ? ["unidade", "g", "kg"] : ["garrafa", "lata", "barril"];
                      }
                      return (
                        <select value={formItem.unidade_comercial || ""} onChange={e => setFormItem({ ...formItem, unidade_comercial: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">
                          <option value="">Selecione...</option>
                          {opcoes.map(u => (
                            <option key={u} value={u}>
                              {u === "garrafa" ? "Garrafa" : u === "lata" ? "Lata" : u === "barril" ? "Barril (Chopp)" : u === "unidade" ? "Unidade (un)" : u === "g" ? "Grama (g)" : u === "kg" ? "Quilo (kg)" : u}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </Campo>`;

estoqueContent = estoqueContent.replace(/\r\n/g, '\n');
const targetSelectNorm = targetSelect.replace(/\r\n/g, '\n');
if (estoqueContent.includes(targetSelectNorm)) {
  estoqueContent = estoqueContent.replace(targetSelectNorm, replacementSelect);
  fs.writeFileSync(estoqueFile, estoqueContent);
  console.log("Successfully updated Bar Stock commercial units rule in estoque/page.js!");
} else {
  console.log("Target select not found in estoque/page.js");
}

// 2. UPDATE app/dashboard/operacao/ingredientes/page.js
const ingFile = 'app/dashboard/operacao/ingredientes/page.js';
let ingContent = fs.readFileSync(ingFile, 'utf8');

const targetIngSelect = `<select value={form.unidade_medida} onChange={event => setForm({ ...form, unidade_medida: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold outline-none focus:border-emerald-500">
                      {UNIDADES_INGREDIENTE.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>`;

const replacementIngSelect = `{(() => {
                      const ehBar = deptUrl === "bar" || form.departamento === "bar";
                      const cat = String(form.categoria || "").toLowerCase();
                      const nome = String(form.nome || "").toLowerCase();
                      const ehFruta = cat.includes("fruta") || cat.includes("horti") || cat.includes("fresco") ||
                                      nome.includes("limão") || nome.includes("laranja") || nome.includes("abacaxi") ||
                                      nome.includes("hortelã") || nome.includes("morango") || nome.includes("maracujá") ||
                                      nome.includes("fruta");
                      let lista = UNIDADES_INGREDIENTE;
                      if (ehBar) {
                        lista = ehFruta
                          ? UNIDADES_INGREDIENTE.filter(u => ["un", "g", "kg"].includes(u.value))
                          : UNIDADES_INGREDIENTE.filter(u => ["garrafa", "lata", "barril", "ml", "l", "un"].includes(u.value));
                      }
                      return (
                        <select value={form.unidade_medida} onChange={event => setForm({ ...form, unidade_medida: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold outline-none focus:border-emerald-500">
                          {lista.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      );
                    })()}`;

ingContent = ingContent.replace(/\r\n/g, '\n');
const targetIngSelectNorm = targetIngSelect.replace(/\r\n/g, '\n');
if (ingContent.includes(targetIngSelectNorm)) {
  ingContent = ingContent.replace(targetIngSelectNorm, replacementIngSelect);
  fs.writeFileSync(ingFile, ingContent);
  console.log("Successfully updated Bar Stock units rule in ingredientes/page.js!");
} else {
  console.log("Ingredientes target select not found");
}
