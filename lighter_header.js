const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

c = c.replace(/bg-zinc-950/g, 'bg-slate-900');
c = c.replace(/border-zinc-900/g, 'border-slate-800');
c = c.replace(/bg-zinc-900/g, 'bg-slate-800');
c = c.replace(/border-zinc-800/g, 'border-slate-700');
c = c.replace(/bg-zinc-800/g, 'bg-slate-700');
c = c.replace(/border-zinc-700/g, 'border-slate-600');
c = c.replace(/text-zinc-400/g, 'text-slate-400');
c = c.replace(/text-zinc-500/g, 'text-slate-500');

// Fix dropdown background
c = c.replace(
  'absolute top-full left-0 mt-0 w-64 bg-slate-800 border border-slate-700',
  'absolute top-full left-0 mt-0 w-64 bg-slate-900 border border-slate-800'
);

fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed TopNavigation colors');
