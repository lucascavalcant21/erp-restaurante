export function calcularTotaisPDV(itens = [], ajustes = {}) {
  const subtotal = (itens || []).reduce((total, item) => (
    total + (Number(item?.preco || item?.preco_venda || 0) * Number(item?.quantidade || 0))
  ), 0);
  const desconto = Math.min(Math.max(0, Number(ajustes.desconto) || 0), subtotal);
  const acrescimo = Math.max(0, Number(ajustes.acrescimo) || 0);
  const base = Math.max(0, subtotal - desconto + acrescimo);
  const taxaPercentual = Math.max(0, Number(ajustes.taxaPercentual) || 0);
  const taxa = base * taxaPercentual / 100;
  return { subtotal, desconto, acrescimo, taxaPercentual, taxa, total: Math.max(0, base + taxa) };
}

export function separarItensPorSetor(itens = []) {
  return (itens || []).reduce((grupos, item) => {
    const setor = String(item?.departamento || "").toLowerCase();
    if (setor === "cozinha" || setor === "bar") grupos[setor].push(item);
    else grupos.semSetor.push(item);
    return grupos;
  }, { cozinha: [], bar: [], semSetor: [] });
}

export function formatarTempoMesa(minutos) {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  if (total >= 1440) return `${Math.floor(total / 1440)}d ${Math.floor((total % 1440) / 60)}h`;
  if (total >= 60) return `${Math.floor(total / 60)}h ${total % 60}min`;
  return `${total} min`;
}
