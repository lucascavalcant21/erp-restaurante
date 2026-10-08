# Testes

## Como rodar

| Suíte | Comando | Estado em 08/10/2026 |
|---|---|---|
| Intelligence Core | `npm run test:intelligence` | 130/130 TESTADO LOCAL (com PGlite) |
| Intelligence com SQL real | `PGLITE=/tmp/pglite/node_modules/@electric-sql/pglite npm run test:intelligence` | Inclui migração IC_01 e perda contra o SQL do estoque |
| Demais `app/lib` | `node --test app/lib/*.test.mjs app/lib/**/*.test.mjs` | 262/262 TESTADO LOCAL |
| Catálogo de permissões (trava) | `node app/lib/permissions-catalog.test.mjs` | OK |
| Agente autônomo | `npm run test:agent` | 15/15 |
| Build | `npm run build` | OK, sem segredo no bundle (varredura de `.next/static`) |

**Instalar o PGlite** (nuvem ou máquina nova): `npm i --no-save @electric-sql/pglite --prefix /tmp/pglite`.

Sem a variável `PGLITE`, os testes de SQL real **pulam**: não falham, mas não validam.

## Como validar com dado real sem sujar produção (padrão do HI-02)

1. **Leitura:**
   - `begin; select set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated"}', true); set local role authenticated; …; commit;`
   - Com isso o RLS vale com a identidade de um usuário real.
2. **Escrita de teste:**
   - Um bloco `do $$ … $$` que cria o produto de teste, executa e termina em `raise exception 'RESULTADO %', …`.
   - Tudo é desfeito, e o resultado volta na mensagem de erro.
3. **Conferir depois** que nada ficou: contagens antes e depois.
4. **Transcrição de dados para rodar o motor local:** conferir com contagens, somas e md5 contra o banco.

## Lacunas

- **Sem CI:** nada roda automaticamente no PR. Proposta em [[DEBITO_TECNICO]].
- **Sem teste de navegador real** do app autenticado; é a HDEV-001 (Playwright).
- **Fase 1B:** os testes não rodam porque faltam no repositório os arquivos da 1A.
