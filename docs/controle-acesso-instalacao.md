# Controle de acesso do Hefisto

O sistema usa exclusivamente o Supabase Auth já existente. Usuários, perfis,
permissões, escopos e auditoria ficam no Postgres do mesmo projeto.

## Ativação

1. Abra o SQL Editor do projeto Supabase.
2. Execute `docs/controle-acesso-rbac.sql`.
3. No ambiente de hospedagem, configure `SUPABASE_SERVICE_ROLE_KEY` como
   variável exclusiva do servidor. Não use o prefixo `NEXT_PUBLIC`.
4. Publique novamente a aplicação.
5. Entre com um administrador e acesse:
   - `/dashboard/configuracoes/usuarios`
   - `/dashboard/configuracoes/perfis`

Usuários existentes são preservados. Como o cadastro público antigo deixava o
visitante escolher o próprio papel, somente o primeiro administrador criado no
Auth recebe acesso geral automaticamente. Ele pode promover administradores
legítimos na nova tela.

## Acessos antigos

Se a tabela `acessos_modulo` possuir registros, a tela de usuários exibe o
botão **Migrar agora**. Ele cria cada conta no Supabase Auth, converte o módulo
antigo em permissões e apaga o registro com senha em texto puro somente depois
que aquela conta foi migrada com sucesso.

## Regra de segurança

O padrão é negação: sem uma permissão `módulo.página.ação`, a ação é recusada.
O menu e o guard de rotas usam a mesma permissão efetiva. Nas tabelas centrais
de estoque, RH e financeiro, as políticas RLS também validam ação e unidade.
As APIs administrativas repetem a autorização no servidor.
