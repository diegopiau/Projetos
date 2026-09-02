/* ==========================================================================
   auth.js — sessão + comunicação com kronusdigital.pt/dose-certa-api/
   --------------------------------------------------------------------------
   Se o backend não estiver disponível (por exemplo em file:// ou localhost
   sem servidor), a aplicação continua a funcionar em modo local. A conta só
   é oferecida quando dá para ligar ao servidor.
   ========================================================================== */

const API = '/dose-certa-api';

let emailSessao = null;    // string ou null
let backendVivo = null;    // true / false / null (ainda não sabemos)

function mesmasCredenciais(init = {}) {
  return { credentials: 'same-origin', ...init };
}

async function fetchJSON(url, init) {
  const r = await fetch(url, mesmasCredenciais(init));
  if (r.status === 204) return { status: r.status, dados: null };
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { /* texto simples */ }
  return { status: r.status, dados };
}

/** True se conseguimos falar com o backend nesta sessão. */
export function backendDisponivel() { return backendVivo === true; }

/** Email do utilizador autenticado, ou null. */
export function emailAutenticado() { return emailSessao; }

/**
 * Deteta a sessão actual. Chamar no arranque.
 * Devolve o email ou null. Marca backendVivo com base no resultado.
 */
export async function verificarSessao() {
  try {
    const { status, dados } = await fetchJSON(`${API}/me`);
    backendVivo = status < 500;   // qualquer 2xx/4xx significa que o Worker respondeu
    emailSessao = status === 200 && dados?.email ? dados.email : null;
    return emailSessao;
  } catch {
    backendVivo = false;
    emailSessao = null;
    return null;
  }
}

/** Valida email + código de 6 dígitos (alternativa ao link para iOS PWA). */
export async function validarCodigo(email, codigo) {
  const { status, dados } = await fetchJSON(`${API}/auth/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, codigo }),
  });
  if (status >= 200 && status < 300) {
    emailSessao = dados?.email ?? email;
    return { ok: true, email: emailSessao };
  }
  return { ok: false, msg: dados?.error ?? `Erro ${status}` };
}

/**
 * Login/registo com email + password. O servidor cria conta nova se o email
 * for desconhecido, ou valida contra a password existente. Devolve
 * { ok, email, modo } ou { ok:false, msg, needsPasswordReset? }.
 */
export async function entrarComPassword(email, password) {
  const { status, dados } = await fetchJSON(`${API}/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (status >= 200 && status < 300) {
    emailSessao = dados?.email ?? email;
    return { ok: true, email: emailSessao, modo: dados?.modo };
  }
  return { ok: false, msg: dados?.error ?? `Erro ${status}`, needsPasswordReset: !!dados?.needsPasswordReset };
}

/** Muda ou define password (requer sessão). */
export async function mudarPassword(novaPassword, passwordActual) {
  const { status, dados } = await fetchJSON(`${API}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novaPassword, passwordActual }),
  });
  if (status >= 200 && status < 300) return { ok: true };
  return { ok: false, msg: dados?.error ?? `Erro ${status}` };
}

/** Envia magic link para o email. */
export async function pedirLink(email) {
  const { status, dados } = await fetchJSON(`${API}/auth/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (status >= 200 && status < 300) return { ok: true, msg: dados?.msg ?? 'Verifique o email.' };
  return { ok: false, msg: dados?.error ?? `Erro ${status}` };
}

/** Termina a sessão actual. */
export async function sair() {
  try { await fetchJSON(`${API}/auth/logout`, { method: 'POST' }); } catch { /* */ }
  emailSessao = null;
}

/** GET /data — devolve o blob JSON do user (objecto vazio se novo). */
export async function baixarDados() {
  const { status, dados } = await fetchJSON(`${API}/data`);
  if (status === 200) return dados ?? {};
  if (status === 401) { emailSessao = null; throw new Error('não autenticado'); }
  throw new Error(`erro ${status}`);
}

/** PUT /data — grava o blob JSON do user. */
export async function subirDados(blob) {
  const { status, dados } = await fetchJSON(`${API}/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(blob),
  });
  if (status >= 200 && status < 300) return true;
  if (status === 401) { emailSessao = null; throw new Error('não autenticado'); }
  throw new Error(dados?.error ?? `erro ${status}`);
}

/** GET /push/config → devolve a chave pública VAPID em base64url. */
export async function pushConfig() {
  const { status, dados } = await fetchJSON(`${API}/push/config`);
  if (status !== 200 || !dados?.publicKey) throw new Error('sem VAPID key');
  return dados.publicKey;
}

/** POST /push/subscribe — regista uma subscription deste device. */
export async function subscreverPushNoServidor(subscription) {
  const { status, dados } = await fetchJSON(`${API}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription }),
  });
  if (status >= 200 && status < 300) return dados;
  if (status === 401) { emailSessao = null; throw new Error('não autenticado'); }
  throw new Error(dados?.error ?? `erro ${status}`);
}

/** POST /push/unsubscribe — remove só esta device do servidor. */
export async function unsubscreverPushNoServidor(endpoint) {
  const { status } = await fetchJSON(`${API}/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  return status >= 200 && status < 300;
}

/** POST /push/test — dispara um push imediato ao próprio user. */
export async function pushTeste() {
  const { status, dados } = await fetchJSON(`${API}/push/test`, { method: 'POST' });
  if (status >= 200 && status < 300) return dados;
  throw new Error(dados?.error ?? `erro ${status}`);
}

/** PUT /schedule — envia próximas tomas para o servidor calendarizar pushes. */
export async function subirCalendario(tomas) {
  const { status, dados } = await fetchJSON(`${API}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tomas }),
  });
  if (status >= 200 && status < 300) return dados;
  if (status === 401) { emailSessao = null; throw new Error('não autenticado'); }
  throw new Error(dados?.error ?? `erro ${status}`);
}
