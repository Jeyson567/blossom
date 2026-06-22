const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function createLineChart(canvasId, labels, data, label = 'Datos') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: '#c9a227',
        backgroundColor: 'rgba(201, 162, 39, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#c9a227',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: getChartOptions()
  });
}

export function createBarChart(canvasId, labels, data, label = 'Datos') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: 'rgba(201, 162, 39, 0.7)',
        borderColor: '#c9a227',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: getChartOptions()
  });
}

export function createDoughnutChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#c9a227', '#22c55e', '#3b82f6', '#ef4444', '#a3a3a3'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#a3a3a3', padding: 16 }
        }
      }
    }
  });
}

function getChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#a3a3a3' }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#a3a3a3' },
        beginAtZero: true
      }
    }
  };
}

export function formatMonthlyLabels(data) {
  return data.map(d => MONTHS[d.mes]);
}

export function destroyChart(chart) {
  if (chart) chart.destroy();
}
