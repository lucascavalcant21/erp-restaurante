"use client";

import { useState } from "react";
import { Wand2, ChefHat, Check, AlertCircle, Plus, ArrowRight } from "lucide-react";
import { Modal, Btn, Field, TextInput, NumberInput, Select, SectionLabel, fmtBRL } from "../../../components/ui";
import {
  parseReceita,
  cruzarReceitaComEstoque,
  detectarCategoria,
  CATEGORIAS_ING_FOOD,
  CATEGORIAS_PRATO,
  Ingredientes,
  Pratos,
} from "../../../lib/eventos";

const EXEMPLO = `Bolo de Cenoura com Cobertura de Chocolate

Ingredientes:
- 3 cenouras médias
- 4 ovos
- 2 xícaras (chá) de açúcar
- 1 xícara (chá) de óleo
- 2 1/2 xícaras (chá) de farinha de trigo
- 1 colher (sopa) de fermento em pó
- Sal a gosto

Para a cobertura:
- 200g de chocolate em pó
- 1 xícara de leite
- 3 colheres (sopa) de manteiga

Modo de preparo:
1. Bata as cenouras com óleo e ovos no liquidificador
2. Adicione o açúcar e bata mais 2 minutos
3. Em uma tigela, misture com a farinha e fermento
4. Asse em forno pré-aquecido a 180°C por 40 minutos
5. Para a cobertura: leve ao fogo até engrossar

Rendimento: 12 porções`;

export default function ModalReceita({ open, onClose, eventoId, ingredientesEvento, onSuccess }) {
  const [etapa, setEtapa] = useState("colar"); // 'colar' | 'analisar' | 'cadastrar' | 'criar-prato'
  const [texto, setTexto] = useState("");
  const [receita, setReceita] = useState(null);
  const [ingsCruzados, setIngsCruzados] = useState([]); // com flag existe
  const [salvando, setSalvando] = useState(false);

  // Estado para cadastro dos faltantes
  const [faltantes, setFaltantes] = useState([]); // editáveis

  // Estado para criar o prato
  const [dadosPrato, setDadosPrato] = useState({ nome: "", categoria: "Principal", rendimento: 1, descricao: "" });

  function analisar() {
    const r = parseReceita(texto);
    if (!r || r.ingredientes.length === 0) {
      alert("Não consegui identificar ingredientes. Verifique o formato da receita.");
      return;
    }
    setReceita(r);
    const cruzados = cruzarReceitaComEstoque(r.ingredientes, ingredientesEvento);
    setIngsCruzados(cruzados);
    // Pre-popula nome do prato
    setDadosPrato({
      nome: r.titulo || "",
      categoria: "Principal",
      rendimento: r.rendimento || 1,
      descricao: "",
    });
    setEtapa("analisar");
  }

  function prepararCadastroFaltantes() {
    const faltam = ingsCruzados.filter((i) => !i.existe).map((i, idx) => ({
      _id: idx,
      nome: i.nome,
      categoria: detectarCategoria(i.nome, "food"),
      // Sugere preço/quantidade base (usuário ajusta)
      custo_unit: "",
      peso_unit: i.unidade === "Kg" ? 1 : i.unidade === "L" ? 1 : i.unidade === "ml" ? 750 : 1000,
      unidade: i.unidade === "Kg" || i.unidade === "L" || i.unidade === "g" || i.unidade === "ml" ? i.unidade : "Kg",
      _selecionado: true,
      _qtdUsada: i.qty,
      _unidadeUsada: i.unidade,
    }));
    setFaltantes(faltam);
    setEtapa("cadastrar");
  }

  async function salvarFaltantes() {
    setSalvando(true);
    const novos = {};
    for (const f of faltantes) {
      if (!f._selecionado) continue;
      let unidade = f.unidade;
      let peso = Number(f.peso_unit) || 1;
      if (unidade === "Kg") { unidade = "g"; peso *= 1000; }
      if (unidade === "L")  { unidade = "ml"; peso *= 1000; }
      const { data, error } = await Ingredientes.add(eventoId, {
        tipo: "food",
        nome: f.nome,
        categoria: f.categoria,
        custo_unit: Number(f.custo_unit) || 0,
        peso_unit: peso,
        unidade,
      });
      if (!error && data) novos[f.nome.toLowerCase()] = data;
    }
    setSalvando(false);
    // Atualiza ingsCruzados: marca os que foram criados como existentes
    setIngsCruzados((prev) => prev.map((i) => {
      const novoIng = novos[i.nome.toLowerCase()];
      if (novoIng) return { ...i, existe: true, ingredienteId: novoIng.id, ingredienteCadastrado: novoIng };
      return i;
    }));
    setEtapa("criar-prato");
    onSuccess?.(); // atualiza lista do pai
  }

  async function criarPrato() {
    if (!dadosPrato.nome.trim()) { alert("Informe o nome do prato"); return; }
    setSalvando(true);
    // Monta ingredientes a partir dos cruzados que existem
    const ingredients = ingsCruzados
      .filter((i) => i.existe && i.ingredienteId && !i.aGosto)
      .map((i) => {
        // Converte qty pra unidade base (g/ml) do ingrediente
        let qty = Number(i.qty);
        if (i.unidade === "Kg") qty *= 1000;
        if (i.unidade === "L")  qty *= 1000;
        return { id: i.ingredienteId, qty, type: "food" };
      });
    const { error } = await Pratos.add(eventoId, {
      nome: dadosPrato.nome.trim(),
      categoria: dadosPrato.categoria,
      rendimento: Number(dadosPrato.rendimento) || 1,
      descricao: dadosPrato.descricao || null,
      tags: [],
      ingredients,
    });
    setSalvando(false);
    if (error) { alert("Erro ao criar prato: " + error); return; }
    alert(`✓ Prato "${dadosPrato.nome}" criado com ${ingredients.length} ingredientes!`);
    onSuccess?.();
    fechar();
  }

  function fechar() {
    setEtapa("colar");
    setTexto("");
    setReceita(null);
    setIngsCruzados([]);
    setFaltantes([]);
    onClose();
  }

  const totalIngs = ingsCruzados.length;
  const existemCount = ingsCruzados.filter((i) => i.existe).length;
  const faltamCount = ingsCruzados.filter((i) => !i.existe).length;

  return (
    <Modal open={open} onClose={fechar} title="🪄 Importar Receita da Internet">
      {/* ETAPA 1: COLAR RECEITA */}
      {etapa === "colar" && (
        <>
          <p className="text-[12px] mb-3" style={{ color: "var(--dim)" }}>
            Cole a receita completa (com ingredientes e modo de preparo). O sistema vai detectar tudo e verificar quais ingredientes você já tem cadastrados.
          </p>

          <details style={{ marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent-fg)", fontWeight: 600 }}>
              💡 Ver exemplo de formato suportado
            </summary>
            <div className="mt-2 p-3 rounded text-[10px]" style={{ background: "var(--elevated)", maxHeight: 200, overflowY: "auto" }}>
              <code style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", color: "var(--fg)" }}>{EXEMPLO}</code>
            </div>
          </details>

          <Field label="Cole sua receita">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cole aqui a receita completa... (título, ingredientes, modo de preparo)"
              rows={14}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "var(--elevated)", color: "var(--fg)",
                border: "1px solid var(--line)", fontSize: 12, fontFamily: "monospace",
                resize: "vertical",
              }}
            />
          </Field>

          <div className="flex gap-3">
            <Btn variant="ghost" onClick={() => setTexto(EXEMPLO)}>📋 Usar exemplo</Btn>
            <Btn variant="ghost" onClick={fechar}>Cancelar</Btn>
            <Btn variant="primary" className="flex-1" onClick={analisar} disabled={!texto.trim()}>
              <Wand2 size={14} /> Analisar receita
            </Btn>
          </div>
        </>
      )}

      {/* ETAPA 2: ANÁLISE DA RECEITA */}
      {etapa === "analisar" && receita && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div style={{ padding: 10, background: "var(--elevated)", borderRadius: 6 }}>
              <p className="text-[10px]" style={{ color: "var(--dim)" }}>TOTAL DE INGREDIENTES</p>
              <strong style={{ fontSize: 22, color: "var(--fg)" }}>{totalIngs}</strong>
            </div>
            <div style={{ padding: 10, background: "#10B98122", borderRadius: 6, borderLeft: "3px solid #10B981" }}>
              <p className="text-[10px]" style={{ color: "#10B981" }}>✓ JÁ TENHO</p>
              <strong style={{ fontSize: 22, color: "#10B981" }}>{existemCount}</strong>
            </div>
            <div style={{ padding: 10, background: "#EF444422", borderRadius: 6, borderLeft: "3px solid #EF4444" }}>
              <p className="text-[10px]" style={{ color: "#EF4444" }}>⚠ FALTAM</p>
              <strong style={{ fontSize: 22, color: "#EF4444" }}>{faltamCount}</strong>
            </div>
          </div>

          {receita.titulo && (
            <div className="mb-3 p-2 rounded" style={{ background: "var(--elevated)" }}>
              <p className="text-[10px]" style={{ color: "var(--dim)", textTransform: "uppercase", fontWeight: 700 }}>Título</p>
              <strong style={{ color: "var(--fg)", fontSize: 14 }}>{receita.titulo}</strong>
              {receita.rendimento && <span style={{ color: "var(--dim)", marginLeft: 8, fontSize: 12 }}>· {receita.rendimento} porções</span>}
            </div>
          )}

          <SectionLabel>Ingredientes detectados ({totalIngs})</SectionLabel>
          <div className="space-y-1" style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
            {ingsCruzados.map((ing, idx) => (
              <div key={idx} className="p-2 rounded flex items-start gap-2" style={{
                background: ing.existe ? "#10B98111" : "#EF444411",
                borderLeft: `3px solid ${ing.existe ? "#10B981" : "#EF4444"}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ing.existe
                      ? <Check size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                      : <AlertCircle size={14} style={{ color: "#EF4444", flexShrink: 0 }} />}
                    <strong style={{ color: "var(--fg)", fontSize: 13 }}>{ing.nome}</strong>
                    {ing.aGosto && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, background: "var(--elevated)", color: "var(--muted)" }}>a gosto</span>}
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--dim)" }}>
                    {ing.aGosto ? "Quantidade livre" : `Precisa: ${ing.qty.toFixed(ing.qty < 1 ? 2 : 0)}${ing.unidade}`}
                    {ing.existe && ing.ingredienteCadastrado && (
                      <span style={{ color: "#10B981", marginLeft: 6 }}>
                        ✓ Cadastrado: {ing.ingredienteCadastrado.nome}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {receita.modo_preparo && (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent-fg)", fontWeight: 600 }}>
                📖 Modo de preparo detectado
              </summary>
              <div className="mt-2 p-2 rounded text-[11px] whitespace-pre-wrap" style={{ background: "var(--elevated)", color: "var(--dim)" }}>
                {receita.modo_preparo}
              </div>
            </details>
          )}

          <div className="flex gap-3">
            <Btn variant="ghost" onClick={() => setEtapa("colar")}>← Voltar</Btn>
            {faltamCount > 0 ? (
              <Btn variant="primary" className="flex-1" onClick={prepararCadastroFaltantes}>
                <Plus size={14} /> Cadastrar os {faltamCount} faltantes
              </Btn>
            ) : (
              <Btn variant="primary" className="flex-1" onClick={() => setEtapa("criar-prato")}>
                <ChefHat size={14} /> Criar prato com essa receita
              </Btn>
            )}
          </div>
        </>
      )}

      {/* ETAPA 3: CADASTRAR FALTANTES */}
      {etapa === "cadastrar" && (
        <>
          <p className="text-[12px] mb-3" style={{ color: "var(--dim)" }}>
            Preencha os <strong>preços</strong> e <strong>quantidades</strong> de cada ingrediente faltante.
            O sistema tem boas sugestões mas ajuste conforme o que pagou.
          </p>

          <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 12 }}>
            {faltantes.map((f) => {
              const cat = CATEGORIAS_ING_FOOD.find((c) => c.id === f.categoria);
              return (
                <div key={f._id} className="p-2 rounded mb-2" style={{
                  background: f._selecionado ? "var(--elevated)" : "transparent",
                  border: "1px solid var(--line)",
                }}>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={f._selecionado}
                      onChange={(e) => setFaltantes((prev) => prev.map((p) => p._id === f._id ? { ...p, _selecionado: e.target.checked } : p))} />
                    <strong style={{ flex: 1, color: "var(--fg)", fontSize: 13 }}>{f.nome}</strong>
                    {cat && (
                      <span style={{ padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700, background: cat.cor + "22", color: cat.cor }}>
                        {cat.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] mb-2" style={{ color: "var(--dim)" }}>
                    🎯 Receita pede: <strong style={{ color: "var(--fg)" }}>{f._qtdUsada.toFixed(f._qtdUsada < 1 ? 2 : 0)}{f._unidadeUsada}</strong>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberInput
                      value={f.custo_unit}
                      onChange={(e) => setFaltantes((prev) => prev.map((p) => p._id === f._id ? { ...p, custo_unit: e.target.value } : p))}
                      placeholder="Preço R$"
                      step="0.01"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    />
                    <NumberInput
                      value={f.peso_unit}
                      onChange={(e) => setFaltantes((prev) => prev.map((p) => p._id === f._id ? { ...p, peso_unit: e.target.value } : p))}
                      placeholder="Qtd"
                      step="0.01"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    />
                    <Select
                      value={f.unidade}
                      onChange={(e) => setFaltantes((prev) => prev.map((p) => p._id === f._id ? { ...p, unidade: e.target.value } : p))}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    >
                      <option value="Kg">Kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="un">un</option>
                    </Select>
                  </div>
                  <Select
                    value={f.categoria}
                    onChange={(e) => setFaltantes((prev) => prev.map((p) => p._id === f._id ? { ...p, categoria: e.target.value } : p))}
                    style={{ fontSize: 11, padding: "4px 8px", marginTop: 4, width: "100%" }}
                  >
                    {CATEGORIAS_ING_FOOD.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Btn variant="ghost" onClick={() => setEtapa("analisar")}>← Voltar</Btn>
            <Btn variant="primary" className="flex-1" onClick={salvarFaltantes} disabled={salvando}>
              {salvando ? "Salvando..." : <><Plus size={14} /> Cadastrar e continuar</>}
            </Btn>
          </div>
        </>
      )}

      {/* ETAPA 4: CRIAR PRATO */}
      {etapa === "criar-prato" && (
        <>
          <p className="text-[12px] mb-3" style={{ color: "#10B981" }}>
            ✓ Todos os ingredientes cadastrados! Agora vamos criar o prato com a receita.
          </p>

          <Field label="Nome do prato">
            <TextInput value={dadosPrato.nome}
              onChange={(e) => setDadosPrato({ ...dadosPrato, nome: e.target.value })}
              placeholder="ex: Bolo de Cenoura" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={dadosPrato.categoria}
                onChange={(e) => setDadosPrato({ ...dadosPrato, categoria: e.target.value })}>
                {CATEGORIAS_PRATO.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Rendimento (porções)">
              <NumberInput value={dadosPrato.rendimento}
                onChange={(e) => setDadosPrato({ ...dadosPrato, rendimento: e.target.value })}
                step="1" />
            </Field>
          </div>
          <Field label="Descrição (opcional)">
            <TextInput value={dadosPrato.descricao}
              onChange={(e) => setDadosPrato({ ...dadosPrato, descricao: e.target.value })}
              placeholder="Curto descritivo" />
          </Field>

          <div className="p-2 rounded mb-3" style={{ background: "#10B98122", borderLeft: "3px solid #10B981" }}>
            <p className="text-[11px]" style={{ color: "var(--fg)" }}>
              ✓ <strong>{ingsCruzados.filter((i) => i.existe && !i.aGosto).length}</strong> ingredientes serão adicionados ao prato
            </p>
            {ingsCruzados.filter((i) => i.aGosto).length > 0 && (
              <p className="text-[10px] mt-1" style={{ color: "var(--dim)" }}>
                ({ingsCruzados.filter((i) => i.aGosto).length} ingrediente(s) "a gosto" foram ignorados)
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Btn variant="ghost" onClick={() => setEtapa("analisar")}>← Voltar</Btn>
            <Btn variant="primary" className="flex-1" onClick={criarPrato} disabled={salvando}>
              <ChefHat size={14} /> {salvando ? "Criando..." : "Criar prato"}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
