/**
 * Preluarea tuturor proprietăților din Google Sheets
 */
function getProperties() {
  try {
    // Folosește funcția ta nativă din repository.gs și CONFIG-ul din setup.gs
    const sheet = getSheet(CONFIG.SHEETS.PROPERTIES); 
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) return []; // Dacă e doar capul de tabel, returnăm o listă goală
    
    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    
    return data.map(row => ({
      denumire: row[0],
      tip: row[1],
      adresa: row[2],
      oras: row[3],
      proprietar: row[4],
      status: row[5],
      observatii: row[6]
    }));
  } catch (error) {
    Logger.log("Eroare în propertyservice -> getProperties: " + error.toString());
    throw new Error("Nu s-au putut citi proprietățile: " + error.message);
  }
}

/**
 * Salvarea unei proprietăți noi în Google Sheets
 */
function addProperty(propertyData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.PROPERTIES);
    
    sheet.appendRow([
      propertyData.denumire,
      propertyData.tip,
      propertyData.adresa,
      propertyData.oras,
      propertyData.proprietar,
      propertyData.status || "Activ",
      propertyData.observatii || ""
    ]);
    
    return { success: true };
  } catch (error) {
    Logger.log("Eroare în propertyservice -> addProperty: " + error.toString());
    throw new Error("Nu s-a putut salva proprietatea: " + error.message);
  }
}