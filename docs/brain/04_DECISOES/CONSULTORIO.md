# Consultório médico (decisão do dono, 21/11/2026)

**Contexto.** O dono é médico (clínico geral; atende como pessoa física e por CNPJ; particular e convênio; secretária agenda). Primeira área do Héfisto fora do food service, no mesmo app. Objetivo declarado: "controle de gastos e lucro, para saber quanto vai cobrar na consulta para dar lucro". Gestão pessoal entra depois, como bônus do plano.

## Decisões
- Consultório = unidade própria `consultorio` na mesma conta (como Delivery e Eventos), na troca de negócio do topo. Separação por empresa virá com o cadastro por área.
- Prontuário: **caminho 1** — ficha de apoio ao retorno (motivo, história, diagnóstico, CID, conduta, exames, medicação, retorno). O prontuário oficial continua no papel e no sistema que ele já usa. Antes de vender a outros médicos: integrar com prontuário certificado ou certificar (SBIS/CFM NGS2).
- Secretária vê agenda, cadastro e **motivo**; nunca diagnóstico/conduta.
- Tipos de consulta (duração e valor) e convênios (valor por tipo, glosa, prazo) o médico cadastra e muda.
- IA não sugere diagnóstico (CFM 2.454/2026 exige registrar uso de IA no prontuário).

## Banco — CONS-1 (`db/consultorio/CONS_1_CONSULTORIO.sql`)
- Aplicada no hefisto-staging em 21/11/2026 com autorização do dono. Impressão digital: 6 tabelas, 6 com RLS, 16 regras; unidade na empresa do Delivery; anon sem leitura.
- `cons_pode_acessar`: unidade principal = consultório, escopo explícito nela, ou administrador da MESMA empresa. Escopo de empresa (gerente do restaurante) não dá acesso.
- `cons_fichas`: só o médico que escreveu lê/altera; sem exclusão; criar/alterar/ler registrados em `cons_acessos` (leitura pela função `cons_fichas_do_paciente`).
- Sem exclusão de paciente/consulta/tipo/convênio (inativa ou cancela).
- Rollback: `db/consultorio/CONS_1_ROLLBACK.sql` (nunca sem o dono).
- TESTADO LOCAL (PGlite, 24 casos) e TESTADO NO SUPABASE REAL em transação desfeita (dono acessa, ficha lida pela função, 2 registros de acesso).

## Telas (`/dashboard/consultorio`)
Agenda (marcar, horários livres, confirmação por link do WhatsApp, chegou/faltou/cancelar, receber) · Atendimento (fila, última consulta, ficha, retorno, retornos esquecidos) · Pacientes · Preço e lucro (custos fixos, pró-labore, consultas/mês, material, imposto, taxa, meta → custo, ponto de equilíbrio, preço da meta, cascata por tipo, convênios, resultado e projeção do mês) · Consultas e convênios (tipos, convênios, horário). Custos em `config_sistema.params.consultorio_custos` (unidade consultorio).

## Pendências
- Telas NÃO VALIDADAS no celular.
- Conta da secretária: criar com unidade principal = consultório (Contas rápidas).
- Confirmação automática pela API oficial do WhatsApp (hoje é link para o aparelho).
- Fase 2/3: contas a receber de convênio e plantões, finanças pessoais (bônus), clínica com vários médicos.

## Teleconsulta — CONS-2 (21/11/2026)
- Decisão do dono: vídeo pelo **Whereby**; guardar **consentimento + registro, sem gravar o vídeo** (CFM 2.314/2022 pede registro em prontuário e aceite do termo pelo paciente).
- Paciente entra por `/teleconsulta/<código de 40 caracteres>`, sem login: lê o termo, aceita (texto, versão e md5 guardados em `cons_consentimentos`, sem alteração) e só então recebe o link da sala.
- Sala: `/api/consultorio/sala` com `WHEREBY_API_KEY` só no servidor; checa o acesso pelo login de quem pede (RLS), sem service role. Sem a chave: colar link (BLQ-021).
- Termo: modelo em `app/lib/consultorio/teleconsulta.mjs`, editável em Consultas e convênios (cada mudança vira versão nova). Não é parecer jurídico.
- TESTADO LOCAL (PGlite) e NO SUPABASE REAL (transação desfeita). Vídeo NÃO VALIDADO.

## Portal do paciente — CONS-3 (21/11/2026)
- Pedido do dono: login e senha gerados pelo médico; o paciente marca e cancela, entra na teleconsulta e vê as informações.
- Login criado pelo servidor (`/api/consultorio/paciente-acesso`, chave de serviço; BLQ-022/ACESSO-009). E-mail técnico `<login>@pacientes.hefisto.app`; senha mostrada uma vez; o paciente troca no portal.
- O paciente **não lê tabelas**: só as funções `cons_paciente_*` (security definer, presas ao `auth.uid()`). Marcar só em horário livre (expediente cadastrado, fuso de Brasília, a partir de 1 h, até 90 dias, máx. 3 futuras); cancelar com 2 h de antecedência.
- Resumos para o paciente: motivo, diagnóstico, CID, conduta, exames, medicação, **orientações** (campo novo) e retorno; as anotações internas (história/exame físico) não saem. Leitura registrada.
- Login de paciente não tem `usuarios_erp`: o banco não mostra nada do ERP (só catálogos de categoria financeira, abertos a qualquer login). Risco conhecido: o metadado do Auth é editável pelo próprio usuário; o app de ERP pode mostrar telas vazias, mas o banco bloqueia (RLS).
- Relacionamento (sem integração externa): lembretes de amanhã, pedido de avaliação (0 a 10) e aniversariantes, por link do WhatsApp. O resto fica em BLQ-023.
