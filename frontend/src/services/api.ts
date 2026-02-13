// api.ts - Camada de comunicação com o backend Rust
// Substitui invoke() do Tauri por fetch() REST
// Substitui listen() do Tauri por EventSource (SSE)

const API_BASE = `http://${window.location.hostname}:3001`;

/**
 * Invoke - chamada ao backend (compatível com a assinatura do Tauri)
 * Usa POST /api/invoke com { command, args }
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}/api/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args: args || {} }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Erro ${response.status}`);
  }

  return response.json();
}

/**
 * Listen - subscrever a eventos SSE do backend
 * Retorna função de cleanup (compatível com Tauri listen)
 */
export async function listen<T>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<() => void> {
  const eventSource = new EventSource(`${API_BASE}/api/events/${event}`);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      handler({ payload: data });
    } catch {
      // Ignorar mensagens inválidas
    }
  };

  eventSource.onerror = () => {
    // SSE reconecta automaticamente
  };

  return () => eventSource.close();
}

/**
 * Gera URL para vídeo servido pelo backend
 */
export function getVideoUrl(filePath: string): string {
  return `${API_BASE}/api/video${encodeURI(filePath)}`;
}
