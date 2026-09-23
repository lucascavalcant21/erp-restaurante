import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.INTEGRATION_MASTER_KEY || '';

/**
 * Criptografa credenciais sensíveis em repouso (clientSecret, refreshToken, accessToken).
 * Se a chave máster de cofre (INTEGRATION_MASTER_KEY) não estiver configurada no ambiente,
 * retorna a credencial marcada como 'PENDING_SECURE_STORAGE' impedindo vazamento de plaintext.
 */
export function encryptCredentials(credentialsObj) {
  if (!credentialsObj || typeof credentialsObj !== 'object') {
    return {};
  }

  if (!MASTER_KEY) {
    // Se não houver chave de criptografia configurada no ambiente server-side,
    // preservamos apenas clientId e marcamos credenciais sensíveis como PENDING_SECURE_STORAGE
    return {
      clientId: credentialsObj.clientId || null,
      clientSecret: credentialsObj.clientSecret ? 'PENDING_SECURE_STORAGE' : null,
      refreshToken: credentialsObj.refreshToken ? 'PENDING_SECURE_STORAGE' : null,
      accessToken: credentialsObj.accessToken ? 'PENDING_SECURE_STORAGE' : null,
      expiresAt: credentialsObj.expiresAt || null,
      isEncrypted: false,
      secureStorageState: 'PENDING_SECURE_STORAGE',
    };
  }

  try {
    const key = crypto.createHash('sha256').update(MASTER_KEY).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const plaintext = JSON.stringify(credentialsObj);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag,
      isEncrypted: true,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Crypto Vault] Erro ao criptografar credenciais:', err.message);
    return { error: 'CRYPTO_FAILURE', isEncrypted: false };
  }
}

/**
 * Descriptografa o envelope de credenciais mantido no cofre server-side.
 */
export function decryptCredentials(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;

  if (!envelope.isEncrypted || !envelope.encryptedData) {
    // Retorna o envelope de metadados não sensíveis (ex: clientId)
    return envelope;
  }

  if (!MASTER_KEY) {
    throw new Error("Não é possível descriptografar credenciais: INTEGRATION_MASTER_KEY não configurada no servidor.");
  }

  try {
    const key = crypto.createHash('sha256').update(MASTER_KEY).digest();
    const iv = Buffer.from(envelope.iv, 'hex');
    const authTag = Buffer.from(envelope.authTag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(envelope.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[Crypto Vault] Erro ao descriptografar credenciais:', err.message);
    throw new Error(`Falha de chave no cofre de integrações: ${err.message}`);
  }
}
