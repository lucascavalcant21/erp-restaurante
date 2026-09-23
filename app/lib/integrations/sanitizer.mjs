/**
 * Sanitizador de Erros e Logs Sensíveis — ERP HÉFISTO
 * 
 * Remove com precisão credenciais, tokens OAuth (Bearer), segredos, cookies,
 * query strings sensíveis e stack traces antes de expor mensagens a usuários ou à UI.
 */

export function sanitizeLastError(rawError) {
  if (!rawError) return null;
  
  let text = typeof rawError === 'object' ? (rawError.message || JSON.stringify(rawError)) : String(rawError);

  // 1. Remover stack traces (linhas contendo "at Function..." ou "at /path/to/file")
  text = text.replace(/(\n|\s)+at\s+[^\n]+/gi, '');

  // 2. Redigir Bearer tokens e Authorization headers
  text = text.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED]');
  text = text.replace(/Authorization:\s*[^\s\n]+/gi, 'Authorization: [REDACTED]');

  // 3. Redigir cookies e headers sensíveis
  text = text.replace(/Cookie:\s*[^\n]+/gi, 'Cookie: [REDACTED]');
  text = text.replace(/Set-Cookie:\s*[^\n]+/gi, 'Set-Cookie: [REDACTED]');

  // 4. Redigir segredos e tokens em query strings e pares chave-valor
  text = text.replace(/(clientSecret|client_secret|accessToken|access_token|refreshToken|refresh_token|secret|password|api_key|apiKey)=[^&\s",}]+/gi, '$1=[REDACTED]');

  // 5. Redigir assinaturas HMAC/JWT em URLs
  text = text.replace(/(code|token|signature|sig)=[^&\s",}]+/gi, '$1=[REDACTED]');

  // 6. Truncar para um tamanho seguro de exibição na UI
  const MAX_LENGTH = 300;
  text = text.trim();
  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH) + '... [TRUNCATED]';
  }

  return text;
}
