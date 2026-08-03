function getSheet(sheetName) {
  // ID-ul tău furnizat
  const SPREADSHEET_ID = "17tD-ZjHze43xjuyhHd3LhKmYUNjb4NZXAujrAA9BxOQ";
  
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
