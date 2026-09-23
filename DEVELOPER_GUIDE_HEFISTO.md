# GUIA DO DESENVOLVEDOR & MANUTENÇÃO TÉCNICA
## ERP HÉFISTO — SETUP LOCAL, TESTES E PIPELINE DE MIGRATIONS

**Versão:** 1.0.0  
**Data:** 22 de Setembro de 2026  

---

### 1. REQUISITOS DO AMBIENTE DE DESENVOLVIMENTO
- **Node.js:** v20.x ou v22.x LTS (Recomendado)
- **NPM:** v10.x+
- **PostgreSQL / Supabase CLI:** CLI v1.100+ para simulação local de migrations
- **OS Suportados:** Windows 11, macOS, Linux Ubuntu

---

### 2. CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE (`.env.local`)

Crie o arquivo `.env.local` na raiz do projeto com a estrutura abaixo:

```env
# Supabase Configuration (Variáveis Públicas do Cliente)
NEXT_PUBLIC_SUPABASE_URL=https://<SUA-INSTANCIA>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Configurações de Recursos Globais
NEXT_PUBLIC_FEATURE_NAVIGATION_V2=true

# ATENÇÃO: NUNCA ADICIONE SUPABASE_SERVICE_ROLE_KEY NO FRONTEND (.env.local)
```

---

### 3. EXECUÇÃO DO PROJETO EM AMBIENTE LOCAL

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento local
npm run dev

# Acessar a aplicação em: http://localhost:3000
```

---

### 4. SUÍTE DE TESTES AUTOMATIZADOS

O projeto conta com suítes de teste em formato ES Modules (`scripts/`):

```bash
# Teste de Reconstrução do Banco do Zero e Migrations
node scripts/test_db_from_zero.mjs

# Teste Multi-Tenant & Ataques de Acesso Direto por UUID
node scripts/test_multitenant_saas_hefisto.mjs

# Teste de Jornada E2E Operacional & Financeira Completa
node scripts/test_jornadas_e2e_hefisto.mjs

# Testes Específicos dos Módulos Domínio
node scripts/test_central_comando_hefisto.mjs
node scripts/test_vendas_conciliacao_hefisto.mjs
node scripts/test_financeiro_hefisto.mjs
node scripts/test_compras_hefisto.mjs
```

---

### 5. VALIDAÇÃO DE BUILD ANTES DO DEPLOY

```bash
# Executar build de produção do Next.js
cmd /c npm run build
```
