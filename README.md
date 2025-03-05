# Portero DTI

## Descripción

Portero DTI es una aplicación de comunicación en tiempo real desarrollada con React Native y Expo, diseñada para facilitar la comunicación entre porteros y departamentos en edificios o instituciones. La aplicación utiliza WebRTC para realizar videollamadas y Socket.IO para la señalización y comunicación en tiempo real.

![Portero DTI App](/assets/icon.png)

## Características principales

- **Sistema de roles**: Permite identificarse como Portero o como un departamento específico
- **Notificaciones en tiempo real**: Sistema de alertas cuando el portero busca contactar a un departamento
- **Videollamadas**: Comunicación audiovisual mediante WebRTC
- **Interfaz intuitiva**: Diseño simple y accesible para ambos tipos de usuarios
- **Registro de actividad**: Log en tiempo real para los departamentos

## Tecnologías utilizadas

- **React Native**: Framework para desarrollo móvil multiplataforma
- **Expo**: Plataforma para simplificar el desarrollo React Native
- **WebRTC**: API para comunicación en tiempo real (videollamadas)
- **Socket.IO**: Biblioteca para comunicación bidireccional en tiempo real
- **TypeScript**: Tipado estático para mejorar el desarrollo y prevenir errores

## Requisitos previos

- Node.js (versión 14 o superior)
- npm o yarn
- Expo CLI
- Android Studio (para emulador Android) o Xcode (para emulador iOS)

## Instalación

1. Clona el repositorio:
   ```bash
   git clone https://your-repository-url/porteroDti.git
   cd porteroDti
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. **IMPORTANTE**: Configuración del servidor Socket.IO y WebRTC
   - La aplicación requiere actualizar las direcciones IP en varios archivos para funcionar en tu red local
   - Ver la sección "Configuración de IP Local" más abajo

## Configuración de IP Local

### ⚠️ IMPORTANTE: La aplicación no funcionará correctamente sin actualizar las IP's

La aplicación utiliza comunicación en tiempo real entre dispositivos en la misma red local. Para que esto funcione, debes actualizar las referencias a la dirección IP local en estos archivos:

1. **services/socketService.ts**:
   ```typescript
   // Cambiar 'localhost' o '192.168.x.x' por tu dirección IP local
   const SOCKET_URL = 'http://TU_IP_LOCAL:3000';
   ```

2. **services/webrtcService.ts** (si existe):
   ```typescript
   // Actualizar cualquier referencia a localhost o IP con tu IP local
   const configuration = { ... };
   ```

3. **Verifica también** cualquier otro archivo que pueda tener referencias IP hardcodeadas:
   - components/VideoCall.tsx
   - screens/CallScreen.tsx
   - screens/HomeScreen.tsx

### Cómo encontrar tu dirección IP local:

- **Windows**: Abre CMD y escribe `ipconfig`
- **Mac/Linux**: Abre Terminal y escribe `ifconfig` o `ip addr`
- **Desde el servidor**: Al iniciar el servidor, mostrará automáticamente la IP local en la consola

## Ejecución del servidor

El servidor de señalización debe ejecutarse para que la aplicación funcione:

1. Navega al directorio del servidor:
   ```bash
   cd server
   ```

2. Inicia el servidor:
   ```bash
   node server.js
   ```

3. El servidor mostrará mensajes como:
   ```
   Servidor Portero DTI escuchando en el puerto 3000
   Accesible localmente en: http://192.168.x.x:3000
   ```

4. **Usa esta IP** para actualizar los archivos de configuración mencionados anteriormente

## Ejecución de la aplicación

### Desarrollo con WebRTC

WebRTC requiere acceso a APIs nativas que no están disponibles en Expo Go. Para desarrollo completo con WebRTC:

1. Crea un development build:
   ```bash
   eas build --profile development --platform android
   ```

2. Instala el build en tu dispositivo/emulador:
   ```bash
   eas build:run
   ```

3. Inicia el servidor de desarrollo:
   ```bash
   npm run start
   ```

### Desarrollo con mock WebRTC (solo interfaz)

Para trabajar en la interfaz sin necesidad de WebRTC real:

1. Inicia Expo Go:
   ```bash
   npx expo start
   ```

2. La aplicación usará automáticamente un mock de WebRTC para continuar el desarrollo de la interfaz.

## Pruebas en múltiples dispositivos

Para probar la aplicación completa:

1. Asegúrate de que todos los dispositivos estén conectados a la misma red WiFi
2. El servidor debe estar ejecutándose en una máquina dentro de la misma red
3. Todos los dispositivos deben usar la misma IP del servidor en su configuración
4. Ejecuta la aplicación en modo desarrollo en cada dispositivo

## Problemas comunes

- **Error de conexión al servidor**: Verifica que la IP configurada sea correcta y que el servidor esté ejecutándose
- **No se pueden ver los departamentos**: Verifica que ambos dispositivos estén conectados al mismo servidor Socket.IO
- **Fallo en videollamada**: Asegúrate de tener permisos de cámara y micrófono habilitados
- **Problemas de red**: WebRTC puede tener problemas con ciertas configuraciones de red; asegúrate de que no haya restricciones de firewall

## Uso

1. Al iniciar la aplicación, selecciona un rol (Portero o un Departamento específico)
2. Si seleccionaste el rol de Portero:
   - Podrás ver la lista de departamentos disponibles
   - Selecciona un departamento para iniciar una notificación
   - Cuando el departamento acepte, se iniciará una videollamada
3. Si seleccionaste un rol de Departamento:
   - Verás un log en tiempo real de actividades
   - Cuando el portero te contacte, podrás aceptar o rechazar la llamada
   - Al aceptar, se iniciará una videollamada

## Estructura del proyecto

```
porteroDti/
├── assets/                # Imágenes, íconos y recursos estáticos
├── components/            # Componentes reutilizables
├── navigation/            # Configuración de navegación
├── screens/               # Pantallas de la aplicación
├── services/              # Servicios (Socket.IO, WebRTC)
├── server/                # Servidor de señalización Socket.IO
├── app.json               # Configuración de Expo
├── babel.config.js        # Configuración de Babel
└── package.json           # Dependencias del proyecto
```

## Despliegue en producción

Para despliegues en producción:

1. Configura un servidor de señalización Socket.IO accesible desde internet
2. Actualiza la configuración con la URL del servidor de producción
3. Crea un build de producción:
   ```bash
   eas build --profile production --platform android
   ```

## Contribuciones

Las contribuciones son bienvenidas. Por favor, asegúrate de probar tus cambios antes de enviar un pull request.

## Licencia

Este proyecto está licenciado bajo la licencia MIT. Ver el archivo LICENSE para más detalles.
