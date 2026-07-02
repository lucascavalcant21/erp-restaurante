"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { lerSessao, encerrarSessao, podeAcessar } from "../lib/auth";
import { useERP } from "../context/ERPContext";
import {
  Users, Bell, ChefHat, GlassWater, BarChart, 
  Briefcase, Fingerprint, Store, Settings, LogOut, ChevronDown, Check, Bike,
  UtensilsCrossed, FlaskConical, Package, ShoppingCart, FileText, TrendingUp
} from "lucide-react";

// Cards especiais de operação — renderizados de forma visual diferenciada
const OPERACAO_SETORES = [
  {
    id: "salao",
    titulo: "Operação Salão & Delivery",
    Icone: UtensilsCrossed,
    cor: "#4970AF",
    bg: "bg-blue-50",
    borda: "border-blue-200",
    links: [
      { label: "Frente de Caixa (PDV)", href: "/dashboard/salao/mesas", desc: "Abrir mesa, comanda e pagamento", badge: "LIVE", badgeCor: "bg-emerald-500" },
      { label: "App do Garçom", href: "/dashboard/salao/mesas?acao=garcom", desc: "Modo garçom com seleção de operador", badge: null },
      { label: "Delivery & iFood", href: "/dashboard/salao/online", desc: "Pedidos online e integrações", badge: "LIVE", badgeCor: "bg-orange-500" },
      { label: "Catálogo de Produtos", href: "/dashboard/operacao/produtos", desc: "Cardápio, preços e categorias", badge: null },
      { label: "Cardápio Digital (QR)", href: "/dashboard/operacao/cardapio", desc: "Cardápio via QR Code para clientes", badge: null },
      { label: "Painel de Senhas (TV)", href: "/chamada/dinamico", desc: "Exibir chamada em TV ou monitor", badge: "TV", badgeCor: "bg-slate-500" },
      { label: "Cupons de Desconto", href: "/dashboard/marketing/cupons", desc: "Criar e gerenciar promoções", badge: null },
      { label: "Observações Padrão", href: "/dashboard/operacao/observacoes", desc: "Obs. rápidas no lançamento de pedidos", badge: null },
    ]
  },
  {
    id: "cozinha",
    titulo: "Operação Cozinha",
    Icone: ChefHat,
    cor: "#D97706",
    bg: "bg-amber-50",
    borda: "border-amber-200",
    links: [
      { label: "KDS Cozinha", href: "/dashboard/kds?dept=cozinha", desc: "Monitor de pedidos em tempo real", badge: "LIVE", badgeCor: "bg-emerald-500" },
      { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas?dept=cozinha", desc: "Receitas com custo e rendimento", badge: null },
      { label: "Ingredientes e Insumos", href: "/dashboard/operacao/ingredientes?dept=cozinha", desc: "Banco de ingredientes com preços", badge: null },
      { label: "Controle de Estoque", href: "/dashboard/operacao/estoque", desc: "Posição atual, contagem e movimentos", badge: null },
      { label: "Lista de Compras", href: "/dashboard/operacao/compras", desc: "Sugestão automática por consumo", badge: null },
      { label: "Notas de Entrada (NF-e)", href: "/dashboard/operacao/notas", desc: "Lançar NF de fornecedores", badge: null },
      { label: "Análise de CMV", href: "/dashboard/financeiro/cmv", desc: "Custo real da mercadoria vendida", badge: null },
      { label: "Produção e Pré-Preparo", href: "/dashboard/operacao/producao", desc: "Registrar produções internas", badge: null },
      { label: "Validade de Produtos", href: "/dashboard/operacao/validade", desc: "Controle de vencimentos", badge: null },
      { label: "Rotinas Operacionais", href: "/dashboard/operacao/rotina", desc: "Checklists de abertura/fechamento", badge: null },
    ]
  },
  {
    id: "bar",
    titulo: "Operação Bar",
    Icone: GlassWater,
    cor: "#7C3AED",
    bg: "bg-purple-50",
    borda: "border-purple-200",
    links: [
      { label: "KDS Bar", href: "/dashboard/kds?dept=bar", desc: "Monitor de pedidos do bar", badge: "LIVE", badgeCor: "bg-emerald-500" },
      { label: "Drinks e Coquetéis", href: "/dashboard/operacao/drinks", desc: "Montagem e produção de drinks", badge: null },
      { label: "Fichas de Drinks", href: "/dashboard/operacao/fichas?dept=bar", desc: "Receitas com custo e insumos", badge: null },
      { label: "Ingredientes e Insumos", href: "/dashboard/operacao/ingredientes?dept=bar", desc: "Banco de ingredientes do bar", badge: null },
      { label: "Estoque do Bar", href: "/dashboard/operacao/estoque?dept=bar", desc: "Bebidas, xaropes e insumos", badge: null },
      { label: "Cardápio de Bebidas", href: "/dashboard/operacao/produtos?cat=Bebidas", desc: "Produtos do bar no cardápio", badge: null },
      { label: "Compras do Bar", href: "/dashboard/operacao/compras", desc: "Reposição de bebidas e insumos", badge: null },
    ]
  }
];

const MEGA_MENU = {
  "Financeiro": [
    { label: "Acerto de entregadores", href: "#" },
    { label: "Acerto de garçons", href: "#" },
    { label: "Categorias financeiras", href: "#" },
    { label: "Conciliação bancária", href: "#" },
    { label: "Contas bancárias", href: "#" },
    { label: "Fluxo de caixa", href: "/dashboard/financeiro" },
    { label: "Formas de pagamento", href: "#" },
    { label: "Fornecedores", href: "#" },
    { label: "Frentes de caixas", href: "#" },
    { label: "Lançamentos financeiros", href: "#" },
    { label: "Métodos de pagamento", href: "#" }
  ],
  "Relacionamento com cliente": [
    { label: "Cadastro de clientes", href: "#" },
    { label: "Cupons de desconto", href: "/dashboard/marketing/cupons" }
  ],
  "Relatórios": [
    { label: "Cupons gerados", href: "#" },
    { label: "Desempenho por atendente", href: "#" },
    { label: "Desempenho por garçom", href: "#" },
    { label: "DRE Gerencial/Financeiro", href: "/dashboard/financeiro/dre" },
    { label: "Faturamento por dia", href: "#" },
    { label: "Itens consumidos", href: "#" },
    { label: "Itens vendidos", href: "#" },
    { label: "Tempo de produção", href: "#" },
    { label: "Tempo por status", href: "#" },
    { label: "Vendas por área de entrega", href: "#" },
    { label: "Vendas por forma de pagamento", href: "#" },
    { label: "Vendas por período", href: "#" }
  ],
  "Recursos Humanos": [
    { label: "Gestão de RH e Departamento Pessoal", href: "/dashboard/rh" },
    { label: "Ponto Eletrônico", href: "/dashboard/rh/ponto" },
    { label: "Gestão de Colaboradores", href: "/dashboard/rh/colaborador" },
    { label: "Fechamento de Folha", href: "/dashboard/rh/fechamento" },
    { label: "Organograma", href: "/dashboard/rh/organograma" },
    { label: "Recrutamento e Seleção", href: "/dashboard/rh/recrutamento" }
  ],
  "Dashboards": [
    { label: "Acompanhamento de vendas", href: "/dashboard/relatorios" },
    { label: "Canais", href: "#" },
    { label: "Faturamento", href: "#" },
    { label: "Vendas por Data / Hora", href: "#" }
  ],
  "Opções da loja": [
    { label: "Áreas de entrega", href: "#" },
    { label: "Canais de venda e Integrações", href: "/dashboard/canais/ifood" },
    { label: "Comandas", href: "#" },
    { label: "Configurações", href: "/dashboard/configuracoes" },
    { label: "Painel de Senhas (TV)", href: "/chamada/dinamico" },
    { label: "Dados da loja", href: "#" },
    { label: "Dados fiscais", href: "/dashboard/gestao/fiscal" },
    { label: "Entregadores", href: "#" },
    { label: "Garçons", href: "#" },
    { label: "Inutilização de notas fiscais", href: "#" },
    { label: "Mesas", href: "#" },
    { label: "Modelos de impressão", href: "#" },
    { label: "Motivos de cancelamento", href: "#" },
    { label: "Observações Padrão", href: "/dashboard/operacao/observacoes" },
    { label: "Status da venda", href: "#" },
    { label: "Turnos", href: "#" }
  ]
};

function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  // Mostrar apenas alguns essenciais
  const mobileModules = [
    { id: "salao", label: "Mesas", icon: Users, href: "/dashboard/salao/mesas" },
    { id: "delivery", label: "Delivery", icon: Bike, href: "/dashboard/salao/online" },
    { id: "lojas", label: "Ajustes", icon: Settings, href: "/dashboard/configuracoes" },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A1128] border-t border-slate-800 flex items-stretch overflow-x-auto shadow-[0_-10px_30px_rgba(0,0,0,0.1)] h-16 pb-safe">
      {mobileModules.map(item => {
        const active = pathname.includes(item.href);
        return (
          <button key={item.id} onClick={() => router.push(item.href)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${active ? 'text-emerald-500 scale-105' : 'text-slate-400 hover:text-slate-200'}`}>
            <item.icon size={20} />
            <span className="text-[9px] font-bold uppercase truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

import { Search, ArrowUp, Star, Clock, LifeBuoy, ArrowDown } from "lucide-react";

function TopHeader({ onSair }) {
  const { unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar, unidadeInfo, megaMenuOpen, abrirMenu, fecharMenu } = useERP();
  const router = useRouter();
  const [searchMenu, setSearchMenu] = useState("");

  const handleMenuClick = (href) => {
    if (href === "/chamada/dinamico") {
       window.open(`/chamada/${unidadeAtiva}`, "_blank");
       fecharMenu();
       return;
    }
    if (href !== "#") {
      router.push(href);
      fecharMenu();
    }
  };

  return (
    <>
      <header className="h-14 border-b border-[#3A5B99] flex items-center justify-between sticky top-0 z-50 bg-[#4970AF] text-white shadow-sm">
        
        {/* LADO ESQUERDO: Logo e Botão do Mega Menu */}
        <div className="flex items-center h-full">
            <button onClick={() => megaMenuOpen ? fecharMenu() : abrirMenu()} className="h-full px-4 flex items-center justify-center bg-[#5C85C5] hover:bg-[#6D95D5] transition-colors border-r border-[#4970AF]">
               <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  {megaMenuOpen ? <ArrowDown size={18} className="text-white"/> : <ArrowUp size={18} className="text-white"/>}
               </div>
            </button>
            <button onClick={() => { router.push("/dashboard/salao/online"); setMegaMenuOpen(false); }} className="h-full px-4 flex items-center justify-center bg-[#4970AF] hover:bg-[#5C85C5] transition-colors border-r border-[#3A5B99]">
               <span className="text-xl font-black tracking-tighter">Hefisto</span>
            </button>
            
            {/* Ícones de Acesso Rápido (Saipos Style) */}
            <div className="flex items-center h-full">
               <button onClick={() => router.push("/dashboard/salao/online")} className="h-full px-4 flex items-center justify-center bg-[#4A72B2] hover:bg-[#5C85C5] transition-colors border-r border-[#3A5B99]" title="Delivery">
                  <div className="flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M19 15v-3h-3l-3-3h-3v3h-3v3c0 1.1.9 2 2 2h7c1.1 0 2-.9 2-2z"></path><circle cx="8" cy="19" r="2"></circle><circle cx="17" cy="19" r="2"></circle><path d="m14 15 2 2"></path><path d="M14 12v3"></path></svg>
                  </div>
               </button>
               <button onClick={() => router.push("/dashboard/salao/mesas?acao=garcom")} className="h-full px-4 flex items-center justify-center bg-[#4A72B2] hover:bg-[#5C85C5] transition-colors border-r border-[#3A5B99]" title="Selecionar Garçom">
                  <div className="flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  </div>
               </button>
               <button onClick={() => router.push("/dashboard/salao/mesas")} className="h-full px-4 flex items-center justify-center bg-[#4A72B2] hover:bg-[#5C85C5] transition-colors border-r border-[#3A5B99]" title="Ficha / Balcão">
                  <div className="flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path><path d="M16 16H8"></path><path d="M16 12H8"></path><path d="M10 8H8"></path></svg>
                  </div>
               </button>
            </div>
           
           <div className="px-4 hidden sm:flex items-center">
              <span className="font-bold text-sm tracking-wider uppercase text-white/90">
                 {unidadeInfo?.nome || 'SELECIONE A LOJA'}...
              </span>
           </div>
        </div>
        
        {/* LADO DIREITO: Loja e Sair */}
        <div className="flex items-center gap-4 px-4">
           {podeTrocar && (
             <div className="relative group">
               <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors text-xs font-bold uppercase">
                  Loja Ativa: {unidadeInfo?.nome || 'Nenhuma'} <ChevronDown size={14}/>
               </button>
               <div className="absolute right-0 top-full mt-1 w-48 bg-white text-slate-800 rounded shadow-xl hidden group-hover:block border border-slate-200 overflow-hidden">
                 {unidades.map(u => (
                   <button key={u.id} onClick={() => setUnidadeAtiva(u.id)} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center">
                     {u.nome}
                     {u.id === unidadeAtiva && <Check size={14} className="text-emerald-500"/>}
                   </button>
                 ))}
               </div>
             </div>
           )}

           <button onClick={onSair} className="p-2 bg-white/10 hover:bg-white/20 rounded transition-colors" title="Sair">
             <LogOut size={16} />
           </button>
        </div>
      </header>

      {/* MEGA MENU DROPDOWN */}
      {megaMenuOpen && (
         <div className="fixed inset-0 top-14 z-40 flex">
            {/* Overlay para fechar ao clicar fora */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => fecharMenu()}></div>
            
            {/* Box Principal do Menu */}
            <div className="relative bg-white w-full max-w-7xl mx-auto shadow-2xl flex rounded-b-lg overflow-hidden h-[85vh] sm:h-auto animate-in fade-in slide-in-from-top-4 duration-200">
               
               {/* SIDEBAR ESQUERDA DO MENU */}
               <div className="w-[200px] bg-[#F7F9FC] border-r border-slate-200 flex flex-col shrink-0">
                  <div className="p-4 space-y-4">
                     <div>
                        <h4 className="flex items-center gap-2 text-[#4970AF] font-bold text-sm mb-2"><Store size={16}/> Dados da conta</h4>
                        <ul className="text-xs space-y-2 text-slate-600 pl-6">
                           <li className="hover:text-blue-600 cursor-pointer">Dados financeiros</li>
                           <li className="hover:text-blue-600 cursor-pointer">Serviços</li>
                        </ul>
                     </div>
                     <div>
                        <h4 className="flex items-center gap-2 text-[#4970AF] font-bold text-sm mb-2"><Star size={16}/> Favoritos</h4>
                        <ul className="text-xs space-y-2 text-blue-500 pl-6">
                           <li className="cursor-pointer underline">Adicionar favoritos</li>
                        </ul>
                     </div>
                     <div>
                        <h4 className="flex items-center gap-2 text-[#4970AF] font-bold text-sm mb-2"><Clock size={16}/> Histórico</h4>
                        <ul className="text-xs space-y-2 text-slate-600 pl-6">
                           <li className="hover:text-blue-600 cursor-pointer">Cardápio</li>
                        </ul>
                     </div>
                  </div>
                  
                  <div className="mt-auto p-4 border-t border-slate-200">
                     <h4 className="flex items-center gap-2 text-[#4970AF] font-bold text-xs mb-1 cursor-pointer hover:underline"><LifeBuoy size={14}/> Suporte +</h4>
                     <p className="text-[10px] text-slate-400">Copyright © 2026 HEFISTO</p>
                     <p className="text-[10px] text-slate-400">1781904249029</p>
                  </div>
               </div>

               {/* ÁREA PRINCIPAL DOS LINKS */}
               <div className="flex-1 flex flex-col bg-white overflow-hidden p-6">
                  
                  {/* Busca */}
                  <div className="relative mb-6">
                     <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                        type="text" 
                        value={searchMenu}
                        onChange={e => setSearchMenu(e.target.value)}
                        placeholder="Procure uma página pelo nome ou categoria" 
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded outline-none focus:border-[#4970AF] focus:ring-1 focus:ring-[#4970AF] text-sm text-slate-700 placeholder-slate-400"
                     />
                  </div>

                  {/* Colunas de Categorias */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">

                      {/* ── SETORES DE OPERAÇÃO — Cards visuais premium ── */}
                      {!searchMenu && (
                        <div className="mb-8">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="h-px flex-1 bg-slate-100" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-2">Acesso Rápido por Setor</span>
                            <div className="h-px flex-1 bg-slate-100" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {OPERACAO_SETORES.map(setor => (
                              <div
                                key={setor.id}
                                className="rounded-2xl overflow-hidden shadow-sm border border-white/60"
                                style={{ background: `linear-gradient(145deg, white 0%, ${setor.bg.replace('bg-','').includes('-') ? 'var(--tw-bg-opacity)' : 'white'} 100%)` }}
                              >
                                {/* Faixa colorida no topo */}
                                <div className="px-4 py-3 flex items-center gap-3" style={{ background: `linear-gradient(90deg, ${setor.cor}15, ${setor.cor}05)`, borderBottom: `2px solid ${setor.cor}30` }}>
                                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: setor.cor }}>
                                    <setor.Icone size={18} className="text-white" />
                                  </div>
                                  <div>
                                    <p className="font-black text-sm leading-tight" style={{ color: setor.cor }}>{setor.titulo}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{setor.links.length} módulos disponíveis</p>
                                  </div>
                                </div>
                                {/* Lista de links */}
                                <div className="p-2">
                                  {setor.links.map((link, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleMenuClick(link.href)}
                                      className="w-full text-left px-3 py-2 rounded-xl transition-all duration-150 group flex items-center justify-between gap-2 hover:shadow-sm"
                                      style={{ '--hover-bg': `${setor.cor}10` }}
                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = `${setor.cor}12`}
                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <div className="min-w-0">
                                        <span className="text-[12.5px] font-semibold text-slate-700 group-hover:text-slate-900 leading-tight block truncate">{link.label}</span>
                                        {link.desc && <span className="text-[10.5px] text-slate-400 leading-tight block truncate">{link.desc}</span>}
                                      </div>
                                      {link.badge ? (
                                        <span className={`shrink-0 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full ${link.badgeCor} animate-pulse`}>{link.badge}</span>
                                      ) : (
                                        <span className="shrink-0 text-slate-200 group-hover:translate-x-0.5 transition-transform text-xs">›</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── OUTRAS CATEGORIAS ── */}
                      {Object.values(MEGA_MENU).some(links => links.some(l => l.label.toLowerCase().includes(searchMenu.toLowerCase()))) && (
                        <>
                          {!searchMenu && (
                            <div className="flex items-center gap-3 mb-4">
                              <div className="h-px flex-1 bg-slate-100" />
                              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-2">Módulos do Sistema</span>
                              <div className="h-px flex-1 bg-slate-100" />
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start">
                          {Object.entries(MEGA_MENU).map(([catName, links]) => {
                             const filteredLinks = links.filter(l => l.label.toLowerCase().includes(searchMenu.toLowerCase()) || catName.toLowerCase().includes(searchMenu.toLowerCase()));
                             if (filteredLinks.length === 0) return null;
                             return (
                                <div key={catName} className="flex flex-col">
                                   <h3 className="text-xs font-black uppercase tracking-wider text-[#4970AF] mb-3 pb-2 border-b border-slate-100">{catName}</h3>
                                   <ul className="space-y-1">
                                      {filteredLinks.map((link, idx) => (
                                         <li key={idx}>
                                            <button
                                               onClick={() => handleMenuClick(link.href)}
                                               className={`w-full text-left text-[12.5px] px-2 py-1.5 rounded-lg transition-all flex items-center gap-2 group ${link.href !== '#' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50' : 'text-slate-300 cursor-not-allowed'}`}
                                               title={link.href === '#' ? "Em breve" : ""}
                                            >
                                               <span className={`w-1 h-1 rounded-full shrink-0 transition-all ${link.href !== '#' ? 'bg-slate-300 group-hover:bg-[#4970AF] group-hover:scale-125' : 'bg-slate-200'}`} />
                                               {link.label}
                                               {link.href === '#' && <span className="ml-auto text-[9px] text-slate-300 font-bold">EM BREVE</span>}
                                            </button>
                                         </li>
                                      ))}
                                   </ul>
                                </div>
                             );
                          })}
                          </div>
                        </>
                      )}

                   </div>

               </div>
            </div>
         </div>
      )}
    </>
  );
}

export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState(null);

  useEffect(() => {
    let vivo = true;
    lerSessao().then((s) => {
      if (!vivo) return;
      if (!s) { router.replace("/login"); return; }
      setSessao(s);
    });
    return () => { vivo = false; };
  }, [router]);

  async function sair() {
    await encerrarSessao();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] print:block print:bg-white print:min-h-0">
      <div className="print:hidden"><MobileBottomNav /></div>
      <div className="flex-1 flex flex-col min-h-screen w-full overflow-x-hidden print:ml-0 print:overflow-visible print:block print:min-h-0">
        <div className="print:hidden"><TopHeader onSair={sair} /></div>
        <main key={pathname} className="flex-1 pb-16 md:pb-0 animate-page-in print:pb-0 print:m-0">
          {children}
        </main>
      </div>
    </div>
  );
}
