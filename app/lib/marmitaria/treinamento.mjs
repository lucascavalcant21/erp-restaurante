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
    porQue: "A comanda é o pedido do cliente. Se ela se perde ou é lida errado, todo o resto sai errado.",
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
    porQue: "O sabor e a temperatura do prato saem daqui. Preparo frio ou fora do ponto é reclamação certa.",
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
    porQue: "Fritura é o item que mais perde qualidade no caminho. Tempo e embalagem certos fazem ela chegar crocante.",
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
    porQue: "Cada marmita tem que sair igual, todos os dias. Peso certo é cliente satisfeito e custo sob controle.",
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
    porQue: "Embalagem que vaza ou sacola incompleta estraga a entrega inteira, mesmo com a comida perfeita.",
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
    porQue: "É a última chance de pegar um erro antes de o cliente receber.",
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
      porQue: texto(e.porQue),
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

// Método de treinamento em 4 etapas (como nas grandes redes de fast food).
export const ETAPAS_TREINO = [
  { id: "preparar", nome: "Preparar", texto: "O treinador explica a posição, o porquê de cada padrão e mostra este guia." },
  { id: "mostrar", nome: "Mostrar", texto: "O treinador faz o processo inteiro, devagar, falando cada passo." },
  { id: "praticar", nome: "Praticar", texto: "O funcionário faz sozinho, com o treinador do lado corrigindo na hora." },
  { id: "acompanhar", nome: "Acompanhar", texto: "O treinador observa em serviço real e preenche a avaliação da posição." },
];

/**
 * HTML do manual de treinamento para imprimir ou salvar em PDF, ocupando a
 * página inteira (sem margem branca). `so`: id de uma posição (imprime só ela).
 * `embalagens`: nomes das embalagens cadastradas (entram no fechamento).
 */
export function htmlDoManual(manual, { empresa = "", data = "", so = null, embalagens = [] } = {}) {
  const t = temposDoManual(manual);
  const estacoes = manual.estacoes.filter((e) => !so || e.id === so);
  const lis = (itens) => itens.map((x) => `<li>${esc(x)}</li>`).join("");
  const caixas = (itens) => itens.map((x) => `<li><span class="box"></span><span>${esc(x)}</span></li>`).join("");

  const capa = so ? "" : `
  <section class="pagina capa">
    <div class="capa-topo">
      <p class="selo">Treinamento da equipe</p>
      <h1>${esc(manual.titulo)}</h1>
      ${empresa ? `<p class="emp">${esc(empresa)}</p>` : ""}
      ${data ? `<p class="data">Versão de ${esc(data)}</p>` : ""}
    </div>
    <div class="capa-corpo">
      <h2 class="sec">Como usar este manual</h2>
      <p class="lead">Cada posição tem um guia: o que preparar antes de começar, o passo a passo de cada processo com o tempo-meta, o que nunca pode acontecer e a avaliação do treinador no final. Ninguém trabalha sozinho numa posição antes de ser aprovado nela.</p>
      <div class="quatro">${ETAPAS_TREINO.map((x, i) => `<div class="etapa"><b>${i + 1}</b><h3>${x.nome}</h3><p>${esc(x.texto)}</p></div>`).join("")}</div>
      <h2 class="sec">O caminho do pedido</h2>
      <div class="fluxo">${t.estacoes.map((e, i) => `<div class="no"><span class="n">${i + 1}</span><strong>${esc(e.nome)}</strong><em>${e.minutos ? fmtMin(e.minutos) : "tempo a definir"}</em></div>`).join('<span class="seta">›</span>')}</div>
      <table class="tabela"><thead><tr><th>Posição</th><th>Processos</th><th>Tempo-meta</th></tr></thead><tbody>
        ${manual.estacoes.map((e, i) => `<tr><td>${i + 1}. ${esc(e.nome)}</td><td>${e.processos.length}</td><td>${t.estacoes[i].minutos ? fmtMin(t.estacoes[i].minutos) : "—"}</td></tr>`).join("")}
        <tr class="total"><td>Pedido inteiro</td><td>${manual.estacoes.reduce((n, e) => n + e.processos.length, 0)}</td><td>${t.total ? fmtMin(t.total) : "—"}</td></tr>
      </tbody></table>
      ${t.semTempo ? `<p class="nota">${t.semTempo} processo(s) ainda sem tempo-meta definido.</p>` : ""}
    </div>
  </section>`;

  const paginas = estacoes.map((e) => {
    const n = manual.estacoes.indexOf(e) + 1;
    const te = t.estacoes.find((x) => x.id === e.id);
    const emb = e.id === "fechamento" && embalagens.length ? `<div class="bloco info"><h4>Embalagens da casa</h4><p>${embalagens.map(esc).join(" · ")}</p></div>` : "";
    const procs = e.processos.map((x, j) => `
      <div class="proc">
        <div class="proc-topo"><span class="num">${n}.${j + 1}</span><h3>${esc(x.nome)}</h3><span class="meta ${x.tempoMin === "" ? "vazia" : ""}">${x.tempoMin !== "" ? `Meta ${fmtMin(x.tempoMin)}` : "Meta ____ min"}</span></div>
        <div class="proc-corpo ${x.foto ? "com-foto" : ""}">
          <div>
            ${x.passos.length ? `<ol class="passos">${x.passos.map((s, k) => `<li><b>${k + 1}</b><span>${esc(s)}</span></li>`).join("")}</ol>` : ""}
            ${x.padroes.length ? `<div class="padroes">${x.padroes.map((q) => `<div class="padrao"><small>${esc(q.rotulo)}</small><strong>${q.valor ? esc(q.valor) : "____"}</strong></div>`).join("")}</div>` : ""}
          </div>
          ${x.foto ? `<figure><img src="${esc(x.foto)}" alt=""><figcaption>Padrão: assim deve ficar</figcaption></figure>` : ""}
        </div>
        ${x.criticos.length ? `<div class="nunca"><b>Atenção</b><ul>${lis(x.criticos)}</ul></div>` : ""}
        ${x.conferencia.length ? `<div class="confere"><b>Antes de passar adiante</b><ul class="check">${caixas(x.conferencia)}</ul></div>` : ""}
      </div>`).join("");
    // Avaliação da posição (o treinador observa e marca)
    const itensAval = e.processos.flatMap((x) => [`${x.nome}: segue o passo a passo`, ...x.conferencia.map((c) => `${x.nome}: ${c}`)]);
    return `
  <section class="pagina estacao">
    <header class="faixa">
      <span class="pos">${n}</span>
      <div><p class="topo">${esc(manual.titulo)}${empresa ? ` · ${esc(empresa)}` : ""}</p><h2>${esc(e.nome)}</h2>${e.objetivo ? `<p class="obj">${esc(e.objetivo)}</p>` : ""}</div>
      <div class="tempo-pos">${te?.minutos ? `<strong>${fmtMin(te.minutos)}</strong><small>tempo da posição</small>` : `<strong>—</strong><small>tempo a definir</small>`}</div>
    </header>
    <div class="miolo">
      ${e.porQue ? `<div class="bloco porque"><h4>Por que isso importa</h4><p>${esc(e.porQue)}</p></div>` : ""}
      ${e.misePlace.length ? `<div class="bloco mise"><h4>Mise en place · antes de começar</h4><ul class="check duas">${caixas(e.misePlace)}</ul></div>` : ""}
      ${emb}
      ${procs}
      <div class="aval">
        <h4>Avaliação da posição · preenchida pelo treinador</h4>
        <table class="tabela"><thead><tr><th>O que observar</th><th class="c">Atende</th><th class="c">Não atende</th></tr></thead><tbody>
          ${itensAval.map((x) => `<tr><td>${esc(x)}</td><td class="c"><span class="box"></span></td><td class="c"><span class="box"></span></td></tr>`).join("")}
          <tr><td>Tempo cronometrado: ______ min${te?.minutos ? ` (meta ${fmtMin(te.minutos)})` : ""}</td><td class="c"><span class="box"></span></td><td class="c"><span class="box"></span></td></tr>
        </tbody></table>
        <div class="etapas-assin">${ETAPAS_TREINO.map((x) => `<div><small>${x.nome}</small><span>___/___</span></div>`).join("")}</div>
        <div class="assin"><div>Funcionário</div><div>Treinador</div><div>Aprovado: ( ) sim ( ) não</div></div>
      </div>
    </div>
  </section>`;
  }).join("");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(manual.titulo)}</title><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Inter, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.4; }
  .pagina { width: 210mm; min-height: 297mm; page-break-after: always; break-after: page; position: relative; }
  .pagina:last-child { page-break-after: auto; break-after: auto; }
  /* capa */
  .capa-topo { background: #202124; color: #fff; padding: 16mm 12mm 9mm; }
  .selo { display: inline-block; background: #c5a15a; color: #202124; font-weight: 800; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin: 0 0 10px; }
  .capa-topo h1 { font-size: 34px; line-height: 1.1; margin: 0 0 6px; }
  .emp { font-size: 18px; margin: 0; color: #e8d9b5; } .data { margin: 6px 0 0; color: #bbb; }
  .capa-corpo { padding: 4mm 12mm 6mm; }
  .sec { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 3px solid #c5a15a; padding-bottom: 3px; margin: 5mm 0 2.5mm; }
  .lead { font-size: 13.5px; margin: 0; }
  .quatro { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 3mm; }
  .etapa { background: #f6f3ec; border-radius: 6px; padding: 3mm; } .etapa b { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #202124; color: #fff; font-size: 12px; }
  .etapa h3 { margin: 2mm 0 1mm; font-size: 14px; } .etapa p { margin: 0; font-size: 11.5px; }
  .fluxo { display: flex; flex-wrap: nowrap; align-items: stretch; gap: 1mm; }
  .no { flex: 1 1 0; min-width: 0; border: 2px solid #202124; border-radius: 6px; padding: 2mm 2mm; display: flex; flex-direction: column; }
  .no .n { font-weight: 800; color: #8a6d2f; } .no strong { font-size: 11.5px; line-height: 1.2; } .no em { font-style: normal; font-size: 10px; color: #555; margin-top: auto; }
  .seta { align-self: center; font-size: 18px; font-weight: 800; color: #c5a15a; }
  .tabela { width: 100%; border-collapse: collapse; margin-top: 3mm; }
  .tabela th { background: #202124; color: #fff; text-align: left; padding: 1.4mm 3mm; font-size: 11px; }
  .tabela td { border-bottom: 1px solid #ddd; padding: 1.4mm 3mm; } .tabela .c { text-align: center; width: 22mm; }
  .tabela tr.total td { font-weight: 800; background: #f6f3ec; }
  .nota { color: #666; font-size: 11px; }
  /* posição */
  .faixa { display: flex; align-items: center; gap: 5mm; background: #202124; color: #fff; padding: 5mm 10mm 4mm; }
  .pos { flex: none; display: grid; place-items: center; width: 18mm; height: 18mm; border-radius: 50%; background: #c5a15a; color: #202124; font-size: 28px; font-weight: 900; }
  .faixa .topo { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #bbb; }
  .faixa h2 { margin: 1mm 0; font-size: 26px; line-height: 1.1; } .faixa .obj { margin: 0; color: #e6e6e6; font-size: 13px; }
  .faixa > div:nth-child(2) { flex: 1; min-width: 0; }
  .tempo-pos { flex: none; text-align: right; } .tempo-pos strong { display: block; font-size: 20px; color: #e8d9b5; } .tempo-pos small { color: #bbb; }
  .miolo { padding: 3.5mm 10mm 4mm; }
  .bloco { border-radius: 6px; padding: 2.5mm 4mm; margin-bottom: 2.5mm; } .bloco h4, .aval h4 { margin: 0 0 1.5mm; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; }
  .bloco p { margin: 0; }
  .porque { background: #fff7e0; border-left: 5px solid #c5a15a; } .porque p { font-size: 12.5px; font-weight: 600; }
  .mise { background: #f6f3ec; } .info { background: #f2f4f7; }
  ul.check { list-style: none; margin: 0; padding: 0; } ul.check.duas { columns: 2; column-gap: 6mm; }
  ul.check li { display: flex; gap: 2mm; margin: 1mm 0; break-inside: avoid; }
  .box { flex: none; display: inline-block; width: 4mm; height: 4mm; border: 1.6px solid #202124; border-radius: 1px; margin-top: .6mm; }
  .proc { border: 1.5px solid #e2ddd0; border-radius: 8px; margin-bottom: 2.5mm; break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
  .proc-topo { display: flex; align-items: center; gap: 3mm; background: #f6f3ec; padding: 2mm 4mm; }
  .proc-topo .num { font-weight: 900; color: #8a6d2f; font-size: 15px; } .proc-topo h3 { margin: 0; flex: 1; font-size: 15px; }
  .meta { background: #202124; color: #fff; font-weight: 800; font-size: 12px; padding: 1mm 3mm; border-radius: 20px; white-space: nowrap; } .meta.vazia { background: #e9e9e9; color: #555; }
  .proc-corpo { padding: 2.5mm 4mm 0.5mm; } .proc-corpo.com-foto { display: grid; grid-template-columns: 1fr 62mm; gap: 4mm; }
  ol.passos { list-style: none; margin: 0; padding: 0; counter-reset: none; }
  ol.passos li { display: flex; gap: 2.5mm; margin: 0 0 1mm; } ol.passos li b { flex: none; display: grid; place-items: center; width: 6mm; height: 6mm; border-radius: 50%; background: #c5a15a; color: #202124; font-size: 11px; }
  ol.passos li span { font-size: 12px; }
  .padroes { display: flex; flex-wrap: wrap; gap: 2mm; margin: 1mm 0 2mm; }
  .padrao { border: 1.5px solid #202124; border-radius: 6px; padding: 1.5mm 3mm; min-width: 34mm; } .padrao small { display: block; font-size: 10px; color: #555; } .padrao strong { font-size: 15px; }
  figure { margin: 0; } figure img { width: 100%; height: 46mm; object-fit: cover; border-radius: 6px; } figcaption { font-size: 10px; color: #555; text-align: center; }
  .nunca { margin: 0 4mm 2.5mm; border: 1.8px solid #b42318; background: #fff1f0; color: #8a1c12; border-radius: 6px; padding: 2mm 3mm; } .nunca b { text-transform: uppercase; font-size: 11px; letter-spacing: .06em; } .nunca ul { margin: 1mm 0 0 4mm; padding: 0; }
  .confere { margin: 0 4mm 3mm; } .confere b { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .aval { margin-top: 2.5mm; border: 2px solid #202124; border-radius: 8px; padding: 2.5mm 4mm; }
  .aval .tabela td { padding: 1mm 3mm; } .aval .tabela { margin-top: 1.5mm; }
  .aval tr, .etapas-assin, .assin { break-inside: avoid; page-break-inside: avoid; }
  .etapas-assin { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; margin-top: 2mm; } .etapas-assin div { border: 1px solid #ccc; border-radius: 4px; padding: 1.5mm 2mm; display: flex; justify-content: space-between; }
  .etapas-assin small { font-weight: 700; }
  .assin { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; margin-top: 5mm; } .assin div { border-top: 1.2px solid #202124; padding-top: 1mm; font-size: 11px; }
  </style></head><body>${capa}${paginas}</body></html>`;
}
