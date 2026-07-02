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
// PROPRIETĂȚI - INTERFEȚE VERSO BACKEND
// ==========================================

function apiSaveProperty(propertyObject) {
  return addProperty(propertyObject);
}

function apiGetProperties() {
  return getProperties();
}

// ==========================================
// UTILITĂȚI - INTERFEȚE VERSO BACKEND
// ==========================================

function apiSaveUtility(utilityObject) {
  const result = addUtility(utilityObject);
  // Trimite notificare WhatsApp
  if (result.success) {
    notifyNewUtility(utilityObject);
  }
  return result;
}

function apiGetUtilities() {
  return getUtilities();
}

function apiDeleteUtility(rowIndex) {
  return deleteUtility(rowIndex);
}

// ==========================================
// FACTURI - INTERFEȚE VERSO BACKEND
// ==========================================

function apiSaveInvoice(invoiceObject) {
  return addInvoice(invoiceObject);
}

function apiGetInvoices() {
  return getInvoices();
}

function apiDeleteInvoice(rowIndex) {
  return deleteInvoice(rowIndex);
}

// ==========================================
// FINANCIAR - INTERFEȚE VERSO BACKEND
// ==========================================

function apiGetFinancialData() {
  try {
    const utilities = getUtilities();
    const invoices = getInvoices();
    
    let totalUtilities = 0;
    let totalInvoices = 0;
    let unpaidAmount = 0;
    const locationTotals = {};
    
    utilities.forEach(util => {
      const value = parseFloat(util.valoare) || 0;
      totalUtilities += value;
      
      if (!locationTotals[util.locatie]) {
        locationTotals[util.locatie] = 0;
      }
      locationTotals[util.locatie] += value;
    });
    
    invoices.forEach(inv => {
      const value = parseFloat(inv.valoare) || 0;
      totalInvoices += value;
      
      if (inv.status !== "Plătit") {
        unpaidAmount += value;
      }
    });
    
    return {
      totalExpenses: totalUtilities + totalInvoices,
      utilitiesExpenses: totalUtilities,
      generalExpenses: totalInvoices,
      unpaidAmount: unpaidAmount,
      locationTotals: locationTotals,
      allExpenses: [
        ...utilities.map(u => ({
          type: u.tip_utilitate,
          location: u.locatie,
          value: u.valoare,
          date: u.data_factura,
          status: u.status
        })),
        ...invoices.map(i => ({
          type: "Factură generală",
          location: i.proprietate,
          value: i.valoare,
          date: i.data_factura,
          status: i.status
        }))
      ]
    };
  } catch (error) {
    throw new Error("Eroare la preluarea datelor financiare: " + error.message);
  }
}

// ==========================================
// RAPOARTE - INTERFEȚE VERSO BACKEND
// ==========================================

function apiGetReportsData() {
  try {
    const utilities = getUtilities();
    const invoices = getInvoices();
    
    const monthlyData = {};
    const locationTotals = {};
    const expenseTypes = {};
    
    utilities.forEach(util => {
      const value = parseFloat(util.valoare) || 0;
      const month = extractMonthFromDate(util.data_factura);
      
      if (!monthlyData[month]) {
        monthlyData[month] = { utilities: 0, invoices: 0, paidPercentage: 0 };
      }
      monthlyData[month].utilities += value;
      
      if (!locationTotals[util.locatie]) {
        locationTotals[util.locatie] = 0;
      }
      locationTotals[util.locatie] += value;
      
      if (!expenseTypes[util.tip_utilitate]) {
        expenseTypes[util.tip_utilitate] = 0;
      }
      expenseTypes[util.tip_utilitate] += value;
    });
    
    invoices.forEach(inv => {
      const value = parseFloat(inv.valoare) || 0;
      const month = extractMonthFromDate(inv.data_factura);
      
      if (!monthlyData[month]) {
        monthlyData[month] = { utilities: 0, invoices: 0, paidPercentage: 0 };
      }
      monthlyData[month].invoices += value;
      
      if (!expenseTypes["Facturi generale"]) {
        expenseTypes["Facturi generale"] = 0;
      }
      expenseTypes["Facturi generale"] += value;
    });
    
    return {
      monthlyData: monthlyData,
      locationTotals: locationTotals,
      expenseTypes: expenseTypes
    };
  } catch (error) {
    throw new Error("Eroare la preluarea rapoartelor: " + error.message);
  }
}

function apiGetFilteredReportsData(startDate, endDate, location) {
  try {
    const utilities = getUtilities().filter(u => {
      const uDate = new Date(u.data_factura);
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      const matchLocation = location === "" || u.locatie === location;
      return uDate >= sDate && uDate <= eDate && matchLocation;
    });
    
    const invoices = getInvoices().filter(i => {
      const iDate = new Date(i.data_factura);
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      return iDate >= sDate && iDate <= eDate;
    });
    
    const monthlyData = {};
    const locationTotals = {};
    const expenseTypes = {};
    
    utilities.forEach(util => {
      const value = parseFloat(util.valoare) || 0;
      const month = extractMonthFromDate(util.data_factura);
      
      if (!monthlyData[month]) {
        monthlyData[month] = { utilities: 0, invoices: 0, paidPercentage: 0 };
      }
      monthlyData[month].utilities += value;
      
      if (!locationTotals[util.locatie]) {
        locationTotals[util.locatie] = 0;
      }
      locationTotals[util.locatie] += value;
      
      if (!expenseTypes[util.tip_utilitate]) {
        expenseTypes[util.tip_utilitate] = 0;
      }
      expenseTypes[util.tip_utilitate] += value;
    });
    
    invoices.forEach(inv => {
      const value = parseFloat(inv.valoare) || 0;
      const month = extractMonthFromDate(inv.data_factura);
      
      if (!monthlyData[month]) {
        monthlyData[month] = { utilities: 0, invoices: 0, paidPercentage: 0 };
      }
      monthlyData[month].invoices += value;
    });
    
    return {
      monthlyData: monthlyData,
      locationTotals: locationTotals,
      expenseTypes: expenseTypes
    };
  } catch (error) {
    throw new Error("Eroare la filtrarea rapoartelor: " + error.message);
  }
}

// ==========================================
// WHATSAPP - INTERFEȚE VERSO BACKEND
// ==========================================

function apiSaveTwilioConfig(accountSid, authToken, fromNumber, toNumber, autoSend, autoSendTime) {
  try {
    const result = saveTwilioConfig(accountSid, authToken, fromNumber, toNumber, autoSend, autoSendTime);
    
    if (autoSend) {
      scheduleAutomaticDailyReport();
    }
    
    return result;
  } catch (error) {
    throw new Error(error.message);
  }
}

function apiTestTwilioConnection() {
  return testTwilioConnection();
}

function apiSendDailyReport() {
  return sendDailyReport();
}

// ==========================================
// FUNCȚII AJUTĂTOARE
// ==========================================

function extractMonthFromDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const months = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[date.getMonth()] + " " + date.getFullYear();
  } catch (e) {
    return "Necunoscut";
  }
}