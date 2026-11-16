// Guia de montagem impresso (pedido do dono, 16/11/2026): uma folha por
// marmita, com foto, o que vai e quanto, embalagens e o passo a passo.
// Todo texto passa por esc(): vem do cadastro, não é HTML confiável; foto só
// https. Módulo puro, testado em guia-impresso.test.mjs.

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const urlSegura = (u) => (/^https:\/\//i.test(String(u || "")) ? esc(u) : "");

export function htmlDosGuias(guias = []) {
  const folhas = guias.filter(Boolean).map((g) => {
    const foto = urlSegura(g.foto);
    return `<section class="folha">
  <header><h1>${esc(g.nome)}</h1>${g.codigo ? `<span class="cod">${esc(g.codigo)}</span>` : ""}</header>
  ${g.descricao ? `<p class="desc">${esc(g.descricao)}</p>` : ""}
  <div class="topo">
    ${foto ? `<img src="${foto}" alt="">` : ""}
    <div>
      <h2>O que vai${g.peso ? ` <small>(peso final ${esc(g.peso)})</small>` : ""}</h2>
      ${g.componentes.length ? `<table>${g.componentes.map((c) => `<tr><td>${esc(c.nome)}</td><td class="q">${esc(c.quantidade)}</td></tr>`).join("")}</table>` : "<p class=\"falta\">Ficha técnica não preenchida.</p>"}
      <h2>Embalagens</h2>
      ${g.embalagens.length ? `<table>${g.embalagens.map((e) => `<tr><td>${esc(e.nome)}</td><td class="q">${esc(e.quantidade)} un</td></tr>`).join("")}</table>` : "<p class=\"falta\">Embalagens não informadas.</p>"}
    </div>
  </div>
  ${g.etapas.length ? g.etapas.map((grupo) => `<h2>${esc(grupo.rotulo)}</h2><ol>${grupo.itens.map((e) => `<li><b>${esc(e.titulo)}</b>${e.texto ? `<br>${esc(e.texto).replace(/\n/g, "<br>")}` : ""}${e.minutos || e.graus ? `<br><i>${[e.minutos && `${esc(e.minutos)} min`, e.graus && `${esc(e.graus)} °C`].filter(Boolean).join(" · ")}</i>` : ""}${urlSegura(e.foto) ? `<br><img class="passo" src="${urlSegura(e.foto)}" alt="">` : ""}</li>`).join("")}</ol>`).join("") : "<p class=\"falta\">Passo a passo não escrito.</p>"}
  ${g.faltando.length ? `<p class="falta">Falta cadastrar: ${esc(g.faltando.join(", "))}.</p>` : ""}
</section>`;
  }).join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guia de montagem</title><style>
@page{size:A4;margin:12mm}
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}
.folha{page-break-after:always;padding:4px}
.folha:last-child{page-break-after:auto}
header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid #DC2626;margin-bottom:8px}
h1{font-size:24px;margin:0 0 4px}.cod{font-size:13px;color:#555}
h2{font-size:15px;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.04em}
h2 small{text-transform:none;font-weight:normal;color:#555}
.desc{color:#333;margin:0 0 8px}
.topo{display:flex;gap:16px;align-items:flex-start}.topo>div{flex:1}
.topo>img{width:220px;height:220px;object-fit:cover;border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:15px}
td{border-bottom:1px solid #ddd;padding:6px 4px}td.q{text-align:right;font-weight:bold;white-space:nowrap}
ol{padding-left:22px;font-size:15px}li{margin-bottom:8px}
img.passo{width:140px;height:100px;object-fit:cover;border-radius:6px;margin-top:4px}
.falta{color:#B45309;font-weight:bold}
</style></head><body>${folhas || "<p>Nenhuma marmita para imprimir.</p>"}</body></html>`;
}

