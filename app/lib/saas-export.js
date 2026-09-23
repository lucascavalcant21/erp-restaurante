/**
 * MÓDULO DE EXPORTAÇÃO E OFFBOARDING DE TENANT (SaaS ERP HÉFISTO)
 * Garante portabilidade total dos dados do restaurante sem vendor lock-in.
 */

import { supabase } from './supabase.js';

export async function exportarDadosTenant(empresaId) {
  if (!empresaId) {
    throw new Error('Empresa ID é obrigatório para exportação de dados.');
  }

  // 1. Obter Unidades do Tenant
  const { data: unidades, error: errUnidades } = await supabase
    .from('unidades')
    .select('id, nome')
    .eq('empresa_id', empresaId);

  if (errUnidades) throw errUnidades;
  const unidadeIds = (unidades || []).map(u => u.id);

  if (unidadeIds.length === 0) {
    return {
      metadata: {
        empresa_id: empresaId,
        exportado_em: new Date().toISOString(),
        versao_héfisto: '1.0.0-rc.1',
        total_registros: 0
      },
      unidades: [],
      ingredientes: [],
      fichas_tecnicas: [],
      estoque: [],
      vendas: [],
      recebiveis: [],
      contas_financeiras: []
    };
  }

  // 2. Coletar dados em paralelo por unidade
  const [
    resIngredientes,
    resFichas,
    resEstoque,
    resVendas,
    resRecebiveis,
    resContas
  ] = await Promise.all([
    supabase.from('ingredientes').select('*').in('unidade_id', unidadeIds),
    supabase.from('fichas_tecnicas').select('*, itens:itens_ficha_tecnica(*)').in('unidade_id', unidadeIds),
    supabase.from('movimentacoes_estoque').select('*').in('unidade_id', unidadeIds),
    supabase.from('vendas').select('*, itens:itens_venda(*)').in('unidade_id', unidadeIds),
    supabase.from('recebiveis').select('*').in('unidade_id', unidadeIds),
    supabase.from('contas_financeiras').select('*').in('unidade_id', unidadeIds)
  ]);

  const ingredientes = resIngredientes.data || [];
  const fichas = resFichas.data || [];
  const estoque = resEstoque.data || [];
  const vendas = resVendas.data || [];
  const recebiveis = resRecebiveis.data || [];
  const contas = resContas.data || [];

  const totalRegistros = ingredientes.length + fichas.length + estoque.length + vendas.length + recebiveis.length + contas.length;

  return {
    metadata: {
      empresa_id: empresaId,
      exportado_em: new Date().toISOString(),
      versao_héfisto: '1.0.0-rc.1',
      total_registros: totalRegistros
    },
    unidades: unidades || [],
    ingredientes,
    fichas_tecnicas: fichas,
    estoque,
    vendas,
    recebiveis,
    contas_financeiras: contas
  };
}
