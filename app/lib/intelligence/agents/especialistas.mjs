// AGENTES ESPECIALISTAS — não são IAs independentes: são módulos de domínio
// que sabem quais métricas do Metrics Engine respondem cada intenção e como
// apresentá-las. Nenhum agente lê banco direto nem faz conta própria.
//
// Cada handler devolve { texto, blocos, acoes, nivel } — o orquestrador junta.

import { NIVEL } from "../core/niveis.mjs";
import { DADOS_INSUFICIENTES, NATUREZA, temValor } from "../core/contratos.mjs";
import { normalizar } from "../metrics/produtos.mjs";
import { generateDailyBrief } from "../insights/daily-brief.mjs";
import { fraseDaMetrica, blocoMetrica, blocoLista, blocoInsight, blocoTexto, brl, num, ddmm, valorFormatado } from "../commands/resposta.mjs";

const r = (texto, blocos = [], acoes = [], nivel = NIVEL.OBSERVAR) => ({ texto, blocos, acoes, nivel });
const insuf = (m, rotulo) => r(fraseDaMetrica(m, rotulo), [blocoMetrica(m, rotulo)], [], NIVEL.OBSERVAR);

// ─── Vendas ──────────────────────────────────────────────────────────────────
export const AgenteVendas = {
  id: "vendas", nome: "SalesAgent",
  async "vendas.faturamento"({ motor, params }) {
    const m = await motor.getRevenue(params.periodo || "hoje");
    const acoes = [{ rotulo: "Ver faturamento diário", rota: "/dashboard/operacao/estoque/cmv" }];
    if (!temValor(m)) return { ...insuf(m, "Faturamento"), acoes: m.status === "insuficiente" ? [{ rotulo: "Lançar faturamento", rota: "/dashboard/operacao/estoque/cmv" }] : [] };
    const d = m.detalhes;
    const itens = [
      { rotulo: "Vendas brutas", valor: brl(d.vendasBrutas) },
      { rotulo: "Cancelamentos", valor: brl(d.cancelamentos) },
      { rotulo: "Descontos", valor: brl(d.descontos) },
      ...(d.porDia.length > 1 ? d.porDia.map((x) => ({ rotulo: ddmm(x.data), valor: brl(x.receita) })) : []),
    ];
    return r(fraseDaMetrica(m, "Faturamento"), [blocoMetrica(m, "Faturamento"), blocoLista("Composição", itens)], acoes, m.comparacao ? NIVEL.ANALISAR : NIVEL.OBSERVAR);
  },
  async "vendas.ticket_medio"({ motor }) {
    return insuf(await motor.semBase("ticket_medio"), "Ticket médio");
  },
};

// ─── Compras ─────────────────────────────────────────────────────────────────
export const AgenteCompras = {
  id: "compras", nome: "PurchaseAgent",
  async "compras.total"({ motor, params }) {
    const m = await motor.getPurchasesTotal(params.periodo || "semana");
    if (!temValor(m)) return insuf(m, "Compras");
    const blocos = [blocoMetrica(m, "Compras confirmadas")];
    let texto = fraseDaMetrica(m, "Compras confirmadas");
    if (params.produto) {
      const alvo = normalizar(params.produto);
      const doProduto = m.detalhes.itens.filter((i) => normalizar(i.nome).includes(alvo));
      texto += doProduto.length
        ? ` Com "${params.produto}" no nome: ${doProduto.map((i) => `${i.nome} ${brl(i.valor)} (${num(i.quantidade)} ${i.unidade})`).join("; ")}.`
        : ` Não encontrei compras com "${params.produto}" no nome do produto nesse período (a busca é pelo nome, não por categoria).`;
    }
    blocos.push(blocoLista("Itens que mais pesaram", m.detalhes.itens.slice(0, 6).map((i) => ({ rotulo: i.nome, valor: brl(i.valor), detalhe: `${num(i.quantidade)} ${i.unidade}` }))));
    if (m.detalhes.fornecedores.length) blocos.push(blocoLista("Por fornecedor", m.detalhes.fornecedores.slice(0, 5).map((f) => ({ rotulo: f.nome, valor: brl(f.valor), detalhe: `${f.compras} compra(s)` }))));
    return r(texto, blocos, [{ rotulo: "Ver compras", rota: "/dashboard/operacao/estoque/compras" }], m.comparacao ? NIVEL.ANALISAR : NIVEL.OBSERVAR);
  },
  async "compras.maior_aumento_preco"({ motor }) {
    const m = await motor.getPriceChanges();
    if (!temValor(m)) return insuf(m, "Variação de preço");
    const x = m.detalhes.maior;
    const texto = x.pct > 0
      ? `Maior aumento: ${x.nome}, de ${brl(x.precoAnterior)}/${x.unidade} (${ddmm(x.dataAnterior)}) para ${brl(x.precoAtual)}/${x.unidade} (${ddmm(x.dataAtual)}): +${num(x.pct, 1)}%.`
      : `Nenhum produto ficou mais caro na última compra. A maior variação foi ${x.nome}: ${num(x.pct, 1)}%.`;
    const linha = (p) => ({ rotulo: p.nome, valor: `${p.pct > 0 ? "+" : ""}${num(p.pct, 1)}%`, detalhe: `${brl(p.precoAnterior)} → ${brl(p.precoAtual)}/${p.unidade} · ${ddmm(p.dataAtual)}${p.fornecedorAtual ? ` · ${p.fornecedorAtual}` : ""}` });
    const blocos = [blocoMetrica(m, "Maior variação de preço")];
    if (m.detalhes.aumentos.length) blocos.push(blocoLista("Aumentos", m.detalhes.aumentos.map(linha)));
    if (m.detalhes.quedas.length) blocos.push(blocoLista("Quedas", m.detalhes.quedas.map(linha)));
    return r(texto, blocos, [{ rotulo: "Ver compras", rota: "/dashboard/operacao/estoque/compras" }], NIVEL.ANALISAR);
  },
  async "compras.criar"() {
    return r("Criar compra pela conversa ainda não está disponível. Abra Compras para lançar.", [], [{ rotulo: "Abrir compras", rota: "/dashboard/operacao/estoque/compras" }]);
  },
};

// ─── Estoque ─────────────────────────────────────────────────────────────────
export const AgenteEstoque = {
  id: "estoque", nome: "StockAgent",
  async "estoque.vencimentos"({ motor, params }) {
    const dias = params.dias || 3;
    const m = await motor.getExpiringProducts({ dias });
    if (!temValor(m)) return insuf(m, "Validade");
    const d = m.detalhes;
    const partes = [m.valor
      ? `${d.vencidos.length} lote(s) vencido(s) e ${d.aVencer.length} vencendo até ${ddmm(m.periodo.ate)}.${d.valorEstimado ? ` Valor estimado ao custo médio: ${brl(d.valorEstimado.valor)} (ESTIMATIVA).` : ""}`
      : d.lotesSemValidade && !d.lotesAvaliados
        ? `Nenhum dos ${d.lotesSemValidade} lote(s) com saldo tem validade informada.`
        : `Nenhum lote com saldo vence até ${ddmm(m.periodo.ate)}.`];
    if (d.totalEtiquetas) partes.push(`${d.totalEtiquetas} etiqueta(s) ativa(s) com validade até ${ddmm(m.periodo.ate)}${d.etiquetas[0]?.vencido ? `; a mais antiga venceu em ${ddmm(d.etiquetas[0].validade)}` : ""}.`);
    const texto = partes.join(" ");
    const linha = (l) => ({ rotulo: `${l.produto} · ${l.local}`, valor: `${num(l.quantidade)} ${l.unidade}`, detalhe: `${l.vencido ? "venceu" : "vence"} ${ddmm(l.validade)}${l.valorEstimado != null ? ` · ${brl(l.valorEstimado)} (estimativa)` : ""}` });
    const blocos = [blocoMetrica(m, "Lotes vencidos ou vencendo")];
    if (d.vencidos.length) blocos.push(blocoLista("Vencidos com saldo", d.vencidos.map(linha)));
    if (d.aVencer.length) blocos.push(blocoLista(`Vencem até ${ddmm(m.periodo.ate)}`, d.aVencer.map(linha)));
    if (d.etiquetas.length) blocos.push(blocoLista("Etiquetas ativas", d.etiquetas.map((e) => ({ rotulo: e.produto, valor: `${e.quantidade ?? ""} ${e.unidade ?? ""}`.trim(), detalhe: `validade ${ddmm(e.validade)}` }))));
    const acoes = [{ rotulo: "Ver validades", rota: "/dashboard/operacao/validade" }];
    if (d.vencidos[0]) acoes.unshift({ rotulo: `Registrar perda de ${d.vencidos[0].produto}`, comando: `Registrar perda de ${num(d.vencidos[0].quantidade)} ${d.vencidos[0].unidade} de ${d.vencidos[0].produto} por vencimento` });
    return r(texto, blocos, acoes, m.valor || d.etiquetas.some((e) => e.vencido) ? NIVEL.DETECTAR : NIVEL.OBSERVAR);
  },
  async "estoque.divergencias"({ motor }) {
    const m = await motor.getStockVariance();
    if (!temValor(m)) return insuf(m, "Divergências de estoque");
    const d = m.detalhes;
    const partes = [];
    if (d.inventario) partes.push(d.totalContagem ? `No inventário de ${ddmm(d.inventario.data)}, ${d.totalContagem} produto(s) ficaram ${d.inventario.limitePct}% ou mais longe do esperado.` : `No inventário de ${ddmm(d.inventario.data)}, nenhum produto ficou ${d.inventario.limitePct}% ou mais longe do esperado.`);
    if (d.totalIntegridade) partes.push(`${d.totalIntegridade} produto(s) com saldo diferente da soma dos lotes.`);
    if (!partes.length) partes.push("Não encontrei diferenças nos dados disponíveis.");
    const blocos = [blocoMetrica(m, "Divergências")];
    if (d.contagem.length) blocos.push(blocoLista("Contado × esperado", d.contagem.map((x) => ({ rotulo: x.produto, valor: `${x.diferenca > 0 ? "+" : ""}${num(x.diferenca)} ${x.unidade}`, detalhe: `esperado ${num(x.esperado)} · contado ${num(x.contado)}${x.valor != null ? ` · ${brl(Math.abs(x.valor))}` : ""}` }))));
    if (d.integridade.length) blocos.push(blocoLista("Saldo × lotes", d.integridade.map((x) => ({ rotulo: x.produto, valor: `saldo ${num(x.saldo)}`, detalhe: `lotes ${num(x.somaDosLotes)}` }))));
    if (d.contagem.length) blocos.push(blocoTexto("Possíveis causas de falta: perda não registrada, produção não registrada, erro de ficha técnica, consumo interno, transferência ou erro de contagem. Não foi possível determinar com segurança qual delas — confirme na Central.", "Possível causa"));
    for (const o of m.observacoes) blocos.push(blocoTexto(o));
    return r(partes.join(" "), blocos, [{ rotulo: "Ver contagens", rota: "/dashboard/operacao/estoque/contagens" }], NIVEL.DETECTAR);
  },
  async "estoque.perdas"({ motor, params }) {
    const m = await motor.getWaste(params.periodo || "semana");
    if (!temValor(m)) return insuf(m, "Perdas");
    const blocos = [blocoMetrica(m, "Perdas registradas")];
    if (m.detalhes.porProduto.length) blocos.push(blocoLista("Por produto", m.detalhes.porProduto.map((p) => ({ rotulo: p.produto, valor: brl(p.valor), detalhe: `${num(p.quantidade)} ${p.unidade} · ${p.motivos.join(", ")}` }))));
    return r(`${fraseDaMetrica(m, "Perdas registradas")} ${m.detalhes.lancamentos} lançamento(s).`, blocos, [{ rotulo: "Ver estoque", rota: "/dashboard/operacao/estoque?gestao=1" }], NIVEL.ANALISAR);
  },
  async "estoque.saldo_produto"({ motor, params, ic }) {
    // Produto da tela/conversa: vale pelo id, reconferido no cadastro DA UNIDADE (o nome é só rótulo).
    const insumoId = params.insumoIdContexto || null;
    const termo = insumoId ? null : params.produto;
    if (!termo && !insumoId) return { ...r("De qual produto?"), pergunta: { campo: "produto", texto: "De qual produto você quer saber o saldo?", livre: true, comandoBase: "Quanto tenho de {valor}?" } };
    const m = await motor.getProductStock(insumoId ? { insumoId } : { termo });
    if (m.status === "insuficiente" && m.detalhes?.ambiguo) {
      return { ...r(m.motivo), pergunta: { campo: "produto", texto: m.motivo, opcoes: m.detalhes.opcoes.map((o) => ({ id: o.id, rotulo: o.nome, comando: `Quanto tenho de ${o.nome}?` })) } };
    }
    if (!temValor(m)) return insuf(m, "Saldo");
    const d = m.detalhes;
    const texto = `${d.produto.nome}: ${valorFormatado(m)} em estoque${d.locais.length > 1 ? ` (${d.locais.map((l) => `${l.local} ${num(l.quantidade)}`).join(", ")})` : d.locais[0] ? ` (${d.locais[0].local})` : ""}.${d.valorAoCustoMedio ? ` Valor ao custo médio: ${brl(d.valorAoCustoMedio.valor)} (ESTIMATIVA).` : ""}`;
    return { ...r(texto, [blocoMetrica(m, `Saldo de ${d.produto.nome}`), blocoLista("Por local", d.locais.map((l) => ({ rotulo: l.local, valor: `${num(l.quantidade)} ${m.unidade}`, detalhe: l.minimo ? `mínimo ${num(l.minimo)}` : null })))], [{ rotulo: "Abrir estoque", rota: "/dashboard/operacao/estoque?gestao=1" }]),
      referencia: { produto: { id: d.produto.id, nome: d.produto.nome } } };
  },
  async "estoque.abaixo_minimo"({ motor }) {
    const m = await motor.getLowStock();
    if (!temValor(m)) return insuf(m, "Abaixo do mínimo");
    const texto = m.valor ? `${m.valor} item(ns) abaixo do estoque mínimo.` : m.detalhes.itensComMinimo ? "Nenhum item abaixo do estoque mínimo." : `${DADOS_INSUFICIENTES}. Nenhum produto tem estoque mínimo configurado.`;
    return r(texto, [blocoMetrica(m, "Abaixo do mínimo"), blocoLista("Itens", m.detalhes.lista.map((i) => ({ rotulo: `${i.produto} · ${i.local}`, valor: `${num(i.saldo)} ${i.unidade}`, detalhe: `mínimo ${num(i.minimo)}` })))], [{ rotulo: "Ver estoque", rota: "/dashboard/operacao/estoque?gestao=1" }], NIVEL.DETECTAR);
  },
  async "produto.explicar_variacao"({ motor, params, ic }) {
    const insumoId = params.insumoIdContexto || null;
    const termo = insumoId ? null : params.produto;
    if (!termo && !insumoId) return { ...r("Sobre qual produto?"), pergunta: { campo: "produto", texto: "Sobre qual produto você quer saber?", livre: true, comandoBase: "Por que {valor} aumentou?" } };
    const [saldo, precos] = await Promise.all([motor.getProductStock(insumoId ? { insumoId } : { termo }), motor.getPriceChanges()]);
    if (saldo.status === "insuficiente" && saldo.detalhes?.ambiguo) {
      return { ...r(saldo.motivo), pergunta: { campo: "produto", texto: saldo.motivo, opcoes: saldo.detalhes.opcoes.map((o) => ({ id: o.id, rotulo: o.nome, comando: `Por que ${o.nome} aumentou?` })) } };
    }
    if (!temValor(saldo)) return insuf(saldo, "Produto");
    const id = saldo.detalhes.produto.id;
    const nome = saldo.detalhes.produto.nome;
    const lista = temValor(precos) ? [...precos.detalhes.aumentos, ...precos.detalhes.quedas] : [];
    const p = lista.find((x) => x.insumo_id === id);
    const blocos = [blocoMetrica(saldo, `Saldo de ${nome}`)];
    let texto;
    if (p) {
      texto = `Possível causa: o preço de compra de ${nome} ${p.pct > 0 ? "subiu" : "caiu"} ${num(Math.abs(p.pct), 1)}% — de ${brl(p.precoAnterior)}/${p.unidade} (${ddmm(p.dataAnterior)}) para ${brl(p.precoAtual)}/${p.unidade} (${ddmm(p.dataAtual)}).`;
      blocos.push(blocoTexto(texto, "Possível causa"), blocoMetrica(precos, "Variação de preço (todos os produtos)"));
    } else {
      texto = `Não encontrei variação de preço registrada para ${nome} nas compras confirmadas. Não foi possível determinar com segurança o que mudou. Saldo atual: ${valorFormatado(saldo)}.`;
      blocos.push(blocoTexto(texto, "Não foi possível determinar com segurança"));
    }
    return { ...r(texto, blocos, [{ rotulo: "Ver compras", rota: "/dashboard/operacao/estoque/compras" }], NIVEL.ANALISAR), referencia: { produto: { id, nome } } };
  },
};

// ─── Financeiro ──────────────────────────────────────────────────────────────
export const AgenteFinanceiro = {
  id: "financeiro", nome: "FinancialAgent",
  async "financeiro.contas_a_vencer"({ motor, params }) {
    const dias = params.dias || 7;
    const m = await motor.getAccountsPayable({ dias });
    if (!temValor(m)) return insuf(m, "Contas a pagar");
    const d = m.detalhes;
    const texto = `${d.vencidas.qtd} vencida(s) (${brl(d.vencidas.valor)}), ${d.hoje.qtd} vencendo hoje (${brl(d.hoje.valor)}) e ${d.proximas.qtd} até ${ddmm(m.periodo.ate)} (${brl(d.proximas.valor)}). Total em aberto: ${brl(m.valor)}.`;
    const linha = (c) => ({ rotulo: `${c.descricao}${c.fornecedor ? ` · ${c.fornecedor}` : ""}`, valor: brl(c.saldo), detalhe: `vence ${ddmm(c.vencimento)}` });
    const blocos = [blocoMetrica(m, "Contas em aberto")];
    if (d.vencidas.lista.length) blocos.push(blocoLista("Vencidas", d.vencidas.lista.map(linha)));
    if (d.hoje.lista.length) blocos.push(blocoLista("Vencem hoje", d.hoje.lista.map(linha)));
    if (d.proximas.lista.length) blocos.push(blocoLista(`Até ${ddmm(m.periodo.ate)}`, d.proximas.lista.map(linha)));
    return r(texto, blocos, [{ rotulo: "Abrir contas a pagar", rota: "/dashboard/financeiro/contas" }], d.vencidas.qtd ? NIVEL.DETECTAR : NIVEL.OBSERVAR);
  },
  async "custos.cmv"({ motor }) {
    const m = await motor.getCMV();
    if (!temValor(m)) return { ...insuf(m, "CMV"), acoes: [{ rotulo: "Abrir CMV real", rota: "/dashboard/operacao/estoque/cmv" }] };
    const d = m.detalhes;
    const blocos = [blocoMetrica(m, "CMV real"), blocoLista("Composição (entre inventários)", [
      { rotulo: "Estoque inicial", valor: brl(d.estoqueInicial) }, { rotulo: "+ Compras", valor: brl(d.compras) },
      { rotulo: "− Estoque final", valor: brl(d.estoqueFinal) }, { rotulo: "= CMV", valor: brl(d.cmvReais) },
      d.faturamento != null ? { rotulo: "Faturamento", valor: brl(d.faturamento) } : null,
    ])];
    let texto = fraseDaMetrica(m, "CMV real");
    if (d.mediaHistorica) texto += ` Média própria dos ${d.mediaHistorica.periodos} períodos anteriores: ${num(d.mediaHistorica.valor, 1)}%.`;
    return r(texto, blocos, [{ rotulo: "Por quê?", comando: "Por que o CMV subiu?" }, { rotulo: "Abrir CMV real", rota: "/dashboard/operacao/estoque/cmv" }], NIVEL.ANALISAR);
  },
  async "custos.por_que_cmv"({ motor }) {
    const m = await motor.getCMV();
    if (!temValor(m)) return insuf(m, "CMV");
    const d = m.detalhes;
    const c = d.contribuicoes;
    const itens = [];
    if (c?.compras) itens.push({ rotulo: "Compras", valor: `${c.compras.valor > 0 ? "+" : ""}${brl(c.compras.valor)}`, detalhe: c.compras.pct != null ? `${c.compras.pct > 0 ? "+" : ""}${num(c.compras.pct, 1)}% sobre o período anterior` : null });
    if (c?.estoqueFinal) itens.push({ rotulo: "Estoque final", valor: `${c.estoqueFinal.valor > 0 ? "+" : ""}${brl(c.estoqueFinal.valor)}`, detalhe: "estoque final menor = mais consumo/perda no período" });
    if (c?.faturamento) itens.push({ rotulo: "Faturamento", valor: `${c.faturamento.valor > 0 ? "+" : ""}${brl(c.faturamento.valor)}`, detalhe: "faturamento menor aumenta o CMV %" });
    const blocos = [blocoMetrica(m, "CMV real")];
    if (itens.length) blocos.push(blocoLista("O que mudou contra o período anterior", itens));
    for (const a of d.alertas) blocos.push(blocoTexto(a.texto, "Sinal no período"));
    blocos.push(blocoTexto("Não foi possível determinar com segurança qual fator pesou mais: compras, estoque e faturamento mudaram juntos. Perdas não registradas e erros de contagem também aparecem como consumo.", "Não foi possível determinar com segurança"));
    const texto = c ? `CMV real ${valorFormatado(m)} em ${m.periodo.rotulo}. Os fatores que mudaram estão abaixo; não dá para afirmar a causa só com esses números.` : `${fraseDaMetrica(m, "CMV real")} Ainda não há período anterior apurado para comparar.`;
    return r(texto, blocos, [{ rotulo: "Abrir CMV real", rota: "/dashboard/operacao/estoque/cmv" }], NIVEL.RECOMENDAR);
  },
  async "financeiro.lucro"({ motor }) {
    return insuf(await motor.semBase("lucro"), "Lucro");
  },
};

// ─── RH ──────────────────────────────────────────────────────────────────────
export const AgenteRH = {
  id: "rh", nome: "HumanResourcesAgent",
  async "custos.cmo"({ motor }) {
    const m = await motor.getCMO();
    if (!temValor(m)) return insuf(m, "CMO");
    const d = m.detalhes;
    let texto = `${fraseDaMetrica(m, "CMO")} Folha (cadastro) ${brl(d.folha)} + extras pagos ${brl(d.extras)}.`;
    texto += d.percentual ? ` CMO %: ${num(d.percentual.valor, 1)}% do faturamento do mês.` : " CMO %: DADOS INSUFICIENTES (faturamento do mês incompleto).";
    return r(texto, [blocoMetrica(m, "CMO do mês"), blocoLista("Composição", [{ rotulo: "Salários + VA (cadastro do RH)", valor: brl(d.folha) }, { rotulo: "Diárias de extras pagas", valor: brl(d.extras), detalhe: `${d.recibosPagos} recibo(s)` }])], [{ rotulo: "Abrir RH", rota: "/dashboard/rh" }], NIVEL.ANALISAR);
  },
  async "rh.hora_extra"({ motor }) {
    return insuf(await motor.semBase("hora_extra"), "Hora extra");
  },
};

// ─── Operações (resumo do dia: consulta vários agentes) ──────────────────────
export const AgenteOperacoes = {
  id: "operacoes", nome: "OperationsAgent",
  async "empresa.resumo_dia"({ motor, store, nomeUsuario }) {
    const b = await generateDailyBrief({ motor, store, nomeUsuario });
    const fat = b.metrics.find((x) => x.id === "faturamento_hoje")?.metrica;
    const destaques = [...b.critical, ...b.warnings, ...b.opportunities].slice(0, 4);
    const texto = `${b.summary} ${fraseDaMetrica(fat, "Faturamento de hoje")}`;
    const blocos = [blocoMetrica(fat, "Faturamento de hoje"), ...destaques.map(blocoInsight)];
    return { ...r(texto, blocos, [{ rotulo: "Abrir Central de Inteligência", rota: "/dashboard/inteligencia" }], destaques.length ? NIVEL.RECOMENDAR : NIVEL.ANALISAR), brief: b,
      referencia: { insights: destaques.map((i) => i.id) } };
  },
  // "Tem alguma coisa errada?": só o que merece atenção, mais importante primeiro.
  async "empresa.problemas"({ motor, store, nomeUsuario }) {
    const b = await generateDailyBrief({ motor, store, nomeUsuario });
    const atencao = [...b.critical, ...b.warnings];
    const semBase = b.cobertura.filter((x) => x.status === "insuficiente").length;
    const nota = semBase ? ` ${semBase} indicador(es) estão sem dados suficientes para eu analisar.` : "";
    if (!atencao.length) {
      return { ...r(`Não encontrei nada fora do padrão nos dados disponíveis.${nota}`, [], [{ rotulo: "Abrir Central de Inteligência", rota: "/dashboard/inteligencia" }], NIVEL.DETECTAR), referencia: { insights: [] } };
    }
    const top = atencao.slice(0, 3);
    const texto = `Encontrei ${atencao.length} situaç${atencao.length === 1 ? "ão" : "ões"} que merece${atencao.length === 1 ? "" : "m"} atenção. ${top.map((i, n) => `${n + 1}) ${i.titulo}`).join(" ")}${atencao.length > 3 ? ` (+${atencao.length - 3} na Central)` : ""}.${nota} Pergunte "por quê?" para eu explicar ${top.length === 1 ? "a situação" : "a primeira"}.`;
    return { ...r(texto, top.map(blocoInsight), [{ rotulo: "Abrir Central de Inteligência", rota: "/dashboard/inteligencia" }], NIVEL.DETECTAR),
      referencia: { insights: top.map((i) => i.id) } };
  },
  // "Por quê?" depois de um alerta: SITUAÇÃO → EVIDÊNCIA → POSSÍVEIS CAUSAS → IMPACTO → RECOMENDAÇÃO.
  async "insight.explicar"({ motor, store, nomeUsuario, params }) {
    const b = await generateDailyBrief({ motor, store, nomeUsuario });
    const todos = [...b.critical, ...b.warnings, ...b.opportunities, ...b.information];
    const i = params.insightId ? todos.find((x) => x.id === params.insightId) : todos.find((x) => x.modulo === params.modulo);
    if (!i) {
      const texto = params.insightId
        ? "Esse alerta não aparece mais nos dados de agora (pode ter sido resolvido ou os dados mudaram)."
        : "Não encontrei nada fora do padrão nesse assunto nos dados disponíveis, então não tenho um porquê para explicar.";
      return { ...r(texto, [], [{ rotulo: "Abrir Central de Inteligência", rota: "/dashboard/inteligencia" }]), referencia: { insights: [] } };
    }
    const evid = (i.evidencias || []).map((e) => `${e.rotulo}: ${e.valor}`).join("; ");
    const causas = (i.possiveisCausas || []).slice(0, 4).map((c) => c.texto).join("; ");
    const partes = [
      i.situacao,
      evid && `Evidência: ${evid}.`,
      causas && `Possíveis causas (não confirmadas): ${causas}.`,
      i.impacto?.texto && `Impacto: ${i.impacto.texto}${i.impacto.natureza && i.impacto.natureza !== NATUREZA.REAL ? ` (${i.impacto.natureza})` : ""}.`,
      i.recomendacao && `Recomendação: ${i.recomendacao}`,
    ].filter(Boolean);
    const out = { ...r(partes.join(" "), [blocoInsight(i)], i.acoes || [], NIVEL.RECOMENDAR), referencia: { insights: [i.id] } };
    if (i.entidade?.tipo === "produto" && i.entidade.id) out.referencia.produto = { id: i.entidade.id, nome: i.entidade.nome || null };
    return out;
  },
};

export const AGENTES = Object.freeze([AgenteVendas, AgenteCompras, AgenteEstoque, AgenteFinanceiro, AgenteRH, AgenteOperacoes]);
