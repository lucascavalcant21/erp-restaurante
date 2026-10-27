# Design System Héfisto — Especificação Oficial (v2.0)

Sistema de design moderno, minimalista e de alta legibilidade operacional criado para o **Héfisto ERP** (Food Service & Gestão Inteligente de Restaurantes). Projetado sob abordagem **Mobile-First (390 px), Tablet Operacional (820 px) e Desktop Executivo (1440 px+)**, com foco em alto contraste (WCAG AA/AAA), zero ruído visual e respostas táteis sutis.

---

## 1. Paleta de Cores Semântica (Hex & RGB)

A identidade visual do Héfisto combina uma superfície clara e acolhedora (`#FEF7DC`) com cartões brancos puros (`#FFFFFF`), tipografia grafite de altíssimo contraste (`#18181B`), navegação superior em preto profundo (`#0A0A0A`) e verde esmeralda institucional (`#047857`). Cores de alerta (âmbar e vermelho) são estritamente reservadas para estados operacionais reais.

### 1.1 Superfícies e Estrutura (`hf-*`)

| Token CSS / Tailwind | Código Hex | Código RGB (Canais) | Contraste / Uso Semântico |
| :--- | :--- | :--- | :--- |
| `--hf-bg` (`bg-hf-bg`) | `#FEF7DC` | `rgb(254, 247, 220)` | Plano de fundo global das páginas (quente, reduz fadiga visual em turnos longos) |
| `--hf-surface` (`bg-hf-surface`) | `#FFFFFF` | `rgb(255, 255, 255)` | Superfície principal de cartões, modais, tabelas e áreas de conteúdo |
| `--hf-elevated` (`bg-hf-elevated`) | `#F4F4F5` | `rgb(244, 244, 245)` | Blocos internos, estados de `hover`, chips neutros e cabeçalhos secundários |
| `--hf-border` (`border-hf-border`) | `#E4E4E7` | `rgb(228, 228, 231)` | Divisórias estruturais, bordas de cartões e contornos de listas |
| `--hf-border-strong` (`border-hf-border-strong`) | `#D4D4D8` | `rgb(212, 212, 216)` | Bordas de campos de formulário em repouso e divisórias destacadas |

### 1.2 Tipografia e Hierarquia de Leitura

| Token CSS / Tailwind | Código Hex | Código RGB (Canais) | Contraste sobre `#FFFFFF` | Papel Visual |
| :--- | :--- | :--- | :--- | :--- |
| `--hf-text` (`text-hf-text`) | `#18181B` | `rgb(24, 24, 27)` | **17.9 : 1** (AAA) | Títulos, valores monetários, KPIs e dados primários |
| `--hf-text-2` (`text-hf-text-2`) | `#52525B` | `rgb(82, 82, 91)` | **7.7 : 1** (AAA) | Subtítulos, descrições, rótulos de apoio e metadados |
| `--hf-muted` (`text-hf-muted`) | `#71717A` | `rgb(113, 113, 122)` | **4.8 : 1** (AA) | Informação terciária, carimbos de horário e placeholders |

### 1.3 Marca e Estados Semânticos (Determinísticos)

| Token CSS / Tailwind | Código Hex | Código RGB (Canais) | Fundo Suave (`10-14%`) | Uso Operacional |
| :--- | :--- | :--- | :--- | :--- |
| `--hf-accent` (`bg-hf-accent`) | `#047857` | `rgb(4, 120, 87)` | `rgba(4, 120, 87, 0.14)` | Ação primária, seleção ativa, confirmação, saldo saudável |
| `--accent-strong` | `#036249` | `rgb(3, 98, 73)` | — | Estado `:hover` / `:active` de botões primários |
| `--hf-success` (`text-hf-success`) | `#047857` | `rgb(4, 120, 87)` | `rgba(5, 150, 105, 0.12)` | Meta atingida, conciliação OK, estoque acima do mínimo |
| `--hf-warning` (`text-hf-warning`) | `#B45309` | `rgb(180, 83, 9)` | `rgba(245, 158, 11, 0.13)` | Atenção, conta vencendo hoje, dados parciais, insumo próximo ao vencimento |
| `--hf-danger` (`text-hf-danger`) | `#B91C1C` | `rgb(185, 28, 28)` | `rgba(239, 68, 68, 0.10)` | Crítico, conta vencida, lote vencido, divergência grave, ação destrutiva |

### 1.4 Navegação Global (`TopNavigation`)

| Token CSS / Tailwind | Código Hex | Código RGB (Canais) | Uso |
| :--- | :--- | :--- | :--- |
| `--hf-menu` (`bg-hf-menu`) | `#0A0A0A` | `rgb(10, 10, 10)` | Barra superior fixa e gaveta de navegação mobile |
| `--hf-menu-hover` (`bg-hf-menu-hover`) | `#27272A` | `rgb(39, 39, 42)` | Item de menu em foco/hover e campo de busca (`⌘K`) |
| `--hf-menu-text` (`text-hf-menu-text`) | `#FAFAFA` | `rgb(250, 250, 250)` | Rótulos principais no cabeçalho (contraste 19:1) |
| `--hf-menu-muted` (`text-hf-menu-muted`) | `#A1A1AA` | `rgb(161, 161, 170)` | Rótulos inativos no cabeçalho (contraste 8:1) |
| `--hf-menu-accent` (`border-hf-menu-accent`) | `#FACC15` | `rgb(250, 204, 21)` | Indicador de aba ativa e destaque no menu escuro |

---

## 2. Tipografia e Hierarquia

- **Família Tipográfica Oficial:** `Plus Jakarta Sans` (`var(--font-app)`), carregada localmente via `next/font/google` com `display: swap` e fallback nativo (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`).
- **Números Tabulares:** Valores financeiros (`R$`), contagens de estoque, horários e percentuais utilizam obrigatoriamente `tabular-nums` (`font-variant-numeric: tabular-nums`) para alinhamento vertical perfeito em listas e cartões.
- **Prevenção de Zoom Acidental no iOS/Android:** Em telas sensíveis ao toque (`@media (max-width: 1279px)`), todo `<input>`, `<select>` e `<textarea>` respeita `font-size: max(16px, 1rem)`.

### Escala Tipográfica

| Nível | Classe / Tamanho | Peso (`font-weight`) | Altura de Linha / Tracking | Aplicação |
| :--- | :--- | :--- | :--- | :--- |
| **Display / Hero** | `text-3xl sm:text-4xl` (`30px–36px`) | `900` (`font-black`) | `1.1` / `-0.025em` | Nome da Unidade no Painel Inicial |
| **Page Title (H1)** | `text-2xl sm:text-3xl` (`24px–30px`) | `900` (`font-black`) | `1.15` / `-0.02em` | Títulos de Módulos (ex.: Central de Inteligência) |
| **KPI Value** | `text-[22px] sm:text-[28px]` | `900` (`font-black`) | `1.0` / `-0.03em` | Indicadores numéricos principais e saldos |
| **Section Title (H2)** | `text-base sm:text-lg` (`16px–18px`) | `800–900` (`font-extrabold`) | `1.25` / `-0.01em` | Cabeçalhos de painéis e modais |
| **Overline / Section Label** | `text-[11px]–text-[13px]` | `800–900` (`font-black`) | `1.2` / `0.14em` (`uppercase`) | Rótulos de seção, selos de criticidade e categorias |
| **Body Primary** | `text-sm sm:text-[15px]` (`14px–15px`) | `500–600` (`font-medium`) | `1.5` / `normal` | Textos de insights, conversas do Héfisto e formulários |
| **Caption / Meta** | `text-xs` (`12px`) / `text-2xs` (`11px`) | `600–700` (`font-semibold`) | `1.35` / `0.01em` | Fontes de auditoria, carimbos de tempo e notas de rodapé |

---

## 3. Espaçamento, Grid e Ergonomia Mobile-First

O sistema utiliza uma grade base de **4 px** (`0.25rem`) com tokens semânticos (`--space-1` a `--space-12`):

- **Containers de Página:**
  - Painel Executivo: `max-w-7xl mx-auto px-4 py-5 sm:px-6 sm:py-8 lg:px-8`
  - Central de Inteligência (Leitura + Copiloto Lateral): `max-w-6xl mx-auto px-4 pt-5 pb-24 sm:px-6 lg:pt-8` com grid assimétrico `lg:grid-cols-[minmax(0,1fr),420px]` e `gap-8`.
- **Padding Interno de Cartões:**
  - Cartão Compacto / Métrica: `p-3.5 sm:p-4` (`14px–16px`)
  - Cartão de Indicador / Insight: `p-4 sm:p-5` (`16px–20px`)
  - Painel de Seção / Modal: `p-5 sm:p-6` (`20px–24px`)
- **Alvos de Toque (Touch Targets):**
  - Todo botão interativo, filtro ou ação possui altura mínima de **44 px a 48 px** (`min-h-[44px]` / `h-12`), garantindo operação sem erro em celulares (390 px) e tablets de cozinha/bar (820 px).
- **Safe Area Nativa (`--erp-safe-top`):**
  - Recuo automático para notch/ilha dinâmica e barra de status em PWA/mobile.

---

## 4. Elevação, Sombras Suaves e Cantos Arredondados

### 4.1 Raios de Borda (`border-radius`)
- `--radius-xs` (`8px` / `rounded-lg`): Selos internos, teclas de atalho (`kbd`).
- `--radius-sm` (`12px` / `rounded-xl`): Botões, inputs secundários, itens de lista clicáveis.
- `--radius-md` (`16px` / `rounded-2xl`): Cartões de KPI, insights, métricas e caixas de diálogo.
- `--radius-lg` (`24px` / `rounded-3xl`): Painéis estruturais, cabeçalhos de destaque e bottom-sheets.

### 4.2 Sombras em Camadas (`box-shadow`)
As sombras utilizam matiz quente translúcido (`rgba(50, 40, 0, ...)`) para harmonizar com o fundo `#FEF7DC` sem acinzentar a interface:
- **Repouso (`--shadow-card`):** `0 2px 4px rgba(50, 40, 0, 0.08), 0 10px 20px -6px rgba(50, 40, 0, 0.16), 0 24px 42px -16px rgba(50, 40, 0, 0.28)`
- **Interação / Hover (`--shadow-hover`):** `0 4px 8px rgba(50, 40, 0, 0.10), 0 18px 32px -8px rgba(50, 40, 0, 0.22), 0 36px 56px -20px rgba(50, 40, 0, 0.36)` com elevação `translateY(-2px)` em curva `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Flutuante / Modal (`--shadow-float`):** `0 24px 48px -12px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.06)`
