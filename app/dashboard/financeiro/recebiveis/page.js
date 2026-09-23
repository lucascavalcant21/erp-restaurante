'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Calendar, DollarSign, Filter, Search, RefreshCw, 
  CheckCircle, Clock, AlertCircle, ArrowUpRight, TrendingUp
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchContasReceber, fetchResumoRecebiveis } from '../../../lib/recebiveis';

export default function RecebiveisPage() {
  const [loading, setLoading] = useState(true);
  const [contasReceber, setContasReceber] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [unidadeId, setUnidadeId] = useState(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroCanal, setFiltroCanal] = useState('TODOS');
  const [filtroForma, setFiltroForma] = useState('TODOS');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uId = user?.user_metadata?.unidade_id || '00000000-0000-0000-0000-000000000001';
      setUnidadeId(uId);

      const [lista, res] = await Promise.all([
        fetchContasReceber(uId),
        fetchResumoRecebiveis(uId)
      ]);

      setContasReceber(lista);
      setResumo(res);
    } catch (err) {
      console.error('Erro ao carregar recebíveis:', err);
    } finally {
      setLoading(false);
    }
  }

  const contasFiltradas = contasReceber.filter(c => {
    if (filtroStatus !== 'TODOS' && c.status !== filtroStatus) return false;
    if (filtroCanal !== 'TODOS' && c.canal_venda !== filtroCanal) return false;
    if (filtroForma !== 'TODOS' && c.forma_pagamento !== filtroForma) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const cod = (c.codigo_venda || '').toLowerCase();
      const adq = (c.adquirente_nome || '').toLowerCase();
      return cod.includes(q) || adq.includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-indigo-600" />
            Contas a Receber & Calendário de Repasses
          </h1>
          <p className="text-sm text-slate-500">
            Gestão detalhada de cartões, PIX, vouchers e repasses de marketplaces (iFood) por prazo D+N.
          </p>
        </div>

        <button
          onClick={carregarDados}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Vendas Brutas</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            R$ {resumo?.totalBruto?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">Taxas & Comissões</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">
            R$ {resumo?.totalTaxas?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Repasses Previstos (A Receber)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            R$ {resumo?.totalPrevisto?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Repasses Liquidados (Caixa)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            R$ {resumo?.totalRecebido?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código de venda ou adquirente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          />
        </div>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option value="TODOS">Todos os Status</option>
          <option value="PREVISTO">Previstos</option>
          <option value="RECEBIDO">Recebidos / Liquidados</option>
          <option value="DIVERGENTE">Divergentes</option>
          <option value="CANCELADO">Cancelados</option>
        </select>

        <select
          value={filtroForma}
          onChange={(e) => setFiltroForma(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option value="TODOS">Todas as Formas</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="DEBITO">Débito</option>
          <option value="CREDITO_AVISTA">Crédito à Vista</option>
          <option value="CREDITO_PARCELADO">Crédito Parcelado</option>
          <option value="IFOOD_ONLINE">iFood Online</option>
          <option value="VOUCHER">Voucher</option>
        </select>
      </div>

      {/* Tabela de Titulos em Contas a Receber */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
              <tr>
                <th className="p-3.5">Venda / Canal</th>
                <th className="p-3.5">Método / Adquirente</th>
                <th className="p-3.5 text-center">Parc.</th>
                <th className="p-3.5 text-right">Valor Bruto</th>
                <th className="p-3.5 text-right">Taxa (R$)</th>
                <th className="p-3.5 text-right">Líquido Esperado</th>
                <th className="p-3.5">Prev. Repasse</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Carregando recebíveis...</td>
                </tr>
              ) : contasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Nenhum recebível encontrado.</td>
                </tr>
              ) : (
                contasFiltradas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.codigo_venda || 'VND'}</div>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600">
                        {c.canal_venda || 'SALAO'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{c.forma_pagamento}</div>
                      <div className="text-xs text-slate-400">{c.adquirente_nome || 'STONE'}</div>
                    </td>
                    <td className="p-3.5 text-center font-mono text-xs">
                      {c.parcela_numero}/{c.total_parcelas}
                    </td>
                    <td className="p-3.5 text-right font-medium">R$ {Number(c.valor_bruto || 0).toFixed(2)}</td>
                    <td className="p-3.5 text-right text-xs text-rose-500 font-semibold">
                      - R$ {(Number(c.taxa_valor || 0) + Number(c.comissao_marketplace_valor || 0)).toFixed(2)} ({c.taxa_percentual}%)
                    </td>
                    <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      R$ {Number(c.valor_liquido_esperado || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {c.data_prevista_repasse ? new Date(c.data_prevista_repasse).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        c.status === 'RECEBIDO'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : c.status === 'PREVISTO'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : c.status === 'DIVERGENTE'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
