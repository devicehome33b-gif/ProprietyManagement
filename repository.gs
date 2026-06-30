function getSheet(sheetName) {
  // ID-ul tău furnizat
  const SPREADSHEET_ID = "19gfMS0_aB96ZsTSbu_dw-37lJMyUZmT_rkbwSul82YS6rXEwkfYBBIbD";
  
  // Verificăm dacă ID-ul este un string valid
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "") {
    throw new Error("ID-ul foii de calcul lipsește din repository.gs!");
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    return sheet;
  } catch (e) {
    throw new Error("Eroare la accesarea Sheet-ului (verifică ID-ul): " + e.message);
  }
}