const fs = require('fs');
let c = fs.readFileSync('app/components/EtiquetasRapidas.js', 'utf-8');

const replaceEtiquetaPapel = `
function EtiquetaPapel({ item, responsavel, unidadeInfo, momento, tamanho = "60x40", tipoEtiqueta }) {
  const dim = TAMANHOS[tamanho] || TAMANHOS["60x40"];

  if (item.modeloEtiqueta === "logo" && item.logoEtiqueta) {
    return (
      <div className="etiqueta-rapida-papel etiqueta-somente-logo" style={{ width: \`\${dim.w}mm\`, height: \`\${dim.h}mm\`, padding: "2mm", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxSizing: "border-box" }}>
        <img src={item.logoEtiqueta} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      </div>
    );
  }

  if (item.modeloEtiqueta === "nome") {
    const nomes = [item.nome, item.nome2].map(n => String(n || "").trim()).filter(Boolean);
    const maior = nomes.reduce((m, n) => Math.max(m, n.length), 0);
    const base = maior > 32 ? dim.titulo * 1.45 : maior > 20 ? dim.titulo * 1.7 : dim.titulo * 2.15;
    const escala = Math.min(2, Math.max(0.5, Number(item.escalaNome) || 1));
    const tamanhoNome = (nomes.length > 1 ? base * 0.62 : base) * escala;
    return <div className="etiqueta-rapida-papel etiqueta-somente-nome" style={{ width: \`\${dim.w}mm\`, height: \`\${dim.h}mm\`, padding: \`\${dim.pad + 1}mm\`, background: "#fff", color: "#000", fontFamily: "Arial,Helvetica,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: nomes.length > 1 ? "1.2mm" : 0 }}>
        {item.logoEtiqueta && <img src={item.logoEtiqueta} alt="" style={{ maxHeight: "8mm", maxWidth: "60%", objectFit: "contain", margin: "0 auto 1.5mm auto" }} />}
        {nomes.map((nome, i) => (
          <div key={i} style={{ fontSize: \`\${tamanhoNome}mm\`, lineHeight: 1.05, fontWeight: 950, textAlign: "center", textTransform: "uppercase", overflowWrap: "anywhere" }}>{nome}</div>
        ))}
      </div>
    </div>;
  }

  const validade = validadeDe(momento, item.dias);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const labelTipo = tipoEtiqueta === "aberto" ? "MANIPULADO" : "FECHADO";
  const labelManip = tipoEtiqueta === "aberto" ? "MANIPULAÇÃO:" : "ETIQUETADO:";

  return (
    <div className="etiqueta-rapida-papel" style={{
      width: \`\${dim.w}mm\`,
      height: \`\${dim.h}mm\`,
      padding: "0.8mm 1.5mm 0.8mm 1.5mm",
      background: "#fff",
      color: "#000",
      fontFamily: "Arial, Helvetica, sans-serif",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      overflow: "hidden",
      boxSizing: "border-box",
      position: "relative"
    }}>
      {/* NOME / PRODUTO */}
      <div style={{ textAlign: "center" }}>
        {item.logoEtiqueta && <img src={item.logoEtiqueta} alt="" style={{ maxHeight: "4mm", maxWidth: "40%", objectFit: "contain", margin: "0 auto 1mm auto" }} />}
        <div style={{ fontSize: \`\${dim.titulo}mm\`, fontWeight: 950, lineHeight: 1.05, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nome}</div>
`;

c = c.replace(
  /function EtiquetaPapel\(\{ item, responsavel, unidadeInfo, momento, tamanho = "60x40", tipoEtiqueta \}\) \{[\s\S]*?\{item\.nome\}<\/div>/m,
  replaceEtiquetaPapel
);

fs.writeFileSync('app/components/EtiquetasRapidas.js', c);
console.log('Fixed EtiquetaPapel logo render');
