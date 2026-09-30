const fs = require('fs');
let c = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

// 1. Add refs and useEffect
c = c.replace(
  'const [menuOpen, setMenuOpen] = useState(false);',
  `const [menuOpen, setMenuOpen] = useState(false);\n  const [notifOpen, setNotifOpen] = useState(false);\n  const menuRef = useRef(null);\n  const notifRef = useRef(null);\n  useEffect(() => {\n    function handleClickOutside(event) {\n      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);\n      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);\n    }\n    document.addEventListener("mousedown", handleClickOutside);\n    return () => document.removeEventListener("mousedown", handleClickOutside);\n  }, []);`
);
c = c.replace(
  'import { useState, useEffect } from "react";',
  'import { useState, useEffect, useRef } from "react";'
);

// 2. Wrap avatar in ref
c = c.replace(
  '<div className="relative">',
  '<div className="relative" ref={menuRef}>'
);

// 3. Wrap bell in ref and add dropdown
const bellHtml = `
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className="relative w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all group" title="Notificações">
              <Bell size={18} className="group-hover:scale-110 transition-transform" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 py-4 px-4 z-50 animate-in fade-in slide-in-from-top-2 flex flex-col items-center justify-center text-center gap-2">
                <Bell size={24} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Nenhuma notificação no momento</p>
              </div>
            )}
          </div>
`;

c = c.replace(
  '<button className="relative w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all group" title="Notificações">\n            <Bell size={18} className="group-hover:scale-110 transition-transform" />\n            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full"></span>\n          </button>',
  bellHtml
);

fs.writeFileSync('app/components/layout/TopNavigation.js', c);
console.log('Fixed TopNav dropdowns');
