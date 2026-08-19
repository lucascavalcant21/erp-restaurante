// O relógio de ponto tem manifesto próprio para poder ser INSTALADO como um
// app separado no tablet, com ícone e nome dele, abrindo direto no relógio.
// Sem isto, instalar o Hefisto no tablet dá um app que abre no dashboard — e
// aí o tablet do ponto vira um atalho para o ERP inteiro, que é o oposto de
// um quiosque.
export const metadata = {
  title: "Ponto — Hefisto",
  manifest: "/manifest-ponto.json",
};

// Escurece a barra de status do Android e evita o zoom por dois dedos, que na
// parede vira tela torta que ninguém sabe desfazer.
export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function LayoutPonto({ children }) {
  return children;
}
