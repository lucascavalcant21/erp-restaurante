const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function find10730() {
  const { data: insumos } = await supabase.from("insumos").select("*");
  const { data: saldosLegados } = await supabase.from("estoque_atual").select("*");

  const mapaSaldos = new Map((saldosLegados || []).map(s => [s.insumo_id, Number(s.quantidade_atual) || 0]));

  console.log("=== INSUMOS COM SALDO OU VALOR TOTAL > 0 ===");
  insumos.forEach(i => {
    const qtd = mapaSaldos.get(i.id) || 0;
    const custoUnit = Number(i.custo_unitario) || 0;
    const custoCompra = Number(i.custo_compra) || 0;
    const tamEmb = Number(i.tamanho_embalagem) || 1;

    // Se é fracionado (ml/g), como o valor total é calculado no frontend?
    // Em fracionado: no frontend `quantidade_atual` é o total de ml/g ou unidades?
    const valorComCustoUnit = qtd * custoUnit;
    const valorComCustoCompra = (qtd / (tamEmb || 1)) * custoCompra;

    if (qtd > 0 || custoUnit > 0 || custoCompra > 0) {
      console.log(`[${i.departamento || 'sem dept'}] ${i.nome}: QtdAtual=${qtd}, CustoUnit=${custoUnit}, CustoCompra=${custoCompra}, TamEmb=${tamEmb} => ValorUnit=${valorComCustoUnit.toFixed(2)}, ValorCompra=${valorComCustoCompra.toFixed(2)}`);
    }
  });
}

find10730();
