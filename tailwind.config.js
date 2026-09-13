/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
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

        // ── Tokens semânticos ─────────────────────────────────────────
        // NÃO tem valor aqui de propósito. A cor mora em UM lugar só:
        // `:root` no app/globals.css, que é também quem define o tema escuro
        // em `.dark`. Antes estes nomes carregavam hex próprio e discordavam
        // do globals.css — `accent` era #10B981 aqui e #047857 lá, dois verdes
        // de marca diferentes, e o tema escuro não alcançava nenhum deles.
        //
        // Uso: bg-surface, bg-card, border-line, text-fg, text-muted...
        // Modificador de opacidade (bg-card/50) NÃO funciona em cima de var();
        // quando precisar de transparência, use os tokens *-soft.
        surface:  "var(--surface)",
        panel:    "var(--panel)",
        card:     "var(--card)",
        elevated: "var(--elevated)",
        line:     "var(--line)",
        "line-soft": "var(--line-soft)",

        fg:        "var(--fg)",
        "fg-soft": "var(--fg-soft)",
        muted:     "var(--muted)",
        subtle:    "var(--subtle)",
        dim:       "var(--dim)",
        faint:     "var(--faint)",

        accent:          "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-fg":     "var(--accent-fg)",
        "accent-soft":   "var(--accent-soft)",
        success:         "var(--success)",
        "success-strong":"var(--success-strong)",
        "success-soft":  "var(--success-soft)",
        danger:          "var(--danger)",
        "danger-strong": "var(--danger-strong)",
        "danger-soft":   "var(--danger-soft)",
        warning:         "var(--warning)",
        "warning-strong":"var(--warning-strong)",
        "warning-soft":  "var(--warning-soft)",
        info:            "var(--info)",
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
