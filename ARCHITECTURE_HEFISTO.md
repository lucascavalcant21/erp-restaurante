# ARQUITETURA TÉCNICA E ISOLAMENTO MULTI-TENANT
## ERP HÉFISTO — FONTE ÚNICA DA VERDADE EM SISTEMAS GASTRONÔMICOS

**Versão:** 1.0.0  
**Data:** 22 de Setembro de 2026  

---

### 1. VISÃO GERAL DA ARQUITETURA

O ERP Héfisto é construído sobre uma arquitetura moderna Serverless/Jamstack de alta performance, desacoplada em três camadas principais:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO (FRONTEND)             │
│ Next.js 15 (App Router) + React + Tailwind CSS + Lucide Icons   │
│ Deploy na Vercel (Edge Network CDN & Static Optimization)       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼ API HTTPS / WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                   CAMADA DE NEGÓCIO E DOMÍNIO                    │
│ Engine JS de Sinais Operacionais (sinais-domain.js)             │
│ Engine de Financeiro & DRE (financeiro-domain.js)               │
│ Engine de Compras & Recebimento (compras-domain.js)             │
│ Engine de Vendas & Conciliação (vendas-domain.js)               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼ RPCs ATÔMICAS & RLS
┌─────────────────────────────────────────────────────────────────┐
│                 CAMADA DE BANCO DE DADOS & SEGURANÇA             │
│ Supabase PostgreSQL + Row Level Security (RLS)                  │
│ PostgreSQL Functions (SECURITY DEFINER + search_path travado)   │
│ Supabase Storage (Bucket Privado para Comprovantes & Notas)     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. MODELO DE TENANCY E ISOLAMENTO MULTI-TENANT

O isolamento entre diferentes restaurantes (tenants) segue o modelo **Logical Multi-Tenancy com RLS Nativo no Banco**:

1. **Hierarquia de Entidades:**
   - **Empresa (`empresas`):** Entidade jurídica (SaaS Client).
   - **Unidade (`unidades`):** Estabelecimento físico/filial do restaurante (ex: Matriz, Filial 1, Cozinha Central).
   - **Usuário (`usuarios_erp`):** Pertence a uma empresa e possui permissões por unidade.

2. **Políticas de RLS (Row Level Security):**
   - Todas as tabelas operacionais (`estoque_atual`, `contas_pagar`, `contas_receber`, `vendas`, `fichas_tecnicas`, `compras_pedidos`) contêm obrigatoriamente a coluna `unidade_id`.
   - A função PostgreSQL `hefisto_unidades_do_usuario(auth.uid())` resolve dinamicamente em tempo de execução SQL quais unidades o usuário autenticado pode acessar.

3. **RPCs e Security Definer:**
   - Todas as RPCs utilizam obrigatoriamente `SET search_path = public, pg_temp` para impedir sequestro de schema.
   - Nenhuma autorização depende de parâmetros booleanos do frontend. A autorização é resolvida via `auth.uid()` no servidor SQL.

---

### 3. CADEIA INTEGRADA DE DADOS (FLUXO COMPLETO DO RESTAURANTE)

```
COMPRA → RECEBIMENTO → CONTA A PAGAR → PAGAMENTO → CONTA FINANCEIRA → FLUXO DE CAIXA
  │           │
  ▼           ▼
ESTOQUE → FICHAS TÉCNICAS → PRODUÇÃO → CUSTOS → CMV / MARGEM
  │
  ▼
VENDA → CANAL / OPERADORA → RECEBÍVEL → CONCILIACAO → DRE ECONÔMICO
```
