# Guía de Configuración y Carga Masiva: Cloudflare R2 + Rclone

Esta guía detalla cómo crear tu almacenamiento en Cloudflare R2 y realizar una subida masiva de archivos (como los 1,323 GIFs de ejercicios) utilizando Rclone para superar las limitaciones del panel web.

---

## 1. Obtención de Credenciales R2

Para conectar tu terminal con Cloudflare, necesitas 3 datos críticos:

1.  **Account ID**: Se encuentra en la página principal de R2 en el dashboard de Cloudflare.
2.  **R2 API Token**:
    *   Ve a **R2 > Manage R2 API Tokens**.
    *   Haz clic en **Create API token**.
    *   Permisos: **Object Read & Write**.
    *   TTL: **Forever** (o según tu política de seguridad).
3.  **Datos de acceso**: Al crear el token, copia inmediatamente estos valores (el Secret Key solo se muestra una vez):
    *   **Access Key ID**
    *   **Secret Access Key**
    *   **S3 Endpoint** (ej. `https://<account-id>.r2.cloudflarestorage.com`)

---

## 2. Instalación y Configuración de Rclone

Rclone es la "navaja suiza" de los almacenamientos en la nube. Permite subidas paralelas muy rápidas.

### A. Instalación (WSL o Linux)
```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

### B. Configuración del "Remote"
Ejecuta `rclone config` y sigue estos pasos:
1.  `n` (New remote)
2.  name: `r2`
3.  Storage: `s3`
4.  provider: `Cloudflare`
5.  access_key_id: `[Tu Access Key ID]`
6.  secret_access_key: `[Tu Secret Access Key]`
7.  region: `auto`
8.  endpoint: `[Tu S3 API Endpoint]`
9.  Para el resto de opciones, presiona **Enter** (default) y finalmente `y` para guardar.

---

## 3. Comandos de Subida Masiva

Ubícate en la carpeta donde tienes los GIFs de los ejercicios (ej. `public/exercises/`) e inicia la subida:

```bash
rclone copy . r2:gymcoaching-exercises/exercises --progress --transfers 16
```

*   **r2:**: El nombre del remote que configuraste.
*   **gymcoaching-exercises/exercises**: Nombre del bucket + subcarpeta de destino.
*   **--transfers 16**: Sube 16 archivos al mismo tiempo (acelera drásticamente el proceso).

---

## 4. Acceso Público y URLs

Por seguridad, los buckets de R2 son privados por defecto. Para que la app muestre los GIFs:

1.  Ve a **R2 > [Tu Bucket] > Settings**.
2.  En **Public Access**, elige una opción:
    *   **Subdominio R2.dev**: Rápido para desarrollo.
    *   **Custom Domain**: Recomendado para producción (ej. `cdn.tu-dominio.com`).
3.  Anota la **URL Pública** resultante.

---

## 5. Integración con la Aplicación

Actualiza tu archivo `.env` o las variables en Cloudflare Pages:

```env
# Cloudflare R2 Config
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key
R2_SECRET_ACCESS_KEY=tu_secret_key
R2_BUCKET_NAME=gymcoaching-exercises
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxxxx.r2.dev
```

### Tips de Arquitectura
*   **URLs Dinámicas**: No guardes la URL completa en la base de datos. Guarda solo el nombre del archivo (ej. `0001.gif`). En el código, concatena `NEXT_PUBLIC_R2_PUBLIC_URL + '/exercises/' + exercise.gif_url`.
*   **CORS**: Si las imágenes no cargan en el navegador por errores de origen, añade una regla CORS en el panel de R2 permitiendo tu dominio de producción.
