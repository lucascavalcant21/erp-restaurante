"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchContadoresModulo } from "../../../lib/contadores";
import {
  AlertTriangle, Armchair, Award, BarChart3, BookOpen, BriefcaseBusiness, Boxes, Calculator,
  CalendarCheck, ClipboardCheck, ClipboardList, FileBarChart, FileText, FlaskConical,
  GraduationCap, Landmark, LayoutDashboard, LayoutList, ListChecks, Network, Package,
  PackageSearch, ReceiptText, ScrollText, Settings, ShieldCheck, ShoppingCart,
  Store, Tag, Target, Users, UserRoundCheck, Utensils, Wallet, Wine, Wrench, CalendarClock, Clock,
  PieChart,
} from "lucide-react";
import ModuleHub from "../../../components/ModuleHub";

// Central de navegação de cada módulo, em COLUNAS (kanban visual). Um único
// componente (ModuleHub) para todos. As rotas e permissões são as existentes.
const MODULOS = {
  cozinha: {
    title: "Cozinha", subtitle: "Fichas, ingredientes, estoque e o que produzir hoje", icon: Utensils,
    columns: [
      { title: "Cadastros", subtitle: "Ingredientes, receitas e fornecedores", icon: FlaskConical, accent: "#059669", items: [
        { label: "Ingredientes", desc: "Matérias-primas e itens", href: "/dashboard/operacao/ingredientes?dept=cozinha", icon: FlaskConical, countKey: "insumos" },
        { label: "Fichas Técnicas", desc: "Receitas e composições", href: "/dashboard/operacao/fichas?dept=cozinha", icon: LayoutList, countKey: "fichas" },
        { label: "Fornecedores", desc: "Contatos e compras", href: "/dashboard/operacao/fornecedores", icon: Users, countKey: "fornecedores" },
      ]},
      { title: "Estoque e compras", subtitle: "O que tem, o que falta e o que chegou", icon: PackageSearch, accent: "#0891b2", items: [
        { label: "Estoque", desc: "O que tem e o que está acabando", href: "/dashboard/operacao/estoque?dept=cozinha", icon: Boxes, countKey: "estoque" },
        { label: "Compras", desc: "Solicitações e pedidos", href: "/dashboard/operacao/compras?dept=cozinha", icon: ShoppingCart },
        { label: "Entrada de Notas", desc: "Lançar nota do fornecedor", href: "/dashboard/operacao/notas?dept=cozinha", icon: ReceiptText, countKey: "notas" },
      ]},
      { title: "Produção", subtitle: "O que preparar hoje e como montar", icon: ClipboardList, accent: "#7c3aed", items: [
        { label: "Guia de Montagem", desc: "Passo a passo das receitas", href: "/dashboard/operacao/montagem?dept=cozinha", icon: LayoutList, countKey: "montagens" },
        { label: "Produção do Dia", desc: "O que preparar e quanto sai do estoque", href: "/dashboard/operacao/producao?dept=cozinha", icon: Package },
        { label: "Orçamento de Eventos", desc: "Montar preço de festa e buffet", href: "/dashboard/operacao/orcamento?dept=cozinha", icon: CalendarClock },
      ]},
      { title: "Controle", subtitle: "Validade, limpeza e checklists", icon: ShieldCheck, accent: "#ea580c", items: [
        { label: "Controle de Validade", desc: "O que vence hoje e amanhã", href: "/dashboard/operacao/validade", icon: CalendarClock },
        { label: "Checklist da Cozinha", desc: "Rotinas e conferências", href: "/dashboard/operacao/rotina?dept=cozinha", icon: ClipboardCheck },
        { label: "Controles de Limpeza", desc: "Higiene e conformidade", href: "/dashboard/operacao/controles", icon: ShieldCheck },
        { label: "Guia de Uso", desc: "Como usar e higienizar produtos e equipamentos", href: "/dashboard/operacao/guias", icon: BookOpen },
      ]},
      { title: "Custos", subtitle: "Quanto a cozinha consome", icon: Settings, accent: "#0f766e", items: [
        { label: "CMV da Cozinha", desc: "Custo de mercadoria", href: "/dashboard/financeiro/cmv", icon: Calculator },
      ]},
    ],
  },
  bar: {
    title: "Bar", subtitle: "Drinks, produtos, estoque e o que produzir hoje", icon: Wine,
    columns: [
      { title: "Cadastros", subtitle: "Produtos e receitas de drinks", icon: FlaskConical, accent: "#059669", items: [
        { label: "Produtos", desc: "Bebidas e ingredientes do bar", href: "/dashboard/operacao/ingredientes?dept=bar", icon: FlaskConical, countKey: "insumos" },
        { label: "Fichas de Drinks", desc: "Dose, custo e preço de cada drink", href: "/dashboard/operacao/fichas?dept=bar", icon: Wine, countKey: "fichas" },
      ]},
      { title: "Estoque e compras", subtitle: "O que tem, o que falta e o que chegou", icon: PackageSearch, accent: "#0891b2", items: [
        { label: "Estoque", desc: "O que tem e o que está acabando", href: "/dashboard/operacao/estoque?dept=bar", icon: Boxes, countKey: "estoque" },
        { label: "Compras", desc: "Solicitações e pedidos", href: "/dashboard/operacao/compras?dept=bar", icon: ShoppingCart },
        { label: "Entrada de Notas", desc: "Lançar nota do fornecedor", href: "/dashboard/operacao/notas?dept=bar", icon: ReceiptText, countKey: "notas" },
      ]},
      { title: "Produção", subtitle: "O que preparar hoje e como montar", icon: ClipboardList, accent: "#7c3aed", items: [
        { label: "Guia de Drinks", desc: "Copo, gelo e ordem de montagem", href: "/dashboard/operacao/montagem?dept=bar", icon: LayoutList, countKey: "montagens" },
        { label: "Produção do Dia", desc: "O que preparar e quanto sai do estoque", href: "/dashboard/operacao/producao?dept=bar", icon: Package },
        { label: "Orçamento de Eventos", desc: "Montar preço de festa e buffet", href: "/dashboard/operacao/orcamento?dept=bar", icon: CalendarClock },
      ]},
      { title: "Controle", subtitle: "Checklist de abertura e fechamento", icon: ShieldCheck, accent: "#ea580c", items: [
        { label: "Checklist do Bar", desc: "Rotinas e conferências", href: "/dashboard/operacao/rotina?dept=bar", icon: ClipboardCheck },
      ]},
    ],
  },
  salao: {
    title: "Salão", subtitle: "Mesas, pedidos, iFood e o treino da equipe", icon: Armchair,
    columns: [
      { title: "Atendimento", subtitle: "Mesas, iFood, cupons e ocorrências", icon: Armchair, accent: "#0284c7", items: [
        { label: "Mesas", desc: "Operação e comandas", href: "/dashboard/mesas", icon: Armchair },
        { label: "Observações", desc: "Ocorrências do atendimento", href: "/dashboard/operacao/observacoes", icon: ClipboardList },
        { label: "Canal iFood", desc: "Integração e pedidos", href: "/dashboard/canais/ifood", icon: Store },
        { label: "Cupons", desc: "Promoções e descontos", href: "/dashboard/marketing/cupons", icon: Tag },
      ]},
      { title: "Rotinas", subtitle: "Checklists e tarefas do turno", icon: CalendarCheck, accent: "#7c3aed", items: [
        { label: "Checklist do Salão", desc: "Abertura e fechamento", href: "/dashboard/operacao/rotina?dept=salao", icon: ClipboardCheck },
        { label: "Checklists", desc: "Modelos e acompanhamento", href: "/dashboard/checklists?dept=salao", icon: ClipboardCheck },
        { label: "Tarefas da equipe", desc: "Responsáveis e prioridades", href: "/dashboard/tarefas", icon: ListChecks },
      ]},
      { title: "Treinamento", subtitle: "Trilhas da equipe de salão", icon: GraduationCap, accent: "#ea580c", items: [
        { label: "Treinamentos", desc: "Padrão de serviço", href: "/dashboard/salao/treinamento", icon: GraduationCap },
      ]},
    ],
  },
  financeiro: {
    title: "Financeiro", subtitle: "Quanto entrou, quanto saiu e quanto sobrou", icon: Wallet,
    columns: [
      { title: "Caixa e resultado", subtitle: "Entradas, saídas, contas e o DRE", icon: Wallet, accent: "#4f46e5", items: [
        { label: "Fluxo de Caixa", desc: "Entradas e saídas", href: "/dashboard/financeiro", icon: Wallet },
        { label: "Fluxo detalhado", desc: "Movimentações e histórico", href: "/dashboard/financeiro/fluxo", icon: Landmark },
        { label: "Resultado (DRE)", desc: "Receita, custos e lucro", href: "/dashboard/financeiro/dre", icon: FileBarChart },
        { label: "Contas", desc: "O que há para pagar e receber", href: "/dashboard/financeiro/contas", icon: ReceiptText, countKey: "contasPendentes" },
      ]},
      { title: "Custos e margem", subtitle: "Para onde vai cada real da venda", icon: Calculator, accent: "#0891b2", items: [
        { label: "CMV", desc: "Custo de mercadoria", href: "/dashboard/financeiro/cmv", icon: Calculator },
        { label: "Margens", desc: "Rentabilidade por produto", href: "/dashboard/financeiro/margem", icon: BarChart3 },
        { label: "Pizza do Lucro", desc: "Para onde vai cada real", href: "/dashboard/financeiro/pizza", icon: PieChart },
      ]},
      { title: "Fiscal e documentos", subtitle: "Notas, impostos e arquivos", icon: ShieldCheck, accent: "#ea580c", items: [
        { label: "Dados Fiscais", desc: "Cadastros e obrigações", href: "/dashboard/gestao/fiscal", icon: ShieldCheck },
        { label: "Documentos", desc: "Notas, contratos e comprovantes", href: "/dashboard/financeiro/documentos", icon: FileText },
      ]},
    ],
  },
  rh: {
    title: "RH", subtitle: "Quem trabalha, quanto bateu ponto e quanto recebe", icon: Users,
    columns: [
      { title: "Jornada e folha", subtitle: "Ponto, pagamento e compras do mês", icon: UserRoundCheck, accent: "#e11d48", items: [
        { label: "Painel de RH", desc: "Equipe e indicadores", href: "/dashboard/rh", icon: LayoutDashboard },
        { label: "Ponto", desc: "Jornada e registros", href: "/dashboard/rh/ponto", icon: UserRoundCheck },
        { label: "Folha de Pagamento", desc: "Fechamento e valores", href: "/dashboard/rh/fechamento", icon: ReceiptText },
        { label: "Compras do Mês", desc: "Quanto entrou de mercadoria", href: "/dashboard/rh/gastos-admin", icon: Calculator },
      ]},
      { title: "Pessoas", subtitle: "Cargos, organograma e contratação", icon: Users, accent: "#7c3aed", items: [
        { label: "Cargos & Carreiras", desc: "Funções e salários", href: "/dashboard/rh/cargos", icon: Award },
        { label: "Portal do Colaborador", desc: "Acesso da equipe", href: "/dashboard/rh/colaborador", icon: Users, countKey: "colaboradores" },
        { label: "Organograma", desc: "Estrutura e lideranças", href: "/dashboard/rh/organograma", icon: Network },
        { label: "Guia de Funções", desc: "A rotina de cada função, hora a hora", href: "/dashboard/rh/funcoes", icon: Clock },
        { label: "Recrutamento", desc: "Vagas e candidatos", href: "/dashboard/rh/recrutamento", icon: BriefcaseBusiness },
      ]},
      { title: "Apoio", subtitle: "Atas, refeitório e regulamento", icon: ScrollText, accent: "#0891b2", items: [
        { label: "Atas de Reunião", desc: "Decisões e alinhamentos", href: "/dashboard/rh/atas", icon: ScrollText },
        { label: "Refeitório", desc: "Cardápio da equipe", href: "/dashboard/rh/cardapio-funcionarios", icon: Utensils },
        { label: "Bônus e Regulamento", desc: "Regras de RH", href: "/dashboard/rh/configuracoes", icon: Settings },
      ]},
    ],
  },
  gestao: {
    title: "Gestão", subtitle: "Equipamentos, conferências, relatórios e acessos", icon: Settings,
    columns: [
      { title: "Patrimônio", subtitle: "Inventário, manutenção e suprimentos", icon: PackageSearch, accent: "#d97706", items: [
        { label: "Inventário", desc: "Bens e equipamentos", href: "/dashboard/gestao/inventario", icon: PackageSearch, countKey: "inventario" },
        { label: "Manutenção", desc: "Chamados e prevenção", href: "/dashboard/gestao/manutencao", icon: Wrench, countKey: "manutencoes" },
        { label: "Suprimentos", desc: "Recursos e abastecimento", href: "/dashboard/gestao/suprimentos", icon: ClipboardList },
      ]},
      { title: "Controle", subtitle: "Auditoria, tarefas e dados fiscais", icon: ShieldCheck, accent: "#0891b2", items: [
        { label: "Auditoria", desc: "Conferências e histórico", href: "/dashboard/gestao/auditoria", icon: ShieldCheck },
        { label: "Tarefas de Gestão", desc: "O que está em aberto na gestão", href: "/dashboard/gestao/tarefas", icon: ListChecks },
        { label: "Dados Fiscais", desc: "CNPJ, regime e impostos", href: "/dashboard/gestao/fiscal", icon: Landmark },
      ]},
      { title: "Relatórios e ajustes", subtitle: "Relatórios, lojas, acessos e o assistente", icon: Settings, accent: "#4f46e5", items: [
        { label: "Relatórios", desc: "Números do mês em uma página", href: "/dashboard/relatorios", icon: FileBarChart },
        { label: "Documentos", desc: "Arquivos da gestão", href: "/dashboard/gestao/documentos", icon: FileText },
        { label: "Configurações", desc: "Unidades, acessos e regras", href: "/dashboard/configuracoes", icon: Settings },
        { label: "Lojas", desc: "Unidades e endereços", href: "/dashboard/lojas", icon: Store },
        { label: "Gestão da Rede", desc: "Comparar e administrar as lojas", href: "/dashboard/rede/gestao", icon: Network },
        { label: "Assistente Hefisto", desc: "Perguntas sobre a operação", href: "/dashboard/ia/heitor", icon: Target },
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
