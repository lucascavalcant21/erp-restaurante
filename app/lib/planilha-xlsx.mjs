// Leitor de planilha .xlsx sem dependência externa (21/11/2026): o .xlsx é um
// zip com XML. Lê o diretório do zip, descompacta com DecompressionStream
// ("deflate-raw", nativo do navegador e do Node 18+) e devolve as linhas da
// primeira aba como arrays de texto/número. Só leitura; fórmulas valem pelo
// último valor salvo na planilha.

async function inflar(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const out = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Arquivos do zip: Map nome → Uint8Array (só os pedidos em `quais`). */
export async function lerZip(buffer, quais = () => true) {
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let fim = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("Arquivo não é um .xlsx válido.");
  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const dec = new TextDecoder();
  const arquivos = new Map();
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Zip corrompido.");
    const metodo = dv.getUint16(p + 10, true);
    const tamComp = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
    p += 46 + nLen + xLen + cLen;
    if (!quais(nome)) continue;
    const lnLen = dv.getUint16(local + 26, true), lxLen = dv.getUint16(local + 28, true);
    const ini = local + 30 + lnLen + lxLen;
    const dados = u8.subarray(ini, ini + tamComp);
    if (metodo === 0) arquivos.set(nome, dados);
    else if (metodo === 8) arquivos.set(nome, await inflar(dados));
    else throw new Error("Compressão do .xlsx não suportada.");
  }
  return arquivos;
}

const desescapar = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const colunaDe = (ref) => { let n = 0; for (const ch of ref.replace(/[0-9]/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

/** Linhas da primeira aba do .xlsx. */
export async function lerXlsx(buffer) {
  const arqs = await lerZip(buffer, (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const dec = new TextDecoder();
  const texto = (n) => (arqs.has(n) ? dec.decode(arqs.get(n)) : "");
  const compartilhadas = [...texto("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => desescapar([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  // primeira aba pela ordem do workbook
  let alvo = "xl/worksheets/sheet1.xml";
  const rid = texto("xl/workbook.xml").match(/<sheet [^>]*r:id="([^"]+)"/)?.[1];
  if (rid) {
    const destino = texto("xl/_rels/workbook.xml.rels").match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`));
    const t = destino?.[1] || destino?.[2];
    if (t) alvo = `xl/${t.replace(/^\/?xl\//, "")}`;
  }
  if (!arqs.has(alvo)) alvo = [...arqs.keys()].find((n) => /worksheets\/sheet\d+\.xml$/.test(n));
  if (!alvo) throw new Error("Planilha sem abas.");
  const linhas = [];
  for (const m of texto(alvo).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const linha = [];
    for (const c of m[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      const tipo = attrs.match(/t="([^"]+)"/)?.[1];
      const corpo = c[2] || "";
      const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor = "";
      if (tipo === "s" && v != null) valor = compartilhadas[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = desescapar([...corpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
      else if (tipo === "str" || tipo === "e") valor = v != null ? desescapar(v) : "";
      else if (tipo === "b") valor = v === "1" ? "VERDADEIRO" : "FALSO";
      else if (v != null) valor = Number(v);
      const col = ref ? colunaDe(ref) : linha.length;
      while (linha.length < col) linha.push("");
      linha[col] = valor;
    }
    if (linha.some((x) => String(x).trim() !== "")) linhas.push(linha);
  }
  return linhas;
}
