const fs = require('fs');

const code = fs.readFileSync('app/dashboard/layout.js', 'utf8');

// Keep everything up to (but not including) the TakeatSidebar section
const CUT_MARKER = '\n// ═══════════════════════════════════════════════════════════════\r\n// SLIM SIDEBAR (Takeat Style)';
const cutIdx = code.indexOf(CUT_MARKER);
if (cutIdx === -1) {
  console.error('MARKER NOT FOUND');
  process.exit(1);
}

const header = code.substring(0, cutIdx);
console.log('Header ends at char:', cutIdx, '(line ~', header.split('\n').length, ')');
console.log('Last 100 chars of header:', JSON.stringify(header.slice(-100)));

// New navigation code
const newNav = `
// ═══════════════════════════════════════════════════════════════
// SIDEBAR DESKTOP
// ═══════════════════════════════════════════════════════════════
function DesktopSidebar({ onSair, onOpenMegaMenu }) {
  const router = useRouter();
  const pathname = usePathname();

  const ITEMS = [
    { label: 'Início',     icon: Ic.Dashboard, href: '/dashboard' },
    { label: 'Operar',     icon: Ic.ChefHat,   href: '/dashboard/vendas' },
    { label: 'Delivery',   icon: Ic.Truck,      href: '/dashboard/delivery' },
    { label: 'Cardápio',   icon: Ic.MenuBook,   href: '/dashboard/operacao/cardapio' },
    { label: 'Estoque',    icon: Ic.Box,        href: '/dashboard/operacao/estoque' },
    { label: 'Financeiro', icon: Ic.BarChart,   href: '/dashboard/financeiro' },
    { label: 'RH',         icon: Ic.Users,      href: '/dashboard/rh' },
    { label: 'Gestão',     icon: Ic.Settings,   href: '/dashboard/gestao' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[72px] bg-[#1a1a2e] flex-col items-center py-4 z-50">
      <div onClick={() => router.push('/dashboard')} className="w-10 h-10 bg-orange-500 hover:bg-orange-400 transition-all rounded-xl flex items-center justify-center mb-3 text-white font-black text-lg cursor-pointer shadow-lg">H</div>

      <button onClick={onOpenMegaMenu} className="flex flex-col items-center gap-1 w-full px-2 py-2 mb-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span className="text-[8px] font-bold uppercase">Buscar</span>
      </button>

      <div className="flex-1 flex flex-col w-full gap-0.5 px-2 overflow-y-auto" style={{scrollbarWidth:'none'}}>
        {ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={\`flex flex-col items-center gap-1 w-full py-2 rounded-xl transition-all \${active ? 'bg-orange-500 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}\`}>
              <div className="w-4 h-4 flex items-center justify-center"><item.icon /></div>
              <span className="text-[8px] font-bold uppercase leading-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </div>

      <button onClick={onSair} className="flex flex-col items-center gap-1 w-full px-2 py-2 mt-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
        <div className="w-4 h-4"><Ic.LogOut /></div>
        <span className="text-[8px] font-bold uppercase">Sair</span>
      </button>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
// BOTTOM NAV MOBILE
// ═══════════════════════════════════════════════════════════════
function MobileBottomNav({ onOpenMegaMenu }) {
  const router = useRouter();
  const pathname = usePathname();

  const TABS = [
    { label: 'Início',   icon: Ic.Dashboard, href: '/dashboard' },
    { label: 'Operar',   icon: Ic.ChefHat,   href: '/dashboard/vendas' },
    { label: 'Delivery', icon: Ic.Truck,      href: '/dashboard/delivery' },
    { label: 'Cardápio', icon: Ic.MenuBook,   href: '/dashboard/operacao/cardapio' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a2e] border-t border-white/10 flex items-stretch" style={{height:58,paddingBottom:'env(safe-area-inset-bottom)'}}>
      {TABS.map(tab => {
        const active = pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
        return (
          <button key={tab.href} onClick={() => router.push(tab.href)}
            className={\`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors \${active ? 'text-orange-400' : 'text-white/40'}\`}>
            <div className="w-5 h-5 flex items-center justify-center"><tab.icon /></div>
            <span className="text-[9px] font-bold uppercase">{tab.label}</span>
          </button>
        );
      })}
      <button onClick={onOpenMegaMenu} className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/40 hover:text-orange-400 transition-colors">
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span className="text-[9px] font-bold uppercase">Ver tudo</span>
      </button>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOP HEADER
// ═══════════════════════════════════════════════════════════════
function TopHeader({ onSair }) {
  const { unidades, unidadeAtiva, setUnidadeAtiva, podeTrocar, unidadeInfo } = useERP();
  const router = useRouter();

  return (
    <header className="h-[56px] border-b border-[var(--line)] flex items-center justify-between px-4 sticky top-0 z-40 bg-[var(--surface)] shadow-sm">
      <span onClick={() => router.push('/dashboard')} className="font-black text-xl tracking-tighter italic cursor-pointer text-orange-500">Hefisto.</span>
      <div className="flex items-center gap-2">
        <div className="relative group">
          <div className="flex items-center gap-1.5 bg-[var(--panel)] border border-[var(--line)] px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--elevated)] transition-colors">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: unidadeInfo?.cor || '#22C55E' }}></div>
            <span className="text-[12px] font-bold text-[var(--fg)] max-w-[80px] truncate">{unidadeInfo?.nome || '...'}</span>
          </div>
          {podeTrocar && (
            <div className="absolute top-full right-0 pt-2 w-52 hidden group-hover:block z-50">
              <div className="bg-[var(--surface)] shadow-xl border border-[var(--line)] rounded-xl py-2">
                <div className="px-4 py-2 text-[10px] uppercase font-bold text-[var(--subtle)] border-b border-[var(--line)] mb-1">Visão Geral</div>
                <div onClick={() => setUnidadeAtiva('todas')} className="px-4 py-2.5 hover:bg-[var(--elevated)] text-sm font-semibold text-[var(--fg-soft)] flex items-center gap-3 cursor-pointer">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div> Central
                </div>
                <div className="px-4 py-2 text-[10px] uppercase font-bold text-[var(--subtle)] border-b border-[var(--line)] mb-1 mt-1">Lojas</div>
                {unidades.map(u => (
                  <div key={u.id} onClick={() => setUnidadeAtiva(u.id)} className="px-4 py-2.5 hover:bg-[var(--elevated)] text-sm font-semibold text-[var(--fg-soft)] flex items-center gap-3 cursor-pointer">
                    <div className="w-2 h-2 rounded-full" style={{ background: u.cor }}></div> {u.nome}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button onClick={onSair} className="md:hidden p-2 text-[var(--subtle)] hover:text-red-500 rounded-lg transition-colors">
          <Ic.LogOut />
        </button>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState(null);
  const { setUnidadeAtiva, unidadeAtiva } = useERP();
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerSessao().then((s) => {
      if (!vivo) return;
      if (!s) { router.replace("/login"); return; }
      setSessao(s);
    });
    return () => { vivo = false; };
  }, [router]);

  useEffect(() => {
    if (!sessao) return;
    const atual = getNavId(pathname || "");
    if (!podeAcessar(sessao.papel, atual)) router.replace(homeDoPapel(sessao.papel));
  }, [sessao, pathname, router]);

  async function sair() {
    await encerrarSessao();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-[var(--surface)]">
      <DesktopSidebar onSair={sair} onOpenMegaMenu={() => setMegaMenuOpen(true)} />
      <MegaMenu isOpen={megaMenuOpen} onClose={() => setMegaMenuOpen(false)} sessao={sessao} router={router} unidadeAtiva={unidadeAtiva} />
      <MobileBottomNav onOpenMegaMenu={() => setMegaMenuOpen(true)} />
      <div className="flex-1 flex flex-col min-h-screen md:ml-[72px] w-full overflow-x-hidden">
        <TopHeader onSair={sair} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-[68px] md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
`;

const result = header + newNav;
fs.writeFileSync('app/dashboard/layout.js', result, 'utf8');
console.log('SUCCESS! New file has', result.split('\n').length, 'lines');
