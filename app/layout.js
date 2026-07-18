import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ERPProvider } from "./context/ERPContext";
import RegisterSW from "./components/RegisterSW";
import PullToRefresh from "./components/PullToRefresh";
import InstallPrompt from "./components/InstallPrompt";

// Fonte oficial do app (variável, hospedada pelo próprio Next — sem CDN externo)
const fonteApp = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

// IMPORTANTE: manifest/ícones declarados AQUI (metadata API) e não em <head>
// manual — o <head> manual não entra no HTML inicial quando a rota redireciona
// (ex.: "/" -> /login), e sem o manifest no HTML o Android instala só um
// atalho de navegador em vez do app de verdade.
export const metadata = {
  title: "Hefisto",
  description: "Sistema de Gestão para Food Service",
  applicationName: "Hefisto",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Hefisto",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={fonteApp.variable}>
      <body className={fonteApp.className}>
        <RegisterSW />
        <PullToRefresh />
        <ERPProvider>
          {children}
        </ERPProvider>
        <InstallPrompt />
      </body>
    </html>
  );
}
