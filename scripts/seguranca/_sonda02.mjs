import { PGlite, SQL, relatorio, como } from "./banco-teste.mjs";
const db = new PGlite();
for (const passo of ["base", "rbac", "dados", "etapa1", "etapa2", "etapa3", "m01", "m02", "m03", "m04", "r04", "m04", "m02"]) {
  try {
    const r = await db.exec(SQL[passo]);
    if (/^m0[34]$|^r04$/.test(passo)) for (const l of relatorio(r)) console.log(`${passo} ${l.etapa ?? ""} | ${l.verificacao ?? ""} | ${l.situacao ?? l.resultado ?? ""} | ${String(l.detalhe ?? "").slice(0, 200)}`);
    else console.log("ok", passo);
  } catch (e) { console.log("ERRO em", passo, ":", String(e.message).slice(0, 500)); break; }
}
const q = await como(db, "quiosqueA", "select public.ponto_quiosque_equipe('unidade-a') e");
console.log("equipe:", q.ok ? JSON.stringify(q.linhas[0].e) : q.erro);
