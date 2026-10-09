const fs = require('fs');
let txt = fs.readFileSync('app/dashboard/rh/page.js', 'utf8');

const oldUI = `<label className="text-3xs font-bold text-fg uppercase block mb-1">Qtd Dias Afastado</label>
                                       <input type="number" min="1" max="60" value={atestedoForm.dias} onChange={e=>setAtestadoForm({...atestedoForm, dias: e.target.value})} className="w-full p-2.5 bg-card border border-line rounded-xl font-bold text-slate-800 text-xs outline-none focus:border-cyan-500"/>`;

const newUI = `<label className="text-3xs font-bold text-fg uppercase block mb-1">Qtd Dias Afastado</label>
                                       <input type="number" min="1" max="60" value={atestedoForm.dias} onChange={e=>setAtestadoForm({...atestedoForm, dias: e.target.value})} disabled={atestedoForm.parcial} className="w-full p-2.5 bg-card border border-line rounded-xl font-bold text-slate-800 text-xs outline-none focus:border-cyan-500 disabled:opacity-50"/>
                                    </div>
                                    <div className="col-span-1 sm:col-span-3 flex items-start gap-2 mt-2">
                                       <input type="checkbox" id="atestado_parcial" checked={atestedoForm.parcial} onChange={e=>setAtestadoForm({...atestedoForm, parcial: e.target.checked, dias: e.target.checked ? "1" : atestedoForm.dias})} className="w-4 h-4 mt-0.5 accent-cyan-600 rounded cursor-pointer shrink-0" />
                                       <label htmlFor="atestado_parcial" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                                          Atestado Parcial (Atestado de Horas)
                                          <span className="block text-3xs text-subtle font-medium mt-0.5">Use quando o funcionário trabalhou uma parte do dia (bateu entrada e/ou intervalo) e foi embora com atestado. Ele abona faltas parciais/saída antecipada e preserva a presença.</span>
                                       </label>`;

txt = txt.replace(oldUI, newUI);

fs.writeFileSync('app/dashboard/rh/page.js', txt);
