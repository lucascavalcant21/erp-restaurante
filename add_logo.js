const fs = require('fs');
let c = fs.readFileSync('app/components/EtiquetasRapidas.js', 'utf-8');

// 1. Add logo state
c = c.replace(
  'const [bluetoothNome, setBluetoothNome] = useState("");',
  `const [bluetoothNome, setBluetoothNome] = useState("");\n  const chaveLogo = \`hefisto_etq_logo_\${unidadeAtiva || "sem-unidade"}\`;\n  const [logoEtiqueta, setLogoEtiqueta] = useState("");\n  const [mostrarLogo, setMostrarLogo] = useState(() => { try { return localStorage.getItem("hefisto_etq_logo_on") === "1"; } catch { return false; } });\n  const [erroLogo, setErroLogo] = useState("");\n  const inputLogoRef = useRef(null);\n  useEffect(() => { try { setLogoEtiqueta(localStorage.getItem(chaveLogo) || ""); } catch { setLogoEtiqueta(""); } }, [chaveLogo]);\n  useEffect(() => { try { localStorage.setItem("hefisto_etq_logo_on", mostrarLogo ? "1" : "0"); } catch {} }, [mostrarLogo]);\n  const escolherLogo = (arquivo) => {\n    if (!arquivo) return;\n    setErroLogo("");\n    if (!/^image\\//.test(arquivo.type)) { setErroLogo("Escolha um arquivo de imagem."); return; }\n    const leitor = new FileReader();\n    leitor.onload = (e) => {\n      const img = new Image();\n      img.onload = () => {\n        const canvas = document.createElement("canvas");\n        let w = img.width, h = img.height;\n        if (w > 300) { h = Math.round((h * 300) / w); w = 300; }\n        if (h > 300) { w = Math.round((w * 300) / h); h = 300; }\n        canvas.width = w; canvas.height = h;\n        const ctx = canvas.getContext("2d");\n        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);\n        ctx.drawImage(img, 0, 0, w, h);\n        try {\n          const reduzida = canvas.toDataURL("image/jpeg", 0.7);\n          localStorage.setItem(chaveLogo, reduzida);\n          setLogoEtiqueta(reduzida);\n          setMostrarLogo(true);\n        } catch { setErroLogo("Imagem muito grande."); }\n      };\n      img.onerror = () => setErroLogo("Não consegui ler essa imagem.");\n      img.src = e.target.result;\n    };\n    leitor.onerror = () => setErroLogo("Não consegui ler o arquivo.");\n    leitor.readAsDataURL(arquivo);\n  };\n  const removerLogo = () => {\n    try { localStorage.removeItem(chaveLogo); } catch {}\n    setLogoEtiqueta(""); setMostrarLogo(false); setErroLogo("");\n  };`
);

// 2. Add logoEtiqueta, mostrarLogo to setFila
c = c.replace(
  'setFila(atual => [...atual, { ...item, modeloEtiqueta, tipoEtiqueta, codigo: item.codigo || gerarCodigo() }]);',
  'setFila(atual => [...atual, { ...item, modeloEtiqueta, tipoEtiqueta, logoEtiqueta: mostrarLogo ? logoEtiqueta : "", codigo: item.codigo || gerarCodigo() }]);'
);

// 3. Add UI
const uiBlock = `
                <div className="ux-field">
                  <label>Formato da Etiqueta</label>
                  <div className="ux-segmented">
                    <button className={modeloEtiqueta === "validade" ? "ativo" : ""} onClick={() => setModeloEtiqueta("validade")}>Completa</button>
                    <button className={modeloEtiqueta === "nome" ? "ativo" : ""} onClick={() => setModeloEtiqueta("nome")}>Somente Nome</button>
                    <button className={modeloEtiqueta === "logo" ? "ativo" : ""} onClick={() => setModeloEtiqueta("logo")}>Apenas Imagem/Logo</button>
                  </div>
                </div>

                <div className="ux-field">
                  <label>Imagem / Logo na etiqueta</label>
                  <input ref={inputLogoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { escolherLogo(e.target.files?.[0]); e.target.value = ""; }} />
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px" }}>
                    {logoEtiqueta ? (
                      <>
                        <img src={logoEtiqueta} alt="Logo" style={{ height: "32px", width: "auto", objectFit: "contain", background: "#fff", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                        <button onClick={() => setMostrarLogo(v => !v)} className="ux-btn-pequeno" style={mostrarLogo ? { background: "#059669", color: "#fff" } : { background: "#fff", border: "1px solid #cbd5e1", color: "#475569" }}>{mostrarLogo ? "Visível" : "Oculta"}</button>
                        <button onClick={() => inputLogoRef.current?.click()} className="ux-btn-pequeno" style={{ background: "#fff", border: "1px solid #cbd5e1", color: "#475569" }}>Trocar</button>
                        <button onClick={removerLogo} className="ux-btn-pequeno" style={{ background: "#fff", border: "1px solid #cbd5e1", color: "#ef4444" }}>Remover</button>
                      </>
                    ) : (
                      <button onClick={() => inputLogoRef.current?.click()} className="ux-btn-pequeno" style={{ background: "#fff", border: "1px solid #cbd5e1", color: "#475569" }}>+ Adicionar imagem</button>
                    )}
                  </div>
                  {erroLogo && <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "bold", display: "block", marginTop: "4px" }}>{erroLogo}</span>}
                </div>
`;

c = c.replace(
  '<div className="ux-field">\n                  <label>Conservação</label>',
  uiBlock + '\n                <div className="ux-field">\n                  <label>Conservação</label>'
);

// 4. Update CSS for ux-btn-pequeno
c = c.replace(
  '/* HEADER SIMPLES */',
  '.ux-btn-pequeno { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; }\n  /* HEADER SIMPLES */'
);

fs.writeFileSync('app/components/EtiquetasRapidas.js', c);
console.log('Added logo UI');
