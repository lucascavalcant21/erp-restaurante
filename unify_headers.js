const fs = require('fs');

function unifyHeader(file, title, subtitle, iconHtml) {
  let c = fs.readFileSync(file, 'utf-8');
  c = c.replace(
    /<header className="flex flex-col md:flex-row md:items-end justify-between gap-4( mb-8 shrink-0)?( mb-8)?">[\s\S]*?<\/div>\s*<\/header>/m,
    `<div className="pt-4 sm:pt-5 pb-5 px-4 sm:px-6 max-w-7xl mx-auto">
             <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-strong flex items-center justify-center border border-emerald-100/80 shadow-sm shrink-0">
                     ${iconHtml}
                  </div>
                  <div>
                     <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-fg">${title}</h1>
                     <p className="text-xs font-semibold text-fg mt-0.5">${subtitle}</p>
                  </div>
                </div>
                {/* Acoes ficarao aqui */}
             </div>
          </div>`
  );
  fs.writeFileSync(file, c);
}

console.log('Use regex to fix the headers with the buttons');
