const fs = require('fs');

let rh = fs.readFileSync('app/dashboard/rh/page.js', 'utf-8');
// restore line 2062
rh = rh.replace(
  '               </button>\n               </>\n         </div>',
  '               </button>\n               </>\n            )}\n         </div>'
);
// fix the end of the page
rh = rh.replace(
  '       )}\n\n        </>\n      )}\n    </div>\n  );\n}',
  '       )}\n\n        </>\n    </div>\n  );\n}'
);
fs.writeFileSync('app/dashboard/rh/page.js', rh);

let estoque = fs.readFileSync('app/dashboard/operacao/estoque/page.js', 'utf-8');
estoque = estoque.replace(
  '                </button>\n              </>\n          </div>',
  '                </button>\n              </>\n            )}\n          </div>'
);
estoque = estoque.replace(
  '          </>\n        )}\n        </>\n        )}\n      </main>',
  '          </>\n        )}\n        </>\n      </main>'
);
fs.writeFileSync('app/dashboard/operacao/estoque/page.js', estoque);

console.log('Fixed syntax errors for real');
