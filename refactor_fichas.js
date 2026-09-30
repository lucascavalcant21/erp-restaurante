const fs = require('fs');

let content = fs.readFileSync('app/dashboard/operacao/fichas/page.js', 'utf-8');

// I will look for the exact grid rendering block
const searchStr = `                   {fichasFiltradas.map(f => (
                     <div
                       key={f.id}
                       draggable={busca.trim() === ""}
                       onDragStart={() => setDragId(f.id)}
                       onDragOver={e => { if (dragId) e.preventDefault(); }}
                       onDrop={() => reordenar(dragId, f.id)}
                       className={\`bg-card rounded-3xl border p-5 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between \${dragId === f.id ? 'opacity-50' : ''} \${selecionadas.includes(f.id) ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/90'}\`}
                     >`;

// Replace the inside of the card up to the closing </div> of the map
// I will just construct a new card component design.

// Since the file is huge and I don't want to mess up the map closing,
// I will regex replace the content of the `fichasFiltradas.map` return.
// Let's use a more robust way: Find the block of code!
