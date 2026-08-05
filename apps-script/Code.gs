const SPREADSHEET_NAME = "Etiquetas";
const SPREADSHEET_ID = "1uvnn00jJOiE2KweCQ6IEFm8xN4kuuBIBs6VVYorkOtY";
const REGISTROS_SHEET = "ETIQUETA";
const LISTAS_SHEET = "Listas";
const OPENAI_MODEL = "gpt-5.2";
const OPENAI_API_KEY_PROPERTY = "OPENAI_API_KEY";
const GOOGLE_CLIENT_ID = "908976987584-o59p0obmvq013lg3t9726itf06e15v2c.apps.googleusercontent.com";
const TRUSTED_DEVICES_PROPERTY = "TRUSTED_DEVICES_JSON";
const TRUSTED_DEVICE_DAYS = 90;
const AUTH_REQUIRED_MESSAGE = "Você precisa estar logado em sua conta Google Cadastrada para entrar";
const AUTHORIZED_EMAILS = [
  "giovannoni1806@gmail.com",
  "igorfagundesvieira@gmail.com",
  "jaymebc@gmail.com",
  "lalvesaraujo1@gmail.com",
  "leodcp1@gmail.com",
  "luc3101@gmail.com",
  "lucas.cardoso.andrade@gmail.com",
  "luciah1509@gmail.com",
  "macielfonseca@gmail.com",
  "marcio.henrique82@gmail.com",
  "deilerjeunon19@gmail.com",
  "deneradiniz@gmail.com",
  "digoanest@gmail.com",
  "ericardolucas@gmail.com",
  "rafael.augusto.rezende@gmail.com",
  "rodrigocapuano12@gmail.com",
  "vcrelio@gmail.com",
  "wx2064@gmail.com",
  "25.guilherme@gmail.com",
  "adelsonjm@gmail.com",
  "adrianonevesdealmeida1966@gmail.com",
  "barbararcoutinho@gmail.com",
  "bovino3.lf@gmail.com",
  "wendellvcp@gmail.com",
  "gpbicalho@gmail.com",
  "decastromorais@gmail.com",
  "luizacs4182@gmail.com",
  "luizotavio.andrade@gmail.com",
  "paulorenato12021@gmail.com",
  "rubenscpinheiro0217@gmail.com",
  "nyhumberto@gmail.com",
  "marianasantosbrant@gmail.com",
  "anacarolinacbo1@gmail.com",
  "anandaqrlima@gmail.com",
  "lucasreis611@gmail.com",
  "araujo.barbaral44@gmail.com",
  "peereiralana@gmail.com",
  "bernardofsilvestrini@gmail.com",
  "eduardorfamaral@gmail.com",
  "aliciafreire98@gmail.com",
  "livia.campos12@gmail.com",
  "isapinvin@gmail.com",
  "na.tigre0@gmail.com",
  "matheusspiccolo2@gmail.com",
  "leonardoantonio2000sg@gmail.com",
  "joaoboscom28@gmail.com",
  "igorsmatias@gmail.com",
  "gbgabri3@gmail.com",
  "richard.fernandes.sousa@gmail.com",
  "lucasmarquesdrumond@gmail.com",
  "beguimaraes3@gmail.com",
  "brunacandida@gmail.com",
  "carolassisval@gmail.com",
  "nandobracar@gmail.com",
  "vieiraa.jessica09@gmail.com",
];

const REGISTROS_HEADERS = [
  "Data",
  "Nome do Paciente",
  "Cirurgia",
  "Atendimento",
  "Tipo",
  "Credor",
  "Plantonista(s)",
  "Observacoes",
  "Criado em",
  "Criado por",
  "Observacao atualizada em",
  "Observacao atualizada por",
  "Editado em",
  "Editado por",
  "Resumo da edicao",
];

const TIPO_OPTIONS = ["Particular", "Complementação", "Unimed", "Outros"];
const CREDOR_OPTIONS = ["Caixa", "Plantão", "Plantão/Caixa"];
const PLANTONISTA_OPTIONS = [
  "AD", "AA", "AL", "BA", "CH", "CR", "DE", "DN", "FL", "FR", "GU", "GB", "IG", "JA",
  "L2", "LE", "LD", "LC", "LH", "LU", "LA", "LO", "MA", "MH", "PR", "RA", "RL", "RC",
  "RO", "RU", "WE",
];

function setup() {
  return ensureWorkbook_();
}

function doGet(e) {
  try {
    const user = requireAuthorized_(
      e && e.parameter && e.parameter.authToken,
      e && e.parameter && e.parameter.deviceToken,
      e && e.parameter && e.parameter.userEmail
    );
    const spreadsheet = ensureWorkbook_();
    const action = (e && e.parameter && e.parameter.action) || "";

    if (action === "metadata") {
      return jsonResponse({
        ok: true,
        spreadsheetName: spreadsheet.getName(),
        targetSpreadsheetName: SPREADSHEET_NAME,
        targetSheetName: REGISTROS_SHEET,
        tipoOptions: TIPO_OPTIONS,
        credorOptions: CREDOR_OPTIONS,
        plantonistaOptions: PLANTONISTA_OPTIONS,
        userEmail: user.email,
      });
    }

    if (action === "summary") {
      const date = String(e.parameter.date || "").trim();
      return jsonResponse({
        ok: true,
        date,
        entries: getEntriesByDate_(date),
      });
    }

    if (action === "summaryMonth") {
      const month = String(e.parameter.month || "").trim();
      return jsonResponse({
        ok: true,
        month,
        entries: getEntriesByMonth_(month),
      });
    }

    if (action === "search") {
      const query = String(e.parameter.q || "").trim();
      const limit = Number(e.parameter.limit || 60);
      return jsonResponse({
        ok: true,
        query,
        entries: searchEntries_(query, limit),
      });
    }

    return jsonResponse({
      ok: true,
      message: "ETIQUETAS SAHMT API online.",
      spreadsheetName: spreadsheet.getName(),
      userEmail: user.email,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message,
    });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || (e.parameter && e.parameter.action) || "").trim();

    if (action === "auth") {
      return handleAuth_(payload);
    }

    const user = requireAuthorized_(
      payload.authToken || (e.parameter && e.parameter.authToken),
      payload.deviceToken || (e.parameter && e.parameter.deviceToken),
      payload.userEmail || (e.parameter && e.parameter.userEmail)
    );

    if (action === "aiHealth") {
      return handleAiHealth_(user);
    }

    if (action === "aiExtract") {
      return handleAiExtract_(payload);
    }

    ensureWorkbook_();

    if (action === "updateObservation") {
      return handleUpdateObservation_(payload, user);
    }

    if (action === "updateRecord") {
      return handleUpdateRecord_(payload, user);
    }

    validatePayload_(payload);

    const duplicateRows = findExactDuplicates_(payload);
    if (duplicateRows.length && !String(payload.duplicateJustification || "").trim()) {
      throw new Error("Lancamento duplicado encontrado. Informe uma justificativa para continuar.");
    }

    const sheet = getSpreadsheet_().getSheetByName(REGISTROS_SHEET);
    sheet.appendRow([
      parseIsoDate_(payload.data) || payload.data || "",
      payload.nomePaciente || "",
      payload.cirurgia || "",
      payload.atendimento || "",
      payload.tipo || "",
      payload.credor || "",
      payload.plantonistas || "",
      compactCellText_(buildObservacoes_(payload), "Observacao"),
      new Date(),
      user.email,
      "",
      "",
    ]);
    const appendedRow = sheet.getLastRow();
    setCompactCellWithNote_(
      sheet.getRange(appendedRow, REGISTROS_HEADERS.indexOf("Observacoes") + 1),
      buildObservacoes_(payload),
      "Observacao"
    );
    applyRowFormats_(sheet, appendedRow);

    return jsonResponse({
      ok: true,
      message: "Entrada salva com sucesso.",
      entries: getEntriesByDate_(payload.data),
      userEmail: user.email,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message,
    });
  }
}

function handleAuth_(payload) {
  const user = payload.authToken
    ? requireAuthorized_(payload.authToken, "")
    : requireAuthorized_("", payload.deviceToken, payload.userEmail);
  const response = {
    ok: true,
    email: user.email,
    name: user.name,
  };

  if (payload.deviceToken) {
    response.trustedDeviceExpiresAt = registerTrustedDevice_(payload.deviceToken, user);
  }

  return jsonResponse(response);
}

function handleAiHealth_(user) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(OPENAI_API_KEY_PROPERTY);
  if (!apiKey) {
    throw new Error("Configure a propriedade OPENAI_API_KEY no Apps Script.");
  }

  const response = UrlFetchApp.fetch("https://api.openai.com/v1/models/" + encodeURIComponent(OPENAI_MODEL), {
    method: "get",
    headers: {
      Authorization: "Bearer " + apiKey,
    },
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("API OpenAI nao confirmou o modelo " + OPENAI_MODEL + " (" + status + ").");
  }

  return jsonResponse({
    ok: true,
    model: OPENAI_MODEL,
    userEmail: user.email,
    message: "API OpenAI ativa.",
  });
}

function requireAuthorized_(idToken, deviceToken, claimedEmail) {
  const trustedUser = verifyTrustedDevice_(deviceToken);
  if (trustedUser) {
    return trustedUser;
  }

  const fallbackUser = recoverTrustedDeviceFromClaim_(deviceToken, claimedEmail);
  if (fallbackUser) {
    return fallbackUser;
  }

  const token = String(idToken || "").trim();
  if (!token) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }

  const user = verifyGoogleToken_(token);
  const email = String(user.email || "").toLowerCase();
  if (!email || AUTHORIZED_EMAILS.indexOf(email) === -1) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }

  return {
    email,
    name: user.name || "",
  };
}

function recoverTrustedDeviceFromClaim_(deviceToken, claimedEmail) {
  const token = normalizeDeviceToken_(deviceToken);
  const email = String(claimedEmail || "").trim().toLowerCase();
  if (!token || !email || AUTHORIZED_EMAILS.indexOf(email) === -1) {
    return null;
  }

  registerTrustedDevice_(token, { email, name: "" });
  return {
    email,
    name: "",
  };
}

function registerTrustedDevice_(deviceToken, user) {
  const token = normalizeDeviceToken_(deviceToken);
  if (!token) {
    return "";
  }

  const expiresAt = Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000;
  const devices = getTrustedDevices_();
  devices[token] = {
    email: String(user.email || "").toLowerCase(),
    name: user.name || "",
    expiresAt,
  };
  saveTrustedDevices_(devices);
  return new Date(expiresAt).toISOString();
}

function verifyTrustedDevice_(deviceToken) {
  const token = normalizeDeviceToken_(deviceToken);
  if (!token) {
    return null;
  }

  const devices = getTrustedDevices_();
  const record = devices[token];
  if (!record || Number(record.expiresAt || 0) <= Date.now()) {
    if (record) {
      delete devices[token];
      saveTrustedDevices_(devices);
    }
    return null;
  }

  const email = String(record.email || "").toLowerCase();
  if (!email || AUTHORIZED_EMAILS.indexOf(email) === -1) {
    delete devices[token];
    saveTrustedDevices_(devices);
    return null;
  }

  return {
    email,
    name: record.name || "",
  };
}

function getTrustedDevices_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(TRUSTED_DEVICES_PROPERTY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveTrustedDevices_(devices) {
  const now = Date.now();
  Object.keys(devices).forEach(function(token) {
    if (Number(devices[token].expiresAt || 0) <= now) {
      delete devices[token];
    }
  });
  PropertiesService.getScriptProperties().setProperty(TRUSTED_DEVICES_PROPERTY, JSON.stringify(devices));
}

function normalizeDeviceToken_(deviceToken) {
  const token = String(deviceToken || "").trim();
  return /^[a-f0-9]{64}$/i.test(token) ? token.toLowerCase() : "";
}

function verifyGoogleToken_(idToken) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "google-id-token:" + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)
    .map(function(byte) {
      return ("0" + (byte & 0xff).toString(16)).slice(-2);
    })
    .join("");
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), {
    method: "get",
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const content = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }

  const data = JSON.parse(content);
  if (String(data.aud || "") !== GOOGLE_CLIENT_ID) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }

  if (String(data.email_verified || "") !== "true") {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }

  cache.put(cacheKey, JSON.stringify(data), 300);
  return data;
}

function handleAiExtract_(payload) {
  const imageDataUrl = String(payload.imageDataUrl || "").trim();
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(imageDataUrl)) {
    throw new Error("Imagem invalida para leitura com IA.");
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty(OPENAI_API_KEY_PROPERTY);
  if (!apiKey) {
    throw new Error("Configure a propriedade OPENAI_API_KEY no Apps Script.");
  }

  const prompt = [
    "Voce le etiquetas hospitalares HMT.",
    "Extraia somente os campos abaixo e responda em JSON.",
    "Regras:",
    "1. nomePaciente: texto depois de 'Nome:' e antes de 'Pront:'. Exemplo: 'Celio Cardoso'. Nao inclua Pront nem o numero do prontuario.",
    "2. cirurgia: numero impresso abaixo do primeiro codigo de barras, na parte inferior esquerda, proximo de 'N.Cirur'. Deve conter somente digitos.",
    "3. atendimento: numero impresso abaixo do segundo codigo de barras, na parte inferior direita, proximo de 'N.Atend'. Deve conter somente digitos.",
    "Se houver duvida, use string vazia no campo duvidoso. Nao invente valores.",
  ].join("\n");

  const requestBody = {
    model: OPENAI_MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageDataUrl, detail: "high" },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "etiqueta_hmt",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["nomePaciente", "cirurgia", "atendimento"],
          properties: {
            nomePaciente: { type: "string" },
            cirurgia: { type: "string" },
            atendimento: { type: "string" },
          },
        },
      },
    },
  };

  const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + apiKey,
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const content = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error("Falha na IA (" + status + "): " + content.slice(0, 300));
  }

  const apiResult = JSON.parse(content);
  const outputText = extractOutputText_(apiResult);
  if (!outputText) {
    throw new Error("A IA nao retornou texto estruturado.");
  }

  const extracted = JSON.parse(outputText);
  const nomePaciente = cleanName_(extracted.nomePaciente);
  const cirurgia = cleanDigits_(extracted.cirurgia);
  const atendimento = cleanDigits_(extracted.atendimento);

  return jsonResponse({
    ok: true,
    nomePaciente,
    cirurgia,
    atendimento,
  });
}

function extractOutputText_(apiResult) {
  if (apiResult.output_text) {
    return apiResult.output_text;
  }

  const output = apiResult.output || [];
  for (let i = 0; i < output.length; i += 1) {
    const item = output[i];
    const content = item.content || [];
    for (let j = 0; j < content.length; j += 1) {
      if (content[j].type === "output_text" && content[j].text) {
        return content[j].text;
      }
    }
  }

  return "";
}

function ensureWorkbook_() {
  const spreadsheet = getSpreadsheet_();
  const registros = spreadsheet.getSheetByName(REGISTROS_SHEET) || spreadsheet.insertSheet(REGISTROS_SHEET);
  const listas = spreadsheet.getSheetByName(LISTAS_SHEET) || spreadsheet.insertSheet(LISTAS_SHEET);

  ensureHeaders_(registros, REGISTROS_HEADERS);
  seedLists_(listas);
  applyValidations_(registros, listas);
  formatRegistros_(registros);

  return spreadsheet;
}

function ensureHeaders_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const mustRewrite = headers.some((header, index) => current[index] !== header);

  if (mustRewrite) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.setFrozenRows(1);
}

function seedLists_(sheet) {
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([["Tipo", "Credor", "Plantonista(s)"]]);
  sheet.getRange(2, 1, TIPO_OPTIONS.length, 1).setValues(TIPO_OPTIONS.map((value) => [value]));
  sheet.getRange(2, 2, CREDOR_OPTIONS.length, 1).setValues(CREDOR_OPTIONS.map((value) => [value]));
  sheet.getRange(2, 3, PLANTONISTA_OPTIONS.length, 1).setValues(PLANTONISTA_OPTIONS.map((value) => [value]));
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
}

function applyValidations_(registros, listas) {
  const lastRow = Math.max(registros.getMaxRows(), 1000);
  const tipoRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(listas.getRange(2, 1, TIPO_OPTIONS.length, 1), true)
    .setAllowInvalid(false)
    .build();
  const credorRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(listas.getRange(2, 2, CREDOR_OPTIONS.length, 1), true)
    .setAllowInvalid(false)
    .build();

  registros.getRange(2, 5, lastRow - 1, 1).setDataValidation(tipoRule);
  registros.getRange(2, 6, lastRow - 1, 1).setDataValidation(credorRule);
}

function formatRegistros_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, REGISTROS_HEADERS.length);
  headerRange
    .setBackground("#0b3f3a")
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(2, 9, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sheet.getRange(2, 11, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sheet.getRange(2, 13, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sheet.autoResizeColumns(1, REGISTROS_HEADERS.length);
}

function applyRowFormats_(sheet, rowNumber) {
  if (rowNumber < 2) {
    return;
  }

  sheet.getRange(rowNumber, 1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(rowNumber, 9).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sheet.getRange(rowNumber, 11).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sheet.getRange(rowNumber, 13).setNumberFormat("dd/mm/yyyy hh:mm:ss");
}

function validatePayload_(payload) {
  const required = ["data", "nomePaciente", "cirurgia", "atendimento", "tipo", "credor"];
  if (payload.credor !== "Caixa") {
    required.push("plantonistas");
  }

  const missing = required.filter((key) => !String(payload[key] || "").trim());
  if (missing.length) {
    throw new Error("Campos obrigatorios ausentes: " + missing.join(", "));
  }
}

function handleUpdateObservation_(payload, user) {
  const rowNumber = Number(payload.rowNumber || 0);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Registro invalido para atualizar observacao.");
  }

  const sheet = getSpreadsheet_().getSheetByName(REGISTROS_SHEET);
  if (!sheet || rowNumber > sheet.getLastRow()) {
    throw new Error("Registro nao encontrado na planilha.");
  }

  const observacoesColumn = REGISTROS_HEADERS.indexOf("Observacoes") + 1;
  const observacaoAtualizadaEmColumn = REGISTROS_HEADERS.indexOf("Observacao atualizada em") + 1;
  const observacaoAtualizadaPorColumn = REGISTROS_HEADERS.indexOf("Observacao atualizada por") + 1;
  setCompactCellWithNote_(
    sheet.getRange(rowNumber, observacoesColumn),
    String(payload.observacoes || "").trim(),
    "Observacao"
  );
  sheet.getRange(rowNumber, observacaoAtualizadaEmColumn).setValue(new Date());
  sheet.getRange(rowNumber, observacaoAtualizadaPorColumn).setValue(user.email);
  applyRowFormats_(sheet, rowNumber);

  return jsonResponse({
    ok: true,
    message: "Observacao atualizada com sucesso.",
    userEmail: user.email,
    entry: rowToEntryFromSheet_(sheet, rowNumber),
  });
}

function handleUpdateRecord_(payload, user) {
  const rowNumber = Number(payload.rowNumber || 0);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Registro invalido para editar.");
  }

  validatePayload_(payload);

  const sheet = getSpreadsheet_().getSheetByName(REGISTROS_SHEET);
  if (!sheet || rowNumber > sheet.getLastRow()) {
    throw new Error("Registro nao encontrado na planilha.");
  }

  const oldEntry = rowToEntryFromSheet_(sheet, rowNumber);
  const updatedValues = [
    parseIsoDate_(payload.data) || payload.data || "",
    payload.nomePaciente || "",
    payload.cirurgia || "",
    payload.atendimento || "",
    payload.tipo || "",
    payload.credor || "",
    payload.credor === "Caixa" ? "" : (payload.plantonistas || ""),
    compactCellText_(String(payload.observacoes || "").trim(), "Observacao"),
  ];
  const changeSummary = buildEditSummary_(oldEntry, payload);
  const observationChanged = normalizeCompare_(oldEntry.observacoes || "") !== normalizeCompare_(payload.observacoes || "");

  sheet.getRange(rowNumber, 1, 1, 8).setValues([updatedValues]);
  setCompactCellWithNote_(
    sheet.getRange(rowNumber, REGISTROS_HEADERS.indexOf("Observacoes") + 1),
    String(payload.observacoes || "").trim(),
    "Observacao"
  );

  const observacaoAtualizadaEmColumn = REGISTROS_HEADERS.indexOf("Observacao atualizada em") + 1;
  const observacaoAtualizadaPorColumn = REGISTROS_HEADERS.indexOf("Observacao atualizada por") + 1;
  const editadoEmColumn = REGISTROS_HEADERS.indexOf("Editado em") + 1;
  const editadoPorColumn = REGISTROS_HEADERS.indexOf("Editado por") + 1;
  const resumoEdicaoColumn = REGISTROS_HEADERS.indexOf("Resumo da edicao") + 1;
  if (observationChanged) {
    sheet.getRange(rowNumber, observacaoAtualizadaEmColumn).setValue(new Date());
    sheet.getRange(rowNumber, observacaoAtualizadaPorColumn).setValue(user.email);
  }
  if (changeSummary) {
    sheet.getRange(rowNumber, editadoEmColumn).setValue(new Date());
    sheet.getRange(rowNumber, editadoPorColumn).setValue(user.email);
    setCompactCellWithNote_(
      sheet.getRange(rowNumber, resumoEdicaoColumn),
      appendEditHistory_(
        oldEntry.resumoEdicao,
        changeSummary,
        user.email
      ),
      "Edicao"
    );
  }
  applyRowFormats_(sheet, rowNumber);

  return jsonResponse({
    ok: true,
    message: "Registro editado com sucesso.",
    userEmail: user.email,
    entry: rowToEntryFromSheet_(sheet, rowNumber),
  });
}

function buildEditSummary_(oldEntry, payload) {
  const fields = [
    { key: "data", label: "Data", oldValue: normalizeDate_(oldEntry.data), newValue: normalizeDate_(payload.data) },
    { key: "nomePaciente", label: "Nome", oldValue: oldEntry.nomePaciente, newValue: payload.nomePaciente },
    { key: "cirurgia", label: "Cirurgia", oldValue: oldEntry.cirurgia, newValue: payload.cirurgia },
    { key: "atendimento", label: "Atendimento", oldValue: oldEntry.atendimento, newValue: payload.atendimento },
    { key: "tipo", label: "Tipo", oldValue: oldEntry.tipo, newValue: payload.tipo },
    { key: "credor", label: "Credor", oldValue: oldEntry.credor, newValue: payload.credor },
    { key: "plantonistas", label: "Plantonista(s)", oldValue: oldEntry.plantonistas, newValue: payload.credor === "Caixa" ? "" : payload.plantonistas },
  ];

  return fields
    .filter(function(field) {
      return normalizeCompare_(field.oldValue || "") !== normalizeCompare_(field.newValue || "");
    })
    .map(function(field) {
      const oldText = formatEditValue_(field.oldValue);
      const newText = formatEditValue_(field.newValue);
      return field.label + ": " + oldText + " -> " + newText;
    })
    .join("; ")
    .slice(0, 480);
}

function formatEditValue_(value) {
  const text = String(value || "").trim();
  return text || "(vazio)";
}

function appendEditHistory_(previousHistory, changeSummary, userEmail) {
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  const line = timestamp + " - " + userEmail + ": " + String(changeSummary || "").trim();
  const previous = String(previousHistory || "").trim();
  const history = previous ? line + "\n" + previous : line;
  return history.slice(0, 4000);
}

function buildObservacoes_(payload) {
  const observacoes = String(payload.observacoes || "").trim();
  const duplicateJustification = String(payload.duplicateJustification || "").trim();
  if (duplicateJustification && observacoes.indexOf("Duplicidade justificada:") === -1) {
    return "Duplicidade justificada: " + duplicateJustification;
  }

  return observacoes;
}

function findExactDuplicates_(payload) {
  const date = normalizeDate_(payload.data);
  return getEntriesByDate_(date).filter(function(entry) {
    return normalizeCompare_(entry.nomePaciente) === normalizeCompare_(payload.nomePaciente) &&
      cleanDigits_(entry.cirurgia) === cleanDigits_(payload.cirurgia) &&
      cleanDigits_(entry.atendimento) === cleanDigits_(payload.atendimento) &&
      normalizeCompare_(entry.tipo) === normalizeCompare_(payload.tipo) &&
      normalizeCompare_(entry.credor) === normalizeCompare_(payload.credor) &&
      normalizeCompare_(entry.plantonistas || "") === normalizeCompare_(payload.plantonistas || "");
  });
}

function getEntriesByDate_(date) {
  return getAllEntries_()
    .filter((entry) => entry.data === date);
}

function getEntriesByMonth_(month) {
  return getAllEntries_()
    .filter((entry) => entry.data.slice(0, 7) === month);
}

function searchEntries_(query, limit) {
  const normalizedQuery = normalizeCompare_(query);
  if (!normalizedQuery) {
    return [];
  }

  const maxRows = Math.min(Math.max(Number(limit || 60), 1), 200);
  return getAllEntries_()
    .filter(function(entry) {
      return normalizeCompare_([
        entry.data,
        entry.nomePaciente,
        entry.cirurgia,
        entry.atendimento,
        entry.tipo,
        entry.credor,
        entry.plantonistas,
        entry.observacoes,
        entry.criadoPor,
        entry.observacaoAtualizadaPor,
        entry.editadoPor,
        entry.resumoEdicao,
      ].join(" ")).indexOf(normalizedQuery) !== -1;
    })
    .slice(-maxRows)
    .reverse();
}

function getAllEntries_() {
  const sheet = getSpreadsheet_().getSheetByName(REGISTROS_SHEET);
  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, REGISTROS_HEADERS.length);
  const values = dataRange.getDisplayValues();
  const notes = dataRange.getNotes();
  return values
    .map((row, index) => rowToEntry_(row, index + 2, notes[index]));
}

function rowToEntry_(row, rowNumber, notes) {
  notes = notes || [];
  return {
    rowNumber,
    data: normalizeDate_(row[0]),
    nomePaciente: row[1],
    cirurgia: row[2],
    atendimento: row[3],
    tipo: row[4],
    credor: row[5],
    plantonistas: row[6],
    observacoes: notes[7] || row[7],
    criadoEm: row[8],
    criadoPor: row[9],
    observacaoAtualizadaEm: row[10],
    observacaoAtualizadaPor: row[11],
    editadoEm: row[12],
    editadoPor: row[13],
    resumoEdicao: notes[14] || row[14],
  };
}

function rowToEntryFromSheet_(sheet, rowNumber) {
  const range = sheet.getRange(rowNumber, 1, 1, REGISTROS_HEADERS.length);
  return rowToEntry_(range.getDisplayValues()[0], rowNumber, range.getNotes()[0]);
}

function setCompactCellWithNote_(range, fullText, label) {
  const text = String(fullText || "").trim();
  range.setValue(compactCellText_(text, label));
  if (text) {
    range.setNote(text);
  } else {
    range.clearNote();
  }
}

function compactCellText_(fullText, label) {
  const text = String(fullText || "").trim();
  if (!text) {
    return "";
  }

  return label + " em nota";
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function normalizeDate_(value) {
  const text = String(value || "").trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return text;
  }

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return brMatch[3] + "-" + brMatch[2] + "-" + brMatch[1];
  }

  return text;
}

function parseIsoDate_(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function normalizeCompare_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDigits_(value) {
  return String(value || "").replace(/\D/g, "");
}

function cleanName_(value) {
  return String(value || "")
    .replace(/\bPront\s*:.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
