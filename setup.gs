// Configurațiile globale ale sistemului ERP
const CONFIG = {
  SHEETS: {
    PROPERTIES: "Proprietati",
    TENANTS: "Chiriasi",
    CONTRACTS: "Contracte",
    INVOICES: "Facturi"
  }
};

/**
 * Funcție care rulează o singură dată la instalare pentru a crea structura inițială de coloane
 */
function setupDatabase() {
  const propSheet = getSheet(CONFIG.SHEETS.PROPERTIES);
  if (propSheet.getLastRow() === 0) {
    // Dacă e goală, scriem capul de tabel exact cum le va citi codul
    propSheet.appendRow(["Denumire", "Tip", "Adresa", "Oras", "Proprietar", "Status", "Observatii"]);
  }
}