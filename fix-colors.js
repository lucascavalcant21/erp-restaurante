const fs = require('fs');

function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (let i in files) {
    const name = dir + '/' + files[i];
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files_);
    } else {
      if (name.endsWith('page.js') || name.endsWith('layout.js') || name.endsWith('ui.js')) files_.push(name);
    }
  }
  return files_;
}

// Também incluindo componentes
let files = getFiles('app/dashboard');
try {
  files = files.concat(getFiles('app/components'));
} catch(e) {}

const colors = ['orange', 'blue', 'indigo', 'amber', 'fuchsia', 'cyan', 'red', 'purple', 'green', 'teal', 'yellow', 'pink', 'rose'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  colors.forEach(c => {
    // Substituições para tons claros (fundos decorativos de icones) -> viram slate (neutro)
    content = content.replace(new RegExp(`bg-${c}-50\\b`, 'g'), 'bg-slate-50');
    content = content.replace(new RegExp(`bg-${c}-100\\b`, 'g'), 'bg-slate-100');
    content = content.replace(new RegExp(`bg-${c}-200\\b`, 'g'), 'bg-slate-200');
    
    // Substituições para tons médios/escuros -> viram emerald (nossa nova cor primária global)
    // Se o usuário quisesse tudo cinza, eu mudaria para slate-900.
    // Mas ele quer manter os botões na "cor padrão", que estabelecemos como Emerald (verde escuro).
    // Vou forçar todos os botões coloridos aleatórios a usarem emerald.
    content = content.replace(new RegExp(`bg-${c}-500\\b`, 'g'), 'bg-emerald-500');
    content = content.replace(new RegExp(`bg-${c}-600\\b`, 'g'), 'bg-emerald-600');
    content = content.replace(new RegExp(`bg-${c}-700\\b`, 'g'), 'bg-emerald-700');
    content = content.replace(new RegExp(`bg-${c}-800\\b`, 'g'), 'bg-emerald-800');

    // Textos coloridos (ex: icones) -> viram text-slate-800 ou text-emerald-600 dependendo da força
    content = content.replace(new RegExp(`text-${c}-400\\b`, 'g'), 'text-slate-500');
    content = content.replace(new RegExp(`text-${c}-500\\b`, 'g'), 'text-slate-600');
    // Para text-600 que costumam ser textos em botões ou links, viram emerald-600 (link/acao) ou slate-800 se for texto comum
    content = content.replace(new RegExp(`text-${c}-600\\b`, 'g'), 'text-emerald-600');
    content = content.replace(new RegExp(`text-${c}-700\\b`, 'g'), 'text-emerald-700');
    
    // Bordas
    content = content.replace(new RegExp(`border-${c}-100\\b`, 'g'), 'border-slate-200');
    content = content.replace(new RegExp(`border-${c}-200\\b`, 'g'), 'border-slate-200');
    content = content.replace(new RegExp(`border-${c}-300\\b`, 'g'), 'border-emerald-300');
    content = content.replace(new RegExp(`border-${c}-400\\b`, 'g'), 'border-emerald-400');
    content = content.replace(new RegExp(`border-${c}-500\\b`, 'g'), 'border-emerald-500');
    content = content.replace(new RegExp(`border-${c}-600\\b`, 'g'), 'border-emerald-600');
    
    // Focus borders/rings
    content = content.replace(new RegExp(`focus:border-${c}-500\\b`, 'g'), 'focus:border-emerald-500');
    content = content.replace(new RegExp(`focus:ring-${c}-500\\b`, 'g'), 'focus:ring-emerald-500');

    // Hover bg (geralmente claros ou escuros)
    content = content.replace(new RegExp(`hover:bg-${c}-50\\b`, 'g'), 'hover:bg-slate-100');
    content = content.replace(new RegExp(`group-hover:bg-${c}-50\\b`, 'g'), 'group-hover:bg-slate-100');
    content = content.replace(new RegExp(`hover:bg-${c}-600\\b`, 'g'), 'hover:bg-emerald-600');
    content = content.replace(new RegExp(`hover:bg-${c}-700\\b`, 'g'), 'hover:bg-emerald-700');
    
    // Hover text
    content = content.replace(new RegExp(`hover:text-${c}-600\\b`, 'g'), 'hover:text-emerald-600');
    content = content.replace(new RegExp(`group-hover:text-${c}-600\\b`, 'g'), 'group-hover:text-emerald-600');
    
    // Hover border
    content = content.replace(new RegExp(`hover:border-${c}-300\\b`, 'g'), 'hover:border-slate-400');
    
    // Shadows
    content = content.replace(new RegExp(`shadow-${c}-600/20\\b`, 'g'), 'shadow-emerald-600/20');
  });

  // O usuário informou que o fundo dos icones do header (que acabei de colocar emerald) ainda estava confuso.
  // Vou garantir que nos headers os icones sejam bg-slate-100 text-slate-800
  content = content.replace(/bg-emerald-100 text-emerald-600/g, 'bg-slate-100 text-slate-800');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Cores Corrigidas: ' + file);
  }
});
