# Lector de Chat en Vivo de TikTok

App que se conecta al LIVE de un usuario de TikTok y lee el chat en voz alta,
con una cola que evita atrasos (si se acumulan muchos mensajes, se saltan los
más viejos en vez de leerlos tarde).

## Cómo subirlo a Render (gratis)

1. Crea una cuenta en https://render.com (puedes usar tu GitHub).
2. Sube esta carpeta completa a un repositorio de GitHub:
   - Crea un repo nuevo (puede ser privado).
   - Sube TODOS estos archivos: `package.json`, `server.js`, `README.md` y la carpeta `public/`.
3. En Render, click en **New +** → **Web Service**.
4. Conecta ese repositorio de GitHub.
5. Configura:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
6. Click en **Create Web Service** y espera a que termine el deploy (1-3 minutos).
7. Render te da una URL tipo `https://tu-app.onrender.com` — ábrela en el navegador.
8. Escribe el usuario de TikTok (sin @) y dale a **Conectar**. El usuario debe
   estar EN VIVO en ese momento.

## Notas importantes

- **El navegador debe permitir voz (Text-to-Speech)**. Funciona con Chrome,
  Edge y Safari sin instalar nada extra.
- **El plan gratis de Render "duerme"** el servicio si no se usa por un rato.
  La primera conexión después de estar dormido puede tardar ~30 segundos en
  despertar.
- **Ajustes disponibles en la página**:
  - Velocidad de lectura de la voz.
  - Máximo de mensajes en espera (si se llena, se descartan los más viejos,
    así nunca se queda "atrasado" leyendo cosas viejas).
  - Longitud mínima de mensaje para que lo lea (para ignorar mensajes muy
    cortos tipo "jaja" o emojis sueltos).
  - Si quieres que diga el nombre de usuario antes del mensaje o no.
- Si no conecta, revisa que:
  - El usuario esté transmitiendo en vivo justo en ese momento.
  - El nombre de usuario esté bien escrito (sin espacios, sin @).

## Correrlo en tu computadora (opcional, para probar antes de subirlo)

```bash
npm install
npm start
```

Luego abre `http://localhost:3000` en tu navegador.
