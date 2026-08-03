/**
 * ==========================================
 * MODUL FACTURI / UTILITĂȚI
 * Scanează folderul din Drive (recursiv - fișiere puse direct acolo SAU în subfoldere),
 * face OCR pe facturile noi (PDF/imagine), determină automat proprietatea din adresa
 * reală de consum găsită în text, și le importă în Sheet.
 * ==========================================
 *
 * IMPORTANT - necesită activare:
 * 1. În editorul Apps Script -> Servicii -> adaugă "Drive API" (Advanced Google Service).
 * 2. appsscript.json trebuie să conțină "enabledAdvancedServices" cu Drive (vezi fișierul updatat).
 * 3. Completează CONFIG.DRIVE.ROOT_FOLDER_ID din setup.gs cu ID-ul folderului din Drive
 *    unde pui TOATE facturile (nu mai trebuie sortate manual pe subfoldere).
 */

const INVOICE_EXTENSIONS_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif"
];

// Câte facturi noi procesăm într-o singură rulare. Cota Google pentru OCR e destul de
// strictă (ratează des la mai mult de câteva cereri la rând), iar Apps Script are o limită
// de 6 minute per execuție - dacă procesăm prea multe deodată, execuția e întreruptă forțat
// și rămâne "suspendată" la mijloc. Cu un lot mic, apeși pur și simplu din nou "Import" ca
// să continui - fișierele deja importate sunt sărite automat (deduplicare după FileID).
const MAX_FISIERE_PER_RULARE = 5;

/**
 * Punct de intrare: scanează recursiv folderul rădăcină (fișiere puse direct acolo
 * SAU în orice subfolder) și importă facturile noi, în loturi de cel mult
 * MAX_FISIERE_PER_RULARE (vezi comentariul de mai sus - rulează din nou dacă mai
 * rămân facturi de procesat). Proprietatea se determină automat din textul facturii
 * (cod client/contract sau, ca rezervă, adresa reală de consum), nu din numele folderului.
 * Returnează un sumar cu ce s-a importat / sărit / eșuat.
 */
function importInvoicesFromDrive() {
  const rootId = CONFIG.DRIVE.ROOT_FOLDER_ID;
  if (!rootId || rootId === "PUNE_AICI_ID_FOLDER_RADACINA") {
    throw new Error("Trebuie completat CONFIG.DRIVE.ROOT_FOLDER_ID în setup.gs cu ID-ul folderului din Drive.");
  }

  const rootFolder = DriveApp.getFolderById(rootId);
  const alreadyImported = getImportedFileIds_();

  const summary = { importate: 0, sarite: 0, esuate: 0, deVerificat: 0, ramase: 0, detalii: [] };
  const stare = { procesate: 0 };

  processFolderRecursive_(rootFolder, alreadyImported, summary, stare);

  if (summary.ramase > 0) {
    summary.detalii.push({
      fisier: "-",
      proprietate: "-",
      status: "Mai sunt " + summary.ramase + " facturi de procesat - apasă din nou „Import” ca să continui."
    });
  }

  return summary;
}

/**
 * Procesează recursiv un folder: importă fișierele găsite direct în el (până la limita
 * MAX_FISIERE_PER_RULARE per rulare), apoi intră în subfoldere.
 */
function processFolderRecursive_(folder, alreadyImported, summary, stare) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const mime = file.getMimeType();

    if (INVOICE_EXTENSIONS_MIME.indexOf(mime) === -1) continue; // ignoră fișiere care nu sunt facturi

    const fileId = file.getId();
    if (alreadyImported.has(fileId)) {
      summary.sarite++;
      continue;
    }

    if (stare.procesate >= MAX_FISIERE_PER_RULARE) {
      summary.ramase++;
      continue;
    }

    try {
      const text = ocrFileToTextWithRetry_(fileId);
      const parsed = parseInvoiceText_(text);

      let proprietate = parsed.proprietate;
      let status;
      if (parsed.metodaDetectare === "cod") {
        status = "Importat automat (după cod client)";
      } else if (parsed.metodaDetectare === "adresa") {
        status = "Importat automat (după adresă)";
      } else {
        proprietate = "Necunoscuta";
        status = "DE VERIFICAT: nu s-a putut determina proprietatea";
        summary.deVerificat++;
      }

      // Mutăm fizic fișierul în subfolderul proprietății (îl creăm dacă nu există încă),
      // ca linkul trimis pe WhatsApp să ducă direct la facturile locației respective,
      // nu la folderul general cu toate proprietățile amestecate. Nu mutăm fișierele
      // "Necunoscuta" - rămân la locul lor, ca să le poți verifica/muta manual.
      let linkDrive = file.getUrl();
      if (proprietate !== "Necunoscuta") {
        try {
          const etichetaLuna = lunaEtichetaDinDataRO_(parsed.dataEmitere);
          mutaFisierInSubfolder_(file, proprietate, etichetaLuna);
          linkDrive = file.getUrl();
        } catch (errMutare) {
          Logger.log("Nu s-a putut muta fișierul " + file.getName() + " în subfolderul " + proprietate + ": " + errMutare.toString());
        }
      }

      saveInvoiceRow_({
        fileId: fileId,
        proprietate: proprietate,
        furnizor: parsed.furnizor,
        codClient: parsed.codClient,
        numarFactura: parsed.numarFactura,
        perioada: parsed.perioada,
        dataEmitere: parsed.dataEmitere,
        dataScadenta: parsed.dataScadenta,
        suma: parsed.suma,
        moneda: parsed.moneda,
        status: status,
        linkDrive: linkDrive,
        textOcr: text
      });

      summary.importate++;
      summary.detalii.push({ fisier: file.getName(), proprietate: proprietate, status: status });
    } catch (err) {
      summary.esuate++;
      summary.detalii.push({ fisier: file.getName(), proprietate: "-", status: "EROARE: " + err.message });
      Logger.log("Eroare import factura " + file.getName() + ": " + err.toString());
    }

    stare.procesate++;

    // Pauză între fișiere, ca să nu lovim limita de rate-limit a Google pentru OCR
    // (cota pare destul de strictă - o pauză mai mare reduce mult reîncercările).
    Utilities.sleep(4000);
  }

  // Recurge și în subfoldere, dacă mai există (compatibilitate cu structura veche pe apartamente)
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    processFolderRecursive_(subfolders.next(), alreadyImported, summary, stare);
  }
}

/**
 * Ca ocrFileToText_, dar reîncearcă automat (cu pauză crescătoare) dacă Google
 * răspunde cu "rate limit exceeded" - se întâmplă des la OCR când procesăm multe
 * fișiere la rând.
 */
function ocrFileToTextWithRetry_(fileId) {
  const maxIncercari = 4;
  let asteptareMs = 3000;

  for (let incercare = 1; incercare <= maxIncercari; incercare++) {
    try {
      return ocrFileToText_(fileId);
    } catch (err) {
      const mesaj = err.message || err.toString();
      const esteRateLimit = /rate limit/i.test(mesaj);
      if (!esteRateLimit || incercare === maxIncercari) throw err;

      Logger.log("Rate limit OCR - reîncerc peste " + (asteptareMs / 1000) + "s (încercarea " + incercare + "/" + maxIncercari + ")");
      Utilities.sleep(asteptareMs);
      asteptareMs *= 2; // backoff exponențial
    }
  }
}

/**
 * Face OCR pe un fișier din Drive folosind Drive Advanced Service.
 * Creează temporar un Google Doc convertit prin OCR, extrage textul, apoi îl șterge.
 */
function ocrFileToText_(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();

  // IMPORTANT: NU seta mimeType aici la GOOGLE_DOCS - asta face ca Drive API să creadă
  // că fișierul sursă e deja un Google Doc (nu PDF-ul original) și OCR-ul eșuează cu
  // "OCR is not supported for files of type application/vnd.google-apps.document".
  // Lăsăm tipul sursă neschimbat (PDF/imagine); convert+ocr fac transformarea.
  const resource = {
    title: "OCR_temp_" + fileId
  };

  const insertedFile = Drive.Files.insert(resource, blob, {
    convert: true,
    ocr: true,
    ocrLanguage: CONFIG.DRIVE.OCR_LANGUAGE || "ro"
  });

  try {
    // Drive.Files.export() (wrapper-ul generat automat) nu adaugă corect "alt=media",
    // necesar ca să primim conținutul efectiv, nu doar metadate. Apelăm direct endpoint-ul
    // Drive API cu tokenul de autorizare al scriptului.
    const exportUrl = "https://www.googleapis.com/drive/v2/files/" + insertedFile.id + "/export?mimeType=text%2Fplain&alt=media";
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error("Export text eșuat (cod " + response.getResponseCode() + "): " + response.getContentText());
    }

    return response.getContentText("UTF-8");
  } finally {
    // Curățăm documentul temporar, indiferent de rezultat
    try { Drive.Files.remove(insertedFile.id); } catch (e) { /* ignoră */ }
  }
}

/**
 * Parsare euristică (regex) a textului OCR pentru a extrage câmpurile cheie ale facturii.
 * Reguli CALIBRATE pe facturile reale: Compania Apa Brasov, Hidroelectrica, Digi, Comprest (COMBV), ENGIE.
 */
function parseInvoiceText_(text) {
  const norm = normalizeDiacritics_(text);
  const upperText = norm.toUpperCase();

  // 1. Furnizor
  let furnizor = "Necunoscut";
  for (const provider in CONFIG.PROVIDERS) {
    const keywords = CONFIG.PROVIDERS[provider];
    if (keywords.some(kw => upperText.indexOf(kw) !== -1)) {
      furnizor = provider;
      break;
    }
  }

  const rules = FIELD_PATTERNS[furnizor] || FIELD_PATTERNS["_default"];

  const numarFactura = extractField_(norm, rules.numar) || "-";
  const dataEmitere = extractField_(norm, rules.dataEmitere) || "-";
  const dataScadenta = extractField_(norm, rules.dataScadenta) || "-";
  const perioada = extractField_(norm, rules.perioada) || "-";

  let sumaStr = extractField_(norm, rules.suma);
  if (!sumaStr && rules.sumaFallback) sumaStr = extractField_(norm, rules.sumaFallback);
  const suma = sumaStr ? parseRoNumber_(sumaStr) : null;

  // Proprietate: metodă PRIMARĂ = cod client/cont contract (exact, fără ambiguitate).
  // Dacă furnizorul nu are cod per-proprietate cunoscut (ex: Digi) sau codul nu e încă
  // în CONFIG.CLIENT_CODE_MAP, cădem pe detectarea din ADRESA REALĂ de consum.
  const codClient = extractField_(norm, CLIENT_CODE_PATTERNS[furnizor]);
  let proprietate = null;
  let metodaDetectare = null;

  if (codClient && CONFIG.CLIENT_CODE_MAP[furnizor] && CONFIG.CLIENT_CODE_MAP[furnizor][codClient]) {
    proprietate = CONFIG.CLIENT_CODE_MAP[furnizor][codClient];
    metodaDetectare = "cod";
  } else {
    const adresaDetectata = detectPropertyByAddress_(norm, furnizor);
    if (adresaDetectata) {
      proprietate = adresaDetectata;
      metodaDetectare = "adresa";
    }
  }

  return {
    furnizor: furnizor,
    codClient: codClient || "-",
    numarFactura: numarFactura,
    perioada: perioada,
    dataEmitere: dataEmitere,
    dataScadenta: dataScadenta,
    suma: suma,
    moneda: "RON",
    proprietate: proprietate,
    metodaDetectare: metodaDetectare
  };
}

/** Normalizează diacriticele vechi (ş,ţ) la formele noi (ș,ț) ca regexurile să fie consistente. */
function normalizeDiacritics_(text) {
  return text
    .replace(/ş/g, "ș").replace(/Ş/g, "Ș")
    .replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");
}

const DATE_RE_ = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/;
const PERIOD_RE_ = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\s*-\s*\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/;
const AMOUNT_RE_ = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/;
// Variantă strictă: suma trebuie urmată de "LEI" sau "RON" - necesară la ENGIE, unde textul OCR pune
// pe același rând "CONSUM GAZE NATURALE (kWh) | TOTAL DE PLATĂ CU TVA | DATA SCADENTĂ" cu valorile
// dedesubt în aceeași ordine; fără acest marker, regexul generic prindea greșit consumul de gaze
// (ex: "52,110" trunchiat la "52,11") în loc de suma reală de plată.
const AMOUNT_LEI_RE_ = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:LEI|RON)/i;
const NUMERIC_ID_RE_ = /(\d{5,})/;

/**
 * Reguli de extragere per furnizor. Fiecare câmp are un "kw" (regex pentru cuvântul cheie de căutat)
 * și un "val" (regex pentru valoarea căutată imediat după cuvântul cheie, într-o fereastră de text).
 */
const FIELD_PATTERNS = {
  "Apa Brasov": {
    numar: { kw: /COD\s*FACTURA\s*:?/i, val: NUMERIC_ID_RE_ },
    dataEmitere: { kw: /DATA\s*FACTURII\s*/i, val: DATE_RE_ },
    dataScadenta: { kw: /DATA\s*SCADEN[TȚ][A-ZĂ]*\s*/i, val: DATE_RE_ },
    // "Total factura curenta" = suma facturii curente, FĂRĂ soldul din perioadele anterioare
    // (spre deosebire de "TOTAL DE PLATA", care include și restanțe/credit din sold precedent).
    suma: { kw: /TOTAL\s*FACTUR[AĂ]\s*CURENT[AĂ]/i, val: AMOUNT_LEI_RE_, window: 80 },
    perioada: { kw: /PERIOADA\s*CONSUM\s*/i, val: PERIOD_RE_ }
  },
  "Hidroelectrica": {
    numar: { kw: /FACTUR[AĂ]\s*SERIA\s*\S+\s*NR\.?\s*/i, val: NUMERIC_ID_RE_ },
    dataEmitere: { kw: /DIN\s*DATA\s*DE\s*/i, val: DATE_RE_ },
    dataScadenta: { kw: /DATA\s*SCADEN[TȚ][A-ZĂ]*\s*:?/i, val: DATE_RE_, window: 260 },
    // "TOTAL DE PLATĂ FACTURĂ CURENTĂ" = suma facturii curente, FĂRĂ soldul din perioadele
    // anterioare (spre deosebire de "TOTAL DE PLATĂ CONT CONTRACT", care include restanțe).
    suma: { kw: /TOTAL\s*DE\s*PLAT[AĂ]\s*FACTUR[AĂ]\s*CURENT[AĂ]/i, val: AMOUNT_LEI_RE_, window: 100 },
    sumaFallback: { kw: /TOTAL\s*DE\s*PLAT[AĂ]\s*CONT\s*CONTRACT[^\d]*/i, val: AMOUNT_RE_ },
    perioada: { kw: /PERIOAD[AĂ]\s*DE\s*FACTURARE\s*:?/i, val: PERIOD_RE_ }
  },
  "Digi": {
    numar: { kw: /NUM[AĂ]R\s*FACTUR[AĂ]\s*:?/i, val: NUMERIC_ID_RE_ },
    dataEmitere: { kw: /\bDATA\s*:\s*/i, val: DATE_RE_ },
    dataScadenta: { kw: /ULTIMA\s*ZI\s*DE\s*PLAT[AĂ]\s*:?/i, val: DATE_RE_ },
    suma: { kw: /TOTAL\s*DE\s*ACHITAT\s*:?/i, val: AMOUNT_RE_, window: 220 },
    perioada: { kw: /PERIOADA\s*FACTURAT[AĂ]\s*:?/i, val: PERIOD_RE_ }
  },
  "Comprest": {
    numar: { kw: /\bFACTURA\s+/i, val: NUMERIC_ID_RE_ },
    dataEmitere: { kw: /\bDIN:\s*/i, val: DATE_RE_ },
    dataScadenta: { kw: /DATA\s*SCADEN[TȚ][A-ZĂ]*\s*:?/i, val: DATE_RE_ },
    suma: { kw: /TOTAL\s*DE\s*PLAT[AĂ]\s*:?/i, val: AMOUNT_RE_ },
    perioada: { kw: /PERIOADA\s*DE\s*FACTURARE\s*:?/i, val: PERIOD_RE_ }
  },
  "ENGIE": {
    numar: { kw: /SERIA\s*ENG\s*NR\.?\s*/i, val: NUMERIC_ID_RE_ },
    dataEmitere: { kw: /DATA\s*FACTURII\s*:?/i, val: DATE_RE_ },
    dataScadenta: { kw: /DATA\s*SCADEN[TȚ][A-ZĂ]*/i, val: DATE_RE_, window: 250 },
    // "Factura curentă:" = suma facturii curente, FĂRĂ soldul precedent (spre deosebire de
    // "TOTAL DE PLATĂ CU TVA", care include și restanțele din facturile anterioare).
    suma: { kw: /FACTUR[AĂ]\s*CURENT[AĂ]\s*:/i, val: AMOUNT_LEI_RE_, window: 90 },
    sumaFallback: { kw: /TOTAL\s*DE\s*PLAT[AĂ]\s*CU\s*T\.?V\.?A\.?/i, val: AMOUNT_LEI_RE_, window: 150 },
    perioada: { kw: /PERIOADA\s*DE\s*FACTURARE\s*:?/i, val: PERIOD_RE_ }
  },
  "_default": {
    numar: { kw: /FACTUR[AĂ]\s*(?:FISCAL[AĂ])?\s*NR\.?\s*/i, val: /([A-Z0-9\-\/]{4,20})/i },
    dataEmitere: { kw: /DATA\s*(?:EMITERII|FACTURII)?\s*:?/i, val: DATE_RE_ },
    dataScadenta: { kw: /SCADEN[TȚ][A-ZĂ]*\s*:?/i, val: DATE_RE_ },
    suma: { kw: /TOTAL\s*DE\s*PLAT[AĂ]\s*:?/i, val: AMOUNT_RE_ },
    perioada: { kw: /PERIOAD[AĂ]\s*(?:DE\s*FACTURARE|CONSUM)?\s*:?/i, val: PERIOD_RE_ }
  }
};

/**
 * Marker specific per furnizor de unde ÎNCEPE căutarea adresei REALE de consum,
 * ca să evităm adresa de corespondență (care poate fi diferită și contamina rezultatul).
 * Digi nu are marker distinct - în facturile calibrate apare o singură adresă în tot documentul,
 * deci acolo se caută în tot textul.
 */
const ADDRESS_PATTERNS = {
  "Apa Brasov": { kw: /PUNCT\s*DE\s*CONSUM/i, window: 150 },
  "Hidroelectrica": { kw: /LOC\s*DE\s*CONSUM/i, window: 300 },
  "Comprest": { kw: /ADRESA\s*DE\s*LIVRARE\s*:?/i, window: 220 },
  "ENGIE": { kw: /ADRESA\s*LOCULUI\s*DE\s*/i, window: 220 }
};

/**
 * Marker pentru extragerea codului de client / cont contract - identificator EXACT,
 * folosit ca metodă PRIMARĂ de sortare pe proprietate (vezi CONFIG.CLIENT_CODE_MAP).
 * IMPORTANT: la Hidroelectrica trebuie folosit "Cod Cont Contract" (specific per proprietate),
 * NU "Cod Client" (care e comun tuturor contractelor tale de la același furnizor).
 */
const CLIENT_CODE_PATTERNS = {
  "Apa Brasov": { kw: /COD\s*CLIENT\s*:?\s*/i, val: /([A-Z0-9]{2,6}\/\d{2,6})/i },
  "Hidroelectrica": { kw: /COD\s*CONT\s*CONTRACT\s*:?\s*/i, val: /(\d{6,12})/ },
  "ENGIE": { kw: /COD\s*CLIENT\s*:?\s*/i, val: /(\d{6,15})/ },
  "Comprest": { kw: /COD\s*CLIENT\s*:?\s*/i, val: /(\d{1,3}-\d{3,6})/ }
  // Digi: fără pattern - cod client comun tuturor contractelor, nu poate distinge proprietatea
};

/** Caută kw în text, apoi caută val într-o fereastră de caractere imediat după (implicit 120). */
function extractField_(text, rule) {
  if (!rule) return null;
  const kwMatch = rule.kw.exec(text);
  if (!kwMatch) return null;

  const startIdx = kwMatch.index + kwMatch[0].length;
  const windowSize = rule.window || 120;
  const slice = text.substring(startIdx, startIdx + windowSize);

  const valMatch = rule.val.exec(slice);
  return valMatch ? valMatch[1] : null;
}

/**
 * Detectarea proprietății după cuvinte cheie de adresă, căutate DOAR în fereastra de după
 * markerul specific furnizorului (nu în tot documentul), ca să evităm adresa de corespondență.
 */
function detectPropertyByAddress_(normText, furnizor) {
  const rule = ADDRESS_PATTERNS[furnizor];
  let searchText;

  if (rule) {
    const m = rule.kw.exec(normText);
    searchText = m ? normText.substring(m.index, m.index + rule.window).toUpperCase() : normText.toUpperCase();
  } else {
    // Fără marker cunoscut pentru acest furnizor (ex: Digi) -> căutăm în tot documentul
    searchText = normText.toUpperCase();
  }

  for (const property in CONFIG.PROPERTIES_ADDRESS_KEYWORDS) {
    const keywords = CONFIG.PROPERTIES_ADDRESS_KEYWORDS[property];
    if (keywords.some(kw => searchText.indexOf(kw) !== -1)) {
      return property;
    }
  }
  return null;
}

/**
 * REPARĂ sumele deja importate greșit pentru facturile ENGIE (confundau consumul de gaze
 * cu suma reală de plată). Recalculează din TextOCR salvat deja în Sheet, cu regex-ul corectat,
 * fără să refacă OCR-ul. Rulează o singură dată din editor, după ce ai văzut sume aberante la ENGIE.
 */
/**
 * REPARĂ sumele deja importate, recalculându-le din TextOCR salvat deja în Sheet, cu regexurile
 * curente din FIELD_PATTERNS (fără să refacă OCR-ul). Utilă de fiecare dată când se calibrează
 * mai bine parsarea unui furnizor (ex: trecerea de la "total de plată cu sold" la "factură
 * curentă"). Rulează pentru TOȚI furnizorii cu factură deja importată. Rulează o singură dată
 * din editor, după orice ajustare a regexurilor de sumă.
 */
function repararSumeToateFacturile() {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { reparate: 0 };

  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  let reparate = 0;

  data.forEach((row, i) => {
    const furnizor = row[2];
    const textOcr = row[13];
    const rules = FIELD_PATTERNS[furnizor];
    if (!rules || !textOcr) return;

    const norm = normalizeDiacritics_(textOcr);
    let sumaStr = extractField_(norm, rules.suma);
    if (!sumaStr && rules.sumaFallback) sumaStr = extractField_(norm, rules.sumaFallback);

    if (sumaStr) {
      const sumaNoua = parseRoNumber_(sumaStr);
      const sumaVeche = row[8];
      if (sumaNoua !== sumaVeche) {
        sheet.getRange(i + 2, 8).setValue(sumaNoua); // coloana I = Suma
        Logger.log("Rând " + (i + 2) + " (" + furnizor + "): " + sumaVeche + " -> " + sumaNoua);
        reparate++;
      }
    }
  });

  Logger.log("Total sume reparate: " + reparate);
  return { reparate: reparate };
}

/** Păstrat pentru compatibilitate - apelează acum reparația generală, pentru toți furnizorii. */
function repararSumeEngie() {
  return repararSumeToateFacturile();
}

/** Nume de luni în română, folosite pentru eticheta subfolderului de lună (ex: "Iunie 2026"). */
const LUNI_RO_ = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
                  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];

/** Extrage eticheta de lună ("Iunie 2026") dintr-o dată în format "dd.mm.yyyy". Returnează null dacă nu poate parsa. */
function lunaEtichetaDinDataRO_(dataStr) {
  if (!dataStr || dataStr === "-") return null;
  const m = String(dataStr).match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (!m) return null;
  const luna = parseInt(m[2], 10) - 1;
  const an = m[3];
  if (luna < 0 || luna > 11) return null;
  return LUNI_RO_[luna] + " " + an;
}

/**
 * Mută fizic un fișier din Drive în subfolderul Proprietate/LunăAn (le creează dacă nu există).
 * Dacă etichetaLuna e null (dată nedeterminată), fișierul rămâne direct în subfolderul proprietății.
 * Adaugă noul folder ca părinte și elimină vechii părinți.
 */
function mutaFisierInSubfolder_(file, numeProprietate, etichetaLuna) {
  const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE.ROOT_FOLDER_ID);
  const propFolder = getOrCreateSubfolder_(rootFolder, numeProprietate);
  const targetFolder = etichetaLuna ? getOrCreateSubfolder_(propFolder, etichetaLuna) : propFolder;

  // Dacă fișierul e deja doar în folderul țintă, nu mai facem nimic
  const parents = file.getParents();
  const parentIds = [];
  let dejaAcolo = false;
  while (parents.hasNext()) {
    const p = parents.next();
    parentIds.push(p.getId());
    if (p.getId() === targetFolder.getId()) dejaAcolo = true;
  }
  if (dejaAcolo && parentIds.length === 1) return;

  targetFolder.addFile(file);
  parentIds.forEach(pid => {
    if (pid !== targetFolder.getId()) {
      DriveApp.getFolderById(pid).removeFile(file);
    }
  });
}

/** Caută un subfolder cu numele dat sub folderul părinte; îl creează dacă nu există. */
function getOrCreateSubfolder_(parentFolder, nume) {
  const existente = parentFolder.getFoldersByName(nume);
  if (existente.hasNext()) return existente.next();
  return parentFolder.createFolder(nume);
}

/**
 * Returnează structura de foldere: { numeProprietate: { url, luni: { "Iunie 2026": url, ... } } }.
 * Folosit în UI (Facturi) ca linkul WhatsApp să ducă direct la subfolderul locației ȘI lunii
 * respective, nu la folderul general cu toate lunile amestecate.
 */
function getPropertyFolderUrls_() {
  const rootId = CONFIG.DRIVE.ROOT_FOLDER_ID;
  const rezultat = {};
  if (!rootId || rootId === "PUNE_AICI_ID_FOLDER_RADACINA") return rezultat;

  const rootFolder = DriveApp.getFolderById(rootId);
  const subfoldere = rootFolder.getFolders();
  while (subfoldere.hasNext()) {
    const propFolder = subfoldere.next();
    const propName = propFolder.getName();
    const luni = {};
    const luniFolders = propFolder.getFolders();
    while (luniFolders.hasNext()) {
      const lf = luniFolders.next();
      luni[lf.getName()] = lf.getUrl();
    }
    rezultat[propName] = { url: propFolder.getUrl(), luni: luni };
  }
  return rezultat;
}

/**
 * Mută TOATE facturile deja importate anterior în structura Proprietate/LunăAn, pe baza
 * proprietății și datei emiterii salvate deja în Sheet. Rulează o singură dată din editor,
 * ca migrare, pentru facturile importate cu o versiune mai veche a codului (fără subfoldere
 * pe lună).
 */
function migreazaFacturileInSubfoldere() {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { mutate: 0, esuate: 0 };

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues(); // A..G: FileID..DataEmitere
  let mutate = 0, esuate = 0;

  data.forEach(row => {
    const fileId = row[0];
    const proprietate = row[1];
    const dataEmitere = row[6];
    if (!fileId || !proprietate || proprietate === "Necunoscuta") return;

    try {
      const file = DriveApp.getFileById(fileId);
      const etichetaLuna = lunaEtichetaDinDataRO_(dataEmitere);
      mutaFisierInSubfolder_(file, proprietate, etichetaLuna);
      mutate++;
    } catch (err) {
      Logger.log("Eroare mutare fișier " + fileId + ": " + err.toString());
      esuate++;
    }
  });

  Logger.log("Migrare completă - mutate: " + mutate + ", eșuate: " + esuate);
  return { mutate: mutate, esuate: esuate };
}

/**
 * Funcție de TEST manuală: rulează OCR + parsare pe UN SINGUR fișier din Drive (după fileId),
 * fără să îl salveze în sheet. Utilă pentru calibrarea regexurilor pe facturi noi.
 * Rulează din editorul Apps Script: selectează funcția, pune un fileId valid și apasă Run,
 * apoi verifică rezultatul în View > Logs (Ctrl+Enter).
 */
function parseInvoiceTest_(fileId) {
  const text = ocrFileToTextWithRetry_(fileId);
  const parsed = parseInvoiceText_(text);
  Logger.log(JSON.stringify(parsed, null, 2));
  Logger.log("--- TEXT OCR COMPLET ---");
  Logger.log(text);
  return parsed;
}

/** Convertește un string numeric în format românesc (1.234,56 sau 1234.56) într-un Number JS. */
function parseRoNumber_(str) {
  if (!str) return null;
  let clean = str.trim();
  // Dacă are atât punct cât și virgulă, ultimul separator e cel zecimal
  if (clean.indexOf(",") !== -1 && clean.indexOf(".") !== -1) {
    if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }
  } else if (clean.indexOf(",") !== -1) {
    clean = clean.replace(",", ".");
  }
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/** Citește setul de FileID deja importate din sheet-ul Facturi, pentru deduplicare. */
function getImportedFileIds_() {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const lastRow = sheet.getLastRow();
  const set = new Set();
  if (lastRow <= 1) return set;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  ids.forEach(row => { if (row[0]) set.add(row[0]); });
  return set;
}

/** Adaugă o linie nouă în sheet-ul Facturi. */
function saveInvoiceRow_(inv) {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);

  // Siguranță: dacă sheet-ul e complet gol, scriem antetul acum.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "FileID", "Proprietate", "Furnizor", "CodClient", "NumarFactura", "Perioada",
      "DataEmitere", "DataScadenta", "Suma", "Moneda", "Status",
      "LinkDrive", "DataImport", "TextOCR", "StatusPlata", "LinkDovadaPlata"
    ]);
  }

  // Protecție: Google Sheets poate reinterpreta text ca "1Dec" sau "1-8521" drept dată
  // calendaristică. Forțăm coloanele relevante ca text simplu înainte de scriere
  // (excludem coloana M/DataImport, care rămâne dată reală).
  sheet.getRange("A:L").setNumberFormat("@");
  sheet.getRange("N:P").setNumberFormat("@");

  sheet.appendRow([
    inv.fileId,
    inv.proprietate,
    inv.furnizor,
    inv.codClient,
    inv.numarFactura,
    inv.perioada,
    inv.dataEmitere,
    inv.dataScadenta,
    inv.suma,
    inv.moneda,
    inv.status,
    inv.linkDrive,
    new Date(),
    inv.textOcr,
    "Neplatita",
    ""
  ]);
}

/**
 * Elimină facturile duplicate din Sheet-ul Facturi - se pot forma când aceeași factură
 * ajunge de două ori, prin surse diferite (ex: o dată importată prin OCR dintr-un PDF din
 * Drive, o dată importată automat prin API-ul furnizorului), fiecare cu propriul FileID.
 * Grupează rândurile după (Furnizor, NumărFactură) și, pentru fiecare grup cu mai multe
 * rânduri, păstrează UNUL SINGUR - preferă, în ordine: rândul cu link real către Drive
 * (document PDF adevărat) > rândul cu plata deja marcată > cel mai vechi rând (primul
 * importat) - și șterge restul. Rulează o singură dată din editor sau din Setări.
 */
/**
 * PREVIZUALIZARE (nu șterge nimic) - găsește posibile facturi duplicate, grupate după
 * (Furnizor, NumărFactură). IMPORTANT: exclude explicit valorile "-" (placeholder folosit
 * când OCR-ul nu a putut citi numărul facturii) - altfel facturi complet diferite, care
 * doar au eșuat la extragerea numărului, ar fi grupate greșit ca "aceeași factură".
 * Returnează grupurile găsite, cu detalii pe fiecare rând, ca utilizatorul să vadă exact
 * ce ar urma să fie șters ÎNAINTE să confirme.
 */
function previzualizeazaFacturiDuplicate() {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { grupuri: [] };

  const date = sheet.getRange(2, 1, lastRow - 1, 15).getValues();

  const grupe = {};
  date.forEach((row, i) => {
    const furnizor = row[2];
    const numarFactura = String(row[4] || "").trim();
    // Excludem placeholder-ul "-" si valorile goale - NU sunt numere reale de factura,
    // deci nu pot fi folosite ca sa identificam duplicate in siguranta.
    if (!furnizor || !numarFactura || numarFactura === "-") return;

    const cheie = furnizor + "||" + numarFactura;
    if (!grupe[cheie]) grupe[cheie] = [];
    grupe[cheie].push({
      rowIndex: i + 2,
      proprietate: row[1],
      furnizor: furnizor,
      numarFactura: numarFactura,
      suma: row[8],
      dataEmitere: row[6],
      status: row[10],
      linkDrive: String(row[11] || ""),
      statusPlata: String(row[14] || "")
    });
  });

  const grupuriCuDuplicate = Object.values(grupe).filter(intrari => intrari.length > 1);

  grupuriCuDuplicate.forEach(intrari => {
    intrari.sort((a, b) => {
      const diffScor = scorEntitateDuplicat_(b) - scorEntitateDuplicat_(a);
      if (diffScor !== 0) return diffScor;
      return a.rowIndex - b.rowIndex;
    });
    intrari.forEach((intrare, idx) => { intrare.recomandarePastrare = (idx === 0); });
  });

  return { grupuri: grupuriCuDuplicate };
}

function scorEntitateDuplicat_(intrare) {
  let s = 0;
  if (intrare.linkDrive.indexOf("drive.google.com") !== -1) s += 100;
  if (intrare.statusPlata === "Platita") s += 10;
  return s;
}

/**
 * ȘTERGE efectiv rândurile primite explicit ca parametru (indecși de rând, 1-indexați),
 * dupa ce utilizatorul a vazut previzualizarea si a confirmat. NU decide singura ce sa
 * stearga - primeste lista exacta din UI, ca sa evitam orice stergere accidentala in masa.
 */
function stergeRanduriFacturi(indeciiRandurilor) {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const indeciiSortati = indeciiRandurilor.slice().sort((a, b) => b - a); // de jos in sus
  indeciiSortati.forEach(rowIndex => sheet.deleteRow(rowIndex));
  Logger.log("Rânduri șterse (confirmate manual): " + indeciiSortati.join(", "));
  return { sterse: indeciiSortati.length };
}


/**
 * Caută în Sheet un rând existent cu ACEEAȘI factură (furnizor + număr factură),
 * indiferent de FileID - o factură poate fi deja importată prin OCR (FileID = ID fișier
 * Drive) și retrimisă acum prin API extern (care ar folosi alt FileID sintetic). Fără
 * această verificare încrucișată, aceeași factură ajunge de două ori în Sheet.
 * Returnează indexul rândului (1-indexat) sau -1 dacă nu găsește.
 */
function findInvoiceRowByFurnizorSiNumar_(sheet, furnizor, numarFactura) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const date = sheet.getRange(2, 3, lastRow - 1, 3).getValues(); // C=Furnizor, D=CodClient, E=NumarFactura
  const numarTintaNormalizat = String(numarFactura).trim();
  for (let i = 0; i < date.length; i++) {
    const rowFurnizor = date[i][0];
    const rowNumar = String(date[i][2]).trim();
    if (rowFurnizor === furnizor && rowNumar === numarTintaNormalizat) {
      return i + 2;
    }
  }
  return -1;
}

/**
 * Link generic către portalul furnizorului, folosit ca "Document" pentru facturile
 * importate prin API extern (nu au un fișier PDF fizic în Drive ca cele din OCR).
 */
const LINK_PORTAL_FURNIZOR_ = {
  "Hidroelectrica": "https://ihidro.ro",
  "ENGIE": "https://my.engie.ro"
};

/**
 * Primește o factură dintr-o sursă externă (ex: scriptul Python care citește direct din
 * API-ul furnizorului) și o scrie în Sheet - INSERT dacă e nouă, UPDATE dacă există deja
 * (fie cu FileID-ul sintetic al unui import API anterior, fie cu FileID-ul unui import OCR
 * anterior pentru ACEEAȘI factură - căutăm după furnizor+număr factură, nu doar FileID),
 * păstrând statusul de plată existent neatins la actualizare.
 */
function importaFacturaExterna_(payload) {
  const campuriObligatorii = ["furnizor", "proprietate", "numarFactura", "suma"];
  campuriObligatorii.forEach(camp => {
    if (payload[camp] === undefined || payload[camp] === null || payload[camp] === "") {
      throw new Error("Câmp obligatoriu lipsă: " + camp);
    }
  });

  const fileId = String(payload.furnizor).substring(0, 5).toUpperCase() + "-" + payload.numarFactura;
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);

  // Căutăm întâi după furnizor+număr factură (prinde și facturile deja importate prin OCR),
  // apoi ca rezervă după FileID-ul sintetic (prinde un import API anterior al aceleiași facturi).
  let rowIndex = findInvoiceRowByFurnizorSiNumar_(sheet, payload.furnizor, payload.numarFactura);
  if (rowIndex === -1) {
    rowIndex = findInvoiceRowByFileId_(sheet, fileId);
  }

  const linkDrive = LINK_PORTAL_FURNIZOR_[payload.furnizor] || "";
  const status = "Importat automat (" + (payload.sursaImport || (payload.furnizor + " API")) + ")";

  if (rowIndex !== -1) {
    // UPDATE: rescriem doar valorile facturii (B..L), pastram neschimbate DataImport,
    // TextOCR si mai ales StatusPlata/LinkDovadaPlata (coloanele O/P) - nu vrem sa "resetam"
    // o factura deja marcata platita doar pentru ca sursa externa a retrimis-o. La fel, daca
    // randul gasit avea deja un link real catre Drive (import OCR anterior), il pastram in
    // loc sa-l suprascriem cu link-ul generic catre portal.
    const linkExistent = sheet.getRange(rowIndex, 12).getValue();
    const linkFinal = linkExistent || linkDrive;

    sheet.getRange(rowIndex, 2, 1, 11).setNumberFormat("@");
    sheet.getRange(rowIndex, 2, 1, 11).setValues([[
      payload.proprietate,
      payload.furnizor,
      payload.codClient || "",
      payload.numarFactura,
      payload.perioada || "",
      payload.dataEmitere || "",
      payload.dataScadenta || "",
      payload.suma,
      payload.moneda || "RON",
      status,
      linkFinal
    ]]);
    return { success: true, actiune: "actualizat", fileId: fileId };
  }

  saveInvoiceRow_({
    fileId: fileId,
    proprietate: payload.proprietate,
    furnizor: payload.furnizor,
    codClient: payload.codClient || "",
    numarFactura: payload.numarFactura,
    perioada: payload.perioada || "",
    dataEmitere: payload.dataEmitere || "",
    dataScadenta: payload.dataScadenta || "",
    suma: payload.suma,
    moneda: payload.moneda || "RON",
    status: status,
    linkDrive: linkDrive,
    textOcr: ""
  });
  return { success: true, actiune: "creat", fileId: fileId };
}

/** Găsește indexul rândului (1-indexat) după FileID (coloana A) în sheet-ul Facturi. Returnează -1 dacă nu găsește. */
function findInvoiceRowByFileId_(sheet, fileId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === fileId) return i + 2;
  }
  return -1;
}

/** Marchează o factură ca plătită, cu link opțional către dovada plății (chitanță/confirmare transfer din Drive). */
function marcheazaFacturaPlatita_(fileId, linkDovadaPlata) {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const rowIndex = findInvoiceRowByFileId_(sheet, fileId);
  if (rowIndex === -1) throw new Error("Factura nu a fost găsită.");

  sheet.getRange(rowIndex, 15, 1, 2).setNumberFormat("@");
  sheet.getRange(rowIndex, 15, 1, 2).setValues([["Platita", linkDovadaPlata || ""]]);
  return { success: true };
}

/** Anulează marcajul de plată (revine la Neplatita, șterge linkul dovezii). */
function anuleazaPlataFactura_(fileId) {
  const sheet = getSheet(CONFIG.SHEETS.INVOICES);
  const rowIndex = findInvoiceRowByFileId_(sheet, fileId);
  if (rowIndex === -1) throw new Error("Factura nu a fost găsită.");

  sheet.getRange(rowIndex, 15, 1, 2).setValues([["Neplatita", ""]]);
  return { success: true };
}

/**
 * Funcție de DEBUG: afișează direct în Logs (View -> Logs / Ctrl+Enter) rezultatul
 * getInvoices(), ca să nu mai fie nevoie să cauți "Return value" prin panoul Executions.
 * Rulează din editor: selectează "debugGetInvoices" din dropdown -> Run -> Ctrl+Enter.
 */
function debugGetInvoices() {
  const invoices = getInvoices();
  Logger.log("Număr facturi găsite: " + invoices.length);
  Logger.log(JSON.stringify(invoices, null, 2));
  return invoices;
}

/**
 * Preluarea tuturor facturilor din Sheet (pentru afișare în UI).
 */
function getInvoices() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.INVOICES);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
    return data.map(row => ({
      fileId: row[0],
      proprietate: row[1],
      furnizor: row[2],
      codClient: row[3],
      numarFactura: row[4],
      perioada: row[5],
      dataEmitere: row[6],
      dataScadenta: row[7],
      suma: row[8],
      moneda: row[9],
      status: row[10],
      linkDrive: row[11],
      dataImport: (row[12] instanceof Date) ? row[12].toISOString() : String(row[12] || ""),
      // textOcr (col 14) nu e trimis către UI ca să nu îngreuneze payload-ul
      statusPlata: row[14] || "Neplatita",
      linkDovadaPlata: row[15] || ""
    }));
  } catch (error) {
    Logger.log("Eroare în invoiceservice -> getInvoices: " + error.toString());
    throw new Error("Nu s-au putut citi facturile: " + error.message);
  }
}
/**
 * TEST: verifică facturile din Drive fără OCR.
 * NU modifică nimic.
 * Afișează: fișier -> folder -> proprietate -> MIME type -> FileID
 */
function testMetadataFacturi() {
  const rootId = CONFIG.DRIVE.ROOT_FOLDER_ID;

  if (!rootId || rootId === "PUNE_AICI_ID_FOLDER_RADACINA") {
    throw new Error("CONFIG.DRIVE.ROOT_FOLDER_ID nu este configurat.");
  }

  const rootFolder = DriveApp.getFolderById(rootId);

  Logger.log("========================================");
  Logger.log("TEST METADATA FACTURI - FARA OCR");
  Logger.log("Folder rădăcină: " + rootFolder.getName());
  Logger.log("========================================");

  const rezultate = [];

  parcurgeMetadataFacturi_(rootFolder, "", rezultate);

  Logger.log("========================================");
  Logger.log("TOTAL FIȘIERE GĂSITE: " + rezultate.length);
  Logger.log("========================================");

  rezultate.forEach(function (r, index) {
    Logger.log(
      (index + 1) +
      " | Fișier: " + r.fisier +
      " | Folder: " + r.folder +
      " | Proprietate: " + r.proprietate +
      " | MIME: " + r.mimeType +
      " | FileID: " + r.fileId
    );
  });

  return rezultate;
}


/**
 * Parcurgere recursivă doar pentru CITIRE.
 */
function parcurgeMetadataFacturi_(folder, proprietate, rezultate) {

  // Dacă folderul curent este una dintre proprietățile noastre,
  // îl considerăm sursa proprietății.
  const numeFolder = folder.getName();

  const proprietati = Object.keys(
    CONFIG.PROPERTIES_ADDRESS_KEYWORDS || {}
  );

  let proprietateCurenta = proprietate;

  if (proprietati.indexOf(numeFolder) !== -1) {
    proprietateCurenta = numeFolder;
  }

  // Fișiere
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();

    const mimeType = file.getMimeType();

    // Doar tipurile de facturi pe care le folosim
    if (INVOICE_EXTENSIONS_MIME.indexOf(mimeType) === -1) {
      continue;
    }

    rezultate.push({
      fisier: file.getName(),
      folder: numeFolder,
      proprietate: proprietateCurenta || "Necunoscuta",
      mimeType: mimeType,
      fileId: file.getId()
    });
  }

  // Subfoldere
  const subfolders = folder.getFolders();

  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();

    parcurgeMetadataFacturi_(
      subfolder,
      proprietateCurenta,
      rezultate
    );
  }
}
function testCasaMamaMetadata() {
  Logger.log("========================================");
  Logger.log("TEST CASA / MAMA - FARA OCR");
  Logger.log("========================================");

  const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE.ROOT_FOLDER_ID);

  function scanFolder(folder, path) {
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();

      Logger.log(
        "Fișier: " + file.getName() +
        " | Folder: " + path +
        " | FileID: " + file.getId()
      );
    }

    const folders = folder.getFolders();

    while (folders.hasNext()) {
      const sub = folders.next();
      scanFolder(sub, path + "/" + sub.getName());
    }
  }

  scanFolder(rootFolder, rootFolder.getName());

  Logger.log("========================================");
  Logger.log("SFARSIT TEST");
  Logger.log("========================================");
}
function importEngieInvoiceHistory() {

  Logger.log("========================================");
  Logger.log("IMPORT ENGIE - ISTORIC FACTURI");
  Logger.log("========================================");

  if (
    typeof CONFIG === "undefined" ||
    !CONFIG.ENGIE_API
  ) {
    throw new Error("CONFIG.ENGIE_API nu există.");
  }

  const email = CONFIG.ENGIE_API.EMAIL;
  const password = CONFIG.ENGIE_API.PASSWORD;

  if (!email || !password) {
    throw new Error("Lipsesc credențialele ENGIE.");
  }

  // ========================================
  // 1. LOGIN
  // ========================================

  const tokens = loginToEngie(email, password);

  if (!tokens || !tokens.accessToken) {
    throw new Error("Login ENGIE fără access token.");
  }

  Logger.log("LOGIN OK");

  // ========================================
  // 2. LOCURI DE CONSUM
  // ========================================

  const placesResponse =
    getEngiePlacesOfConsumption(
      tokens.accessToken
    );

  const rawPlaces =
    extractEngiePlaces_(
      placesResponse
    );

  Logger.log(
    "Locuri găsite: " +
    rawPlaces.length
  );

  if (!rawPlaces.length) {
    throw new Error(
      "ENGIE nu a returnat locuri de consum."
    );
  }

  // ========================================
  // 3. PERIOADA
  // ========================================

  const period =
    getEngieImportPeriod_();

  Logger.log(
    "Perioada: " +
    period.startDate +
    " -> " +
    period.endDate
  );

  // ========================================
  // 4. REZULTAT
  // ========================================

  const rezultat = {
    locuri: 0,
    facturiGasite: 0,
    importate: 0,
    actualizate: 0,
    ignorate: 0,
    erori: 0,
    detalii: []
  };

  // ========================================
  // 5. PARCURGERE LOCURI
  // ========================================

  rawPlaces.forEach(function(rawPlace, index) {

    rezultat.locuri++;

    Logger.log("");
    Logger.log("----------------------------------------");
    Logger.log(
      "LOC " +
      (index + 1) +
      "/" +
      rawPlaces.length
    );
    Logger.log("----------------------------------------");

    const place =
      normalizeEngiePlace_(
        rawPlace
      );

    if (!place) {

      Logger.log(
        "SKIP: loc invalid."
      );

      rezultat.ignorate++;

      return;
    }

    Logger.log(
      "Proprietate: " +
      place.alias
    );

    Logger.log(
      "PA: " +
      place.pa
    );

    Logger.log(
      "POC: " +
      place.poc
    );

    Logger.log(
      "Adresă: " +
      place.addressInline
    );

    // ======================================
    // PROTECȚIE PA / POC
    // ======================================

    if (!place.pa || !place.poc) {

      Logger.log(
        "SKIP: PA sau POC lipsă."
      );

      rezultat.ignorate++;

      return;
    }

    // ======================================
    // ISTORIC FACTURI
    // ======================================

    try {

      const history =
        getEngieInvoiceHistory_(
          tokens.accessToken,
          place.poc,
          place.pa,
          period.startDate,
          period.endDate
        );

      if (!history) {

        Logger.log(
          "ISTORIC: răspuns gol."
        );

        return;
      }

      const invoices =
        extractEngieInvoices_(
          history
        );

      Logger.log(
        "Facturi găsite: " +
        invoices.length
      );

      rezultat.facturiGasite += invoices.length;

      // ====================================
      // FACTURI
      // ====================================

      invoices.forEach(function(invoice) {

        try {

          const invoiceNumber =
            engieString_(
              invoice.invoice_number ||
              invoice.invoiceNumber ||
              invoice.number
            );

          if (!invoiceNumber) {

            Logger.log(
              "SKIP factura fără număr."
            );

            rezultat.ignorate++;

            return;
          }

          const invoicedAt =
            engieString_(
              invoice.invoiced_at ||
              invoice.invoice_date ||
              invoice.invoiceDate
            );

          const dueDate =
            engieString_(
              invoice.due_date ||
              invoice.dueDate
            );

          const total =
            invoice.total !== undefined
              ? invoice.total
              : (
                  invoice.amount !== undefined
                    ? invoice.amount
                    : ""
                );

          const downloadValue =
            getEngieInvoiceDownloadValue_(
              invoice
            );

          // =================================
          // PAYLOAD PENTRU FACTURI
          // =================================

          const payload = {

            furnizor: "ENGIE",

            // Proprietatea vine direct
            // din locul de consum ENGIE.
            proprietate: place.alias,

            codClient:
              invoice.customer_code ||
              invoice.client_code ||
              invoice.clientCode ||
              "",

            numarFactura:
              invoiceNumber,

            perioada:
              invoice.period ||
              invoice.billing_period ||
              "",

            dataEmitere:
              invoicedAt,

            dataScadenta:
              dueDate,

            suma:
              parseEngieAmount_(total),

            moneda:
              "RON",

            sursaImport:
              "ENGIE API",

            // Nu este folosit încă de
            // importaFacturaExterna_,
            // dar îl păstrăm în payload
            // pentru etapa următoare.
            downloadValue:
              downloadValue || "",

            pa:
              place.pa,

            poc:
              place.poc
          };

          Logger.log(
            "Import factura ENGIE: " +
            invoiceNumber +
            " | " +
            payload.suma +
            " RON"
          );

          // =================================
          // IMPORT CENTRALIZAT
          // =================================

          const rezultatImport =
            importaFacturaExterna_(
              payload
            );

          if (
            rezultatImport.actiune ===
            "creat"
          ) {

            rezultat.importate++;

          } else if (
            rezultatImport.actiune ===
            "actualizat"
          ) {

            rezultat.actualizate++;

          } else {

            rezultat.ignorate++;

          }

          rezultat.detalii.push({

            proprietate:
              place.alias,

            poc:
              place.poc,

            pa:
              place.pa,

            factura:
              invoiceNumber,

            suma:
              payload.suma,

            actiune:
              rezultatImport.actiune,

            download:
              downloadValue
                ? true
                : false

          });

        } catch (invoiceError) {

          rezultat.erori++;

          Logger.log(
            "EROARE FACTURA ENGIE: " +
            invoiceError.toString()
          );

        }

      });

    } catch (historyError) {

      rezultat.erori++;

      Logger.log(
        "EROARE ISTORIC ENGIE: " +
        historyError.toString()
      );

    }

  });

  // ========================================
  // REZUMAT
  // ========================================

  Logger.log("");
  Logger.log("========================================");
  Logger.log("IMPORT ENGIE TERMINAT");
  Logger.log("========================================");

  Logger.log(
    "Locuri: " +
    rezultat.locuri
  );

  Logger.log(
    "Facturi găsite: " +
    rezultat.facturiGasite
  );

  Logger.log(
    "Importate: " +
    rezultat.importate
  );

  Logger.log(
    "Actualizate: " +
    rezultat.actualizate
  );

  Logger.log(
    "Ignorate: " +
    rezultat.ignorate
  );

  Logger.log(
    "Erori: " +
    rezultat.erori
  );

  Logger.log("========================================");

  return rezultat;
}

function testOcrFactura() {
  const fileId = "18HnAcSt9ce7-QqUMdxaPe-d5LXsaLaCA";

  Logger.log("========================================");
  Logger.log("TEST OCR FACTURA");
  Logger.log("========================================");

  const file = DriveApp.getFileById(fileId);

  Logger.log("Fișier: " + file.getName());
  Logger.log("MIME: " + file.getMimeType());
  Logger.log("FileID: " + file.getId());
  Logger.log("Dimensiune: " + file.getSize());

  Logger.log("Pornesc OCR...");

  const text = ocrFileToTextWithRetry_(fileId);

  Logger.log("OCR TERMINAT");
  Logger.log("Lungime text: " + text.length);

  Logger.log("========================================");
  Logger.log("PRIMELE 8000 CARACTERE OCR");
  Logger.log("========================================");

  Logger.log(text.substring(0, 8000));

  Logger.log("========================================");
}

function testStructuraFacturi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error("Nu s-a putut identifica spreadsheet-ul activ.");
  }

  const sheet = ss.getSheetByName("Facturi");

  if (!sheet) {
    throw new Error("Sheet-ul Facturi nu există în spreadsheet.");
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  Logger.log("========================================");
  Logger.log("STRUCTURA SHEET FACTURI");
  Logger.log("========================================");

  headers.forEach(function(header, index) {
    Logger.log(
      "Coloana " +
      String.fromCharCode(65 + index) +
      " (" + (index + 1) + ") = " +
      header
    );
  });

  Logger.log("========================================");
}
function verificaSheetFacturi() {
  const spreadsheetId = CONFIG.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("CONFIG.SPREADSHEET_ID nu este configurat.");
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName("Facturi");

  if (!sheet) {
    throw new Error("Sheet-ul Facturi nu există.");
  }

  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  Logger.log("========================================");
  Logger.log("SHEET FACTURI");
  Logger.log("========================================");
  Logger.log("Spreadsheet: " + ss.getName());
  Logger.log("Sheet: " + sheet.getName());
  Logger.log("Rânduri: " + lastRow);
  Logger.log("Coloane: " + lastColumn);
  Logger.log("----------------------------------------");

  if (lastColumn > 0) {
    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0];

    headers.forEach(function(header, index) {
      Logger.log(
        "Coloana " +
        (index + 1) +
        " (" +
        String.fromCharCode(65 + index) +
        ") = " +
        header
      );
    });
  }

  Logger.log("========================================");
}
function testVitezaGetInvoices() {
  const start = new Date().getTime();

  const invoices = getInvoices();

  const end = new Date().getTime();

  Logger.log("========================================");
  Logger.log("TEST VITEZA getInvoices()");
  Logger.log("========================================");
  Logger.log("Facturi returnate: " + invoices.length);
  Logger.log("Timp: " + ((end - start) / 1000).toFixed(2) + " secunde");
  Logger.log("========================================");
}