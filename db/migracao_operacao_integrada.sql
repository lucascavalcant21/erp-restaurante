-- Operação integrada, aditiva. Não transforma saldos/unidades/categorias antigos.
-- Pré-requisitos: estoques-multiplos, estoque_lotes, pré-preparos e segurança 1B-01.
-- Execute primeiro diagnostico_operacao_integrada.sql e teste em homologação.
begin;
do $$ begin
  if to_regprocedure('public.hefisto_user_in_unit(uuid,text)') is null
    or to_regprocedure('public.hefisto_user_has_permission(uuid,text)') is null
    or to_regclass('public.estoque_lotes') is null then
    raise exception 'Pré-requisitos ausentes: segurança 1B-01 e estoque por lotes.';
  end if;
end $$;

alter table public.fichas_tecnicas add column if not exists estoqueavel boolean;
alter table public.fichas_ingredientes add column if not exists unidade text;
alter table public.producao_diaria
  add column if not exists chave_operacao uuid,
  add column if not exists unidade_medida text,
  add column if not exists custo_total numeric,
  add column if not exists receita_snapshot jsonb,
  add column if not exists usuario_id uuid,
  add column if not exists departamento text,
  add column if not exists local_armazenamento text,
  add column if not exists validade date;
alter table public.estoque_movimentacoes_multi
  add column if not exists producao_id uuid references public.producao_diaria(id),
  add column if not exists unidade_medida text,
  add column if not exists valor_unitario numeric,
  add column if not exists valor_total numeric;
create unique index if not exists producao_chave_operacao_idx
  on public.producao_diaria(unidade_id, chave_operacao) where chave_operacao is not null;
create index if not exists movimento_producao_idx on public.estoque_movimentacoes_multi(producao_id);

-- Não aceita converter embalagem em unidade nem peso em volume sem cadastro.
create or replace function public.operacao_converter(q numeric, de text, para text)
returns numeric language plpgsql immutable set search_path = public as $$
declare a text := lower(trim(de)); b text := lower(trim(para));
begin
  if q is null or q::text in ('NaN','Infinity','-Infinity') or a is null or b is null then
    raise exception 'Quantidade ou unidade inválida';
  end if;
  if a = b then return q; end if;
  if a in ('un','unidade','porcao') and b in ('un','unidade','porcao') then return q; end if;
  if (a = 'kg' and b = 'g') or (a = 'l' and b = 'ml') then return q * 1000; end if;
  if (a = 'g' and b = 'kg') or (a = 'ml' and b = 'l') then return q / 1000; end if;
  raise exception 'Unidades incompatíveis: % → %', de, para;
end $$;

create or replace function public.operacao_custo_insumo(p_insumo uuid)
returns numeric language plpgsql stable security invoker set search_path = public as $$
declare i public.insumos%rowtype; base numeric; tamanho numeric; un text;
begin
  select * into strict i from public.insumos where id = p_insumo;
  un := lower(i.unidade_medida);
  tamanho := coalesce(nullif(i.tamanho_embalagem,0),1);
  -- Preço normalizado está em kg/L. Retorno está na unidade física do insumo.
  base := coalesce(nullif(i.preco_normalizado,0),
    coalesce(nullif(i.custo_compra,0),i.custo_unitario*tamanho,0)
      / tamanho * case when un in ('g','ml') then 1000 else 1 end,0);
  if coalesce(i.empanado,false) then
    base := base / greatest(1 + coalesce(i.ganho_pct,0)/100,0.000001)
      + case when un in ('kg','g') then coalesce(i.custo_empanado_kg,0) else 0 end;
  end if;
  return base / case when un in ('g','ml') then 1000 else 1 end;
end $$;

-- Custo atual percorre a composição. Custo histórico fica no snapshot da produção.
create or replace function public.operacao_custo_ficha(p_ficha uuid, p_trilha uuid[] default '{}')
returns numeric language plpgsql stable security invoker set search_path = public as $$
declare f public.fichas_tecnicas%rowtype; b public.fichas_tecnicas%rowtype;
  r record; total numeric := 0; q numeric; custo numeric; base_id uuid;
begin
  if p_ficha = any(p_trilha) then raise exception 'Referência circular na ficha'; end if;
  select * into strict f from public.fichas_tecnicas where id=p_ficha;
  for r in select fi.*, i.unidade_medida, i.ficha_tecnica_id
    from public.fichas_ingredientes fi left join public.insumos i on i.id=fi.insumo_id
    where fi.ficha_id=p_ficha loop
    q := r.quantidade * (1 + greatest(coalesce(r.fator_correcao,0),0)/100);
    base_id := coalesce(r.subficha_id,r.ficha_tecnica_id);
    if base_id is not null then
      select * into strict b from public.fichas_tecnicas where id=base_id and unidade_id=f.unidade_id;
      if b.rendimento_porcoes <= 0 or b.rendimento_porcoes is null then raise exception 'Rendimento inválido'; end if;
      q := public.operacao_converter(q,coalesce(r.unidade,b.rendimento_unidade,'un'),coalesce(b.rendimento_unidade,'un'));
      custo := public.operacao_custo_ficha(b.id,array_append(p_trilha,p_ficha))/b.rendimento_porcoes;
    else
      q := public.operacao_converter(q,coalesce(r.unidade,r.unidade_medida),r.unidade_medida);
      custo := public.operacao_custo_insumo(r.insumo_id);
    end if;
    total := total + q*custo;
  end loop;
  return total + coalesce((to_jsonb(f)->>'custo_embalagens_total')::numeric,0);
end $$;

-- A composição física para na primeira subficha estoqueável (evita dupla baixa).
create or replace function public.operacao_consumo_ficha(p_ficha uuid, p_quantidade numeric, p_trilha uuid[] default '{}')
returns table(insumo_id uuid, quantidade numeric) language plpgsql stable security invoker set search_path = public as $$
declare f public.fichas_tecnicas%rowtype; b public.fichas_tecnicas%rowtype;
  r record; q numeric; base_id uuid; espelho uuid; un text;
begin
  if p_ficha = any(p_trilha) then raise exception 'Referência circular na ficha'; end if;
  select * into strict f from public.fichas_tecnicas where id=p_ficha;
  if f.rendimento_porcoes is null or f.rendimento_porcoes<=0 then raise exception 'Rendimento inválido'; end if;
  if not exists(select 1 from public.fichas_ingredientes where ficha_id=p_ficha) then raise exception 'Ficha sem ingredientes'; end if;
  for r in select fi.*, i.unidade_medida, i.ficha_tecnica_id, i.unidade_id as insumo_unidade
    from public.fichas_ingredientes fi left join public.insumos i on i.id=fi.insumo_id
    where fi.ficha_id=p_ficha order by fi.id loop
    if r.quantidade is null or r.quantidade<=0 or r.quantidade::text in ('NaN','Infinity','-Infinity') then raise exception 'Quantidade inválida na receita'; end if;
    q := r.quantidade*p_quantidade/f.rendimento_porcoes*(1+greatest(coalesce(r.fator_correcao,0),0)/100);
    base_id := coalesce(r.subficha_id,r.ficha_tecnica_id);
    if base_id is not null then
      select * into strict b from public.fichas_tecnicas where id=base_id and unidade_id=f.unidade_id;
      q := public.operacao_converter(q,coalesce(r.unidade,b.rendimento_unidade,'un'),coalesce(b.rendimento_unidade,'un'));
      if coalesce(b.estoqueavel,b.eh_base,false) then
        select i.id,i.unidade_medida into espelho,un from public.insumos i
          where i.ficha_tecnica_id=b.id and i.unidade_id=f.unidade_id;
        if espelho is null then raise exception 'Pré-preparo % sem vínculo de estoque. Revise o cadastro.',b.nome_receita; end if;
        insumo_id:=espelho; quantidade:=public.operacao_converter(q,coalesce(b.rendimento_unidade,'un'),un); return next;
      else
        return query select * from public.operacao_consumo_ficha(b.id,q,array_append(p_trilha,p_ficha));
      end if;
    elsif r.insumo_id is not null and r.insumo_unidade=f.unidade_id then
      insumo_id:=r.insumo_id; quantidade:=public.operacao_converter(q,coalesce(r.unidade,r.unidade_medida),r.unidade_medida); return next;
    else raise exception 'Ingrediente ausente ou de outra unidade'; end if;
  end loop;
end $$;

create or replace function public.operacao_autorizar(p_unidade text,p_setor text,p_acao text)
returns void language plpgsql stable security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.hefisto_user_in_unit(auth.uid(),p_unidade) then raise exception 'Acesso negado à unidade'; end if;
  if p_setor not in ('cozinha','bar','salao') then raise exception 'Setor inválido'; end if;
  if not public.hefisto_user_has_permission(auth.uid(),p_setor||'.production.'||p_acao)
    and not public.hefisto_user_has_permission(auth.uid(),'cozinha.production_all.'||p_acao) then
    raise exception 'Sem permissão para produção neste setor';
  end if;
end $$;

create or replace function public.prever_producao_integrada(p_unidade_id text,p_ficha_id uuid,p_quantidade numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.fichas_tecnicas%rowtype; itens jsonb; custo numeric;
begin
  select * into strict f from public.fichas_tecnicas where id=p_ficha_id and unidade_id=p_unidade_id;
  perform public.operacao_autorizar(p_unidade_id,f.departamento,'view');
  if p_quantidade is null or p_quantidade<=0 or p_quantidade::text in ('NaN','Infinity','-Infinity') then raise exception 'Quantidade inválida'; end if;
  select jsonb_agg(jsonb_build_object('insumo_id',c.insumo_id,'nome',i.nome,'unidade',i.unidade_medida,
    'necessario',c.qtd,'disponivel',coalesce(s.saldo,0),'faltante',greatest(c.qtd-coalesce(s.saldo,0),0))) into itens
  from (select x.insumo_id,sum(x.quantidade) qtd from public.operacao_consumo_ficha(f.id,p_quantidade) x group by x.insumo_id) c
  join public.insumos i on i.id=c.insumo_id
  left join lateral(select sum(ei.quantidade_atual) saldo from public.estoque_itens ei join public.estoques e on e.id=ei.estoque_id
    where ei.insumo_id=c.insumo_id and ei.unidade_id=p_unidade_id and e.unidade_id=p_unidade_id and e.status='ativo'
    and e.slug=case when i.ficha_tecnica_id is not null then 'pre-preparos-'||f.departamento else f.departamento end) s on true;
  custo:=public.operacao_custo_ficha(f.id)*p_quantidade/f.rendimento_porcoes;
  return jsonb_build_object('itens',coalesce(itens,'[]'::jsonb),'receitas',p_quantidade/f.rendimento_porcoes,
    'custo_estimado',custo,'unidade',coalesce(f.rendimento_unidade,'un'),'rendimento',f.rendimento_porcoes);
end $$;

-- Interna: saldo, lotes e movimento mudam juntos; nunca inventa saldo ausente.
create or replace function public.operacao_movimentar(p_unidade text,p_estoque uuid,p_insumo uuid,p_delta numeric,
  p_producao uuid,p_motivo text,p_validade date default null,p_custo numeric default null)
returns void language plpgsql security invoker set search_path = public as $$
declare item public.estoque_itens%rowtype; ins public.insumos%rowtype; saldo_lotes numeric;
begin
  select * into strict ins from public.insumos where id=p_insumo and unidade_id=p_unidade;
  if not exists(select 1 from public.estoques where id=p_estoque and unidade_id=p_unidade and status='ativo') then raise exception 'Estoque inválido'; end if;
  if p_delta is null or p_delta=0 or p_delta::text in ('NaN','Infinity','-Infinity') then raise exception 'Movimento inválido'; end if;
  insert into public.estoque_itens(unidade_id,estoque_id,insumo_id) values(p_unidade,p_estoque,p_insumo) on conflict(estoque_id,insumo_id) do nothing;
  select * into strict item from public.estoque_itens where estoque_id=p_estoque and insumo_id=p_insumo and unidade_id=p_unidade for update;
  if item.quantidade_atual+p_delta<0 then raise exception 'Saldo insuficiente: %; disponível %, necessário % %',ins.nome,item.quantidade_atual,-p_delta,ins.unidade_medida; end if;
  select coalesce(sum(quantidade),0) into saldo_lotes from public.estoque_lotes where estoque_id=p_estoque and insumo_id=p_insumo;
  if abs(saldo_lotes-item.quantidade_atual)>0.000001 then raise exception 'Saldo e lotes divergentes para %. Reconciliar antes de movimentar.',ins.nome; end if;
  if p_delta>0 then perform public.entrada_lote_estoque(p_estoque,p_insumo,p_unidade,p_validade,p_delta);
  else perform public.saida_lote_estoque(p_estoque,p_insumo,-p_delta); end if;
  perform public.sincronizar_item_por_lotes(p_estoque,p_insumo);
  update public.estoque_itens set ultima_movimentacao_em=now() where id=item.id;
  insert into public.estoque_movimentacoes_multi(unidade_id,estoque_id,insumo_id,tipo,quantidade,saldo_anterior,saldo_posterior,
    usuario_id,observacao,producao_id,unidade_medida,valor_unitario,valor_total)
  values(p_unidade,p_estoque,p_insumo,case when p_delta>0 then 'entrada' else 'saida' end,abs(p_delta),item.quantidade_atual,item.quantidade_atual+p_delta,
    auth.uid(),p_motivo,p_producao,ins.unidade_medida,coalesce(p_custo,public.operacao_custo_insumo(p_insumo)),
    abs(p_delta)*coalesce(p_custo,public.operacao_custo_insumo(p_insumo)));
  -- Projeção somente para leitores antigos; nunca é a origem da baixa.
  insert into public.estoque_atual(unidade_id,insumo_id,quantidade_atual,updated_at)
    select p_unidade,p_insumo,coalesce(sum(quantidade_atual),0),now() from public.estoque_itens where unidade_id=p_unidade and insumo_id=p_insumo
    on conflict(unidade_id,insumo_id) do update set quantidade_atual=excluded.quantidade_atual,updated_at=excluded.updated_at;
end $$;

create or replace function public.confirmar_producao_integrada(p_unidade_id text,p_ficha_id uuid,p_quantidade numeric,
  p_colaborador_id uuid,p_local text,p_validade date,p_chave uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.fichas_tecnicas%rowtype; previa jsonb; producao uuid; anterior public.producao_diaria%rowtype;
  r record; estoque uuid; insumo uuid; unidade text; saida numeric; custo numeric; validade_final date;
begin
  select * into strict f from public.fichas_tecnicas where id=p_ficha_id and unidade_id=p_unidade_id for share;
  perform public.operacao_autorizar(p_unidade_id,f.departamento,'confirm');
  if p_chave is null then raise exception 'Chave da operação obrigatória'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade_id||p_chave::text,0));
  select * into anterior from public.producao_diaria where unidade_id=p_unidade_id and chave_operacao=p_chave;
  if found then
    if anterior.ficha_id<>p_ficha_id or anterior.quantidade_produzida<>p_quantidade then raise exception 'Chave já usada em outra produção'; end if;
    return jsonb_build_object('id',anterior.id,'estoqueavel',coalesce(f.estoqueavel,f.eh_base,false),'repetida',true);
  end if;
  if p_colaborador_id is not null and not exists(select 1 from public.colaboradores where id=p_colaborador_id and unidade_id=p_unidade_id) then raise exception 'Responsável de outra unidade'; end if;
  -- Mesma ordem para todas as confirmações concorrentes. As RPCs de movimento
  -- também bloqueiam estoque_itens, impedindo sobrescrever alterações concorrentes.
  perform ei.id from public.estoque_itens ei where ei.unidade_id=p_unidade_id order by ei.id for update;
  previa:=public.prever_producao_integrada(p_unidade_id,p_ficha_id,p_quantidade);
  for r in select * from jsonb_to_recordset(previa->'itens') as x(nome text,necessario numeric,disponivel numeric,faltante numeric,unidade text) loop
    if r.faltante>0 then raise exception 'Saldo insuficiente: %; faltam % %',r.nome,r.faltante,r.unidade; end if;
  end loop;
  custo:=(previa->>'custo_estimado')::numeric;
  validade_final:=coalesce(p_validade,case when f.validade_dias>0 then (now() at time zone 'America/Sao_Paulo')::date+f.validade_dias::integer end);
  if validade_final<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Validade anterior à produção'; end if;
  insert into public.producao_diaria(unidade_id,ficha_id,colaborador_id,quantidade_produzida,departamento,local_armazenamento,
    chave_operacao,unidade_medida,custo_total,receita_snapshot,usuario_id,validade)
  values(p_unidade_id,p_ficha_id,p_colaborador_id,p_quantidade,f.departamento,p_local,p_chave,coalesce(f.rendimento_unidade,'un'),custo,
    jsonb_build_object('ficha',to_jsonb(f),'previsao',previa,'composicao',(select jsonb_agg(to_jsonb(fi)) from public.fichas_ingredientes fi where fi.ficha_id=f.id)),auth.uid(),validade_final)
  returning id into producao;
  for r in select c.insumo_id,sum(c.quantidade) qtd,i.ficha_tecnica_id from public.operacao_consumo_ficha(f.id,p_quantidade) c
    join public.insumos i on i.id=c.insumo_id group by c.insumo_id,i.ficha_tecnica_id order by c.insumo_id loop
    select id into strict estoque from public.estoques where unidade_id=p_unidade_id and status='ativo'
      and slug=case when r.ficha_tecnica_id is not null then 'pre-preparos-'||f.departamento else f.departamento end;
    perform public.operacao_movimentar(p_unidade_id,estoque,r.insumo_id,-r.qtd,producao,'Produção #'||producao);
  end loop;
  if coalesce(f.estoqueavel,f.eh_base,false) then
    select id into strict estoque from public.estoques where unidade_id=p_unidade_id and slug='pre-preparos-'||f.departamento and status='ativo';
    select i.id,i.unidade_medida into insumo,unidade from public.insumos i where i.ficha_tecnica_id=f.id and i.unidade_id=p_unidade_id;
    if insumo is null then
      insert into public.insumos(unidade_id,departamento,nome,unidade_medida,tamanho_embalagem,custo_unitario,custo_compra,ficha_tecnica_id,categoria)
      values(p_unidade_id,f.departamento,f.nome_receita,coalesce(f.rendimento_unidade,'un'),1,custo/p_quantidade,custo/p_quantidade,f.id,'Pré-preparos')
      returning id,unidade_medida into insumo,unidade;
    end if;
    saida:=public.operacao_converter(p_quantidade,coalesce(f.rendimento_unidade,'un'),unidade);
    perform public.operacao_movimentar(p_unidade_id,estoque,insumo,saida,producao,'Produção #'||producao,validade_final,custo/saida);
    update public.estoque_itens set local_interno=coalesce(p_local,local_interno),ficha_tecnica_id=f.id where estoque_id=estoque and insumo_id=insumo;
  end if;
  return jsonb_build_object('id',producao,'custo_total',custo,'estoqueavel',coalesce(f.estoqueavel,f.eh_base,false));
end $$;

revoke all on function public.operacao_converter(numeric,text,text), public.operacao_custo_insumo(uuid),
  public.operacao_custo_ficha(uuid,uuid[]),public.operacao_consumo_ficha(uuid,numeric,uuid[]),public.operacao_autorizar(text,text,text),
  public.operacao_movimentar(text,uuid,uuid,numeric,uuid,text,date,numeric),
  public.prever_producao_integrada(text,uuid,numeric),public.confirmar_producao_integrada(text,uuid,numeric,uuid,text,date,uuid) from public,anon,authenticated;
grant execute on function public.prever_producao_integrada(text,uuid,numeric),
  public.confirmar_producao_integrada(text,uuid,numeric,uuid,text,date,uuid) to authenticated;
create or replace function public.salvar_plano_producao(p_unidade text,p_setor text,p_data date,p_plano jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.operacao_autorizar(p_unidade,p_setor,'edit');
  if p_data is null or jsonb_typeof(p_plano)<>'object' then raise exception 'Plano inválido'; end if;
  insert into public.memorandos_operacao(unidade_id,data_referencia,cozinha,bar,salao)
    values(p_unidade,p_data,'{}','{}','{}') on conflict(unidade_id,data_referencia) do nothing;
  -- Atualiza somente o setor escolhido: salvar Cozinha não apaga o plano do Bar.
  if p_setor='cozinha' then update public.memorandos_operacao set cozinha=p_plano,updated_at=now() where unidade_id=p_unidade and data_referencia=p_data;
  elsif p_setor='bar' then update public.memorandos_operacao set bar=p_plano,updated_at=now() where unidade_id=p_unidade and data_referencia=p_data;
  else update public.memorandos_operacao set salao=p_plano,updated_at=now() where unidade_id=p_unidade and data_referencia=p_data; end if;
end $$;
revoke all on function public.salvar_plano_producao(text,text,date,jsonb) from public,anon;
grant execute on function public.salvar_plano_producao(text,text,date,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
