# Bloqueadores

Só bloqueio **real**: precisa de algo de fora (acesso, credencial, decisão ou aprovação). Erro técnico que o agente consegue corrigir não entra aqui.

| ID | Bloqueia | O que falta | Quem resolve | Desde | Estado |
|---|---|---|---|---|---|
| BLQ-001 | [[HDEV-001]]: smoke do deploy | Rede do ambiente não alcança `app.hefisto.com.br` / `*.vercel.app` ([[ACESSOS_NECESSARIOS]] ACESSO-001) | Dono: configurações do ambiente | 07/10/2026 | PENDENTE |
| BLQ-002 | [[HDEV-001]]: logs e preview protegido | Conector Vercel sem autorização no time `lucas-cavalcante` (ACESSO-002) | Dono: conector Vercel no claude.ai | 07/10/2026 | PENDENTE |
| BLQ-003 | [[HDEV-001]]: smoke autenticado (API 200/403, tela, contexto) | Usuário de teste para o agente (ACESSO-003) | Dono | 08/10/2026 | PENDENTE |
| BLQ-004 | [[HDEV-001]]: publicar | Aprovação do merge do PR #127 para produção (ACESSO-004), depois de BLQ-001 e BLQ-003 | Dono | 07/10/2026 | PENDENTE |
| BLQ-005 | [[HDEV-008]]: corrigir RLS crítico | Aprovação para mudar RLS/policies em produção (S-01, S-02 em [[SEGURANCA]]) | Dono | 07/10/2026 | PENDENTE |
| BLQ-006 | [[HDEV-007]]: WhatsApp | Conta Meta Business verificada + WhatsApp Business Platform (ACESSO-006) | Dono | 08/10/2026 | PENDENTE |
