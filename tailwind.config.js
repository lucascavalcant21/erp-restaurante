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

        // ── Design tokens semânticos (tema claro — estilo Ascend) ─────
        // Trocar o tema inteiro = mexer só nestes valores (+ globals.css :root).
        // Uso: bg-surface, bg-panel, bg-card, border-line, text-fg, etc.
        surface:  "#F7F8FA", // fundo do app
        panel:    "#F1F5F9", // painéis / seções
        card:     "#FFFFFF", // cartões
        elevated: "#F1F5F9", // elementos elevados / hover
        line:     "#E5E7EB", // bordas
        "line-soft": "#F1F5F9",

        // Texto (hierarquia)
        fg:        "#0F172A", // texto principal
        "fg-soft": "#334155", // texto principal suave
        muted:     "#64748B", // texto secundário
        subtle:    "#94A3B8", // texto auxiliar / labels
        dim:       "#94A3B8", // texto terciário / ícones
        faint:     "#CBD5E1", // divisores

        // Acento (verde da marca) + estados (legíveis em fundo claro)
        accent:        "#10B981",
        "accent-strong": "#059669",
        "accent-fg":   "#059669",
        danger:        "#EF4444",
        "danger-soft": "rgba(239,68,68,0.10)",
        warning:       "#F59E0B",
        "warning-soft":"rgba(245,158,11,0.13)",
        info:          "#3B82F6",
      },
      borderRadius: {
        xl2: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.07)",
        pop:  "0 12px 32px rgba(16,24,40,0.14)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
