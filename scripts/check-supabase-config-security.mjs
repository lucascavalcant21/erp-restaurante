import fs from 'fs';
import path from 'path';
import assert from 'assert';

/**
 * Scanner de Segurança de Configuração Supabase & Segredos — ERP HÉFISTO
 * Verifica hardcodes de produção, fallbacks inseguros e vazamentos de service_role.
 */

const rootDir = process.cwd();
const targetDirs = ['app', 'scripts'];
const allowedConfigFiles = [
  path.join(rootDir, 'app', 'lib', 'config', 'supabase-public.mjs'),
  path.join(rootDir, 'app', 'lib', 'config', 'supabase-server.mjs'),
  path.join(rootDir, '.env.example'),
];

let violations = [];

function maskSecret(text) {
  if (!text) return '';
  if (text.length <= 8) return '****';
  return text.slice(0, 4) + '...[REDACTED]';
}

function scanFile(filePath) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  
  // Ignorar testes de scanner propriamente ditos e docs
  if (relPath.startsWith('scripts/check-supabase-config-security') || relPath.startsWith('scripts/verificar-ambiente-supabase')) {
    return;
  }
  if (relPath.endsWith('.md') || relPath.endsWith('.sql') || relPath.endsWith('.json')) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Proibir URL de produção hardcoded fora de config permitida
  if (content.includes('sezccspqxgklicfndwxx.supabase.co')) {
    const isAllowed = allowedConfigFiles.some(allowed => path.relative(rootDir, allowed) === path.relative(rootDir, filePath));
    if (!isAllowed) {
      violations.push(`[HARDCODE PROD URL] URL de produção do Supabase hardcoded em: ${relPath}`);
    }
  }

  // 2. Proibir anon key real hardcoded (ex: sb_publishable_...)
  if (/sb_publishable_[a-zA-Z0-9_-]+/i.test(content)) {
    violations.push(`[HARDCODE ANON KEY] Chave pública real hardcoded encontrada em: ${relPath}`);
  }

  // 3. Proibir fallbacks para URLs do Supabase (ex: || "https://...")
  if (/\|\|\s*["']https?:\/\/[a-z0-9-]+\.supabase\.(co|net)["']/i.test(content)) {
    violations.push(`[FALLBACK PROD URL] Fallback silencioso para URL Supabase em: ${relPath}`);
  }

  // 4. Proibir fallback de service_role para anon_key (ex: service || anon)
  if (/service\s*\|\|\s*anon/i.test(content) || /SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*.*SUPABASE_ANON_KEY/i.test(content)) {
    violations.push(`[FALLBACK SERVICE ROLE TO ANON] Fallback inseguro de service_role para anon key em: ${relPath}`);
  }

  // 5. Proibir import de supabase-server.mjs em Client Components ("use client")
  if (content.includes('"use client"') || content.includes("'use client'")) {
    if (content.includes('supabase-server.mjs') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      violations.push(`[CLIENT BUNDLE LEAK] Módulo ou chave de servidor importada em Client Component em: ${relPath}`);
    }
  }
}

function traverse(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
        traverse(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
      scanFile(fullPath);
    }
  }
}

console.log('🔍 Executando scanner automatizado de configuração e segredos Supabase...');

for (const target of targetDirs) {
  traverse(path.join(rootDir, target));
}

if (violations.length > 0) {
  console.error('❌ VIOLAÇÕES DE SEGURANÇA DE CONFIGURAÇÃO ENCONTRADAS:');
  for (const v of violations) {
    console.error(` - ${v}`);
  }
  process.exit(1);
} else {
  console.log('✅ Nenhum hardcode, fallback inseguro ou vazamento de service_role encontrado.');
}
