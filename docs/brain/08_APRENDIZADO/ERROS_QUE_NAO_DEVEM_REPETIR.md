# Erros que não devem se repetir

1. **SQL com `DROP` pelo conector Supabase numa sessão sem ninguém olhando.** O conector pede confirmação manual e a chamada expira em 60 s.
   - Antes de concluir algo, conferir no catálogo se aplicou.
   - Não tentar contornar a confirmação. Em banco novo, `drop … if exists` é no-op e pode ser omitido; senão, registrar ACESSO/BLOQUEIO.
2. **Achar que `apply_migration` com timeout falhou ou aplicou.** Sempre verificar no catálogo (tabelas, comentário de versão) antes de repetir.
3. **Testar só com o banco falso e chamar de validado.** Com dado real apareceram dois bugs (etiquetas ignoradas, lotes órfãos) que os testes com fixture não pegavam.
4. **Ler colunas que não existem em produção.** O esquema do repositório não é confiável: conferir em `information_schema` antes (ex.: `vw_compras.data_recebimento`, `colaboradores.ativo`).
5. **`/tmp` some quando o container reinicia.** O PGlite instalado em `/tmp/pglite` precisa ser reinstalado; os testes de SQL real pulam sem `PGLITE`, então é preciso conferir se rodaram.
6. **`cmd | tail` dentro de um laço de retry esconde o código de saída.** Usar `if cmd; then …` e conferir o resultado (ex.: `git ls-remote`).
7. **Publicar sem conseguir verificar depois.** Sem smoke possível, não fazer merge em produção, mesmo com tudo verde localmente.
8. **Instrução só para Linux para quem usa Windows (08/10/2026).** O dono rodou no CMD, fora da pasta do projeto: `$(date +%F)` não existe no CMD, e o agente ainda não estava na `main`.
   - Instrução de uso tem que funcionar no CMD/PowerShell. Prefira um comando `npm run …` que faz o trabalho (`hefisto:preparar`) a sintaxe de shell.
   - Diga em que pasta e em que branch rodar.
   - No Windows, `claude` é `claude.cmd`: o runner monta a linha para o cmd com aspas e mata a árvore de processos com `taskkill`.
9. **Lista longa de regras na linha de comando do Windows (08/10/2026).** Com as regras dos conectores, a chamada do `claude` passaria de 10 mil caracteres; o `cmd` corta em 8191.
   - Regra extensa vai no arquivo `--settings`, não em `--allowedTools`.
   - Um teste trava o tamanho da linha.
10. **Confiar que o agente vai "obedecer" a regra de só leitura.** Sem ninguém olhando, a garantia tem que ser mecânica e falhar fechada:
    - modo `dontAsk`;
    - SQL só pelo gancho `guarda-sql.mjs`;
    - transação somente leitura no banco.
    Ver DA-007.
11. **O dono rodou de novo fora da pasta do projeto (08/10/2026):** `npm run hefisto:continuo` em `C:\Users\lucas` deu `ENOENT package.json`. Toda instrução de execução começa com uma linha única que entra na pasta (e clona se faltar), como o atalho do `COMO_USAR`.

