"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchContadoresModulo } from "../../../lib/contadores";
import {
  AlertTriangle, Armchair, Award, BarChart3, BriefcaseBusiness, Boxes, Calculator,
  CalendarCheck, ClipboardCheck, ClipboardList, FileBarChart, FileText, FlaskConical,
  GraduationCap, Landmark, LayoutDashboard, LayoutList, ListChecks, Network, Package,
  PackageSearch, ReceiptText, ScrollText, Settings, ShieldCheck, ShoppingCart,
  Tag, Target, Users, UserRoundCheck, Utensils, Wallet, Wine, Wrench, CalendarClock,
} from "lucide-react";
import ModuleHub from "../../../components/ModuleHub";

// Central de navegação de cada módulo, em COLUNAS (kanban visual). Um único
// componente (ModuleHub) para todos. As rotas e permissões são as existentes.
const MODULOS = {
  cozinha: {
    title: "Operação da Cozinha", subtitle: "Cadastros, estoque, produção, qualidade e rotinas da cozinha", icon: Utensils,
    columns: [
      { title: "Cadastros", subtitle: "Base da cozinha", icon: FlaskConical, accent: "#059669", items: [
        { label: "Ingredientes", desc: "Matérias-primas e itens", href: "/dashboard/operacao/ingredientes?dept=cozinha", icon: FlaskConical, countKey: "insumos" },
        { label: "Fichas Técnicas", desc: "Receitas e composições", href: "/dashboard/operacao/fichas?dept=cozinha", icon: LayoutList, countKey: "fichas" },
        { label: "Fornecedores", desc: "Contatos e compras", href: "/dashboard/operacao/fornecedores", icon: Users, countKey: "fornecedores" },
      ]},
      { title: "Estoque e Compras", subtitle: "Movimentações e abastecimento", icon: PackageSearch, accent: "#0891b2", items: [
        { label: "Estoque", desc: "Consulta de estoque atual", href: "/dashboard/operacao/estoque?dept=cozinha", icon: Boxes, countKey: "estoque" },
        { label: "Compras", desc: "Solicitações e pedidos", href: "/dashboard/operacao/compras?dept=cozinha", icon: ShoppingCart },
        { label: "Entrada de Notas", desc: "Notas e documentos", href: "/dashboard/operacao/notas?dept=cozinha", icon: ReceiptText, countKey: "notas" },
      ]},
      { title: "Produção", subtitle: "Produção e fichas técnicas", icon: ClipboardList, accent: "#7c3aed", items: [
        { label: "Guia de Montagem", desc: "Passo a passo das receitas", href: "/dashboard/operacao/montagem?dept=cozinha", icon: LayoutList, countKey: "montagens" },
        { label: "Produção do Dia", desc: "Produção diária", href: "/dashboard/operacao/producao?dept=cozinha", icon: Package },
        { label: "Orçamento de Eventos", desc: "Buffet e eventos", href: "/dashboard/operacao/orcamento?dept=cozinha", icon: CalendarClock },
      ]},
      { title: "Controle e Qualidade", subtitle: "Qualidade e conformidade", icon: ShieldCheck, accent: "#ea580c", items: [
        { label: "Etiquetas e Validade", desc: "Controle de validade", href: "/dashboard/operacao/etiquetas?dept=cozinha", icon: Tag, countKey: "etiquetas" },
        { label: "Controle de Validade", desc: "Vencimentos", href: "/dashboard/operacao/validade", icon: CalendarClock },
        { label: "Checklist da Cozinha", desc: "Rotinas e conferências", href: "/dashboard/operacao/rotina?dept=cozinha", icon: ClipboardCheck },
        { label: "Controles de Limpeza", desc: "Higiene e conformidade", href: "/dashboard/operacao/controles", icon: ShieldCheck },
      ]},
      { title: "Ferramentas", subtitle: "Utilitários", icon: Settings, accent: "#0f766e", items: [
        { label: "CMV da Cozinha", desc: "Custo de mercadoria", href: "/dashboard/financeiro/cmv", icon: Calculator },
      ]},
    ],
  },
  bar: {
    title: "Operação do Bar", subtitle: "Drinks, produtos, estoque e rotinas do bar", icon: Wine,
    columns: [
      { title: "Cadastros", subtitle: "Base do bar", icon: FlaskConical, accent: "#059669", items: [
        { label: "Produtos", desc: "Bebidas e ingredientes do bar", href: "/dashboard/operacao/ingredientes?dept=bar", icon: FlaskConical, countKey: "insumos" },
        { label: "Fichas de Drinks", desc: "Receitas dos drinks", href: "/dashboard/operacao/fichas?dept=bar", icon: Wine, countKey: "fichas" },
      ]},
      { title: "Estoque e Compras", subtitle: "Abastecimento", icon: PackageSearch, accent: "#0891b2", items: [
        { label: "Estoque", desc: "Consulta de estoque atual", href: "/dashboard/operacao/estoque?dept=bar", icon: Boxes, countKey: "estoque" },
        { label: "Compras", desc: "Solicitações e pedidos", href: "/dashboard/operacao/compras?dept=bar", icon: ShoppingCart },
        { label: "Entrada de Notas", desc: "Notas e documentos", href: "/dashboard/operacao/notas?dept=bar", icon: ReceiptText, countKey: "notas" },
      ]},
      { title: "Produção", subtitle: "Montagem e produção", icon: ClipboardList, accent: "#7c3aed", items: [
        { label: "Guia de Drinks", desc: "Montagem dos drinks", href: "/dashboard/operacao/montagem?dept=bar", icon: LayoutList, countKey: "montagens" },
        { label: "Produção do Dia", desc: "Produção diária", href: "/dashboard/operacao/producao?dept=bar", icon: Package },
        { label: "Orçamento de Eventos", desc: "Buffet e eventos", href: "/dashboard/operacao/orcamento?dept=bar", icon: CalendarClock },
      ]},
      { title: "Controle e Qualidade", subtitle: "Qualidade e rotinas", icon: ShieldCheck, accent: "#ea580c", items: [
        { label: "Etiquetas e Validade", desc: "Controle de validade", href: "/dashboard/operacao/etiquetas?dept=bar", icon: Tag, countKey: "etiquetas" },
        { label: "Checklist do Bar", desc: "Rotinas e conferências", href: "/dashboard/operacao/rotina?dept=bar", icon: ClipboardCheck },
      ]},
    ],
  },
  salao: {
    title: "Operação do Salão", subtitle: "Atendimento, mesas, treinamento e rotinas do salão", icon: Armchair,
    columns: [
      { title: "Atendimento", subtitle: "Operação em tempo real", icon: Armchair, accent: "#0284c7", items: [
        { label: "Mesas", desc: "Operação e comandas", href: "/dashboard/mesas", icon: Armchair },
        { label: "Observações", desc: "Ocorrências do atendimento", href: "/dashboard/operacao/observacoes", icon: ClipboardList },
      ]},
      { title: "Rotinas", subtitle: "Abertura e fechamento", icon: CalendarCheck, accent: "#7c3aed", items: [
        { label: "Checklist do Salão", desc: "Abertura e fechamento", href: "/dashboard/operacao/rotina?dept=salao", icon: ClipboardCheck },
        { label: "Checklists", desc: "Modelos e acompanhamento", href: "/dashboard/checklists?dept=salao", icon: ClipboardCheck },
        { label: "Tarefas da equipe", desc: "Responsáveis e prioridades", href: "/dashboard/tarefas", icon: ListChecks },
      ]},
      { title: "Desenvolvimento", subtitle: "Padrão de serviço", icon: GraduationCap, accent: "#ea580c", items: [
        { label: "Treinamentos", desc: "Padrão de serviço", href: "/dashboard/salao/treinamento", icon: GraduationCap },
      ]},
    ],
  },
  financeiro: {
    title: "Financeiro", subtitle: "Caixa, resultado, custos, metas e obrigações fiscais", icon: Wallet,
    columns: [
      { title: "Caixa e Resultado", subtitle: "Entradas, saídas e lucro", icon: Wallet, accent: "#4f46e5", items: [
        { label: "Fluxo de Caixa", desc: "Entradas e saídas", href: "/dashboard/financeiro", icon: Wallet },
        { label: "Fluxo detalhado", desc: "Movimentações e histórico", href: "/dashboard/financeiro/fluxo", icon: Landmark },
        { label: "Resultado (DRE)", desc: "Receita, custos e lucro", href: "/dashboard/financeiro/dre", icon: FileBarChart },
        { label: "Contas", desc: "Compromissos financeiros", href: "/dashboard/financeiro/contas", icon: ReceiptText, countKey: "contasPendentes" },
      ]},
      { title: "Custos e Metas", subtitle: "Rentabilidade e segurança", icon: Calculator, accent: "#0891b2", items: [
        { label: "CMV", desc: "Custo de mercadoria", href: "/dashboard/financeiro/cmv", icon: Calculator },
        { label: "Margens", desc: "Rentabilidade por produto", href: "/dashboard/financeiro/margem", icon: BarChart3 },
        { label: "Ponto de Equilíbrio", desc: "Metas e segurança", href: "/dashboard/financeiro/equilibrio", icon: Target },
      ]},
      { title: "Fiscal e Documentos", subtitle: "Obrigações e arquivos", icon: ShieldCheck, accent: "#ea580c", items: [
        { label: "Dados Fiscais", desc: "Cadastros e obrigações", href: "/dashboard/gestao/fiscal", icon: ShieldCheck },
        { label: "Documentos", desc: "Arquivos financeiros", href: "/dashboard/financeiro/documentos", icon: FileText },
      ]},
    ],
  },
  rh: {
    title: "Equipe & RH", subtitle: "Equipe, ponto, folha, documentos e desenvolvimento", icon: Users,
    columns: [
      { title: "Jornada e Folha", subtitle: "Ponto e pagamento", icon: UserRoundCheck, accent: "#e11d48", items: [
        { label: "Painel de RH", desc: "Equipe e indicadores", href: "/dashboard/rh", icon: LayoutDashboard },
        { label: "Ponto", desc: "Jornada e registros", href: "/dashboard/rh/ponto", icon: UserRoundCheck },
        { label: "Folha de Pagamento", desc: "Fechamento e valores", href: "/dashboard/rh/fechamento", icon: ReceiptText },
        { label: "Gastos Administrativos", desc: "Custos com pessoas", href: "/dashboard/rh/gastos-admin", icon: Calculator },
      ]},
      { title: "Pessoas", subtitle: "Estrutura e desenvolvimento", icon: Users, accent: "#7c3aed", items: [
        { label: "Cargos & Carreiras", desc: "Funções e salários", href: "/dashboard/rh/cargos", icon: Award },
        { label: "Portal do Colaborador", desc: "Acesso da equipe", href: "/dashboard/rh/colaborador", icon: Users, countKey: "colaboradores" },
        { label: "Organograma", desc: "Estrutura e lideranças", href: "/dashboard/rh/organograma", icon: Network },
        { label: "Recrutamento", desc: "Vagas e candidatos", href: "/dashboard/rh/recrutamento", icon: BriefcaseBusiness },
      ]},
      { title: "Apoio", subtitle: "Rotinas e registros", icon: ScrollText, accent: "#0891b2", items: [
        { label: "Refeição da Equipe", desc: "Cardápio dos funcionários", href: "/dashboard/rh/cardapio-funcionarios", icon: Utensils },
        { label: "Atas de Reunião", desc: "Decisões e alinhamentos", href: "/dashboard/rh/atas", icon: ScrollText },
      ]},
    ],
  },
  gestao: {
    title: "Gestão & Ajustes", subtitle: "Patrimônio, manutenção, auditoria, documentos e configurações", icon: Settings,
    columns: [
      { title: "Patrimônio", subtitle: "Bens e manutenção", icon: PackageSearch, accent: "#d97706", items: [
        { label: "Inventário", desc: "Bens e equipamentos", href: "/dashboard/gestao/inventario", icon: PackageSearch, countKey: "inventario" },
        { label: "Manutenção", desc: "Chamados e prevenção", href: "/dashboard/gestao/manutencao", icon: Wrench, countKey: "manutencoes" },
        { label: "Suprimentos", desc: "Recursos e abastecimento", href: "/dashboard/gestao/suprimentos", icon: ClipboardList },
      ]},
      { title: "Controle", subtitle: "Conferências e histórico", icon: ShieldCheck, accent: "#0891b2", items: [
        { label: "Auditoria", desc: "Conferências e histórico", href: "/dashboard/gestao/auditoria", icon: ShieldCheck },
        { label: "Tarefas de Gestão", desc: "Pendências administrativas", href: "/dashboard/gestao/tarefas", icon: ListChecks },
        { label: "Dados Fiscais", desc: "Informações legais", href: "/dashboard/gestao/fiscal", icon: Landmark },
      ]},
      { title: "Relatórios e Ajustes", subtitle: "Visão e configuração", icon: Settings, accent: "#4f46e5", items: [
        { label: "Relatórios", desc: "Visão consolidada", href: "/dashboard/relatorios", icon: FileBarChart },
        { label: "Documentos", desc: "Arquivos da gestão", href: "/dashboard/gestao/documentos", icon: FileText },
        { label: "Configurações", desc: "Unidades, acessos e regras", href: "/dashboard/configuracoes", icon: Settings },
      ]},
    ],
  },
};

export default function ModuloPage() {
  const params = useParams();
  const modulo = String(params?.modulo || "").toLowerCase();
  const config = MODULOS[modulo];
  const { unidadeAtiva } = useERP();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!config || !unidadeAtiva) return;
    let vivo = true;
    fetchContadoresModulo(modulo, unidadeAtiva).then((c) => { if (vivo) setCounts(c || {}); }).catch(() => {});
    return () => { vivo = false; };
  }, [modulo, unidadeAtiva, config]);

  if (!config) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <AlertTriangle className="mx-auto text-amber-500" size={34} />
        <h1 className="mt-3 text-2xl font-black" style={{ color: "var(--fg, #0f172a)" }}>Módulo não encontrado</h1>
      </div>
    );
  }
  return <ModuleHub config={config} counts={counts} />;
}
