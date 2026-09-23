// ══════════════════════════════════════════════════════════════════════════════
// BATERIA DE TESTES AUTOMATIZADOS: MÓDULO DE COMPRAS E RECEBIMENTO DE MERCADORIAS
// ERP HÉFISTO — Validação Operacional Prática
// ══════════════════════════════════════════════════════════════════════════════

import {
  converterQuantidadeParaEmbalagem,
  classificarAcaoItem,
  calcularNecessidadeCompra,
  agruparNecessidadesPorFornecedor,
  validarDivergenciaPreco,
  formatarTextoPedidoWhatsApp
} from "../app/lib/compras-domain.js";

let totalTestes = 0;
let testesPassaram = 0;

function test(nome, fn) {
  totalTestes++;
  try {
    fn();
    testesPassaram++;
    console.log(`  ✅ [PASS] ${nome}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${nome}: ${err.message}`);
  }
}

function assertEqual(atual, esperado, msg = "") {
  if (atual !== esperado) {
    throw new Error(`Esperado: ${esperado}, Recebido: ${atual}. ${msg}`);
  }
}

function assertCloseTo(atual, esperado, delta = 0.001, msg = "") {
  if (Math.abs(atual - esperado) > delta) {
    throw new Error(`Esperado aproximado: ${esperado}, Recebido: ${atual}. ${msg}`);
  }
}

console.log("\n🧪 INICIANDO TESTES DO MÓDULO DE COMPRAS E RECEBIMENTO — HÉFISTO ERP\n");

// ── 1. CONVERSÃO DE UNIDADES DE USO PARA EMBALAGENS DE COMPRA ────────────────
test("1. Conversão de Gramas/Ml para Sacos/Caixas (Arredondamento por Embalagem)", () => {
  // Exemplo: Necessidade de 30.000g de farinha. Cada saco tem 25.000g (25kg). Deve sugerir 2 sacos.
  const res1 = converterQuantidadeParaEmbalagem(30000, 25000);
  assertEqual(res1.quantidadeEmbalagem, 2, "Deveria calcular 2 sacos de 25kg");
  assertEqual(res1.quantidadeTotalBase, 50000, "Total de farinha fornecido pelos 2 sacos");
  assertEqual(res1.sobraBase, 20000, "Sobra no estoque após suprir a necessidade");

  // Exemplo 2: Necessidade de 1.500ml de xarope. Caixa com 6x 1000ml = 6000ml. Deve sugerir 1 caixa.
  const res2 = converterQuantidadeParaEmbalagem(1500, 6000);
  assertEqual(res2.quantidadeEmbalagem, 1, "Deveria calcular 1 caixa de 6L");
});

// ── 2. ISOLAMENTO DA AÇÃO: COMPRAR vs PRODUZIR ────────────────────────────────
test("2. Diferenciação Automática: Insumo Comprado (BUY) vs Subreceita (PRODUCE)", () => {
  const ingredienteComprado = { id: "1", nome: "Tomate Pelado", tipo: "ingrediente" };
  const subreceitaInterna = { id: "2", nome: "Molho Pomodoro Base", tipo: "pre_preparo", tem_ficha: true };

  assertEqual(classificarAcaoItem(ingredienteComprado), "COMPRAR", "Ingrediente comum deve ser COMPRAR");
  assertEqual(classificarAcaoItem(subreceitaInterna), "PRODUZIR", "Pré-preparo deve ser PRODUZIR");
});

// ── 3. CÁLCULO DE NECESSIDADES E REPOSIÇÃO DE ESTOQUE ─────────────────────────
test("3. Cálculo Inteligente de Necessidades de Estoque", () => {
  const insumosFicticios = [
    {
      id: "ins-1",
      nome: "Farinha de Trigo Especial",
      departamento: "cozinha",
      unidade_medida: "g",
      quantidade_atual: 2000,
      estoque_minimo: 10000,
      estoque_maximo: 50000,
      tamanho_embalagem: 25000,
      custo_unitario: 0.004, // R$ 4,00 / kg
      fornecedor_atual_id: "forn-100",
      fornecedor_nome: "Moinho Central",
      tipo: "ingrediente"
    },
    {
      id: "ins-2",
      nome: "Molho de Tomate Rústico",
      departamento: "cozinha",
      unidade_medida: "g",
      quantidade_atual: 500,
      estoque_minimo: 3000,
      estoque_maximo: 10000,
      tamanho_embalagem: 5000,
      custo_unitario: 0.012,
      tipo: "pre_preparo"
    },
    {
      id: "ins-3",
      nome: "Vodka Premium",
      departamento: "bar",
      unidade_medida: "ml",
      quantidade_atual: 5000,
      estoque_minimo: 2000, // Saldo acima do mínimo: NÃO deve entrar na lista
      estoque_maximo: 10000,
      tamanho_embalagem: 1000,
      custo_unitario: 0.05,
      tipo: "ingrediente"
    }
  ];

  const necessidades = calcularNecessidadeCompra(insumosFicticios);
  assertEqual(necessidades.length, 2, "Apenas os 2 insumos abaixo do mínimo devem gerar necessidade");

  const itemFarinha = necessidades.find(i => i.insumo_id === "ins-1");
  assertEqual(itemFarinha.acao, "COMPRAR", "Farinha é ingrediente comprado");
  assertEqual(itemFarinha.quantidade_sugerida_embalagem, 2, "Farinha precisa de 2 sacos de 25kg");

  const itemMolho = necessidades.find(i => i.insumo_id === "ins-2");
  assertEqual(itemMolho.acao, "PRODUZIR", "Molho é subreceita produzida internamente");
});

// ── 4. AGRUPAMENTO DE PEDIDOS POR FORNECEDOR ──────────────────────────────────
test("4. Agrupamento de Itens por Fornecedor Preferencial", () => {
  const necessidades = [
    { insumo_id: "1", nome: "Tomate", fornecedor_id: "f1", fornecedor_nome: "Horta Sul", acao: "COMPRAR", custo_estimado_total: 100 },
    { insumo_id: "2", nome: "Cebola", fornecedor_id: "f1", fornecedor_nome: "Horta Sul", acao: "COMPRAR", custo_estimado_total: 50 },
    { insumo_id: "3", nome: "Vodka", fornecedor_id: "f2", fornecedor_nome: "Distribuidora Bebidas", acao: "COMPRAR", custo_estimado_total: 200 },
    { insumo_id: "4", nome: "Molho Base", fornecedor_id: null, fornecedor_nome: "Cozinha", acao: "PRODUZIR", custo_estimado_total: 30 }
  ];

  const fornecedores = [
    { id: "f1", nome: "Horta Sul", telefone: "11999998888" },
    { id: "f2", nome: "Distribuidora Bebidas", telefone: "11977776666" }
  ];

  const grupos = agruparNecessidadesPorFornecedor(necessidades, fornecedores);
  assertEqual(grupos.length, 2, "Deve gerar exatamente 2 grupos de pedidos de fornecedor");

  const grupoF1 = grupos.find(g => g.fornecedor_id === "f1");
  assertEqual(grupoF1.itens.length, 2, "Fornecedor Horta Sul deve ter 2 itens");
  assertEqual(grupoF1.valor_total_estimado, 150, "Soma estimada Horta Sul deve ser R$ 150,00");
});

// ── 5. VALIDAÇÃO DE DIVERGÊNCIA DE PREÇOS NA CONFERÊNCIA ──────────────────────
test("5. Detecção de Divergência de Preço entre Contratado e Nota Fiscal", () => {
  // Caso 1: Preço dentro do tolerado (+2%)
  const resNormal = validarDivergenciaPreco(100, 102, 5);
  assertEqual(resNormal.divergencia, false, "2% de variação não deve gerar alerta");

  // Caso 2: Preço acima da tolerância (+12%)
  const resAlerta = validarDivergenciaPreco(100, 112, 5);
  assertEqual(resAlerta.divergencia, true, "12% de aumento deve disparar alerta de divergência");
  assertEqual(resAlerta.nivel, "alerta", "Nível de alerta moderado");

  // Caso 3: Desconto (-10%)
  const resDesconto = validarDivergenciaPreco(100, 90, 5);
  assertEqual(resDesconto.divergencia, true, "Desconto de 10% deve ser notificado");
  assertEqual(resDesconto.nivel, "desconto", "Nível de desconto");
});

// ── 6. FORMATADOR DE TEXTO PARA WHATSAPP ───────────────────────────────────────
test("6. Formatação do Pedido de Compra para Envio em Texto via WhatsApp", () => {
  const pedido = { numero_pedido: "PED-991201", fornecedor_nome: "Horta Sul" };
  const itens = [
    { nome: "Tomate", quantidade_pedida_embalagem: 2, tamanho_embalagem: 10, unidade_medida: "kg", preco_unitario_estimado: 50, valor_total_estimado: 100 }
  ];

  const textoEncoded = formatarTextoPedidoWhatsApp(pedido, itens, "HÉFISTO ERP");
  const textoDecodificado = decodeURIComponent(textoEncoded);

  if (!textoDecodificado.includes("PED-991201") || !textoDecodificado.includes("Horta Sul") || !textoDecodificado.includes("Tomate")) {
    throw new Error("Formatação do WhatsApp incompleta ou inválida");
  }
});

// ── RESUMO DOS RESULTADOS ─────────────────────────────────────────────────────
console.log(`\n==================================================`);
console.log(`📊 TESTES CONCLUÍDOS: ${testesPassaram}/${totalTestes} PASSERAM COM SUCESSO!`);
console.log(`==================================================\n`);

if (testesPassaram !== totalTestes) {
  process.exit(1);
}
