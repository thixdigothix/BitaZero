const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  idToken?: string | null
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const canRetry = RETRYABLE_METHODS.has(method);
  const maxAttempts = canRetry ? 4 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (idToken) {
      headers.set('Authorization', `Bearer ${idToken}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkErr) {
      if (canRetry && attempt < maxAttempts - 1) {
        await delay(500 * (attempt + 1));
        continue;
      }
      throw networkErr;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json().catch(() => ({})) : {};

    if (!response.ok) {
      const isTransient404 = response.status === 404 && (!isJson || !data.error);
      const isTransientStatus = TRANSIENT_STATUSES.has(response.status) || isTransient404;
      if (canRetry && isTransientStatus && attempt < maxAttempts - 1) {
        await delay(500 * (attempt + 1));
        continue;
      }
      throw new Error(data.error || `Erro na requisição (${response.status})`);
    }

    return data as T;
  }

  throw new Error('Falha ao conectar com o servidor.');
}

export function compressImageFileToDataUri(
  file: File,
  maxSize = 256
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.85));
      };
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}
