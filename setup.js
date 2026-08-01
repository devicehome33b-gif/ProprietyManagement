
// Configurațiile globale ale sistemului ERP
const CONFIG = {
  SHEETS: {
    PROPERTIES: "Proprietati",
    TENANTS: "Chiriasi",
    CONTRACTS: "Contracte",
    INVOICES: "Facturi"
  },

  DRIVE: {
    ROOT_FOLDER_ID: "1OvmyyU6-GM2lBTRw9Jf3hXL75DWYc4p9",
    OCR_LANGUAGE: "ro"
  },

  API_IMPORT_SECRET: "w_F8621SKyZSqB4WLF4Niuk717k5a7FqtG3fi2U7p_U",

  PROVIDERS: {
    "Apa Brasov": [
      "COMPANIA APA BRASOV",
      "APA BRASOV"
    ],
    "Hidroelectrica": [
      "HIDROELECTRICA"
    ],
    "Digi": [
      "DIGI ROMANIA",
      "DIGI.RO"
    ],
    "Comprest": [
      "COMPREST",
      "COMBV"
    ],
    "ENGIE": [
      "ENGIE"
    ]
  },

  /*
   * Proprietățile reale.
   *
   * IMPORTANT:
   * Casa și Mama sunt două proprietăți diferite,
   * deși ambele au "1 Decembrie 1918" în adresă.
   */
  PROPERTIES_ADDRESS_KEYWORDS: {

    "Aluminiului": [
      "ALUMINIULUI"
    ],

    "Casa": [
      "1 DECEMBRIE 1918 NR 33B",
      "1 DECEMBRIE 1918 NR. 33B",
      "1 DECEMBRIE 1918 33B",
      "1 DECEMBRIE NR 33B",
      "1 DECEMBRIE NR. 33B",
      "33B"
    ],

    "Bronzului": [
      "BRONZULUI"
    ],

    "Forex": [
      "CONSTRUCTORILOR"
    ],

    "Ferencz": [
      "SZEMLER FERENCZ",
      "SZEMLER FERENC",
      "FERENCZ"
    ],

    "Mama": [
      "1 DECEMBRIE 1918 NR 6",
      "1 DECEMBRIE 1918 NR. 6",
      "1 DECEMBRIE 1918 6",
      "1 DECEMBRIE NR 6",
      "1 DECEMBRIE NR. 6"
    ]
  },

  /*
   * Mapare cod client / cont contract -> proprietate.
   *
   * Aceasta este metoda PRIMARĂ de identificare.
   * Dacă un cod este cunoscut, nu mai depindem de OCR-ul adresei.
   */
  CLIENT_CODE_MAP: {

    "Apa Brasov": {
      "P159/1204": "Bronzului",
      "P159/891": "Casa"
    },

    "Hidroelectrica": {
      "8000332262": "Casa",
      "8000643720": "Aluminiului",
      "8000653333": "Mama",

      "8000706988": "Ferencz",
      "8000706992": "Forex",
      "8001641287": "Bronzului"
    },

    "ENGIE": {
      "191044028543": "Aluminiului",
      "191116656676": "Bronzului",
      "191162004110": "Ferencz",
      "191177615850": "Forex"

      /*
       * IMPORTANT:
       * Vechiul:
       *
       * "191133429842": "1Dec"
       *
       * NU mai este folosit aici deoarece "1 Decembrie"
       * poate însemna Casa (nr. 33B) sau Mama (nr. 6).
       *
       * Dacă acest cod ENGIE este comun sau nu poate diferenția
       * cele două locații, identificarea trebuie făcută după adresă.
       */
    },

    "Comprest": {
      "57-20613": "Bronzului",
      "1-8521": "Casa"
    }

    /*
     * Digi:
     * nu folosim codul de client pentru proprietate,
     * deoarece este comun.
     * Identificarea se face după adresă.
     */
  }
};


/**
 * Creează structura inițială a bazei de date.
 *
 * NU creează / modifică Chiriasi și Contracte.
 * Pentru proiectul actual folosim doar:
 *   - Proprietati
 *   - Facturi
 */
function setupDatabase() {

  // ================================
  // PROPRIETATI
  // ================================

  const propSheet = getSheet(CONFIG.SHEETS.PROPERTIES);

  if (propSheet.getLastRow() === 0) {
    propSheet.appendRow([
      "ID",
      "Denumire",
      "Tip",
      "Adresa",
      "Oras",
      "Proprietar",
      "Status",
      "Observatii"
    ]);
  }

  propSheet.getRange("A:H").setNumberFormat("@");


  // ================================
  // FACTURI
  // ================================

  const invSheet = getSheet(CONFIG.SHEETS.INVOICES);

  if (invSheet.getLastRow() === 0) {
    invSheet.appendRow([
      "FileID",
      "Proprietate",
      "Furnizor",
      "CodClient",
      "NumarFactura",
      "Perioada",
      "DataEmitere",
      "DataScadenta",
      "Suma",
      "Moneda",
      "Status",
      "LinkDrive",
      "DataImport",
      "TextOCR",
      "StatusPlata",
      "LinkDovadaPlata"
    ]);
  }

  invSheet.getRange("A:L").setNumberFormat("@");
  invSheet.getRange("N:P").setNumberFormat("@");

  Logger.log("setupDatabase finalizat.");
}
