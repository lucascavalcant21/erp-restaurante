const fs = require('fs');
let txt = fs.readFileSync('app/dashboard/financeiro/dre/page.js', 'utf8');

const oldUI = `<p className="text-sm text-slate-600">
                    O faturamento oficial é o diário (vendas − cancelamentos − descontos), o mesmo do CMV %.{" "}
                    <Link href="/dashboard/operacao/estoque/cmv" className="inline-flex items-center font-bold text-emerald-700 hover:underline">Lançar em Estoque → CMV real <ChevronRight size={14} /></Link>
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))]">
                    <label className="text-xs font-bold text-slate-600">Simular com faturamento (R$)
                      <CampoDecimal value={simFat} onChange={(e) => setSimFat(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                    </label>
                    {calc.cmv.valor === null && (
                      <label className="text-xs font-bold text-slate-600">CMV para simulação (% do fat.)
                        <div className="relative mt-1 flex items-center">
                          <input inputMode="decimal" value={simCmv} onChange={(e) => setSimCmv(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="ex.: 32"
                            className="h-11 w-full rounded-xl border border-slate-300 pl-3 pr-8 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                          <span className="pointer-events-none absolute right-3 text-sm font-bold text-slate-500">%</span>
                        </div>
                      </label>
                    )}
                  </div>`;

const newUI = `                  <div className="text-sm text-slate-600 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p>O faturamento oficial é lido das vendas diárias (Caixa/PDV). Se você não usa caixa diário, pode salvar o fechamento do mês abaixo para gravar a realidade da sua empresa e gerar o histórico.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <label className="text-xs font-bold text-slate-600">Faturamento Oficial do Mês (R$)
                        <CampoDecimal value={simFat} onChange={(e) => setSimFat(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00"
                          className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                      </label>
                      <label className="text-xs font-bold text-slate-600">Taxa de Serviço Repassada (R$)
                        <CampoDecimal value={simCmv} onChange={(e) => setSimCmv(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00"
                          className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                      </label>
                      <button 
                        onClick={async () => {
                           if (!simFat || parseFloat(simFat.replace(",", ".")) <= 0) return alert("Preencha o faturamento para gravar.");
                           const ok = confirm(\`Deseja GRAVAR OFICIALMENTE o faturamento de R$ \${simFat} para \${mes}? Isso irá reescrever os registros diários deste mês.\`);
                           if (!ok) return;
                           const fat = parseFloat(simFat.replace(/\\./g, "").replace(",", "."));
                           const tx = simCmv ? parseFloat(simCmv.replace(/\\./g, "").replace(",", ".")) : 0;
                           const res = await lancarFechamentoMes(unidadeAtiva, mes, fat, tx);
                           if (res.error) alert("Erro: " + res.error);
                           else {
                             alert("Fechamento gravado com sucesso! O DRE será recarregado.");
                             window.location.reload();
                           }
                        }}
                        className="h-11 px-4 bg-violet-600 text-white text-xs font-bold uppercase rounded-xl hover:bg-violet-700 transition-colors">
                        Gravar Fechamento
                      </button>
                    </div>
                  </div>`;

txt = txt.replace(oldUI, newUI);
fs.writeFileSync('app/dashboard/financeiro/dre/page.js', txt);
