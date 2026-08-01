/**
 * Funcție de DEBUG: afișează direct în Logs rezultatul getProperties(),
 * ca să comparăm cu ce arată Dashboard-ul vs pagina Proprietăți.
 */
function debugGetProperties() {
  const properties = getProperties();
  Logger.log("Număr proprietăți găsite: " + properties.length);
  Logger.log(JSON.stringify(properties, null, 2));
  return properties;
}

/**
 * Preluarea tuturor proprietăților din Google Sheets
 */
function getProperties() {
  try {
    // Folosește funcția ta nativă din repository.gs și CONFIG-ul din setup.gs
    const sheet = getSheet(CONFIG.SHEETS.PROPERTIES); 
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) return []; // Dacă e doar capul de tabel, returnăm o listă goală
    
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    
    return data.map(row => ({
      id: row[0],
      denumire: row[1],
      tip: row[2],
      adresa: row[3],
      oras: row[4],
      proprietar: row[5],
      status: row[6],
      observatii: row[7]
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

    // Siguranță: dacă sheet-ul e complet gol (nu s-a rulat setupDatabase() înainte),
    // scriem antetul acum, ca prima proprietate să nu ajungă pe rândul 1 fără titluri.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "Denumire", "Tip", "Adresa", "Oras", "Proprietar", "Status", "Observatii"]);
    }

    const newId = Utilities.getUuid();

    // Protecție: Google Sheets poate reinterpreta text ca "1Dec" drept dată calendaristică.
    // Forțăm coloanele ca text simplu înainte de scriere.
    sheet.getRange("A:H").setNumberFormat("@");

    sheet.appendRow([
      newId,
      propertyData.denumire,
      propertyData.tip,
      propertyData.adresa,
      propertyData.oras,
      propertyData.proprietar,
      propertyData.status || "Activ",
      propertyData.observatii || ""
    ]);
    
    return { success: true, id: newId };
  } catch (error) {
    Logger.log("Eroare în propertyservice -> addProperty: " + error.toString());
    throw new Error("Nu s-a putut salva proprietatea: " + error.message);
  }
}

/**
 * Creează automat cele 5 proprietăți cunoscute (Alu, Brz, Forex, Ferencz, 1Dec), cu adresele
 * confirmate din facturile reale. Rulează o singură dată din editor (Run -> setupProprietatiInitiale).
 * E sigură de rulat de mai multe ori - nu creează duplicate dacă o denumire există deja.
 */

/**
 * Creează/verifică cele 6 proprietăți standard.
 *
 * IMPORTANT:
 * - verifică după ADRESĂ, nu doar după denumire;
 * - nu creează duplicate dacă funcția este rulată din nou;
 * - nu șterge și nu modifică proprietățile existente;
 * - Casa și Mama sunt proprietăți distincte.
 */
function setupProprietatiInitiale() {
  const proprietatiInitiale = [
    {
      denumire: "Alu",
      tip: "Apartament",
      adresa: "Strada Aluminiului, Nr. 3, Bl. 508, Sc. B, Ap. 2",
      oras: "Brasov"
    },
    {
      denumire: "Brz",
      tip: "Apartament",
      adresa: "Strada Bronzului, Nr. 46, Bl. C1, Ap. 21",
      oras: "Brasov"
    },
    {
      denumire: "Forex",
      tip: "Garsoniera",
      adresa: "Aleea Constructorilor, Nr. 2, Bl. FN, Sc. A, Ap. 60",
      oras: "Brasov"
    },
    {
      denumire: "Ferencz",
      tip: "Apartament",
      adresa: "Strada Szemler Ferenc, Nr. 4, Ap. 3",
      oras: "Brasov"
    },
    {
      denumire: "Casa",
      tip: "Casa",
      adresa: "Strada 1 Decembrie 1918, Nr. 33B",
      oras: "Brasov"
    },
    {
      denumire: "Mama",
      tip: "Apartament",
      adresa: "Strada 1 Decembrie 1918, Nr. 6",
      oras: "Brasov"
    }
  ];

  const existente = getProperties();

  // Normalizare pentru comparația adreselor
  const normalize = value =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  let create = 0;
  let gasite = 0;

  proprietatiInitiale.forEach(p => {
    const adresaNoua = normalize(p.adresa);

    const exista = existente.some(existing => {
      return normalize(existing.adresa) === adresaNoua;
    });

    if (exista) {
      gasite++;
      Logger.log(
        "EXISTĂ deja: " + p.denumire + " | " + p.adresa
      );
      return;
    }

    addProperty({
      denumire: p.denumire,
      tip: p.tip,
      adresa: p.adresa,
      oras: p.oras,
      proprietar: "Adrian",
      status: "Activ",
      observatii: ""
    });

    create++;

    Logger.log(
      "CREATĂ: " + p.denumire + " | " + p.adresa
    );
  });

  Logger.log(
    "========================================"
  );
  Logger.log(
    "Proprietăți create: " + create
  );
  Logger.log(
    "Proprietăți deja existente: " + gasite
  );
  Logger.log(
    "========================================"
  );

  return {
    create: create,
    existente: gasite
  };
}


/**
 * Actualizarea unei proprietăți existente, identificată după ID (coloana A).
 */
function updateProperty(id, propertyData) {
  try {
    if (!id) throw new Error("Lipsește ID-ul proprietății de actualizat.");

    const sheet = getSheet(CONFIG.SHEETS.PROPERTIES);
    const rowIndex = findRowById_(sheet, id);

    if (rowIndex === -1) {
      throw new Error("Proprietatea cu ID-ul " + id + " nu a fost găsită.");
    }

    // Rescriem coloanele B..H (Denumire..Observatii), păstrăm ID-ul neschimbat pe coloana A
    sheet.getRange(rowIndex, 2, 1, 7).setNumberFormat("@");
    sheet.getRange(rowIndex, 2, 1, 7).setValues([[
      propertyData.denumire,
      propertyData.tip,
      propertyData.adresa,
      propertyData.oras,
      propertyData.proprietar,
      propertyData.status || "Activ",
      propertyData.observatii || ""
    ]]);

    return { success: true };
  } catch (error) {
    Logger.log("Eroare în propertyservice -> updateProperty: " + error.toString());
    throw new Error("Nu s-a putut actualiza proprietatea: " + error.message);
  }
}

/**
 * Ștergerea unei proprietăți, identificată după ID (coloana A).
 */
function deleteProperty(id) {
  try {
    if (!id) throw new Error("Lipsește ID-ul proprietății de șters.");

    const sheet = getSheet(CONFIG.SHEETS.PROPERTIES);
    const rowIndex = findRowById_(sheet, id);

    if (rowIndex === -1) {
      throw new Error("Proprietatea cu ID-ul " + id + " nu a fost găsită.");
    }

    sheet.deleteRow(rowIndex);
    return { success: true };
  } catch (error) {
    Logger.log("Eroare în propertyservice -> deleteProperty: " + error.toString());
    throw new Error("Nu s-a putut șterge proprietatea: " + error.message);
  }
}

/** Găsește indexul rândului (1-indexat, cu tot cu antet) după valoarea din coloana ID. Returnează -1 dacă nu găsește. */
function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2; // +2: offset pentru antet + index 0-based
  }
  return -1;
}

/**
 * VERIFICARE PROPRIETĂȚI VECHI
 *
 * Nu modifică nimic.
 * Caută ID-ul fiecărei proprietăți în:
 * - Contracte
 * - Facturi
 *
 * și afișează rezultatul în Execution log.
 */
function verificaProprietatiVechi() {
  const ss = SpreadsheetApp.openById(
    "17tD-ZjHze43xjuyhHd3LhKmYUNjb4NZXAujrAA9BxOQ"
  );

  const propSheet = ss.getSheetByName(CONFIG.SHEETS.PROPERTIES);
  const contractSheet = ss.getSheetByName(CONFIG.SHEETS.CONTRACTS);
  const invoiceSheet = ss.getSheetByName(CONFIG.SHEETS.INVOICES);

  if (!propSheet) throw new Error("Sheet Proprietati nu există.");

  const propData = propSheet.getDataRange().getValues();

  Logger.log("========================================");
  Logger.log("VERIFICARE PROPRIETĂȚI VECHI");
  Logger.log("========================================");

  const denumiriVechi = [
    "Bronzului",
    "Forex",
    "Garsoniera",
    "Apartament"
  ];

  denumiriVechi.forEach(denumire => {
    for (let i = 1; i < propData.length; i++) {
      const id = propData[i][0];
      const nume = propData[i][1];
      const adresa = propData[i][3];

      if (String(nume).trim().toLowerCase() === denumire.toLowerCase()) {

        Logger.log("");
        Logger.log("----------------------------------------");
        Logger.log("PROPRIETATE: " + nume);
        Logger.log("ID: " + id);
        Logger.log("ADRESA: " + adresa);

        let contracteGasite = 0;
        let facturiGasite = 0;

        // CONTRACTE
        if (contractSheet) {
          const data = contractSheet.getDataRange().getValues();

          for (let r = 1; r < data.length; r++) {
            const row = data[r];

            if (row.some(cell => String(cell) === String(id))) {
              contracteGasite++;
              Logger.log(
                "  CONTRACT -> rând " + (r + 1) +
                ": " + JSON.stringify(row)
              );
            }
          }
        }

        // FACTURI
        if (invoiceSheet) {
          const data = invoiceSheet.getDataRange().getValues();

          for (let r = 1; r < data.length; r++) {
            const row = data[r];

            if (row.some(cell => String(cell) === String(id))) {
              facturiGasite++;
              Logger.log(
                "  FACTURĂ -> rând " + (r + 1) +
                ": " + JSON.stringify(row)
              );
            }
          }
        }

        Logger.log(
          "REZULTAT: Contracte=" + contracteGasite +
          ", Facturi=" + facturiGasite
        );

        if (contracteGasite === 0 && facturiGasite === 0) {
          Logger.log(">>> SIGURĂ PENTRU ȘTERGERE");
        } else {
          Logger.log(">>> NU ȘTERGE ÎNCĂ!");
        }
      }
    }
  });

  Logger.log("");
  Logger.log("========================================");
  Logger.log("VERIFICARE TERMINATĂ - NICIO MODIFICARE");
  Logger.log("========================================");
}
