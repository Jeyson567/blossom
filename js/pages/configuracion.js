import { getConfig, updateConfig, initConfigIfAdmin } from '../services/config.service.js';
import { uploadLogo, validateImageFile } from '../services/storage.service.js';

export async function render(container) {
  const config = await getConfig();

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Configuración</h2>
          <p class="page-subtitle">Ajustes generales del gimnasio</p>
        </div>
      </div>

      <div class="card" style="max-width:700px;">
        <form id="form-config">
          <div style="display:flex;gap:1.5rem;align-items:center;margin-bottom:1.5rem;">
            <div id="logo-preview" style="width:80px;height:80px;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--color-border);">
              ${config.logoURL
                ? `<img src="${config.logoURL}" style="width:100%;height:100%;object-fit:contain;">`
                : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--color-bg-hover);color:var(--color-gold);font-weight:700;">BFC</div>'
              }
            </div>
            <div>
              <label class="form-label">Logo del gimnasio</label>
              <input type="file" id="logo-input" accept="image/*" style="font-size:0.8125rem;">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label required">Nombre del gimnasio</label>
            <input class="form-input" name="nombreGimnasio" value="${config.nombreGimnasio || ''}" required>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input class="form-input" name="telefono" value="${config.telefono || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Dirección</label>
              <input class="form-input" name="direccion" value="${config.direccion || ''}">
            </div>
          </div>

          <h3 style="margin:1.5rem 0 1rem;font-size:1rem;">Redes Sociales</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Facebook</label>
              <input class="form-input" name="facebook" value="${config.redesSociales?.facebook || ''}" placeholder="https://facebook.com/...">
            </div>
            <div class="form-group">
              <label class="form-label">Instagram</label>
              <input class="form-input" name="instagram" value="${config.redesSociales?.instagram || ''}" placeholder="https://instagram.com/...">
            </div>
            <div class="form-group">
              <label class="form-label">TikTok</label>
              <input class="form-input" name="tiktok" value="${config.redesSociales?.tiktok || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">YouTube</label>
              <input class="form-input" name="youtube" value="${config.redesSociales?.youtube || ''}">
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top:1.5rem;">Guardar Configuración</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('logo-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('logo-preview').innerHTML =
        `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:contain;">`;
    }
  });

  document.getElementById('form-config')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      nombreGimnasio: formData.get('nombreGimnasio'),
      telefono: formData.get('telefono'),
      direccion: formData.get('direccion'),
      redesSociales: {
        facebook: formData.get('facebook'),
        instagram: formData.get('instagram'),
        tiktok: formData.get('tiktok'),
        youtube: formData.get('youtube')
      }
    };

    const logoFile = document.getElementById('logo-input')?.files[0];
    if (logoFile) {
      const imgError = validateImageFile(logoFile);
      if (imgError) {
        Swal.fire({ icon: 'error', title: imgError, background: '#1a1a1a', color: '#fff' });
        return;
      }
      data.logoURL = await uploadLogo(logoFile);
    }

    await initConfigIfAdmin();
    await updateConfig(data);
    Swal.fire({ icon: 'success', title: 'Configuración guardada', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    render(container);
  });
}
