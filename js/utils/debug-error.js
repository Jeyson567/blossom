/** Muestra el error real en pantalla (diagnóstico). */
export function showRealError(container, error, archivo, funcion) {
  console.error(error);
  console.error(error?.code);
  console.error(error?.message);
  if (error?.stack) console.error(error.stack);

  container.innerHTML = `
    <div style="padding:20px;color:#ef4444;">
      <h3 style="margin-bottom:0.75rem;">Error real detectado</h3>
      <p style="font-size:0.875rem;margin-bottom:0.5rem;"><strong>Archivo:</strong> ${archivo}</p>
      <p style="font-size:0.875rem;margin-bottom:0.5rem;"><strong>Función:</strong> ${funcion}</p>
      <p style="font-size:0.875rem;margin-bottom:0.5rem;"><strong>Código:</strong> ${error?.code || '—'}</p>
      <p style="font-size:0.875rem;margin-bottom:1rem;"><strong>Mensaje:</strong> ${error?.message || error}</p>
      <pre style="font-size:0.75rem;background:#1a1a1a;padding:1rem;border-radius:8px;overflow:auto;color:#fca5a5;max-height:200px;">${error?.stack || ''}</pre>
      <button class="btn btn-secondary" id="debug-retry" style="margin-top:1rem;">Reintentar</button>
    </div>
  `;
}

export function logFirestoreError(modulo, error) {
  console.error(`[BFC ${modulo}] ERROR Firestore`);
  console.error(error);
  console.error(error?.code);
  console.error(error?.message);
}
