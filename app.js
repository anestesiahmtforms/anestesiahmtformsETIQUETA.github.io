const CONFIG = {
  storageKey: "etiqueta-hmt-ia-v1",
  authSessionKey: "etiqueta-hmt-auth-session-v1",
  googleClientId: "908976987584-o59p0obmvq013lg3t9726itf06e15v2c.apps.googleusercontent.com",
  guideWidthRatio: 0.94,
  guideAspectRatio: 3.35,
  defaultScriptUrl: "https://script.google.com/macros/s/AKfycbzTb2EQ8iM-oB5KnxI26uBvG_ddjDLCD7G0YBov9mgLe7apX89vBECecaUnOHyRTwED/exec",
  maxObservationResults: 12,
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
  monthlyRows: [],
  monthlyMonth: "",
  observationRows: [],
  selectedObservationRow: null,
  auth: null,
  authenticated: false,
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
const scriptUrlEl = document.querySelector("#script-url");
const formEl = document.querySelector("#label-form");
const summaryDateEl = document.querySelector("#summary-date");
const reportMonthEl = document.querySelector("#report-month");
const summaryTotalsEl = document.querySelector("#summary-totals");
const summaryListEl = document.querySelector("#summary-list");
const monthlyStatusEl = document.querySelector("#monthly-status");
const sendFeedbackEl = document.querySelector("#send-feedback");
const confirmOverlayEl = document.querySelector("#confirm-overlay");
const confirmSummaryEl = document.querySelector("#confirm-summary");
const confirmSendEl = document.querySelector("#confirm-send");
const cancelSendEl = document.querySelector("#cancel-send");
const observationMonthEl = document.querySelector("#observation-month");
const observationSearchEl = document.querySelector("#observation-search");
const observationListEl = document.querySelector("#observation-list");
const observationEditorEl = document.querySelector("#observation-editor");
const observationTargetEl = document.querySelector("#observation-target");
const observationDateEl = document.querySelector("#observation-date");
const observationTextEl = document.querySelector("#observation-text");
const saveObservationEl = document.querySelector("#save-observation");
const cancelObservationEl = document.querySelector("#cancel-observation");
const observationFeedbackEl = document.querySelector("#observation-feedback");

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
summaryDateEl.addEventListener("change", loadSummary);
reportMonthEl.addEventListener("change", loadMonthlySummary);
fields.credor.addEventListener("change", syncPlantonistasRequirement);
observationMonthEl.addEventListener("change", loadObservationRecords);
observationSearchEl.addEventListener("input", renderObservationList);
saveObservationEl.addEventListener("click", saveSelectedObservation);
cancelObservationEl.addEventListener("click", clearObservationSelection);
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
  const today = getTodayISO();
  fields.data.value = today;
  summaryDateEl.value = today;
  reportMonthEl.value = today.slice(0, 7);
  setupObservationMonthOptions(today);
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

async function authenticateUser() {
  showAuthGate("Verificando sua conta Google cadastrada...");
  renderAuthStatus();

  const cachedAuth = restoreAuthSession();
  if (cachedAuth) {
    applyAuthenticatedUser(cachedAuth);
    hideAuthGate();
    renderAuthStatus();
    return true;
  }

  if (!CONFIG.googleClientId) {
    showAuthGate("Você precisa estar logado em sua conta Google Cadastrada para entrar");
    return false;
  }

  try {
    await waitForGoogleIdentity();
    const credential = await requestGoogleCredential();
    const authResult = await validateGoogleCredential(credential);

    applyAuthenticatedUser({
      token: credential,
      email: String(authResult.email || "").toLowerCase(),
      name: authResult.name || "",
      expiresAt: getJwtExpirationMs(credential),
    });
    persistAuthSession();
    hideAuthGate();
    renderAuthStatus();
    return true;
  } catch (error) {
    console.warn("Falha na autenticacao Google:", error);
    state.auth = null;
    state.authenticated = false;
    clearAuthSession();
    renderAuthStatus();
    showAuthGate("Você precisa estar logado em sua conta Google Cadastrada para entrar");
    return false;
  }
}

async function initializeAuthorizedApp() {
  await Promise.all([
    loadMetadata(),
    loadSummary({ silent: true }),
    loadMonthlySummary({ silent: true }),
    loadObservationRecords({ silent: true }),
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
    }, 12000);

    window.google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      auto_select: true,
      cancel_on_tap_outside: false,
      itp_support: true,
      use_fedcm_for_prompt: true,
      callback(response) {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        if (response?.credential) {
          resolve(response.credential);
        } else {
          reject(new Error("Conta Google nao autorizada."));
        }
      },
    });

    window.google.accounts.id.prompt((notification) => {
      if (settled) {
        return;
      }
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error("Conta Google nao identificada automaticamente."));
      }
    });
  });
}

function applyAuthenticatedUser(auth) {
  state.auth = {
    token: auth.token,
    email: String(auth.email || "").toLowerCase(),
    name: auth.name || "",
    expiresAt: Number(auth.expiresAt || 0),
  };
  state.authenticated = Boolean(state.auth.token && state.auth.email);
}

function persistAuthSession() {
  if (!state.auth?.token || !state.auth?.email) {
    return;
  }

  try {
    sessionStorage.setItem(CONFIG.authSessionKey, JSON.stringify(state.auth));
  } catch (error) {
    console.warn("Nao foi possivel salvar sessao Google:", error);
  }
}

function restoreAuthSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CONFIG.authSessionKey) || "null");
    if (!saved?.token || !saved?.email) {
      return null;
    }

    if (Number(saved.expiresAt || 0) <= Date.now() + 120000) {
      clearAuthSession();
      return null;
    }

    return saved;
  } catch {
    clearAuthSession();
    return null;
  }
}

function clearAuthSession() {
  try {
    sessionStorage.removeItem(CONFIG.authSessionKey);
  } catch {
    // Sessao indisponivel; sem impacto funcional.
  }
}

async function validateGoogleCredential(idToken) {
  if (!state.config.scriptUrl) {
    throw new Error("URL do Apps Script nao configurada.");
  }

  const response = await fetch(state.config.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "auth",
      authToken: idToken,
    }),
  });
  const result = await response.json();

  if (!response.ok || result.ok !== true) {
    throw new Error(result.message || "Conta Google nao autorizada.");
  }

  return result;
}

function showAuthGate(message) {
  if (authMessageEl) {
    authMessageEl.textContent = message;
  }
  authGateEl?.removeAttribute("hidden");
  document.body.classList.add("auth-locked");
}

function hideAuthGate() {
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
  if (!state.authenticated || !state.auth?.token) {
    throw new Error("Você precisa estar logado em sua conta Google Cadastrada para entrar");
  }

  if (state.auth.expiresAt && Date.now() > state.auth.expiresAt - 60000) {
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
  url.searchParams.set("authToken", auth.token);
  return url;
}

function withAuthPayload(payload) {
  const auth = ensureAuthenticated();
  return {
    ...payload,
    authToken: auth.token,
    userEmail: auth.email,
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

  toggleBusy(true);
  setStatus("Lendo etiqueta com IA...", "info");

  try {
    const parsed = await extractLabelWithAi(state.imageBlob);
    applyDataToForm(parsed);

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
      loadObservationRecords({ silent: true }),
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
  if (!confirmOverlayEl || !confirmSummaryEl || !confirmSendEl || !cancelSendEl) {
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
      cancelSendEl.removeEventListener("click", onCancel);
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

  const refreshTasks = [loadSummary({ silent: true })];
  if (observationEditorEl.hidden) {
    refreshTasks.push(loadMonthlySummary({ silent: true }));
    refreshTasks.push(loadObservationRecords({ silent: true }));
  }

  await Promise.all(refreshTasks);
}

async function loadSummary(options = {}) {
  if (!state.config.scriptUrl) {
    state.summaryRows = [];
    renderSummary([], "Configure a URL do Apps Script para carregar o resumo.");
    return;
  }

  try {
    const url = new URL(state.config.scriptUrl);
    url.searchParams.set("action", "summary");
    url.searchParams.set("date", options.date || summaryDateEl.value || getTodayISO());
    addAuthToUrl(url);
    const response = await fetch(url.toString(), { method: "GET" });
    const result = await response.json();

    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "Falha ao carregar resumo.");
    }

    state.summaryRows = result.entries || [];
    renderSummary(state.summaryRows);
    if (!options.silent) {
      setStatus("Resumo carregado.", "success");
    }
  } catch (error) {
    state.summaryRows = [];
    renderSummary([], `Nao foi possivel carregar o resumo: ${error.message}`);
    if (!options.silent) {
      setStatus(`Falha ao carregar resumo: ${error.message}`, "error");
    }
  }
}

async function loadMonthlySummary(options = {}) {
  if (!state.config.scriptUrl) {
    state.monthlyRows = [];
    renderMonthlyStatus("Configure a URL do Apps Script para atualizar o relatorio mensal.", "error");
    return;
  }

  const month = reportMonthEl.value || getTodayISO().slice(0, 7);
  try {
    state.monthlyRows = await loadMonthlyEntries(month);
    state.monthlyMonth = month;
    const alertCount = state.monthlyRows.filter((row) => isAlertType(row.tipo)).length;
    const updatedAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    renderMonthlyStatus(
      `${state.monthlyRows.length} entrada(s) em ${formatMonth(month)}. ${alertCount} alerta(s). Atualizado as ${updatedAt}.`,
      state.monthlyRows.length ? "success" : "neutral"
    );

    if (!options.silent) {
      setStatus("Relatorio mensal atualizado.", "success");
    }
  } catch (error) {
    state.monthlyRows = [];
    state.monthlyMonth = "";
    renderMonthlyStatus(`Nao foi possivel atualizar o relatorio mensal: ${error.message}`, "error");
    if (!options.silent) {
      setStatus(`Falha ao atualizar relatorio mensal: ${error.message}`, "error");
    }
  }
}

function renderMonthlyStatus(message, tone = "neutral") {
  monthlyStatusEl.textContent = message;
  monthlyStatusEl.dataset.tone = tone;
}

function setupObservationMonthOptions(todayIso) {
  const [year, month] = todayIso.split("-").map(Number);
  const options = [];

  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(year, month - 1 - offset, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push(`<option value="${value}">${formatMonth(value)}</option>`);
  }

  observationMonthEl.innerHTML = options.join("");
}

async function loadObservationRecords(options = {}) {
  if (!state.config.scriptUrl) {
    state.observationRows = [];
    renderObservationList("Configure a URL do Apps Script para carregar os registros.");
    return;
  }

  try {
    const month = observationMonthEl.value || getTodayISO().slice(0, 7);
    state.observationRows = await loadMonthlyEntries(month);
    renderObservationList();
    if (!options.silent) {
      setObservationFeedback(`Registros de ${formatMonth(month)} carregados.`, "success");
    }
  } catch (error) {
    state.observationRows = [];
    renderObservationList(`Nao foi possivel carregar os registros: ${error.message}`);
    if (!options.silent) {
      setObservationFeedback(`Falha ao carregar registros: ${error.message}`, "error");
    }
  }
}

function renderObservationList(customEmptyMessage = "") {
  clearObservationSelection({ keepFeedback: true });

  const query = normalizeSearch(observationSearchEl.value);
  const rows = state.observationRows.filter((row) => (
    !query
    || normalizeSearch([
      row.data,
      row.nomePaciente,
      row.cirurgia,
      row.atendimento,
      row.tipo,
      row.credor,
      row.plantonistas,
      row.observacoes,
    ].join(" ")).includes(query)
  )).slice(0, CONFIG.maxObservationResults);

  if (!state.observationRows.length) {
    observationListEl.innerHTML = `<p class="empty-state">${escapeHtml(customEmptyMessage || "Nenhum registro carregado para o mês selecionado.")}</p>`;
    return;
  }

  if (!query) {
    observationListEl.innerHTML = "";
    return;
  }

  if (!rows.length) {
    observationListEl.innerHTML = `<p class="empty-state">Nenhum registro encontrado para esta busca.</p>`;
    return;
  }

  observationListEl.innerHTML = rows.map((row) => `
    <button class="observation-result" type="button" data-row-number="${escapeHtml(row.rowNumber || "")}">
      <strong>${escapeHtml(row.nomePaciente || "")}</strong>
      <span>Data ${escapeHtml(formatDate(row.data || ""))} | Cirurgia ${escapeHtml(row.cirurgia || "")} | Atendimento ${escapeHtml(row.atendimento || "")}</span>
      <small>Tipo: ${escapeHtml(row.tipo || "-")} | Credor: ${escapeHtml(row.credor || "-")} | Plantonista(s): ${escapeHtml(row.plantonistas || "Nao necessario")}</small>
      <small>Observação atual: ${escapeHtml(row.observacoes || "Sem observação")}</small>
      <small>Observação feita por: ${escapeHtml(row.observacaoAtualizadaPor || "Sem observação registrada")}</small>
    </button>
  `).join("");

  observationListEl.querySelectorAll(".observation-result").forEach((button) => {
    button.addEventListener("click", () => selectObservationRow(button.dataset.rowNumber));
    button.addEventListener("touchend", (event) => {
      event.preventDefault();
      selectObservationRow(button.dataset.rowNumber);
    }, { passive: false });
  });
}

function selectObservationRow(rowNumber) {
  const selected = state.observationRows.find((row) => String(row.rowNumber) === String(rowNumber));
  if (!selected) {
    return;
  }

  state.selectedObservationRow = selected;
  observationEditorEl.hidden = false;
  observationTextEl.value = extractObservationBody(selected.observacoes || "");
  observationTargetEl.textContent = `${formatDate(selected.data || "")} | ${selected.nomePaciente || ""} | Cirurgia ${selected.cirurgia || ""} | Atendimento ${selected.atendimento || ""} | ${selected.tipo || ""} | ${selected.credor || ""} | Plantonista(s): ${selected.plantonistas || "Nao necessario"} | Lancado por: ${selected.criadoPor || "Nao informado"} | Observacao feita por: ${selected.observacaoAtualizadaPor || "Sem observacao registrada"}`;
  observationDateEl.textContent = `Data desta observação: ${formatDate(getTodayISO())}`;
  setObservationFeedback("", "neutral");
}

function clearObservationSelection(options = {}) {
  state.selectedObservationRow = null;
  observationEditorEl.hidden = true;
  observationTargetEl.textContent = "";
  observationDateEl.textContent = "";
  observationTextEl.value = "";
  if (!options.keepFeedback) {
    setObservationFeedback("", "neutral");
  }
}

async function saveSelectedObservation() {
  if (!state.selectedObservationRow) {
    setObservationFeedback("Escolha primeiro um registro do mês.", "error");
    return;
  }

  const observationBody = observationTextEl.value.trim();
  const observacoes = observationBody ? `${formatDate(getTodayISO())} - ${observationBody}` : "";
  toggleBusy(true);
  setObservationFeedback("Salvando observação...", "neutral");

  try {
    const response = await fetch(state.config.scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(withAuthPayload({
        action: "updateObservation",
        rowNumber: state.selectedObservationRow.rowNumber,
        observacoes,
      })),
    });
    const result = await response.json();

    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "Falha ao salvar observação.");
    }

    observationSearchEl.value = "";
    observationListEl.innerHTML = "";
    clearObservationSelection({ keepFeedback: true });
    await Promise.all([
      loadSummary({ silent: true }),
      loadMonthlySummary({ silent: true }),
      loadObservationRecords({ silent: true }),
    ]);
    setObservationFeedback("Observação enviada com sucesso!", "success");
  } catch (error) {
    setObservationFeedback(`Falha ao salvar observação: ${error.message}`, "error");
  } finally {
    toggleBusy(false);
  }
}

function setObservationFeedback(message, tone = "neutral") {
  observationFeedbackEl.textContent = message;
  observationFeedbackEl.dataset.tone = tone;
  observationFeedbackEl.hidden = !message;
}

function extractObservationBody(value) {
  return String(value || "").replace(/^\d{2}\/\d{2}\/\d{4}\s*-\s*/, "").trim();
}

function renderSummary(rows, emptyMessage = "Nenhuma entrada encontrada nesta data.") {
  summaryTotalsEl.innerHTML = "";

  if (!rows.length) {
    summaryListEl.innerHTML = `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  summaryListEl.innerHTML = rows.map((row, index) => {
    const alertClass = isAlertType(row.tipo) ? " alert-row" : "";
    return `
      <article class="summary-item${alertClass}">
        <div class="summary-index">${index + 1}</div>
        <div class="summary-main">
          <strong>${escapeHtml(row.nomePaciente || "")}</strong>
          <span>Cirurgia ${escapeHtml(row.cirurgia || "")} | Atendimento ${escapeHtml(row.atendimento || "")}</span>
          <small>Responsavel: ${escapeHtml(row.criadoPor || "Nao informado")}</small>
        </div>
        <div class="summary-type">
          <b>${escapeHtml(row.tipo || "")}</b>
          <span>${escapeHtml(row.credor || "")}</span>
        </div>
        <div class="summary-plantonistas">
          <small>Plantonista(s)</small>
          <b>${escapeHtml(row.plantonistas || "-")}</b>
          <span>${escapeHtml(row.observacoes || "")}</span>
          <small>Observacao feita por: ${escapeHtml(row.observacaoAtualizadaPor || "Sem observacao registrada")}</small>
        </div>
      </article>
    `;
  }).join("");
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
        }
      }
    },
  });

  doc.save(`etiquetas-sahmt-${date}.pdf`);
}

async function generateMonthlyPdfForWhatsApp() {
  const month = reportMonthEl.value || getTodayISO().slice(0, 7);
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
      if (!rows.length) {
        setStatus("Nenhuma entrada encontrada para o mes selecionado.", "error");
        return;
      }
      setStatus("Relatorio mensal carregado. Toque novamente em PDF Mensal no WhatsApp para anexar automaticamente.", "info");
      return;
    }

    const alertCount = rows.filter((row) => isAlertType(row.tipo)).length;
    renderMonthlyStatus(`${rows.length} entrada(s) em ${formatMonth(month)}. ${alertCount} alerta(s).`, rows.length ? "success" : "neutral");
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
    row.observacaoAtualizadaPor || "",
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
    head: [["#", "Data", "Nome do Paciente", "Cirurgia", "Atendimento", "Tipo", "Credor", "Plantonista(s)", "Responsavel", "Obs. por", "Observacoes"]],
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
      8: { cellWidth: 31 },
      9: { cellWidth: 31 },
      10: { cellWidth: 34 },
    },
    didParseCell(data) {
      if (data.section === "body") {
        const row = rows[data.row.index];
        if (isAlertType(row?.tipo)) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 241, 242];
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
  clearObservationSelection({ keepFeedback: true });

  if (!options.keepImage) {
    clearImage();
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
