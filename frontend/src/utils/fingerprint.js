import fpPromise from '@fingerprintjs/fingerprintjs';

// Inicializar la librería (es asíncrona)
const getFingerprint = async () => {
  const fp = await fpPromise.load();
  const result = await fp.get();
  // Este visitorId es el código único de este dispositivo (ej. "a7b8c9d0...")
  return result.visitorId;
};

export default getFingerprint;
