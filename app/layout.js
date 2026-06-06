import "./globals.css";
import { ERPProvider } from "./context/ERPContext";

export const metadata = {
  title: "Cerebro ERP",
  description: "Sistema de Gestão para Food Service",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <ERPProvider>
          {children}
        </ERPProvider>
      </body>
    </html>
  );
}
