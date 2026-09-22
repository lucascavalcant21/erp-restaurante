// Documento A4 das fichas: PDF individual, "Baixar PDF", impressão e Livro de
// Receitas saem todos daqui. HTML puro (sem React), porque vai para a janela de
// impressão ou para o gerador de PDF (lib/pdf.js).
//
// Não há "ficha técnica genérica": cada ficha é desenhada pelo template do seu
// tipo, que vem de dadosDaFicha (ficha-modelo.mjs). Um livro pode misturar
// pratos e pré-preparos — cada página usa o seu.
//
// Regras de impressão:
//  · cada ficha começa numa página nova; o conteúdo corre em fluxo normal, sem
//    altura fixa — nada é espremido nem cortado, e o rodapé nunca sai da folha;
//  · linha de ingrediente e passo não se partem ao meio; o título da seção fica
//    colado no começo do conteúdo;
//  · seção sem informação não é impressa.

import { dadosDaFicha, TIPOS_FICHA } from "./ficha-modelo.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// A foto vem da própria ficha, em base64. Qualquer outra coisa não entra no src.
const fotoSegura = (src) => (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(String(src || "")) ? src : "");

const doisDigitos = (n) => String(n).padStart(2, "0");

// ─── Estilo ─────────────────────────────────────────────────────────────────

const ESTILO = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff}
  body{font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2937;font-size:12px;line-height:1.45;
       padding:10mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4 portrait;margin:12mm 12mm 13mm}
  @media print{body{padding:0}}

  .doc{max-width:186mm;margin:0 auto}

  /* Uma ficha por página */
  .ficha{border-top:5px solid var(--cor)}
  .ficha + .ficha{page-break-before:always;break-before:page}

  /* Cabeçalho */
  .topo{display:flex;align-items:center;gap:14px;padding:10px 0 12px;border-bottom:1px solid #e5e7eb}
  .marca{flex:0 0 auto}
  .marca svg{display:block}
  .titulo{flex:1;min-width:0}
  .titulo .tipo{font-size:15.5px;font-weight:800;letter-spacing:.1em;color:var(--cor);white-space:nowrap}
  .titulo .sub{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin-top:2px}
  .controle{flex:0 0 auto;border-collapse:collapse;font-size:10px}
  .controle td{padding:2px 0 2px 10px;white-space:nowrap}
  .controle td.r{color:#6b7280;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:9px}
  .controle td.v{font-weight:700;color:#111827;text-align:right}

  /* Nome e identificação */
  .nome{font-family:Georgia,"Times New Roman",serif;font-size:27px;line-height:1.15;font-weight:700;color:#111827;margin:14px 0 8px}
  .ident{display:flex;flex-wrap:wrap;gap:8px 0;margin-bottom:6px}
  .ident .item{padding:0 16px 0 0;margin-right:16px;border-right:1px solid #e5e7eb}
  .ident .item:last-child{border-right:0;margin-right:0}
  .ident .r{display:block;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}
  .ident .v{display:block;font-size:13px;font-weight:700;color:#111827}

  /* Seções */
  .sec{margin-top:16px}
  .sec h2{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--cor);
          border-bottom:2px solid var(--cor);padding-bottom:4px;margin-bottom:8px;
          page-break-after:avoid;break-after:avoid}
  .sec.destaque h2{background:var(--cor);color:#fff;border:0;padding:6px 10px;font-size:12.5px;border-radius:3px}
  .junto{page-break-inside:avoid;break-inside:avoid}

  /* Ingredientes + foto */
  .corpo{display:flex;gap:16px;align-items:flex-start}
  .corpo .col-ing{flex:1;min-width:0}
  .corpo .foto{flex:0 0 64mm;margin-top:16px}
  .foto img{display:block;width:100%;max-height:78mm;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb}

  table.ing{width:100%;border-collapse:collapse}
  table.ing thead{display:table-header-group}
  table.ing th{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;
               text-align:left;padding:0 8px 5px;border-bottom:1px solid #d1d5db}
  table.ing th.q,table.ing td.q{text-align:right;white-space:nowrap}
  table.ing td{padding:6px 8px;border-bottom:1px solid #eef0f3;font-size:14px;color:#111827;vertical-align:top}
  table.ing tr{page-break-inside:avoid;break-inside:avoid}
  table.ing tbody tr:nth-child(even) td{background:var(--cor-suave)}
  table.ing td.q{font-weight:700}
  .tag{display:inline-block;margin-left:6px;padding:0 5px;border:1px solid var(--cor-linha);border-radius:3px;
       font-size:8.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--cor);vertical-align:2px}
  .vazio{color:#9ca3af;font-style:italic;padding:6px 8px}

  /* Passos */
  ol.passos{list-style:none}
  ol.passos li{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #f1f2f4;page-break-inside:avoid;break-inside:avoid}
  ol.passos li:last-child{border-bottom:0}
  ol.passos .num{flex:0 0 24px;height:24px;border-radius:50%;background:var(--cor);color:#fff;font-weight:800;
                 font-size:12px;display:flex;align-items:center;justify-content:center;margin-top:1px}
  ol.passos .txt{flex:1;min-width:0;font-size:13.5px;color:#111827}
  ol.passos .det{font-size:11px;color:#6b7280;margin-top:2px}
  .tipo-prato ol.passos .txt{font-size:14.5px}
  .notas{font-size:11px;color:#6b7280;margin-top:6px}

  /* Blocos curtos lado a lado */
  .duas{display:flex;gap:16px;align-items:flex-start}
  .duas > .sec{flex:1;min-width:0}
  table.linhas{width:100%;border-collapse:collapse}
  table.linhas td{padding:5px 8px;border-bottom:1px solid #eef0f3;font-size:12.5px;vertical-align:top}
  table.linhas td.r{width:52%;color:#6b7280;font-weight:600;font-size:11px;letter-spacing:.02em}
  table.linhas td.v{color:#111827;font-weight:600}
  table.linhas tr.forte td{font-weight:800;color:#111827;border-top:1px solid #d1d5db}
  .texto{font-size:12.5px;color:#111827;padding:2px 8px}
  .lista{font-size:12.5px;color:#111827;padding:2px 8px}

  /* Rodapé no fluxo: acompanha o conteúdo e nunca sai da folha */
  .rodape{display:flex;justify-content:space-between;gap:12px;margin-top:18px;padding-top:6px;border-top:1px solid #e5e7eb;
          font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;page-break-inside:avoid;break-inside:avoid}

  /* Capa e índice do Livro */
  .capa{min-height:250mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
        page-break-after:always;break-after:page}
  .capa h1{font-family:Georgia,"Times New Roman",serif;font-size:40px;color:#111827;margin:26px 0 10px}
  .capa .unidade{font-size:15px;font-weight:600;color:#374151}
  .capa .contagem{display:flex;gap:10px;justify-content:center;margin-top:18px}
  .capa .contagem span{padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;color:#fff}
  .capa .data{margin-top:14px;font-size:12px;color:#9ca3af}
  .indice{page-break-after:always;break-after:page}
  .indice h1{font-family:Georgia,"Times New Roman",serif;font-size:26px;color:#111827;margin-bottom:6px}
  .indice .ajuda{font-size:11px;color:#6b7280;margin-bottom:12px}
  .indice h2{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:16px 0 6px;
             padding-bottom:4px;border-bottom:2px solid currentColor;page-break-after:avoid;break-after:avoid}
  .indice .linha{display:flex;align-items:baseline;gap:8px;padding:3px 0;font-size:12px;page-break-inside:avoid;break-inside:avoid}
  .indice .n{flex:0 0 34px;font-weight:800;color:#6b7280}
  .indice .nm{font-weight:600;color:#111827}
  .indice .pontos{flex:1;border-bottom:1px dotted #d1d5db;transform:translateY(-3px)}
  .indice .cat{color:#6b7280;font-size:11px;white-space:nowrap}
`;

// ─── Partes ─────────────────────────────────────────────────────────────────

function secao(chave, titulo, corpo, dados) {
  const destaque = dados.config.destaques?.includes(chave) ? " destaque" : "";
  return `<section class="sec sec-${chave}${destaque}">${corpo(`<h2>${esc(titulo)}</h2>`)}</section>`;
}

function tabelaIngredientes(dados) {
  if (!dados.ingredientes.length) {
    return (h2) => `<div class="junto">${h2}<p class="vazio">Sem ingredientes cadastrados.</p></div>`;
  }
  const linhas = dados.ingredientes.map(i => `
      <tr><td>${esc(i.nome)}${i.prePreparo ? '<span class="tag">pré-preparo</span>' : ""}</td><td class="q">${esc(i.quantidade)}</td></tr>`).join("");
  return (h2) => `${h2}<table class="ing"><thead><tr><th>Ingrediente</th><th class="q">Quantidade</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

function listaDePassos(instrucoes) {
  const itens = instrucoes.passos.map((p, i) => `
      <li><span class="num">${i + 1}</span><div class="txt">${esc(p.texto)}${p.detalhes.length ? `<div class="det">${p.detalhes.map(esc).join(" · ")}</div>` : ""}</div></li>`);
  // O título vai junto do primeiro passo: nunca fica sozinho no pé da folha.
  return (h2) => `${itens.length ? `<div class="junto">${h2}<ol class="passos">${itens[0]}</ol></div><ol class="passos">${itens.slice(1).join("")}</ol>` : h2}${
    instrucoes.notas.length ? `<p class="notas">${instrucoes.notas.map(esc).join(" · ")}</p>` : ""}`;
}

const tabelaDeLinhas = (linhas) => (h2) => `<div class="junto">${h2}<table class="linhas"><tbody>${
  linhas.map(l => `<tr class="${l.forte ? "forte" : ""}"><td class="r">${esc(l.rotulo)}</td><td class="v">${esc(l.valor)}</td></tr>`).join("")
}</tbody></table></div>`;

function blocoAlergenicos(alergenicos) {
  const contem = alergenicos.contem.length
    ? `<b>Contém:</b> ${esc(alergenicos.contem.join(", "))}.`
    : "Não contém alergênicos cadastrados.";
  const pode = alergenicos.podeConter ? `<br/><b>Pode conter:</b> ${esc(alergenicos.podeConter)}.` : "";
  return (h2) => `<div class="junto">${h2}<p class="texto">${contem}${pode}</p></div>`;
}

// Uma ficha inteira, no template do tipo dela.
export function htmlDaFicha(dados, { logoHtml = "", numero = null, livro = false, incluirFoto = true } = {}) {
  const { config } = dados;
  const controle = [
    ...(numero != null ? [{ rotulo: "Nº", valor: doisDigitos(numero) }] : []),
    ...dados.cabecalho,
  ];
  const foto = incluirFoto ? fotoSegura(dados.foto) : "";

  const partes = [];

  partes.push(`<div class="corpo"><div class="col-ing">${
    secao("ingredientes", "Ingredientes", tabelaIngredientes(dados), dados)
  }</div>${foto ? `<figure class="foto"><img src="${foto}" alt=""/></figure>` : ""}</div>`);

  if (dados.instrucoes) partes.push(secao("instrucoes", dados.instrucoes.titulo, listaDePassos(dados.instrucoes), dados));

  // Armazenamento e equipamentos são curtos: dividem a linha quando os dois existem.
  const armazenamento = dados.armazenamento
    ? secao("armazenamento", "Armazenamento e validade", tabelaDeLinhas(dados.armazenamento), dados) : "";
  const equipamentos = dados.equipamentos
    ? secao("equipamentos", "Equipamentos e utensílios",
        (h2) => `<div class="junto">${h2}<p class="lista">${esc(dados.equipamentos.join(", "))}.</p></div>`, dados)
    : "";
  if (armazenamento && equipamentos) partes.push(`<div class="duas">${armazenamento}${equipamentos}</div>`);
  else if (armazenamento || equipamentos) partes.push(armazenamento || equipamentos);

  const alergenicos = dados.alergenicos ? secao("alergenicos", "Alergênicos", blocoAlergenicos(dados.alergenicos), dados) : "";
  const custos = dados.custos ? secao("custos", "Custos", tabelaDeLinhas(dados.custos), dados) : "";
  if (alergenicos && custos) partes.push(`<div class="duas">${alergenicos}${custos}</div>`);
  else if (alergenicos || custos) partes.push(alergenicos || custos);

  const rodapeDireita = [dados.tipo === "prato" ? "Ficha de prato" : "Ficha de pré-preparo", dados.codigo, numero != null ? `Nº ${doisDigitos(numero)}` : ""]
    .filter(Boolean).join(" · ");

  return `
  <article class="ficha tipo-${dados.tipo === "prato" ? "prato" : "pre-preparo"}" style="--cor:${config.cor};--cor-suave:${config.corSuave};--cor-linha:${config.corLinha}">
    <header class="topo">
      ${logoHtml ? `<div class="marca">${logoHtml}</div>` : ""}
      <div class="titulo">
        <div class="tipo">${esc(config.tituloDocumento)}</div>
        <div class="sub">${esc(dados.setor.rotulo)}${livro ? " · Livro de Receitas" : ""}</div>
      </div>
      ${controle.length ? `<table class="controle"><tbody>${controle.map(c => `<tr><td class="r">${esc(c.rotulo)}</td><td class="v">${esc(c.valor)}</td></tr>`).join("")}</tbody></table>` : ""}
    </header>
    <h1 class="nome">${esc(dados.nome)}</h1>
    ${dados.identificacao.length ? `<div class="ident">${dados.identificacao.map(i => `<div class="item"><span class="r">${esc(i.rotulo)}</span><span class="v">${esc(i.valor)}</span></div>`).join("")}</div>` : ""}
    ${partes.join("\n")}
    <footer class="rodape"><span>Seldeestrela · Restaurante Amazônico</span><span>${esc(rodapeDireita)}</span></footer>
  </article>`;
}

function htmlCapa({ logoHtml, nomeUnidade, grupos, data }) {
  const contagem = [
    grupos.prato.length ? `<span style="background:${TIPOS_FICHA.prato.cor}">${grupos.prato.length} ${grupos.prato.length === 1 ? "prato" : "pratos"}</span>` : "",
    grupos.pre_preparo.length ? `<span style="background:${TIPOS_FICHA.pre_preparo.cor}">${grupos.pre_preparo.length} ${grupos.pre_preparo.length === 1 ? "pré-preparo" : "pré-preparos"}</span>` : "",
  ].join("");
  return `
  <section class="capa">
    ${logoHtml}
    <h1>Livro de Receitas</h1>
    ${nomeUnidade ? `<div class="unidade">${esc(nomeUnidade)}</div>` : ""}
    <div class="contagem">${contagem}</div>
    ${data ? `<div class="data">${esc(data)}</div>` : ""}
  </section>`;
}

// O índice aponta o número da ficha (Nº), não a página: uma ficha pode ocupar
// mais de uma folha, e um número de página chutado mandaria o leitor ao lugar
// errado. O Nº aparece no cabeçalho de cada ficha.
function htmlIndice(itens) {
  const blocos = ["prato", "pre_preparo"].map(tipo => {
    const doTipo = itens.filter(x => x.dados.tipo === tipo);
    if (!doTipo.length) return "";
    const cfg = TIPOS_FICHA[tipo];
    return `<h2 style="color:${cfg.cor}">${esc(cfg.rotuloPlural)}</h2>${doTipo.map(x => `
      <div class="linha"><span class="n">${doisDigitos(x.numero)}</span><span class="nm">${esc(x.dados.nome)}</span><span class="pontos"></span><span class="cat">${esc([x.dados.setor.rotulo, x.categoria].filter(Boolean).join(" · "))}</span></div>`).join("")}`;
  }).join("");
  return `
  <section class="indice">
    <h1>Índice</h1>
    <p class="ajuda">O número ao lado de cada receita é o Nº impresso no cabeçalho da ficha.</p>
    ${blocos}
  </section>`;
}

// ─── Documento ──────────────────────────────────────────────────────────────

// `fichas` na ordem do documento. `complementos` é o mapa ficha_id →
// { etapas, equipamentos, alergenicos, armazenamento, montagem } devolvido por
// fetchComplementosDeFichas. Custos só saem com `mostrarCustos` (permissão).
export function montarDocumentoFichas(fichas = [], {
  todasFichas = [],
  complementos = {},
  mostrarCustos = false,
  livro = false,
  capa = livro,
  indice = livro,
  incluirFoto = true,
  logoHtml = "",
  logoCapaHtml = "",
  nomeUnidade = "",
  data = "",
  titulo = "",
} = {}) {
  const itens = fichas.map((ficha, i) => ({
    numero: livro ? i + 1 : null,
    categoria: String(ficha?.categoria || "").trim(),
    dados: dadosDaFicha(ficha, { todasFichas, complementos: complementos?.[ficha?.id] || null, mostrarCustos }),
  }));

  const grupos = { prato: itens.filter(x => x.dados.tipo === "prato"), pre_preparo: itens.filter(x => x.dados.tipo === "pre_preparo") };
  const tituloDoc = titulo || (livro ? "Livro de Receitas" : itens.length === 1 ? `${itens[0].dados.config.rotulo} — ${itens[0].dados.nome}` : "Fichas");

  const corpo = [
    livro && capa ? htmlCapa({ logoHtml: logoCapaHtml || logoHtml, nomeUnidade, grupos, data }) : "",
    livro && indice && itens.length > 1 ? htmlIndice(itens) : "",
    ...itens.map(x => htmlDaFicha(x.dados, { logoHtml, numero: x.numero, livro, incluirFoto })),
  ].join("\n");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(tituloDoc)}</title>
<style>${ESTILO}</style></head><body><div class="doc">
${corpo || '<p class="vazio">Nenhuma ficha selecionada.</p>'}
</div></body></html>`;
}

// Nome do arquivo: a ficha avulsa leva o tipo e o nome; o resto é o livro.
export function nomeDoArquivo(fichas = [], { livro = false } = {}) {
  if (!livro && fichas.length === 1) {
    const dados = dadosDaFicha(fichas[0]);
    return `${dados.config.rotulo} ${dados.nome}`;
  }
  return livro ? "livro-de-receitas" : "fichas";
}
