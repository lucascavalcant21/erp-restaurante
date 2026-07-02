"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, CheckSquare, Square, Search } from "lucide-react";
import { Modal, Btn, TextInput, SectionLabel, fmtBRL } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchIngredientesERP, fetchPratosERP, fetchDrinksERP,
  importarIngredientes, importarPratos, importarDrinks,
} from "../../../lib/eventos";

/**
 * Modal genérico para importar do cardápio regular para o evento.
 *
 * @param tipo  - 'ingredientes-food' | 'ingredientes-bar' | 'pratos' | 'drinks'
 */
export default function ModalImportar({ open, onClose, tipo, eventoId, existentes, onSuccess }) {
  const { unidadeAtiva } = useERP();
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [busca, setBusca]     = useState("");
  const [importando, setImportando] = useState(false);

  const config = {
    "ingredientes-food": { titulo: "Importar Ingredientes (Cozinha)", subtitulo: "Selecione os ingredientes do ERP para usar no evento" },
    "ingredientes-bar":  { titulo: "Importar Ingredientes (Bar)",     subtitulo: "Selecione bebidas, destilados e xaropes do ERP" },
    "pratos":            { titulo: "Importar Pratos do Cardápio",     subtitulo: "Produtos com Ficha Técnica entram com a receita e os ingredientes completos." },
    "drinks":            { titulo: "Importar Drinks do Cardápio",     subtitulo: "Drinks com Ficha Técnica entram com a receita e os ingredientes completos." },
  }[tipo] || { titulo: "Importar", subtitulo: "" };

  useEffect(() => {
    if (!open) return;
    setSelecionados(new Set());
    setBusca("");
    (async () => {
      setLoading(true);
      let res;
      if (tipo.startsWith("ingredientes")) res = await fetchIngredientesERP(unidadeAtiva);
      else if (tipo === "pratos")          res = await fetchPratosERP(unidadeAtiva);
      else if (tipo === "drinks")          res = await fetchDrinksERP(unidadeAtiva);
      setLista(res?.data || []);
      setLoading(false);
    })();
  }, [open, tipo, unidadeAtiva]);

  // Marca os já importados (não selecionáveis)
  const nomesExistentes = useMemo(
    () => new Set((existentes || []).map((e) => e.nome.toLowerCase())),
    [existentes],
  );

  const filtrados = useMemo(() => lista.filter((item) =>
    item.nome?.toLowerCase().includes(busca.toLowerCase()),
  ), [lista, busca]);

  const disponiveis = filtrados.filter((i) => !nomesExistentes.has(i.nome.toLowerCase()));

  function toggleAll() {
    if (selecionados.size === disponiveis.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(disponiveis.map((d) => d.id)));
    }
  }
  function toggleItem(id) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionados(novo);
  }

  async function importar() {
    if (selecionados.size === 0) return;
    setImportando(true);
    const itens = lista.filter((l) => selecionados.has(l.id));
    let res;
    if (tipo === "ingredientes-food") res = await importarIngredientes(eventoId, itens, "food", existentes);
    else if (tipo === "ingredientes-bar") res = await importarIngredientes(eventoId, itens, "bar", existentes);
    else if (tipo === "pratos") res = await importarPratos(eventoId, itens, existentes);
    else if (tipo === "drinks") res = await importarDrinks(eventoId, itens, existentes);
    setImportando(false);
    if (res?.error) { alert("Erro ao importar: " + res.error); return; }
    onSuccess?.(res.count);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={config.titulo}>
      <p className="text-[12px] mb-3" style={{ color: "var(--dim)" }}>{config.subtitulo}</p>

      <div className="relative mb-3">
        <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--muted)" }} />
        <TextInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." style={{ paddingLeft: 30 }} />
      </div>

      {loading ? (
        <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 20 }}>Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-center" style={{ color: "var(--dim)", padding: 20 }}>
          Nenhum item encontrado no cardápio do restaurante.
          {tipo === "pratos" && <> Cadastre primeiro em <strong>Cozinha → Cardápio</strong>.</>}
          {tipo === "drinks" && <> Cadastre primeiro em <strong>Bar → Cardápio Drinks</strong>.</>}
          {tipo.startsWith("ingredientes") && <> Cadastre primeiro em <strong>Cozinha/Bar → Ingredientes</strong>.</>}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <button onClick={toggleAll} className="text-[11px] flex items-center gap-1" style={{ color: "var(--accent-fg)", background: "transparent", border: "none", cursor: "pointer" }}>
              {selecionados.size === disponiveis.length && disponiveis.length > 0
                ? <><CheckSquare size={12} /> Desmarcar todos</>
                : <><Square size={12} /> Selecionar todos disponíveis</>}
            </button>
            <span className="text-[11px]" style={{ color: "var(--dim)" }}>
              {selecionados.size}/{disponiveis.length} selecionado{selecionados.size !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-1" style={{ maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
            {filtrados.map((item) => {
              const jaExiste = nomesExistentes.has(item.nome.toLowerCase());
              const sel = selecionados.has(item.id);
              return (
                <label key={item.id} className="flex items-center gap-2 p-2 rounded" style={{
                  background: sel ? "var(--elevated)" : "transparent",
                  opacity: jaExiste ? 0.5 : 1,
                  cursor: jaExiste ? "not-allowed" : "pointer",
                }}>
                  <input
                    type="checkbox"
                    checked={sel}
                    disabled={jaExiste}
                    onChange={() => !jaExiste && toggleItem(item.id)}
                  />
                  <div className="flex-1 text-[12px]">
                    <strong style={{ color: "var(--fg)" }}>{item.nome}</strong>
                    {tipo === "pratos" && item.categoria && (
                      <span style={{ color: "var(--dim)", marginLeft: 6, fontSize: 10 }}>· {item.categoria}</span>
                    )}
                    {tipo === "drinks" && item.tipo && (
                      <span style={{ color: "var(--dim)", marginLeft: 6, fontSize: 10 }}>· {item.tipo}</span>
                    )}
                    {tipo.startsWith("ingredientes") && item.preco_compra && (
                      <span style={{ color: "var(--dim)", marginLeft: 6, fontSize: 10 }}>{fmtBRL(item.preco_compra)}/{item.unidade}</span>
                    )}
                    {(tipo === "pratos" || tipo === "drinks") && item.preco_venda && (
                      <span style={{ color: "var(--accent-fg)", marginLeft: 6, fontSize: 10, fontWeight: 600 }}>{fmtBRL(item.preco_venda)}</span>
                    )}
                    {(tipo === "pratos" || tipo === "drinks") && (
                      <span style={{ color: item.ficha_id ? "#10B981" : "#F59E0B", marginLeft: 6, fontSize: 10 }}>
                        {item.ficha_id ? "· com receita" : "· sem ficha técnica"}
                      </span>
                    )}
                    {jaExiste && (
                      <span style={{ color: "#10B981", marginLeft: 6, fontSize: 10 }}>✓ já importado</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}

      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={importar} disabled={importando || selecionados.size === 0}>
          <Download size={14} /> {importando ? "Importando..." : `Importar ${selecionados.size > 0 ? `(${selecionados.size})` : ""}`}
        </Btn>
      </div>
    </Modal>
  );
}
