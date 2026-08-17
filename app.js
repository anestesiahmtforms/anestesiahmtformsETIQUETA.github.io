const CONFIG = {
  storageKey: "etiqueta-hmt-ia-v1",
  authSessionKey: "etiqueta-hmt-auth-session-v1",
  authSessionBackupKey: "etiqueta-hmt-auth-session-backup-v1",
  trustedDeviceKey: "etiqueta-hmt-trusted-device-v1",
  googleClientId: "908976987584-o59p0obmvq013lg3t9726itf06e15v2c.apps.googleusercontent.com",
  trustedDeviceDays: 90,
  guideWidthRatio: 0.94,
  guideAspectRatio: 3.35,
  defaultScriptUrl: "https://script.google.com/macros/s/AKfycbzTb2EQ8iM-oB5KnxI26uBvG_ddjDLCD7G0YBov9mgLe7apX89vBECecaUnOHyRTwED/exec",
  maxSearchResults: 60,
};

const LEGACY_SCRIPT_URLS = new Set([
  "https://script.google.com/macros/s/AKfycbxyZIn0JO7eCrCOo5MdaCQkrUMuUwGB0HY_Z6j5FZ8xS5OEJ4ySQLNPaUoIz8nbbrKN/exec",
  "https://script.google.com/macros/s/AKfycbzWwukthNK5OP2itdkJ9tNR-4TZg5IfoORA8q1ke0KpLkCkKklZQJyxEpiEH0mjY0gn0w/exec",
  "https://script.google.com/macros/s/AKfycbxBLda_QQYDfl5Y47kanACt0DSL-BFbhxmOenPL18fHWM6feU0H5xaEagsrwE6rdv546A/exec",
]);

const ALERT_TYPES = new Set(["particular", "complementacao", "complementação"]);
const CREDOR_CAIXA = "Caixa";

const state = {
  stream: null,
  imageBlob: null,
  imageUrl: "",
  metadata: null,
  config: loadConfig(),
  summaryRows: [],
  summaryMode: "date",
  monthlyRows: [],
  monthlyMonth: "",
  editingRow: null,
  auth: null,
  authenticated: false,
  googleButtonRendered: false,
  googleAuthInProgress: false,
};

const cameraEl = document.querySelector("#camera");
const canvasEl = document.querySelector("#snapshot");
const previewEl = document.querySelector("#preview");
const cameraStatusEl = document.querySelector("#camera-status");
const processingStatusEl = document.querySelector("#processing-status");
const sheetStatusEl = document.querySelector("#sheet-status");
const authGateEl = document.querySelector("#auth-gate");
const authMessageEl = document.querySelector("#auth-message");
const authUserEl = document.querySelector("#auth-user");
const authGoogleButtonEl = document.querySelector("#auth-google");
const googleSigninEl = document.querySelector("#google-signin");
const homeReturnEl = document.querySelector("#home-return");
const scriptUrlEl = document.querySelector("#script-url");
const entryPanelEl = document.querySelector("#entry-panel");
const entryCloseButtonEl = document.querySelector("#close-entry-panel");
const formEl = document.querySelector("#label-form");
const summaryPanelEl = document.querySelector("#summary-panel");
const summaryPanelButtonEl = document.querySelector("#open-summary-panel");
const summaryCloseButtonEl = document.querySelector("#close-summary-panel");
const summaryDateEl = document.querySelector("#summary-date");
const summarySearchEl = document.querySelector("#summary-search");
const summarySearchButtonEl = document.querySelector("#summary-search-button");
const summaryTodayButtonEl = document.querySelector("#summary-today-button");
const reportMonthEl = document.querySelector("#report-month");
const monthlyReportButtonEl = document.querySelector("#open-monthly-report");
const monthlyPanelEl = document.querySelector("#monthly-panel");
const monthlyCloseButtonEl = document.querySelector("#close-monthly-report");
const summaryTotalsEl = document.querySelector("#summary-totals");
const summaryListEl = document.querySelector("#summary-list");
const monthlyStatusEl = document.querySelector("#monthly-status");
const monthlyListEl = document.querySelector("#monthly-list");
const sendFeedbackEl = document.querySelector("#send-feedback");
const confirmOverlayEl = document.querySelector("#confirm-overlay");
const confirmSummaryEl = document.querySelector("#confirm-summary");
const confirmSendEl = document.querySelector("#confirm-send");
const editOverlayEl = document.querySelector("#edit-overlay");
const editContextEl = document.querySelector("#edit-context");
const editSummaryEl = document.querySelector("#edit-summary");
const editFeedbackEl = document.querySelector("#edit-feedback");
const editSaveEl = document.querySelector("#edit-save");
const editCancelEl = document.querySelector("#edit-cancel");

const fields = {
  data: document.querySelector("#data"),
  nomePaciente: document.querySelector("#nomePaciente"),
  cirurgia: document.querySelector("#cirurgia"),
  atendimento: document.querySelector("#atendimento"),
  tipo: document.querySelector("#tipo"),
  credor: document.querySelector("#credor"),
  plantonistas: document.querySelector("#plantonistas"),
};

const plantonistasUi = {
  wrapper: null,
  button: null,
  panel: null,
  checks: [],
};

document.querySelector("#start-camera").addEventListener("click", startCamera);
document.querySelector("#capture-image").addEventListener("click", captureFromCamera);
document.querySelector("#upload-image")?.addEventListener("change", handleFileUpload);
document.querySelector("#process-image").addEventListener("click", processCurrentImage);
document.querySelector("#send-sheet").addEventListener("click", sendToSheet);
document.querySelector("#clear-form").addEventListener("click", resetForm);
document.querySelector("#save-settings").addEventListener("click", saveSettings);
document.querySelector("#generate-month-pdf-whatsapp").addEventListener("click", generateMonthlyPdfForWhatsApp);
authGoogleButtonEl?.addEventListener("click", authorizeDeviceWithGoogle);
homeReturnEl?.addEventListener("click", returnToHomePage);
window.addEventListener("popstate", handleBrowserBack);
summaryDateEl.addEventListener("change", () => {
  if (summarySearchEl) {
    summarySearchEl.value = "";
  }
});
summarySearchEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runSummarySearch();
  }
});
entryCloseButtonEl?.addEventListener("click", hideEntryPanel);
summaryPanelButtonEl?.addEventListener("click", openSummaryPanel);
summaryCloseButtonEl?.addEventListener("click", closeSummaryPanel);
summarySearchButtonEl?.addEventListener("click", runSummarySearch);
summaryTodayButtonEl?.addEventListener("click", resetSummaryToToday);
monthlyReportButtonEl?.addEventListener("click", toggleMonthlyReportPanel);
monthlyCloseButtonEl?.addEventListener("click", closeMonthlyReportPanel);
reportMonthEl.addEventListener("change", loadMonthlySummary);
fields.credor.addEventListener("change", syncPlantonistasRequirement);
editSaveEl?.addEventListener("click", saveEditedRecord);
editCancelEl?.addEventListener("click", closeEditRecord);
document.addEventListener("click", closePlantonistasPickerOnOutsideClick);
window.addEventListener("focus", refreshDisplayedSummaries);
window.addEventListener("pageshow", refreshDisplayedSummaries);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshDisplayedSummaries();
  }
});

bootstrap();

async function bootstrap() {
  prepareBackNavigationToHome();
  const today = getTodayISO();
  fields.data.value = today;
  summaryDateEl.value = today;
  reportMonthEl.value = "";
  scriptUrlEl.value = state.config.scriptUrl;
  setupPlantonistasPicker();
  syncPlantonistasRequirement();
  renderSheetStatus();
  const authorized = await authenticateUser();
  if (!authorized) {
    registerServiceWorker();
    return;
  }
  await initializeAuthorizedApp();
  registerServiceWorker();
}

function returnToHomePage() {
  window.location.href = "https://anestesiahmtforms.github.io/anestesiahmtformsESCALA.github.io/?from=etiquetas&skipNotice=1";
}

function prepareBackNavigationToHome() {
  if (!window.history?.pushState) {
    return;
  }

  try {
    const currentState = window.history.state || {};
    if (!currentState.etiquetaBackGuard) {
      window.history.replaceState({ ...currentState, etiquetaEntry: true }, "", window.location.href);
      window.history.pushState({ etiquetaBackGuard: true }, "", window.location.href);
    }
  } catch {
    // Se o navegador bloquear history API, o botão visual continua funcionando.
  }
}

function handleBrowserBack() {
  returnToHomePage();
}

async function authenticateUser() {
  showAuthGate("Verificando se este dispositivo ja esta autorizado...", { showButton: false });
  renderAuthStatus();

  const cachedAuth = getStoredTrustedDeviceSession();
  if (cachedAuth) {
    applyAuthenticatedUser(cachedAuth);
    hideAuthGate();
    renderAuthStatus();
    validateTrustedDeviceInBackground(cachedAuth);
    return true;
  }

  state.auth = null;
  state.authenticated = false;
  renderAuthStatus();
  await prepareGoogleLoginSurface("Se sua conta Google cadastrada ja estiver logada, o acesso sera liberado automaticamente. Se precisar entrar, toque no botao abaixo.", { showButton: true });
  return false;
}

async function authorizeDeviceWithGoogle() {
  if (!CONFIG.googleClientId) {
    showAuthGate("Login Google indisponivel neste app.", { showButton: false });
    return;
  }

  authGoogleButtonEl.disabled = true;
  await prepareGoogleLoginSurface("Escolha sua conta Google cadastrada para autorizar este dispositivo.", { showButton: true });
  authGoogleButtonEl.disabled = false;
}

async function prepareGoogleLoginSurface(message, options = {}) {
  showAuthGate(message, { showButton: options.showButton !== false });

  try {
    await waitForGoogleIdentity();
    initializeGoogleIdentity(handleGoogleCredentialResponse);
    renderGoogleSignInButton();
    window.google.accounts.id.prompt();
  } catch (error) {
    console.warn("Login Google indisponivel:", error);
    showAuthGate("Nao foi possivel abrir o login Google automaticamente. Toque abaixo para tentar novamente.", { showButton: true });
  }
}

function initializeGoogleIdentity(callback) {
  window.google.accounts.id.initialize({
    client_id: CONFIG.googleClientId,
    auto_select: true,
    cancel_on_tap_outside: false,
    itp_support: true,
    callback(response) {
      callback(response?.credential || "");
    },
  });
}

async function handleGoogleCredentialResponse(credential) {
  if (state.googleAuthInProgress) {
    return;
  }

  state.googleAuthInProgress = true;
  if (authGoogleButtonEl) {
    authGoogleButtonEl.disabled = true;
  }
  showAuthGate("Validando conta Google cadastrada...", { showButton: false });

  try {
    if (!credential) {
      throw new Error("Conta Google nao autorizada.");
    }

    const authResult = await validateGoogleCredential(credential);
    applyAuthenticatedUser({
      token: credential,
      email: String(authResult.email || "").toLowerCase(),
      name: authResult.name || "",
      expiresAt: getJwtExpirationMs(credential),
      deviceToken: getOrCreateDeviceToken(),
      trustedDeviceExpiresAt: authResult.trustedDeviceExpiresAt || getTrustedDeviceFallbackExpiry(),
    });
    persistTrustedDeviceSession();
    hideAuthGate();
    renderAuthStatus();
    await initializeAuthorizedApp();
    registerServiceWorker();
  } catch (error) {
    console.warn("Falha na autorizacao Google:", error);
    state.auth = null;
    state.authenticated = false;
    clearAuthSession();
    renderAuthStatus();
    showAuthGate("Nao foi possivel autorizar. Confira se o navegador esta logado em uma conta Google cadastrada e tente novamente.", { showButton: true });
    renderGoogleSignInButton();
  } finally {
    state.googleAuthInProgress = false;
    if (authGoogleButtonEl) {
      authGoogleButtonEl.disabled = false;
    }
  }
}

async function initializeAuthorizedApp() {
  await Promise.all([
    loadMetadata(),
    loadSummary({ silent: true }),
    loadMonthlySummary({ silent: true }),
  ]);
}

function waitForGoogleIdentity() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() - startedAt > 8000) {
        window.clearInterval(timer);
        reject(new Error("Login Google indisponivel neste navegador."));
      }
    }, 100);
  });
}

function requestGoogleCredential() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Conta Google nao identificada automaticamente."));
      }
    }, 60000);

    const finish = (credential) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      if (credential) {
        resolve(credential);
      } else {
        reject(new Error("Conta Google nao autorizada."));
      }
    };

    window.google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      auto_select: true,
      cancel_on_tap_outside: false,
      itp_support: true,
      callback(response) {
        finish(response?.credential || "");
      },
    });

    renderGoogleSignInButton();

    window.google.accounts.id.prompt((notification) => {
      if (settled) {
        return;
      }
      if (notification.isDismissedMoment?.() || notification.isSkippedMoment?.() || notification.isNotDisplayed?.()) {
        authGoogleButtonEl.hidden = false;
        if (googleSigninEl) {
          googleSigninEl.hidden = false;
        }
      }
    });
  });
}

function renderGoogleSignInButton() {
  if (!googleSigninEl || !window.google?.accounts?.id) {
    return;
  }

  if (state.googleButtonRendered) {
    googleSigninEl.hidden = false;
    return;
  }

  googleSigninEl.innerHTML = "";
  googleSigninEl.hidden = false;
  window.google.accounts.id.renderButton(googleSigninEl, {
    type: "icon",
    theme: "outline",
    size: "large",
    shape: "circle",
  });
  state.googleButtonRendered = true;
}

function applyAuthenticatedUser(auth) {
  state.auth = {
    token: auth.token || "",
    email: String(auth.email || "").toLowerCase(),
    name: auth.name || "",
    expiresAt: Number(auth.expiresAt || 0),
    deviceToken: auth.deviceToken || "",
    trustedDeviceExpiresAt: auth.trustedDeviceExpiresAt || "",
  };
  state.authenticated = Boolean((state.auth.token || state.auth.deviceToken) && state.auth.email);
}

function persistTrustedDeviceSession() {
  if (!state.auth?.deviceToken || !state.auth?.email || !state.auth?.trustedDeviceExpiresAt) {
    return;
  }

  try {
    const serialized = JSON.stringify(state.auth);
    localStorage.setItem(CONFIG.authSessionKey, serialized);
    sessionStorage.setItem(CONFIG.authSessionBackupKey, serialized);
  } catch (error) {
    console.warn("Nao foi possivel salvar dispositivo confiavel:", error);
  }
}

async function restoreTrustedDeviceSession() {
  try {
    const saved = getStoredTrustedDeviceSession();
    if (!saved) {
      return null;
    }

    return await validateTrustedDevice(saved);
  } catch (error) {
    console.warn("Dispositivo confiavel nao validado:", error);
    clearAuthSession();
    return null;
  }
}

function getStoredTrustedDeviceSession() {
  try {
    const raw = localStorage.getItem(CONFIG.authSessionKey) || sessionStorage.getItem(CONFIG.authSessionBackupKey) || "null";
    const saved = JSON.parse(raw);
    if (!saved?.deviceToken || !saved?.email || !saved?.trustedDeviceExpiresAt) {
      return null;
    }

    if (Date.parse(saved.trustedDeviceExpiresAt) <= Date.now() + 120000) {
      clearAuthSession();
      return null;
    }

    return saved;
  } catch {
    clearAuthSession();
    return null;
  }
}

async function validateTrustedDeviceInBackground(savedAuth) {
  try {
    const validated = await validateTrustedDevice(savedAuth);
    applyAuthenticatedUser(validated);
    persistTrustedDeviceSession();
    renderAuthStatus();
  } catch (error) {
    console.warn("Validacao em segundo plano nao concluida; mantendo dispositivo local autorizado:", error);
  }
}

function clearAuthSession() {
  try {
    localStorage.removeItem(CONFIG.authSessionKey);
    sessionStorage.removeItem(CONFIG.authSessionBackupKey);
  } catch {
    // Sessao indisponivel; sem impacto funcional.
  }
}

async function validateGoogleCredential(idToken) {
  if (!state.config.scriptUrl) {
    throw new Error("URL do Apps Script nao configurada.");
  }

  const deviceToken = getOrCreateDeviceToken();
  const response = await fetch(state.config.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "auth",
      authToken: idToken,
      deviceToken,
    }),
  });
  const result = await response.json();

  if (!response.ok || result.ok !== true) {
    throw new Error(result.message || "Conta Google nao autorizada.");
  }

  return result;
}

async function validateTrustedDevice(savedAuth) {
  if (!state.config.scriptUrl) {
    throw new Error("URL do Apps Script nao configurada.");
  }

  const response = await fetch(state.config.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "auth",
      deviceToken: savedAuth.deviceToken,
      userEmail: savedAuth.email,
    }),
  });
  const result = await response.json();

  if (!response.ok || result.ok !== true) {
    throw new Error(result.message || "Dispositivo nao autorizado.");
  }

  return {
    ...savedAuth,
    email: String(result.email || savedAuth.email || "").toLowerCase(),
    name: result.name || savedAuth.name || "",
    trustedDeviceExpiresAt: result.trustedDeviceExpiresAt || savedAuth.trustedDeviceExpiresAt || getTrustedDeviceFallbackExpiry(),
    token: "",
  };
}

function getOrCreateDeviceToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.trustedDeviceKey) || "null");
    if (saved?.deviceToken && /^[a-f0-9]{64}$/i.test(saved.deviceToken)) {
      return saved.deviceToken.toLowerCase();
    }
  } catch {
    // Recria abaixo.
  }

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const deviceToken = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(CONFIG.trustedDeviceKey, JSON.stringify({ deviceToken, createdAt: new Date().toISOString() }));
  return deviceToken;
}

function getTrustedDeviceFallbackExpiry() {
  return new Date(Date.now() + CONFIG.trustedDeviceDays * 24 * 60 * 60 * 1000).toISOString();
}

function showAuthGate(message, options = {}) {
  if (authMessageEl) {
    authMessageEl.textContent = message;
  }
  if (authGoogleButtonEl) {
    authGoogleButtonEl.hidden = !options.showButton;
  }
  if (googleSigninEl) {
    googleSigninEl.hidden = true;
  }
  authGateEl?.removeAttribute("hidden");
  document.body.classList.add("auth-locked");
}

function hideAuthGate() {
  if (authGoogleButtonEl) {
    authGoogleButtonEl.hidden = true;
  }
  if (googleSigninEl) {
    googleSigninEl.hidden = true;
  }
  authGateEl?.setAttribute("hidden", "");
  document.body.classList.remove("auth-locked");
}

function renderAuthStatus() {
  if (!authUserEl) {
    return;
  }

  if (state.authenticated && state.auth?.email) {
    authUserEl.textContent = state.auth.email;
    authUserEl.className = "status-pill";
    return;
  }

  authUserEl.textContent = "Acesso restrito";
  authUserEl.className = "status-pill neutral";
}

function getJwtExpirationMs(token) {
  try {
    const [, payload] = String(token || "").split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return Number(json.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function ensureAuthenticated() {
  if (!state.authenticated || (!state.auth?.token && !state.auth?.deviceToken)) {
    const savedAuth = getStoredTrustedDeviceSession();
    if (savedAuth) {
      applyAuthenticatedUser(savedAuth);
      hideAuthGate();
      renderAuthStatus();
    }
  }
  if (!state.authenticated || (!state.auth?.token && !state.auth?.deviceToken)) {
    throw new Error("Você precisa estar logado em sua conta Google Cadastrada para entrar");
  }

  if (state.auth.trustedDeviceExpiresAt && Date.parse(state.auth.trustedDeviceExpiresAt) <= Date.now() + 60000) {
    state.authenticated = false;
    clearAuthSession();
    renderAuthStatus();
    showAuthGate("Você precisa estar logado em sua conta Google Cadastrada para entrar");
    throw new Error("Você precisa estar logado em sua conta Google Cadastrada para entrar");
  }

  if (!state.auth.deviceToken && state.auth.expiresAt && Date.now() > state.auth.expiresAt - 60000) {
    state.authenticated = false;
    clearAuthSession();
    renderAuthStatus();
    showAuthGate("Você precisa estar logado em sua conta Google Cadastrada para entrar");
    throw new Error("Você precisa estar logado em sua conta Google Cadastrada para entrar");
  }

  return state.auth;
}

function addAuthToUrl(url) {
  const auth = ensureAuthenticated();
  if (auth.token && (!auth.expiresAt || Date.now() <= auth.expiresAt - 60000)) {
    url.searchParams.set("authToken", auth.token);
  }
  if (auth.deviceToken) {
    url.searchParams.set("deviceToken", auth.deviceToken);
  }
  if (auth.email) {
    url.searchParams.set("userEmail", auth.email);
  }
  return url;
}

function withAuthPayload(payload) {
  const auth = ensureAuthenticated();
  const authFields = {};
  if (auth.token && (!auth.expiresAt || Date.now() <= auth.expiresAt - 60000)) {
    authFields.authToken = auth.token;
  }
  if (auth.deviceToken) {
    authFields.deviceToken = auth.deviceToken;
  }

  return {
    ...payload,
    ...authFields,
    userEmail: auth.email || payload.userEmail || "",
  };
}

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "{}");
    const savedUrl = String(saved.scriptUrl || "").trim();
    return {
      scriptUrl: savedUrl && !LEGACY_SCRIPT_URLS.has(savedUrl) ? savedUrl : CONFIG.defaultScriptUrl,
    };
  } catch {
    return { scriptUrl: CONFIG.defaultScriptUrl };
  }
}

async function saveSettings() {
  state.config.scriptUrl = scriptUrlEl.value.trim();
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.config));
  renderSheetStatus();
  await initializeAuthorizedApp();
  setStatus("URL do Apps Script salva neste aparelho.", "success");
}

function renderSheetStatus() {
  if (state.config.scriptUrl && state.metadata?.spreadsheetName) {
    sheetStatusEl.textContent = state.metadata.spreadsheetName;
    sheetStatusEl.className = "status-pill";
    return;
  }

  if (state.config.scriptUrl) {
    sheetStatusEl.textContent = "Planilha configurada";
    sheetStatusEl.className = "status-pill";
    return;
  }

  sheetStatusEl.textContent = "Planilha nao configurada";
  sheetStatusEl.className = "status-pill neutral";
}

async function loadMetadata() {
  if (!state.config.scriptUrl) {
    state.metadata = null;
    renderSheetStatus();
    return;
  }

  try {
    const url = new URL(state.config.scriptUrl);
    url.searchParams.set("action", "metadata");
    addAuthToUrl(url);
    const response = await fetch(url.toString(), { method: "GET" });
    const result = await response.json();

    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "Falha ao carregar metadados.");
    }

    state.metadata = result;
  } catch (error) {
    console.warn("Falha ao carregar metadados:", error);
    state.metadata = null;
  } finally {
    renderSheetStatus();
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Falha ao registrar service worker:", error);
  }
}

async function startCamera() {
  try {
    stopCamera();
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 2560 },
        height: { ideal: 1440 },
        focusMode: { ideal: "continuous" },
        exposureMode: { ideal: "continuous" },
      },
      audio: false,
    });

    cameraEl.srcObject = state.stream;
    await cameraEl.play();
    cameraStatusEl.textContent = "Camera ativa";
    cameraStatusEl.className = "status-pill";
    document.querySelector("#capture-image").disabled = false;
    setStatus("Camera pronta. Centralize a etiqueta e capture.", "info");
  } catch (error) {
    cameraStatusEl.textContent = "Sem acesso";
    cameraStatusEl.className = "status-pill error";
    setStatus(`Nao foi possivel abrir a camera: ${error.message}`, "error");
  }
}

function stopCamera() {
  if (!state.stream) {
    return;
  }

  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  cameraEl.srcObject = null;
  cameraStatusEl.textContent = "Camera desligada";
  cameraStatusEl.className = "status-pill neutral";
}

async function captureFromCamera() {
  if (!state.stream) {
    setStatus("Abra a camera antes de capturar.", "error");
    return;
  }

  const crop = getGuideCropRect(cameraEl.videoWidth, cameraEl.videoHeight);
  canvasEl.width = crop.width;
  canvasEl.height = crop.height;

  const context = canvasEl.getContext("2d", { willReadFrequently: true });
  context.drawImage(cameraEl, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  const blob = await new Promise((resolve) => canvasEl.toBlob(resolve, "image/jpeg", 0.98));
  setImageBlob(blob);
  setStatus("Etiqueta capturada. Toque em Ler com IA.", "success");
}

function handleFileUpload(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  setImageBlob(file);
  stopCamera();
  cameraStatusEl.textContent = "Foto enviada";
  cameraStatusEl.className = "status-pill neutral";
  setStatus("Foto carregada. Toque em Ler com IA.", "success");
}

function setImageBlob(blob) {
  state.imageBlob = blob;
  if (state.imageUrl) {
    URL.revokeObjectURL(state.imageUrl);
  }

  state.imageUrl = URL.createObjectURL(blob);
  previewEl.src = state.imageUrl;
  previewEl.classList.add("has-image");
  document.querySelector("#process-image").disabled = false;
}

function getGuideCropRect(sourceWidth, sourceHeight) {
  const targetWidth = Math.round(sourceWidth * CONFIG.guideWidthRatio);
  const targetHeight = Math.round(targetWidth / CONFIG.guideAspectRatio);
  const fittedHeight = Math.min(targetHeight, Math.round(sourceHeight * 0.74));
  const fittedWidth = Math.min(targetWidth, Math.round(fittedHeight * CONFIG.guideAspectRatio));

  return {
    width: fittedWidth,
    height: fittedHeight,
    x: Math.max(0, Math.round((sourceWidth - fittedWidth) / 2)),
    y: Math.max(0, Math.round((sourceHeight - fittedHeight) / 2)),
  };
}

async function processCurrentImage() {
  if (!state.imageBlob) {
    setStatus("Capture ou escolha uma imagem primeiro.", "error");
    return;
  }

  if (!state.config.scriptUrl) {
    setStatus("Salve primeiro a URL do Google Apps Script.", "error");
    return;
  }

  stopCamera();
  toggleBusy(true);
  setStatus("Lendo etiqueta com IA...", "info");

  try {
    const parsed = await extractLabelWithAi(state.imageBlob);
    applyDataToForm(parsed);
    showEntryPanel();

    const missing = ["nomePaciente", "cirurgia", "atendimento"].filter((key) => !parsed[key]);
    const qualityNote = missing.length ? " Confira a foto e tente novamente com a etiqueta inteira mais nitida." : "";
    const missingNote = missing.length ? ` Confira manualmente: ${missing.join(", ")}.` : "";
    setStatus(`Leitura com IA concluida.${missingNote}${qualityNote}`, missing.length ? "info" : "success");
  } catch (error) {
    console.error(error);
    setStatus(`Falha na leitura com IA: ${error.message}`, "error");
  } finally {
    toggleBusy(false);
  }
}

async function extractLabelWithAi(imageBlob) {
  const imageDataUrl = await blobToDataUrl(imageBlob);
  const url = new URL(state.config.scriptUrl);
  url.searchParams.set("action", "aiExtract");
  addAuthToUrl(url);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(withAuthPayload({
      action: "aiExtract",
      imageDataUrl,
    })),
  });

  const result = await response.json();
  if (!response.ok || result.ok !== true) {
    throw new Error(result.message || "Resposta invalida do Apps Script.");
  }

  return {
    nomePaciente: String(result.nomePaciente || "").trim(),
    cirurgia: cleanDigits(result.cirurgia || ""),
    atendimento: cleanDigits(result.atendimento || ""),
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao preparar imagem."));
    reader.readAsDataURL(blob);
  });
}

function normalizeText(text) {
  return String(text || "")
    .replace(/[|]/g, "I")
    .replace(/[“”"]/g, "")
    .replace(/[‘’]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\S\r\n]+/g, " ");
}

function cleanDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function applyDataToForm(data) {
  if (data.nomePaciente) {
    fields.nomePaciente.value = data.nomePaciente;
  }
  if (data.cirurgia) {
    fields.cirurgia.value = data.cirurgia;
  }
  if (data.atendimento) {
    fields.atendimento.value = data.atendimento;
  }
}

function showEntryPanel(options = {}) {
  if (!entryPanelEl) {
    return;
  }

  movePanelToModalLayer(entryPanelEl);
  entryPanelEl.hidden = false;
  entryPanelEl.classList.add("is-open");
  syncModalLock();
  if (options.scroll !== false) {
    entryPanelEl.scrollTop = 0;
  }
}

function hideEntryPanel() {
  if (!entryPanelEl) {
    return;
  }

  entryPanelEl.hidden = true;
  entryPanelEl.classList.remove("is-open");
  syncModalLock();
}

function openSummaryPanel() {
  if (!summaryPanelEl) {
    return;
  }

  movePanelToModalLayer(summaryPanelEl);
  summaryPanelEl.hidden = false;
  summaryPanelEl.classList.add("is-open");
  syncModalLock();
  if (!summaryDateEl.value) {
    summaryDateEl.value = getTodayISO();
  }
  if (!summarySearchEl?.value.trim()) {
    loadSummary({ silent: true, date: summaryDateEl.value || getTodayISO() });
  }
}

function closeSummaryPanel() {
  if (!summaryPanelEl) {
    return;
  }

  summaryPanelEl.hidden = true;
  summaryPanelEl.classList.remove("is-open");
  syncModalLock();
}

function openMonthlyReportPanel() {
  if (!monthlyPanelEl) {
    return;
  }

  movePanelToModalLayer(monthlyPanelEl);
  monthlyPanelEl.hidden = false;
  monthlyPanelEl.classList.add("is-open");
  monthlyReportButtonEl?.setAttribute("aria-expanded", "true");
  if (!reportMonthEl.value) {
    renderMonthlyStatus("Escolha um mes para carregar os registros.", "neutral");
    renderMonthlyList([], "Os registros aparecem somente depois de selecionar um mes.");
  }
  syncModalLock();
}

function closeMonthlyReportPanel() {
  if (!monthlyPanelEl) {
    return;
  }

  monthlyPanelEl.hidden = true;
  monthlyPanelEl.classList.remove("is-open");
  monthlyReportButtonEl?.setAttribute("aria-expanded", "false");
  syncModalLock();
}

function syncModalLock() {
  const hasOpenPanel = [entryPanelEl, summaryPanelEl, monthlyPanelEl].some((panel) => panel && !panel.hidden);
  document.body.classList.toggle("modal-open", hasOpenPanel);
}

function movePanelToModalLayer(panel) {
  if (!panel || panel.parentElement === document.body) {
    return;
  }

  document.body.appendChild(panel);
}

function collectFormData() {
  const isCaixa = fields.credor.value.trim() === CREDOR_CAIXA;
  return {
    data: fields.data.value,
    nomePaciente: fields.nomePaciente.value.trim(),
    cirurgia: fields.cirurgia.value.trim(),
    atendimento: fields.atendimento.value.trim(),
    tipo: fields.tipo.value.trim(),
    credor: fields.credor.value.trim(),
    plantonistas: isCaixa ? "" : getSelectedPlantonistasValue(),
    observacoes: "",
    userEmail: state.auth?.email || "",
    userAgent: navigator.userAgent,
  };
}

async function sendToSheet() {
  setSendFeedback("", "neutral");

  if (!state.config.scriptUrl) {
    showSendError("Salve primeiro a URL do Google Apps Script.");
    return;
  }

  let payload = collectFormData();
  await loadSummary({ silent: true, date: payload.data || getTodayISO() });
  const duplicateRows = findExactDuplicates(payload);
  const confirmation = await confirmSubmissionEditable(payload, duplicateRows);
  const confirmed = confirmation.confirmed;
  if (!confirmed) {
    setSendFeedback("Envio cancelado para conferencia.", "neutral");
    setStatus("Envio cancelado para conferencia.", "info");
    return;
  }

  if (confirmation.duplicateJustification) {
    payload = confirmation.payload;
    applyConfirmationPayloadToForm(payload);
    payload.duplicateJustification = confirmation.duplicateJustification;
    payload.observacoes = `Duplicidade justificada: ${confirmation.duplicateJustification}`;
  } else {
    payload = confirmation.payload;
    applyConfirmationPayloadToForm(payload);
  }

  toggleBusy(true);
  setSendFeedback("Enviando para a planilha...", "neutral");
  setStatus("Enviando para a planilha...", "info");

  try {
    const response = await fetch(state.config.scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(withAuthPayload(payload)),
    });

    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "Resposta invalida do Apps Script.");
    }

    const sentDate = payload.data;
    resetForm({ keepImage: false, keepDate: sentDate });
    summaryDateEl.value = sentDate;
    reportMonthEl.value = sentDate.slice(0, 7);
    await Promise.all([
      loadSummary({ silent: true }),
      loadMonthlySummary({ silent: true }),
    ]);
    setSendFeedback("Dados enviados com sucesso!", "success");
    setStatus("Dados enviados com sucesso!", "success");
  } catch (error) {
    showSendError(`Falha ao enviar para a planilha: ${error.message}`);
  } finally {
    toggleBusy(false);
  }
}

function showSendError(message) {
  setSendFeedback(message, "error");
  setStatus(message, "error");
  sendFeedbackEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setSendFeedback(message, tone = "neutral") {
  if (!sendFeedbackEl) {
    return;
  }

  sendFeedbackEl.textContent = message;
  sendFeedbackEl.dataset.tone = tone;
  sendFeedbackEl.hidden = !message;
}

function findExactDuplicates(payload) {
  return state.summaryRows.filter((row) =>
    normalizeDateKey(row.data) === normalizeDateKey(payload.data) &&
    normalizeCompare(row.nomePaciente) === normalizeCompare(payload.nomePaciente) &&
    cleanDigits(row.cirurgia) === cleanDigits(payload.cirurgia) &&
    cleanDigits(row.atendimento) === cleanDigits(payload.atendimento) &&
    normalizeCompare(row.tipo) === normalizeCompare(payload.tipo) &&
    normalizeCompare(row.credor) === normalizeCompare(payload.credor) &&
    normalizeCompare(row.plantonistas || "") === normalizeCompare(payload.plantonistas || "")
  );
}

function confirmSubmission(payload, duplicateRows = []) {
  if (!confirmOverlayEl || !confirmSummaryEl || !confirmSendEl || !cancelSendEl) {
    return Promise.resolve({ confirmed: false, duplicateJustification: "" });
  }

  const duplicateWarning = duplicateRows.length ? `
    <div class="duplicate-warning">
      <strong>Atenção: possível lançamento duplicado.</strong>
      <span>Já existe ${duplicateRows.length} registro(s) com exatamente os mesmos dados nesta data. Justifique para continuar.</span>
      <label>
        <span>Justificativa da duplicidade</span>
        <textarea id="duplicate-justification" rows="3" placeholder="Explique por que este lançamento deve ser repetido"></textarea>
      </label>
      <small id="duplicate-warning-feedback" hidden>Informe a justificativa para enviar este lançamento duplicado.</small>
    </div>
  ` : "";

  confirmSummaryEl.innerHTML = `
    <dl>
      <div><dt>Data</dt><dd>${escapeHtml(formatDate(payload.data))}</dd></div>
      <div><dt>Nome</dt><dd>${escapeHtml(payload.nomePaciente)}</dd></div>
      <div><dt>Cirurgia</dt><dd>${escapeHtml(payload.cirurgia)}</dd></div>
      <div><dt>Atendimento</dt><dd>${escapeHtml(payload.atendimento)}</dd></div>
      <div><dt>Tipo</dt><dd>${escapeHtml(payload.tipo)}</dd></div>
      <div><dt>Credor</dt><dd>${escapeHtml(payload.credor)}</dd></div>
      <div><dt>Plantonista(s)</dt><dd>${escapeHtml(payload.plantonistas || "Nao necessario")}</dd></div>
    </dl>
    ${duplicateWarning}
  `;

  confirmOverlayEl.hidden = false;
  confirmSendEl.focus();

  return new Promise((resolve) => {
    const finish = (confirmed, duplicateJustification = "") => {
      confirmOverlayEl.hidden = true;
      confirmSendEl.removeEventListener("click", onConfirm);
      cancelSendEl.removeEventListener("click", onCancel);
      confirmOverlayEl.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
      resolve({ confirmed, duplicateJustification });
    };

    const onConfirm = () => {
      if (duplicateRows.length) {
        const justificationEl = confirmSummaryEl.querySelector("#duplicate-justification");
        const feedbackEl = confirmSummaryEl.querySelector("#duplicate-warning-feedback");
        const justification = justificationEl?.value.trim() || "";
        if (!justification) {
          if (feedbackEl) {
            feedbackEl.hidden = false;
          }
          justificationEl?.focus();
          return;
        }
        finish(true, justification);
        return;
      }

      finish(true);
    };
    const onCancel = () => finish(false);
    const onBackdrop = (event) => {
      if (event.target === confirmOverlayEl) {
        finish(false);
      }
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        finish(false);
      }
    };

    confirmSendEl.addEventListener("click", onConfirm);
    cancelSendEl.addEventListener("click", onCancel);
    confirmOverlayEl.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
  });
}

function confirmSubmissionEditable(payload, duplicateRows = []) {
  if (!confirmOverlayEl || !confirmSummaryEl || !confirmSendEl) {
    return Promise.resolve({ confirmed: false, payload, duplicateJustification: "" });
  }

  let currentPayload = { ...payload };
  let currentDuplicateRows = duplicateRows;

  const renderConfirmationFields = (feedback = "") => {
    const duplicateWarning = currentDuplicateRows.length ? `
      <div class="duplicate-warning">
        <strong>Atenção: possível lançamento duplicado.</strong>
        <span>Já existe ${currentDuplicateRows.length} registro(s) com exatamente os mesmos dados nesta data. Justifique para continuar.</span>
        <label>
          <span>Justificativa da duplicidade</span>
          <textarea id="duplicate-justification" rows="3" placeholder="Explique por que este lançamento deve ser repetido">${escapeHtml(currentPayload.duplicateJustification || "")}</textarea>
        </label>
      </div>
    ` : "";

    confirmSummaryEl.innerHTML = `
      <div class="confirm-edit-grid">
        <label>
          <span>Data</span>
          <input id="confirm-data" type="date" value="${escapeHtml(currentPayload.data || "")}" required>
        </label>
        <label class="full-width">
          <span>Nome do Paciente</span>
          <input id="confirm-nomePaciente" type="text" value="${escapeHtml(currentPayload.nomePaciente || "")}" required>
        </label>
        <label>
          <span>Cirurgia</span>
          <input id="confirm-cirurgia" inputmode="numeric" value="${escapeHtml(currentPayload.cirurgia || "")}" required>
        </label>
        <label>
          <span>Atendimento</span>
          <input id="confirm-atendimento" inputmode="numeric" value="${escapeHtml(currentPayload.atendimento || "")}" required>
        </label>
        <label>
          <span>Tipo</span>
          <select id="confirm-tipo" required>
            ${renderOption("", "Selecione", currentPayload.tipo)}
            ${renderOption("Particular", "Particular", currentPayload.tipo)}
            ${renderOption("Complementação", "Complementação", currentPayload.tipo)}
            ${renderOption("Unimed", "Unimed", currentPayload.tipo)}
            ${renderOption("Outros", "Outros", currentPayload.tipo)}
          </select>
        </label>
        <label>
          <span>Credor</span>
          <select id="confirm-credor" required>
            ${renderOption("", "Selecione", currentPayload.credor)}
            ${renderOption("Caixa", "Caixa", currentPayload.credor)}
            ${renderOption("Plantão", "Plantão", currentPayload.credor)}
            ${renderOption("Plantão/Caixa", "Plantão/Caixa", currentPayload.credor)}
          </select>
        </label>
        <label class="full-width">
          <span>Plantonista(s)</span>
          <input id="confirm-plantonistas" type="text" value="${escapeHtml(currentPayload.plantonistas || "")}" placeholder="Nao necessario quando Credor for Caixa">
        </label>
      </div>
      ${duplicateWarning}
      <p id="confirm-edit-feedback" class="confirm-edit-feedback" ${feedback ? "" : "hidden"}>${escapeHtml(feedback)}</p>
    `;
  };

  renderConfirmationFields();
  confirmOverlayEl.hidden = false;
  confirmSendEl.focus();

  return new Promise((resolve) => {
    const finish = (confirmed, finalPayload = currentPayload, duplicateJustification = "") => {
      confirmOverlayEl.hidden = true;
      confirmSendEl.removeEventListener("click", onConfirm);
      confirmOverlayEl.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
      resolve({ confirmed, payload: finalPayload, duplicateJustification });
    };

    const onConfirm = async () => {
      currentPayload = collectConfirmationPayload(currentPayload);
      const missing = getMissingRequiredFields(currentPayload);
      if (missing.length) {
        renderConfirmationFields("Corrija os campos obrigatórios antes de confirmar o envio.");
        return;
      }

      await loadSummary({ silent: true, date: currentPayload.data });
      currentDuplicateRows = findExactDuplicates(currentPayload);
      const duplicateJustification = currentPayload.duplicateJustification || "";
      if (currentDuplicateRows.length && !duplicateJustification) {
        renderConfirmationFields("Informe a justificativa para enviar este lançamento duplicado.");
        confirmSummaryEl.querySelector("#duplicate-justification")?.focus();
        return;
      }

      finish(true, currentPayload, duplicateJustification);
    };
    const onBackdrop = (event) => {
      if (event.target === confirmOverlayEl) {
        finish(false);
      }
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        finish(false);
      }
    };

    confirmSendEl.addEventListener("click", onConfirm);
    confirmOverlayEl.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
  });
}

function renderOption(value, label, selectedValue) {
  const selected = String(value) === String(selectedValue || "") ? " selected" : "";
  return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
}

function collectConfirmationPayload(basePayload) {
  const credor = confirmSummaryEl.querySelector("#confirm-credor")?.value.trim() || "";
  const duplicateJustification = confirmSummaryEl.querySelector("#duplicate-justification")?.value.trim() || "";

  return {
    ...basePayload,
    data: confirmSummaryEl.querySelector("#confirm-data")?.value || "",
    nomePaciente: confirmSummaryEl.querySelector("#confirm-nomePaciente")?.value.trim() || "",
    cirurgia: cleanDigits(confirmSummaryEl.querySelector("#confirm-cirurgia")?.value || ""),
    atendimento: cleanDigits(confirmSummaryEl.querySelector("#confirm-atendimento")?.value || ""),
    tipo: confirmSummaryEl.querySelector("#confirm-tipo")?.value.trim() || "",
    credor,
    plantonistas: credor === CREDOR_CAIXA ? "" : (confirmSummaryEl.querySelector("#confirm-plantonistas")?.value.trim() || ""),
    duplicateJustification,
  };
}

function getMissingRequiredFields(payload) {
  const required = ["data", "nomePaciente", "cirurgia", "atendimento", "tipo", "credor"];
  if (payload.credor !== CREDOR_CAIXA) {
    required.push("plantonistas");
  }

  return required.filter((key) => !String(payload[key] || "").trim());
}

function applyConfirmationPayloadToForm(payload) {
  fields.data.value = payload.data || fields.data.value;
  fields.nomePaciente.value = payload.nomePaciente || "";
  fields.cirurgia.value = payload.cirurgia || "";
  fields.atendimento.value = payload.atendimento || "";
  fields.tipo.value = payload.tipo || "";
  fields.credor.value = payload.credor || "";
  setSelectedPlantonistasFromValue(payload.plantonistas || "");
  syncPlantonistasRequirement();
}

async function refreshDisplayedSummaries() {
  if (!state.config.scriptUrl) {
    return;
  }

  await Promise.all([
    loadSummary({ silent: true }),
    loadMonthlySummary({ silent: true }),
  ]);
}

async function loadSummary(options = {}) {
  if (!state.config.scriptUrl) {
    state.summaryRows = [];
    renderSummary([], "Configure a URL do Apps Script para carregar o resumo.");
    return;
  }

  try {
    const query = summarySearchEl?.value.trim() || "";
    const url = new URL(state.config.scriptUrl);
    if (query) {
      url.searchParams.set("action", "search");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(CONFIG.maxSearchResults));
      state.summaryMode = "search";
    } else {
      url.searchParams.set("action", "summary");
      url.searchParams.set("date", options.date || summaryDateEl.value || getTodayISO());
      state.summaryMode = "date";
    }
    addAuthToUrl(url);
    const response = await fetch(url.toString(), { method: "GET" });
    const result = await response.json();

    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "Falha ao carregar resumo.");
    }

    state.summaryRows = result.entries || [];
    renderSummary(
      state.summaryRows,
      query ? "Nenhum registro encontrado para esta busca." : "Nenhuma entrada encontrada nesta data."
    );
    if (!options.silent) {
      setStatus(query ? "Busca carregada." : "Resumo carregado.", "success");
    }
  } catch (error) {
    state.summaryRows = [];
    renderSummary([], `Nao foi possivel carregar o resumo: ${error.message}`);
    if (!options.silent) {
      setStatus(`Falha ao carregar resumo: ${error.message}`, "error");
    }
  }
}

function runSummarySearch() {
  const query = summarySearchEl?.value.trim() || "";
  if (!query) {
    loadSummary({ silent: false, date: summaryDateEl?.value || getTodayISO() });
    return;
  }

  loadSummary({ silent: false });
}

function resetSummaryToToday() {
  if (summarySearchEl) {
    summarySearchEl.value = "";
  }
  if (summaryDateEl) {
    summaryDateEl.value = getTodayISO();
  }
  loadSummary({ silent: false, date: getTodayISO() });
}

async function loadMonthlySummary(options = {}) {
  if (!state.config.scriptUrl) {
    state.monthlyRows = [];
    state.monthlyMonth = "";
    renderMonthlyStatus("Configure a URL do Apps Script para atualizar o relatorio mensal.", "error");
    renderMonthlyList([], "Configure a integracao para carregar os registros.");
    return;
  }

  const month = reportMonthEl.value;
  if (!month) {
    state.monthlyRows = [];
    state.monthlyMonth = "";
    renderMonthlyStatus("Escolha um mes para carregar os registros.", "neutral");
    renderMonthlyList([], "Os registros aparecem somente depois de selecionar um mes.");
    return;
  }

  try {
    state.monthlyRows = await loadMonthlyEntries(month);
    state.monthlyMonth = month;
    const alertCount = state.monthlyRows.filter((row) => isAlertType(row.tipo)).length;
    const updatedAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    renderMonthlyStatus(
      `${state.monthlyRows.length} entrada(s) em ${formatMonth(month)}. ${alertCount} alerta(s). Atualizado as ${updatedAt}.`,
      state.monthlyRows.length ? "success" : "neutral"
    );
    renderMonthlyList(state.monthlyRows, "Nenhum registro encontrado para este mes.");

    if (!options.silent) {
      setStatus("Relatorio mensal atualizado.", "success");
    }
  } catch (error) {
    state.monthlyRows = [];
    state.monthlyMonth = "";
    renderMonthlyStatus(`Nao foi possivel atualizar o relatorio mensal: ${error.message}`, "error");
    renderMonthlyList([], "Nao foi possivel carregar os registros deste mes.");
    if (!options.silent) {
      setStatus(`Falha ao atualizar relatorio mensal: ${error.message}`, "error");
    }
  }
}

function renderMonthlyStatus(message, tone = "neutral") {
  monthlyStatusEl.textContent = message;
  monthlyStatusEl.dataset.tone = tone;
}

function renderMonthlyList(rows, emptyMessage = "Nenhum registro encontrado para este mes.") {
  if (!monthlyListEl) {
    return;
  }

  if (!rows.length) {
    monthlyListEl.innerHTML = `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  monthlyListEl.innerHTML = `
    <div class="monthly-table-wrap">
      <table class="monthly-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Paciente</th>
            <th>Cirurgia</th>
            <th>Atendimento</th>
            <th>Tipo</th>
            <th>Credor</th>
            <th>Plantonista(s)</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr class="${isAlertType(row.tipo) ? "alert-row" : ""}">
              <td>${escapeHtml(formatDate(row.data || ""))}</td>
              <td>${escapeHtml(row.nomePaciente || "")}</td>
              <td>${escapeHtml(row.cirurgia || "")}</td>
              <td>${escapeHtml(row.atendimento || "")}</td>
              <td>${escapeHtml(row.tipo || "")}</td>
              <td>${escapeHtml(row.credor || "")}</td>
              <td>${escapeHtml(row.plantonistas || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function toggleMonthlyReportPanel() {
  if (!monthlyPanelEl) {
    return;
  }

  if (monthlyPanelEl.hidden) {
    openMonthlyReportPanel();
  } else {
    closeMonthlyReportPanel();
  }
}

function renderSummary(rows, emptyMessage = "Nenhuma entrada encontrada nesta data.") {
  summaryTotalsEl.innerHTML = "";

  if (!rows.length) {
    summaryListEl.innerHTML = `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  summaryListEl.innerHTML = rows.map((row, index) => {
    const alertClass = isAlertType(row.tipo) ? " alert-row" : "";
    const editedClass = row.editadoEm || row.editadoPor || row.resumoEdicao || row.observacaoAtualizadaEm || row.observacaoAtualizadaPor ? " edited-row" : "";
    const editBlock = renderSummaryEditBlock(row);
    const observationBlock = renderSummaryObservationBlock(row);
    return `
      <article class="summary-item${alertClass}${editedClass}" data-row-number="${escapeHtml(row.rowNumber || "")}" tabindex="0">
        <div class="summary-index">${index + 1}</div>
        <div class="summary-main">
          <strong>${escapeHtml(row.nomePaciente || "")}</strong>
          <span>Data ${escapeHtml(formatDate(row.data || ""))} | Cirurgia ${escapeHtml(row.cirurgia || "")} | Atendimento ${escapeHtml(row.atendimento || "")}</span>
          <small>Responsavel: ${escapeHtml(row.criadoPor || "Nao informado")}</small>
        </div>
        <div class="summary-type">
          <b>${escapeHtml(row.tipo || "")}</b>
          <span>${escapeHtml(row.credor || "")}</span>
        </div>
        <div class="summary-plantonistas">
          <small>Plantonista(s)</small>
          <b>${escapeHtml(row.plantonistas || "-")}</b>
        </div>
        ${editBlock}
        ${observationBlock}
      </article>
    `;
  }).join("");

  summaryListEl.querySelectorAll(".summary-item").forEach((item) => {
    let lastTapAt = 0;
    const open = () => openEditRecord(item.dataset.rowNumber);
    item.addEventListener("dblclick", open);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        open();
      }
    });
    item.addEventListener("touchend", (event) => {
      const now = Date.now();
      if (now - lastTapAt < 450) {
        event.preventDefault();
        open();
      }
      lastTapAt = now;
    }, { passive: false });
  });
}

function renderSummaryObservationBlock(row) {
  const hasObservation = row.observacoes || row.observacaoAtualizadaEm || row.observacaoAtualizadaPor;
  if (!hasObservation) {
    return "";
  }

  return `
    <div class="summary-history-block summary-observation-block">
      <strong>Observacao</strong>
      <span>${escapeHtml(composeHistoryLine(
        row.observacaoAtualizadaEm || "Sem data registrada",
        row.observacaoAtualizadaPor || "Sem responsavel registrado",
        row.observacoes || "Sem texto de observacao."
      ))}</span>
    </div>
  `;
}

function renderSummaryEditBlock(row) {
  const hasEdit = row.editadoEm || row.editadoPor || row.resumoEdicao;
  if (!hasEdit) {
    return "";
  }

  return `
    <div class="summary-history-block summary-edit-block">
      <strong>Edicao de Registro</strong>
      ${renderEditHistoryLines(row)}
    </div>
  `;
}

function renderEditHistoryLines(row) {
  const history = String(row.resumoEdicao || "").trim();
  if (history) {
    return history
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => `<span class="summary-edit-note">${formatEditHistoryLine(line)}</span>`)
      .join("");
  }

  return `<span class="summary-edit-note">${escapeHtml(composeHistoryLine(
    row.editadoEm || "Sem data registrada",
    row.editadoPor || "Sem responsavel registrado",
    "Registro editado."
  ))}</span>`;
}

function composeHistoryLine(dateTime, responsible, detail) {
  return `${dateTime} - ${responsible}: ${detail}`;
}

function formatEditHistoryLine(line) {
  const rawLine = String(line || "");
  const userSeparatorIndex = rawLine.indexOf(": ", rawLine.indexOf(" - ") + 3);
  if (userSeparatorIndex === -1) {
    return escapeHtml(rawLine);
  }

  const prefix = rawLine.slice(0, userSeparatorIndex + 2);
  const details = rawLine.slice(userSeparatorIndex + 2);
  return escapeHtml(prefix) + escapeHtml(details)
    .replace(/-&gt; ([^;]+)/g, "-&gt; <span class=\"summary-new-value\">$1</span>");
}

function openEditRecord(rowNumber) {
  const row = state.summaryRows.find((entry) => String(entry.rowNumber) === String(rowNumber));
  if (!row || !editOverlayEl || !editSummaryEl) {
    return;
  }

  state.editingRow = { ...row };
  renderEditRecordFields();
  setEditFeedback("", "neutral");
  editOverlayEl.hidden = false;
  editContextEl.textContent = `Lancado por: ${row.criadoPor || "Nao informado"} | Criado em: ${row.criadoEm || "Nao informado"}`;
}

function renderEditRecordFields() {
  const row = state.editingRow || {};
  editSummaryEl.innerHTML = `
    <div class="confirm-edit-grid">
      <label>
        <span>Data</span>
        <input id="edit-data" type="date" value="${escapeHtml(row.data || "")}" required>
      </label>
      <label class="full-width">
        <span>Nome do Paciente</span>
        <input id="edit-nomePaciente" type="text" value="${escapeHtml(row.nomePaciente || "")}" required>
      </label>
      <label>
        <span>Cirurgia</span>
        <input id="edit-cirurgia" inputmode="numeric" value="${escapeHtml(row.cirurgia || "")}" required>
      </label>
      <label>
        <span>Atendimento</span>
        <input id="edit-atendimento" inputmode="numeric" value="${escapeHtml(row.atendimento || "")}" required>
      </label>
      <label>
        <span>Tipo</span>
        <select id="edit-tipo" required>
          ${renderOption("", "Selecione", row.tipo)}
          ${renderOption("Particular", "Particular", row.tipo)}
          ${renderOption("Complementação", "Complementação", row.tipo)}
          ${renderOption("Unimed", "Unimed", row.tipo)}
          ${renderOption("Outros", "Outros", row.tipo)}
        </select>
      </label>
      <label>
        <span>Credor</span>
        <select id="edit-credor" required>
          ${renderOption("", "Selecione", row.credor)}
          ${renderOption("Caixa", "Caixa", row.credor)}
          ${renderOption("Plantão", "Plantão", row.credor)}
          ${renderOption("Plantão/Caixa", "Plantão/Caixa", row.credor)}
        </select>
      </label>
      <label class="full-width">
        <span>Plantonista(s)</span>
        <input id="edit-plantonistas" type="text" value="${escapeHtml(row.plantonistas || "")}" placeholder="Nao necessario quando Credor for Caixa">
      </label>
      <label class="full-width">
        <span>Observacoes</span>
        <textarea id="edit-observacoes" rows="3">${escapeHtml(row.observacoes || "")}</textarea>
      </label>
    </div>
  `;
}

function collectEditPayload() {
  const credor = editSummaryEl.querySelector("#edit-credor")?.value.trim() || "";
  return {
    rowNumber: state.editingRow?.rowNumber || "",
    data: editSummaryEl.querySelector("#edit-data")?.value || "",
    nomePaciente: editSummaryEl.querySelector("#edit-nomePaciente")?.value.trim() || "",
    cirurgia: cleanDigits(editSummaryEl.querySelector("#edit-cirurgia")?.value || ""),
    atendimento: cleanDigits(editSummaryEl.querySelector("#edit-atendimento")?.value || ""),
    tipo: editSummaryEl.querySelector("#edit-tipo")?.value.trim() || "",
    credor,
    plantonistas: credor === CREDOR_CAIXA ? "" : (editSummaryEl.querySelector("#edit-plantonistas")?.value.trim() || ""),
    observacoes: editSummaryEl.querySelector("#edit-observacoes")?.value.trim() || "",
  };
}

async function saveEditedRecord() {
  if (!state.editingRow) {
    return;
  }

  const payload = collectEditPayload();
  const missing = getMissingRequiredFields(payload);
  if (missing.length) {
    setEditFeedback("Corrija os campos obrigatorios antes de salvar.", "error");
    return;
  }

  toggleBusy(true);
  setEditFeedback("Salvando edicao...", "neutral");
  try {
    const response = await fetch(state.config.scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(withAuthPayload({
        action: "updateRecord",
        ...payload,
      })),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "Falha ao editar registro.");
    }

    closeEditRecord();
    if (payload.data) {
      summaryDateEl.value = payload.data;
    }
    await Promise.all([
      loadSummary({ silent: true }),
      loadMonthlySummary({ silent: true }),
    ]);
    setStatus("Registro editado com sucesso!", "success");
  } catch (error) {
    setEditFeedback(`Falha ao editar registro: ${error.message}`, "error");
  } finally {
    toggleBusy(false);
  }
}

function closeEditRecord() {
  state.editingRow = null;
  if (editOverlayEl) {
    editOverlayEl.hidden = true;
  }
  setEditFeedback("", "neutral");
}

function setEditFeedback(message, tone = "neutral") {
  if (!editFeedbackEl) {
    return;
  }
  editFeedbackEl.textContent = message;
  editFeedbackEl.dataset.tone = tone;
  editFeedbackEl.hidden = !message;
}

async function loadMonthlyEntries(month) {
  if (!state.config.scriptUrl) {
    throw new Error("Configure a URL do Apps Script antes de gerar o relatorio mensal.");
  }

  const url = new URL(state.config.scriptUrl);
  url.searchParams.set("action", "summaryMonth");
  url.searchParams.set("month", month);
  addAuthToUrl(url);
  const response = await fetch(url.toString(), { method: "GET" });
  const result = await response.json();

  if (!response.ok || result.ok !== true) {
    throw new Error(result.message || "Falha ao carregar entradas do mes.");
  }

  return result.entries || [];
}

function generatePdfReport() {
  if (!state.summaryRows.length) {
    setStatus("Carregue um resumo com entradas antes de gerar o PDF.", "error");
    return;
  }

  const jsPdf = window.jspdf?.jsPDF;
  if (!jsPdf) {
    window.print();
    return;
  }

  const date = summaryDateEl.value || getTodayISO();
  const doc = new jsPdf({ orientation: "landscape", unit: "mm", format: "a4" });
  const title = `ETIQUETAS SAHMT - ${formatDate(date)}`;
  const rows = state.summaryRows.map((row, index) => [
    String(index + 1),
    row.nomePaciente || "",
    row.cirurgia || "",
    row.atendimento || "",
    row.tipo || "",
    row.credor || "",
    row.plantonistas || "",
    row.observacoes || "",
  ]);

  doc.setFillColor(11, 63, 58);
  doc.rect(0, 0, 297, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(`${state.summaryRows.length} entrada(s)`, 260, 15, { align: "right" });

  doc.autoTable({
    startY: 32,
    head: [["#", "Nome do Paciente", "Cirurgia", "Atendimento", "Tipo", "Credor", "Plantonista(s)", "Observacoes"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
    headStyles: { fillColor: [11, 63, 58], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 58 },
      2: { cellWidth: 22 },
      3: { cellWidth: 26 },
      4: { cellWidth: 28 },
      5: { cellWidth: 40 },
      6: { cellWidth: 30 },
      7: { cellWidth: 62 },
    },
    didParseCell(data) {
      if (data.section === "body") {
        const row = state.summaryRows[data.row.index];
        if (isAlertType(row?.tipo)) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 241, 242];
        } else if (row?.resumoEdicao) {
          data.cell.styles.fillColor = [240, 253, 244];
        }
        if (data.column.index === 10 && row?.resumoEdicao) {
          data.cell.styles.textColor = [29, 78, 216];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  doc.save(`etiquetas-sahmt-${date}.pdf`);
}

async function generateMonthlyPdfForWhatsApp() {
  const month = reportMonthEl.value;
  if (!month) {
    renderMonthlyStatus("Escolha um mes antes de gerar o PDF.", "error");
    setStatus("Escolha um mes antes de gerar o PDF mensal.", "error");
    return;
  }

  toggleBusy(true);
  setStatus("Gerando relatorio mensal em PDF...", "info");

  try {
    let rows = state.monthlyMonth === month ? state.monthlyRows : [];
    if (!rows.length) {
      rows = await loadMonthlyEntries(month);
      state.monthlyRows = rows;
      state.monthlyMonth = month;
      const alertCount = rows.filter((row) => isAlertType(row.tipo)).length;
      renderMonthlyStatus(`${rows.length} entrada(s) em ${formatMonth(month)}. ${alertCount} alerta(s).`, rows.length ? "success" : "neutral");
      renderMonthlyList(rows, "Nenhum registro encontrado para este mes.");
      if (!rows.length) {
        setStatus("Nenhuma entrada encontrada para o mes selecionado.", "error");
        return;
      }
    }

    const alertCount = rows.filter((row) => isAlertType(row.tipo)).length;
    renderMonthlyStatus(`${rows.length} entrada(s) em ${formatMonth(month)}. ${alertCount} alerta(s).`, rows.length ? "success" : "neutral");
    renderMonthlyList(rows, "Nenhum registro encontrado para este mes.");
    if (!rows.length) {
      setStatus("Nenhuma entrada encontrada para o mes selecionado.", "error");
      return;
    }

    const { blob, fileName, summaryText } = buildMonthlyPdf(rows, month);
    const file = new File([blob], fileName, { type: "application/pdf" });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({
          files: [file],
          title: `ETIQUETAS SAHMT - ${formatMonth(month)}`,
          text: summaryText,
        });
        setStatus("PDF mensal pronto para envio. Escolha o WhatsApp na tela de compartilhamento.", "success");
        return;
      } catch (shareError) {
        if (shareError.name === "AbortError") {
          setStatus("Compartilhamento cancelado.", "info");
          return;
        }
        throw shareError;
      }
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${summaryText}\n\nEste navegador nao permitiu anexar o PDF automaticamente.`)}`;
    openWhatsAppUrl(whatsappUrl);
    setStatus("WhatsApp aberto. Este navegador nao permitiu anexar o PDF automaticamente.", "info");
  } catch (error) {
    setStatus(`Falha ao gerar relatorio mensal: ${error.message}`, "error");
  } finally {
    toggleBusy(false);
  }
}

function buildMonthlyPdf(rows, month) {
  const jsPdf = window.jspdf?.jsPDF;
  if (!jsPdf) {
    throw new Error("Biblioteca de PDF nao carregada.");
  }

  const doc = new jsPdf({ orientation: "landscape", unit: "mm", format: "a4" });
  const title = `ETIQUETAS SAHMT - RELATORIO MENSAL - ${formatMonth(month)}`;
  const alertCount = rows.filter((row) => isAlertType(row.tipo)).length;
  const tableRows = rows.map((row, index) => [
    String(index + 1),
    formatDate(row.data || ""),
    row.nomePaciente || "",
    row.cirurgia || "",
    row.atendimento || "",
    row.tipo || "",
    row.credor || "",
    row.plantonistas || "-",
    row.criadoPor || "",
    row.editadoPor || "",
    row.resumoEdicao || "",
    row.observacoes || "",
  ]);

  doc.setFillColor(11, 63, 58);
  doc.rect(0, 0, 297, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(`${rows.length} entrada(s) | ${alertCount} alerta(s)`, 280, 15, { align: "right" });

  doc.autoTable({
    startY: 34,
    head: [["#", "Data", "Nome do Paciente", "Cirurgia", "Atendimento", "Tipo", "Credor", "Plantonista(s)", "Responsavel", "Editado por", "Alteracoes", "Observacoes"]],
    body: tableRows,
    theme: "grid",
    styles: { fontSize: 7.6, cellPadding: 2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [11, 63, 58], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 17 },
      2: { cellWidth: 38 },
      3: { cellWidth: 17 },
      4: { cellWidth: 21 },
      5: { cellWidth: 19 },
      6: { cellWidth: 24 },
      7: { cellWidth: 22 },
      8: { cellWidth: 28 },
      9: { cellWidth: 28 },
      10: { cellWidth: 35 },
      11: { cellWidth: 25 },
    },
    didParseCell(data) {
      if (data.section === "body") {
        const row = rows[data.row.index];
        if (isAlertType(row?.tipo)) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 241, 242];
        } else if (row?.resumoEdicao) {
          data.cell.styles.fillColor = [240, 253, 244];
        }
        if (data.column.index === 10 && row?.resumoEdicao) {
          data.cell.styles.textColor = [29, 78, 216];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const fileName = `etiquetas-sahmt-${month}.pdf`;
  return {
    blob: doc.output("blob"),
    fileName,
    summaryText: `ETIQUETAS SAHMT - ${formatMonth(month)}\n${rows.length} entrada(s)\n${alertCount} alerta(s): Particular/Complementação`,
  };
}

function openWhatsAppUrl(url, preOpenedWindow) {
  if (preOpenedWindow && !preOpenedWindow.closed) {
    preOpenedWindow.location.href = url;
    return;
  }

  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    window.location.href = url;
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function resetForm(options = {}) {
  const selectedDate = options.keepDate || fields.data.value || getTodayISO();
  formEl.reset();
  fields.data.value = options.keepDate ? selectedDate : getTodayISO();
  clearPlantonistasSelection();
  syncPlantonistasRequirement();
  setSendFeedback("", "neutral");

  if (!options.keepImage) {
    clearImage();
  }

  if (options.hideEntry !== false) {
    hideEntryPanel();
  }
}

function clearImage() {
  if (state.imageUrl) {
    URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = "";
  }

  previewEl.removeAttribute("src");
  previewEl.classList.remove("has-image");
  state.imageBlob = null;
  document.querySelector("#process-image").disabled = true;
}

function setStatus(message, tone) {
  processingStatusEl.textContent = message;
  processingStatusEl.dataset.tone = tone;
}

function toggleBusy(isBusy) {
  document.querySelectorAll("button, input[type='file'], select, input, textarea").forEach((element) => {
    if (element.id === "clear-form" || element.id === "save-settings" || element.id === "script-url") {
      return;
    }
    element.disabled = isBusy;
  });

  if (!isBusy) {
    document.querySelector("#capture-image").disabled = !state.stream;
    document.querySelector("#process-image").disabled = !state.imageBlob;
    syncPlantonistasRequirement();
  }
}

function isAlertType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized === "particular" || normalized === "complementacao";
}

function syncPlantonistasRequirement() {
  const isCaixa = fields.credor.value.trim() === CREDOR_CAIXA;
  fields.plantonistas.disabled = isCaixa;
  fields.plantonistas.required = !isCaixa;

  if (plantonistasUi.button) {
    plantonistasUi.button.disabled = isCaixa;
  }

  plantonistasUi.checks.forEach((checkbox) => {
    checkbox.disabled = isCaixa;
  });

  if (isCaixa) {
    clearPlantonistasSelection();
    closePlantonistasPicker();
  }
}

function setupPlantonistasPicker() {
  if (plantonistasUi.wrapper) {
    return;
  }

  const options = Array.from(fields.plantonistas.options).filter((option) => option.value);
  fields.plantonistas.classList.add("native-multi-hidden");

  const wrapper = document.createElement("div");
  wrapper.id = "plantonistas-picker";
  wrapper.className = "multi-select";

  const button = document.createElement("button");
  button.id = "plantonistas-toggle";
  button.type = "button";
  button.className = "multi-select-toggle";
  button.setAttribute("aria-label", "Selecionar plantonistas");
  button.setAttribute("aria-expanded", "false");
  button.textContent = "";

  const panel = document.createElement("div");
  panel.id = "plantonistas-options";
  panel.className = "multi-select-options";
  panel.hidden = true;

  const checks = options.map((option) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = option.value;
    checkbox.addEventListener("change", syncPlantonistasFromCheckboxes);
    label.append(checkbox, document.createTextNode(` ${option.textContent.trim()}`));
    panel.append(label);
    return checkbox;
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (button.disabled) {
      return;
    }
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    button.setAttribute("aria-expanded", String(!isOpen));
  });

  panel.addEventListener("click", (event) => event.stopPropagation());
  wrapper.append(button, panel);
  fields.plantonistas.insertAdjacentElement("afterend", wrapper);

  plantonistasUi.wrapper = wrapper;
  plantonistasUi.button = button;
  plantonistasUi.panel = panel;
  plantonistasUi.checks = checks;
  syncPlantonistasFromCheckboxes();
}

function syncPlantonistasFromCheckboxes() {
  const selected = plantonistasUi.checks
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  Array.from(fields.plantonistas.options).forEach((option) => {
    option.selected = selected.includes(option.value);
  });

  if (plantonistasUi.button) {
    plantonistasUi.button.textContent = selected.length ? selected.join(", ") : "";
    plantonistasUi.button.classList.toggle("has-selection", selected.length > 0);
  }
}

function getSelectedPlantonistasValue() {
  return Array.from(fields.plantonistas.selectedOptions)
    .map((option) => option.value.trim())
    .filter(Boolean)
    .join(", ");
}

function setSelectedPlantonistasFromValue(value) {
  const selected = String(value || "")
    .split(/[,;]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  plantonistasUi.checks.forEach((checkbox) => {
    checkbox.checked = selected.includes(checkbox.value.toUpperCase());
  });
  Array.from(fields.plantonistas.options).forEach((option) => {
    option.selected = selected.includes(option.value.toUpperCase());
  });
  syncPlantonistasFromCheckboxes();
}

function clearPlantonistasSelection() {
  plantonistasUi.checks.forEach((checkbox) => {
    checkbox.checked = false;
  });
  Array.from(fields.plantonistas.options).forEach((option) => {
    option.selected = false;
  });
  syncPlantonistasFromCheckboxes();
}

function closePlantonistasPicker() {
  if (!plantonistasUi.panel) {
    return;
  }

  plantonistasUi.panel.hidden = true;
  plantonistasUi.button?.setAttribute("aria-expanded", "false");
}

function closePlantonistasPickerOnOutsideClick(event) {
  if (!plantonistasUi.wrapper || plantonistasUi.wrapper.contains(event.target)) {
    return;
  }

  closePlantonistasPicker();
}

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function normalizeDateKey(value) {
  const text = String(value || "").trim();
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  return text;
}

function formatMonth(value) {
  if (!value) {
    return "";
  }
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeCompare(value) {
  return normalizeSearch(value).replace(/\s+/g, " ");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

window.addEventListener("beforeunload", () => {
  stopCamera();
  if (state.worker) {
    state.worker.terminate();
  }
});
