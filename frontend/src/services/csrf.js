let token = '';

export function setCsrf(valor) {
  token = valor || '';
}

export function getCsrf() {
  return token;
}
