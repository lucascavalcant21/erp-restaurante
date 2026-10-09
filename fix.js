const fs=require('fs');
let txt=fs.readFileSync('app/dashboard/rh/page.js', 'utf-8');

txt = txt.replace(
    ') : abaAtiva === "Banco de Talentos" ? (\r\n            <BancoTalentos unidadeAtiva={unidadeAtiva} />\r\n         ',
    ') : abaAtiva === "Banco de Talentos" ? (\r\n            <BancoTalentos unidadeAtiva={unidadeAtiva} />\r\n         ) : null}'
);

// If it's just \n instead of \r\n
txt = txt.replace(
    ') : abaAtiva === "Banco de Talentos" ? (\n            <BancoTalentos unidadeAtiva={unidadeAtiva} />\n         ',
    ') : abaAtiva === "Banco de Talentos" ? (\n            <BancoTalentos unidadeAtiva={unidadeAtiva} />\n         ) : null}'
);

fs.writeFileSync('app/dashboard/rh/page.js', txt);
