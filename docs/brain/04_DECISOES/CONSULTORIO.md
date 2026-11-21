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
