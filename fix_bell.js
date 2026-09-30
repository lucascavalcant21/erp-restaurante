const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// Add Bell to imports
c = c.replace(
  'import { Search, Sparkles, User, Settings, LogOut, ChevronDown, Menu, X, ChevronRight } from "lucide-react";',
  'import { Search, Sparkles, User, Settings, LogOut, ChevronDown, Menu, X, ChevronRight, Bell } from "lucide-react";'
);

// Replace the Sparkles button with Bell
c = c.replace(
  '<button onClick={() => window.dispatchEvent(new CustomEvent("open-hefisto-copilot"))} className="relative w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 hover:bg-zinc-800 hover:border-emerald-500/30 transition-all group" title="Héfisto Copiloto">\n            <Sparkles size={18} className="group-hover:scale-110 transition-transform" />\n            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-zinc-950 rounded-full"></span>\n          </button>',
  '<button className="relative w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all group" title="Notificações">\n            <Bell size={18} className="group-hover:scale-110 transition-transform" />\n            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full"></span>\n          </button>'
);

fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed TopNavigation bell');
