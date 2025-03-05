const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Ruta básica para verificar que el servidor está funcionando
app.get("/", (req, res) => {
  res.send("Servidor Portero DTI funcionando correctamente");
});

// Objeto para almacenar las tablets registradas por rol
const tablets = {};

// Manejar nuevas conexiones
io.on("connection", (socket) => {
  console.log("Nueva conexión:", socket.id);

  // Agregar listener para capturar errores específicos del socket
  socket.on("error", (error) => {
    console.error(`Error en socket ${socket.id}:`, error);
  });

  // Registrar el rol de la tablet
  socket.on("registrar", (rol) => {
    try {
      socket.rol = rol;
      tablets[rol] = socket.id;
      console.log(`Tablet registrada como: ${rol}`);

      // Emitir evento de actualización de departamentos disponibles
      io.emit(
        "departamentos_actualizados",
        Object.keys(tablets).filter((r) => r !== "Portero")
      );
    } catch (error) {
      console.error(`Error al registrar rol ${rol}:`, error);
    }
  });

  // Iniciar una llamada desde el Portero a un departamento
  socket.on("iniciar_llamada", (departamento) => {
    try {
      const tabletDepartamentoId = tablets[departamento];
      if (tabletDepartamentoId) {
        io.to(tabletDepartamentoId).emit("llamada_entrante", socket.rol);
        console.log(`Llamada iniciada desde Portero hacia ${departamento}`);
      } else {
        console.log(`Departamento ${departamento} no encontrado.`);
        socket.emit("error", {
          message: `Departamento ${departamento} no disponible`,
        });
      }
    } catch (error) {
      console.error(`Error al iniciar llamada:`, error);
    }
  });

  // Aceptar una llamada desde el departamento
  socket.on("aceptar_llamada", (departamento) => {
    try {
      const tabletPorteroId = tablets["Portero"];
      if (tabletPorteroId) {
        io.to(tabletPorteroId).emit("llamada_aceptada", departamento);
        console.log(`Llamada aceptada por ${departamento}`);
      }
    } catch (error) {
      console.error(`Error al aceptar llamada:`, error);
    }
  });

  // Rechazar una llamada desde el departamento
  socket.on("rechazar_llamada", (departamento) => {
    try {
      const tabletPorteroId = tablets["Portero"];
      if (tabletPorteroId) {
        io.to(tabletPorteroId).emit("llamada_rechazada", departamento);
        console.log(`Llamada rechazada por ${departamento}`);
      }
    } catch (error) {
      console.error(`Error al rechazar llamada:`, error);
    }
  });

  // Finalizar una llamada desde cualquier lado
  socket.on("webrtc_end_call", (targetRol) => {
    try {
      if (tablets[targetRol]) {
        io.to(tablets[targetRol]).emit("webrtc_end_call", socket.rol);
        console.log(`Llamada finalizada por ${socket.rol} a ${targetRol}`);
      }
    } catch (error) {
      console.error(`Error al finalizar llamada:`, error);
    }
  });

  // === Señalización WebRTC ===

  // Reenviar oferta SDP
  socket.on("webrtc_offer", (offer, to) => {
    try {
      console.log(
        `Oferta WebRTC recibida de ${socket.rol}, reenviando a ${to}`
      );
      if (tablets[to]) {
        io.to(tablets[to]).emit("webrtc_offer", offer, socket.rol);
      }
    } catch (error) {
      console.error(`Error al procesar oferta WebRTC:`, error);
    }
  });

  // Reenviar respuesta SDP
  socket.on("webrtc_answer", (answer, to) => {
    try {
      console.log(
        `Respuesta WebRTC recibida de ${socket.rol}, reenviando a ${to}`
      );
      if (tablets[to]) {
        io.to(tablets[to]).emit("webrtc_answer", answer, socket.rol);
      }
    } catch (error) {
      console.error(`Error al procesar respuesta WebRTC:`, error);
    }
  });

  // Reenviar candidatos ICE
  socket.on("webrtc_ice_candidate", (candidate, to) => {
    try {
      console.log(
        `Candidato ICE recibido de ${socket.rol}, reenviando a ${to}`
      );
      if (tablets[to]) {
        io.to(tablets[to]).emit("webrtc_ice_candidate", candidate, socket.rol);
      }
    } catch (error) {
      console.error(`Error al procesar candidato ICE:`, error);
    }
  });

  // Manejar desconexiones
  socket.on("disconnect", () => {
    console.log("Tablet desconectada:", socket.id);
    for (const rol in tablets) {
      if (tablets[rol] === socket.id) {
        delete tablets[rol];
        console.log(`Rol ${rol} eliminado del registro`);

        // Notificar a todos sobre la actualización de departamentos disponibles
        io.emit(
          "departamentos_actualizados",
          Object.keys(tablets).filter((r) => r !== "Portero")
        );
        break;
      }
    }
  });
});

// Además, se puede agregar un listener global de errores en io:
io.on("error", (error) => {
  console.error("Error global de socket.io:", error);
});

// Iniciar el servidor en el puerto configurado o 3000 por defecto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor Portero DTI escuchando en el puerto ${PORT}`);
});
