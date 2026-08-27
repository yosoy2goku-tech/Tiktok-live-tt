// server.js
// Servidor que se conecta al LIVE de TikTok y reenvía los mensajes
// del chat al navegador en tiempo real usando socket.io

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Guardamos una conexión activa por cada socket del navegador
const activeConnections = new Map();

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("connect-to-live", async (username) => {
    // Limpieza si ya había una conexión previa en este socket
    const prev = activeConnections.get(socket.id);
    if (prev) {
      try { prev.disconnect(); } catch (e) {}
      activeConnections.delete(socket.id);
    }

    const cleanUsername = String(username || "").trim().replace(/^@/, "");
    if (!cleanUsername) {
      socket.emit("connection-error", "Usuario vacío.");
      return;
    }

    const tiktokConnection = new WebcastPushConnection(cleanUsername);
    activeConnections.set(socket.id, tiktokConnection);

    try {
      const state = await tiktokConnection.connect();
      socket.emit("connected", {
        roomId: state.roomId,
        username: cleanUsername,
      });
      console.log(`Conectado al live de @${cleanUsername} (room ${state.roomId})`);
    } catch (err) {
      console.error("Error al conectar:", err?.message || err);
      socket.emit(
        "connection-error",
        "No se pudo conectar. Verifica que el usuario esté EN VIVO ahora mismo y que el nombre esté bien escrito."
      );
      activeConnections.delete(socket.id);
      return;
    }

    // Mensajes de chat
    tiktokConnection.on("chat", (data) => {
      socket.emit("chat-message", {
        user: data.nickname || data.uniqueId || "Alguien",
        comment: data.comment || "",
      });
    });

    // Regalos (opcional, se muestran pero no se leen para no saturar)
    tiktokConnection.on("gift", (data) => {
      if (data.giftType !== 1 || data.repeatEnd) {
        socket.emit("gift-message", {
          user: data.nickname || data.uniqueId || "Alguien",
          giftName: data.giftName || "un regalo",
          repeatCount: data.repeatCount || 1,
        });
      }
    });

    // Likes (opcional)
    tiktokConnection.on("like", (data) => {
      socket.emit("like-message", {
        user: data.nickname || data.uniqueId || "Alguien",
        likeCount: data.likeCount || 1,
      });
    });

    // Nuevos espectadores entrando (opcional)
    tiktokConnection.on("member", (data) => {
      socket.emit("member-message", {
        user: data.nickname || data.uniqueId || "Alguien",
      });
    });

    tiktokConnection.on("streamEnd", () => {
      socket.emit("stream-ended");
    });

    tiktokConnection.on("disconnected", () => {
      socket.emit("stream-ended");
    });
  });

  socket.on("disconnect-live", () => {
    const conn = activeConnections.get(socket.id);
    if (conn) {
      try { conn.disconnect(); } catch (e) {}
      activeConnections.delete(socket.id);
    }
  });

  socket.on("disconnect", () => {
    const conn = activeConnections.get(socket.id);
    if (conn) {
      try { conn.disconnect(); } catch (e) {}
      activeConnections.delete(socket.id);
    }
    console.log("Cliente desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
