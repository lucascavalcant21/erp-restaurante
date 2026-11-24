import test from "node:test";
import assert from "node:assert/strict";
import { htmlDosGuias } from "./guia-impresso.mjs";

const guia = {
  nome: "Frango <script>alert(1)</script>", codigo: "M01", foto: "javascript:alert(1)", descricao: "Com batata",
  peso: "450 g", componentes: [{ nome: "Arroz branco", quantidade: "200 g" }], embalagens: [{ nome: "Pote 750", quantidade: 1 }],
  etapas: [{ rotulo: "Montagem", itens: [{ titulo: "Arroz", texto: "No fundo\nespalhado", minutos: "", graus: "", foto: "https://x.supabase.co/a.jpg" }] }],
  faltando: [],
};

test("escapa texto do cadastro e recusa foto que não é https", () => {
  const h = htmlDosGuias([guia]);
  assert.ok(!h.includes("<script>alert"));
  assert.ok(h.includes("&lt;script&gt;"));
  assert.ok(!h.includes("javascript:"));
  assert.ok(h.includes('src="https://x.supabase.co/a.jpg"'));
  assert.ok(h.includes("No fundo<br>espalhado"));
  assert.ok(h.includes("200 g") && h.includes("Pote 750"));
});

test("uma folha por marmita e aviso do que falta", () => {
  const h = htmlDosGuias([guia, { ...guia, nome: "Carne", componentes: [], etapas: [], faltando: ["a ficha técnica (o que vai e quanto)"] }]);
  assert.equal((h.match(/class="folha"/g) || []).length, 2);
  assert.ok(h.includes("Falta cadastrar: a ficha técnica"));
  assert.ok(htmlDosGuias([]).includes("Nenhuma marmita"));
});
