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
      // Texto/ícone "text-hf-accent" sobre branco usa o dourado ESCURO (contraste 5,9:1);
      // fundo, borda e anel continuam no dourado #C5A15A.
      textColor: { hf: { accent: "rgb(var(--hf-accent-text) / <alpha-value>)" } },
      colors: {
        // ── Design system branco e dourado (pedido do dono, 31/10/2026) ──
        // O "emerald" das telas antigas era a cor de identidade (botões, abas, links):
        // agora é a escala dourada, de uma vez em todo o app. Verde de ESTADO positivo
        // (entrada, pago, saudável) usa hf-success / green-*, que continuam verdes.
        // Tons 600+ aceitam texto branco por cima (600: 4,6:1 · 700: 6,4:1).
        emerald: {
          50: "#FBF8F1", 100: "#F5EEDC", 200: "#EBDCB8", 300: "#DEC58F", 400: "#D1B06F",
          500: "#C5A15A", 600: "#957231", 700: "#7A5C1E", 800: "#5F4716", 900: "#45330F", 950: "#2B200A",
        },
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

        // ── Identidade escura Héfisto (tokens --hf-* no globals.css).
        // Canais RGB: aceitam opacidade (bg-hf-danger/10). Ver o comentário lá.
        hf: {
          "bg":            "rgb(var(--hf-bg) / <alpha-value>)",
          "surface":       "rgb(var(--hf-surface) / <alpha-value>)",
          "elevated":      "rgb(var(--hf-elevated) / <alpha-value>)",
          "border":        "rgb(var(--hf-border) / <alpha-value>)",
          "border-strong": "rgb(var(--hf-border-strong) / <alpha-value>)",
          "text":          "rgb(var(--hf-text) / <alpha-value>)",
          "text-2":        "rgb(var(--hf-text-2) / <alpha-value>)",
          "muted":         "rgb(var(--hf-muted) / <alpha-value>)",
          "accent":        "rgb(var(--hf-accent) / <alpha-value>)",
          "accent-fg":     "rgb(var(--hf-accent-fg) / <alpha-value>)",
          "accent-text":   "rgb(var(--hf-accent-text) / <alpha-value>)",
          "success":       "rgb(var(--hf-success) / <alpha-value>)",
          "warning":       "rgb(var(--hf-warning) / <alpha-value>)",
          "danger":        "rgb(var(--hf-danger) / <alpha-value>)",
          "menu":          "rgb(var(--hf-menu) / <alpha-value>)",
          "menu-hover":    "rgb(var(--hf-menu-hover) / <alpha-value>)",
          "menu-border":   "rgb(var(--hf-menu-border) / <alpha-value>)",
          "menu-text":     "rgb(var(--hf-menu-text) / <alpha-value>)",
          "menu-muted":    "rgb(var(--hf-menu-muted) / <alpha-value>)",
          "menu-accent":   "rgb(var(--hf-menu-accent) / <alpha-value>)",
        },
      },
      borderRadius: {
        xl2: "14px",
      },
      boxShadow: {
        card: "var(--shadow-card)", // mesma profundidade dos cards (globals.css)
        pop:  "0 12px 32px rgba(16,24,40,0.14)",
        // Design System Héfisto (docs/DESIGN_SYSTEM_HEFISTO.md)
        xs:    "var(--shadow-xs)",
        float: "var(--shadow-float)",
      },
      fontFamily: {
        // A fonte do app e Plus Jakarta Sans, carregada pelo next/font no
        // app/layout.js e exposta como --font-app. Aqui dizia "Inter", que nao
        // e carregada em lugar nenhum: as 36 telas que usam `font-sans`
        // caiam na fonte do sistema e destoavam do resto do app.
        sans: ["var(--font-app)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        // Escala dos tamanhos miudos. Antes eram valores avulsos escritos na
        // mao — text-[8px], text-[9px], text-[10px], text-[11px] — 1.490 vezes,
        // sem nada que os prendesse juntos. Com nome, mudar o miudo do sistema
        // inteiro passa a ser mexer aqui.
        //
        // So font-size, sem line-height de proposito: o valor avulso tambem nao
        // definia entrelinha, e defini-la agora mudaria o layout de 1.400
        // lugares de uma vez.
        "3xs": "10px",  // piso: absorve os antigos 8px e 9px, ilegiveis no celular
        "2xs": "11px",
      },
    },
  },
  plugins: [],
};
