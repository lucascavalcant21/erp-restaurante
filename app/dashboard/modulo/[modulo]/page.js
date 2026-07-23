"use client";

import { useParams } from "next/navigation";
import {
  AlertTriangle, Armchair, BarChart3, BriefcaseBusiness, Calculator,
  CalendarCheck, ClipboardCheck, ClipboardList, FileBarChart, FileText,
  GraduationCap, Landmark, LayoutDashboard, ListChecks, Network,
  PackageSearch, ReceiptText, ScrollText, Settings, ShieldCheck,
  Target, Users, UserRoundCheck, Utensils, Wallet, Wrench,
} from "lucide-react";
import ModuleWorkspace from "../../../components/ModuleWorkspace";

const MODULOS = {
  salao: {
    shortTitle: "Salão", title: "Operação integrada do Salão", theme: "sky", icon: Armchair,
    description: "Centralize abertura, atendimento, treinamento e padrões de serviço em um fluxo claro para toda a equipe.",
    primary: { label: "Abrir checklist", href: "/dashboard/operacao/rotina?dept=salao", icon: ClipboardCheck },
    flowHint: "Acesse rotina, mesas, tarefas, treinamento e registros do atendimento",
    stages: [
      { label: "Rotina do salão", hint: "Abertura e fechamento", href: "/dashboard/operacao/rotina?dept=salao", icon: CalendarCheck },
      { label: "Mesas e atendimento", hint: "Operação em tempo real", href: "/dashboard/mesas", icon: Armchair },
      { label: "Treinamentos", hint: "Padrão de serviço", href: "/dashboard/salao/treinamento", icon: GraduationCap },
    ],
    items: [
      { label: "Tarefas da equipe", hint: "Responsáveis e prioridades", href: "/dashboard/tarefas", icon: ListChecks },
      { label: "Observações", hint: "Ocorrências do atendimento", href: "/dashboard/operacao/observacoes", icon: ClipboardList },
      { label: "Checklists", hint: "Modelos e acompanhamento", href: "/dashboard/checklists?dept=salao", icon: ClipboardCheck },
    ],
    tools: [
      { label: "Mesas", href: "/dashboard/mesas", icon: Armchair },
      { label: "Treinamentos", href: "/dashboard/salao/treinamento", icon: GraduationCap },
      { label: "Tarefas", href: "/dashboard/tarefas", icon: ListChecks },
    ],
  },
  financeiro: {
    shortTitle: "Financeiro", title: "Gestão financeira integrada", theme: "indigo", icon: Wallet,
    description: "Acompanhe caixa, resultado, custos, metas e obrigações fiscais sem perder o caminho entre os números.",
    primary: { label: "Abrir fluxo de caixa", href: "/dashboard/financeiro", icon: Wallet },
    flowHint: "Conecte caixa, DRE, CMV, margens, contas e documentos fiscais",
    stages: [
      { label: "Fluxo de caixa", hint: "Entradas e saídas", href: "/dashboard/financeiro", icon: Wallet },
      { label: "Resultado (DRE)", hint: "Receita, custos e lucro", href: "/dashboard/financeiro/dre", icon: FileBarChart },
      { label: "Ponto de equilíbrio", hint: "Metas e segurança", href: "/dashboard/financeiro/equilibrio", icon: Target },
    ],
    items: [
      { label: "CMV", hint: "Custo de mercadoria", href: "/dashboard/financeiro/cmv", icon: Calculator },
      { label: "Margens", hint: "Rentabilidade por produto", href: "/dashboard/financeiro/margem", icon: BarChart3 },
      { label: "Contas", hint: "Compromissos financeiros", href: "/dashboard/financeiro/contas", icon: ReceiptText },
      { label: "Fluxo detalhado", hint: "Movimentações e histórico", href: "/dashboard/financeiro/fluxo", icon: Landmark },
      { label: "Dados fiscais", hint: "Cadastros e obrigações", href: "/dashboard/gestao/fiscal", icon: ShieldCheck },
      { label: "Documentos", hint: "Arquivos financeiros", href: "/dashboard/financeiro/documentos", icon: FileText },
    ],
    tools: [
      { label: "Ver DRE", href: "/dashboard/financeiro/dre", icon: FileBarChart },
      { label: "Analisar CMV", href: "/dashboard/financeiro/cmv", icon: Calculator },
      { label: "Dados fiscais", href: "/dashboard/gestao/fiscal", icon: ShieldCheck },
    ],
  },
  rh: {
    shortTitle: "Equipe & RH", title: "Gestão integrada de pessoas", theme: "rose", icon: Users,
    description: "Organize equipe, ponto, folha, documentos e desenvolvimento dos colaboradores em uma visão única.",
    primary: { label: "Abrir painel de RH", href: "/dashboard/rh", icon: Users },
    flowHint: "Acesse jornada, folha, organograma, recrutamento, documentos e comunicação",
    stages: [
      { label: "Painel de RH", hint: "Equipe e indicadores", href: "/dashboard/rh", icon: LayoutDashboard },
      { label: "Ponto", hint: "Jornada e registros", href: "/dashboard/rh/ponto", icon: UserRoundCheck },
      { label: "Folha de pagamento", hint: "Fechamento e valores", href: "/dashboard/rh/fechamento", icon: ReceiptText },
    ],
    items: [
      { label: "Portal do colaborador", hint: "Acesso da equipe", href: "/dashboard/rh/colaborador", icon: Users },
      { label: "Organograma", hint: "Estrutura e lideranças", href: "/dashboard/rh/organograma", icon: Network },
      { label: "Recrutamento", hint: "Vagas e candidatos", href: "/dashboard/rh/recrutamento", icon: BriefcaseBusiness },
      { label: "Refeição da equipe", hint: "Cardápio dos funcionários", href: "/dashboard/rh/cardapio-funcionarios", icon: Utensils },
      { label: "Atas de reunião", hint: "Decisões e alinhamentos", href: "/dashboard/rh/atas", icon: ScrollText },
      { label: "Gastos administrativos", hint: "Custos com pessoas", href: "/dashboard/rh/gastos-admin", icon: Calculator },
    ],
    tools: [
      { label: "Bater ponto", href: "/dashboard/rh/ponto", icon: UserRoundCheck },
      { label: "Organograma", href: "/dashboard/rh/organograma", icon: Network },
      { label: "Recrutamento", href: "/dashboard/rh/recrutamento", icon: BriefcaseBusiness },
    ],
  },
  gestao: {
    shortTitle: "Gestão & Ajustes", title: "Gestão e estrutura do negócio", theme: "amber", icon: Settings,
    description: "Cuide de patrimônio, manutenção, auditoria, documentos e configurações com uma navegação organizada e previsível.",
    primary: { label: "Abrir inventário", href: "/dashboard/gestao/inventario", icon: PackageSearch },
    flowHint: "Acesse inventário, manutenção, auditoria, suprimentos, relatórios e configurações",
    stages: [
      { label: "Inventário", hint: "Bens e equipamentos", href: "/dashboard/gestao/inventario", icon: PackageSearch },
      { label: "Manutenção", hint: "Chamados e prevenção", href: "/dashboard/gestao/manutencao", icon: Wrench },
      { label: "Relatórios", hint: "Visão consolidada", href: "/dashboard/relatorios", icon: FileBarChart },
    ],
    items: [
      { label: "Auditoria", hint: "Conferências e histórico", href: "/dashboard/gestao/auditoria", icon: ShieldCheck },
      { label: "Suprimentos", hint: "Recursos e abastecimento", href: "/dashboard/gestao/suprimentos", icon: ClipboardList },
      { label: "Documentos", hint: "Arquivos da gestão", href: "/dashboard/gestao/documentos", icon: FileText },
      { label: "Tarefas de gestão", hint: "Pendências administrativas", href: "/dashboard/gestao/tarefas", icon: ListChecks },
      { label: "Dados fiscais", hint: "Informações legais", href: "/dashboard/gestao/fiscal", icon: Landmark },
      { label: "Configurações", hint: "Unidades, acessos e regras", href: "/dashboard/configuracoes", icon: Settings },
    ],
    tools: [
      { label: "Manutenções", href: "/dashboard/gestao/manutencao", icon: Wrench },
      { label: "Relatórios", href: "/dashboard/relatorios", icon: FileBarChart },
      { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
    ],
  },
};

export default function ModuloPage() {
  const params = useParams();
  const config = MODULOS[String(params?.modulo || "").toLowerCase()];
  if (!config) {
    return <div className="mx-auto max-w-xl px-5 py-16 text-center"><AlertTriangle className="mx-auto text-amber-500" size={34} /><h1 className="mt-3 text-2xl font-black text-slate-900">Módulo não encontrado</h1></div>;
  }
  return <ModuleWorkspace config={config} />;
}
