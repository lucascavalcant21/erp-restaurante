/* CORREÇÃO aplicada em produção em 07/10/2026 (registro).

   O insumo "Açúcar" 9cd765d1-3e70-4dcf-b8a0-8f72e18e57b9 (5 kg, R$ 16,50,
   usado em 9 fichas) foi criado em 29/08 com departamento = 'ambos' (texto),
   valor que nenhuma tela reconhece: ele não aparecia na lista da cozinha nem
   na do bar. Passa para o formato de db/INSUMOS_COZINHA_E_BAR.sql:
   departamento principal 'cozinha' + departamentos {cozinha,bar}.
   Não apaga nada; as 9 fichas continuam ligadas ao mesmo id. */
update public.insumos
   set departamento = 'cozinha', departamentos = array['cozinha','bar']
 where id = '9cd765d1-3e70-4dcf-b8a0-8f72e18e57b9' and departamento = 'ambos' and departamentos is null;
