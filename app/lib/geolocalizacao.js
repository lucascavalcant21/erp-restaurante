/**
 * Módulo de Geolocalização e Geofencing para Validação de Ponto de Funcionários.
 *
 * Utiliza a Fórmula de Haversine para calcular a distância geodésica em metros
 * entre as coordenadas do restaurante e do funcionário.
 */

/**
 * Calcula a distância em metros entre dois pontos de GPS (latitude/longitude).
 */
export function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (Number.isNaN(nLat1) || Number.isNaN(nLon1) || Number.isNaN(nLat2) || Number.isNaN(nLon2)) return null;

  const R = 6371000; // Raio da Terra em metros
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Obtém a posição GPS atual do navegador/celular via HTML5 Geolocation API.
 * @returns {Promise<{ latitude: number, longitude: number, precisao: number }>}
 */
export function capturarGPSAtual(opcoes = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator?.geolocation) {
      return reject(new Error("Geolocalização por GPS não é suportada por este dispositivo."));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy || 0),
        });
      },
      (err) => {
        let msg = "Não foi possível obter sua localização por GPS.";
        if (err.code === 1) msg = "Permissão de localização negada pelo navegador. Ative o GPS para bater o ponto.";
        else if (err.code === 2) msg = "Sinal de GPS indisponível no momento. Certifique-se de estar com a localização ativada.";
        else if (err.code === 3) msg = "Tempo limite para ler o GPS esgotado. Tente novamente.";
        reject(new Error(msg));
      },
      opcoes
    );
  });
}

/**
 * Valida se a localização do funcionário está dentro do raio permitido do restaurante.
 *
 * @param {Object} coordsFuncionario - { latitude, longitude }
 * @param {Object} restaurante - { latitude, longitude, raio_permitido_m }
 */
export function validarGeofencePonto(coordsFuncionario, restaurante) {
  const latRest = Number(restaurante?.latitude);
  const lonRest = Number(restaurante?.longitude);
  const raioPermitido = Number(restaurante?.raio_permitido_m || restaurante?.raio_ponto_m) || 100;

  if (!latRest || !lonRest) {
    return {
      valido: true,
      distanciaMetros: 0,
      raioPermitido,
      semGeofenceConfigurado: true,
      mensagem: "Localização GPS do restaurante ainda não configurada em Lojas.",
    };
  }

  const distancia = calcularDistanciaMetros(
    coordsFuncionario.latitude,
    coordsFuncionario.longitude,
    latRest,
    lonRest
  );

  const dentroDoRaio = distancia !== null && distancia <= raioPermitido;

  return {
    valido: dentroDoRaio,
    distanciaMetros: distancia,
    raioPermitido,
    semGeofenceConfigurado: false,
    mensagem: dentroDoRaio
      ? `GPS Validado: Você está a ${distancia}m do restaurante (Permitido até ${raioPermitido}m).`
      : `⚠️ Bloqueado: Você está a ${distancia}m do restaurante. O ponto só pode ser batido no restaurante (máximo ${raioPermitido}m).`,
  };
}

/**
 * Gera um link direto do Google Maps para a coordenada.
 */
export function linkGoogleMaps(latitude, longitude) {
  if (!latitude || !longitude) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
