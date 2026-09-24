import { gerarComandosTsplMdk022 } from './app/lib/impressaoMdk022.js';

const buffer = gerarComandosTsplMdk022({
  dados: { testeCalibracao: true },
  tamanho: "60x40",
  copias: 1
});

console.log("Bytes do teste de calibracao gerados:", buffer.length);
