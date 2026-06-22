export function validateEmail(email) {
  if (!email) return 'El correo es requerido';
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) return 'Correo electrónico inválido';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'La contraseña es requerida';
  if (password.length < 6) return 'Mínimo 6 caracteres';
  return null;
}

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} es requerido`;
  }
  return null;
}

export function validatePhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return 'Teléfono inválido';
  return null;
}

export function validateDPI(dpi) {
  if (!dpi) return 'El DPI es requerido';
  const cleaned = dpi.replace(/\D/g, '');
  if (cleaned.length < 8) return 'DPI inválido';
  return null;
}

export function validatePositiveNumber(value, fieldName) {
  const num = Number(value);
  if (isNaN(num) || num < 0) return `${fieldName} debe ser un número positivo`;
  return null;
}

export function validateClienteForm(data) {
  const errors = {};

  const nombreError = validateRequired(data.nombreCompleto, 'Nombre completo');
  if (nombreError) errors.nombreCompleto = nombreError;

  const phoneError = validateRequired(data.telefono, 'Teléfono');
  if (!phoneError) {
    const invalid = validatePhone(data.telefono);
    if (invalid) errors.telefono = invalid;
  } else {
    errors.telefono = phoneError;
  }

  const generoError = validateRequired(data.genero, 'Sexo');
  if (generoError) errors.genero = generoError;

  const contactoError = validateRequired(data.contactoEmergencia, 'Contacto de emergencia');
  if (contactoError) errors.contactoEmergencia = contactoError;

  const telEmergenciaError = validateRequired(data.telefonoEmergencia, 'Teléfono de emergencia');
  if (!telEmergenciaError) {
    const invalid = validatePhone(data.telefonoEmergencia);
    if (invalid) errors.telefonoEmergencia = invalid;
  } else {
    errors.telefonoEmergencia = telEmergenciaError;
  }

  return errors;
}

export function validatePlanForm(data) {
  const errors = {};

  const nombreError = validateRequired(data.nombre, 'Nombre del plan');
  if (nombreError) errors.nombre = nombreError;

  const precioError = validatePositiveNumber(data.precio, 'Precio');
  if (precioError) errors.precio = precioError;

  const duracionError = validatePositiveNumber(data.duracionDias, 'Duración');
  if (duracionError) errors.duracionDias = duracionError;
  else if (Number(data.duracionDias) < 1) errors.duracionDias = 'Mínimo 1 día';

  return errors;
}

export function validatePagoForm(data) {
  const errors = {};

  const conceptoError = validateRequired(data.concepto, 'Concepto');
  if (conceptoError) errors.concepto = conceptoError;

  const montoError = validatePositiveNumber(data.monto, 'Monto');
  if (montoError) errors.monto = montoError;
  else if (Number(data.monto) <= 0) errors.monto = 'El monto debe ser mayor a 0';

  const metodoError = validateRequired(data.metodoPago, 'Método de pago');
  if (metodoError) errors.metodoPago = metodoError;

  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function showFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = document.querySelector(`[name="${field}"]`);
    const errorEl = document.querySelector(`[data-error="${field}"]`);
    if (input) input.classList.add('border-red-500');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  });
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
  form.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.style.borderColor = '';
  });
}
