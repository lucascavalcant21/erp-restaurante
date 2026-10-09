# SEC-RLS-2 — mapa das 33 tabelas e dados legados

Missão [[HDEV-SEC-002]] · migração `db/security/SEC_RLS_2_FASE2.sql` · rollback `SEC_RLS_2_ROLLBACK.sql` · aprovação **APR-002** · fase 1 em [[HDEV-SEC-001]].

Auditoria só leitura no Supabase real em 08/10/2026 (TESTADO NO SUPABASE REAL). Nenhum dado foi alterado.

## Modelo de acesso (depois da SEC-RLS-2)

| Quem | Vê | Como é identificado |
|---|---|---|
| Super admin | tudo | `usuarios_erp.super_admin` |
| Dono | todas as unidades da **própria** empresa | escopo `empresa` (ou `todos`) em `usuario_escopos`, com `empresa_id`; sem `empresa_id`, vale a empresa da unidade principal |
| Admin/gerente | as unidades do escopo explícito + permissões do perfil | unidade principal + escopos de unidade |
| Usuário comum | a(s) própria(s) unidade(s), só o que o perfil permite | idem |

- `pode_ver_todas()` e `hefisto_ve_todas_unidades()`: **só super admin**. Antes, os escopos `empresa`/`todos` davam todas as unidades de todas as empresas (S-14).
- A empresa vem de `unidades.empresa_id`. Hoje há 1 empresa (Hefisto) e 1 unidade (`seldeestrela`).

## As 33 tabelas

| Tabela | Tipo | Escopo | Policy atual (08/10) | Risco | Policy nova | Mãe | Dados inconsistentes |
|---|---|---|---|---|---|---|---|
| controle_limpeza | operacional | unidade | `true` (ALL) | alto | `sec_unidade` | – | 2 LEGADO (`burguer`) |
| controle_manutencoes | operacional | unidade | `true` (ALL, public) | alto | `sec_unidade` | – | 1 LEGADO (`burguer`) |
| suprimentos_historico | operacional | unidade | `true` | alto | `sec_unidade` | – | 12 LEGADO (`ticotico`), 1 ORFAO (nulo) |
| suprimentos_unidades | operacional | unidade | `true` | alto | `sec_unidade` | – | 1 LEGADO (`ticotico`) |
| montagem | operacional | unidade | `true` | alto | `sec_unidade` | – | 12 AMBIGUO (sem unidade) |
| eventos | operacional | unidade | `true` + `auth.role()` + `… or unidade_id is null` | alto | `sec_unidade` | – | 1 AMBIGUO com evidência forte |
| notas_fiscais | financeiro | unidade | `true` | alto | `sec_unidade` | – | 15 AMBIGUO (`todas`) |
| suprimentos_catalogo | catálogo operacional | unidade (coluna nova) | `true` | médio | `sec_unidade` | – | 1 LEGADO (só usado por `ticotico`) |
| tarefas_templates | catálogo operacional | unidade (coluna nova) | `true` | médio | `sec_unidade` | – | – (vazia) |
| fichas_ingredientes | filha | pela ficha | `true` | alto | `sec_pai` | fichas_tecnicas | – |
| ficha_itens | filha | pela ficha | `true` | alto | `sec_pai` | fichas_tecnicas | – |
| pedidos_itens | filha | pelo pedido | `true` | alto | `sec_pai` | pedidos | – |
| evento_compras, evento_custos_fixos, evento_drinks, evento_ingredientes, evento_pratos, evento_preparos, evento_reservas | filhas | pelo evento | `true` | alto | `sec_pai` | eventos | as do evento sem unidade ficam só para o super admin |
| op_secoes, op_itens | filhas | pelo processo | `true` | médio | `sec_pai` | op_processos | – |
| op_respostas | filha | pela execução | `true` | médio | `sec_pai` | op_execucoes | – |
| op_acoes_corretivas | filha | pela não conformidade | `true` | médio | `sec_pai` | op_nao_conformidades | – |
| documentos_rh | filha **sensível** | pelo colaborador | `true` | **crítico** | `sec_pai` | colaboradores (RLS de RH) | – |
| ponto | antiga, vazia | – | `true` ×2 | médio | RLS sem policy (fechada) | – | – |
| usuarios_erp | cadastro de acesso | empresa/unidade | `true` (SELECT) | alto (e-mail, telefone, IPs) | o próprio; gestão de usuários da unidade; super admin | – | – |
| usuario_escopos | cadastro de acesso | empresa/unidade | `true` (SELECT) | médio | o próprio; gestão; super admin | – | – |
| unidades | cadastro | empresa | `true` (SELECT e ALL) + `pode_ver_todas()` | **crítico** (`token_nfe` legível, qualquer um edita) | ler as próprias; editar com permissão; criar/apagar só super admin; **`token_nfe` não é lido pelo navegador** | – | – |
| perfis_acesso | catálogo de perfis | sistema / empresa | `true` (SELECT) | baixo | perfis do sistema para todos; próprios só super admin (até existir `empresa_id`) | – | – |
| permissoes_auditoria | auditoria | sistema | `true` (SELECT) | médio | só super admin (o servidor lê com a chave de serviço) | – | – |
| fin_categorias, fin_categorias_legado, fin_centros_custo | catálogo **global** do sistema | global | `true` (só SELECT) | baixo | **sem mudança** (só leitura, nenhuma policy de escrita) | – | – |

Mais `colaboradores` (fase 1, agora com regra de dado sensível, abaixo).

## Dados sensíveis (CPF, salário)

- `colaboradores` completo (CPF, salário, RG, PIX, endereço, família, biometria, anotações de RH): só
  - **o próprio** (`usuarios_erp.colaborador_id`/`funcionario_id`);
  - **RH/gerência autorizados da unidade** (`rh.employees.view`; editar `rh.employees.edit`, criar `create`, apagar `delete`);
  - **dono** (perfil com `*`, na própria empresa) e **super admin**.
- As telas operacionais (ponto, escala, produção, etiquetas…) leem `hefisto_colaboradores_operacional()`: nome, cargo, status, horários, foto. **Lista fechada de colunas**: coluna nova não aparece até alguém incluir.
- `fetchColaboradores()` junta as duas listas (`app/lib/colaboradores-acesso.mjs`): nenhuma tela quebra, e quem não tem permissão recebe os campos sensíveis vazios.
- **Hoje nenhum dos 16 usuários está ligado a um colaborador.** "Ver o próprio CPF" só funciona depois de ligar (`colaborador_id`). Até lá vale a regra fechada.
- Reconhecimento facial: quem bate o ponto hoje é gerente (`rh.*`), que continua recebendo a biometria. Um perfil só de terminal (`somente-ponto`) **não** recebe a biometria. Se for usar terminal dedicado, precisa de uma função própria para os rostos.

## token_nfe (SEGREDO)

- Em 08/10, `unidades.token_nfe` estava preenchido e **legível por qualquer usuário logado** (policy `using (true)`). Também era editável por qualquer um (`unidades_all`).
- O valor **nunca** é escrito em log, teste, relatório ou nesta memória.
- Depois da SEC-RLS-2:
  - o navegador **não lê** a coluna (privilégio de coluna revogado);
  - continua **gravando** (tela fiscal: campo vazio = mantém o token atual);
  - `hefisto_token_nfe_configurado()` só responde sim/não, para as unidades do usuário.
- **AÇÃO DO DONO:** **rotacionar (trocar) a credencial no provedor da NF-e.** Ela esteve exposta a todos os usuários logados. Depois, gravar a nova pela tela fiscal.
- Melhor ainda (futuro): tirar o token do banco e usar variável de ambiente no servidor.

## Dados legados (classificação; nada apagado, nada movido)

Gravada em `public.sec_dados_legados` (só servidor e super admin) quando a SEC-RLS-2 for aplicada.

| Tabela | Registros | Classe | Evidência | Ação |
|---|---|---|---|---|
| controle_limpeza | 2 | LEGADO | unidade antiga `burguer`; produtos "sss", "kjl" (teste), 04/07/2026 | só super admin; o dono decide |
| controle_manutencoes | 1 | LEGADO | unidade antiga `burguer` ("Limpeza da Coifa"), 04/07 | idem |
| suprimentos_historico | 12 | LEGADO | unidade antiga `ticotico`, 14–15/06 | idem |
| suprimentos_historico | 1 | ORFAO | sem unidade; mesmo catálogo e mesmo dia dos `ticotico` | idem |
| suprimentos_unidades | 1 | LEGADO | `ticotico` | idem |
| suprimentos_catalogo | 1 | LEGADO | só usado por registros `ticotico` | idem |
| montagem | 12 | AMBIGUO | sem unidade; "Double Bacon", "Smash Classic"… criados pelo Cardápio em 11–21/07 (cardápio de hamburgueria; a Sal de Estrela é comida nortista; provável `burguer`) | **não reatribuir** |
| notas_fiscais | 15 | AMBIGUO | marcador `todas` (gravado por `app/lib/notas.js`); cupons de supermercado de 2020/2023 carregados em 14–15/06; nenhum com o CNPJ da Sal de Estrela | **não reatribuir** |
| eventos | 1 | AMBIGUO, evidência forte | "Dia dos namorados" (12/06), sem unidade, `tag = Seldeestrela` | reatribuição preparada em `SEC_RLS_2_REATRIBUIR_EVENTO.sql`, **aprovação própria** |

Depois da SEC-RLS-2, nenhum desses registros fica visível para usuário de unidade ou empresa. Só o super admin os vê. O app deixa de gravar `todas` (nota sem unidade é recusada).

## Limites conhecidos (registrados)

- As 18 policies antigas no formato `pode_ver_todas() or unidade_id = auth_unidade_id()` (compras, estoque, financeiro) não abrem mais para outra empresa: `pode_ver_todas()` agora é só do super admin. Mas o dono de várias unidades vê nelas só a unidade principal. Trocar por `sec_unidade` quando houver a 2ª unidade.
- `perfis_acesso` e os catálogos financeiros ainda não têm `empresa_id`. Quando uma empresa criar perfil ou categoria própria, adicionar a coluna e a regra.
