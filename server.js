// server.js
// Servidor que se conecta al LIVE de TikTok y reenvía los mensajes
// del chat al navegador en tiempo real usando socket.io

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { TikTokLiveConnection, WebcastEvent, SignConfig } = require("tiktok-live-connector");

// La librería necesita una llave GRATUITA de firma (sign) de Euler Stream
// para poder conectarse a TikTok. Sin esto, siempre dirá "usuario no está en vivo"
// aunque sí lo esté. Consigue la tuya gratis en https://www.eulerstream.com
// y ponla aquí o como variable de entorno EULER_API_KEY en Render.
const EULER_API_KEY = process.env.EULER_API_KEY || "";
if (EULER_API_KEY) {
  SignConfig.apiKey = EULER_API_KEY;
}

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

    if (!EULER_API_KEY) {
      socket.emit(
        "connection-error",
        "Falta configurar la llave EULER_API_KEY en el servidor. Consíguela gratis en eulerstream.com y agrégala en las variables de entorno de Render."
      );
      return;
    }

    const tiktokConnection = new TikTokLiveConnection(cleanUsername, {
      signApiKey: EULER_API_KEY,
    });
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
      let msg = "No se pudo conectar. Verifica que el usuario esté EN VIVO ahora mismo y que el nombre esté bien escrito.";
      if (err?.name === "UserOfflineError" || /offline|not.*live/i.test(err?.message || "")) {
        msg = "TikTok dice que este usuario no está en vivo ahora mismo. Verifica el nombre de usuario (el de la URL, sin @) y que el live esté activo justo ahora.";
      } else if (/sign|api.?key|401|403/i.test(err?.message || "")) {
        msg = "Error de autenticación con el servicio de firma (Euler Stream). Revisa que tu EULER_API_KEY sea correcta y no haya expirado.";
      }
      socket.emit("connection-error", msg);
      activeConnections.delete(socket.id);
      return;
    }

    // Mensajes de chat
    tiktokConnection.on(WebcastEvent.CHAT, (data) => {
      const user = data.user?.nickname || data.user?.uniqueId || "Alguien";
      const comment = data.comment || "";
      console.log(`💬 [CHAT] ${user}: ${comment}`);
      socket.emit("chat-message", { user, comment });
    });

    // DIAGNÓSTICO: si el evento CHAT normal no se dispara mucho, esto revisa
    // si TikTok igual está mandando el protobuf de chat con otro nombre.
    tiktokConnection.on("rawData", (messageTypeName) => {
      const name = String(messageTypeName || "");
      if (/chat|comment|barrage/i.test(name)) {
        console.log(`📦 Frame crudo tipo chat recibido: ${name}`);
      }
    });

    tiktokConnection.on("decodedData", (eventName, decodedData) => {
      const name = String(eventName || "");
      if (/chat|comment|barrage/i.test(name)) {
        console.log(`🔎 [DECODED:${name}]`, JSON.stringify(decodedData).slice(0, 300));
      }
    });

    // Regalos (opcional, se muestran pero no se leen para no saturar)
    tiktokConnection.on(WebcastEvent.GIFT, (data) => {
      const giftType = data.giftDetails?.giftType;
      if (giftType !== 1 || data.repeatEnd) {
        const user = data.user?.nickname || data.user?.uniqueId || "Alguien";
        const giftName = data.giftDetails?.giftName || "un regalo";
        console.log(`🎁 [GIFT] ${user}: ${giftName}`);
        socket.emit("gift-message", {
          user,
          giftName,
          repeatCount: data.repeatCount || 1,
        });
      }
    });

    // Likes (opcional)
    tiktokConnection.on(WebcastEvent.LIKE, (data) => {
      socket.emit("like-message", {
        user: data.user?.nickname || data.user?.uniqueId || "Alguien",
        likeCount: data.likeCount || 1,
      });
    });

    // Nuevos espectadores entrando (opcional)
    tiktokConnection.on(WebcastEvent.MEMBER, (data) => {
      const user = data.user?.nickname || data.user?.uniqueId || "Alguien";
      console.log(`👋 [MEMBER] ${user} se unió`);
      socket.emit("member-message", { user });
    });

    tiktokConnection.on(WebcastEvent.STREAM_END, () => {
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
  if (!EULER_API_KEY) {
    console.warn("ADVERTENCIA: no se configuró EULER_API_KEY. Las conexiones fallarán.");
  }
});
