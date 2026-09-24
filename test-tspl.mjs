import { gerarComandosTsplMdk022 } from './app/lib/impressaoMdk022.js';

const buffer = gerarComandosTsplMdk022({
  dados: { produto: "TESTE DE MDK-022", responsavel: "LUCAS", unidadeNome: "SELDEESTRELA" },
  tamanho: "60x40",
  copias: 1
});

console.log("Bytes do teste gerados:", buffer.length);
