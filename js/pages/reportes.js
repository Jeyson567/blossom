import { getIngresosPorPeriodo, getAllPagos } from '../services/pagos.service.js';
import { getClientesStats, getAllClientes } from '../services/clientes.service.js';
import { getMembresiasStats } from '../services/membresias.service.js';
import { getAllProductos, getStockAlerts } from '../services/inventario.service.js';
import { getConfig } from '../services/config.service.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { PAYMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '../utils/constants.js';
import { exportToPDF } from '../reports/pdf-export.js';
import { exportToExcel } from '../reports/excel-export.js';

let currentPeriodo = 'mes';

export async function render(container) {
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Reportes</h2>
          <p class="page-subtitle">Análisis y exportación de datos</p>
        </div>
      </div>

      <div class="tabs" id="report-tabs">
        <button class="tab active" data-tab="ingresos">Ingresos</button>
        <button class="tab" data-tab="clientes">Clientes</button>
        <button class="tab" data-tab="membresias">Membresías</button>
        <button class="tab" data-tab="inventario">Inventario</button>
      </div>

      <div id="report-content"></div>
    </div>
  `;

  await loadReport('ingresos');

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      await loadReport(tab.dataset.tab);
    });
  });
}

async function loadReport(type) {
  const content = document.getElementById('report-content');
  content.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div></div>';

  const config = await getConfig();

  switch (type) {
    case 'ingresos': await renderIngresosReport(content, config); break;
    case 'clientes': await renderClientesReport(content, config); break;
    case 'membresias': await renderMembresiasReport(content, config); break;
    case 'inventario': await renderInventarioReport(content, config); break;
  }
}

async function renderIngresosReport(content, config) {
  const periodos = [
    { key: 'dia', label: 'Diario' },
    { key: 'semana', label: 'Semanal' },
    { key: 'mes', label: 'Mensual' },
    { key: 'anio', label: 'Anual' }
  ];

  const {
    total, count, pagos,
    ingresosMembresias, ingresosInscripcion, ingresosProductos, ingresosOtros
  } = await getIngresosPorPeriodo(currentPeriodo);

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div style="display:flex;gap:0.5rem;">
          ${periodos.map(p => `<button class="btn ${currentPeriodo === p.key ? 'btn-primary' : 'btn-secondary'} btn-sm" data-periodo="${p.key}">${p.label}</button>`).join('')}
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-secondary btn-sm" id="export-pdf">Exportar PDF</button>
          <button class="btn btn-secondary btn-sm" id="export-excel">Exportar Excel</button>
        </div>
      </div>

      <div class="grid-stats" style="margin-bottom:1.5rem;">
        <div class="card stat-card"><div class="stat-value">${formatCurrency(ingresosMembresias || 0)}</div><div class="stat-label">Membresías</div></div>
        <div class="card stat-card"><div class="stat-value">${formatCurrency(ingresosInscripcion || 0)}</div><div class="stat-label">Inscripciones</div></div>
        <div class="card stat-card"><div class="stat-value">${formatCurrency(ingresosProductos || 0)}</div><div class="stat-label">Productos</div></div>
        <div class="card stat-card"><div class="stat-value">${formatCurrency(ingresosOtros || 0)}</div><div class="stat-label">Otros ingresos</div></div>
        <div class="card stat-card"><div class="stat-value">${formatCurrency(total)}</div><div class="stat-label">Total general</div></div>
        <div class="card stat-card"><div class="stat-value">${count}</div><div class="stat-label">Transacciones</div></div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>Método</th></tr></thead>
          <tbody>
            ${pagos.slice(0, 50).map(p => `
              <tr>
                <td>${formatDate(p.fecha)}</td>
                <td>${p.clienteNombre}</td>
                <td>${p.concepto}</td>
                <td>${PAYMENT_TYPE_LABELS[p.tipo] || p.tipo}</td>
                <td>${formatCurrency(p.monto)}</td>
                <td>${PAYMENT_METHOD_LABELS[p.metodoPago] || p.metodoPago}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;">Sin datos</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  content.querySelectorAll('[data-periodo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentPeriodo = btn.dataset.periodo;
      await renderIngresosReport(content, config);
    });
  });

  const columns = [
    { key: 'fecha', label: 'Fecha', format: 'date' },
    { key: 'clienteNombre', label: 'Cliente' },
    { key: 'concepto', label: 'Concepto' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'monto', label: 'Monto', format: 'currency' },
    { key: 'metodoPago', label: 'Método' }
  ];
  const exportData = pagos.map(p => ({
    ...p,
    tipo: PAYMENT_TYPE_LABELS[p.tipo] || p.tipo,
    metodoPago: PAYMENT_METHOD_LABELS[p.metodoPago] || p.metodoPago
  }));

  document.getElementById('export-pdf')?.addEventListener('click', () => {
    exportToPDF({ title: `Reporte de Ingresos — ${currentPeriodo}`, columns, data: exportData, filename: `ingresos-${currentPeriodo}`, gymName: config.nombreGimnasio });
  });
  document.getElementById('export-excel')?.addEventListener('click', () => {
    exportToExcel({ columns, data: exportData, filename: `ingresos-${currentPeriodo}`, sheetName: 'Ingresos' });
  });
}

async function renderClientesReport(content, config) {
  const [stats, clientes] = await Promise.all([getClientesStats(), getAllClientes()]);

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-bottom:1.5rem;">
        <button class="btn btn-secondary btn-sm" id="export-pdf">Exportar PDF</button>
        <button class="btn btn-secondary btn-sm" id="export-excel">Exportar Excel</button>
      </div>
      <div class="grid-stats" style="margin-bottom:1.5rem;">
        <div class="card stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">Total</div></div>
        <div class="card stat-card"><div class="stat-value">${stats.activos}</div><div class="stat-label">Activos</div></div>
        <div class="card stat-card"><div class="stat-value">${stats.vencidos}</div><div class="stat-label">Vencidos</div></div>
        <div class="card stat-card"><div class="stat-value">${stats.nuevos}</div><div class="stat-label">Nuevos (mes)</div></div>
      </div>
    </div>
  `;

  const columns = [
    { key: 'nombreCompleto', label: 'Nombre' },
    { key: 'dpi', label: 'DPI' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'estadoMembresia', label: 'Estado' },
    { key: 'fechaVencimiento', label: 'Vencimiento', format: 'date' }
  ];

  document.getElementById('export-pdf')?.addEventListener('click', () => {
    exportToPDF({ title: 'Reporte de Clientes', columns, data: clientes, filename: 'clientes', gymName: config.nombreGimnasio });
  });
  document.getElementById('export-excel')?.addEventListener('click', () => {
    exportToExcel({ columns, data: clientes, filename: 'clientes', sheetName: 'Clientes' });
  });
}

async function renderMembresiasReport(content, config) {
  const stats = await getMembresiasStats();

  content.innerHTML = `
    <div class="card">
      <div class="grid-2">
        <div>
          <h3 style="margin-bottom:1rem;font-size:1rem;">Más Vendidas</h3>
          ${stats.masVendidas.map(([name, count]) => `
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--color-border);">
              <span>${name}</span><span class="badge badge-gold">${count}</span>
            </div>
          `).join('') || '<p style="color:var(--color-text-secondary);">Sin datos</p>'}
        </div>
        <div>
          <h3 style="margin-bottom:1rem;font-size:1rem;">Menos Vendidas</h3>
          ${stats.menosVendidas.map(([name, count]) => `
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--color-border);">
              <span>${name}</span><span class="badge badge-neutral">${count}</span>
            </div>
          `).join('') || '<p style="color:var(--color-text-secondary);">Sin datos</p>'}
        </div>
      </div>
      <p style="margin-top:1rem;font-size:0.875rem;color:var(--color-text-secondary);">Total de membresías vendidas: <strong>${stats.total}</strong></p>
    </div>
  `;
}

async function renderInventarioReport(content, config) {
  const [productos, alerts] = await Promise.all([getAllProductos(), getStockAlerts()]);

  content.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-bottom:1.5rem;">
        <button class="btn btn-secondary btn-sm" id="export-excel">Exportar Excel</button>
      </div>
      ${alerts.agotado.length ? `<p class="badge badge-danger" style="margin-bottom:1rem;">${alerts.agotado.length} productos agotados</p>` : ''}
      ${alerts.bajo.length ? `<p class="badge badge-warning" style="margin-bottom:1rem;">${alerts.bajo.length} productos con stock bajo</p>` : ''}
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Nombre</th><th>Stock</th><th>Mínimo</th><th>Precio Venta</th></tr></thead>
          <tbody>
            ${productos.map(p => `
              <tr>
                <td>${p.codigo}</td><td>${p.nombre}</td>
                <td><span class="badge ${p.stock <= 0 ? 'badge-danger' : p.stock <= p.stockMinimo ? 'badge-warning' : 'badge-success'}">${p.stock}</span></td>
                <td>${p.stockMinimo}</td><td>${formatCurrency(p.precioVenta)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const columns = [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'stock', label: 'Stock' },
    { key: 'stockMinimo', label: 'Mínimo' },
    { key: 'precioVenta', label: 'Precio Venta', format: 'currency' }
  ];

  document.getElementById('export-excel')?.addEventListener('click', () => {
    exportToExcel({ columns, data: productos, filename: 'inventario', sheetName: 'Inventario' });
  });
}
