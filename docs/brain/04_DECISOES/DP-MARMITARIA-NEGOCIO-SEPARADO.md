# Marmitaria é uma operação separada do restaurante (14/10/2026)

**Decisão do dono:** o restaurante Seldeestrela, a Marmitaria e Eventos são **três negócios separados**. A Marmitaria terá **unidade própria** no Héfisto (Eventos também é separado; a migração dele é decisão futura). A loja do iFood é **só da Marmitaria**.

**Complemento (14/10, à noite):** operação independente, mas com **transferência controlada de estoque entre unidades**, **fichas e pré-preparos compartilháveis sem duplicar** e **visão consolidada da empresa**. Ver [[AUDITORIA_INTEGRACAO_MARMITARIA_2026-10-14]].

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
- **Eventos:** negócio separado. Separar = criar a unidade "Eventos" e decidir se os 2 eventos existentes mudam de unidade (dado histórico: exige decisão).
- **Entre unidades:** transferência de estoque ao custo médio (UNID-MARM-1, APR-008); "trazer de outra unidade" para fichas e pré-preparos (reaproveita, sem duplicar); pessoa cedida no CMO; aba "Empresa" no DRE.

## Passos do dono

1. Configurações → Unidades → nova unidade "Marmitaria".
2. Selecionar a unidade Marmitaria no topo.
3. Marmitaria → Configurações: marcar "Esta unidade é só da marmitaria"; preencher as taxas do canal iFood; cadastrar o iFood.
4. Usuários: dar acesso à unidade Marmitaria a quem trabalha nela.

## Revisão (14/10, noite) — Eventos fica no restaurante

Decisão do dono: **Eventos continua como operação/centro de resultado do restaurante principal** (centro de custo `eventos` dentro da unidade do restaurante). Não criar unidade Eventos automaticamente e não transferir eventos históricos. A separação operacional e financeira vale para a **Marmitaria**: estoque, produção, funcionários, compras, custos, CMV, CMO, DRE e iFood próprios, com visão consolidada para usuários autorizados.
