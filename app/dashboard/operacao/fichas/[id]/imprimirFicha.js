// Documento A4 da ficha técnica, no layout do modelo impresso da casa:
// cabeçalho com logo e quadro de controle, faixa com o nome da receita, foto +
// dados, ingredientes, modo de preparo, armazenamento, equipamentos,
// alergênicos e custo.
//
// Gera HTML puro (sem React) porque ele vai para uma janela de impressão ou
// para o gerador de PDF — os mesmos caminhos que a tela de fichas já usa.

import { logoSeldeestrelaHTML } from "../../../../lib/marca";
import {
  parseNumero, perdaPercentual, cmvPercentual, margemBruta, tempoTotal,
  tipoDaFicha, custoPorUnidadeDeRendimento,
} from "../../../../lib/ficha-calculos.mjs";
import { metodoBar } from "../../../../lib/ficha-tecnica";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

const brl = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;
// Custo por unidade de pré-preparo é miúdo (R$ 0,0052/ml). Com duas casas
// viraria "R$ 0,01" e perderia justamente a informação que interessa.
const brlUnit = (v) => {
  const n = Number(v) || 0;
  const casas = n !== 0 && Math.abs(n) < 0.1 ? 4 : 2;
  return `R$ ${n.toFixed(casas).replace(".", ",")}`;
};
const pct = (v) => `${(Number(v) || 0).toFixed(1).replace(".", ",")}%`;
const dataBR = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
};
const ou = (v, padrao = "—") => {
  const t = String(v ?? "").trim();
  return t ? esc(t) : padrao;
};

// Linha "rótulo | valor" das tabelas de duas colunas.
// O rótulo é sempre escapado — para destacar uma linha use `forte`, nunca
// passe HTML no rótulo (ele apareceria como texto).
const linha = (rotulo, valor, forte = false) =>
  `<tr class="${forte ? "forte" : ""}"><td class="rot">${esc(rotulo)}</td><td class="val">${valor}</td></tr>`;

export function montarHtmlFichaTecnica({
  ficha, etapas = [], equipamentos = [], alergenicos = [], podeConter = "",
  armazenamento = {}, montagem = [], ingredientes = [], custos = {},
  usadoPor = [], mostrarCustos = true,
}) {
  // Quatro documentos diferentes saem daqui: prato da cozinha, drink do bar,
  // pré-preparo da cozinha e pré-preparo do bar. O que cada um precisa mostrar
  // não é o mesmo, então o cabeçalho e as seções mudam.
  const preparo = tipoDaFicha(ficha) === "preparo";
  const bar = String(ficha.departamento || "").toLowerCase() === "bar";
  const unidadeRend = ficha.rendimento_unidade || "unidade";
  const tituloDoc = preparo ? "FICHA DE PRÉ-PREPARO" : bar ? "FICHA TÉCNICA DE DRINK" : "FICHA TÉCNICA";
  // Copo, gelo e guarnição são do DRINK. Um xarope é do bar e não tem nenhum
  // dos três — mostrar as linhas vazias só suja a folha.
  const drink = bar && !preparo;
  const foto = ficha.imagem
    ? (String(ficha.imagem).startsWith("data:") ? ficha.imagem : `data:image/jpeg;base64,${ficha.imagem}`)
    : "";

  const porcoes = parseNumero(ficha.rendimento_porcoes);
  const pesoFinal = parseNumero(ficha.peso_final_g);
  const perda = perdaPercentual(ficha.peso_bruto_g, ficha.peso_final_g);
  const total = tempoTotal(ficha.tempo_preparo, ficha.tempo_coccao_min);

  const custoTotal = parseNumero(custos.custoTotal);
  const custoPorcao = parseNumero(custos.custoPorcao);
  const preco = parseNumero(ficha.preco_venda);
  const cmv = cmvPercentual(custoPorcao, preco);

  // ── Ingredientes ─────────────────────────────────────────────────────────
  const linhasIngredientes = ingredientes.length
    ? ingredientes.map(i => `
        <tr>
          <td>${esc(i.nome)}${i.subreceita ? ' <span class="tag">subreceita</span>' : ""}</td>
          <td class="c">${ou(i.unidade)}</td>
          <td class="c">${esc(String(i.quantidade ?? ""))}</td>
          <td>${ou(i.observacao, "–")}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="vazio">Sem ingredientes cadastrados.</td></tr>`;

  // ── Modo de preparo ──────────────────────────────────────────────────────
  // Quando não há etapas estruturadas, cai para o texto livre antigo.
  let blocoPreparo;
  if (etapas.length) {
    blocoPreparo = `
      <table class="t preparo">
        <tbody>
          ${etapas.map((e, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td class="tit">${ou(e.titulo, "")}</td>
              <td>
                ${ou(e.instrucao, "")}
                ${[
                  e.tempo_min ? `${esc(String(e.tempo_min))} min` : "",
                  e.temperatura ? esc(e.temperatura) : "",
                  e.equipamento ? esc(e.equipamento) : "",
                ].filter(Boolean).length
                  ? `<div class="meta">${[
                      e.tempo_min ? `⏱ ${esc(String(e.tempo_min))} min` : "",
                      e.temperatura ? `🌡 ${esc(e.temperatura)}` : "",
                      e.equipamento ? `⚙ ${esc(e.equipamento)}` : "",
                    ].filter(Boolean).join(" &nbsp;·&nbsp; ")}</div>`
                  : ""}
                ${e.observacao ? `<div class="obs">${esc(e.observacao)}</div>` : ""}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } else if (ficha.modo_preparo) {
    blocoPreparo = `<div class="texto">${esc(ficha.modo_preparo).replace(/\n/g, "<br/>")}</div>`;
  } else {
    blocoPreparo = `<div class="texto vazio">Sem modo de preparo cadastrado.</div>`;
  }

  // ── Armazenamento ────────────────────────────────────────────────────────
  const validades = [
    armazenamento.validade_refrigerado_dias != null && armazenamento.validade_refrigerado_dias !== ""
      ? `Refrigerado: ${esc(String(armazenamento.validade_refrigerado_dias))} dias` : "",
    armazenamento.validade_congelado_dias != null && armazenamento.validade_congelado_dias !== ""
      ? `Congelado: ${esc(String(armazenamento.validade_congelado_dias))} dias` : "",
    armazenamento.validade_apos_aberto_dias != null && armazenamento.validade_apos_aberto_dias !== ""
      ? `Após aberto: ${esc(String(armazenamento.validade_apos_aberto_dias))} dias` : "",
    armazenamento.validade_apos_preparo_horas != null && armazenamento.validade_apos_preparo_horas !== ""
      ? `Após preparo: ${esc(String(armazenamento.validade_apos_preparo_horas))} h` : "",
  ].filter(Boolean);

  const faixaTemp = [armazenamento.temperatura_min, armazenamento.temperatura_max]
    .some(v => v != null && v !== "")
    ? `${armazenamento.temperatura_min ?? "—"} a ${armazenamento.temperatura_max ?? "—"} °C`
    : "—";

  const blocoCustos = mostrarCustos ? `
    <div class="col">
      <div class="faixa">CUSTO DA RECEITA</div>
      <table class="t duas">
        <tbody>
          ${linha("Custo dos ingredientes", brl(custos.custoIngredientes))}
          ${parseNumero(custos.custoSubreceitas) ? linha("Custo de subreceitas", brl(custos.custoSubreceitas)) : ""}
          ${parseNumero(custos.custoEmbalagem) ? linha("Custo de embalagem", brl(custos.custoEmbalagem)) : ""}
          ${parseNumero(custos.custoIndireto) ? linha("Custos indiretos", brl(custos.custoIndireto)) : ""}
          ${linha(preparo ? "Custo do lote" : "Custo total", brl(custoTotal), true)}
          ${preparo
            ? linha(`Custo por ${unidadeRend}`, brlUnit(custoPorUnidadeDeRendimento(custoTotal, porcoes)), true)
            : `${porcoes > 1 ? linha("Custo por porção", brl(custoPorcao)) : ""}
               ${preco ? linha("Preço de venda", brl(preco)) : ""}
               ${preco ? linha("CMV", pct(cmv)) : ""}
               ${preco ? linha("Margem bruta", brl(margemBruta(custoPorcao, preco))) : ""}`}
        </tbody>
      </table>
    </div>` : "";

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Ficha Técnica — ${esc(ficha.nome_receita)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;background:#fff;
       padding:12mm 10mm;max-width:820px;margin:0 auto;font-size:11.5px;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:0}

  /* Cabeçalho */
  .topo{display:flex;align-items:center;gap:16px;padding-bottom:10px}
  .marca{flex:0 0 auto;padding-right:16px;border-right:1px solid #d6d3d1}
  .titulo-doc{flex:1;text-align:center}
  .titulo-doc h1{font-size:20px;letter-spacing:2px;font-weight:normal;color:#3f2a17}
  .titulo-doc p{font-size:10px;letter-spacing:4px;color:#78716c;margin-top:2px}
  .controle{flex:0 0 auto;border:1px solid #d6d3d1;border-collapse:collapse;font-size:10px}
  .controle td{border:1px solid #e7e5e4;padding:4px 8px}
  .controle td:first-child{background:#faf9f7;font-weight:bold;color:#57534e;letter-spacing:.5px}

  /* Faixa de seção */
  .faixa{background:#5c3a21;color:#fff;font-weight:bold;font-size:12px;
         letter-spacing:1px;padding:6px 10px;margin:14px 0 0}
  .nome-receita{background:#5c3a21;color:#fff;font-size:22px;font-weight:bold;
                padding:10px 14px;margin:10px 0 12px;letter-spacing:.5px}

  /* Tabelas */
  .t{width:100%;border-collapse:collapse;font-size:11px}
  .t td,.t th{border:1px solid #e7e5e4;padding:6px 8px;vertical-align:top}
  .t thead th{background:#f5f5f4;font-size:10px;letter-spacing:.5px;text-align:left;color:#44403c}
  .t .c{text-align:center}
  .t .rot{background:#faf9f7;font-weight:bold;color:#57534e;width:45%}
  .t tr.forte td{background:#f5f5f4;font-weight:bold;color:#1c1917;font-size:12px}
  .duas{margin-top:0}
  .vazio{color:#a8a29e;font-style:italic;text-align:center}
  .tag{background:#fed7aa;color:#9a3412;font-size:9px;padding:1px 4px;border-radius:3px}

  /* Topo da receita: foto + dados */
  .resumo{display:flex;gap:12px;align-items:stretch}
  .foto{width:210px;height:210px;object-fit:cover;flex:0 0 auto;border:1px solid #e7e5e4}
  .sem-foto{width:210px;height:210px;flex:0 0 auto;border:1px dashed #d6d3d1;background:#faf9f7;
            display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:10px}
  .resumo .t{flex:1}

  /* Preparo */
  .preparo .num{width:26px;text-align:center;font-weight:bold;background:#faf9f7}
  .preparo .tit{width:150px;font-weight:bold}
  .preparo .meta{margin-top:3px;color:#78716c;font-size:10px}
  .preparo .obs{margin-top:3px;color:#92400e;font-size:10px;font-style:italic}
  .texto{border:1px solid #e7e5e4;padding:8px;font-size:11px;line-height:1.5}

  /* Duas colunas lado a lado */
  .duplo{display:flex;gap:10px;align-items:flex-start}
  .duplo .col{flex:1;min-width:0}
  .duplo .faixa{margin-top:14px}
  .lista{border:1px solid #e7e5e4;padding:7px 9px;font-size:11px;line-height:1.6}

  .rodape{margin-top:18px;padding-top:8px;border-top:1px solid #d6d3d1;
          text-align:center;font-size:9.5px;letter-spacing:3px;color:#78716c}
  @media print{.__fechar{display:none!important}}
</style></head><body>

  <div class="topo">
    <div class="marca">${logoSeldeestrelaHTML(42)}</div>
    <div class="titulo-doc">
      <h1>${tituloDoc}</h1>
      <p>LIVRO DE RECEITAS</p>
    </div>
    <table class="controle">
      <tbody>
        <tr><td>CÓDIGO</td><td>${ou(ficha.codigo)}</td></tr>
        <tr><td>VERSÃO</td><td>${ou(ficha.versao, "1.0")}</td></tr>
        <tr><td>DATA</td><td>${dataBR(ficha.atualizado_em || ficha.created_at)}</td></tr>
        <tr><td>RESPONSÁVEL</td><td>${ou(ficha.responsavel)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="nome-receita">${esc(ficha.nome_comercial || ficha.nome_receita)}</div>

  <div class="resumo">
    ${foto ? `<img class="foto" src="${foto}" alt=""/>` : `<div class="sem-foto">sem foto</div>`}
    <table class="t">
      <tbody>
        ${linha("CATEGORIA", [ou(ficha.categoria, ""), ou(ficha.subcategoria, "")].filter(t => t && t !== "—").join(" / ") || "—")}
        ${linha("RENDIMENTO", porcoes ? `${esc(String(porcoes))} ${ou(ficha.rendimento_unidade, "")}`.trim() : "—")}
        ${linha("TEMPO DE PREPARO", ou(ficha.tempo_preparo))}
        ${bar ? "" : linha("TEMPO DE COCÇÃO", ficha.tempo_coccao_min ? `${esc(String(ficha.tempo_coccao_min))} minutos` : "—")}
        ${total ? linha("TEMPO TOTAL", `${total} minutos`) : ""}
        ${drink ? linha("MÉTODO", metodoBar(ficha.metodo_bar)?.nome || "—") : ""}
        ${drink ? linha("COPO", ou(ficha.copo)) : ""}
        ${drink ? linha("GELO", ou(ficha.tipo_gelo)) : ""}
        ${drink ? linha("GUARNIÇÃO", ou(ficha.guarnicao)) : ""}
        ${linha(bar ? "VOLUME FINAL (aprox.)" : "PESO FINAL (aprox.)",
                pesoFinal ? `${Math.round(pesoFinal)} ${bar ? "ml" : "g"}` : "—")}
        ${perda ? linha("PERDA", pct(perda)) : ""}
        ${preparo ? linha("CUSTO POR " + unidadeRend.toUpperCase(),
                          brlUnit(custoPorUnidadeDeRendimento(custos.custoTotal, porcoes))) : ""}
        ${linha("SETOR", ou(ficha.departamento))}
      </tbody>
    </table>
  </div>

  <div class="faixa">INGREDIENTES</div>
  <table class="t">
    <thead><tr><th>INGREDIENTE</th><th style="width:70px">UNIDADE</th><th style="width:80px">QUANTIDADE</th><th style="width:34%">OBSERVAÇÃO</th></tr></thead>
    <tbody>${linhasIngredientes}</tbody>
  </table>

  <div class="faixa">MODO DE PREPARO</div>
  ${blocoPreparo}

  ${preparo && usadoPor.length ? `
    <div class="faixa">USADO NAS RECEITAS</div>
    <div class="lista">${usadoPor.map(f => esc(f.nome_receita)).join(" &nbsp;·&nbsp; ")}</div>
  ` : ""}

  ${!preparo && montagem.length ? `
    <div class="faixa">${bar ? "MONTAGEM NO COPO" : "MONTAGEM"}</div>
    <div class="lista">${montagem.map((m, i) => `${i + 1}. ${esc(m.descricao || m)}`).join("<br/>")}</div>
  ` : ""}

  <div class="duplo">
    <div class="col">
      <div class="faixa">ARMAZENAMENTO E VALIDADE</div>
      <table class="t duas">
        <tbody>
          ${linha("Forma", ou(armazenamento.forma))}
          ${linha("Recipiente", ou(armazenamento.recipiente))}
          ${linha("Local", ou(armazenamento.local_armazenamento))}
          ${linha("Temperatura", faixaTemp)}
          ${linha("Validade", validades.length ? validades.join("<br/>") : "—")}
          ${armazenamento.observacoes ? linha("Observações", esc(armazenamento.observacoes)) : ""}
        </tbody>
      </table>
    </div>
    <div class="col">
      <div class="faixa">EQUIPAMENTOS E UTENSÍLIOS</div>
      <div class="lista">${equipamentos.length ? esc(equipamentos.join(", ")) + "." : "—"}</div>

      <div class="faixa">ALERGÊNICOS</div>
      <div class="lista">
        ${alergenicos.length ? `<b>Contém:</b> ${esc(alergenicos.join(", ").toLowerCase())}.` : "Não declarado."}
        ${podeConter ? `<br/><b>Pode conter:</b> ${esc(podeConter)}.` : ""}
      </div>
    </div>
  </div>

  <div class="duplo">
    ${blocoCustos}
    <div class="col">
      <div class="faixa">INFORMAÇÕES ADICIONAIS</div>
      <table class="t duas">
        <tbody>
          ${preparo
            ? linha("Uso", usadoPor.length ? `Ingrediente de ${usadoPor.length} receita(s)` : "Ainda não usado em receitas")
            : linha("Padrão de montagem", montagem.length ? "Conforme a seção Montagem" : "Conforme foto")}
          ${ficha.temperatura_servico ? linha("Temperatura de serviço", esc(ficha.temperatura_servico)) : ""}
          ${linha("Observações", ou(ficha.observacoes, "Manter padrão de gramatura e montagem para garantir a qualidade."))}
        </tbody>
      </table>
    </div>
  </div>

  <div class="rodape">SABORES DA AMAZÔNIA EM CADA MORDIDA</div>
</body></html>`;
}
