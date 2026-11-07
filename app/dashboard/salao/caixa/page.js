"use client";

// PAINEL DO CAIXA (pedido do dono, 07/11/2026). Diferente da tela do garçom:
// o caixa vê o salão inteiro e controla a operação: recebe, acompanha o
// preparo, decide o que cada garçom pode, ajusta tempo de preparo, cardápio e
// acompanhamentos, impressão e acompanha o financeiro. Cada atalho só aparece
// para quem tem a permissão da tela.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, ChefHat, Clock, ConciergeBell, Globe, LineChart, Printer, ShoppingBag, Timer, Users, Wallet } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { canAccessRoute } from "../../../lib/permissions-catalog.mjs";
import { fetchCaixaAberto } from "../../../lib/caixas";
import { fetchSalao } from "../../../lib/comandas";
import { useTempoReal } from "../../../lib/realtime";

const ATALHOS = [
  { grupo: "Operação", itens: [
    { href: "/dashboard/salao/mesas", titulo: "Caixa e mesas", texto: "Receber contas, balcão, vendas do caixa e fechamento.", icone: Wallet, destaque: true },
    { href: "/dashboard/mesas", titulo: "Comandas do salão", texto: "A mesma tela do garçom, com todas as mesas.", icone: ConciergeBell },
    { href: "/dashboard/cozinha/kds", titulo: "Painel de produção", texto: "Cozinha e bar: o que está na fila e o que está pronto.", icone: ChefHat },
    { href: "/dashboard/salao/online", titulo: "Pedidos online", texto: "Delivery e cardápio digital para aceitar.", icone: Globe },
  ] },
  { grupo: "Equipe e cardápio", itens: [
    { href: "/dashboard/salao/equipe", titulo: "Equipe do salão", texto: "Liberar para cada garçom trocar mesa e cancelar item.", icone: Users },
    { href: "/dashboard/salao/tempo-preparo", titulo: "Tempo de preparo", texto: "Minutos de cada produto, que o garçom vê contando.", icone: Timer },
    { href: "/dashboard/operacao/produtos", titulo: "Produtos e acompanhamentos", texto: "Preço, setor, adicionais e acompanhamentos.", icone: ShoppingBag },
    { href: "/dashboard/configuracoes/impressao", titulo: "Impressão e observações", texto: "Modelos das vias, impressoras e observações prontas.", icone: Printer },
  ] },
  { grupo: "Financeiro", itens: [
    { href: "/dashboard/financeiro", titulo: "Financeiro", texto: "Contas a pagar e a receber, fluxo de caixa.", icone: BadgeDollarSign },
    { href: "/dashboard/financeiro/resultado", titulo: "Resultado do mês", texto: "Faturamento, metas e projeção.", icone: LineChart },
  ] },
];

function Indicador({ rotulo, valor, tom = "" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-hf-border bg-hf-surface p-3">
      <p className="truncate text-xs font-bold uppercase tracking-wide text-hf-text-2">{rotulo}</p>
      <p className={`mt-0.5 truncate text-2xl font-black tabular-nums ${tom || "text-hf-text"}`}>{valor}</p>
    </div>
  );
}

export default function PainelDoCaixaPage() {
  const { unidadeAtiva, sessao, usuarioLogado } = useERP();
  const [situacao, setSituacao] = useState(null);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const [cx, salao] = await Promise.all([fetchCaixaAberto(unidadeAtiva).catch(() => ({ data: null })), fetchSalao(unidadeAtiva).catch(() => ({ mesas: [], pedidos: [] }))]);
    const pedidos = salao.pedidos || [];
    setSituacao({
      caixaAberto: !!cx?.data,
      ocupadas: (salao.mesas || []).filter((m) => m.status === "ocupada" || m.status === "fechando").length,
      pedindoConta: (salao.mesas || []).filter((m) => m.status === "fechando").length,
      prontos: pedidos.reduce((t, p) => t + (p.pedidos_itens || []).filter((i) => i.status_kds === "pronto").length, 0),
      naFila: pedidos.reduce((t, p) => t + (p.pedidos_itens || []).filter((i) => ["pendente", "preparando", "em_preparo"].includes(i.status_kds || "pendente")).length, 0),
    });
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 20000); return () => clearInterval(t); }, [carregar]);
  useTempoReal(["pedidos", "pedidos_itens", "mesas", "pdv_caixas"], carregar);

  const pode = (href) => !sessao?.gerenciado || canAccessRoute(sessao, href.split("?")[0]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-16 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-hf-text">Painel do caixa</h1>
        <p className="text-sm text-hf-text-2">{usuarioLogado?.nome ? `${usuarioLogado.nome} · ` : ""}o salão inteiro e o controle da operação.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Indicador rotulo="Caixa" valor={situacao ? (situacao.caixaAberto ? "Aberto" : "Fechado") : "…"} tom={situacao && !situacao.caixaAberto ? "text-hf-danger" : "text-emerald-700"} />
        <Indicador rotulo="Mesas ocupadas" valor={situacao ? situacao.ocupadas : "…"} />
        <Indicador rotulo="Pedindo a conta" valor={situacao ? situacao.pedindoConta : "…"} tom={situacao?.pedindoConta ? "text-amber-700" : ""} />
        <Indicador rotulo="Itens na fila" valor={situacao ? situacao.naFila : "…"} />
        <Indicador rotulo="Prontos para servir" valor={situacao ? situacao.prontos : "…"} tom={situacao?.prontos ? "text-emerald-700" : ""} />
      </div>
      {situacao && !situacao.caixaAberto && pode("/dashboard/salao/mesas") && (
        <Link href="/dashboard/salao/mesas" className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border-2 border-hf-danger/40 bg-hf-danger/10 px-4 text-sm font-black text-hf-danger">
          <span className="flex items-center gap-2"><Clock size={18} /> O caixa está fechado: os garçons pedem a conta, mas ninguém recebe.</span><span className="shrink-0 underline">Abrir caixa</span>
        </Link>
      )}

      {ATALHOS.map((g) => {
        const visiveis = g.itens.filter((a) => pode(a.href));
        if (!visiveis.length) return null;
        return (
          <section key={g.grupo}>
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-hf-text-2">{g.grupo}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visiveis.map((a) => {
                const Icone = a.icone;
                return (
                  <Link key={a.href} href={a.href}
                    className={`flex min-h-[96px] flex-col gap-2 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${a.destaque ? "border-hf-accent bg-hf-accent/10" : "border-hf-border bg-hf-surface"}`}>
                    <Icone size={22} className="text-hf-accent" />
                    <span className="text-base font-black text-hf-text">{a.titulo}</span>
                    <span className="text-xs text-hf-text-2">{a.texto}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
