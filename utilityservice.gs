/**
 * Preluarea tuturor facturilor de utilități din Google Sheets
 */
function getUtilities() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.UTILITIES);
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) return [];
    
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    
    return data.map(row => ({
      data_factura: row[0],
      locatie: row[1],
      tip_utilitate: row[2],
      valoare: row[3],
      furnizor: row[4],
      perioada: row[5],
      status: row[6],
      observatii: row[7]
    }));
  } catch (error) {
    Logger.log("Eroare în utilityservice -> getUtilities: " + error.toString());
    throw new Error("Nu s-au putut citi facturile: " + error.message);
  }
}

/**
 * Salvarea unei facturi noi în Google Sheets
 */
function addUtility(utilityData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.UTILITIES);
    
    sheet.appendRow([
      utilityData.data_factura,
      utilityData.locatie,
      utilityData.tip_utilitate,
      parseFloat(utilityData.valoare) || 0,
      utilityData.furnizor || "",
      utilityData.perioada || "",
      utilityData.status || "Neplătit",
      utilityData.observatii || ""
    ]);
    
    return { success: true };
  } catch (error) {
    Logger.log("Eroare în utilityservice -> addUtility: " + error.toString());
    throw new Error("Nu s-a putut salva factura: " + error.message);
  }
}

/**
 * Ștergerea unei facturi
 */
function deleteUtility(rowIndex) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.UTILITIES);
    if (rowIndex >= 0 && rowIndex < sheet.getLastRow() - 1) {
      sheet.deleteRow(rowIndex + 2); // +2 pentru că indexul începe de la 0 și avem header la rând 1
      return { success: true };
    }
    throw new Error("Index invalid");
  } catch (error) {
    Logger.log("Eroare în utilityservice -> deleteUtility: " + error.toString());
    throw new Error("Nu s-a putut șterge factura: " + error.message);
  }
}

/**
 * Calculează total cheltuieli pe locație
 */
function getTotalByLocation() {
  try {
    const utilities = getUtilities();
    const totals = {};
    
    utilities.forEach(util => {
      if (!totals[util.locatie]) {
        totals[util.locatie] = 0;
      }
      totals[util.locatie] += parseFloat(util.valoare) || 0;
    });
    
    return totals;
  } catch (error) {
    Logger.log("Eroare în utilityservice -> getTotalByLocation: " + error.toString());
    throw new Error("Nu s-au putut calcula totalurile: " + error.message);
  }
}

/**
 * Calculează total general al cheltuielilor
 */
function getTotalUtilities() {
  try {
    const utilities = getUtilities();
    let total = 0;
    
    utilities.forEach(util => {
      total += parseFloat(util.valoare) || 0;
    });
    
    return total;
  } catch (error) {
    Logger.log("Eroare în utilityservice -> getTotalUtilities: " + error.toString());
    throw new Error("Nu s-au putut calcula totalurile: " + error.message);
  }
}