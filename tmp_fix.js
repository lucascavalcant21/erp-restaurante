const fs=require('fs'); 
let c = fs.readFileSync('app/dashboard/rh/page.js', 'utf8'); 
const start = c.indexOf('         <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">'); 
const end = c.indexOf('      {/* ── ESCALA DE TRABALHO ────────────────────────────────────────── */}'); 
const novoTexto = `         {abaAtiva !== "Geral" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
               {[["Geral", "← Voltar ao Painel"], ["Cargos & Carreiras", "Cargos & Carreiras"], ["Banco de Talentos", "Banco de Talentos"]].map(([id, rot]) => (
                  <button key={id} onClick={() => setAbaAtiva(id)}
                     className={\`px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shrink-0 \${abaAtiva === id ? "bg-accent text-accent-fg shadow-lg shadow-emerald-600/20" : "bg-card text-fg border border-line hover:bg-white"}\`}>
                     {rot}
                  </button>
               ))}
            </div>
         )}

         {abaAtiva === "Cargos & Carreiras" ? (
            <PlanoCargos
               cargos={cargos}
               funcionarios={funcionarios}
               unidadeAtiva={unidadeAtiva}
               unidadeInfo={unidadeInfo}
               onRecarregar={() => carregar(true)}
            />
         ) : abaAtiva === "Banco de Talentos" ? (
            <BancoTalentos unidadeAtiva={unidadeAtiva} />
         ) : null}
      </div>
`;
fs.writeFileSync('app/dashboard/rh/page.js', c.substring(0, start) + novoTexto + c.substring(end));
