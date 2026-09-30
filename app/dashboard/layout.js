"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { lerSessao, encerrarSessao } from "../lib/auth";
import { canAccessRoute, permittedRoutes } from "../lib/permissions-catalog.mjs";
import { HefistoPageContextProvider } from "../context/HefistoPageContext";
import TopNavigation from "../components/layout/TopNavigation";
import { Loader2 } from "lucide-react";
import CommandCenterModal from "../components/navigation/CommandCenterModal";

function ProtecaoPermissao({ sessao, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const permitido = !sessao?.gerenciado || canAccessRoute(sessao, pathname, search);

  useEffect(() => {
    if (!sessao?.gerenciado || permitido) return;
    const fallback = permittedRoutes(sessao)?.[0] || "/login";
    router.replace(fallback);
  }, [permitido, pathname, router, sessao]);

  if (!sessao || !permitido) {
    return <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500"><Loader2 className="animate-spin text-emerald-600 mr-2" />Carregando área segura...</div>;
  }
  return children;
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState(null);
  const sessaoRef = useRef(null);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandCenterOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let vivo = true;
    lerSessao().then((s) => {
      if (!vivo) return;
      if (s) {
        sessaoRef.current = s; setSessao(s);
        return;
      }
      if (!sessaoRef.current) router.replace("/login");
    });
    return () => { vivo = false; };
  }, [pathname, router]);

  async function sair() {
    sessaoRef.current = null;
    try {
      localStorage.removeItem("hefisto_acesso");
      localStorage.removeItem("erp_cred");
      localStorage.setItem("erp_lembrar", "0");
    } catch (_) {}
    await encerrarSessao();
    router.replace("/login");
  }

  const interfaceTelaCheia = pathname === "/dashboard/operacao/estoque/tablet" || pathname === "/dashboard/operacao/etiquetas/tablet" || pathname.startsWith("/dashboard/rh/ponto");

  if (interfaceTelaCheia) {
    return (
      <div className="fixed inset-0 z-[200] overflow-hidden bg-slate-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <Suspense fallback={<div className="grid h-screen place-items-center"><Loader2 className="animate-spin text-emerald-600" /></div>}>
          <ProtecaoPermissao sessao={sessao}>
            {children}
          </ProtecaoPermissao>
        </Suspense>
      </div>
    );
  }

  return (
    <HefistoPageContextProvider activeUnitId="matriz" userSession={sessao}>
      <div className="erp-app-shell flex flex-col h-screen h-[100dvh] min-h-0 bg-[#F7F8F7] overflow-hidden print:bg-card print:block print:h-auto print:min-h-0 font-sans">
        
        <TopNavigation sessao={sessao} onSair={sair} onOpenSearch={() => setCommandCenterOpen(true)} />

        <main className="flex-1 w-full max-w-[1920px] mx-auto overflow-y-auto overflow-x-hidden custom-scrollbar relative print:overflow-visible print:block bg-[#F7F8F7]">
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-500"><Loader2 className="animate-spin text-emerald-600 mr-2" />Carregando módulo...</div>}>
            <ProtecaoPermissao sessao={sessao}>
              {children}
            </ProtecaoPermissao>
          </Suspense>
        </main>

        <CommandCenterModal isOpen={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} sessao={sessao} />
        
      </div>
    </HefistoPageContextProvider>
  );
}