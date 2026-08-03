// ==========================================
// CONFIGURAȚIA GLOBALĂ PROPERTY MANAGER
// ==========================================

const CONFIG = {

  // ==========================================
  // GOOGLE SPREADSHEET
  // ==========================================
  SPREADSHEET_ID: "17tD-ZjHze43xjuyhHd3LhKmYUNjb4NZXAujrAA9BxOQ",

  // Doar sheet-urile folosite în acest modul.
  SHEETS: {
    PROPERTIES: "Proprietati",
    INVOICES: "Facturi"
  },

  // ==========================================
  // GOOGLE DRIVE
  // ==========================================
  DRIVE: {
    // Folderul principal în care sunt puse toate facturile.
    ROOT_FOLDER_ID: "1OvmyyU6-GM2lBTRw9Jf3hXL75DWYc4p9",

    // Limba OCR
    OCR_LANGUAGE: "ro"
  },

    // ==========================================
  // API IMPORT
  // ==========================================
  API_IMPORT_SECRET: "w_F8621SKyZSqB4WLF4Niuk717k5a7FqtG3fi2U7p_U",

  // ==========================================
  // ENGIE API
  // ==========================================
  ENGIE_API: {
    EMAIL: "devicehome33b@gmail.com",
    PASSWORD: "123456789"
  },

  // ==========================================
  // FURNIZORI
  // ==========================================
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

  // ==========================================
  // PROPRIETĂȚI
  // ==========================================
  //
  // IMPORTANT:
  // Folosim numele reale ale proprietăților.
  //
  // Casa  = 1 Decembrie 1918 nr. 33B
  // Mama  = 1 Decembrie 1918 nr. 6
  //
  PROPERTIES_ADDRESS_KEYWORDS: {

    "Aluminiului": [
      "ALUMINIULUI"
    ],

    "Casa": [
      "1 DECEMBRIE",
      "1DECEMBRIE",
      "33B",
      "33 B"
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
      "1 DECEMBRIE",
      "1DECEMBRIE",
      "NR 6",
      "NR. 6",
      "NR6"
    ]
  },

  // ==========================================
  // CODURI CLIENT / CONTRACT -> PROPRIETATE
  // ==========================================
  //
  // Acestea sunt metoda PRIMARĂ de identificare.
  //
  CLIENT_CODE_MAP: {

    // ------------------------------------------
    // APA BRAȘOV
    // ------------------------------------------
    "Apa Brasov": {

      "P159/891": "Casa",

      "P159/1204": "Bronzului"
    },

    // ------------------------------------------
    // HIDROELECTRICA
    // ------------------------------------------
    "Hidroelectrica": {

      // Casa - 1 Decembrie 1918 nr. 33B
      "8000332262": "Casa",

      // Aluminiului
      "8000643720": "Aluminiului",

      // Mama - 1 Decembrie 1918 nr. 6
      "8000653333": "Mama",

      // Ferencz
      "8000706988": "Ferencz",

      // Forex
      "8000706992": "Forex",

      // Bronzului
      "8001641287": "Bronzului"
    },

    // ------------------------------------------
    // ENGIE
    // ------------------------------------------
    "ENGIE": {

      "191044028543": "Aluminiului",

      "191116656676": "Bronzului",

      "191162004110": "Ferencz",

      "191177615850": "Forex",

      "191133429842": "Casa"
    },

    // ------------------------------------------
    // COMPREST
    // ------------------------------------------
    "Comprest": {

      // Bronzului
      "57-20613": "Bronzului",

      // Casa - 1 Decembrie 1918 nr. 33B
      "1-8521": "Casa"
    }

    // Digi:
    // Nu are cod distinct pe proprietate.
    // Se identifică prin adresa din factură.
  }
};


// ==========================================
// SETUP DATABASE
// ==========================================

function setupDatabase() {

  // ------------------------------------------
  // PROPRIETATI
  // ------------------------------------------

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


  // ------------------------------------------
  // FACTURI
  // ------------------------------------------

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

  // Text - protejăm valorile precum:
  // Casa
  // Mama
  // P159/891
  // 1-8521
  // etc.
  invSheet.getRange("A:L").setNumberFormat("@");

  // M = DataImport -> rămâne dată reală

  invSheet.getRange("N:P").setNumberFormat("@");
}


// ==========================================
// POPULARE / CORECTARE PROPRIETĂȚI
// ==========================================
//
// Rulează această funcție după modificarea setup.gs.
//
// NU șterge facturile.
// NU șterge datele din Facturi.
// Actualizează lista Proprietati cu valorile corecte.
//

function actualizeazaProprietatiCorecte() {

  const sheet = getSheet(CONFIG.SHEETS.PROPERTIES);

  // Ștergem DOAR datele existente, păstrăm structura/headerul.
  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 8)
      .clearContent();
  }

  const proprietati = [

    [
      "Aluminiului",
      "Aluminiului",
      "Apartament",
      "Aluminiului",
      "Brasov",
      "",
      "Activ",
      ""
    ],

    [
      "Casa",
      "Casa",
      "Casa",
      "1 Decembrie 1918 nr. 33B",
      "Brasov",
      "",
      "Activ",
      ""
    ],

    [
      "Bronzului",
      "Bronzului",
      "Apartament",
      "Bronzului",
      "Brasov",
      "",
      "Activ",
      ""
    ],

    [
      "Forex",
      "Forex",
      "Apartament",
      "Aleea Constructorilor",
      "Brasov",
      "",
      "Activ",
      ""
    ],

    [
      "Ferencz",
      "Ferencz",
      "Apartament",
      "Szemler Ferencz",
      "Brasov",
      "",
      "Activ",
      ""
    ],

    [
      "Mama",
      "Mama",
      "Apartament",
      "1 Decembrie 1918 nr. 6",
      "Brasov",
      "",
      "Activ",
      ""
    ]
  ];

  sheet
    .getRange(2, 1, proprietati.length, 8)
    .setNumberFormat("@");

  sheet
    .getRange(2, 1, proprietati.length, 8)
    .setValues(proprietati);

  Logger.log(
    "Proprietăți actualizate: " +
    proprietati.map(p => p[0]).join(", ")
  );

  return {
    success: true,
    proprietati: proprietati.map(p => p[0])
  };
}


// ==========================================
// MIGRARE VECHIUL 1Dec -> CASA / MAMA
// ==========================================
//
// Dacă în Facturi există deja:
//     1Dec
//
// NU putem transforma automat toate în Casa,
// deoarece există două adrese diferite:
//
//     Casa = nr. 33B
//     Mama = nr. 6
//
// Prin urmare această funcție caută în TextOCR
// și decide după adresă.
//

function migreazaProprietati1Dec() {

  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return {
      actualizate: 0,
      neclare: 0
    };
  }

  const data = sheet
    .getRange(2, 1, lastRow - 1, 16)
    .getValues();

  let actualizate = 0;
  let neclare = 0;

  data.forEach((row, index) => {

    const proprietate = String(row[1] || "").trim();
    const textOCR = String(row[13] || "");

    if (proprietate !== "1Dec") {
      return;
    }

    const text = textOCR
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    let nouaProprietate = null;

    // Casa = nr. 33B
    if (
      text.indexOf("33B") !== -1 ||
      text.indexOf("33 B") !== -1
    ) {
      nouaProprietate = "Casa";
    }

    // Mama = nr. 6
    else if (
      text.indexOf("NR 6") !== -1 ||
      text.indexOf("NR. 6") !== -1 ||
      text.indexOf("NR6") !== -1
    ) {
      nouaProprietate = "Mama";
    }

    if (nouaProprietate) {

      sheet
        .getRange(index + 2, 2)
        .setNumberFormat("@");

      sheet
        .getRange(index + 2, 2)
        .setValue(nouaProprietate);

      actualizate++;

      Logger.log(
        "Factura rând " +
        (index + 2) +
        ": 1Dec -> " +
        nouaProprietate
      );

    } else {

      neclare++;

      Logger.log(
        "NECLAR - factura rând " +
        (index + 2) +
        " nu poate fi separată între Casa/Mama."
      );
    }
  });

  return {
    actualizate: actualizate,
    neclare: neclare
  };
}


// ==========================================
// MIGRARE CODURI VECHI
// ==========================================
//
// Repară eventualele valori vechi:
// 1Dec -> Casa/Mama
//
// Și se asigură că toate coloanele text
// rămân text.
//

function reparareStructuraProprietati() {

  const propSheet = getSheet(CONFIG.SHEETS.PROPERTIES);
  const invSheet = getSheet(CONFIG.SHEETS.INVOICES);

  propSheet.getRange("A:H").setNumberFormat("@");

  invSheet.getRange("A:L").setNumberFormat("@");
  invSheet.getRange("N:P").setNumberFormat("@");

  const rezultatMigrare = migreazaProprietati1Dec();

  Logger.log(
    "Migrare proprietăți finalizată: " +
    JSON.stringify(rezultatMigrare)
  );

  return rezultatMigrare;
}


// ==========================================
// MIGRARE COLOANE PLATĂ
// ==========================================

function migreazaColoanePlata() {

  const invSheet = getSheet(CONFIG.SHEETS.INVOICES);
  const lastRow = invSheet.getLastRow();

  if (lastRow === 0) {
    return {
      migrate: 0
    };
  }

  const headerRow = invSheet
    .getRange(1, 1, 1, Math.max(invSheet.getLastColumn(), 16))
    .getValues()[0];

  if (headerRow[14] !== "StatusPlata") {
    invSheet
      .getRange(1, 15)
      .setValue("StatusPlata");
  }

  if (headerRow[15] !== "LinkDovadaPlata") {
    invSheet
      .getRange(1, 16)
      .setValue("LinkDovadaPlata");
  }

  invSheet
    .getRange("O:P")
    .setNumberFormat("@");

  let completate = 0;

  if (lastRow > 1) {

    const existente = invSheet
      .getRange(2, 15, lastRow - 1, 1)
      .getValues();

    existente.forEach((row, i) => {

      if (!row[0]) {

        invSheet
          .getRange(i + 2, 15)
          .setValue("Neplatita");

        completate++;
      }
    });
  }

  Logger.log(
    "Coloane plată migrate. Rânduri completate: " +
    completate
  );

  return {
    migrate: completate
  };
}


// ==========================================
// VERIFICARE CONFIGURAȚIE
// ==========================================

function verificaConfiguratiaProprietati() {

  Logger.log("====================================");
  Logger.log("CONFIGURAȚIE PROPRIETĂȚI");
  Logger.log("====================================");

  Object.keys(CONFIG.PROPERTIES_ADDRESS_KEYWORDS)
    .forEach(function(proprietate) {

      Logger.log(
        proprietate +
        " -> " +
        CONFIG.PROPERTIES_ADDRESS_KEYWORDS[proprietate].join(", ")
      );
    });

  Logger.log("====================================");
  Logger.log("HIDROELECTRICA");
  Logger.log("====================================");

  Object.keys(CONFIG.CLIENT_CODE_MAP.Hidroelectrica)
    .forEach(function(cod) {

      Logger.log(
        cod +
        " -> " +
        CONFIG.CLIENT_CODE_MAP.Hidroelectrica[cod]
      );
    });

  Logger.log("====================================");
  Logger.log("APA BRASOV");
  Logger.log("====================================");

  Object.keys(CONFIG.CLIENT_CODE_MAP["Apa Brasov"])
    .forEach(function(cod) {

      Logger.log(
        cod +
        " -> " +
        CONFIG.CLIENT_CODE_MAP["Apa Brasov"][cod]
      );
    });

  Logger.log("====================================");
  Logger.log("COMPREST");
  Logger.log("====================================");

  Object.keys(CONFIG.CLIENT_CODE_MAP.Comprest)
    .forEach(function(cod) {

      Logger.log(
        cod +
        " -> " +
        CONFIG.CLIENT_CODE_MAP.Comprest[cod]
      );
    });

  return CONFIG;
}


// ==========================================
// FOLDERE DRIVE
// ==========================================
//
// Creează:
// ProprietyManagement - Facturi Utilitati
//   ├── Aluminiului
//   ├── Casa
//   ├── Bronzului
//   ├── Forex
//   ├── Ferencz
//   └── Mama
//

function setupDriveFolders() {

  const rootFolderName =
    "ProprietyManagement - Facturi Utilitati";

  const existingFolders =
    DriveApp.getFoldersByName(rootFolderName);

  let rootFolder;

  if (existingFolders.hasNext()) {

    rootFolder = existingFolders.next();

  } else {

    rootFolder =
      DriveApp.createFolder(rootFolderName);
  }

  const propertyNames =
    Object.keys(CONFIG.PROPERTIES_ADDRESS_KEYWORDS);

  propertyNames.forEach(function(name) {

    const existingSubfolders =
      rootFolder.getFoldersByName(name);

    if (!existingSubfolders.hasNext()) {

      rootFolder.createFolder(name);
    }
  });

  Logger.log(
    "Folder rădăcină: " +
    rootFolder.getName()
  );

  Logger.log(
    "ID: " +
    rootFolder.getId()
  );

  Logger.log(
    "URL: " +
    rootFolder.getUrl()
  );

  Logger.log(
    "Proprietăți: " +
    propertyNames.join(", ")
  );

  return {
    id: rootFolder.getId(),
    name: rootFolder.getName(),
    url: rootFolder.getUrl(),
    subfolders: propertyNames
  };
}