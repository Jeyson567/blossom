import { getClientesStats, getClientesPorVencer, refreshMembershipStatuses } from '../services/clientes.service.js';
import { getIngresosDelDia, getIngresosDelMes, getIngresosMensuales, getRecentPagos } from '../services/pagos.service.js';
import { getMembresiasVendidas, getRecentMembresias } from '../services/membresias.service.js';
import { getRecentAccesos } from '../services/accesos.service.js';
import { formatCurrency, formatDate, formatRelativeTime } from '../utils/formatters.js';
import { createLineChart, createBarChart, formatMonthlyLabels, destroyChart } from '../components/charts.js';
import { renderStatusBadge } from '../components/data-table.js';
import { getDaysRemaining } from '../utils/helpers.js';

let charts = [];

export async function render(container) {
  console.log('[BFC Dashboard] ⑥ Iniciando carga del dashboard...');

  try {
    await refreshMembershipStatuses();
    console.log('[BFC Dashboard] Estados de membresía actualizados');
  } catch (error) {
    console.warn('[BFC Dashboard] refreshMembershipStatuses error:', error.message);
  }

  console.log('[BFC Dashboard] Consultando estadísticas...');
  const results = await Promise.allSettled([
    getClientesStats(),
    getIngresosDelDia(),
    getIngresosDelMes(),
    getIngresosMensuales(new Date().getFullYear()),
    getMembresiasVendidas('mes'),
    getRecentPagos(5),
    getRecentMembresias(5),
    getRecentAccesos(5),
    getClientesPorVencer(0),
    getClientesPorVencer(3),
    getClientesPorVencer(7)
  ]);

  const get = (i, fallback) => results[i].status === 'fulfilled' ? results[i].value : fallback;
  const logRejected = (name, i) => {
    if (results[i].status === 'rejected') {
      console.warn(`[BFC Dashboard] Error en ${name}:`, results[i].reason?.message);
    }
  };

  logRejected('getClientesStats', 0);
  logRejected('getIngresosDelDia', 1);
  logRejected('getIngresosDelMes', 2);

  const stats = get(0, { total: 0, activos: 0, vencidos: 0, proximos: 0, nuevos: 0 });
  const ingresosDia = get(1, { total: 0, count: 0 });
  const ingresosMes = get(2, { total: 0, count: 0 });
  const mensuales = get(3, []);
  const membresiasMes = get(4, []);
  const recentPagos = get(5, []);
  const recentMembresias = get(6, []);
  const recentAccesos = get(7, []);
  const vencenHoy = get(8, []);
  const vencen3 = get(9, []);
  const vencen7 = get(10, []);

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Dashboard</h2>
          <p class="page-subtitle">Resumen en tiempo real del gimnasio</p>
        </div>
      </div>

      <div class="grid-stats">
        ${statCard('Clientes Activos', stats.activos, 'users', 'var(--color-success)')}
        ${statCard('Vencidos', stats.vencidos, 'warning', 'var(--color-danger)')}
        ${statCard('Próximos a Vencer', stats.proximos, 'clock', 'var(--color-warning)')}
        ${statCard('Ingresos Hoy', formatCurrency(ingresosDia.total), 'money', 'var(--color-gold)')}
        ${statCard('Ingresos Mes', formatCurrency(ingresosMes.total), 'chart', 'var(--color-gold)')}
        ${statCard('Nuevos Clientes', stats.nuevos, 'new', 'var(--color-info)')}
      </div>

      <div class="grid-2" style="margin-bottom:1.5rem;">
        <div class="card">
          <h3 style="font-size:1rem;margin-bottom:1rem;">Ingresos Mensuales</h3>
          <div class="chart-container"><canvas id="chart-ingresos"></canvas></div>
        </div>
        <div class="card">
          <h3 style="font-size:1rem;margin-bottom:1rem;">Membresías Vendidas (Mes)</h3>
          <div class="chart-container"><canvas id="chart-membresias"></canvas></div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <h3 style="font-size:1rem;margin-bottom:1rem;">Actividad Reciente</h3>
          ${renderActivity(recentPagos, recentMembresias, recentAccesos)}
        </div>
        <div class="card">
          <h3 style="font-size:1rem;margin-bottom:1rem;">Alertas de Vencimiento</h3>
          ${renderAlerts(vencenHoy, vencen3, vencen7)}
        </div>
        <div class="card">
          <h3 style="font-size:1rem;margin-bottom:1rem;">Clientes Nuevos del Mes</h3>
          <div style="text-align:center;padding:2rem;">
            <div style="font-size:3rem;font-weight:700;color:var(--color-gold);">${stats.nuevos}</div>
            <p style="color:var(--color-text-secondary);font-size:0.875rem;">registros este mes</p>
          </div>
        </div>
      </div>
    </div>
  `;

  charts.forEach(c => destroyChart(c));
  charts = [];

  charts.push(createLineChart(
    'chart-ingresos',
    formatMonthlyLabels(mensuales),
    mensuales.map(m => m.total),
    'Ingresos (Q)'
  ));

  const membresiasPorSemana = groupMembresiasByWeek(membresiasMes);
  charts.push(createBarChart(
    'chart-membresias',
    membresiasPorSemana.labels,
    membresiasPorSemana.data,
    'Membresías'
  ));

  console.log('[BFC Dashboard] ⑥ Dashboard cargado correctamente');
}

function statCard(label, value, icon, color) {
  return `
    <div class="card stat-card">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-icon" style="color:${color};background:${color}15;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
      </div>
    </div>
  `;
}

function renderActivity(pagos, membresias, accesos) {
  const items = [];

  pagos.forEach(p => items.push({
    type: 'pago', text: `Pago: ${p.clienteNombre} — ${formatCurrency(p.monto)}`,
    time: p.fecha, dot: 'gold'
  }));
  membresias.forEach(m => items.push({
    type: 'membresia', text: `Renovación: ${m.clienteNombre} — ${m.planNombre}`,
    time: m.createdAt, dot: 'green'
  }));
  accesos.forEach(a => items.push({
    type: 'acceso', text: `Acceso: ${a.clienteNombre}`,
    time: a.fecha, dot: 'blue'
  }));

  items.sort((a, b) => {
    const ta = a.time?.toDate?.() || new Date(0);
    const tb = b.time?.toDate?.() || new Date(0);
    return tb - ta;
  });

  if (!items.length) return '<div class="empty-state"><p>Sin actividad reciente</p></div>';

  return items.slice(0, 8).map(item => `
    <div class="activity-item">
      <div class="activity-dot ${item.dot}"></div>
      <div style="flex:1;">
        <div style="font-size:0.875rem;">${item.text}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">${formatRelativeTime(item.time)}</div>
      </div>
    </div>
  `).join('');
}

function renderAlerts(hoy, tres, siete) {
  let html = '';

  if (hoy.length) {
    html += `<p style="font-size:0.75rem;color:var(--color-danger);margin-bottom:0.5rem;font-weight:600;">VENCEN HOY (${hoy.length})</p>`;
    hoy.slice(0, 3).forEach(c => {
      html += `<div class="alert-item danger"><span>${c.nombreCompleto}</span>${renderStatusBadge('vencido')}</div>`;
    });
  }

  const proximos3 = tres.filter(c => !hoy.find(h => h.id === c.id));
  if (proximos3.length) {
    html += `<p style="font-size:0.75rem;color:var(--color-warning);margin:0.75rem 0 0.5rem;font-weight:600;">EN 3 DÍAS (${proximos3.length})</p>`;
    proximos3.slice(0, 3).forEach(c => {
      const dias = getDaysRemaining(c.fechaVencimiento);
      html += `<div class="alert-item warning"><span>${c.nombreCompleto}</span><span>${dias}d</span></div>`;
    });
  }

  const proximos7 = siete.filter(c => !tres.find(t => t.id === c.id));
  if (proximos7.length) {
    html += `<p style="font-size:0.75rem;color:var(--color-text-secondary);margin:0.75rem 0 0.5rem;font-weight:600;">EN 7 DÍAS (${proximos7.length})</p>`;
    proximos7.slice(0, 3).forEach(c => {
      const dias = getDaysRemaining(c.fechaVencimiento);
      html += `<div class="alert-item warning"><span>${c.nombreCompleto}</span><span>${dias}d</span></div>`;
    });
  }

  if (!html) return '<div class="empty-state"><p>Sin alertas de vencimiento</p></div>';
  return html;
}

function groupMembresiasByWeek(membresias) {
  const weeks = ['S1', 'S2', 'S3', 'S4'];
  const data = [0, 0, 0, 0];
  membresias.forEach(m => {
    const date = m.createdAt?.toDate?.() || new Date();
    const week = Math.min(Math.floor((date.getDate() - 1) / 7), 3);
    data[week]++;
  });
  return { labels: weeks, data };
}
