
/**
 * ==========================================
 * PROPERTY SERVICE
 * ==========================================
 *
 * PROPRIETĂȚI ACTUALE:
 *
 * Aluminiului
 * Casa
 * Bronzului
 * Forex
 * Ferencz
 * Mama
 *
 * CASA:
 * Strada 1 Decembrie 1918, Nr. 33B
 *
 * MAMA:
 * Strada 1 Decembrie 1918, Nr. 6
 *
 * Fără chiriași.
 * Fără contracte.
 * ==========================================
 */


/**
 * Normalizează textul pentru comparații sigure.
 */
function normalizePropertyText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/**
 * Normalizează adresa.
 */
function normalizePropertyAddress_(value) {
  return normalizePropertyText_(value)
    .replace(/\bnr\b/g, "nr")
    .replace(/\bnumarul\b/g, "nr")
    .replace(/\bstr\b/g, "strada")
    .replace(/\balee\b/g, "aleea")
    .replace(/\s+/g, " ")
    .trim();
}


/**
 * ==========================================
 * DEBUG GET PROPERTIES
 * ==========================================
 */
function debugGetProperties() {

  const properties = getProperties();

  Logger.log(
    "Număr proprietăți găsite: " +
    properties.length
  );

  Logger.log(
    JSON.stringify(properties, null, 2)
  );

  return properties;
}


/**
 * ==========================================
 * GET PROPERTIES
 * ==========================================
 */
function getProperties() {

  try {

    const sheet =
      getSheet(CONFIG.SHEETS.PROPERTIES);

    const lastRow =
      sheet.getLastRow();

    if (lastRow <= 1) {
      return [];
    }

    const data =
      sheet
        .getRange(2, 1, lastRow - 1, 8)
        .getValues();

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

    Logger.log(
      "Eroare în propertyservice -> getProperties: " +
      error.toString()
    );

    throw new Error(
      "Nu s-au putut citi proprietățile: " +
      error.message
    );
  }
}


/**
 * ==========================================
 * ADD PROPERTY
 * ==========================================
 */
function addProperty(propertyData) {

  try {

    const sheet =
      getSheet(CONFIG.SHEETS.PROPERTIES);

    if (sheet.getLastRow() === 0) {

      sheet.appendRow([
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

    const newId =
      Utilities.getUuid();

    sheet
      .getRange("A:H")
      .setNumberFormat("@");

    sheet.appendRow([

      newId,

      propertyData.denumire || "",

      propertyData.tip || "",

      propertyData.adresa || "",

      propertyData.oras || "Brasov",

      propertyData.proprietar || "",

      propertyData.status || "Activ",

      propertyData.observatii || ""

    ]);

    return {
      success: true,
      id: newId
    };

  } catch (error) {

    Logger.log(
      "Eroare în propertyservice -> addProperty: " +
      error.toString()
    );

    throw new Error(
      "Nu s-a putut salva proprietatea: " +
      error.message
    );
  }
}


/**
 * ==========================================
 * SETUP PROPRIETĂȚI
 * ==========================================
 *
 * Creează cele 6 proprietăți corecte.
 *
 * Nu șterge nimic.
 * Nu modifică automat proprietăți existente.
 *
 * Pentru siguranță verifică:
 *   1. denumirea
 *   2. adresa
 *
 * Astfel Casa 33B și Mama 6 sunt întotdeauna
 * considerate două proprietăți diferite.
 */
function setupProprietatiInitiale() {

  const proprietatiInitiale = [

    {
      denumire: "Aluminiului",
      tip: "Apartament",
      adresa: "Strada Aluminiului, Nr. 3, Bl. 508, Sc. B, Ap. 2",
      oras: "Brasov"
    },

    {
      denumire: "Casa",
      tip: "Casa",
      adresa: "Strada 1 Decembrie 1918, Nr. 33B",
      oras: "Brasov"
    },

    {
      denumire: "Bronzului",
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
      denumire: "Mama",
      tip: "Apartament",
      adresa: "Strada 1 Decembrie 1918, Nr. 6",
      oras: "Brasov"
    }

  ];

  const existente =
    getProperties();

  let create = 0;
  let gasite = 0;

  proprietatiInitiale.forEach(p => {

    const denumireNoua =
      normalizePropertyText_(p.denumire);

    const adresaNoua =
      normalizePropertyAddress_(p.adresa);

    const exista =
      existente.some(existing => {

        const denumireExistenta =
          normalizePropertyText_(
            existing.denumire
          );

        const adresaExistenta =
          normalizePropertyAddress_(
            existing.adresa
          );

        /*
         * Considerăm proprietatea existentă dacă
         * denumirea ȘI adresa corespund.
         */
        return (
          denumireExistenta === denumireNoua &&
          adresaExistenta === adresaNoua
        );

      });

    if (exista) {

      gasite++;

      Logger.log(
        "EXISTĂ: " +
        p.denumire +
        " | " +
        p.adresa
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
      "CREATĂ: " +
      p.denumire +
      " | " +
      p.adresa
    );

  });

  Logger.log(
    "========================================"
  );

  Logger.log(
    "SETUP PROPRIETĂȚI FINALIZAT"
  );

  Logger.log(
    "Create: " + create
  );

  Logger.log(
    "Existente: " + gasite
  );

  Logger.log(
    "Total: " +
    (create + gasite)
  );

  Logger.log(
    "========================================"
  );

  return {

    create: create,

    existente: gasite,

    total: create + gasite

  };
}


/**
 * ==========================================
 * UPDATE PROPERTY
 * ==========================================
 */
function updateProperty(id, propertyData) {

  try {

    if (!id) {
      throw new Error(
        "Lipsește ID-ul proprietății."
      );
    }

    const sheet =
      getSheet(CONFIG.SHEETS.PROPERTIES);

    const rowIndex =
      findRowById_(sheet, id);

    if (rowIndex === -1) {

      throw new Error(
        "Proprietatea cu ID-ul " +
        id +
        " nu există."
      );
    }

    sheet
      .getRange(rowIndex, 2, 1, 7)
      .setNumberFormat("@");

    sheet
      .getRange(rowIndex, 2, 1, 7)
      .setValues([[
        propertyData.denumire || "",
        propertyData.tip || "",
        propertyData.adresa || "",
        propertyData.oras || "Brasov",
        propertyData.proprietar || "",
        propertyData.status || "Activ",
        propertyData.observatii || ""
      ]]);

    return {
      success: true
    };

  } catch (error) {

    Logger.log(
      "Eroare updateProperty: " +
      error.toString()
    );

    throw new Error(
      "Nu s-a putut actualiza proprietatea: " +
      error.message
    );
  }
}


/**
 * ==========================================
 * DELETE PROPERTY
 * ==========================================
 */
function deleteProperty(id) {

  try {

    if (!id) {

      throw new Error(
        "Lipsește ID-ul proprietății."
      );

    }

    const sheet =
      getSheet(CONFIG.SHEETS.PROPERTIES);

    const rowIndex =
      findRowById_(sheet, id);

    if (rowIndex === -1) {

      throw new Error(
        "Proprietatea cu ID-ul " +
        id +
        " nu există."
      );

    }

    sheet.deleteRow(rowIndex);

    return {
      success: true
    };

  } catch (error) {

    Logger.log(
      "Eroare deleteProperty: " +
      error.toString()
    );

    throw new Error(
      "Nu s-a putut șterge proprietatea: " +
      error.message
    );
  }
}


/**
 * ==========================================
 * FIND ROW BY ID
 * ==========================================
 */
function findRowById_(sheet, id) {

  const lastRow =
    sheet.getLastRow();

  if (lastRow <= 1) {
    return -1;
  }

  const ids =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();

  for (
    let i = 0;
    i < ids.length;
    i++
  ) {

    if (
      String(ids[i][0]).trim() ===
      String(id).trim()
    ) {

      return i + 2;
    }
  }

  return -1;
}


/**
 * ==========================================
 * VERIFICĂ STRUCTURA PROPRIETĂȚILOR
 * ==========================================
 *
 * NU modifică nimic.
 *
 * Este funcția pe care o rulăm acum înainte
 * de importul facturilor vechi.
 */
function verificaStructuraProprietati() {

  const properties =
    getProperties();

  Logger.log(
    "========================================"
  );

  Logger.log(
    "PROPRIETĂȚI ACTUALE"
  );

  Logger.log(
    "========================================"
  );

  Logger.log(
    "Total: " +
    properties.length
  );

  properties.forEach((p, index) => {

    Logger.log(
      (index + 1) +
      " | " +
      p.denumire +
      " | " +
      p.adresa +
      " | ID=" +
      p.id
    );

  });

  Logger.log(
    "========================================"
  );

  return properties;
}


/**
 * ==========================================
 * VERIFICĂ CASA / MAMA
 * ==========================================
 *
 * NU modifică nimic.
 *
 * Confirmă explicit că:
 *
 * Casa = nr. 33B
 * Mama = nr. 6
 */
function verificaCasaMama() {

  const properties =
    getProperties();

  const casa =
    properties.find(p =>
      normalizePropertyText_(p.denumire) ===
      "casa"
    );

  const mama =
    properties.find(p =>
      normalizePropertyText_(p.denumire) ===
      "mama"
    );

  Logger.log(
    "========================================"
  );

  Logger.log(
    "VERIFICARE CASA / MAMA"
  );

  Logger.log(
    "========================================"
  );

  if (casa) {

    Logger.log(
      "CASA:"
    );

    Logger.log(
      "  ID = " + casa.id
    );

    Logger.log(
      "  Adresa = " + casa.adresa
    );

  } else {

    Logger.log(
      "CASA NU EXISTĂ"
    );

  }

  if (mama) {

    Logger.log(
      "MAMA:"
    );

    Logger.log(
      "  ID = " + mama.id
    );

    Logger.log(
      "  Adresa = " + mama.adresa
    );

  } else {

    Logger.log(
      "MAMA NU EXISTĂ"
    );

  }

  /*
   * Verificare suplimentară:
   * cele două adrese nu au voie să fie identice.
   */
  if (
    casa &&
    mama &&
    normalizePropertyAddress_(casa.adresa) ===
    normalizePropertyAddress_(mama.adresa)
  ) {

    throw new Error(
      "EROARE: Casa și Mama au aceeași adresă în Sheet!"
    );

  }

  Logger.log(
    "========================================"
  );

  return {
    casa: casa || null,
    mama: mama || null
  };
}