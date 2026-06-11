"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  LayoutDashboard, Users, UtensilsCrossed, Beer, ShoppingCart, DollarSign, Settings,
  Calendar, Target, TrendingUp, Activity,
} from "lucide-react";
import { PageHeader, PageBody, Card, KpiGrid, Kpi, fmtBRL, fmtPct } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchEvento, atualizarEvento,
  Ingredientes, Preparos, Pratos, Drinks, Reservas, CustosFixos, Compras,
  custoPrato, custoDrink, calcularMaquininha, rateForMethod,
} from "../../../lib/eventos";
import TabCardapio from "./TabCardapio";
import TabDrinks from "./TabDrinks";
import TabReservas from "./TabReservas";
import TabCompras from "./TabCompras";
import TabFinanceiro from "./TabFinanceiro";
import TabConfig from "./TabConfig";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "reservas",  label: "Mesas / Reservas", icon: Users },
  { id: "cardapio",  label: "Cozinha", icon: UtensilsCrossed },
  { id: "drinks",    label: "Bar", icon: Beer },
  { id: "compras",   label: "Compras", icon: ShoppingCart },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "config",    label: "Configurações", icon: Settings },
];

function diasAte(dataStr) {
  if (!dataStr) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(dataStr + "T00:00:00");
  return Math.floor((data - hoje) / (1000 * 60 * 60 * 24));
}

export default function EventoPage() {
  const params = useParams();
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const eventoId = params.id;

  const [evento, setEvento]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("dashboard");

  // Dados das sub-tabelas
  const [ingredientes, setIngredientes] = useState([]);
  const [preparos, setPreparos]         = useState([]);
  const [pratos, setPratos]             = useState([]);
  const [drinks, setDrinks]             = useState([]);
  const [reservas, setReservas]         = useState([]);
  const [custosFixos, setCustosFixos]   = useState([]);
  const [compras, setCompras]           = useState([]);

  async function carregar() {
    setLoading(true);
    const { data: ev } = await fetchEvento(eventoId);
    if (!ev) { setLoading(false); return; }
    setEvento(ev);

    const [ing, prep, prat, drk, res, cf, cp] = await Promise.all([
      Ingredientes.list(eventoId),
      Preparos.list(eventoId),
      Pratos.list(eventoId),
      Drinks.list(eventoId),
      Reservas.list(eventoId),
      CustosFixos.list(eventoId),
      Compras.list(eventoId),
    ]);
    setIngredientes(ing.data || []);
    setPreparos(prep.data || []);
    setPratos(prat.data || []);
    setDrinks(drk.data || []);
    setCompras(cp.data || []);
    setReservas(res.data || []);
    setCustosFixos(cf.data || []);
    setLoading(false);
  }
  useEffect(() => { if (eventoId) carregar(); }, [eventoId]);

  // ─── Cálculos derivados ─────────────────────────────────────────────────
  const calc = useMemo(() => {
    if (!evento) return null;
    const peopleMultiplier = evento.charge_mode === "person" ? 1 : 2;
    const unitName = evento.charge_mode === "person" ? "pessoa" : "casal";
    const unitPlural = evento.charge_mode === "person" ? "pessoas" : "casais";

    // CMV médio por categoria
    const avgCategoria = (categoria) => {
      const itens = pratos.filter((p) => p.categoria === categoria);
      if (!itens.length) return 0;
      return itens.reduce((s, p) => s + custoPrato(p, ingredientes, preparos), 0) / itens.length;
    };
    const avgDrinks = () => {
      const itens = drinks.filter((d) => !d.is_extra);
      if (!itens.length) return 0;
      return itens.reduce((s, d) => s + custoDrink(d, ingredientes, preparos), 0) / itens.length;
    };

    const cmvBreakdown = {
      entrada:    avgCategoria("Entrada")    * (evento.entradas_inc || 0),
      principal:  avgCategoria("Principal")  * (evento.principais_inc || 0),
      sobremesa:  avgCategoria("Sobremesa")  * (evento.sobremesas_inc || 0),
      drink:      avgDrinks()                * (evento.drinks_inc || 0),
    };
    const cmvUnit = cmvBreakdown.entrada + cmvBreakdown.principal + cmvBreakdown.sobremesa + cmvBreakdown.drink;

    // Receitas
    const baseRevenue = reservas.length * Number(evento.preco_unit);
    const extraInfo = reservas.map((r) => {
      const items = (r.extra_drinks || []).map((ed) => {
        const drink = drinks.find((d) => d.id === ed.drinkId);
        if (!drink) return { qty: ed.qty, revenue: 0, cost: 0 };
        const cost = custoDrink(drink, ingredientes, preparos);
        return { qty: ed.qty, revenue: Number(drink.preco_venda) * ed.qty, cost: cost * ed.qty };
      });
      return {
        revenue: items.reduce((s, i) => s + i.revenue, 0),
        cost:    items.reduce((s, i) => s + i.cost, 0),
      };
    });
    const totalExtraRevenue = extraInfo.reduce((s, e) => s + e.revenue, 0);
    const totalExtraCost    = extraInfo.reduce((s, e) => s + e.cost, 0);
    const totalRevenue      = baseRevenue + totalExtraRevenue;
    const totalSinal        = reservas.reduce((s, r) => s + Number(r.sinal || 0), 0);
    const totalCMV          = reservas.length * cmvUnit + totalExtraCost;

    // Custos fixos
    const itemAmount = (c) => Number(c.person_count || 0) * Number(c.value_per_person || 0);
    const totalFixos = custosFixos.reduce((s, c) => s + itemAmount(c), 0);
    const laborTotal = custosFixos.filter((c) => c.categoria === "cmo").reduce((s, c) => s + itemAmount(c), 0);

    // Impostos e maquininha
    const machineRate = calcularMaquininha(evento.credito_rate, evento.debito_rate, evento.credito_mix);
    const impostos    = totalRevenue * Number(evento.impostos_rate);
    const machineFee  = reservas.reduce((s, r) => {
      const extraR = extraInfo[reservas.indexOf(r)]?.revenue || 0;
      const value  = Number(evento.preco_unit) + extraR;
      return s + value * rateForMethod(r.payment_method, evento);
    }, 0);

    const totalExpenses = totalFixos + totalCMV + impostos + machineFee;
    const profit        = totalRevenue - totalExpenses;
    const profitMargin  = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Break-even
    const contributionPerUnit = Number(evento.preco_unit) - cmvUnit -
                                Number(evento.preco_unit) * (Number(evento.impostos_rate) + machineRate);
    const breakeven = contributionPerUnit > 0 ? Math.ceil(totalFixos / contributionPerUnit) : null;

    return {
      peopleMultiplier, unitName, unitPlural,
      cmvUnit, cmvBreakdown,
      baseRevenue, totalRevenue, totalSinal, totalCMV, totalFixos, laborTotal,
      machineRate, impostos, machineFee,
      totalExpenses, profit, profitMargin,
      contributionPerUnit, breakeven,
    };
  }, [evento, ingredientes, preparos, pratos, drinks, reservas, custosFixos]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Carregando..." back={true} />
      </div>
    );
  }
  if (!evento) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Evento não encontrado" back={true} />
        <PageBody>
          <Card className="!p-6 text-center">
            <p style={{ color: "var(--muted)" }}>Esse evento não existe ou foi removido.</p>
            <button onClick={() => router.push("/dashboard/eventos")} style={{ marginTop: 16, color: "var(--accent-fg)" }}>← Voltar para Eventos</button>
          </Card>
        </PageBody>
      </div>
    );
  }

  const dias = diasAte(evento.data_evento);

  return (
    <div className="min-h-screen">
      <PageHeader title={evento.nome} subtitle={evento.subtitulo || `${evento.tag || ""} · ${new Date(evento.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}`} back={true} />
      <PageBody>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          {TABS.map((t) => {
            const Ic = t.icon;
            const ativo = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10,
                  background: ativo ? "var(--accent-fg)" : "var(--elevated)",
                  color: ativo ? "#000" : "var(--muted)",
                  border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                <Ic size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo da aba */}
        {tab === "dashboard" && calc && (
          <>
            {evento.banner_url && (
              <Card className="!p-0 mb-4 overflow-hidden">
                <img src={evento.banner_url} alt={evento.nome} style={{ width: "100%", height: 180, objectFit: "cover" }} />
              </Card>
            )}

            {/* Countdown */}
            <Card className="!p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  {dias > 0 && (<><strong style={{ fontSize: 28, color: "var(--accent-fg)" }}>{dias}</strong><span style={{ marginLeft: 6, color: "var(--muted)" }}>dias restantes</span></>)}
                  {dias === 0 && <strong style={{ fontSize: 22, color: "#F59E0B" }}>🎉 O grande dia chegou!</strong>}
                  {dias < 0 && <span style={{ color: "var(--dim)" }}>Encerrado há {Math.abs(dias)} dia{Math.abs(dias) !== 1 ? "s" : ""}</span>}
                </div>
                <Calendar size={32} style={{ color: "var(--muted)" }} />
              </div>
              <p className="text-sm" style={{ color: "var(--dim)" }}>{new Date(evento.data_evento + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </Card>

            <KpiGrid>
              <Kpi icon={TrendingUp} label="Faturamento projetado" value={fmtBRL(calc.totalRevenue)} tint="#10B981" />
              <Kpi icon={DollarSign} label="Entradas recebidas" value={fmtBRL(calc.totalSinal)} tint="var(--accent-fg)" />
              <Kpi icon={Activity} label="Lucro líquido" value={fmtBRL(calc.profit)} tint={calc.profit >= 0 ? "#10B981" : "#EF4444"} />
              <Kpi icon={Users} label={`${calc.unitPlural} confirmados`} value={`${reservas.length} / ${evento.capacidade}`} tint="#3B82F6" />
            </KpiGrid>

            {/* Break-even */}
            {calc.breakeven !== null && (
              <Card className="!p-4 mb-4" style={reservas.length >= calc.breakeven ? { borderLeft: "3px solid #10B981" } : { borderLeft: "3px solid #F59E0B" }}>
                <div className="flex items-center gap-3 mb-2">
                  <Target size={20} style={{ color: reservas.length >= calc.breakeven ? "#10B981" : "#F59E0B" }} />
                  <h3 style={{ fontWeight: 700, color: "var(--fg)" }}>Ponto de Equilíbrio</h3>
                </div>
                {reservas.length >= calc.breakeven ? (
                  <p className="text-sm" style={{ color: "var(--dim)" }}>
                    ✓ <strong style={{ color: "#10B981" }}>Já cobre os custos</strong> com {calc.breakeven} {calc.unitName === "casal" ? (calc.breakeven === 1 ? "casal" : "casais") : (calc.breakeven === 1 ? "pessoa" : "pessoas")} ·
                    está <strong style={{ color: "#10B981" }}>{reservas.length - calc.breakeven} acima</strong> da meta
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: "var(--dim)" }}>
                    Precisa de <strong style={{ color: "#F59E0B" }}>{calc.breakeven}</strong> {calc.breakeven === 1 ? calc.unitName : calc.unitPlural} para zerar prejuízo
                    · faltam <strong style={{ color: "#F59E0B" }}>{calc.breakeven - reservas.length}</strong>
                  </p>
                )}
                <div style={{ marginTop: 12, height: 6, background: "var(--elevated)", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, (reservas.length / calc.breakeven) * 100)}%`, height: "100%",
                    background: reservas.length >= calc.breakeven ? "#10B981" : "linear-gradient(90deg, #F59E0B, #EF4444)",
                  }} />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 text-[11px]">
                  <div><p style={{ color: "var(--dim)" }}>CMV por {calc.unitName}</p><strong style={{ color: "var(--fg)" }}>{fmtBRL(calc.cmvUnit)}</strong></div>
                  <div><p style={{ color: "var(--dim)" }}>Contribuição por {calc.unitName}</p><strong style={{ color: calc.contributionPerUnit > 0 ? "#10B981" : "#EF4444" }}>{fmtBRL(calc.contributionPerUnit)}</strong></div>
                  <div><p style={{ color: "var(--dim)" }}>Custos fixos</p><strong style={{ color: "var(--fg)" }}>{fmtBRL(calc.totalFixos)}</strong></div>
                  <div><p style={{ color: "var(--dim)" }}>Margem total</p><strong style={{ color: calc.profitMargin >= 0 ? "#10B981" : "#EF4444" }}>{fmtPct(calc.profitMargin)}</strong></div>
                </div>
              </Card>
            )}

            <Card className="!p-4">
              <h3 style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 12 }}>Composição de Custos</h3>
              <div className="space-y-2">
                {[
                  { nome: "CMV (comidas + bar)", valor: calc.totalCMV, cor: "#F59E0B" },
                  { nome: "Custos Fixos", valor: calc.totalFixos, cor: "#EF4444" },
                  { nome: "Impostos", valor: calc.impostos, cor: "#3B82F6" },
                  { nome: "Maquininha", valor: calc.machineFee, cor: "#8B5CF6" },
                ].map((item) => {
                  const pct = calc.totalExpenses > 0 ? (item.valor / calc.totalExpenses) * 100 : 0;
                  return (
                    <div key={item.nome}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span style={{ color: "var(--muted)" }}>{item.nome}</span>
                        <strong style={{ color: "var(--fg)" }}>{fmtBRL(item.valor)} <span style={{ color: "var(--dim)", marginLeft: 6 }}>({fmtPct(pct)})</span></strong>
                      </div>
                      <div style={{ height: 6, background: "var(--elevated)", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: item.cor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {tab === "cardapio" && (
          <TabCardapio
            eventoId={eventoId}
            ingredientes={ingredientes}
            preparos={preparos}
            pratos={pratos}
            onChange={carregar}
          />
        )}

        {tab === "drinks" && (
          <TabDrinks
            eventoId={eventoId}
            ingredientes={ingredientes}
            preparos={preparos}
            drinks={drinks}
            onChange={carregar}
          />
        )}

        {tab === "reservas" && (
          <TabReservas
            eventoId={eventoId}
            evento={evento}
            reservas={reservas}
            pratos={pratos}
            drinks={drinks}
            ingredientes={ingredientes}
            preparos={preparos}
            onChange={carregar}
          />
        )}

        {tab === "compras" && (
          <TabCompras
            evento={evento}
            reservas={reservas}
            pratos={pratos}
            drinks={drinks}
            ingredientes={ingredientes}
            preparos={preparos}
          />
        )}

        {tab === "financeiro" && calc && (
          <TabFinanceiro
            eventoId={eventoId}
            evento={evento}
            custosFixos={custosFixos}
            reservas={reservas}
            compras={compras}
            calc={calc}
            onChange={carregar}
          />
        )}

        {tab === "config" && (
          <TabConfig evento={evento} onChange={carregar} />
        )}
      </PageBody>
    </div>
  );
}
