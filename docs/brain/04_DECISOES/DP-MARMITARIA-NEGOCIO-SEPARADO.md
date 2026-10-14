# Marmitaria é um negócio separado (14/10/2026)

**Decisão do dono:** a Marmitaria, o restaurante Seldeestrela e Eventos são negócios diferentes e não se conectam. A Marmitaria terá **unidade própria** no Héfisto. A loja do iFood é **só da Marmitaria**.

## Consequências no sistema

- **Unidade própria = isolamento completo.** Estoque, contas, funcionários, fichas e pedidos ficam por unidade (RLS `sec_unidade`). Usuário do restaurante não vê a marmitaria, a não ser que o dono conceda acesso em Usuários.
- **Nada a mover.** A única "marmita" na unidade do restaurante era um teste ("Ggghh", sem ingredientes). A unidade nova começa vazia.
- **Não precisa de migração.** Criar unidade é permitido ao dono pela tela (policy `sec_unidades_criar`). A tela estava quebrada (B-017) e foi corrigida.
- **Modo "unidade só da marmitaria"** (`centros_diretos = ["*"]`):
  - todas as contas da unidade entram 100% no DRE;
  - todos os estoques da unidade contam no CMV;
  - sem rateio com o restaurante e sem a aba "Consolidado com o restaurante".
  - Na unidade compartilhada, o comportamento antigo continua igual.
- **Cadastro de produtos é por unidade.** A marmitaria cadastra os próprios ingredientes e embalagens, pelo cadastro rápido da marmita.
- **Eventos:** também é negócio separado. Separá-lo em unidade própria é uma decisão futura; nada foi feito.

## Passos do dono

1. Configurações → Unidades → nova unidade "Marmitaria".
2. Selecionar a unidade Marmitaria no topo.
3. Marmitaria → Configurações: marcar "Esta unidade é só da marmitaria"; preencher as taxas do canal iFood; cadastrar o iFood.
4. Usuários: dar acesso à unidade Marmitaria a quem trabalha nela.
