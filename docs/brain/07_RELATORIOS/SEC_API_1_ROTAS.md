# SEC-API-1 · rotas de API sem login (14/10/2026)

Branch `claude/sec-api-1` · teste: `app/lib/server/sec-api-1.test.mjs`, `app/lib/rotas-vercel.test.mjs`

## O que foi encontrado

| # | Achado | Gravidade | Evidência |
|---|---|---|---|
| S-25 | **O servidor antigo (backend_cloud_code, Express) responde a todo `/api` fora da lista do vercel.json, sem login.** `/api/ocr` repassa para a OpenAI com a chave de produção. `/api/chat` chama a IA. Rotas de escrita (`/api/config/unidades`, `/api/crm/*`, `/api/eventos`, `/api/firebase/reload`…) gravam no Firestore `cerebro-erp-6fa0c`. Leitura devolve dados de demonstração (lojas fictícias) | ALTO (custo e escrita anônima) | TESTADO EM PRODUÇÃO (só leitura). `POST /api/ocr` com corpo vazio devolveu um erro **da OpenAI**, o que prova que a chave está configurada. `/api/firebase/status`: firestore ativo |
| S-26 | **As rotas de IA do Next (`/api/ia-*`, 18 rotas, e `/api/hefisto`) chamam a Anthropic sem sessão**: qualquer pessoa na internet usa a chave do Héfisto | ALTO (custo) | TESTADO EM PRODUÇÃO: POST sem login dá 400 de validação (não 401) em ia-ficha, ia-preparo, ia-recibo, ia-inventario e hefisto. Não foi enviado nada que chamasse a IA |
| S-27 | `/api/auth/policy` (Next): o evento `failure` é anônimo. **5 chamadas bloqueiam a conta de qualquer pessoa** e marcam `status = bloqueado` para sempre. Hoje a rota cai no servidor antigo (404) e o login segue sem a política | MÉDIO (latente) | Leitura do código. Mantida fora do Next nesta PR; correção separada |
| S-28 | Rotas do Next que **não chegavam** à produção (B-013) e estavam abertas: `integrations` e `integrations/events` (falha aberta, pois sem token a checagem de unidade era pulada e lia-se com service_role), `integrations/[provider]/test`, `saas/export` (sem login), `fiscal/emitir` (service_role, unidade do navegador), `automation/cron` (segredo padrão fixo no código), `ocr`, `ia-evidencia`, `ia-ficha-assistente` e `ia-cardapio-fichas` | ALTO se fossem ligadas | Leitura do código + teste |
| B-013 | **Usuários e Perfis (Configurações) não funcionam em produção**: `/api/admin/access-control` cai no servidor antigo (404). Também mortas: comprovante por e-mail, emissão fiscal, OCR de notas e IA de evidência, assistente de receita e cardápio | Funcional | TESTADO EM PRODUÇÃO (GET → "Cannot GET" do Express) |

## O que a correção faz

1. **vercel.json:** todo `/api` vai para o Next. No servidor antigo ficam só `/api/auth/policy` (S-27, comportamento de hoje) e o cron antigo `/api/triggers/verificar`. Fecha o S-25 sem apagar o servidor antigo.
2. **Sessão obrigatória** (`sessaoOuNegar` → `exigirSessao`: token válido no Supabase e cadastro ATIVO no ERP) nas 18 rotas `ia-*`, em `hefisto` e em `ocr`. Fecha o S-26.
3. **Permissões por rota:**
   - `saas/export`: só super admin;
   - `fiscal/emitir`: sessão e vínculo com a unidade (`autorizarLeituraDaUnidade`);
   - `integrations*`: sessão e vínculo com a unidade, sempre (antes falhavam abertas);
   - `automation/cron`: sem `CRON_SECRET` ninguém entra, e o segredo só vale no cabeçalho.
4. **Telas:** as 20 chamadas a essas rotas passam a mandar a sessão (`fetchComSessao`, `app/lib/api-sessao.js`). O export de empresa baixa pelo fetch.

## Impacto

- **Quem usa as telas logado:** nada muda. A sessão vai junto.
- **Quem chamava sem login:** passa a receber 401. Isso inclui robôs e qualquer outra pessoa.
- **Volta a funcionar** (B-013):
  - Usuários e Perfis em Configurações;
  - comprovante de ponto por e-mail;
  - OCR de notas;
  - IA de evidência, assistente de receita e cardápio;
  - emissão fiscal (só se `FISCAL_API_URL`/`FISCAL_API_TOKEN` estiverem configurados; sem eles, 503 como antes).
- **Usuários e Perfis voltando a funcionar** liga a gestão de acesso pela tela, com as regras anti-escalada já testadas (`concessao.mjs`: ninguém gerencia a si mesmo nem dá o que não tem). É uma mudança de operação que o dono precisa saber.
- **Saipos:** sem mudança. O servidor antigo não tem rota da Saipos; a integração está em `app/lib/integrations/saipos`.
- **iFood, etiquetas, portais públicos:** já iam para o Next; sem mudança.

## Validação

| O quê | Resultado | Onde |
|---|---|---|
| 22 rotas carregadas de verdade: sem sessão e com token falso dão 401, e a IA e o motor fiscal **não são chamados** | 22/22 | TESTADO LOCAL |
| integrations*: 401 sem sessão. Cron: 401 sem segredo, com o segredo antigo e com o segredo na URL | passa | TESTADO LOCAL |
| Nenhuma tela chama essas rotas sem `fetchComSessao` | passa | TESTADO LOCAL |
| vercel.json: toda rota de app/api cai no Next, exceto as 2 do servidor antigo; `/api/ocr`, `/api/chat` e `/api/db/*` não chegam mais ao Express | passa | TESTADO LOCAL |
| `app/lib` 504/504 · catálogo de permissões · `test:agent` 62/62 · build · varredura do bundle (sem service_role) | verdes | TESTADO LOCAL |
| Telas com IA logado, Usuários/Perfis | **NÃO VALIDADO**: o Preview não tem as variáveis públicas do Supabase (mesmo bloqueio do PR #172) | — |
