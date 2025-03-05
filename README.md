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

3. Configura el servidor Socket.IO:
   - Actualiza la URL del servidor en `services/socketService.ts`

## Ejecución del proyecto

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
