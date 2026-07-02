// Configurațiile globale ale sistemului ERP
const CONFIG = {
  SHEETS: {
    PROPERTIES: "Proprietati",
    UTILITIES: "Utilitati",
    INVOICES: "Facturi"
  }
};

/**
 * Funcție care rulează o singură dată la instalare pentru a crea structura inițială de coloane
 */
function setupDatabase() {
  const propSheet = getSheet(CONFIG.SHEETS.PROPERTIES);
  if (propSheet.getLastRow() === 0) {
    propSheet.appendRow(["Denumire", "Tip", "Adresa", "Oras", "Proprietar", "Status", "Observatii"]);
  }

  const utilSheet = getSheet(CONFIG.SHEETS.UTILITIES);
  if (utilSheet.getLastRow() === 0) {
    utilSheet.appendRow(["Data Factura", "Locatie", "Tip Utilitate", "Valoare", "Furnizor", "Perioada", "Status", "Observatii"]);
  }

  const invSheet = getSheet(CONFIG.SHEETS.INVOICES);
  if (invSheet.getLastRow() === 0) {
    invSheet.appendRow(["Nr Factura", "Data Factura", "Proprietate", "Descriere", "Valoare", "Data Scadenta", "Status"]);
  }
  
  Logger.log("Bază de date inițializată cu succes!");
}