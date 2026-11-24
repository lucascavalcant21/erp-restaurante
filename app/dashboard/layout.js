"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { lerSessao, sairDoSistema } from "../lib/auth";
import { canAccessRoute, permittedRoutes } from "../lib/permissions-catalog.mjs";
import { universoLiberado } from "../lib/menu-principal.mjs";
import { HefistoPageContextProvider } from "../context/HefistoPageContext";
import TopNavigation from "../components/layout/TopNavigation";
import { Loader2 } from "lucide-react";
import BarraUniverso from "../components/navigation/BarraUniverso";
import BarraInferior from "../components/layout/BarraInferior";
import { mostraBarraInferior } from "../lib/barra-inferior.mjs";
import CommandCenterModal from "../components/navigation/CommandCenterModal";
import PainelHefisto from "../components/intelligence/PainelHefisto";
import { addRecentRoute } from "../lib/user-preferences.js";
import { useMinhaAssinatura } from "../lib/assinatura";
import { linkCheckout, rotaLiberada } from "../lib/planos.mjs";

function ProtecaoPermissao({ sessao, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const deveVerificar = !!sessao?.gerenciado || !!sessao?.is_app;
  const permitido = !deveVerificar || canAccessRoute(sessao, pathname, search)
    || universoLiberado(pathname, (rota, busca) => canAccessRoute(sessao, rota, busca));

  useEffect(() => {
    if (!deveVerificar || permitido) return;
    const fallback = sessao?.pagina_inicial || permittedRoutes(sessao)?.[0] || "/dashboard";
    router.replace(fallback);
  }, [deveVerificar, permitido, pathname, router, sessao]);

  // Plano Grátis (14/11/2026): tela do plano Completo leva ao checkout.
  // Sem assinatura registrada nada é trancado (app/lib/planos.mjs).
  const assinatura = useMinhaAssinatura(sessao);
  const areaTrancada = !!(permitido && assinatura && !rotaLiberada(assinatura.plano, pathname));
  useEffect(() => {
    if (areaTrancada) router.replace(linkCheckout(`${pathname}${search ? `?${search}` : ""}`));
  }, [areaTrancada, pathname, search, router]);

  // Recentes e frequência da Central de Comando: só tela aberta com permissão,
  // uma vez por rota (a sessão é relida a cada navegação e não pode contar 2x).
  const ultimaRota = useRef("");
  useEffect(() => {
    const chave = `${pathname}?${search}`;
    if (!sessao || !permitido || ultimaRota.current === chave) return;
    ultimaRota.current = chave;
    addRecentRoute(sessao, pathname, search);
  }, [sessao, permitido, pathname, search]);

  if (!sessao || !permitido || areaTrancada) {
    return <div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-900"><Loader2 className="animate-spin text-emerald-600 mr-2" />Carregando área segura...</div>;
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
    await sairDoSistema();
    router.replace("/login");
  }

  const interfaceTelaCheia = pathname === "/dashboard/operacao/etiquetas/tablet" || pathname === "/dashboard/rh/ponto";

  if (interfaceTelaCheia) {
    return (
      <div className="fixed inset-0 z-[200] overflow-hidden overscroll-none bg-hf-bg">
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
      <div className="erp-app-shell fixed inset-0 flex flex-col w-full h-[100dvh] min-h-0 bg-hf-bg overflow-hidden overscroll-none print:static print:bg-card print:block print:h-auto print:min-h-0 font-sans">
        
        <TopNavigation sessao={sessao} onSair={sair} onOpenSearch={() => setCommandCenterOpen(true)} />
        <Suspense fallback={null}><BarraUniverso /></Suspense>

        <main className="erp-main-scroll flex-1 w-full max-w-[1920px] mx-auto overflow-y-auto overflow-x-hidden overscroll-none custom-scrollbar relative print:overflow-visible print:block bg-hf-bg">
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center px-4 text-sm font-bold text-slate-900"><Loader2 className="animate-spin text-emerald-600 mr-2" />Carregando módulo...</div>}>
            <ProtecaoPermissao sessao={sessao}>
              {children}
            </ProtecaoPermissao>
          </Suspense>
        </main>

        {/* Abas fixas do rodapé no celular e tablet (visual Medway, 14/11/2026) */}
        {mostraBarraInferior(pathname, sessao) && (
          <BarraInferior sessao={sessao} onOpenSearch={() => setCommandCenterOpen(true)} />
        )}

        <CommandCenterModal isOpen={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} sessao={sessao} />

        {/* Pergunte ao Héfisto: botão discreto → painel lateral / bottom sheet */}
        {sessao && (
          <Suspense fallback={null}>
            <PainelHefisto />
          </Suspense>
        )}
        
      </div>
    </HefistoPageContextProvider>
  );
}