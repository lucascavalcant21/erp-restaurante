const fs = require('fs');

let rh = fs.readFileSync('app/dashboard/rh/page.js', 'utf-8');
// Fix line 2063: "               </>\r\n         </div>"
rh = rh.replace(/<\/>\r?\n\s*<\/div>/g, '</>\n            )}\n         </div>');
// Fix the end of the file: remove the extra )}
rh = rh.replace(/\)\}\r?\n\r?\n\s*<\/>\r?\n\s*\)\}\r?\n\s*<\/div>/g, ')}\n\n        </>\n    </div>');
fs.writeFileSync('app/dashboard/rh/page.js', rh);

let estoque = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8');
estoque = estoque.replace(/<\/>\r?\n\s*<\/div>/g, '</>\n            )}\n          </div>');
estoque = estoque.replace(/<\/>\r?\n\s*\)\}\r?\n\s*<\/>\r?\n\s*\)\}\r?\n\s*<\/main>/g, '</>\n        )}\n        </>\n      </main>');
fs.writeFileSync('app/dashboard/operacao/estoque/page.js', estoque);

console.log('Fixed using regex with \r?\n');
