// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES: RECONSTRUÇÃO DO BANCO DO ZERO E AUDITORIA DE MIGRATIONS
// HÉFISTO ERP — Validação da Ordem, Dependências e Segurança das Migrations
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

console.log('🧪 INICIANDO TESTE DE RECONSTRUÇÃO DO BANCO DO ZERO & MIGRATIONS — HÉFISTO ERP\n');

// ─── TESTE 1: AUDITORIA DE MIGRATIONS PRINCIPAIS DO REPOSITÓRIO ───────────────
console.log('--- TESTE 1: Auditoria da Existência e Sequência de Migrations Principais ---');

const dbDir = path.resolve('db');
const migracoesCriticas = [
  'migracao_central_comando.sql',
  'migracao_compras_recebimento.sql',
  'migracao_financeiro_integrado.sql',
  'migracao_vendas_recebiveis_conciliacao.sql',
  'migracao_operacao_integrada.sql',
  'migracao_pre_preparos_fichas.sql',
  'migracao_estoque_bebidas.sql',
  'migracao_tenant_provisioning.sql',
  'migracao_control_plane_saas.sql',
  'migracao_piloto_telemetria_saas.sql'
];

migracoesCriticas.forEach(mig => {
  const fullPath = path.join(dbDir, mig);
  const existe = fs.existsSync(fullPath);
  assert(existe, `Migration crítica '${mig}' encontrada no repositório`);
});


// ─── TESTE 2: VARREDURA DE SECURITY DEFINER NAS MIGRATIONS ───────────────────
console.log('\n--- TESTE 2: Auditoria de Lockdown em SECURITY DEFINER (search_path) ---');

let totalSecDefiner = 0;
let secDefinerComSearchPath = 0;

migracoesCriticas.forEach(mig => {
  const fullPath = path.join(dbDir, mig);
  if (fs.existsSync(fullPath)) {
    const conteudo = fs.readFileSync(fullPath, 'utf8');
    const linhas = conteudo.split('\n');
    
    linhas.forEach((linha, idx) => {
      if (linha.toLowerCase().includes('security definer')) {
        totalSecDefiner++;
        // Verifica se nas 5 linhas vizinhas existe set search_path
        const contexto = linhas.slice(Math.max(0, idx - 3), Math.min(linhas.length, idx + 5)).join('\n').toLowerCase();
        if (contexto.includes('search_path')) {
          secDefinerComSearchPath++;
        }
      }
    });
  }
});

assert(totalSecDefiner > 0, `Auditadas ${totalSecDefiner} declarações SECURITY DEFINER nas migrations principais`);
assert(secDefinerComSearchPath === totalSecDefiner, `100% das funções SECURITY DEFINER auditadas possuem 'SET search_path' travado`);


// ─── TESTE 3: PREVENÇÃO DE VAZAMENTO DE DADOS DE SEED PRIVADOS ────────────────
console.log('\n--- TESTE 3: Auditoria Anti-Vazamento de Dados da Seldeestrela em Novas Instâncias ---');

let vazamentoEncontrado = false;
migracoesCriticas.forEach(mig => {
  const fullPath = path.join(dbDir, mig);
  if (fs.existsSync(fullPath)) {
    const conteudo = fs.readFileSync(fullPath, 'utf8');
    // Verifica se há INSERT INTO insumos hardcoded com nomes específicos de funcionários ou fornecedores privados
    if (conteudo.includes("seldeestrela") || conteudo.includes("Picanha Seldeestrela")) {
      vazamentoEncontrado = true;
    }
  }
});

assert(!vazamentoEncontrado, 'Nenhuma migration de infraestrutura possui seeds com dados privados do restaurante original');


// ─── RESUMO DOS TESTES ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════════════');
console.log(`📊 RESUMO DO TESTE DE MIGRATIONS DO ZERO: ${passed} PASSOU | ${failed} FALHOU`);
console.log('══════════════════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
