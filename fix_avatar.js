const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

c = c.replace(
  '<div className="hidden sm:block text-left">\n                <div className="text-xs font-bold text-white truncate max-w-[100px]">{sessao?.nome || "Administrador"}</div>\n                <div className="text-[10px] text-zinc-400 truncate max-w-[100px]">{sessao?.cargo || "Gestão"}</div>\n              </div>\n              <ChevronDown size={14} className="text-zinc-400 hidden sm:block" />',
  ''
);

// Also change to just one letter
c = c.replace(
  '{sessao?.nome?.substring(0,2).toUpperCase() || <User size={16}/>}',
  '{sessao?.nome?.substring(0,1).toUpperCase() || <User size={16}/>}'
);

fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed TopNavigation avatar');
