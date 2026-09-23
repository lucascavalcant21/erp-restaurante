import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getHefistoEnv, 
  validateEnvironmentAndUrl, 
  extractProjectRef,
  getSupabasePublicConfig 
} from '../app/lib/config/supabase-public.mjs';
import { getSupabaseServerConfig } from '../app/lib/config/supabase-server.mjs';
import { getPapel, UNPRIVILEGED_PAPEL } from '../app/lib/auth.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

test.afterEach(() => {
  resetEnv();
});

test('A. Ambientes sem variáveis Supabase públicas obrigatórias devem lançar erro explícito', () => {
  process.env.HEFISTO_ENV = 'production';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  assert.throws(() => {
    getSupabasePublicConfig();
  }, /MISSING_PUBLIC_SUPABASE_CONFIG/);
});

test('B. HEFISTO_ENV=staging apontando para a URL de produção deve ABORTAR com erro', () => {
  process.env.HEFISTO_ENV = 'staging';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sezccspqxgklicfndwxx.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';
  process.env.HEFISTO_PRODUCTION_SUPABASE_REF = 'sezccspqxgklicfndwxx';

  assert.throws(() => {
    getSupabasePublicConfig();
  }, /STAGING_MUST_NOT_USE_PRODUCTION_SUPABASE/);
});

test('C. HEFISTO_ENV=staging apontando para URL de staging válida deve passar com sucesso', () => {
  process.env.HEFISTO_ENV = 'staging';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://hefisto-staging-project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';
  process.env.HEFISTO_PRODUCTION_SUPABASE_REF = 'sezccspqxgklicfndwxx';

  const config = getSupabasePublicConfig();
  assert.equal(config.env, 'staging');
  assert.equal(config.projectRef, 'hefisto-staging-project');
});

test('D. HEFISTO_ENV=production apontando para URL de produção válida deve passar com sucesso', () => {
  process.env.HEFISTO_ENV = 'production';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sezccspqxgklicfndwxx.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';
  process.env.HEFISTO_PRODUCTION_SUPABASE_REF = 'sezccspqxgklicfndwxx';

  const config = getSupabasePublicConfig();
  assert.equal(config.env, 'production');
  assert.equal(config.projectRef, 'sezccspqxgklicfndwxx');
});

test('E. Ausência de SUPABASE_SERVICE_ROLE_KEY no servidor deve falhar explicitamente e nunca usar anon key', () => {
  process.env.HEFISTO_ENV = 'production';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sezccspqxgklicfndwxx.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  assert.throws(() => {
    getSupabaseServerConfig();
  }, /MISSING_SUPABASE_SERVICE_ROLE_KEY/);
});

test('F. Extração de Project Ref deve identificar corretamente o subdomínio Supabase', () => {
  assert.equal(extractProjectRef('https://abcxyz123.supabase.co'), 'abcxyz123');
  assert.equal(extractProjectRef('https://my-staging-ref.supabase.co'), 'my-staging-ref');
});

test('I. HEFISTO_ENV com valor inválido deve lançar erro explícito', () => {
  process.env.HEFISTO_ENV = 'invalid_environment';
  assert.throws(() => {
    getHefistoEnv();
  }, /INVALID_HEFISTO_ENV/);
});

test('K & L. Validação fail-closed dos papéis na UI (app/lib/auth.js)', () => {
  assert.equal(getPapel(null).id, UNPRIVILEGED_PAPEL.id);
  assert.equal(getPapel(undefined).id, UNPRIVILEGED_PAPEL.id);
  assert.equal(getPapel('').id, UNPRIVILEGED_PAPEL.id);
  assert.equal(getPapel('desconhecido').id, UNPRIVILEGED_PAPEL.id);
  assert.equal(getPapel('hacker').id, UNPRIVILEGED_PAPEL.id);
  assert.equal(getPapel(' ADMIN ').id, UNPRIVILEGED_PAPEL.id);
  assert.equal(getPapel('admin').id, 'admin');
  assert.equal(getPapel('gerente').id, 'gerente');
});
