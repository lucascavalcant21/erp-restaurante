"use client";

import { useState } from "react";
import { Wand2, Trash2, Check, AlertCircle, ListPlus } from "lucide-react";
import { Modal, Btn, Field, TextInput, NumberInput, Select, SectionLabel, fmtBRL } from "../../../components/ui";
import {
  parseIngredientesLista,
  CATEGORIAS_ING_FOOD, CATEGORIAS_ING_BAR,
  getCategoriaIng, Ingredientes,
} from "../../../lib/eventos";

const EXEMPLO_FOOD = `Picanha 65 reais o Kg
Filé Mignon 95/kg
Arroz - R$ 8,50 / 5kg
Cenoura 4,50 - 1kg
Açúcar 5 - 1kg
Ovos - R$ 12,00 - 12 un
Leite 5,50 - 1L
Manteiga 18 - 200g`;

const EXEMPLO_BAR = `Gin Beefeater 120 - 750ml
Vodka Smirnoff 60 - 1L
Vinho Tinto Suave R$ 35 - 750ml
Tônica 6,50 - 350ml
Xarope de Morango 35 - 1L
Champagne 90 - 750ml
Limão 8 - 1Kg
Hortelã 4 - 100g`;

export default function ModalLote({ open, onClose, eventoId, tipo, ingredientesExistentes, onSuccess }) {
  const [texto, setTexto] = useState("");
  const [parseados, setParseados] = useState([]); // resultado do parser, editável
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const CATEGORIAS = tipo === "bar" ? CATEGORIAS_ING_BAR : CATEGORIAS_ING_FOOD;
  const exemplo = tipo === "bar" ? EXEMPLO_BAR : EXEMPLO_FOOD;
  const titulo = tipo === "bar" ? "Importar Ingredientes do Bar em Lote" : "Importar Ingredientes da Cozinha em Lote";

  function analisar() {
    setErro("");
    const resultado = parseIngredientesLista(texto, tipo);
    if (resultado.length === 0) {
      setErro("Não consegui identificar nenhum ingrediente. Verifique o formato.");
      return;
    }
    // Sinaliza duplicatas
    const nomesExistentes = new Set((ingredientesExistentes || []).map((i) => i.nome.toLowerCase()));
    const comFlag = resultado.map((r, idx) => ({
      ...r,
      _id: idx,
      _duplicado: nomesExistentes.has(r.nome.toLowerCase()),
      _selecionado: !nomesExistentes.has(r.nome.toLowerCase()), // pré-seleciona os novos
    }));
    setParseados(comFlag);
  }

  function atualizarItem(idx, patch) {
    setParseados((prev) => prev.map((p) => p._id === idx ? { ...p, ...patch } : p));
  }
  function removerItem(idx) {
    setParseados((prev) => prev.filter((p) => p._id !== idx));
  }
  function toggleTodos(estado) {
    setParseados((prev) => prev.map((p) => p._duplicado ? p : { ...p, _selecionado: estado }));
  }

  async function salvar() {
    const aSalvar = parseados.filter((p) => p._selecionado && !p._duplicado);
    if (aSalvar.length === 0) return;
    setSalvando(true);
    let sucesso = 0, falha = 0;
    for (const item of aSalvar) {
      // Converte Kg/L pra g/ml na hora de salvar
      let unidade = item.unidade;
      let peso = Number(item.peso_unit);
      if (unidade === "Kg") { unidade = "g";  peso *= 1000; }
      if (unidade === "L")  { unidade = "ml"; peso *= 1000; }
      const { error } = await Ingredientes.add(eventoId, {
        tipo,
        nome: item.nome,
        categoria: item.categoria,
        custo_unit: Number(item.custo_unit),
        peso_unit: peso,
        unidade,
      });
      if (error) falha++;
      else sucesso++;
    }
    setSalvando(false);
    onSuccess?.(sucesso, falha);
    setTexto(""); setParseados([]);
    onClose();
  }

  const selecionadosCount = parseados.filter((p) => p._selecionado && !p._duplicado).length;

  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      {parseados.length === 0 ? (
        <>
          <p className="text-[12px] mb-3" style={{ color: "var(--dim)" }}>
            Cole sua lista de ingredientes (1 por linha). O sistema vai detectar automaticamente <strong>nome</strong>, <strong>preço</strong>, <strong>quantidade</strong>, <strong>unidade</strong> e <strong>categoria</strong>.
          </p>

          <details style={{ marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent-fg)", fontWeight: 600 }}>
              💡 Ver formatos suportados e exemplo
            </summary>
            <div className="mt-2 p-3 rounded text-[11px]" style={{ background: "var(--elevated)" }}>
              <p style={{ color: "var(--muted)", marginBottom: 6 }}><strong>Exemplos válidos:</strong></p>
              <code style={{ whiteSpace: "pre-wrap", display: "block", fontFamily: "monospace", color: "var(--fg)" }}>{exemplo}</code>
              <p className="mt-2" style={{ color: "var(--dim)" }}>
                Reconhece: R$ ou número solto · Kg/g/L/ml/un · barras (/) e hífens · "reais", "por", "o", "a"
              </p>
            </div>
          </details>

          <Field label={`Cole sua lista (${tipo === "bar" ? "bar" : "cozinha"})`}>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Cole linha por linha...\n\n${exemplo.split("\n").slice(0, 3).join("\n")}\n...`}
              rows={10}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "var(--elevated)", color: "var(--fg)",
                border: "1px solid var(--line)", fontSize: 12, fontFamily: "monospace",
                resize: "vertical",
              }}
            />
          </Field>

          {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}

          <div className="flex gap-3">
            <Btn variant="ghost" className="flex-1" onClick={() => { setTexto(exemplo); }}>📋 Usar exemplo</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" className="flex-1" onClick={analisar} disabled={!texto.trim()}>
              <Wand2 size={14} /> Analisar lista
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[12px]" style={{ color: "var(--dim)" }}>
              {parseados.length} item{parseados.length !== 1 ? "s" : ""} identificado{parseados.length !== 1 ? "s" : ""}.
              Revise e edite o que precisar antes de salvar.
            </p>
            <div className="flex gap-1">
              <button onClick={() => toggleTodos(true)}  style={{ background: "var(--elevated)", padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, color: "var(--muted)" }}>✓ Marcar todos</button>
              <button onClick={() => toggleTodos(false)} style={{ background: "var(--elevated)", padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, color: "var(--muted)" }}>✗ Desmarcar</button>
            </div>
          </div>

          <div style={{ maxHeight: 440, overflowY: "auto", marginBottom: 12 }}>
            {parseados.map((item) => {
              const cat = getCategoriaIng(item.categoria, tipo);
              return (
                <div key={item._id} className="p-2 rounded mb-2" style={{
                  background: item._duplicado ? "#EF444411" : (item._selecionado ? "var(--elevated)" : "transparent"),
                  border: item._duplicado ? "1px solid #EF444433" : "1px solid var(--line)",
                  opacity: item._duplicado ? 0.7 : 1,
                }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <input
                      type="checkbox"
                      checked={item._selecionado && !item._duplicado}
                      disabled={item._duplicado}
                      onChange={(e) => atualizarItem(item._id, { _selecionado: e.target.checked })}
                    />
                    <strong style={{ flex: 1, color: "var(--fg)", fontSize: 13 }}>{item.nome}</strong>
                    {cat && (
                      <span style={{ padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700, background: cat.cor + "22", color: cat.cor }}>
                        {cat.label}
                      </span>
                    )}
                    {item._duplicado && (
                      <span style={{ padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700, background: "#EF444433", color: "#EF4444" }}>
                        ⚠ já cadastrado
                      </span>
                    )}
                    <button onClick={() => removerItem(item._id)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }} title="Remover">
                      <Trash2 size={12} style={{ color: "var(--muted)" }} />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <TextInput
                      value={item.nome}
                      onChange={(e) => atualizarItem(item._id, { nome: e.target.value })}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      placeholder="Nome"
                    />
                    <NumberInput
                      value={item.custo_unit}
                      onChange={(e) => atualizarItem(item._id, { custo_unit: parseFloat(String(e.target.value).replace(",", ".")) || 0 })}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      step="0.01"
                      placeholder="Preço"
                    />
                    <NumberInput
                      value={item.peso_unit}
                      onChange={(e) => atualizarItem(item._id, { peso_unit: parseFloat(String(e.target.value).replace(",", ".")) || 0 })}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      step="0.01"
                      placeholder="Qtd"
                    />
                    <Select
                      value={item.unidade}
                      onChange={(e) => atualizarItem(item._id, { unidade: e.target.value })}
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
                    value={item.categoria}
                    onChange={(e) => atualizarItem(item._id, { categoria: e.target.value })}
                    style={{ fontSize: 11, padding: "4px 8px", marginTop: 6, width: "100%" }}
                  >
                    {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>

                  <p className="text-[10px] mt-1" style={{ color: "var(--dim)" }}>
                    💰 {fmtBRL(item.custo_unit)} / {item.peso_unit}{item.unidade}
                    {item.peso_unit > 0 && (
                      <> · <strong style={{ color: "var(--accent-fg)" }}>
                        {fmtBRL(item.custo_unit / item.peso_unit)}/{item.unidade}
                      </strong></>
                    )}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Btn variant="ghost" onClick={() => { setParseados([]); setTexto(""); }}>← Voltar</Btn>
            <Btn variant="primary" className="flex-1" onClick={salvar} disabled={salvando || selecionadosCount === 0}>
              <Check size={14} />
              {salvando ? "Salvando..." : `Salvar ${selecionadosCount > 0 ? `(${selecionadosCount})` : ""}`}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
