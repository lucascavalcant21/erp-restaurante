-- ═══════════════════════════════════════════════════════════════
-- MOTOR DE TAREFAS E FORMULÁRIOS
-- O "Cérebro" cria os templates e envia para as unidades. As unidades apenas executam e respondem.
-- ═══════════════════════════════════════════════════════════════

-- 1. TEMPLATES DE TAREFAS (Criados pelo Admin/Cérebro)
-- Define a estrutura do formulário ou checklist.
CREATE TABLE IF NOT EXISTS tarefas_templates (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null default 'checklist', -- checklist, formulario, leitura
  campos jsonb not null default '[]',     -- Array de definições dos campos. Ex: [{"id": "c1", "label": "Limpou a chapa?", "tipo": "checkbox"}]
  ativo boolean default true,
  created_at timestamptz default now()
);

-- RLS para Templates (Todos autenticados podem ver, mas só Cérebro/Admin deveria poder criar/editar, gerenciado na UI)
ALTER TABLE tarefas_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON tarefas_templates;
CREATE POLICY "auth_all" ON tarefas_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 2. INSTÂNCIAS DE TAREFAS (Atribuições para as Unidades)
-- Uma tarefa pendente ou concluída em uma unidade específica.
CREATE TABLE IF NOT EXISTS tarefas_instancias (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references tarefas_templates(id) on delete cascade,
  unidade_id text not null,
  status text not null default 'pendente', -- pendente, concluida, atrasada
  prazo timestamptz,
  
  -- Preenchido quando a unidade executa a tarefa
  respostas jsonb default '{}',            -- Chave (campo_id) -> Valor (resposta do funcionário)
  funcionario_id uuid,                     -- Opcional (se tivermos a tabela de funcionarios)
  funcionario_nome text,
  concluida_em timestamptz,
  
  created_at timestamptz default now()
);

-- RLS para Instâncias (Sempre filtrar por unidade_id usando a mesma lógica RLS do projeto)
ALTER TABLE tarefas_instancias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_unidade" ON tarefas_instancias;
CREATE POLICY "rls_unidade" ON tarefas_instancias
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
