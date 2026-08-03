function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Property Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Primește facturi trimise din surse externe (ex: scriptul Python care citește direct
 * din API-ul Hidroelectrica).
 *
 * Corp așteptat:
 * {
 *   "secret": "...",
 *   "furnizor": "Hidroelectrica",
 *   "proprietate": "1Dec",
 *   "codClient": "8001641287",
 *   "numarFactura": "26107074187",
 *   "dataEmitere": "12.06.2026",
 *   "dataScadenta": "27.07.2026",
 *   "suma": 125.21,
 *   "sursaImport": "API Hidroelectrica (automat)"
 * }
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (
      !CONFIG.API_IMPORT_SECRET ||
      CONFIG.API_IMPORT_SECRET === "PUNE_UN_SECRET_AICI"
    ) {
      throw new Error(
        "CONFIG.API_IMPORT_SECRET nu e configurat în setup.gs."
      );
    }

    if (payload.secret !== CONFIG.API_IMPORT_SECRET) {
      throw new Error("Secret invalid.");
    }

    const rezultat = importaFacturaExterna_(payload);

    return ContentService
      .createTextOutput(
        JSON.stringify({
          success: true,
          rezultat: rezultat
        })
      )
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(
        JSON.stringify({
          success: false,
          error: error.message
        })
      )
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

/**
 * Încarcă dinamic componenta HTML a unui modul pentru SPA.
 */
function apiGetModuleHtml(moduleName) {

  const moduleMap = {
    "Dashboard": "dashboard",
    "Proprietati": "properties",
    "Contracte": "contracts",
    "Facturi": "invoices",
    "Rapoarte": "reports",
    "Setari": "settings"
  };

  const fileName = moduleMap[moduleName] || "dashboard";

  try {
    return HtmlService
      .createHtmlOutputFromFile(fileName)
      .getContent();

  } catch (error) {
    return `<div class="alert alert-danger mt-3">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <strong>Eroare:</strong>
      Modulul <code>${fileName}.html</code> nu a putut fi încărcat:
      ${error.message}
    </div>`;
  }
}


// ==========================================
// PROPRIETĂȚI
// ==========================================

function apiSaveProperty(propertyObject) {
  return addProperty(propertyObject);
}

function apiUpdateProperty(id, propertyObject) {
  return updateProperty(id, propertyObject);
}

function apiDeleteProperty(id) {
  return deleteProperty(id);
}

function apiGetProperties() {
  return getProperties();
}


// ==========================================
// CONTRACTE
// ==========================================

function apiGetContracts() {
  return getContracts();
}

function apiSaveContract(contractObject) {
  return addContract(contractObject);
}

function apiUpdateContract(id, contractObject) {
  return updateContract(id, contractObject);
}

function apiDeleteContract(id) {
  return deleteContract(id);
}

/**
 * Returnează lista furnizorilor disponibili în CONFIG.PROVIDERS.
 * contracts.html folosește această listă pentru dropdown.
 */
function apiGetProviderNames() {
  return Object.keys(CONFIG.PROVIDERS || {});
}


// ==========================================
// FACTURI
// ==========================================

function apiGetInvoices() {
  return getInvoices();
}

function apiImportInvoicesFromDrive() {
  return importInvoicesFromDrive();
}

function apiSetupDriveFolders() {
  return setupDriveFolders();
}

function apiGetDriveFolderUrl() {
  return "https://drive.google.com/drive/folders/" +
    CONFIG.DRIVE.ROOT_FOLDER_ID;
}

function apiGetPropertyFolderUrls() {
  return getPropertyFolderUrls_();
}

function apiMarcheazaFacturaPlatita(fileId, linkDovadaPlata) {
  return marcheazaFacturaPlatita_(fileId, linkDovadaPlata);
}

function apiAnuleazaPlataFactura(fileId) {
  return anuleazaPlataFactura_(fileId);
}


// ==========================================
// DASHBOARD
// ==========================================

function apiGetDashboardStats() {
  const properties = getProperties();
  const invoices = getInvoices();

  const totalUtilitati = invoices.reduce(
    (sum, inv) => sum + (Number(inv.suma) || 0),
    0
  );

  return {
    totalProprietati: properties.length,
    totalFacturi: invoices.length,
    totalUtilitati: totalUtilitati
  };
}

/**
 * Endpoint combinat pentru Dashboard.
 */
function apiGetDashboardData() {
  const properties = getProperties();
  const invoices = getInvoices();

  const totalUtilitati = invoices.reduce(
    (sum, inv) => sum + (Number(inv.suma) || 0),
    0
  );

  return {
    totalProprietati: properties.length,
    totalFacturi: invoices.length,
    totalUtilitati: totalUtilitati,
    invoices: invoices
  };
}

/**
 * Endpoint combinat pentru pagina Facturi.
 */
function apiGetFacturiPageData() {
  return {
    invoices: getInvoices(),
    driveFolderUrl:
      "https://drive.google.com/drive/folders/" +
      CONFIG.DRIVE.ROOT_FOLDER_ID,
    propertyFolderUrls: getPropertyFolderUrls_()
  };
}


// ==========================================
// SETĂRI / ÎNTREȚINERE
// ==========================================

function apiRepararSumeToateFacturile() {
  return repararSumeToateFacturile();
}

function apiMigreazaFacturileInSubfoldere() {
  return migreazaFacturileInSubfoldere();
}

function apiRepararDateCorupte() {
  return repararDateCorupte();
}

function apiMigreazaColoanePlata() {
  return migreazaColoanePlata();
}

function apiPrevizualizeazaFacturiDuplicate() {
  return previzualizeazaFacturiDuplicate();
}

function apiStergeRanduriFacturi(indeciiRandurilor) {
  return stergeRanduriFacturi(indeciiRandurilor);
}

function apiGetSetariInfo() {
  return {
    driveFolderUrl:
      "https://drive.google.com/drive/folders/" +
      CONFIG.DRIVE.ROOT_FOLDER_ID,

    numarProprietati: getProperties().length,
    numarFacturi: getInvoices().length
  };
}
function testVitezaDoGet() {
  const start = new Date().getTime();

  const html = HtmlService
    .createTemplateFromFile("index")
    .evaluate()
    .getContent();

  const end = new Date().getTime();

  Logger.log("========================================");
  Logger.log("TEST VITEZA doGet / index.html");
  Logger.log("========================================");
  Logger.log("Dimensiune HTML: " + html.length + " caractere");
  Logger.log("Timp generare: " + ((end - start) / 1000).toFixed(2) + " secunde");
  Logger.log("========================================");
}
function testApiGetDashboardData() {
  Logger.log("========================================");
  Logger.log("TEST apiGetDashboardData");
  Logger.log("========================================");

  const data = apiGetDashboardData();

  Logger.log("TIP: " + typeof data);
  Logger.log("NULL: " + (data === null));
  Logger.log("JSON:");
  Logger.log(JSON.stringify(data));

  if (data) {
    Logger.log("totalProprietati: " + data.totalProprietati);
    Logger.log("totalFacturi: " + data.totalFacturi);
    Logger.log("totalUtilitati: " + data.totalUtilitati);
    Logger.log(
      "invoices: " +
      (Array.isArray(data.invoices) ? data.invoices.length : "NU ESTE ARRAY")
    );
  }
}
function inventarFoiProiect() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();

  Logger.log("========================================");
  Logger.log("INVENTAR FOI PROPERTY MANAGER");
  Logger.log("========================================");

  sheets.forEach((sheet, index) => {
    Logger.log(
      `${index + 1}. "${sheet.getName()}" | ` +
      `rânduri=${sheet.getLastRow()} | coloane=${sheet.getLastColumn()}`
    );
  });

  Logger.log("========================================");
  Logger.log("CONFIG.SHEETS");
  Logger.log("========================================");

  Logger.log(JSON.stringify(CONFIG.SHEETS, null, 2));

  Logger.log("========================================");
  Logger.log("FINAL");
  Logger.log("========================================");
}