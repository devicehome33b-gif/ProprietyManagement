function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Property Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Încarcă dinamic componenta HTML a unui modul pentru SPA
 */
function apiGetModuleHtml(moduleName) {
  const moduleMap = {
    "Dashboard": "dashboard",
    "Proprietati": "properties",
    "Chiriasi": "tenants",
    "Contracte": "contracts",
    "Facturi": "invoices",
    "Utilitati": "utilities",
    "Financiar": "financial",
    "Rapoarte": "reports",
    "Setari": "settings"
  };

  const fileName = moduleMap[moduleName] || "dashboard";
  
  try {
    return HtmlService.createTemplateFromFile(fileName).evaluate().getContent();
  } catch (error) {
    return `<div class="alert alert-danger mt-3">
              <i class="bi bi-exclamation-triangle-fill"></i> 
              <strong>Eroare:</strong> Modulul <code>${fileName}.html</code> nu a putut fi încărcat: ${error.message}
            </div>`;
  }
}

// ==========================================
// EXPUNERE INTERFEȚE CĂTRE BACKEND
// ==========================================

function apiSaveProperty(propertyObject) {
  return addProperty(propertyObject);
}

function apiGetProperties() {
  return getProperties();
}