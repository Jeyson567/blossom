import { filterClientesBySearch, debounce } from '../utils/helpers.js';

/**
 * Campo de búsqueda de cliente reutilizable (nombre / teléfono).
 */
export function renderClienteSearchBox({ inputId = 'cliente-search', placeholder = 'Buscar por nombre o teléfono...' } = {}) {
  return `
    <div class="search-box" style="flex:1;min-width:200px;">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      <input type="text" class="form-input" id="${inputId}" placeholder="${placeholder}" autocomplete="off">
    </div>
  `;
}

export function renderClienteSearchResults(clientes, { selectedId, max = 8 } = {}) {
  if (!clientes.length) {
    return '<p style="padding:1rem;font-size:0.875rem;color:var(--color-text-muted);text-align:center;">Sin resultados</p>';
  }
  const list = clientes.slice(0, max);
  return list.map(c => `
    <button type="button" class="cliente-search-item ${selectedId === c.id ? 'selected' : ''}" data-cliente-id="${c.id}">
      <span class="cliente-search-name">${c.nombreCompleto}</span>
      <span class="cliente-search-tel">${c.telefono || '—'}</span>
    </button>
  `).join('');
}

export function bindClienteSearch({ input, resultsEl, allClientes, onSelect, maxResults = 8, minChars = 1 }) {
  const render = (term) => {
    if (!term || term.trim().length < minChars) {
      resultsEl.innerHTML = '<p style="padding:0.75rem;font-size:0.8125rem;color:var(--color-text-muted);text-align:center;">Escriba nombre o teléfono para buscar</p>';
      return;
    }
    const filtered = filterClientesBySearch(allClientes, term);
    resultsEl.innerHTML = renderClienteSearchResults(filtered, { max: maxResults });
    resultsEl.querySelectorAll('.cliente-search-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cliente = allClientes.find(c => c.id === btn.dataset.clienteId);
        if (cliente) {
          resultsEl.querySelectorAll('.cliente-search-item').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          onSelect(cliente);
        }
      });
    });
  };

  input.addEventListener('input', debounce((e) => render(e.target.value), 200));
  render('');
}
