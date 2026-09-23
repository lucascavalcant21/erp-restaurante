import { converterUnidade, custoDeProduzirFicha, fatorDeCorrecaoNormalizado } from './ficha-calculos.mjs';

export const ehEstoqueavel = ficha => ficha?.estoqueavel ?? Boolean(ficha?.eh_base);
export const unidadeProducao = ficha => ficha?.rendimento_unidade || 'un';
export function dataOperacional(data = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
}

// Quantidades antigas sem unidade explícita estão na unidade do insumo ou do
// rendimento da subficha. Não reinterpretar esses números ao migrar.
export function calcularConsumoProducao(ficha, quantidade, todasFichas = []) {
  const erros = [], consumo = new Map();
  const fichas = new Map(todasFichas.map(f => [f.id, f]));
  if (ficha) fichas.set(ficha.id, ficha);
  const qtd = Number(quantidade), rendimento = Number(ficha?.rendimento_porcoes);
  if (!Number.isFinite(qtd) || qtd <= 0) erros.push('Informe uma quantidade positiva e finita.');
  if (!Number.isFinite(rendimento) || rendimento <= 0) erros.push('A ficha precisa de rendimento válido.');

  function adicionar(insumo, q, unidade, subficha = null) {
    const destino = insumo.unidade_medida;
    const convertido = String(unidade).toLowerCase() === String(destino).toLowerCase()
      ? q : converterUnidade(q, unidade, destino);
    if (convertido === null || !Number.isFinite(convertido)) {
      erros.push(`${insumo.nome}: unidades incompatíveis (${unidade} → ${destino}).`);
      return;
    }
    const chave = subficha ? `ficha:${subficha.id}` : insumo.id;
    const item = consumo.get(chave) || { chave, insumo, subficha_id: subficha?.id || null, quantidade: 0 };
    item.quantidade += convertido;
    consumo.set(chave, item);
  }
  function visitar(atual, fator, trilha = new Set()) {
    if (trilha.has(atual.id)) { erros.push(`Referência circular em ${atual.nome_receita}.`); return; }
    const caminho = new Set(trilha).add(atual.id);
    if (!atual.fichas_ingredientes?.length) erros.push(`${atual.nome_receita}: ficha sem ingredientes.`);
    for (const item of atual.fichas_ingredientes || []) {
      const q = Number(item.quantidade) * fator * fatorDeCorrecaoNormalizado(item.fator_correcao);
      if (!Number.isFinite(q) || q <= 0) { erros.push(`${atual.nome_receita}: quantidade de ingrediente inválida.`); continue; }
      const baseId = item.subficha_id || item.insumos?.ficha_tecnica_id;
      if (baseId) {
        const base = fichas.get(baseId);
        if (!base || caminho.has(baseId)) { erros.push('Subficha ausente ou circular.'); continue; }
        const un = unidadeProducao(base);
        if (ehEstoqueavel(base)) {
          adicionar({ id: `ficha:${base.id}`, nome: base.nome_receita, unidade_medida: un, ficha_tecnica_id: base.id }, q, item.unidade || un, base);
        } else {
          const rend = Number(base.rendimento_porcoes);
          const convertido = item.unidade && item.unidade !== un ? converterUnidade(q, item.unidade, un) : q;
          if (!(rend > 0) || convertido === null) erros.push(`${base.nome_receita}: rendimento/unidade inválidos.`);
          else visitar(base, convertido / rend, caminho);
        }
      } else if (item.insumos?.id) {
        adicionar(item.insumos, q, item.unidade || item.insumos.unidade_medida);
      } else erros.push(`${atual.nome_receita}: ingrediente sem vínculo.`);
    }
  }
  if (!erros.length) visitar(ficha, qtd / rendimento);
  return { itens: [...consumo.values()], erros, receitas: qtd / rendimento,
    custoEstimado: erros.length ? null : custoDeProduzirFicha(ficha, todasFichas) * qtd / rendimento };
}

export function conferirDisponibilidade(calculo, saldos) {
  return calculo.itens.map(item => {
    const correspondentes = saldos.filter(s => item.subficha_id
      ? s.ficha_tecnica_id === item.subficha_id : s.insumo_id === item.insumo.id);
    let disponivel = 0;
    for (const saldo of correspondentes) {
      const un = saldo.unidade_medida || item.insumo.unidade_medida;
      const q = un === item.insumo.unidade_medida ? Number(saldo.quantidade_atual)
        : converterUnidade(saldo.quantidade_atual, un, item.insumo.unidade_medida);
      if (q !== null && Number.isFinite(q)) disponivel += q;
    }
    return { ...item, disponivel, faltante: Math.max(0, item.quantidade - disponivel) };
  });
}

export function totaisPorUnidade(producoes) {
  return producoes.reduce((acc, p) => {
    const un = p.unidade_medida || p.fichas_tecnicas?.rendimento_unidade || 'unidade não registrada';
    acc[un] = (acc[un] || 0) + Number(p.quantidade_produzida || 0);
    return acc;
  }, {});
}
