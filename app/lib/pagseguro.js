// ─────────────────────────────────────────────────────────────────────────────
// INTEGRAÇÃO: PagSeguro API
// ─────────────────────────────────────────────────────────────────────────────
// Módulo preparado para integração com a API do PagSeguro (Geração de PIX)
// Por enquanto, retorna um QR Code simulado em base64.
// Para ativar real:
// 1. Inserir PAGSEGURO_TOKEN e PAGSEGURO_ENV no .env
// 2. Chamar o endpoint /orders da API PagSeguro.
// ─────────────────────────────────────────────────────────────────────────────

export async function gerarQrCodePixPagSeguro(valor, referencia = "PDV_MESA") {
  // Simulando o delay de uma requisição de rede (1.5 segundos)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Simulando sucesso do PagSeguro retornando um QRCode PIX genérico (Base64)
  // Nota: Na versão de produção, isso virá da propriedade qr_codes[0].links[0].href
  
  // Imagem de QRCode mock (uma imagem genérica pequenina apenas para representar)
  const qrCodeImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWAQMAAAAGz+OhAAAABlBMVEX///8AAABVwtN+AAAAj0lEQVRIx2P4//8/A71g8x4FvEBG4s/IyDDYf4aBgYGBgb2f4T8Dw//fDAz/M2hg0L1Pof+fQR2D7gMM/P8ZVDFoP8zQf5BhAMN/BlUM2g8y0P1n0MWg/QAD3X8GXQxaDzDQ/GfQwaD1MAPNfwYtDFoPM9D8Z9DBoP0wA91/Bl0MWg8y0Pxn0MGg9TADzX8GHQxANwAASrS5tS+q/0oAAAAASUVORK5CYII=";
  
  const textPix = "00020101021126580014br.gov.bcb.pix013600000000-0000-0000-0000-000000000000520400005303986540510.005802BR5913PAGSEGURO PDV6009SAO PAULO62070503***6304E2D0";

  return {
    sucesso: true,
    qrCodeImage: qrCodeImageBase64,
    qrCodeText: textPix,
    expiracao: new Date(Date.now() + 15 * 60000).toISOString(), // expira em 15min
  };
}
