import "./globals.css";
import { Inter } from "next/font/google";
import { ERPProvider } from "./context/ERPContext";
import RegisterSW from "./components/RegisterSW";
import AvisoNovaVersao from "./components/AvisoNovaVersao";
import PullToRefresh from "./components/PullToRefresh";
import InstallPrompt from "./components/InstallPrompt";

// Fonte oficial do app (variável, hospedada pelo próprio Next — sem CDN externo).
// Inter desde 07/11/2026 (pedido do dono: visual do Nina); antes Plus Jakarta Sans.
const fonteApp = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

// IMPORTANTE: manifest/ícones declarados AQUI (metadata API) e não em <head>
// manual — o <head> manual não entra no HTML inicial quando a rota redireciona
// (ex.: "/" -> /login), e sem o manifest no HTML o Android instala só um
// atalho de navegador em vez do app de verdade.
// Sistema novo do restaurante (branch hefisto-teste, HEFISTO_ENV=staging): o
// app instalado na tela de início se chama "Héfisto Novo" e é outro app,
// separado do app antigo (app.hefisto.com.br). Dono, 17/11/2026: "não é mais
// teste, é o próprio sistema do restaurante; o sistema de teste eu chamo outro".
// O ambiente técnico continua "staging" (a trava que impede usar o banco antigo
// segue valendo). No app antigo nada muda.
const EH_NOVO = (process.env.HEFISTO_ENV || "").trim().toLowerCase() === "staging";

export const metadata = {
  title: EH_NOVO ? "Héfisto Novo" : "Hefisto",
  description: "Sistema de Gestão para Food Service",
  applicationName: EH_NOVO ? "Héfisto Novo" : "Hefisto",
  manifest: EH_NOVO ? "/manifest-teste.json" : "/manifest.json",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    title: EH_NOVO ? "Héfisto Novo" : "Hefisto",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // App de operação: a tela não dá zoom sozinha ao tocar num campo nem com
  // duplo toque. A leitura vem do tamanho de fonte, não do zoom do navegador.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Teclado aberto encolhe a área visível em vez de empurrar a página. Sem
  // isto, tocar num campo de busca faz a tela inteira pular e o que você
  // estava lendo sai de vista.
  interactiveWidget: "resizes-content",
  themeColor: "#0A0A0A", // barra do navegador no celular = menu preto
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={fonteApp.variable}>
      <body className={fonteApp.className}>
        <RegisterSW />
        <AvisoNovaVersao />
        <PullToRefresh />
        <ERPProvider>
          {children}
        </ERPProvider>
        <InstallPrompt />
      </body>
    </html>
  );
}
