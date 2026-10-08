# Padrões descobertos

- **Validar com dado real sem sujar produção.**
  - Leitura sob RLS com a identidade de um usuário real: `set local role authenticated` + `request.jwt.claims`.
  - Escrita de teste dentro de `do $$ … raise exception 'RESULTADO %' $$`: tudo é desfeito e o resultado volta na mensagem de erro.
  - Detalhes em [[TESTES]].
- **Testar o código real com dado real quando a rede não alcança o banco.** Ler as linhas sob RLS (colunas exatas que o motor pede), transcrever, conferir com contagem/soma/md5 contra o banco e rodar o motor real localmente.
  - Rotular "motor local + dado real", nunca "produção".
- **Capturar a chamada exata antes de executar no banco.** Rodar o fluxo real com um banco falso que só registra o RPC, e executar no banco real exatamente aqueles parâmetros.
- **A trava de catálogo pega tela nova sem permissão.** `permissions-catalog.test.mjs` falhou na `main` quando chegaram as telas de eventos: é assim que deve ser.
- **Fallback por ausência de função, não por erro qualquer.** Cair no caminho legado só com PGRST202/42883; qualquer outro erro falha fechado.
- **As policies antigas não isolam empresa.** Toda leitura nova precisa filtrar por unidade no servidor e conferir linha a linha.
