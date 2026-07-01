import "./globals.css";
import { ERPProvider } from "./context/ERPContext";
import RegisterSW from "./components/RegisterSW";
import ThemeToggle from "./components/ThemeToggle";

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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('erp-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}",
          }}
        />
      </head>
      <body>
        <RegisterSW />
        <ThemeToggle />
        <ERPProvider>
          {children}
        </ERPProvider>
      </body>
    </html>
  );
}
