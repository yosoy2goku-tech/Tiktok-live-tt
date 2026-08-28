const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

let liveConnection = null;
let currentUsername = null;
let connectorModulePromise = null;
const recentChatIds = new Map();

async function getConnector() {
  if (!connectorModulePromise) connectorModulePromise = import('tiktok-live-connector');
  return connectorModulePromise;
}

function cleanUsername(value) {
  return String(value || '').trim().replace(/^@+/, '');
}

function getUser(data) {
  return String(
    data?.user?.uniqueId || data?.user?.nickname || data?.uniqueId || data?.nickname || 'Usuario'
  ).trim();
}

function getComment(data) {
  const value = data?.comment ?? data?.text ?? data?.content;
  return value == null ? '' : String(value).trim();
}

function chatKey(data, user, comment) {
  const explicit = data?.msgId ?? data?.messageId ?? data?.common?.msgId;
  return String(explicit || `${user}|${comment}`);
}

function broadcast(name, payload) {
  io.emit(name, payload);
}

function emitChat(data, source = 'CHAT') {
  const user = getUser(data);
  const comment = getComment(data);
  if (!comment) return false;

  const now = Date.now();
  const key = chatKey(data, user, comment);
  const previous = recentChatIds.get(key);
  if (previous && now - previous < 5000) return false;
  recentChatIds.set(key, now);

  for (const [k, t] of recentChatIds) {
    if (now - t > 15000) recentChatIds.delete(k);
  }

  console.log(`💬 [${source}] @${user}: ${comment}`);
  broadcast('chat-message', { user, comment, text: comment, source, timestamp: now });
  return true;
}

function findChatInDecoded(eventName, payload) {
  const event = String(eventName || '');
  if (!/(chat|comment|barrage|immessage|webcastchat)/i.test(event)) return null;

  const seen = new Set();
  let result = null;
  function walk(value, depth = 0) {
    if (result || value == null || depth > 8 || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    const userObj = value.user || value.author || value.sender;
    const comment = value.comment ?? value.message ?? value.text ?? value.content;
    const user = userObj?.uniqueId || userObj?.nickname || value.uniqueId || value.nickname || value.username || value.name;
    if (typeof comment === 'string' && comment.trim()) {
      result = { user: String(user || 'Usuario'), comment: comment.trim() };
      return;
    }
    for (const child of Object.values(value)) walk(child, depth + 1);
  }
  walk(payload);
  return result;
}

async function disconnectLive() {
  if (liveConnection) {
    try { await liveConnection.disconnect(); } catch (e) { console.warn('Desconexión:', e?.message || e); }
  }
  liveConnection = null;
  currentUsername = null;
}

async function connectLive(username) {
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await getConnector();

  if (liveConnection && currentUsername === username) {
    return { username, roomId: liveConnection.roomId || null, reused: true };
  }

  if (liveConnection) await disconnectLive();

  const connection = new TikTokLiveConnection(username, {
    processInitialData: true,
    enableExtendedGiftInfo: false,
  });
  liveConnection = connection;
  currentUsername = username;

  connection.on(ControlEvent.CONNECTED, (state) => {
    console.log(`✅ Conectado a @${username} | roomId=${state?.roomId || '?'}`);
    broadcast('connected', { username, roomId: state?.roomId || null });
  });

  connection.on(ControlEvent.WEBSOCKET_CONNECTED, () => {
    console.log('🔌 WebSocket conectado');
    broadcast('transport-status', { websocket: true });
  });

  connection.on(ControlEvent.WEBSOCKET_DATA, (binary) => {
    const bytes = binary?.length ?? 0;
    if (bytes) broadcast('transport-stats', { bytes });
  });

  connection.on(WebcastEvent.CHAT, (data) => emitChat(data, 'CHAT'));

  connection.on(ControlEvent.DECODED_DATA, (eventName, decodedData) => {
    const found = findChatInDecoded(eventName, decodedData);
    if (found) emitChat(found, `DECODED:${eventName}`);
  });

  connection.on(ControlEvent.RAW_DATA, (messageTypeName) => {
    const type = String(messageTypeName || '');
    if (/(chat|comment|barrage)/i.test(type)) {
      console.log(`📦 Frame relacionado con chat: ${type}`);
      broadcast('debug-message', { text: `Frame de chat: ${type}` });
    }
  });

  connection.on(WebcastEvent.MEMBER, (data) => {
    const payload = { user: getUser(data), memberCount: data?.memberCount ?? null, timestamp: Date.now() };
    console.log(`👋 @${payload.user} se unió`);
    broadcast('member-message', payload);
  });

  connection.on(WebcastEvent.GIFT, (data) => {
    const user = getUser(data);
    const giftName = data?.giftDetails?.giftName || data?.giftName || data?.extendedGiftInfo?.name || `Regalo #${data?.giftId ?? '?'}`;
    const repeatCount = Number(data?.repeatCount || 1);
    console.log(`🎁 @${user}: ${repeatCount}x ${giftName}`);
    broadcast('gift-message', { user, giftName, repeatCount, giftId: data?.giftId ?? null, timestamp: Date.now() });
  });

  connection.on(WebcastEvent.LIKE, (data) => {
    const payload = {
      user: getUser(data),
      likeCount: Number(data?.likeCount || 1),
      totalLikeCount: Number(data?.totalLikeCount || 0),
      timestamp: Date.now(),
    };
    console.log(`❤️ @${payload.user}: +${payload.likeCount}`);
    broadcast('like-message', payload);
  });

  connection.on(WebcastEvent.SOCIAL, (data) => {
    broadcast('social-message', { user: getUser(data), timestamp: Date.now() });
  });

  connection.on(ControlEvent.ERROR, (data) => {
    const message = data?.exception?.message || data?.info || data?.message || String(data || 'Error desconocido');
    console.error('❌ TikTok:', message);
    broadcast('connection-error', message);
  });

  connection.on(ControlEvent.DISCONNECTED, ({ code, reason } = {}) => {
    console.log(`⚠️ Desconectado${code != null ? ` (${code})` : ''}${reason ? `: ${reason}` : ''}`);
    broadcast('transport-status', { websocket: false, code, reason });
  });

  connection.on(ControlEvent.STREAM_END, () => {
    console.log('🔴 LIVE terminado');
    broadcast('stream-ended');
  });

  await connection.connect();
  return { username, roomId: connection.roomId || null, reused: false };
}

io.on('connection', (socket) => {
  console.log(`🌐 Cliente conectado ${socket.id}`);

  socket.on('connect-to-live', async (rawUsername) => {
    const username = cleanUsername(rawUsername);
    if (!username) return socket.emit('connection-error', 'Escribe un usuario de TikTok.');

    try {
      const state = await connectLive(username);
      if (state.reused) socket.emit('connected', state);
    } catch (err) {
      console.error('❌ No se pudo conectar:', err);
      socket.emit('connection-error', err?.message || 'No se pudo conectar al LIVE.');
    }
  });

  socket.on('get-live-state', () => {
    if (currentUsername) socket.emit('connected', { username: currentUsername, roomId: liveConnection?.roomId || null });
  });

  socket.on('disconnect-live', async () => {
    await disconnectLive();
    broadcast('stream-ended');
  });

  socket.on('disconnect', () => console.log(`🌐 Cliente desconectado ${socket.id}`));
});

server.listen(PORT, () => console.log(`🚀 TikTok Live Chat v3 en http://localhost:${PORT}`));
