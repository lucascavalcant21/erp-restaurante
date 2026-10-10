const fs = require('fs');
let txt = fs.readFileSync('app/lib/dre-dados.js', 'utf8');

txt += `
export async function lancarFechamentoMes(unidadeId, mes, faturamento, taxaServico) {
  if (!supabase) return { error: 'Offline' };
  try {
    const ano = Number(mes.slice(0, 4));
    const m = Number(mes.slice(5, 7));
    // último dia do mês
    const ultimoDia = new Date(Date.UTC(ano, m, 0, 12)).toISOString().slice(0, 10);
    
    // 1. Apagar fin_faturamento_diario daquele mes pra nao duplicar
    await supabase.from('fin_faturamento_diario').delete().eq('unidade_id', unidadeId).like('data', mes + '%');
    
    // 2. Inserir
    const insFat = await supabase.from('fin_faturamento_diario').insert({
      unidade_id: unidadeId,
      data: ultimoDia,
      vendas_brutas: Number(faturamento),
      cancelamentos: 0,
      descontos: 0,
      fonte: 'Fechamento Mensal DRE'
    });
    if (insFat.error) throw insFat.error;

    // 3. Taxa de Serviço
    if (Number(taxaServico) > 0) {
       await supabase.from('fin_contas_pagar').delete().eq('unidade_id', unidadeId).eq('nome', 'Taxa de Serviço').like('data_competencia', mes + '%');
       const insTaxa = await supabase.from('fin_contas_pagar').insert({
         unidade_id: unidadeId,
         nome: 'Taxa de Serviço',
         data_competencia: ultimoDia,
         data_vencimento: ultimoDia,
         data_pagamento: ultimoDia,
         valor_original: Number(taxaServico),
         valor_pago: Number(taxaServico),
         pago: true,
         natureza: 'pessoal',
         categoria_codigo: 'pessoal_taxa_servico'
       });
       if (insTaxa.error) throw insTaxa.error;
    }

    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}
`;
fs.writeFileSync('app/lib/dre-dados.js', txt);
