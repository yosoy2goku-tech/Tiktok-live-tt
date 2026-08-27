# Lector de Chat en Vivo de TikTok

App que se conecta al LIVE de un usuario de TikTok y lee el chat en voz alta,
con una cola que evita atrasos (si se acumulan muchos mensajes, se saltan los
más viejos en vez de leerlos tarde).

## Paso OBLIGATORIO antes de desplegar: consigue tu llave gratuita

Esta app usa la librería `tiktok-live-connector`, que necesita una **llave de
firma gratuita** del servicio Euler Stream para poder hablar con TikTok. Sin
esta llave, la app SIEMPRE dirá "el usuario no está en vivo", aunque sí lo esté.

1. Ve a https://www.eulerstream.com y crea una cuenta gratis.
2. Genera una API Key (tiene un límite gratuito de peticiones, suficiente para
   uso personal).
3. Guarda esa llave, la vas a necesitar en el paso 5 de abajo.

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
6. Antes de crear el servicio (o después, en la pestaña **Environment**),
   agrega una variable de entorno:
   - **Key**: `EULER_API_KEY`
   - **Value**: la llave que conseguiste en eulerstream.com
7. Click en **Create Web Service** (o **Save, Rebuild and Deploy** si ya
   existía) y espera a que termine el deploy (1-3 minutos).
8. Render te da una URL tipo `https://tu-app.onrender.com` — ábrela en el navegador.
9. Escribe el usuario de TikTok **exactamente como aparece en la URL de su
   perfil** (sin @, sin espacios) y dale a **Conectar**. El usuario debe
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
# En Linux/Mac:
EULER_API_KEY=tu_llave_aqui npm start

# O crea un archivo .env con:
# EULER_API_KEY=tu_llave_aqui
```

```bash
npm install
npm start
```

Luego abre `http://localhost:3000` en tu navegador.

## Si sigue diciendo "usuario no está en vivo"

1. **Revisa que configuraste `EULER_API_KEY`** en Render → tu servicio →
   pestaña "Environment". Sin esto, la app nunca podrá conectarse, sin
   importar qué usuario pongas.
2. Después de agregar o cambiar la variable de entorno, tienes que darle
   **"Manual Deploy" → "Deploy latest commit"** (o esperar el redeploy
   automático) para que tome efecto.
3. Usa el **username exacto de la URL**: entra al perfil de la persona en
   TikTok, mira la URL (ej. `tiktok.com/@fulanito123`), y usa `fulanito123`
   (sin @, sin mayúsculas si el nombre real es en minúsculas).
4. Confirma que el live esté activo justo en el momento en que le das
   "Conectar" — si el live terminó hace poco, seguirá fallando.
5. Si tu llave gratuita de Euler Stream llegó a su límite de peticiones,
   también fallará; revisa tu cuenta en eulerstream.com.
