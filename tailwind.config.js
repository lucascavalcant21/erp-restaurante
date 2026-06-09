/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Marca (mantida) ───────────────────────────────────────────
        brand: {
          50:  "#edfbf3",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          900: "#0a6c4b",
        },

        // ── Design tokens semânticos (tema dark) ──────────────────────
        // Trocar o tema inteiro = mexer só nestes valores.
        // Uso: bg-surface, bg-panel, bg-card, border-line, text-fg, etc.
        surface:  "#0F172A", // fundo do app (slate-900)
        panel:    "#162032", // painéis / seções
        card:     "#1E293B", // cartões (slate-800)
        elevated: "#334155", // elementos elevados / hover (slate-700)
        line:     "#27324A", // bordas
        "line-soft": "#1E293B",

        // Texto (hierarquia)
        fg:       "#F1F5F9", // texto principal
        muted:    "#94A3B8", // texto secundário
        subtle:   "#64748B", // texto auxiliar / labels
        faint:    "#334155", // texto desabilitado / divisores

        // Acento (verde da marca) + estados
        accent:        "#10B981",
        "accent-strong": "#059669",
        "accent-fg":   "#34D399",
        danger:        "#EF4444",
        "danger-soft": "rgba(239,68,68,0.12)",
        warning:       "#F59E0B",
        "warning-soft":"rgba(245,158,11,0.12)",
        info:          "#3B82F6",
      },
      borderRadius: {
        xl2: "14px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)",
        pop:  "0 8px 24px rgba(0,0,0,0.40)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
