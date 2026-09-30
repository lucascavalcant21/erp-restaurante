const fs = require('fs');

// 1. Modifica o HefistoCopilotPanel.js
let copilot = fs.readFileSync('app/components/navigation/HefistoCopilotPanel.js', 'utf-8');

// Adiciona o event listener
copilot = copilot.replace(
  '  useEffect(() => {',
  `  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-hefisto-copilot', handleOpen);
    return () => window.removeEventListener('open-hefisto-copilot', handleOpen);
  }, []);

  useEffect(() => {`
);

// Remove o botão flutuante e retorna null
copilot = copilot.replace(
  /if \(!isOpen\) \{\s*return \([\s\S]*?<\/button>\s*\);\s*\}/,
  'if (!isOpen) return null;'
);

fs.writeFileSync('app/components/navigation/HefistoCopilotPanel.js', copilot, 'utf-8');

// 2. Modifica o TopNavigation.js para disparar o evento
let topNav = fs.readFileSync('app/components/layout/TopNavigation.js', 'utf-8');

topNav = topNav.replace(
  /<button className="relative w-10 h-10 rounded-xl bg-\[#0B1926\] border border-\[#102031\] flex items-center justify-center text-emerald-400 hover:bg-\[#102031\] hover:border-emerald-500\/30 transition-all group" title="Héfisto Copiloto">/,
  '<button onClick={() => window.dispatchEvent(new CustomEvent("open-hefisto-copilot"))} className="relative w-10 h-10 rounded-xl bg-[#0B1926] border border-[#102031] flex items-center justify-center text-emerald-400 hover:bg-[#102031] hover:border-emerald-500/30 transition-all group" title="Héfisto Copiloto">'
);

fs.writeFileSync('app/components/layout/TopNavigation.js', topNav, 'utf-8');

console.log("Copilot icon fixed!");
