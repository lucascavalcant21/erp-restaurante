const fs = require('fs');

function lightMode(file) {
  let c = fs.readFileSync(file, 'utf-8');
  c = c.replace(/border-slate-800/g, 'border-slate-200');
  c = c.replace(/bg-slate-900/g, 'bg-white');
  c = c.replace(/bg-slate-800\/50/g, 'bg-slate-50');
  c = c.replace(/bg-slate-800/g, 'bg-slate-50');
  c = c.replace(/text-slate-100/g, 'text-slate-900');
  c = c.replace(/text-slate-300/g, 'text-slate-600');
  c = c.replace(/text-slate-400/g, 'text-slate-500');
  c = c.replace(/text-emerald-400/g, 'text-emerald-600');
  c = c.replace(/text-amber-400/g, 'text-amber-600');
  c = c.replace(/text-red-400/g, 'text-red-600');
  c = c.replace(/bg-emerald-500\/10/g, 'bg-emerald-100');
  c = c.replace(/border-emerald-500\/20/g, 'border-emerald-200');
  
  c = c.replace(/bg-\[\#070F1E\]/g, 'bg-slate-50');
  fs.writeFileSync(file, c);
}

lightMode('app/components/navigation/HubPrimitives.js');
lightMode('app/components/navigation/RhHub.js');

console.log('Fixed Hub themes');
