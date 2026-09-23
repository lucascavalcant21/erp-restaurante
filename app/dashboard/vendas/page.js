'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, DollarSign, Calendar, CreditCard, RefreshCw, 
  CheckCircle, AlertTriangle, Filter, Search, PlusCircle, ArrowUpRight, ArrowDownLeft, XCircle, Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { arredondar2, calcularDecomposicaoVenda, gerarTitulosContasReceber } from '../../lib/vendas-domain';
import { salvarTitulosContasReceber } from '../../lib/recebiveis';

export default function VendasHubPage() {
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState([]);
  const [unidadeId, setUnidadeId] = useState(null);

  // Filtros
  const [filtroCanal, setFiltroCanal] = useState('TODOS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [busca, setBusca] = useState('');

  // Modal Nova Venda
  const [modalNovaVenda, setModalNovaVenda] = useState(false);
  const [codigoVenda, setCodigoVenda] = useState('');
  const [canalVenda, setCanalVenda] = useState('SALAO');
  const [subtotal, setSubtotal] = useState('');
  const [desconto, setDesconto] = useState('');
  const [taxaServico, setTaxaServico] = useState('10');
  const [percentualEquipe, setPercentualEquipe] = useState('80'); // 80% garçons, 20% empresa
  const [comissaoMkt, setComissaoMkt] = useState('0');
  const [impostosPercentual, setImpostosPercentual] = useState('0');
  const [cliente, setCliente] = useState('');
  
  // Split Pagamentos
  const [split, setSplit] = useState([
    { formaPagamento: 'PIX', valor: '', adquirente: 'BANCO', parcelas: 1 }
  ]);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uId = user?.user_metadata?.unidade_id || '00000000-0000-0000-0000-000000000001';
      setUnidadeId(uId);

      const { data, error } = await supabase
        .from('vendas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setVendas(data);
      }
    } catch (err) {
      console.error('Erro ao carregar vendas:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddSplit = () => {
    setSplit([...split, { formaPagamento: 'CREDITO_AVISTA', valor: '', adquirente: 'STONE', parcelas: 1 }]);
  };

  const handleRemoveSplit = (idx) => {
    setSplit(split.filter((_, i) => i !== idx));
  };

  const handleSplitChange = (idx, field, value) => {
    const updated = [...split];
    updated[idx][field] = value;
    setSplit(updated);
  };

  const handleSalvarVenda = async (e) => {
    e.preventDefault();
    if (!subtotal || Number(subtotal) <= 0) {
      alert('Informe um subtotal válido');
      return;
    }

    const decomp = calcularDecomposicaoVenda({
      subtotal: Number(subtotal),
      desconto: Number(desconto || 0),
      percentualTaxaServicoEquipe: Number(percentualEquipe || 80),
      taxaServicoPercentual: Number(taxaServico || 0),
      comissaoMarketplacePercentual: Number(comissaoMkt || 0),
      impostosVendaPercentual: Number(impostosPercentual || 0)
    });

    const somaSplit = split.reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
    if (Math.abs(somaSplit - decomp.vendaBruta) > 0.05) {
      alert(`A soma dos pagamentos (R$ ${somaSplit.toFixed(2)}) deve ser exatamente igual ao total bruto da venda (R$ ${decomp.vendaBruta.toFixed(2)}).`);
      return;
    }

    const codFinal = codigoVenda || `VND-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      // 1. Inserir registro em vendas
      const { data: vCreated, error: errV } = await supabase
        .from('vendas')
        .insert([{
          unidade_id: unidadeId,
          codigo_venda: codFinal,
          canal_venda: canalVenda,
          subtotal: decomp.subtotal,
          desconto: decomp.desconto,
          taxa_servico_cobrada: decomp.taxaServicoCobrada,
          taxa_servico_destinada_equipe: decomp.taxaServicoDestinadaEquipe,
          taxa_servico_retida_empresa: decomp.taxaServicoRetidaEmpresa,
          comissao_marketplace: decomp.comissaoMarketplace,
          impostos_venda: decomp.impostosVenda,
          total: decomp.vendaBruta,
          valor_bruto: decomp.vendaBruta,
          valor_final: decomp.vendaBruta,
          valor_liquido: decomp.vendaBruta - decomp.comissaoMarketplace,
          cliente: cliente || 'Cliente Consumidor',
          status: 'CONCLUIDA',
          chave_idempotencia: `VND_MANUAL_${codFinal}`
        }])
        .select()
        .single();

      if (errV) throw errV;

      // 2. Inserir Split de Pagamentos em venda_pagamentos
      const pagEntries = split.map(sp => ({
        unidade_id: unidadeId,
        venda_id: vCreated.id,
        forma_pagamento: sp.formaPagamento || 'PIX',
        adquirente_nome: sp.adquirente || 'STONE',
        parcelas: Number(sp.parcelas) || 1,
        valor: Number(sp.valor)
      }));

      await supabase.from('venda_pagamentos').insert(pagEntries);

      // 3. Gerar e salvar Contas a Receber
      const titulos = gerarTitulosContasReceber({
        vendaId: vCreated.id,
        codigoVenda: codFinal,
        unidadeId,
        canalVenda,
        splitPagamentos: split
      });

      await salvarTitulosContasReceber(titulos);

      alert('Venda registrada com sucesso!');
      setModalNovaVenda(false);
      setCodigoVenda('');
      setSubtotal('');
      setDesconto('');
      carregarDados();
    } catch (err) {
      alert('Erro ao salvar venda: ' + err.message);
    }
  };

  const handleEstornarVenda = async (vendaId) => {
    if (!confirm('Deseja realmente estornar esta venda e cancelar os recebíveis pendentes?')) return;

    try {
      await supabase
        .from('vendas')
        .update({ status: 'ESTORNADA' })
        .eq('id', vendaId);

      await supabase
        .from('contas_receber')
        .update({ status: 'CANCELADO' })
        .eq('venda_id', vendaId)
        .neq('status', 'RECEBIDO');

      alert('Venda e recebíveis pendentes estornados com sucesso.');
      carregarDados();
    } catch (err) {
      alert('Erro ao estornar venda: ' + err.message);
    }
  };

  const vendasFiltradas = vendas.filter(v => {
    if (filtroCanal !== 'TODOS' && v.canal_venda !== filtroCanal) return false;
    if (filtroStatus !== 'TODOS' && v.status !== filtroStatus) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const cod = (v.codigo_venda || '').toLowerCase();
      const cli = (v.cliente || '').toLowerCase();
      return cod.includes(q) || cli.includes(q);
    }
    return true;
  });

  const totalBruto = vendasFiltradas.reduce((acc, v) => acc + (v.status !== 'ESTORNADA' ? Number(v.total || v.valor_bruto || 0) : 0), 0);
  const totalEquipe = vendasFiltradas.reduce((acc, v) => acc + (v.status !== 'ESTORNADA' ? Number(v.taxa_servico_destinada_equipe || 0) : 0), 0);
  const totalLiquido = vendasFiltradas.reduce((acc, v) => acc + (v.status !== 'ESTORNADA' ? Number(v.valor_liquido || v.total || 0) : 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-emerald-600" />
            Hub de Vendas & Entradas Multi-Canal
          </h1>
          <p className="text-sm text-slate-500">
            Registro unificado de vendas do Salão, iFood, Delivery e Balcão com separação de Gorjeta da Equipe e CMV Teórico.
          </p>
        </div>

        <button
          onClick={() => setModalNovaVenda(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition shadow"
        >
          <PlusCircle className="w-5 h-5" />
          Nova Venda / Lançamento
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Vendas (Bruto)</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">R$ {totalBruto.toFixed(2)}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Taxa Serviço (Equipe)
          </p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">R$ {totalEquipe.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">Passivo de Gorjeta Garçons</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor Líquido Esperado</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">R$ {totalLiquido.toFixed(2)}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Qtd Vendas Registradas</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{vendasFiltradas.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          />
        </div>

        <select
          value={filtroCanal}
          onChange={(e) => setFiltroCanal(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option value="TODOS">Todos os Canais</option>
          <option value="SALAO">Salão</option>
          <option value="BALCAO">Balcão</option>
          <option value="DELIVERY">Delivery Próprio</option>
          <option value="IFOOD">iFood Online</option>
          <option value="EVENTO">Evento / Encomenda</option>
        </select>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
        >
          <option value="TODOS">Todos os Status</option>
          <option value="CONCLUIDA">Concluídas</option>
          <option value="ESTORNADA">Estornadas</option>
        </select>
      </div>

      {/* Tabela de Vendas */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
              <tr>
                <th className="p-3.5">Código / Data</th>
                <th className="p-3.5">Canal</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5 text-right">Subtotal</th>
                <th className="p-3.5 text-right">Serviço (Equipe/Empresa)</th>
                <th className="p-3.5 text-right">Total Bruto</th>
                <th className="p-3.5 text-right">Valor Líquido</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Carregando vendas...</td>
                </tr>
              ) : vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">Nenhuma venda encontrada.</td>
                </tr>
              ) : (
                vendasFiltradas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900 dark:text-white">{v.codigo_venda || v.id.substring(0,8)}</div>
                      <div className="text-xs text-slate-400">{new Date(v.created_at).toLocaleString('pt-BR')}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {v.canal_venda || 'SALAO'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{v.cliente || 'Consumidor'}</td>
                    <td className="p-3.5 text-right font-medium text-slate-600">R$ {Number(v.subtotal || v.total || 0).toFixed(2)}</td>
                    <td className="p-3.5 text-right text-xs">
                      <span className="text-indigo-600 font-semibold">Equipe: R$ {Number(v.taxa_servico_destinada_equipe || 0).toFixed(2)}</span>
                      <div className="text-slate-400">Empresa: R$ {Number(v.taxa_servico_retida_empresa || 0).toFixed(2)}</div>
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">R$ {Number(v.total || v.valor_bruto || 0).toFixed(2)}</td>
                    <td className="p-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      R$ {Number(v.valor_liquido || v.total || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        v.status === 'ESTORNADA' 
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {v.status || 'CONCLUIDA'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      {v.status !== 'ESTORNADA' && (
                        <button
                          onClick={() => handleEstornarVenda(v.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-200 text-xs font-medium transition"
                        >
                          Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Venda */}
      {modalNovaVenda && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 my-8">
            <div className="flex justify-between items-center border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lançamento de Nova Venda</h3>
              <button onClick={() => setModalNovaVenda(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSalvarVenda} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Código da Venda (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: VND-1092"
                    value={codigoVenda}
                    onChange={(e) => setCodigoVenda(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Canal de Venda</label>
                  <select
                    value={canalVenda}
                    onChange={(e) => setCanalVenda(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm"
                  >
                    <option value="SALAO">Salão</option>
                    <option value="BALCAO">Balcão</option>
                    <option value="DELIVERY">Delivery Próprio</option>
                    <option value="IFOOD">iFood Online</option>
                    <option value="EVENTO">Evento / Encomenda</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Subtotal (R$)*</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Taxa Serviço (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="10"
                    value={taxaServico}
                    onChange={(e) => setTaxaServico(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">% Destinado à Equipe (Garçons)</label>
                  <input
                    type="number"
                    value={percentualEquipe}
                    onChange={(e) => setPercentualEquipe(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Passivo operacional de gorjeta</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Cliente / Identificação</label>
                  <input
                    type="text"
                    placeholder="Nome do cliente ou comanda"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs"
                  />
                </div>
              </div>

              {/* Seção Split de Pagamentos */}
              <div className="border-t pt-3 border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Formas de Pagamento (Split)</label>
                  <button
                    type="button"
                    onClick={handleAddSplit}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    + Adicionar Método
                  </button>
                </div>

                {split.map((sp, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-center bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border">
                    <div>
                      <select
                        value={sp.formaPagamento}
                        onChange={(e) => handleSplitChange(idx, 'formaPagamento', e.target.value)}
                        className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border rounded"
                      >
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="PIX">PIX</option>
                        <option value="DEBITO">Débito</option>
                        <option value="CREDITO_AVISTA">Crédito à Vista</option>
                        <option value="CREDITO_PARCELADO">Crédito Parcelado</option>
                        <option value="IFOOD_ONLINE">iFood Online</option>
                        <option value="VOUCHER">Voucher VR/VA</option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Valor R$"
                        value={sp.valor}
                        onChange={(e) => handleSplitChange(idx, 'valor', e.target.value)}
                        className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border rounded font-semibold"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Adquirente (Stone/Rede)"
                        value={sp.adquirente}
                        onChange={(e) => handleSplitChange(idx, 'adquirente', e.target.value)}
                        className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border rounded"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="12"
                        placeholder="Parc"
                        value={sp.parcelas}
                        onChange={(e) => handleSplitChange(idx, 'parcelas', e.target.value)}
                        className="w-16 text-xs p-1.5 bg-white dark:bg-slate-800 border rounded"
                      />
                      {split.length > 1 && (
                        <button type="button" onClick={() => handleRemoveSplit(idx)} className="text-rose-500 hover:text-rose-700 text-xs">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 border-t pt-4 border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalNovaVenda(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow"
                >
                  Confirmar Venda e Gerar Recebíveis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
