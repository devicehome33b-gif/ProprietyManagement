/**
 * SCANARE COMPLETĂ PROIECT
 *
 * Nu modifică nimic.
 * Scanează toate fișierele .gs din proiectul Apps Script
 * și caută referințe la numele foilor.
 *
 * Rulează:
 *   scanareReferinteSheeturi()
 */
function scanareReferinteSheeturi() {

  Logger.log("========================================");
  Logger.log("SCANARE REFERINȚE SHEET-URI");
  Logger.log("========================================");

  const proiect = ScriptApp.getProjectId();

  Logger.log("Project ID: " + proiect);
  Logger.log("");

  const fisiere = DriveApp.getFilesByType(MimeType.GOOGLE_APPS_SCRIPT);

  let gasite = 0;

  // Numele foilor pe care vrem să le verificăm
  const sheetNames = [
    "Facturi",
    "Proprietati",
    "Providers",
    "Readings",
    "Documents",
    "Calendar",
    "Notifications",
    "Logs",
    "System",
    "InvoiceRawData",
    "Settings",
    "Plati",
    "Utilities",

    // VECHI / CANDIDAȚI PENTRU ȘTERGERE
    "Sheet1",
    "Sheet2",
    "Invoices",
    "Properties",
    "Contracte",
    "Chiriasi"
  ];

  Logger.log("Foi urmărite:");
  sheetNames.forEach(function(name) {
    Logger.log("  - " + name);
  });

  Logger.log("");
  Logger.log("----------------------------------------");

  while (fisiere.hasNext()) {

    const fisier = fisiere.next();
    const numeFisier = fisier.getName();

    // Evităm alte proiecte Apps Script găsite în Drive
    // dacă nu sunt proiectul curent.
    if (fisier.getId() !== ScriptApp.getScriptId()) {
      continue;
    }

    gasite++;

    Logger.log("");
    Logger.log("FIȘIER: " + numeFisier);
    Logger.log("ID: " + fisier.getId());
    Logger.log("----------------------------------------");

    let continut = "";

    try {

      // Apps Script API este cea mai sigură metodă pentru
      // citirea codului sursă al proiectului.
      const url =
        "https://script.googleapis.com/v1/projects/" +
        ScriptApp.getScriptId() +
        "/content";

      const response = UrlFetchApp.fetch(url, {
        method: "get",
        headers: {
          Authorization:
            "Bearer " +
            ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      });

      const code = JSON.parse(response.getContentText());

      if (!code.files) {
        Logger.log("NU s-au putut obține fișierele proiectului.");
        continue;
      }

      code.files.forEach(function(sourceFile) {

        if (
          sourceFile.type !== "SERVER_JS" &&
          sourceFile.type !== "HTML"
        ) {
          return;
        }

        if (
          !sourceFile.name ||
          !sourceFile.name.endsWith(".gs")
        ) {
          return;
        }

        const source =
          sourceFile.source || "";

        if (!source) {
          return;
        }

        const lines =
          source.split(/\r?\n/);

        lines.forEach(function(line, index) {

          sheetNames.forEach(function(sheetName) {

            /*
             * Detectează:
             *
             * "Facturi"
             * 'Facturi'
             * getSheetByName("Facturi")
             * CONFIG.SHEETS.INVOICES
             * etc.
             */
            if (
              line.indexOf('"' + sheetName + '"') !== -1 ||
              line.indexOf("'" + sheetName + "'") !== -1 ||
              line.indexOf(sheetName) !== -1
            ) {

              Logger.log(
                "  [" +
                sheetName +
                "] " +
                sourceFile.name +
                ":" +
                (index + 1)
              );

              Logger.log(
                "      " +
                line.trim()
              );

              gasite++;
            }

          });

        });

      });

    } catch (error) {

      Logger.log(
        "EROARE SCANARE: " +
        error.message
      );

    }

  }

  Logger.log("");
  Logger.log("========================================");
  Logger.log("SCANARE TERMINATĂ");
  Logger.log("========================================");
}
function scanareReferinteSheeturi() {

  Logger.log("========================================");
  Logger.log("SCANARE COD PROIECT");
  Logger.log("========================================");

  const projectId = ScriptApp.getScriptId();

  const url =
    "https://script.googleapis.com/v1/projects/" +
    projectId +
    "/content";

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization:
        "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();

  Logger.log("HTTP: " + status);

  if (status !== 200) {
    Logger.log(response.getContentText());
    throw new Error(
      "Nu pot citi conținutul proiectului."
    );
  }

  const data =
    JSON.parse(response.getContentText());

  const files =
    data.files || [];

  Logger.log(
    "Fișiere proiect: " +
    files.length
  );

  Logger.log("");

  const cauta = [
    "Sheet1",
    "Sheet2",
    "Invoices",
    "Properties",
    "Contracte",
    "Chiriasi",
    "Facturi",
    "Proprietati",
    "Providers",
    "Readings",
    "Documents",
    "Calendar",
    "Notifications",
    "Logs",
    "System",
    "InvoiceRawData",
    "Settings",
    "Plati",
    "Utilities"
  ];

  let total = 0;

  files.forEach(function(file) {

    if (file.type !== "SERVER_JS") {
      return;
    }

    const name =
      file.name || "";

    const source =
      file.source || "";

    if (!name.endsWith(".gs")) {
      return;
    }

    const lines =
      source.split(/\r?\n/);

    let fileHits = 0;

    lines.forEach(function(line, index) {

      cauta.forEach(function(sheet) {

        if (line.indexOf(sheet) !== -1) {

          Logger.log(
            "[" +
            sheet +
            "] " +
            name +
            ":" +
            (index + 1)
          );

          Logger.log(
            "    " +
            line.trim()
          );

          fileHits++;
          total++;
        }

      });

    });

    if (fileHits > 0) {
      Logger.log(
        "  -> " +
        fileHits +
        " referințe în " +
        name
      );
      Logger.log("");
    }

  });

  Logger.log("========================================");
  Logger.log("REZULTAT");
  Logger.log("========================================");

  Logger.log(
    "Fișiere .gs scanate: " +
    files.filter(function(f) {
      return (
        f.type === "SERVER_JS" &&
        String(f.name || "").endsWith(".gs")
      );
    }).length
  );

  Logger.log(
    "Referințe găsite: " +
    total
  );

  Logger.log("========================================");
}