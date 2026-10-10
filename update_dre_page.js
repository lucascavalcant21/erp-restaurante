const fs = require('fs');
let txt = fs.readFileSync('app/dashboard/financeiro/dre/page.js', 'utf8');

txt = txt.replace(
  'import { carregarBaseDre, cmvDoMes, cmoDoMesRH } from "../../../lib/dre-dados";',
  'import { carregarBaseDre, cmvDoMes, cmoDoMesRH, lancarFechamentoMes } from "../../../lib/dre-dados";'
);

const oldUI = `<p className="text-sm text-slate-600">
                    O faturamento oficial é o diário (vendas − cancelamentos − descontos), o mesmo do CMV %.{" "}
                    <label className="text-xs font-bold text-slate-600">Simular com faturamento (R$)
                      <CampoDecimal value={simFat} onChange={(e) => setSimFat(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                    </label>
                    {calc.cmv.valor === null && (
                      <label className="text-xs font-bold text-slate-600">CMV para simulação (R$)
                        <CampoDecimal value={simCmv} onChange={(e) => setSimCmv(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00"
                          className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500" />
                      </label>
                    )}
                  </p>`;

const newUI = `                  <div className="text-sm text-slate-600 mt-2 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
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
                           const ok = confirm(\`Deseja GRAVAR OFICIALMENTE o faturamento de \${simFat} para \${mes}? Isso irá apagar e reescrever os registros diários deste mês.\`);
                           if (!ok) return;
                           const fat = parseFloat(simFat.replace(",", "."));
                           const tx = simCmv ? parseFloat(simCmv.replace(",", ".")) : 0;
                           const res = await lancarFechamentoMes(unidadeAtiva, mes, fat, tx);
                           if (res.error) alert("Erro: " + res.error);
                           else {
                             alert("Fechamento gravado com sucesso!");
                             window.location.reload();
                           }
                        }}
                        className="h-11 px-4 bg-violet-600 text-white text-xs font-bold uppercase rounded-xl hover:bg-violet-700 transition-colors">
                        Gravar Fechamento Real
                      </button>
                    </div>
                  </div>`;

txt = txt.replace(oldUI, newUI);

// Remove "simulando" logic since it's going to be a real write, but keep it for immediate visual update before saving?
// Wait, simCmv is now used for Taxa de Servico instead of CMV. Let's fix that.
txt = txt.replace(
  'const simulacao = { faturamento: lerValor(simFat), cmvPct: lerValor(simCmv) };',
  'const simulacao = { faturamento: lerValor(simFat), taxaServico: lerValor(simCmv) };'
);

fs.writeFileSync('app/dashboard/financeiro/dre/page.js', txt);
