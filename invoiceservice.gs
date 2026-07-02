/**
 * Preluarea tuturor facturilor din Google Sheets
 */
function getInvoices() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.INVOICES);
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) return [];
    
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    
    return data.map(row => ({
      nr_factura: row[0],
      data_factura: row[1],
      proprietate: row[2],
      descriere: row[3],
      valoare: row[4],
      data_scadenta: row[5],
      status: row[6]
    }));
  } catch (error) {
    Logger.log("Eroare în invoiceservice -> getInvoices: " + error.toString());
    throw new Error("Nu s-au putut citi facturile: " + error.message);
  }
}

/**
 * Salvarea unei facturi noi
 */
function addInvoice(invoiceData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.INVOICES);
    
    sheet.appendRow([
      invoiceData.nr_factura,
      invoiceData.data_factura,
      invoiceData.proprietate,
      invoiceData.descriere,
      parseFloat(invoiceData.valoare) || 0,
      invoiceData.data_scadenta,
      invoiceData.status || "Neplatit"
    ]);
    
    return { success: true };
  } catch (error) {
    Logger.log("Eroare în invoiceservice -> addInvoice: " + error.toString());
    throw new Error("Nu s-a putut salva factura: " + error.message);
  }
}

/**
 * Ștergerea unei facturi
 */
function deleteInvoice(rowIndex) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.INVOICES);
    if (rowIndex >= 0 && rowIndex < sheet.getLastRow() - 1) {
      sheet.deleteRow(rowIndex + 2);
      return { success: true };
    }
    throw new Error("Index invalid");
  } catch (error) {
    Logger.log("Eroare în invoiceservice -> deleteInvoice: " + error.toString());
    throw new Error("Nu s-a putut șterge factura: " + error.message);
  }
}