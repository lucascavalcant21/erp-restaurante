/* EVT-UNIDADE-1: eventos como negócio próprio (05/11/2026, decisão do dono).

   ADITIVA: cria a unidade "eventos", vazia, na mesma empresa do restaurante, com
   os mesmos locais de estoque dele. Não copia nem move nada: os eventos que já
   existem ficam onde estão. Sem policy, grant nem função nova: a separação
   vem das regras por unidade que já existem.
   ROLLBACK: db/eventos/EVT_UNIDADE_1_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if not exists (select 1 from public.unidades where id = 'seldeestrela' and empresa_id is not null) then
    raise exception 'EVT-UNIDADE-1: unidade do restaurante sem empresa. Nada foi alterado.';
  end if;
  if exists (select 1 from public.unidades where id = 'eventos') then
    raise exception 'EVT-UNIDADE-1: já aplicada. Nada foi alterado.';
  end if;
end $$;

insert into public.unidades (id, nome, cor, ativo, empresa_id)
select 'eventos', 'Eventos', '#7C3AED', true, empresa_id from public.unidades where id = 'seldeestrela';

-- Mesmos locais do restaurante, menos os da marmitaria. Os de pré-preparo são
-- exigidos pelo gatilho que cria o item de estoque de cada subproduto.
insert into public.estoques (unidade_id, nome, slug, tipo, descricao, cor, status, permissoes, controla_minimo, controla_validade, locais_internos, ordem)
select 'eventos', e.nome, e.slug, e.tipo, e.descricao, e.cor, 'ativo', e.permissoes, e.controla_minimo, e.controla_validade, e.locais_internos, e.ordem
  from public.estoques e
 where e.unidade_id = 'seldeestrela' and e.status = 'ativo' and e.slug not like '%marmitaria%';

do $$
begin
  if (select count(*) from public.estoques where unidade_id = 'eventos') <> 14 then raise exception 'EVT-UNIDADE-1: estoques não criados.'; end if;
  if exists (select 1 from public.eventos where unidade_id = 'eventos') then raise exception 'EVT-UNIDADE-1: a unidade precisa nascer vazia.'; end if;
end $$;

commit;
