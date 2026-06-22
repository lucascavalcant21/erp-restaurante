const fs = require('fs');
const code = fs.readFileSync('app/dashboard/layout.js', 'utf8');

// Extrai o objeto Ic inteiro
const icStr = code.substring(code.indexOf('const Ic = {'), code.indexOf('};', code.indexOf('const Ic = {')) + 2);

// Extrai MENU_GROUPS inteiro
const menuStr = code.substring(code.indexOf('const MENU_GROUPS = ['), code.indexOf('];', code.indexOf('const MENU_GROUPS = [')) + 2);

const fullCode = `
const React = { createElement: () => {} };
${icStr}
${menuStr}

MENU_GROUPS.forEach(g => {
  g.items.forEach(i => {
    if (typeof i.Icon !== 'function') {
      console.log('ERROR ON', i.label);
    } else {
      console.log('OK', i.label);
    }
  });
});
`;

fs.writeFileSync('test_icons.js', fullCode);
