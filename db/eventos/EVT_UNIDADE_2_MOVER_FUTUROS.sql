/* EVT-UNIDADE-2: leva os 3 eventos futuros do Restaurante para Eventos
   (06/11/2026, aprovado pelo dono).

   Muda só eventos.unidade_id. Nenhum deles tem cardápio, equipe, compras, reservas
   ou conta ligada. Reverter: voltar os ids abaixo para 'seldeestrela'. */

do $$
declare v_ids constant uuid[] := array['263dafe4-529f-4cbf-aa9d-76ab31f386f3','4345a33d-85c2-4a08-86b6-552178f1323f','6f1986e5-56a8-4a9d-a12a-8817f77ada56']::uuid[];
  v_n int;
begin
  update public.eventos set unidade_id = 'eventos' where id = any(v_ids) and unidade_id = 'seldeestrela';
  get diagnostics v_n = row_count;
  if v_n <> 3 then raise exception 'EVT-UNIDADE-2: esperava 3 eventos, achou %.', v_n; end if;
end $$;
