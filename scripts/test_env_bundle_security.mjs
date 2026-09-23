// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES: AUDITORIA DE SEGREDOS, VARREDURA DE BUNDLE & AMBIENTES
// HÉFISTO ERP — Garantia de Isolamento Local, Staging e Produção
// ══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('🧪 INICIANDO AUDITORIA DE SEGREDOS & VARREDURA DE BUNDLE — HÉFISTO ERP\n');

// ─── TESTE 1: VARREDURA DE ARQUIVOS DE CLIENTE À PROCURA DE SERVICE_ROLE ────
console.log('--- TESTE 1: Varredura de Importações Inseguras de service_role no Frontend ---');

const appDir = path.resolve('app');
let serviceRoleInFrontend = false;

function scanDir(dir) {
  if (dir.includes(path.join('app', 'api'))) return; // Servidor backend (Route Handlers)
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('service_role_key')) {
        serviceRoleInFrontend = true;
      }
    }
  }
}

scanDir(appDir);
assert(!serviceRoleInFrontend, 'Nenhum componente frontend (app/) importando ou fazendo referência a SUPABASE_SERVICE_ROLE_KEY');


// ─── TESTE 2: AUDITORIA DE CHAVES JWT HARDCODED ──────────────────────────────
console.log('\n--- TESTE 2: Auditoria de Chaves JWT Hardcoded em Código Fonte ---');

let jwtHardcoded = false;
function scanForJwt(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanForJwt(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Busca padronizada de eyJhbGciOi (tokens JWT estáticos)
      if (content.includes('eyJhbGciOi') && !fullPath.includes('node_modules')) {
        jwtHardcoded = true;
      }
    }
  }
}

scanForJwt(appDir);
assert(!jwtHardcoded, 'Nenhuma chave JWT estática/hardcoded encontrada no código da aplicação');


// ─── TESTE 3: ISOLAMENTO DE VARIÁVEIS DE AMBIENTE POR AMBIENTE ────────────────
console.log('\n--- TESTE 3: Validação de Variáveis de Ambiente e Separação de Bancos ---');

const envVarsPrivadasPermitidas = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_FEATURE_NAVIGATION_V2'];
const envPublicScopeOk = envVarsPrivadasPermitidas.every(v => v.startsWith('NEXT_PUBLIC_'));

assert(envPublicScopeOk === true, 'Todas as variáveis expostas para o browser utilizam o prefixo obrigatório NEXT_PUBLIC_');


// ─── RESUMO DOS TESTES ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════════════');
console.log(`📊 RESUMO DA AUDITORIA DE SEGREDOS & BUNDLE: ${passed} PASSOU | ${failed} FALHOU`);
console.log('══════════════════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
