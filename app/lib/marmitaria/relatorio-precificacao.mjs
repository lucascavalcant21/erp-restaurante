// RELATÓRIO DA PRECIFICAÇÃO DO DELIVERY (imprimir ou salvar em PDF).
//
// Pedido do dono (22/11/2026): "na precificação do delivery quero poder
// imprimir ou salvar o arquivo em PDF para mostrar para minha equipe, com tudo
// sobre o prato até o que sobra do lucro, e eu escolho se quero de um app
// específico, de todos ou de alguns, inclusive de balcão".
//
// Regra: os números saem das MESMAS contas da tela (cardapioDeVendas por app,
// cascataDoPreco). Nada é recalculado à parte. Sem preço ou sem custo: o
// relatório diz o que falta, nunca inventa valor.

import { cascataDoPreco } from "./precificacao.mjs";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const temNumero = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

export const brl = (v) => (temNumero(v) ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
export const pct = (v, dec = 2) => (temNumero(v) ? `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%` : "—");
const markupTxt = (m) => (temNumero(m) ? `${((Number(m) - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "—");
/**
 * Quantidade da ficha em gramas (dono, 22/11/2026: "deixe tudo em gramas"):
 * kg vira g e litro vira ml; unidade, porção e outras ficam como estão.
 */
export function qtdTxt(q, un) {
  if (!temNumero(q)) return "—";
  const u = String(un || "").trim().toLowerCase();
  const fmt = (v, d = 0) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d });
  if (["kg", "quilo", "quilos"].includes(u)) return `${fmt(Number(q) * 1000, 1)} g`;
  if (["g", "gr", "grama", "gramas"].includes(u)) return `${fmt(q, 1)} g`;
  if (["l", "lt", "litro", "litros"].includes(u)) return `${fmt(Number(q) * 1000, 1)} ml`;
  if (u === "ml") return `${fmt(q, 1)} ml`;
  return `${fmt(q, 3)}${un ? ` ${un}` : ""}`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const SECOES_RELATORIO = Object.freeze([
  Object.freeze({ id: "marmitas", nome: "Pratos" }),
  Object.freeze({ id: "combos", nome: "Combos" }),
  Object.freeze({ id: "promocoes", nome: "Promoções" }),
]);

const TIPO_DA_FICHA = { marmitas: "Prato", combos: "Combo", promocoes: "Promoção" };

/** Quais apps entram: "todos" ou a lista escolhida (na ordem do cadastro). */
export function canaisDoRelatorio(canais = [], escolhidos = "todos") {
  if (escolhidos === "todos" || !Array.isArray(escolhidos)) return canais;
  const set = new Set(escolhidos);
  return canais.filter((c) => set.has(c.id));
}

/** A conta em cascata de uma linha do cardápio num app (null se não tem preço). */
export function contaDaLinha(linha, custoFicha = null) {
  const r = linha?.sim?.com;
  if (!r?.valido || linha.semPreco) return null;
  const unidades = r.pedido?.unidades || 1;
  const emb = custoFicha ? r2((Number(custoFicha.embalagens) || 0) * unidades) : 0;
  const ingredientes = r.custo == null ? null : r2(r.custo - emb);
  const cascata = cascataDoPreco({ r, custo: { ingredientes, embalagens: emb }, descontoApp: 0 }) || [];
  const taxas = [["Comissão do app", r.comissao], ["Maquininha e pagamento", r.taxaPagamento], ["Taxa fixa por pedido", r.taxaFixa], ["Entrega", r.entrega]]
    .filter(([, v]) => Number(v) > 0).map(([rotulo, valor]) => ({ rotulo, valor: r2(valor) }));
  return { cascata, taxas };
}

/**
 * Junta tudo o que o relatório mostra.
 * porCanal: Map(canalId -> { linhas }) de useCardapio; custos: Map(fichaId -> custoDaMarmita).
 */
export function montarRelatorio({ canais = [], escolhidos = "todos", secoes = ["marmitas", "combos", "promocoes"], porCanal, custos = new Map(), embutidos = null, ingredientes = true }) {
  const apps = canaisDoRelatorio(canais, escolhidos);
  const base = porCanal?.get(apps[0]?.id)?.linhas || [];
  const ordemSecao = (l) => SECOES_RELATORIO.findIndex((s) => s.id === l.secao);
  const itens = base.filter((l) => secoes.includes(l.secao)).sort((a, b) => ordemSecao(a) - ordemSecao(b)).map((l0) => {
    const c = l0.ficha ? custos.get(l0.ficha.id) || null : null;
    const porApp = apps.map((app) => {
      const l = porCanal.get(app.id)?.linhas.find((x) => x.id === l0.id) || null;
      const conta = l ? contaDaLinha(l, l.secao === "combos" ? null : c) : null;
      return {
        canalId: app.id, canal: app.nome,
        semPreco: !l || !!l.semPreco, falta: l?.falta || null,
        preco: l?.precoPago ?? null, precoCheio: l?.precoCheio ?? null,
        lucro: l?.lucro ?? null, lucroPct: l?.lucroPct ?? null,
        cmvPct: l?.cmvPct ?? null, markup: l?.markup ?? null,
        veredito: l?.veredito?.rotulo || "", vereditoId: l?.veredito?.id || "sem_dados",
        cascata: conta?.cascata || [], taxas: conta?.taxas || [],
      };
    });
    return {
      id: l0.id, secao: l0.secao, nome: l0.nome, categoria: l0.categoria || "", rotulo: l0.rotulo || "",
      descricao: l0.descricao || "", codigo: l0.ficha?.codigo || "", imagem: l0.ficha?.imagem || "",
      itensDoCombo: l0.secao !== "marmitas" ? (l0.itens || []).map((i) => ({ nome: i.nome, custo: i.custo ?? null, qtd: i.qtd || 1 })) : [],
      ficha: ingredientes && c ? {
        ingredientes: (c.linhas || []).map((x) => ({ nome: x.nome, qtd: x.quantidade, un: x.unidade, custo: x.custo, pre: x.tipo === "pre_preparo" })),
        embalagens: (c.linhasEmbalagens || []).map((x) => ({ nome: x.nome, qtd: x.quantidade, custo: x.custo })),
        alimentos: r2((c.alimentos || 0) + (c.prePreparos || 0)), embalagensTotal: c.embalagens, total: c.total,
        completo: !!c.completo, pendencias: c.pendencias || [],
      } : null,
      porApp,
    };
  });
  return {
    apps, itens,
    rateio: embutidos ? {
      completo: !!embutidos.completo, faltando: embutidos.faltando || [],
      cmoPorMarmita: embutidos.cmoPorMarmita ?? null, fixosPorMarmita: embutidos.fixosPorMarmita ?? null,
      proLaborePorMarmita: embutidos.proLaborePorMarmita ?? null, marmitasMes: embutidos.marmitasMes ?? null,
    } : null,
  };
}

const CSS = `
@page { size: A4; margin: 9mm 9mm 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 9.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 17pt; margin: 0; letter-spacing: -0.3px; }
h2 { font-size: 11pt; margin: 8px 0 4px; padding-bottom: 3px; border-bottom: 2px solid #111; text-transform: uppercase; letter-spacing: .4px; }
.topo { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 4px solid #DC2626; padding-bottom: 6px; }
.topo .sub { color: #444; margin-top: 2px; font-size: 9pt; }
.topo .dir { text-align: right; font-size: 8.5pt; color: #444; }
.chips { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
.chip { border: 1px solid #111; border-radius: 99px; padding: 1px 8px; font-size: 8.5pt; font-weight: bold; }
.caixa { border: 1px solid #ccc; border-radius: 7px; padding: 5px 8px; margin-top: 6px; font-size: 8.5pt; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 2px 5px; border-bottom: 1px solid #e6e6e6; text-align: right; vertical-align: top; }
th:first-child, td:first-child { text-align: left; }
thead th { background: #111; color: #fff; font-size: 7.8pt; text-transform: uppercase; letter-spacing: .3px; }
.resumo td { font-size: 8.8pt; white-space: nowrap; }
.resumo th.app { text-align: center; border-left: 2px solid #fff; }
.resumo tr.sub-cab th { background: #444; font-size: 7.2pt; }
.resumo tr.sub-cab th:nth-child(3n+1), .resumo td.ini { border-left: 2px solid #ddd; }
.resumo td.forte { font-weight: bold; }
.resumo td:first-child { white-space: normal; }
.neg { color: #B91C1C; font-weight: bold; }
.prato { border: 1px solid #bbb; border-radius: 8px; padding: 6px 7px; margin: 5px 0 6px; break-inside: avoid; page-break-inside: avoid; }
.prato-topo { display: flex; gap: 8px; align-items: center; }
.prato-topo img { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.prato h3 { margin: 0; font-size: 11pt; }
.prato .meta { color: #555; font-size: 8pt; margin: 1px 0 0; }
.cod { display: inline-block; background: #DC2626; color: #fff; font-size: 7.5pt; font-weight: bold; border-radius: 4px; padding: 0 4px; margin-right: 5px; vertical-align: 1px; }
.tipo { display: inline-block; border: 1px solid #999; color: #444; font-size: 7pt; font-weight: bold; border-radius: 4px; padding: 0 4px; margin-right: 5px; text-transform: uppercase; vertical-align: 1px; }
.selo { display: inline-block; font-size: 7.5pt; font-weight: bold; border-radius: 99px; padding: 0 6px; background: #eee; margin-left: 5px; vertical-align: 1px; }
.selo.ok { background: #DCFCE7; color: #166534; } .selo.baixo { background: #FEF3C7; color: #92400E; } .selo.prejuizo { background: #FEE2E2; color: #991B1B; }
.dois { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px; }
.mini th { background: #efefef; color: #111; }
.mini td, .mini th { font-size: 7.8pt; padding: 1px 4px; }
.conta { margin-top: 5px; }
.conta td, .conta th { font-size: 8.2pt; white-space: nowrap; }
.conta td:first-child { white-space: normal; }
.conta tr.total td { font-weight: bold; background: #f4f4f4; }
.conta tr.final td { font-weight: bold; background: #111; color: #fff; font-size: 9pt; }
.conta tr.final td.neg { color: #FCA5A5; }
.conta tr.sub td { color: #555; font-size: 7.4pt; padding-top: 0; padding-bottom: 0; }
.conta tr.sub td:first-child { padding-left: 14px; }
.pct { color: #777; font-size: 7pt; margin-left: 3px; font-weight: normal; }
.conta tr.final .pct { color: #ccc; }
.pct-b { display: block; color: #777; font-size: 7pt; }
.falta { color: #92400E; font-size: 7.8pt; margin: 2px 0 0; }
.rodape { margin-top: 8px; font-size: 7.5pt; color: #666; border-top: 1px solid #ddd; padding-top: 4px; }
`;

function tabelaDaConta(item) {
  const apps = item.porApp;
  // Linhas na ordem da cascata, juntando os apps (uma linha pode faltar num app).
  const ordem = [];
  for (const a of apps) for (const l of a.cascata) if (!ordem.some((o) => o.id === l.id)) ordem.push({ id: l.id, rotulo: l.rotulo, tipo: l.tipo });
  if (!ordem.length) return `<p class="falta">Sem preço em nenhum dos apps escolhidos: coloque o preço na Precificação para ver a conta.</p>`;
  const rotuloIngred = item.secao === "marmitas" ? "Ingredientes" : "Custo dos itens";
  const subTaxas = (() => {
    const nomes = [];
    for (const a of apps) for (const t of a.taxas) if (!nomes.includes(t.rotulo)) nomes.push(t.rotulo);
    return nomes;
  })();
  const celula = (a, id) => {
    if (a.semPreco) return `<td>—</td>`;
    const l = a.cascata.find((x) => x.id === id);
    if (!l || l.valor == null) return `<td>${l && l.valor == null ? "falta custo" : "—"}</td>`;
    return `<td class="${l.valor < 0 && l.tipo === "final" ? "neg" : ""}">${brl(l.valor)}<span class="pct">(${pct(l.pct)})</span></td>`;
  };
  const linhas = ordem.map((o) => {
    const cls = o.tipo === "final" ? "final" : o.tipo === "total" ? "total" : "";
    const rot = o.id === "ingredientes" ? rotuloIngred : o.rotulo;
    let html = `<tr class="${cls}"><td>${esc(rot)}</td>${apps.map((a) => celula(a, o.id)).join("")}</tr>`;
    if (o.id === "taxas" && subTaxas.length) {
      html += subTaxas.map((n) => `<tr class="sub"><td>${esc(n)}</td>${apps.map((a) => {
        if (a.semPreco) return "<td></td>";
        const t = a.taxas.find((x) => x.rotulo === n);
        return `<td>${t ? `${brl(-t.valor)}<span class="pct">(${pct(a.preco > 0 ? (t.valor / a.preco) * 100 : null)})</span>` : "—"}</td>`;
      }).join("")}</tr>`).join("");
    }
    return html;
  }).join("");
  const cab = apps.map((a) => `<th>${esc(a.canal)}</th>`).join("");
  const faltas = apps.filter((a) => a.semPreco || a.falta).map((a) => `${esc(a.canal)}: ${a.falta ? esc(a.falta) : "sem preço"}`);
  return `<table class="conta"><thead><tr><th>Do preço ao lucro (1 venda)</th>${cab}</tr></thead><tbody>${linhas}</tbody></table>
    ${faltas.length ? `<p class="falta">${faltas.join(" · ")}</p>` : ""}`;
}

function blocoDoPrato(item) {
  const a0 = item.porApp.find((a) => !a.semPreco) || item.porApp[0];
  const f = item.ficha;
  const fichaHtml = f ? `<div class="dois">
      <table class="mini"><thead><tr><th>Ingrediente</th><th>Qtd.</th><th>Custo</th></tr></thead><tbody>
        ${f.ingredientes.map((x) => `<tr><td>${esc(x.nome)}${x.pre ? " (pré-preparo)" : ""}</td><td>${qtdTxt(x.qtd, x.un)}</td><td>${x.custo == null ? "falta" : brl(x.custo)}</td></tr>`).join("") || `<tr><td colspan="3">Sem ingredientes na ficha.</td></tr>`}
        <tr><td><b>Ingredientes</b></td><td></td><td><b>${brl(f.alimentos)}</b></td></tr>
      </tbody></table>
      <table class="mini"><thead><tr><th>Embalagem</th><th>Qtd.</th><th>Custo</th></tr></thead><tbody>
        ${f.embalagens.map((x) => `<tr><td>${esc(x.nome)}</td><td>${qtdTxt(x.qtd)}</td><td>${x.custo == null ? "falta" : brl(x.custo)}</td></tr>`).join("") || `<tr><td colspan="3">Sem embalagem na ficha.</td></tr>`}
        <tr><td><b>Embalagens</b></td><td></td><td><b>${brl(f.embalagensTotal)}</b></td></tr>
        <tr><td><b>Custo de 1 unidade</b></td><td></td><td><b>${brl(f.total)}</b></td></tr>
      </tbody></table>
    </div>${!f.completo && f.pendencias.length ? `<p class="falta">Custo incompleto: ${f.pendencias.map(esc).join(" ")}</p>` : ""}` : "";
  const combo = item.itensDoCombo.length ? `<p class="meta">Itens: ${item.itensDoCombo.map((i) => `${i.qtd > 1 ? `${i.qtd}× ` : ""}${esc(i.nome)} (custo ${brl(i.custo)})`).join(" · ")}</p>` : "";
  return `<section class="prato">
    <div class="prato-topo">
      ${item.imagem ? `<img src="${esc(item.imagem)}" alt="">` : ""}
      <div style="flex:1;min-width:0">
        <h3><span class="tipo">${esc(TIPO_DA_FICHA[item.secao] || "")}</span>${item.codigo ? `<span class="cod">${esc(item.codigo)}</span>` : ""}${esc(item.nome)}${a0?.veredito ? `<span class="selo ${esc(a0.vereditoId)}">${esc(a0.veredito)}</span>` : ""}</h3>
        <p class="meta">${[item.rotulo && item.secao !== "marmitas" ? item.rotulo : "", item.categoria, item.itensDoCombo.length ? "" : item.descricao].filter(Boolean).map(esc).join(" · ")}</p>
        ${combo}
        <p class="meta">${item.porApp.filter((a) => !a.semPreco).map((a) => `<b>${esc(a.canal)}</b> CMV ${pct(a.cmvPct)} · markup ${markupTxt(a.markup)}`).join(" &nbsp;·&nbsp; ")}</p>
      </div>
    </div>
    ${fichaHtml}
    ${tabelaDaConta(item)}
  </section>`;
}

/** HTML pronto para imprimir (A4). O navegador oferece "Salvar como PDF". */
export function htmlDoRelatorio(rel, { empresa = "", data = "", rotuloLucro = "Lucro", meta = "" } = {}) {
  const apps = rel.apps;
  // Resumo em colunas (dono, 22/11/2026: "não quero dividido por ponto, e sim
  // como uma coluna"): para cada app, Preço | Lucro | % de lucro.
  const resumo = rel.itens.length ? `<table class="resumo"><thead>
    <tr><th rowspan="2">Produto</th>${apps.map((a) => `<th colspan="3" class="app">${esc(a.nome)}</th>`).join("")}</tr>
    <tr class="sub-cab">${apps.map(() => "<th>Preço</th><th>Lucro</th><th>%</th>").join("")}</tr>
  </thead><tbody>
    ${rel.itens.map((it) => `<tr><td>${it.codigo ? `<span class="cod">${esc(it.codigo)}</span>` : ""}${esc(it.nome)}</td>${it.porApp.map((a) => a.semPreco
      ? `<td class="ini" colspan="3">sem preço</td>`
      : `<td class="ini">${brl(a.preco)}</td><td class="${a.lucro != null && a.lucro < 0 ? "neg" : "forte"}">${brl(a.lucro)}</td><td>${pct(a.lucroPct)}</td>`).join("")}</tr>`).join("")}
  </tbody></table>` : `<p>Nenhum produto nas seções escolhidas.</p>`;
  const r = rel.rateio;
  const rateio = r ? `<div class="caixa"><b>Em cada marmita (estimativa pelo mês):</b> equipe ${brl(r.cmoPorMarmita)} · custos fixos ${brl(r.fixosPorMarmita)}${r.proLaborePorMarmita ? ` (pró-labore ${brl(r.proLaborePorMarmita)})` : ""}${r.marmitasMes ? ` · base de ${Number(r.marmitasMes).toLocaleString("pt-BR")} marmitas no mês` : ""}.${r.completo ? "" : ` <span class="falta">Ainda não entra por completo: falta ${r.faltando.map(esc).join(", ")}. Por isso o resultado aparece como "${esc(rotuloLucro)}".</span>`}</div>` : "";
  // Fichas em sequência, duas por página (dono, 22/11/2026: "encaixa duas
  // fichas em uma página, não deixa página com sobra"): cada ficha é compacta
  // e não quebra no meio; o tipo (prato, combo, promoção) vai na própria ficha.
  const porSecao = `<h2>Fichas</h2>${rel.itens.map(blocoDoPrato).join("")}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Precificação do delivery${empresa ? ` · ${esc(empresa)}` : ""}</title><style>${CSS}</style></head><body>
  <header class="topo">
    <div><h1>Precificação do delivery</h1><p class="sub">Do preço de cada produto até o que sobra de lucro, em cada app.</p></div>
    <div class="dir">${empresa ? `<b>${esc(empresa)}</b><br>` : ""}${data ? esc(data) : ""}${meta ? `<br>Meta de lucro: ${esc(meta)}` : ""}</div>
  </header>
  <div class="chips">${apps.map((a) => `<span class="chip">${esc(a.nome)}</span>`).join("")}</div>
  ${rateio}
  <h2>Resumo</h2>
  ${resumo}
  ${porSecao}
  <p class="rodape">Preços: os cadastrados em cada app (real). Custos: fichas técnicas com o último preço de compra. Equipe, custos fixos e pró-labore: rateio do mês por marmita (estimativa). Lucro: estimativa por venda, antes de perdas. Gerado pelo Héfisto.</p>
  </body></html>`;
}
