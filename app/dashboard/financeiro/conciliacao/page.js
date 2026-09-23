'use client';

import React, { useState, useEffect } from 'react';
import { 
  Scale, CheckCircle2, AlertTriangle, Building2, DollarSign, 
  RefreshCw, ArrowRight, Check, X, ShieldAlert, Layers, HelpCircle
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchContasReceber, conciliarRecebivel, conciliarLoteRecebiveis, justificarDivergencia } from '../../../lib/recebiveis';

export default function ConciliacaoPage() {
  const [loading, setLoading] = useState(true);
  const [pendentes, setPendentes] = useState([]);
  const [contasFinanceiras, setContasFinanceiras] = useState([]);
  const [unidadeId, setUnidadeId] = useState(null);

  // Seleção de Recebíveis para Conciliação por Lote N:1
  const [selecionados, setSelecionados] = useState([]);

  // Modal Conciliar 1:1
  const [modalConciliar, setModalConciliar] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [valorDepositado, setValorDepositado] = useState('');
  const [contaFinanceiraId, setContaFinanceiraId] = useState('');
  const [observacao, setObservacao] = useState('');

  // Modal Lote N:1
  const [modalLote, setModalLote] = useState(false);
  const [valorLoteDepositado, setValorLoteDepositado] = useState('');

  // Modal Justificar Divergência
  const [modalJustificar, setModalJustificar] = useState(false);
  const [motivoDivergencia, setMotivoDivergencia] = useState('TAXA_DIFERENTE');
  const [textoJustificativa, setTextoJustificativa] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uId = user?.user_metadata?.unidade_id || '00000000-0000-0000-0000-000000000001';
      setUnidadeId(uId);

      const [lista, { data: cFin }] = await Promise.all([
        fetchContasReceber(uId),
        supabase.from('contas_financeiras').select('*').eq('unidade_id', uId)
      ]);

      setPendentes(lista.filter(c => c.status === 'PREVISTO' || c.status === 'DIVERGENTE'));
      if (cFin && cFin.length > 0) {
        setContasFinanceiras(cFin);
        setContaFinanceiraId(cFin[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de conciliação:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleSelect = (id) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(i => i !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const handleAbrirModal1 = (item) => {
    setItemSelecionado(item);
    setValorDepositado(item.valor_liquido_esperado ? item.valor_liquido_esperado.toString() : '');
    setObservacao('');
    setModalConciliar(true);
  };

  const handleAbrirJustificativa = (item) => {
    setItemSelecionado(item);
    setMotivoDivergencia('TAXA_DIFERENTE');
    setTextoJustificativa('');
    setModalJustificar(true);
  };

  const handleExecutarConciliacao = async (e) => {
    e.preventDefault();
    if (!itemSelecionado || !valorDepositado) return;

    try {
      const res = await conciliarRecebivel({
        contaReceberId: itemSelecionado.id,
        unidadeId,
        valorDepositado: Number(valorDepositado),
        contaFinanceiraId,
        observacao
      });

      if (res.sucesso) {
        if (res.status_conciliacao === 'CONCILIADO_COM_DIVERGENCIA') {
          alert(`Conciliado com DIVERGÊNCIA! Diferença de R$ ${res.diferenca?.toFixed(2)} identificada.`);
        } else {
          alert('Conciliação realizada com SUCESSO! Saldo bancário creditado.');
        }
        setModalConciliar(false);
        carregarDados();
      } else {
        alert('Erro ao conciliar: ' + (res.erro || res.mensagem));
      }
    } catch (err) {
      alert('Erro inesperado: ' + err.message);
    }
  };

  const handleExecutarConciliacaoLote = async (e) => {
    e.preventDefault();
    if (!selecionados.length || !valorLoteDepositado) return;

    try {
      const res = await conciliarLoteRecebiveis({
        unidadeId,
        adquirenteNome: 'STONE',
        recebiveisIds: selecionados,
        valorDepositadoBanco: Number(valorLoteDepositado),
        contaFinanceiraId,
        observacao
      });

      if (res.sucesso) {
        alert(`Lote de ${selecionados.length} recebíveis conciliado com SUCESSO!`);
        setModalLote(false);
        setSelecionados([]);
        carregarDados();
      } else {
        alert('Erro no lote: ' + (res.erro || res.mensagem));
      }
    } catch (err) {
      alert('Erro ao conciliar lote: ' + err.message);
    }
  };

  const handleSalvarJustificativa = async (e) => {
    e.preventDefault();
    if (!itemSelecionado) return;

    try {
      const res = await justificarDivergencia({
        contaReceberId: itemSelecionado.id,
        motivo: motivoDivergencia,
        justificativa: textoJustificativa
      });

      if (res.sucesso) {
        alert('Justificativa salva com sucesso!');
        setModalJustificar(false);
        carregarDados();
      } else {
        alert('Erro ao justificar: ' + res.erro);
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const totalEsperadoSelecionados = pendentes
    .filter(p => selecionados.includes(p.id))
    .reduce((acc, p) => acc + Number(p.valor_liquido_esperado || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-7 h-7 text-blue-600" />
            Conciliação Bancária & Batimento por Lote (N:1)
          </h1>
          <p className="text-sm text-slate-500">
            Batimento entre extrato do banco/adquirente e recebíveis com suporte a depósitos por lote e justificativa de divergência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selecionados.length > 0 && (
            <button
              onClick={() => {
                setValorLoteDepositado(totalEsperadoSelecionados.toString());
                setModalLote(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow transition"
            >
              <Layers className="w-4 h-4" />
              Conciliar Lote ({selecionados.length} selecionados)
            </button>
          )}

          <button
            onClick={carregarDados}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabela de Títulos a Conciliar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">Títulos a Conciliar ({pendentes.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selecionados.length === pendentes.length && pendentes.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelecionados(pendentes.map(p => p.id));
                      else setSelecionados([]);
                    }}
                  />
                </th>
                <th className="p-3.5">Venda</th>
                <th className="p-3.5">Forma / Adquirente</th>
                <th className="p-3.5 text-right">Valor Bruto</th>
                <th className="p-3.5 text-right">Líquido Esperado</th>
                <th className="p-3.5">Data Prevista</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Buscando pendências...</td>
                </tr>
              ) : pendentes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Nenhum título pendente de conciliação.</td>
                </tr>
              ) : (
                pendentes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                      />
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                      {item.codigo_venda || 'VND'}
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{item.forma_pagamento}</div>
                      <div className="text-xs text-slate-400">{item.adquirente_nome || 'STONE'}</div>
                    </td>
                    <td className="p-3.5 text-right font-medium">R$ {Number(item.valor_bruto || 0).toFixed(2)}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      R$ {Number(item.valor_liquido_esperado || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-xs text-slate-600">
                      {item.data_prevista_repasse ? new Date(item.data_prevista_repasse).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        item.status === 'DIVERGENTE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleAbrirModal1(item)}
                        className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                      >
                        Conciliar
                      </button>
                      {item.status === 'DIVERGENTE' && (
                        <button
                          onClick={() => handleAbrirJustificativa(item)}
                          className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-medium"
                        >
                          Justificar
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

      {/* Modal Lote N:1 */}
      {modalLote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b pb-3 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              Conciliar Lote N:1 ({selecionados.length} Vendas)
            </h3>

            <form onSubmit={handleExecutarConciliacaoLote} className="space-y-4 text-sm">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Títulos Selecionados:</span>
                  <span className="font-bold">{selecionados.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor Esperado Acumulado:</span>
                  <span className="font-bold text-emerald-600">R$ {totalEsperadoSelecionados.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor Único Depositado pela Adquirente no Banco (R$)*</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valorLoteDepositado}
                  onChange={(e) => setValorLoteDepositado(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-base font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Conta Bancária Destino</label>
                <select
                  value={contaFinanceiraId}
                  onChange={(e) => setContaFinanceiraId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm"
                >
                  {contasFinanceiras.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} (R$ {Number(c.saldo_atual || 0).toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setModalLote(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg shadow">Confirmar Lote</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Justificar Divergência */}
      {modalJustificar && itemSelecionado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4">
            <h3 className="text-lg font-bold border-b pb-3">Justificar Divergência de Taxa</h3>
            <form onSubmit={handleSalvarJustificativa} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold mb-1">Motivo da Diferença</label>
                <select
                  value={motivoDivergencia}
                  onChange={(e) => setMotivoDivergencia(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                >
                  <option value="TAXA_DIFERENTE">Taxa cobrada maior que o contratado</option>
                  <option value="CHARGEBACK">Estorno / Chargeback de cartão</option>
                  <option value="AJUSTE_ADQUIRENTE">Ajuste de aluguel de maquineta</option>
                  <option value="ANTECIPACAO">Taxa de antecipação bancária</option>
                  <option value="ERRO_IMPORTACAO">Erro na importação externa</option>
                  <option value="OUTRO">Outro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Justificativa / Detalhes</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Escreva a justificativa para a auditoria..."
                  value={textoJustificativa}
                  onChange={(e) => setTextoJustificativa(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setModalJustificar(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg shadow">Salvar Justificativa</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
