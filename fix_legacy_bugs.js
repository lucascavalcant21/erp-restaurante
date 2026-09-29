const fs = require('fs');

let p = fs.readFileSync('app/dashboard/operacao/orcamento/page.js', 'utf-8');

// 1. O botão Remover Ficha:
// Atual: <button onClick={() => removeItem(l.produto_id)} className="p-2 text-subtle hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"><Trash2 size={16}/></button>
p = p.replace(
  /<button onClick=\{\(\) => removeItem\(l\.produto_id\)\} className="p-2 text-subtle hover:text-red-400 hover:bg-red-500\/10 rounded-lg transition-all shrink-0"><Trash2 size=\{16\}\/><\/button>/g,
  `<button onClick={() => { if(confirm('Remover ' + l.nome + '?')) removeItem(l.produto_id); }} className="px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-all shrink-0 font-bold flex items-center gap-2"><Trash2 size={16}/> Excluir Ficha</button>`
);

// 2. Separar Itens do Buffet por Categoria (Bar vs Cozinha).
// O loop atual: {linhas.map((l, idxL) => (
// Vou injetar cabeçalhos antes do item se a categoria mudar.
const loopRegex = /\{linhas\.map\(\(l, idxL\) => \(\s*(<div key=\{l\.produto_id\})/g;
// Precisamos garantir que isso não quebre o React.
// Vamos transformar o map em: {linhas.map((l, idxL) => { const prev = idxL > 0 ? linhas[idxL-1] : null; const isNewCat = !prev || prev.categoria !== l.categoria; return (<Fragment key={l.produto_id}>{isNewCat && <h3 className="mt-8 mb-4 text-xl font-black text-slate-800">{l.categoria}</h3>} ... ); })}
p = p.replace(
  /\{linhas\.map\(\(l, idxL\) => \(\s*<div key=\{l\.produto_id\}/g,
  `{linhas.map((l, idxL) => { 
    const prev = idxL > 0 ? linhas[idxL-1] : null; 
    const catAtual = l.categoria?.toLowerCase()?.includes('bar') || l.categoria?.toLowerCase()?.includes('bebida') ? 'BAR / BEBIDAS' : 'COZINHA / COMIDAS';
    const catPrev = prev ? (prev.categoria?.toLowerCase()?.includes('bar') || prev.categoria?.toLowerCase()?.includes('bebida') ? 'BAR / BEBIDAS' : 'COZINHA / COMIDAS') : null;
    const isNewCat = catAtual !== catPrev;
    return (
      <div key={l.produto_id + "_wrapper"} className="flex flex-col gap-3">
        {isNewCat && <div className="mt-6 mb-2 border-b-2 border-slate-800 pb-2"><h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">{catAtual}</h3></div>}
        <div key={l.produto_id}`
);
// Fechar a div do wrapper no final do loop.
// Fica difícil fazer isso com regex, mas as divs terminam em:
// </div>
// ))}
p = p.replace(/<\/div>\s*\)\)\}/g, `</div>\n      </div>\n    ))}`);


// 3. Utensílios separados.
// Atual:
// <div className="space-y-2">
//    <label className="text-3xs font-bold text-muted uppercase tracking-widest flex items-center gap-1"><ChefHat size={12}/> Utensílios / equipamentos que vou levar</label>
//    <textarea value={evento.utensilios || ""} onChange={e=>setEvento({utensilios:e.target.value})} placeholder="Ex: 2 rechauds, panela de 20L..." className="w-full bg-slate-50 border border-line rounded-xl p-4 font-medium text-sm outline-none focus:border-emerald-500 min-h-[80px]"/>
// </div>
// Mudança: vamos dividir o evento.utensilios em JSON, ou apenas criar 2 textareas e concatenar no string.
// Se eu concatenar: "COZINHA: xxx | BAR: yyy". Melhor interceptar o onChange.
const utensiliosRegex = /<div className="space-y-2">\s*<label className="text-3xs font-bold text-muted uppercase tracking-widest flex items-center gap-1"><ChefHat size=\{12\}\/> Utensílios \/ equipamentos que vou levar<\/label>\s*<textarea value=\{evento\.utensilios \|\| ""\} onChange=\{e=>setEvento\(\{utensilios:e\.target\.value\}\)\} placeholder="Ex: 2 rechauds, panela de 20L, tábuas, réchaud de banho-maria, garfos de servir, bandejas..." className="w-full bg-slate-50 border border-line rounded-xl p-4 font-medium text-sm outline-none focus:border-emerald-500 min-h-\[80px\]"\/>\s*<\/div>/g;

const novosUtensilios = `
                  <div className="space-y-4">
                     <label className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><ChefHat size={16}/> Organização de Utensílios / Equipamentos</label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-emerald-700 uppercase">COZINHA (Panelas, Rechauds, etc)</label>
                           <textarea value={(evento.utensilios || "").split("||BAR||")[0] || ""} onChange={e => {
                             const bar = (evento.utensilios || "").split("||BAR||")[1] || "";
                             setEvento({utensilios: e.target.value + "||BAR||" + bar});
                           }} placeholder="Ex: 2 rechauds, panela 20L..." className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 font-medium text-sm outline-none focus:border-emerald-500 min-h-[100px]"/>
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-sky-700 uppercase">BAR (Copos, Gelo, etc)</label>
                           <textarea value={(evento.utensilios || "").split("||BAR||")[1] || ""} onChange={e => {
                             const coz = (evento.utensilios || "").split("||BAR||")[0] || "";
                             setEvento({utensilios: coz + "||BAR||" + e.target.value});
                           }} placeholder="Ex: Taças, 10kg gelo, dosadores..." className="w-full bg-sky-50/50 border border-sky-100 rounded-xl p-4 font-medium text-sm outline-none focus:border-sky-500 min-h-[100px]"/>
                        </div>
                     </div>
                  </div>
`;

p = p.replace(utensiliosRegex, novosUtensilios);

// Para garantir que a visualização do print (Programação) mostre separado:
// Na programação impressa, eles leem \`evento.utensilios\`.
const printRegex = /\{evento\.utensilios && \(\s*<div className="box">\s*<h3>Utensílios \/ Equipamentos<\/h3>\s*<p className="ws">\{evento\.utensilios\}<\/p>\s*<\/div>\s*\)\}/g;

const novoPrint = `
               {evento.utensilios && (
                  <div className="box">
                     <h3>Utensílios / Equipamentos</h3>
                     <div style={{display: 'flex', gap: '20px'}}>
                        <div style={{flex: 1}}>
                           <strong>COZINHA:</strong>
                           <p className="ws">{evento.utensilios.split("||BAR||")[0] || "Nenhum informado"}</p>
                        </div>
                        <div style={{flex: 1}}>
                           <strong>BAR:</strong>
                           <p className="ws">{evento.utensilios.split("||BAR||")[1] || "Nenhum informado"}</p>
                        </div>
                     </div>
                  </div>
               )}
`;

p = p.replace(printRegex, novoPrint);

fs.writeFileSync('app/dashboard/operacao/orcamento/page.js', p, 'utf-8');
console.log('Legacy fixes applied!');
