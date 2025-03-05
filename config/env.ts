// Archivo de configuración central sin depender de @env

export const ENV = {
  SOCKET_SERVER: {
    URL: 'http://192.168.2.194:3000',  // Hard-coded por ahora
    RECONNECT_ATTEMPTS: 5,
    TIMEOUT_MS: 20000
  },
  APP: {
    VERSION: '1.0.0',
    ENV: __DEV__ ? 'development' : 'production'
  }
};

export const isDev = (): boolean => {
  return ENV.APP.ENV === 'development';
};
