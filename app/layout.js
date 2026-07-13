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

export const metadata = {
  title: "Hefisto",
  description: "Sistema de Gestão para Food Service",
  applicationName: "Hefisto",
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={fonteApp.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
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
