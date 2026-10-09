const fs = require('fs');
let text = fs.readFileSync('app/dashboard/rh/page.js', 'utf-8');

// 1. Remove the tabs
text = text.replace(/\[\["Fixo", "Equipe Fixa"\], \["Cargos & Carreiras", "Cargos & Carreiras"\], \["Ex-funcionários", "Ex-funcionários"\]\]/g, '[["Cargos & Carreiras", "Cargos & Carreiras"]]');

// 2. Change Ações Rápidas
text = text.replace(/\{ icon: LogOut, rot: "Ex-funcionários", on: \(\) => setAbaAtiva\("Ex-funcionários"\) \}/g, '{ icon: LogOut, rot: "Ex-funcionários", on: () => router.push(\'/dashboard/rh?aba=quadro\') }');

// 3. Find block
let afterSearch = '<div className="bg-card p-4 rounded-t-3xl border border-line border-b-0 flex items-center gap-3">';
let idx1 = text.indexOf(afterSearch);
if (idx1 !== -1) {
    let startIdx = text.lastIndexOf(') : (', idx1);
    
    // Use regex to match \r?\n
    let endMatch = text.substring(startIdx).match(/<\/>\r?\n\s*\)}/);
    if (startIdx !== -1 && endMatch) {
        let toReplace = text.substring(startIdx, startIdx + endMatch.index + endMatch[0].length);
        text = text.replace(toReplace, '');
        fs.writeFileSync('app/dashboard/rh/page.js', text);
        console.log('Success! Removed big block.');
    } else {
        console.log('Could not find end tag');
    }
} else {
    console.log('Could not find start block');
}
