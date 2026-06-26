const fs = require('fs');
const path = require('path');

const BASE = path.join('C:\\Users\\lucas\\OneDrive\\Área de Trabalho\\Meu ERP\\Meu ERP');

const files = [
  'app\\dashboard\\checklists\\page.js',
  'app\\dashboard\\gestao\\documentos\\page.js',
  'app\\dashboard\\kds\\page.js',
  'app\\dashboard\\operacao\\cardapio\\page.js',
  'app\\dashboard\\operacao\\compras\\page.js',
  'app\\dashboard\\operacao\\embalagens\\page.js',
  'app\\dashboard\\operacao\\engenharia\\page.js',
  'app\\dashboard\\operacao\\estoque\\page.js',
  'app\\dashboard\\operacao\\fichas\\page.js',
  'app\\dashboard\\operacao\\ingredientes\\page.js',
  'app\\dashboard\\operacao\\producao\\page.js',
  'app\\dashboard\\operacao\\produtos\\page.js',
  'app\\dashboard\\rede\\page.js',
  'app\\dashboard\\rh\\contrato\\[id]\\page.js',
  'app\\dashboard\\rh\\espelho\\[id]\\page.js',
  'app\\dashboard\\rh\\fechamento\\page.js',
  'app\\dashboard\\rh\\recrutamento\\page.js',
  'app\\dashboard\\salao\\online\\page.js',
  'app\\dashboard\\salao\\treinamento\\page.js',
];

// Calcula o caminho relativo para ERPContext conforme profundidade
function getERPImportPath(filePath) {
  const parts = filePath.replace('app\\dashboard\\', '').split('\\');
  const depth = parts.length - 1;
  let prefix = '';
  for (let i = 0; i <= depth; i++) prefix += '../';
  return prefix + 'context/ERPContext';
}

let changed = 0;
files.forEach(rel => {
  const full = path.join(BASE, rel);
  if (!fs.existsSync(full)) {
    console.log(`[SKIP] Não existe: ${full}`);
    return;
  }
  let content = fs.readFileSync(full, 'utf8');

  if (!content.includes('router.back()')) {
    console.log(`[SKIP] Sem router.back(): ${rel}`);
    return;
  }

  const importPath = getERPImportPath(rel);

  // 1. Garante que useERP está importado
  if (!content.includes('useERP')) {
    // Tenta adicionar junto com outro import do context
    if (content.includes(importPath)) {
      content = content.replace(
        new RegExp(`from "${importPath.replace(/\//g,'\\/')}"`, 'g'),
        `from "${importPath}"`
      );
      // Adiciona useERP ao import existente
      content = content.replace(
        new RegExp(`import \\{([^}]+)\\} from "${importPath.replace(/\//g,'\\/')}"`, 'g'),
        (m, imports) => `import {${imports}, useERP } from "${importPath}"`
      );
    } else {
      // Adiciona novo import logo após a primeira linha "use client"
      content = content.replace(
        /("use client";\s*\n)/,
        `$1import { useERP } from "${importPath}";\n`
      );
    }
    console.log(`[IMPORT] Adicionado useERP em: ${rel}`);
  }

  // 2. Garante que abrirMenu está desestruturado no componente
  // Verifica se já usa useERP()
  if (!content.includes('abrirMenu')) {
    // Adiciona const { abrirMenu } = useERP(); logo após o início do componente principal
    // Tenta adicionar após a primeira declaração de const router = useRouter()
    if (content.includes('const router = useRouter()')) {
      content = content.replace(
        'const router = useRouter();',
        'const router = useRouter();\n  const { abrirMenu } = useERP();'
      );
    } else if (content.includes('useRouter()')) {
      content = content.replace(
        /const (\w+) = useRouter\(\);/,
        `const $1 = useRouter();\n  const { abrirMenu } = useERP();`
      );
    } else {
      // Adiciona após "use client"
      // Procura pelo primeiro export default function ou export function
      content = content.replace(
        /(export default function \w+\([^)]*\)\s*\{)/,
        `$1\n  const { abrirMenu } = useERP();`
      );
    }
    console.log(`[DESEST] Adicionado abrirMenu em: ${rel}`);
  }

  // 3. Substitui onClick={() => router.back()} por onClick={() => abrirMenu()}
  const original = content;
  content = content.replace(/onClick=\{[()=>\s]*router\.back\(\)[)\s]*\}/g, 'onClick={() => abrirMenu()}');
  // Também substitui padrão sem arrow function
  content = content.replace(/onClick=\{router\.back\}/g, 'onClick={abrirMenu}');
  
  if (content === original) {
    console.log(`[SKIP] Sem mudanças em: ${rel}`);
    return;
  }

  fs.writeFileSync(full, content, 'utf8');
  changed++;
  console.log(`[OK] Atualizado: ${rel}`);
});

console.log(`\nTotal atualizado: ${changed} arquivos`);
