// Player das TVs (Sinalização digital). Fora do painel: sem menu, sem login.
export const metadata = {
  title: "Héfisto TV",
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: "#000000" };

export default function LayoutTv({ children }) {
  return children;
}
