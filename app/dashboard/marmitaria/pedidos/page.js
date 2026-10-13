"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Filter,
  Layers,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";

const PEDIDOS_AMOSTRA = [
  {
    id: "PED-9821",
    numero_display: "#9821",
    cliente: "Mariana Souza",
    canal: "ifood",
    data_hora: "Hoje às 11:42",
    itens: [
      { nome: "Marmita Executiva Frango Grelhado (M)", qtd: 2, preco: 28.0, complementos: "Purê de batata, feijão carioca" },
      { nome: "Coca-Cola Zero 350ml", qtd: 2, preco: 6.5 },
    ],
    valor_bruto: 69.0,
    desconto_loja: 5.0,
    subtotal_liquido: 64.0,
    taxa_comissao_ifood: 9.6, // 15%
    taxa_pagamento_online: 0.0,
    repasse_liquido_esperado: 54.4,
    status: "em_preparo",
    forma_pagamento: "iFood Online",
  },
  {
    id: "PED-9820",
    numero_display: "#9820",
    cliente: "Carlos Eduardo Silva",
    canal: "whatsapp",
    data_hora: "Hoje às 11:35",
    itens: [
      { nome: "Marmita Tradicional Carne de Panela (G)", qtd: 1, preco: 32.0, complementos: "Legumes sauté, arroz integral" },
    ],
    valor_bruto: 32.0,
    desconto_loja: 0.0,
    subtotal_liquido: 32.0,
    taxa_comissao_ifood: 0.0,
    taxa_pagamento_online: 0.48, // 1.5% Pix
    repasse_liquido_esperado: 31.52,
    status: "pronto",
    forma_pagamento: "Pix Direto",
  },
  {
    id: "PED-9819",
    numero_display: "#9819",
    cliente: "Empresa Inovare (5x)",
    canal: "balcao",
    data_hora: "Hoje às 11:15",
    itens: [
      { nome: "Marmita Tradicional Frango Assado (M)", qtd: 5, preco: 24.0 },
    ],
    valor_bruto: 120.0,
    desconto_loja: 0.0,
    subtotal_liquido: 120.0,
    taxa_comissao_ifood: 0.0,
    taxa_pagamento_online: 2.28, // Cartão débito
    repasse_liquido_esperado: 117.72,
    status: "entregue",
    forma_pagamento: "Débito Stone",
  },
  {
    id: "PED-9815",
    numero_display: "#9815",
    cliente: "Lucas Rocha",
    canal: "ifood",
    data_hora: "Hoje às 10:50",
    itens: [
      { nome: "Marmita Fitness Salmão Grelhado", qtd: 1, preco: 38.0 },
    ],
    valor_bruto: 38.0,
    desconto_loja: 0.0,
    subtotal_liquido: 38.0,
    taxa_comissao_ifood: 5.7,
    taxa_pagamento_online: 0.0,
    repasse_liquido_esperado: 32.3,
    status: "cancelado",
    motivo_cancelamento: "Cliente solicitou cancelamento antes do preparo",
    forma_pagamento: "iFood Online",
  },
];

export default function MarmitariaPedidosPage() {
  const [pedidos, setPedidos] = useState(PEDIDOS_AMOSTRA);
  const [canalFiltro, setCanalFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      const matchCanal = canalFiltro === "todos" || p.canal === canalFiltro;
      const matchBusca =
        !busca ||
        p.numero_display.toLowerCase().includes(busca.toLowerCase()) ||
        p.cliente.toLowerCase().includes(busca.toLowerCase());
      return matchCanal && matchBusca;
    });
  }, [pedidos, canalFiltro, busca]);

  // Totais de Conciliação Financeira
  const totais = useMemo(() => {
    const validos = pedidos.filter((p) => p.status !== "cancelado");
    const bruto = validos.reduce((t, p) => t + p.valor_bruto, 0);
    const taxas = validos.reduce((t, p) => t + p.taxa_comissao_ifood + p.taxa_pagamento_online, 0);
    const liquido = validos.reduce((t, p) => t + p.repasse_liquido_esperado, 0);
    return { bruto, taxas, liquido };
  }, [pedidos]);

  return (
    <div className="space-y-6">
      {/* Topo de Pedidos */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <ShoppingBag size={14} /> Canais de Venda & Delivery
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Pedidos & Conciliação iFood da Marmitaria
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Pedidos integrados e atribuídos ao centro de resultado Marmitaria com conciliação de taxas e repasses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            iFood Conectado
          </span>
        </div>
      </div>

      {/* Cards de Conciliação em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Vendas Brutas (Hoje)
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {fmtBRL(totais.bruto)}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            {pedidos.filter((p) => p.status !== "cancelado").length} pedidos atendidos
          </span>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Comissões & Taxas Retidas
          </span>
          <div className="text-2xl font-black text-amber-700 tracking-tight">
            {fmtBRL(totais.taxas)}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            Taxas contratuais iFood e maquininhas
          </span>
        </div>

        <div className="bg-hf-surface p-5 rounded-2xl border border-hf-border">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Repasse Líquido no Banco
          </span>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            {fmtBRL(totais.liquido)}
          </div>
          <span className="text-xs text-emerald-600 font-bold mt-1 block">
            Centro de Resultado: Marmitaria
          </span>
        </div>
      </div>

      {/* Filtros de Canais e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-hf-surface p-3 rounded-2xl border border-hf-border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente ou pedido..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {["todos", "ifood", "whatsapp", "balcao"].map((c) => (
            <button
              key={c}
              onClick={() => setCanalFiltro(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                canalFiltro === c
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {c === "todos" ? "Todos os Canais" : c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Pedidos com Detalhamento de Taxas e Repasses */}
      <div className="space-y-4">
        {pedidosFiltrados.map((pedido) => (
          <div
            key={pedido.id}
            className="bg-hf-surface rounded-3xl border border-hf-border p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-base font-black text-slate-900">{pedido.numero_display}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase ${
                    pedido.canal === "ifood"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : pedido.canal === "whatsapp"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {pedido.canal.toUpperCase()}
                </span>
                <span className="text-xs font-bold text-slate-700">{pedido.cliente}</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{pedido.data_hora}</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {pedido.forma_pagamento}
                </span>
              </div>
            </div>

            {/* Itens do Pedido */}
            <div className="space-y-2">
              {pedido.itens.map((it, idx) => (
                <div key={idx} className="flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">
                      {it.qtd}x {it.nome}
                    </span>
                    {it.complementos && (
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        {it.complementos}
                      </span>
                    )}
                  </div>
                  <strong className="text-slate-800">{fmtBRL(it.qtd * it.preco)}</strong>
                </div>
              ))}
            </div>

            {/* Conciliação de Taxas e Repasse do Pedido */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span>
                  Valor Bruto: <strong className="text-slate-800">{fmtBRL(pedido.valor_bruto)}</strong>
                </span>
                {pedido.taxa_comissao_ifood > 0 && (
                  <span className="text-red-700">
                    Comissão iFood (15%): -{fmtBRL(pedido.taxa_comissao_ifood)}
                  </span>
                )}
                {pedido.taxa_pagamento_online > 0 && (
                  <span className="text-amber-700">
                    Taxa Cartão/Pix: -{fmtBRL(pedido.taxa_pagamento_online)}
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-slate-500">Repasse Líquido Marmitaria: </span>
                <strong className="text-emerald-700 font-black text-sm">
                  {fmtBRL(pedido.repasse_liquido_esperado)}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
