# Auditoria e Estratégia de Redesign Global Héfisto

## A. Arquitetura Visual Atual Encontrada
1. **AppShell & Layout:** O ERP utilizava um `layout.js` massivo que renderizava uma sidebar lateral pesada (`Sidebar.js`) e um `TopHeader.js` secundário, comprimindo o conteúdo.
2. **Cores & Tokens:** O sistema utilizava cores Tailwind cruas (`slate-50`, `emerald-600`) espalhadas diretamente nos componentes, sem um Design System semântico unificado em CSS.
3. **Tipografia:** Mistura de pesos de fonte desnecessários e falta de hierarquia rígida para painéis premium.
4. **Héfisto Copiloto:** Estava como um botão flutuante gigante (`fixed bottom-6 right-6`), poluindo a interface.
5. **Navegação:** A Sidebar obrigava o usuário a rolar muito para encontrar módulos, escondendo a real dimensão do produto.

## B. Problemas Encontrados
- Falta de respiro visual (padding/margins inconsistentes).
- Cards com bordas pesadas e sombras aleatórias.
- O background `slate-50` deixava a tela "chapada" junto aos cards brancos.
- Excesso de informações sem agrupamento hierárquico no Dashboard.

## C. Componentes Globais Alterados
1. `app/dashboard/layout.js` (Completamente reescrito)
2. `app/globals.css` (Criação de tokens globais)
3. `app/components/layout/TopNavigation.js` (Novo componente core)
4. `app/components/navigation/HefistoCopilotPanel.js` (Refatorado para evento global invisível)

## D. Novo Design System
Centralizado no `globals.css`:
- **Fundo Global:** `#F7F8F7` (Levemente quente e premium).
- **Header:** `#071521` (Navy / Azul petróleo profundíssimo).
- **Cards:** Branco absoluto com bordas de `#E5E9EE` e sombra super sutil de `rgba(16,32,49,0.04)`.
- **Textos:** Títulos em `#102031`, subtítulos em `#66758A`.
- **Marca:** Verde Esmeralda (`#059669`).
- **Tipografia:** `Inter` garantida como fonte universal (sans-serif), exceto em propostas.
- **Utilitários Padrão:** `.card-premium`, `.input-premium`, `.btn-primary`, `.btn-secondary`.

## E. Estratégia do Menu Superior
A Sidebar foi extirpada. O `layout.js` agora renderiza o `TopNavigation` contendo navegação em duas linhas (quando contextual) e limitando os agrupamentos principais no cabeçalho fixo (Operação, Cardápio, Estoque, Vendas, Eventos, RH, Financeiro).

## F. Estratégia da Busca Universal
O novo input placeholder "O que você quer fazer agora?" está integrado de forma horizontal no TopNav (com atalho `⌘ K`), acionando silenciosamente o Command Palette sem inflar o DOM da página.

## G. Estratégia do Copiloto
O balão flutuante laranja foi removido. O Copiloto agora mora em um ícone quadrado, sutil e premium (com ícone Sparkles e um ponto vermelho discreto de notificação) na barra superior. Clicar nele dispara um evento global (`window.dispatchEvent('open-hefisto-copilot')`).

## H. Páginas Impactadas Imediatamente
Como a mudança ocorreu na raiz (`layout.js` e `globals.css`), **todas as 40+ páginas do sistema** já herdam automaticamente o novo fundo, nova tipografia, nova barra de rolagem customizada e a nova barra superior.

## I. Riscos de Regressão Tratados
- Páginas de tela cheia (KDS, Tablets de Estoque e Ponto) possuíam regras específicas no layout antigo que podiam quebrar se o TopNav fosse forçado. A nova lógica mantém a condicional `interfaceTelaCheia` para garantir que o Ponto/KDS continuem intocados em sua funcionalidade.
- Não houve nenhuma alteração em consultas Supabase ou cálculos no Dashboard.

## J. Ordem de Implementação (Status)
- ✅ **FASE 1 a 6 (AppShell, Tokens, TopNav, Busca, Copiloto):** CONCLUÍDO.
- ✅ **FASE 8 (Dashboard):** CONCLUÍDO.
- ⏳ **FASES 10 a 16 (Ficha Técnica, Estoque, Etiquetas, Ponto):** Em processamento concorrente pelos meus Subagentes Autônomos de Frontend.
