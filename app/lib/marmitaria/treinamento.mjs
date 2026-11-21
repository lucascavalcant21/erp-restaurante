// TREINAMENTO DO DELIVERY (pedido do dono, 21/11/2026): manual de operação
// por posição, no estilo das grandes redes. Cada posição (comanda, fogão,
// fritadeira, bancada, fechamento, expedição) tem mise en place, processos com
// tempo-meta, passos, pontos críticos, conferência e padrões (ex.: quantas
// etiquetas). Imprime e vira PDF para o funcionário.
//
// O modelo abaixo é um ponto de partida para o dono editar. Nenhum tempo,
// temperatura ou quantidade vem preenchido: quem define é o dono.

export const VERSAO_MANUAL = 1;

const p = (id, nome, passos, extra = {}) => ({ id, nome, tempoMin: "", passos, criticos: [], conferencia: [], padroes: [], ...extra });

export const MODELO_TREINAMENTO = [
  {
    id: "comanda", nome: "Pedido e comanda",
    objetivo: "Receber o pedido, imprimir a comanda e colocá-la no lugar certo para todo mundo ver.",
    misePlace: ["Impressora ligada, com bobina reserva", "Tablet ou celular dos aplicativos carregado e com som alto", "Prendedor ou trilho de comandas limpo", "Caneta para marcar a comanda"],
    processos: [
      p("aceitar", "Aceitar o pedido e imprimir a comanda", [
        "Aceite o pedido no aplicativo assim que tocar.",
        "Confira se a comanda saiu inteira (itens, observações, número do pedido).",
        "Leia as observações em voz alta para a cozinha.",
      ], { criticos: ["Pedido com observação de alergia: avise o responsável na hora."], padroes: [{ rotulo: "Tempo máximo para aceitar (min)", valor: "" }] }),
      p("posicionar", "Posicionar a comanda", [
        "Coloque a comanda no trilho, na ordem de chegada (a mais antiga à esquerda).",
        "Deixe a comanda virada para quem monta, com os itens visíveis.",
        "A comanda acompanha o pedido até a expedição e vai grampeada na sacola.",
      ], { conferencia: ["A comanda está no trilho, na ordem certa", "A comanda vai junto com o pedido até o fim"] }),
    ],
  },
  {
    id: "fogao", nome: "Fogão",
    objetivo: "Deixar os preparos quentes, no ponto e prontos para a montagem.",
    misePlace: ["Panelas e frigideiras limpas", "Utensílios: concha, escumadeira, pegador, espátula", "Preparos do dia porcionados e identificados", "Temperos e óleo à mão", "Pano limpo e borrifador de álcool 70%"],
    processos: [
      p("aquecer", "Aquecer e finalizar os preparos", [
        "Siga o modo de preparo da ficha de cada subproduto.",
        "Mantenha os preparos tampados e na temperatura de serviço.",
        "Prove o tempero no começo do turno.",
      ], { criticos: ["Preparo que passou da validade da etiqueta não vai para o cliente."], padroes: [{ rotulo: "Temperatura de serviço (°C)", valor: "" }] }),
    ],
  },
  {
    id: "fritadeira", nome: "Fritadeira",
    objetivo: "Fritar no tempo certo e enviar a fritura crocante.",
    misePlace: ["Óleo no nível e trocado conforme a regra da casa", "Cestos limpos e secos", "Porções pré-pesadas (batata, empanados)", "Papel absorvente, sal e pegador", "Embalagem própria da fritura"],
    processos: [
      p("fritar", "Fritar a batata", [
        "Confira a temperatura do óleo antes de baixar o cesto.",
        "Baixe o cesto com a porção pesada; não encha demais.",
        "Marque o tempo assim que o cesto entrar.",
        "Escorra e sacuda o cesto antes de tirar a batata.",
      ], { criticos: ["Óleo escuro ou com cheiro forte: avise e não frite."], padroes: [{ rotulo: "Temperatura do óleo (°C)", valor: "" }, { rotulo: "Tempo de fritura (min)", valor: "" }, { rotulo: "Peso da porção (g)", valor: "" }] }),
      p("enviar-batata", "Enviar a batata", [
        "Salgue logo depois de escorrer, ainda quente.",
        "Coloque na embalagem própria, sem apertar.",
        "Feche deixando a saída de vapor aberta para não murchar.",
        "A batata é o último item a entrar na sacola, por cima.",
      ], { conferencia: ["Batata crocante e sequinha", "Embalagem com saída de vapor", "Por cima dos outros itens na sacola"] }),
    ],
  },
  {
    id: "bancada", nome: "Bancada de montagem",
    objetivo: "Montar cada marmita igual à ficha, no peso certo.",
    misePlace: ["Embalagens do dia separadas por tamanho", "Balança ligada e tarada", "Porções e preparos em ordem de montagem", "Colheres e pegadores por preparo (um para cada)", "Guia de montagem impresso à vista"],
    processos: [
      p("montar", "Montar a marmita", [
        "Leia a comanda e pegue a embalagem certa.",
        "Monte na ordem do guia de montagem de cada marmita, compartimento por compartimento.",
        "Pese cada componente na balança.",
        "Limpe as bordas da embalagem antes de fechar.",
      ], { criticos: ["Peso abaixo ou acima da ficha muda o custo e a satisfação do cliente."], conferencia: ["Todos os itens da comanda", "Peso de cada componente conferido", "Bordas limpas"] }),
    ],
  },
  {
    id: "fechamento", nome: "Fechamento e embalagem",
    objetivo: "Fechar sem vazar, etiquetar e montar a sacola completa.",
    misePlace: ["Tampas e lacres", "Etiquetas impressas", "Sacolas, talheres, guardanapos e sachês", "Fita adesiva ou lacre de sacola"],
    processos: [
      p("vedar", "Fechar e verificar a vedação", [
        "Encaixe a tampa e passe o dedo em toda a volta.",
        "Vire a embalagem levemente para conferir se não vaza.",
        "Passe o lacre ou a fita onde a casa usa.",
      ], { criticos: ["Embalagem que vazou volta para a bancada: não envie."], conferencia: ["Tampa encaixada em toda a volta", "Nada vazando"] }),
      p("etiquetar", "Etiquetar", [
        "Cole a etiqueta na tampa, reta e sem cobrir o lacre.",
        "Confira se o nome da marmita na etiqueta é o da comanda.",
      ], { padroes: [{ rotulo: "Etiquetas por marmita", valor: "" }, { rotulo: "Etiquetas por sacola", valor: "" }] }),
      p("sacola", "Montar a sacola", [
        "Marmitas na base, retas.",
        "Bebidas em pé, separadas das quentes quando possível.",
        "Talher, guardanapo e sachês por cima.",
        "Fritura por último, por cima de tudo.",
        "Feche a sacola com o lacre e grampeie a comanda.",
      ], { conferencia: ["Itens da comanda todos na sacola", "Talher e guardanapo", "Sacola lacrada", "Comanda grampeada"] }),
    ],
  },
  {
    id: "expedicao", nome: "Expedição e entrega",
    objetivo: "Conferir tudo pela última vez e entregar ao entregador no tempo.",
    misePlace: ["Prateleira ou balcão de saída limpo", "Lista de pedidos do aplicativo aberta"],
    processos: [
      p("conferir", "Conferência final", [
        "Confira a sacola item por item contra a comanda.",
        "Confira o número do pedido e o aplicativo.",
        "Marque o pedido como pronto no aplicativo.",
      ], { criticos: ["Na dúvida, abra a sacola e confira: pedido errado custa mais que um minuto."], conferencia: ["Item por item contra a comanda", "Número do pedido certo", "Marcado como pronto"] }),
      p("entregar", "Entregar ao entregador", [
        "Peça o código ou o nome do pedido ao entregador.",
        "Entregue a sacola em pé.",
      ], { padroes: [{ rotulo: "Tempo total do pedido, do aceite à saída (min)", valor: "" }] }),
    ],
  },
];

const lista = (v) => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : []);
const texto = (v) => String(v ?? "").trim();
const tempo = (v) => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : "";
};

/** Manual salvo → manual limpo. Sem nada salvo, o modelo (para editar). */
export function normalizarManual(salvo) {
  const base = salvo && Array.isArray(salvo.estacoes) && salvo.estacoes.length ? salvo.estacoes : MODELO_TREINAMENTO;
  return {
    versao: VERSAO_MANUAL,
    titulo: texto(salvo?.titulo) || "Manual de operação do delivery",
    modelo: !(salvo && Array.isArray(salvo.estacoes) && salvo.estacoes.length),
    estacoes: base.map((e, i) => ({
      id: texto(e.id) || `estacao-${i + 1}`,
      nome: texto(e.nome) || `Posição ${i + 1}`,
      objetivo: texto(e.objetivo),
      misePlace: lista(e.misePlace),
      processos: (Array.isArray(e.processos) ? e.processos : []).map((x, j) => ({
        id: texto(x.id) || `p${j + 1}`,
        foto: /^https?:\/\//.test(texto(x.foto)) ? texto(x.foto) : "",
        nome: texto(x.nome) || `Processo ${j + 1}`,
        tempoMin: tempo(x.tempoMin),
        passos: lista(x.passos),
        criticos: lista(x.criticos),
        conferencia: lista(x.conferencia),
        padroes: (Array.isArray(x.padroes) ? x.padroes : []).map((q) => ({ rotulo: texto(q.rotulo), valor: texto(q.valor) })).filter((q) => q.rotulo),
      })),
    })),
  };
}

/** Tempo de cada posição e do pedido inteiro (soma dos tempos-meta preenchidos). */
export function temposDoManual(manual) {
  const estacoes = (manual?.estacoes || []).map((e) => {
    const comTempo = e.processos.filter((x) => x.tempoMin !== "");
    return { id: e.id, nome: e.nome, minutos: comTempo.reduce((t, x) => t + x.tempoMin, 0), semTempo: e.processos.length - comTempo.length };
  });
  return { estacoes, total: estacoes.reduce((t, e) => t + e.minutos, 0), semTempo: estacoes.reduce((t, e) => t + e.semTempo, 0) };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtMin = (m) => `${Number(m).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;

/**
 * HTML para imprimir ou salvar em PDF. `so`: id de uma posição (imprime só ela).
 * `embalagens`: nomes das embalagens cadastradas (entram no fechamento).
 */
export function htmlDoManual(manual, { empresa = "", data = "", so = null, embalagens = [] } = {}) {
  const t = temposDoManual(manual);
  const estacoes = manual.estacoes.filter((e) => !so || e.id === so);
  const ul = (itens, cls = "") => (itens.length ? `<ul class="${cls}">${itens.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const caixa = (itens) => (itens.length ? `<ul class="check">${itens.map((x) => `<li><span class="box"></span>${esc(x)}</li>`).join("")}</ul>` : "");
  const paginas = estacoes.map((e, i) => {
    const te = t.estacoes.find((x) => x.id === e.id);
    const emb = e.id === "fechamento" && embalagens.length ? `<p class="nota"><b>Embalagens cadastradas:</b> ${embalagens.map(esc).join(", ")}</p>` : "";
    const procs = e.processos.map((x, j) => `
      <section class="proc">
        <h3><span>${i + 1}.${j + 1}</span> ${esc(x.nome)}${x.tempoMin !== "" ? `<em>Meta: ${fmtMin(x.tempoMin)}</em>` : `<em class="vazio">Meta: ____ min</em>`}</h3>
        ${x.foto ? `<img class="foto" src="${esc(x.foto)}" alt="">` : ""}
        ${x.passos.length ? `<ol>${x.passos.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
        ${x.padroes.length ? `<table class="padroes">${x.padroes.map((q) => `<tr><td>${esc(q.rotulo)}</td><td>${q.valor ? esc(q.valor) : "______"}</td></tr>`).join("")}</table>` : ""}
        ${x.criticos.length ? `<div class="critico"><b>Atenção</b>${ul(x.criticos)}</div>` : ""}
        ${x.conferencia.length ? `<div class="conf"><b>Conferência</b>${caixa(x.conferencia)}</div>` : ""}
      </section>`).join("");
    return `
    <article class="estacao">
      <header>
        <p class="topo">${esc(manual.titulo)}${empresa ? ` · ${esc(empresa)}` : ""}</p>
        <h2>${i + 1}. ${esc(e.nome)}</h2>
        ${e.objetivo ? `<p class="obj">${esc(e.objetivo)}</p>` : ""}
        <p class="tempo">${te?.minutos ? `Tempo da posição: ${fmtMin(te.minutos)}` : ""}${te?.semTempo ? `${te?.minutos ? " · " : ""}${te.semTempo} processo(s) sem tempo definido` : ""}</p>
      </header>
      ${e.misePlace.length ? `<div class="mise"><h4>Mise en place (antes de começar)</h4>${caixa(e.misePlace)}</div>` : ""}
      ${emb}
      ${procs}
      <footer class="assin">
        <div>Funcionário: ______________________________ Data: ___/___/_____</div>
        <div>Treinador: _______________________________ Aprovado: ( ) sim ( ) não</div>
      </footer>
    </article>`;
  }).join("");
  const resumo = !so ? `
    <article class="capa">
      <h1>${esc(manual.titulo)}</h1>
      ${empresa ? `<p class="emp">${esc(empresa)}</p>` : ""}
      ${data ? `<p class="data">Versão de ${esc(data)}</p>` : ""}
      <h4>Posições e tempos</h4>
      <table class="padroes">${t.estacoes.map((e, i) => `<tr><td>${i + 1}. ${esc(e.nome)}</td><td>${e.minutos ? fmtMin(e.minutos) : "—"}</td></tr>`).join("")}
        <tr class="total"><td>Pedido inteiro</td><td>${t.total ? fmtMin(t.total) : "—"}</td></tr></table>
      ${t.semTempo ? `<p class="nota">${t.semTempo} processo(s) ainda sem tempo definido.</p>` : ""}
    </article>` : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(manual.titulo)}</title><style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111; font-size: 12px; line-height: 1.45; margin: 0; }
    .capa, .estacao { page-break-after: always; }
    .estacao:last-child { page-break-after: auto; }
    h1 { font-size: 26px; margin: 40px 0 4px; } .emp { font-size: 16px; margin: 0; } .data { color: #555; }
    header { border-bottom: 3px solid #111; margin-bottom: 10px; padding-bottom: 6px; }
    .topo { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #666; margin: 0; }
    h2 { font-size: 22px; margin: 2px 0; } .obj { margin: 2px 0; font-size: 13px; } .tempo { margin: 2px 0; font-weight: 700; }
    h3 { font-size: 15px; margin: 14px 0 4px; display: flex; gap: 8px; align-items: baseline; } h3 span { color: #8a6d2f; }
    h3 em { margin-left: auto; font-style: normal; font-size: 12px; background: #111; color: #fff; padding: 2px 8px; border-radius: 10px; }
    h3 em.vazio { background: #eee; color: #555; }
    h4 { margin: 8px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    ol { margin: 4px 0 4px 18px; padding: 0; } ol li { margin: 2px 0; }
    .proc { page-break-inside: avoid; border-left: 3px solid #c5a15a; padding-left: 10px; margin-bottom: 8px; }
    .mise { background: #f6f3ec; padding: 6px 10px; border-radius: 6px; }
    ul.check { list-style: none; margin: 2px 0; padding: 0; columns: 2; } ul.check li { margin: 2px 0; break-inside: avoid; }
    .box { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #111; margin-right: 6px; vertical-align: -1px; }
    .critico { border: 1.5px solid #b42318; color: #b42318; padding: 4px 8px; border-radius: 6px; margin: 6px 0; } .critico ul { margin: 2px 0 0 16px; padding: 0; }
    .conf { margin-top: 4px; }
    img.foto { float: right; max-width: 42%; max-height: 150px; margin: 0 0 6px 10px; border-radius: 6px; object-fit: cover; }
    .proc::after { content: ""; display: block; clear: both; }
    table.padroes { border-collapse: collapse; margin: 4px 0; min-width: 60%; } table.padroes td { border: 1px solid #ccc; padding: 3px 8px; } table.padroes td:last-child { font-weight: 700; text-align: right; }
    tr.total td { font-weight: 800; background: #f6f3ec; }
    .nota { color: #555; font-size: 11px; }
    .assin { margin-top: 18px; border-top: 1px dashed #999; padding-top: 8px; display: grid; gap: 10px; }
  </style></head><body>${resumo}${paginas}</body></html>`;
}
