const fs = require('fs');
let c = fs.readFileSync('app/components/EtiquetasRapidas.js', 'utf-8');

const modalHtml = `
      {modalSalvarLista && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="mb-4 text-lg font-black text-slate-900">Salvar lista de etiquetas</h3>
            <p className="mb-4 text-sm font-medium text-slate-600">Dê um nome para esta lista para poder imprimi-la novamente no futuro.</p>
            <input 
              autoFocus
              type="text" 
              value={nomeNovaLista} 
              onChange={e => setNomeNovaLista(e.target.value)} 
              className="mb-6 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Ex: Produção Manhã"
            />
            <div className="flex items-center gap-3">
              <button onClick={() => setModalSalvarLista(false)} className="flex-1 rounded-xl bg-slate-100 p-3 font-bold text-slate-700 hover:bg-slate-200">Cancelar</button>
              <button onClick={confirmarSalvarLista} className="flex-1 rounded-xl bg-emerald-600 p-3 font-black text-white shadow-md hover:bg-emerald-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
`;

c = c.replace(
  '<div id="etiquetas-rapidas-print"',
  modalHtml + '\n      <div id="etiquetas-rapidas-print"'
);

fs.writeFileSync('app/components/EtiquetasRapidas.js', c);
console.log('Fixed Etiquetas modal');
