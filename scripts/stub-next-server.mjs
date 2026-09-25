// `next/server` não resolve em Node puro (o mapa de exports do pacote só
// funciona dentro do build do Next). Este hook o substitui por um NextResponse
// mínimo, suficiente para os handlers rodarem fora do framework.
//
// Só o que as rotas usam: `new NextResponse(corpo, init)` e
// `NextResponse.json(objeto, init)`. Ambos viram Response da plataforma, então
// `status` e `headers` são os de verdade.
export function resolve(especificador, contexto, proximo) {
  if (especificador === "next/server") {
    return { url: "stub:next/server", shortCircuit: true };
  }
  return proximo(especificador, contexto);
}

export function load(url, contexto, proximo) {
  if (url === "stub:next/server") {
    return {
      format: "module",
      shortCircuit: true,
      source: `
        export class NextResponse extends Response {
          static json(corpo, init) {
            return new Response(JSON.stringify(corpo), {
              ...init,
              headers: { "content-type": "application/json", ...(init?.headers || {}) },
            });
          }
        }
        export default { NextResponse };
      `,
    };
  }
  return proximo(url, contexto);
}
