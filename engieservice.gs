/**

* ============================================================
* ENGIE SERVICE
* ============================================================
*
* Integrare directă cu API-ul ENGIE MyENGIE.
*
* FLUX:
*
* LOGIN
* 
   ↓
  
* PLACES OF CONSUMPTION
* 
   ↓
  
* PA + POC + CONTRACT ACCOUNT
* 
   ↓
  
* HISTORY-ONLY
* 
   ↓
  
* DOWNLOAD PDF
* 
   ↓
  
* GOOGLE DRIVE
* 
   ↓
  
* SHEET "Facturi"
*
* IMPORTANT:
*
* * PA NU este contract_account_number.
* * PA este folosit pentru history-only.
* * POC este folosit în URL-ul history-only.
* * contract_account_number este informație contractuală.
*
* ============================================================
  */

/* ============================================================

* CONFIGURAȚIE
* ============================================================
  */

const ENGIE_BASE_URL_ =
"https://gwss.engie.ro/myservices/";

/* ============================================================

* HEADERE ENGIE
* ============================================================
  */

function getEngieHeaders_(authToken) {

const headers = {

"Accept":
  "application/json",

"source":
  "android",

"App-Version":
  "2.1.15",

"App-Build":
  "181",

"OS-Version":
  "13",

"OS-Platform":
  "Android",

"Device-Type":
  "phone",

"Device-Manufacturer":
  "Google",

"Device-Model":
  "Pixel 7 Pro",

"Screen-Height":
  "2400",

"Screen-Width":
  "1080",

"Device-Id":
  "f7d7301c-6d84-4860-9154-0824b2bb74b9",

"User-Agent":
  "MyENGIE/2.1.15(181) Dalvik/2.1.0 " +
  "(Linux; U; Android 13; Pixel 7 Pro Build/TQ2A.230305.008.C1)"


};

if (authToken) {


headers["Authorization"] =
  "Bearer " + authToken;


}

return headers;
}

/**

* Headere separate pentru download PDF.
*
* Nu modificăm header-ele folosite de login/history.
  */
  function getEngieDownloadHeaders_(authToken) {

const headers =
getEngieHeaders_(
authToken
);

headers["source"] =
"desktop";

headers["Accept"] =
"application/pdf,application/octet-stream,*/*";

return headers;
}

/* ============================================================

* UTILE
* ============================================================
  */

/**

* Returnează prima valoare existentă.
  */
  function engieValue_(obj, keys) {

if (
!obj ||
typeof obj !== "object"
) {


return "";


}

for (
let i = 0;
i < keys.length;
i++
) {


const value =
  obj[keys[i]];

if (
  value !== undefined &&
  value !== null &&
  String(value).trim() !== ""
) {

  return value;
}


}

return "";
}

/**

* Transformă valoarea în string sigur.
  */
  function engieString_(value) {

if (
value === undefined ||
value === null
) {


return "";


}

return String(value).trim();
}

/**

* Nume sigur pentru fișier/folder.
  */
  function engieSafeName_(value) {

let text =
engieString_(
value
);

if (!text) {


text =
  "Necunoscut";


}

text =
text.replace(
/[<>:"/\|?*\x00-\x1F]/g,
"_"
);

text =
text.replace(
/\s+/g,
"_"
);

return text.substring(
0,
150
);
}

/**

* Normalizează data pentru numele fișierului.
  */
  function engieSafeDate_(value) {

const text =
engieString_(
value
);

if (!text) {


return "";


}

return text
.replace(
/T/g,
"*"
)
.replace(
/:/g,
"-"
)
.replace(
 /\//g,
"-"
)
.replace(
/\s+/g,
"*"
);
}

/**

* Extrage ID-ul de download dintr-o factură.
*
* Acceptăm mai multe variante deoarece structura
* history-only poate diferi între versiuni.
  */
  function getEngieInvoiceDownloadValue_(invoice) {

if (
!invoice ||
typeof invoice !== "object"
) {


return "";


}

return engieString_(
engieValue_(
invoice,
[
"download_url",
"downloadUrl",
"encrypted_invoice",
"encryptedInvoice",
"invoice_id",
"invoiceId",
"encrypted_id",
"encryptedId",
"document_id",
"documentId",
"id"
]
)
);
}

/**

* Verifică dacă un string este URL HTTP/HTTPS.
  */
  function isEngieHttpUrl_(value) {

const text =
engieString_(
value
);

return (
text.indexOf("http://") === 0 ||
text.indexOf("https://") === 0
);
}

/* ============================================================

* LOGIN
* ============================================================
  */

/**

* Login direct în API-ul ENGIE.
  */
  function loginToEngie(
  email,
  password
  ) {

if (
!email ||
!password
) {


throw new Error(
  "Lipsesc credențialele ENGIE."
);


}

const url =
ENGIE_BASE_URL_ +
"v1/login";

const payload = {


username:
  email,

password:
  password


};

const options = {


method:
  "post",

headers:
  getEngieHeaders_(),

contentType:
  "application/x-www-form-urlencoded",

payload:
  payload,

muteHttpExceptions:
  true


};

Logger.log(
"ENGIE LOGIN: " +
email
);

const response =
UrlFetchApp.fetch(
url,
options
);

const code =
response.getResponseCode();

const text =
response.getContentText();

Logger.log(
"ENGIE LOGIN HTTP: " +
code
);

if (
code < 200 ||
code >= 300
) {


Logger.log(
  "ENGIE LOGIN ERROR: " +
  text
);

throw new Error(
  "Autentificare ENGIE eșuată. HTTP " +
  code
);


}

let json;

try {


json =
  JSON.parse(
    text
  );


} catch (err) {


throw new Error(
  "Răspunsul LOGIN ENGIE nu este JSON valid."
);


}

const data =
json &&
json.data &&
typeof json.data === "object"
? json.data
: json;

const accessToken =
data.token ||
data.access_token;

if (!accessToken) {


throw new Error(
  "Login ENGIE reușit, dar lipsește token-ul."
);


}

Logger.log(
"ENGIE LOGIN OK."
);

return {


accessToken:
  accessToken,

refreshToken:
  data.refresh_token ||
  data.refreshToken ||
  "",

idToken:
  data.id_token ||
  data.idToken ||
  "",

expiresIn:
  data.exp ||
  data.expires_in ||
  3600


};
}

/* ============================================================

* PLACES OF CONSUMPTION
* ============================================================
  */

/**

* Obține toate locurile de consum ENGIE.
  */
  function getEngiePlacesOfConsumption(
  authToken
  ) {

const url =
ENGIE_BASE_URL_ +
"v1/placesofconsumption";

const options = {


method:
  "get",

headers:
  getEngieHeaders_(
    authToken
  ),

muteHttpExceptions:
  true


};

Logger.log(
"ENGIE POC URL:"
);

Logger.log(
url
);

const response =
UrlFetchApp.fetch(
url,
options
);

const code =
response.getResponseCode();

const text =
response.getContentText();

Logger.log(
"ENGIE POC HTTP: " +
code
);

if (
code < 200 ||
code >= 300
) {


Logger.log(
  "ENGIE POC ERROR: " +
  text
);

throw new Error(
  "Nu s-au putut obține locurile de consum ENGIE. HTTP " +
  code
);


}

let json;

try {


json =
  JSON.parse(
    text
  );


} catch (err) {


throw new Error(
  "Răspunsul placesofconsumption nu este JSON valid."
);


}

return json;
}

/**

* Extrage lista places_of_consumption.
  */
  function extractEngiePlaces_(
  response
  ) {

if (!response) {


return [];


}

if (
response.data &&
Array.isArray(
response.data.places_of_consumption
)
) {


return response.data.places_of_consumption;


}

if (
Array.isArray(
response.places_of_consumption
)
) {


return response.places_of_consumption;


}

if (
response.data &&
Array.isArray(
response.data
)
) {


return response.data;


}

if (
Array.isArray(
response
)
) {


return response;


}

return [];
}

/**

* Construiește obiectul intern pentru o locație.
  */
  function normalizeEngiePlace_(
  place
  ) {

if (!place) {


return null;


}

const pa =
engieString_(
engieValue_(
place,
[
"pa",
"partner",
"partner_id",
"partnerId"
]
)
);

const poc =
engieString_(
engieValue_(
place,
[
"poc_number",
"pocNumber",
"poc"
]
)
);

const alias =
engieString_(
engieValue_(
place,
[
"alias"
]
)
);

const address =
place.address &&
typeof place.address === "object"
? place.address
: {};

const contractList =
Array.isArray(
place.cont_contract
)
? place.cont_contract
: (
Array.isArray(
place.contracts
)
? place.contracts
: []
);

const contracts =
contractList.map(
function(contract) {


    return {

      contractAccountNumber:
        engieString_(
          engieValue_(
            contract,
            [
              "contract_account_number",
              "contractAccountNumber",
              "contract_account",
              "contractAccount"
            ]
          )
        ),

      greenbillEmail:
        engieString_(
          engieValue_(
            contract,
            [
              "greenbill_email",
              "greenbillEmail"
            ]
          )
        ),

      hasGreenbill:
        contract.has_greenbill === true ||
        contract.hasGreenbill === true,

      greenbillStatus:
        engieString_(
          engieValue_(
            contract,
            [
              "greenbill_status",
              "greenbillStatus"
            ]
          )
        ),

      raw:
        contract
    };
  }
);


const addressInline =
engieString_(
address.inline
) ||
[
address.street,
address.number,
address.city
]
.filter(

function(value) {
return engieString_(value) !== "";
}
)
.join(", ");

return {


pa:
  pa,

poc:
  poc,

alias:
  alias ||
  engieString_(
    address.street
  ) ||
  poc,

address:
  address,

addressInline:
  addressInline,

contracts:
  contracts,

raw:
  place


};
}

/* ============================================================

* ISTORIC FACTURI
* ============================================================
  */

/**

* Obține istoricul facturilor pentru un POC.
  */
  function getEngieInvoiceHistory_(
  authToken,
  poc,
  pa,
  startDate,
  endDate
  ) {

if (!poc) {


throw new Error(
  "POC ENGIE lipsă."
);


}

if (!pa) {


throw new Error(
  "PA ENGIE lipsă."
);


}

const url =
ENGIE_BASE_URL_ +
"v1/invoices/history-only/" +
encodeURIComponent(
poc
);

const params = {


startDate:
  startDate,

endDate:
  endDate,

pa:
  pa


};

const query =
Object.keys(
params
)
.map(
function(key) {


      return (
        encodeURIComponent(
          key
        ) +
        "=" +
        encodeURIComponent(
          params[key]
        )
      );
    }
  )
  .join("&");


const fullUrl =
url +
"?" +
query;

Logger.log(
"ENGIE HISTORY URL:"
);

Logger.log(
fullUrl
);

const options = {


method:
  "get",

headers:
  getEngieHeaders_(
    authToken
  ),

muteHttpExceptions:
  true


};

const response =
UrlFetchApp.fetch(
fullUrl,
options
);

const code =
response.getResponseCode();

const text =
response.getContentText();

Logger.log(
"ENGIE HISTORY HTTP: " +
code
);

if (
code < 200 ||
code >= 300
) {


Logger.log(
  "ENGIE HISTORY ERROR: " +
  text
);

return null;


}

try {


return JSON.parse(
  text
);


} catch (err) {


Logger.log(
  "ENGIE HISTORY JSON ERROR: " +
  err
);

return null;


}
}

/**

* Extrage facturile din răspunsul history-only.
  */
  function extractEngieInvoices_(
  response
  ) {

if (!response) {


return [];


}

const result = [];

function walk(value) {


if (!value) {

  return;
}

if (
  Array.isArray(
    value
  )
) {

  value.forEach(
    function(item) {

      walk(
        item
      );
    }
  );

  return;
}

if (
  typeof value !== "object"
) {

  return;
}

const hasInvoiceNumber =
  value.invoice_number !== undefined ||
  value.invoiceNumber !== undefined ||
  value.number !== undefined;

const hasInvoiceData =
  value.download_url !== undefined ||
  value.downloadUrl !== undefined ||
  value.encrypted_invoice !== undefined ||
  value.encryptedInvoice !== undefined ||
  value.encrypted_id !== undefined ||
  value.encryptedId !== undefined ||
  value.invoice_id !== undefined ||
  value.invoiceId !== undefined ||
  value.document_id !== undefined ||
  value.documentId !== undefined ||
  value.invoiced_at !== undefined ||
  value.invoice_date !== undefined ||
  value.invoiceDate !== undefined ||
  value.due_date !== undefined ||
  value.dueDate !== undefined ||
  value.total !== undefined ||
  value.amount !== undefined;

if (
  hasInvoiceNumber &&
  hasInvoiceData
) {

  result.push(
    value
  );

  return;
}

Object.keys(
  value
)
  .forEach(
    function(key) {

      walk(
        value[key]
      );
    }
  );


}

walk(
response.data ||
response
);

const seen = {};
const unique = [];

result.forEach(
function(invoice) {


  const number =
    engieString_(
      invoice.invoice_number ||
      invoice.invoiceNumber ||
      invoice.number
    );

  const id =
    getEngieInvoiceDownloadValue_(
      invoice
    );

  const key =
    number +
    "|" +
    id;

  if (!seen[key]) {

    seen[key] = true;

    unique.push(
      invoice
    );
  }
}


);

return unique;
}

/* ============================================================

* DOWNLOAD PDF
* ============================================================
  */

/**

* Descarcă PDF-ul facturii ENGIE.
*
* Acceptă:
*
* 1. URL complet
* 2. URL relativ
* 3. encrypted invoice / invoice id
*
* Pentru URL folosim direct valoarea.
*
* Pentru ID folosim endpointul:
*
* /v1/invoices/download/{id}
  */
  function downloadEngieInvoicePdf_(
  authToken,
  invoiceValue,
  fileName
  ) {

if (!invoiceValue) {


throw new Error(
  "Factura nu are informație pentru download."
);


}

let url =
engieString_(
invoiceValue
);

if (
!isEngieHttpUrl_(
url
)
) {


url =
  ENGIE_BASE_URL_ +
  "v1/invoices/download/" +
  encodeURIComponent(
    url
  );


}

Logger.log(
"ENGIE PDF URL:"
);

Logger.log(
url
);

const options = {


method:
  "get",

headers:
  getEngieDownloadHeaders_(
    authToken
  ),

muteHttpExceptions:
  true,

followRedirects:
  true


};

const response =
UrlFetchApp.fetch(
url,
options
);

const code =
response.getResponseCode();

Logger.log(
"ENGIE PDF HTTP: " +
code
);

const blob =
response.getBlob();

const bytes =
blob.getBytes();

const contentType =
String(
blob.getContentType() ||
""
)
.toLowerCase();

let isPdf =
false;

if (
bytes.length >= 4 &&
bytes[0] === 37 &&
bytes[1] === 80 &&
bytes[2] === 68 &&
bytes[3] === 70
) {


isPdf =
  true;


}

if (
contentType.indexOf(
"application/pdf"
) !== -1
) {


isPdf =
  true;


}

if (
code < 200 ||
code >= 300
) {


const text =
  response.getContentText();

throw new Error(
  "Download PDF ENGIE HTTP " +
  code +
  ": " +
  text.substring(
    0,
    1000
  )
);


}

if (!isPdf) {


let preview = "";

try {

  preview =
    response
      .getContentText()
      .substring(
        0,
        500
      );

} catch (err) {

  preview =
    "";
}

throw new Error(
  "ENGIE nu a returnat PDF pentru factura " +
  fileName +
  ". Content-Type: " +
  contentType +
  ". Răspuns: " +
  preview
);


}

return blob.setName(
fileName +
".pdf"
);
}

/* ============================================================

* DRIVE
* ============================================================
  */

/**

* Găsește sau creează folderul unei proprietăți.
  */
  function getEngiePropertyFolder_(
  rootFolder,
  propertyName
  ) {

const safeName =
engieSafeName_(
propertyName
);

const folders =
rootFolder.getFoldersByName(
safeName
);

if (
folders.hasNext()
) {


return folders.next();


}

return rootFolder.createFolder(
safeName
);
}

/**

* Verifică dacă factura există deja în Drive.
  */
  function findExistingEngieInvoice_(
  folder,
  fileName
  ) {

const files =
folder.getFilesByName(
fileName +
".pdf"
);

if (
files.hasNext()
) {


return files.next();


}

return null;
}

/**

* Verifică dacă un File ID există și este accesibil.
  */
  function getEngieDriveFileById_(
  fileId
  ) {

const id =
engieString_(
fileId
);

if (!id) {


return null;


}

try {


return DriveApp.getFileById(
  id
);


} catch (err) {


Logger.log(
  "File ID invalid/inexistent: " +
  id
);

return null;


}
}

/**

* Salvează PDF-ul în Drive.
  */
  function saveEngiePdfToDrive_(
  blob,
  rootFolder,
  propertyName,
  fileName
  ) {

const propertyFolder =
getEngiePropertyFolder_(
rootFolder,
propertyName
);

const existing =
findExistingEngieInvoice_(
propertyFolder,
fileName
);

if (existing) {


Logger.log(
  "PDF deja există în Drive: " +
  existing.getName()
);

return {

  fileId:
    existing.getId(),

  file:
    existing,

  created:
    false
};


}

const file =
propertyFolder.createFile(
blob
);

Logger.log(
"PDF salvat în Drive: " +
file.getName()
);

Logger.log(
"File ID: " +
file.getId()
);

return {


fileId:
  file.getId(),

file:
  file,

created:
  true


};
}

/* ============================================================

* SHEET - FACTURI
* ============================================================
  */

/**

* Returnează sheet-ul Facturi.
*
* Ordinea:
*
* 1. CONFIG.SPREADSHEET_ID
* 2. CONFIG.DATABASE.SPREADSHEET_ID
* 3. CONFIG.PROPERTY_MANAGER_DB.SPREADSHEET_ID
* 4. active spreadsheet
     */
     function getEngieInvoicesSheet_() {

let spreadsheet =
null;

/* ----------------------------------------------------------

* 1. CONFIG.SPREADSHEET_ID
* ---

*/

if (
typeof CONFIG !== "undefined" &&
CONFIG.SPREADSHEET_ID
) {


const spreadsheetId =
  String(
    CONFIG.SPREADSHEET_ID
  ).trim();

if (spreadsheetId) {

  try {

    spreadsheet =
      SpreadsheetApp.openById(
        spreadsheetId
      );

    Logger.log(
      "ENGIE SHEET: CONFIG.SPREADSHEET_ID"
    );

  } catch (err) {

    Logger.log(
      "CONFIG.SPREADSHEET_ID invalid: " +
      String(err)
    );
  }
}


}

/* ----------------------------------------------------------

* 2. CONFIG.DATABASE.SPREADSHEET_ID
* ---

*/

if (
!spreadsheet &&
typeof CONFIG !== "undefined" &&
CONFIG.DATABASE &&
CONFIG.DATABASE.SPREADSHEET_ID
) {


const spreadsheetId =
  String(
    CONFIG.DATABASE.SPREADSHEET_ID
  ).trim();

if (spreadsheetId) {

  try {

    spreadsheet =
      SpreadsheetApp.openById(
        spreadsheetId
      );

    Logger.log(
      "ENGIE SHEET: CONFIG.DATABASE.SPREADSHEET_ID"
    );

  } catch (err) {

    Logger.log(
      "CONFIG.DATABASE.SPREADSHEET_ID invalid: " +
      String(err)
    );
  }
}


}

/* ----------------------------------------------------------

* 3. CONFIG.PROPERTY_MANAGER_DB
* ---

*/

if (
!spreadsheet &&
typeof CONFIG !== "undefined" &&
CONFIG.PROPERTY_MANAGER_DB &&
CONFIG.PROPERTY_MANAGER_DB.SPREADSHEET_ID
) {


const spreadsheetId =
  String(
    CONFIG.PROPERTY_MANAGER_DB.SPREADSHEET_ID
  ).trim();

if (spreadsheetId) {

  try {

    spreadsheet =
      SpreadsheetApp.openById(
        spreadsheetId
      );

    Logger.log(
      "ENGIE SHEET: CONFIG.PROPERTY_MANAGER_DB.SPREADSHEET_ID"
    );

  } catch (err) {

    Logger.log(
      "PROPERTY_MANAGER_DB.SPREADSHEET_ID invalid: " +
      String(err)
    );
  }
}


}

/* ----------------------------------------------------------

* 4. ACTIVE SPREADSHEET
* ---

*/

if (!spreadsheet) {


try {

  spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (spreadsheet) {

    Logger.log(
      "ENGIE SHEET: Active Spreadsheet"
    );
  }

} catch (err) {

  Logger.log(
    "getActiveSpreadsheet() error: " +
    String(err)
  );
}


}

/* ----------------------------------------------------------

* VALIDARE
* ---

*/

if (!spreadsheet) {

throw new Error(
  "Nu pot identifica spreadsheet-ul pentru Facturi.\n\n" +
  "Configurează unul dintre:\n" +
  "CONFIG.SPREADSHEET_ID\n" +
  "CONFIG.DATABASE.SPREADSHEET_ID\n" +
  "CONFIG.PROPERTY_MANAGER_DB.SPREADSHEET_ID\n\n" +
  "sau rulează scriptul dintr-un Spreadsheet legat."
);


}

Logger.log(
"ENGIE SPREADSHEET: " +
spreadsheet.getName()
);

Logger.log(
"ENGIE SPREADSHEET ID: " +
spreadsheet.getId()
);

const sheet =
spreadsheet.getSheetByName(
"Facturi"
);

if (!sheet) {


throw new Error(
  'Sheet-ul "Facturi" nu există în Spreadsheet-ul "' +
  spreadsheet.getName() +
  '".'
);


}

Logger.log(
'ENGIE SHEET FACTURI OK: "' +
sheet.getName() +
'"'
);

Logger.log(
"Rânduri existente: " +
sheet.getLastRow()
);

Logger.log(
"Coloane existente: " +
sheet.getLastColumn()
);

return sheet;
}

/**

* Normalizează numele unei coloane.
  */
  function normalizeEngieHeader_(
  value
  ) {

return engieString_(
value
)
.toLowerCase()
.replace(
/ă/g,
"a"
)
.replace(
/â/g,
"a"
)
.replace(
/î/g,
"i"
)
.replace(
/ș/g,
"s"
)
.replace(
/ş/g,
"s"
)
.replace(
/ț/g,
"t"
)
.replace(
/ţ/g,
"t"
)
.replace(
/[^a-z0-9]/g,
""
);
}

/**

* Creează mapa coloanelor din Sheet.
  */
  function getEngieSheetHeaders_(
  sheet
  ) {

const lastColumn =
sheet.getLastColumn();

if (
lastColumn < 1
) {


return {};


}

const headers =
sheet
.getRange(
1,
1,
1,
lastColumn
)
.getValues()[0];

const map =
{};

headers.forEach(
function(
header,
index
) {


  const normalized =
    normalizeEngieHeader_(
      header
    );

  if (normalized) {

    map[normalized] =
      index + 1;
  }
}


);

return map;
}

/**

* Găsește coloana folosind mai multe denumiri.
  */
  function findEngieColumn_(
  headerMap,
  names
  ) {

for (
let i = 0;
i < names.length;
i++
) {


const key =
  normalizeEngieHeader_(
    names[i]
  );

if (
  headerMap[key]
) {

  return headerMap[key];
}


}

return 0;
}

/**

* Citește toate rândurile Facturi.
  */
  function getEngieSheetRows_(
  sheet
  ) {

const lastRow =
sheet.getLastRow();

const lastColumn =
sheet.getLastColumn();

if (
lastRow < 2 ||
lastColumn < 1
) {


return [];


}

return sheet
.getRange(
2,
1,
lastRow - 1,
lastColumn
)
.getValues();
}

/**

* Comparare sigură.
  */
  function engieSameValue_(
  a,
  b
  ) {

return (
engieString_(
a
)
.toLowerCase() ===
engieString_(
b
)
.toLowerCase()
);
}

/**

* Caută factura în Sheet.
*
* Cheia principală:
*
* furnizor
* *
* număr factură
* *
* proprietate
*
* PA este verificare suplimentară.
  */
  function findExistingEngieInvoiceRow_(
  sheet,
  invoiceData
  ) {

const headers =
getEngieSheetHeaders_(
sheet
);

const rows =
getEngieSheetRows_(
sheet
);

if (
!rows.length
) {


return null;


}

const colSupplier =
findEngieColumn_(
headers,
[
"Furnizor",
"Supplier"
]
);

const colProperty =
findEngieColumn_(
headers,
[
"Proprietate",
"Property"
]
);

const colInvoiceNumber =
findEngieColumn_(
headers,
[
"NumarFactura",
"NumărFactura",
"Numar Factura",
"InvoiceNumber"
]
);

const colPA =
findEngieColumn_(
headers,
[
"PA",
"Partner",
"CodClient"
]
);

if (
!colInvoiceNumber
) {


Logger.log(
  'ATENȚIE: coloana "NumarFactura" nu există în Facturi.'
);

return null;


}

for (
let i = 0;
i < rows.length;
i++
) {


const row =
  rows[i];

const supplier =
  colSupplier
    ? row[
        colSupplier - 1
      ]
    : "";

const property =
  colProperty
    ? row[
        colProperty - 1
      ]
    : "";

const invoiceNumber =
  row[
    colInvoiceNumber - 1
  ];


if (
  !engieSameValue_(
    supplier,
    invoiceData.furnizor
  )
) {

  continue;
}


if (
  !engieSameValue_(
    property,
    invoiceData.proprietate
  )
) {

  continue;
}


if (
  !engieSameValue_(
    invoiceNumber,
    invoiceData.numarFactura
  )
) {

  continue;
}


if (
  colPA &&
  invoiceData.pa &&
  row[
    colPA - 1
  ]
) {

  if (
    !engieSameValue_(
      row[
        colPA - 1
      ],
      invoiceData.pa
    )
  ) {

    continue;
  }
}


return {

  rowNumber:
    i + 2,

  row:
    row,

  headers:
    headers
};


}

return null;
}

/**

* Scrie/actualizează o factură.
  */
  function saveInvoiceRow_(
  invoiceData
  ) {

if (
!invoiceData ||
typeof invoiceData !== "object"
) {


throw new Error(
  "saveInvoiceRow_: invoiceData invalid."
);


}

const sheet =
getEngieInvoicesSheet_();

const headers =
getEngieSheetHeaders_(
sheet
);

if (
!Object.keys(
headers
).length
) {


throw new Error(
  'Sheet-ul "Facturi" nu are antet pe rândul 1.'
);


}

const existing =
findExistingEngieInvoiceRow_(
sheet,
invoiceData
);

let rowNumber;

if (existing) {


rowNumber =
  existing.rowNumber;

Logger.log(
  "FACTURA EXISTĂ ÎN SHEET: rând " +
  rowNumber
);


} else {


rowNumber =
  sheet.getLastRow() +
  1;

Logger.log(
  "FACTURA NOUĂ ÎN SHEET: rând " +
  rowNumber
);


}

const values =
new Array(
sheet.getLastColumn()
)
.fill("");

function setValue(
names,
value
) {


const column =
  findEngieColumn_(
    headers,
    names
  );

if (!column) {

  return;
}

values[
  column - 1
] =
  value !== undefined &&
  value !== null
    ? value
    : "";


}

setValue(
[
"FileId",
"File ID",
"DriveFileId"
],
invoiceData.fileId
);

setValue(
[
"Proprietate",
"Property"
],
invoiceData.proprietate
);

setValue(
[
"Furnizor",
"Supplier"
],
invoiceData.furnizor
);

setValue(
[
"CodClient",
"Cod Client",
"ClientCode"
],
invoiceData.codClient
);

setValue(
[
"NumarFactura",
"NumărFactura",
"Numar Factura",
"InvoiceNumber"
],
invoiceData.numarFactura
);

setValue(
[
"Perioada",
"Period"
],
invoiceData.perioada
);

setValue(
[
"DataEmitere",
"Data Emitere",
"InvoiceDate"
],
invoiceData.dataEmitere
);

setValue(
[
"DataScadenta",
"Data Scadenta",
"DueDate"
],
invoiceData.dataScadenta
);

setValue(
[
"Suma",
"Total",
"Amount"
],
invoiceData.suma
);

setValue(
[
"Moneda",
"Currency"
],
invoiceData.moneda
);

setValue(
[
"Status"
],
invoiceData.status
);

setValue(
[
"LinkDrive",
"Link Drive",
"DriveLink"
],
invoiceData.linkDrive
);

setValue(
[
"TextOCR",
"Text OCR",
"OCR"
],
invoiceData.textOcr
);

setValue(
[
"POC",
"POC Number"
],
invoiceData.poc
);

setValue(
[
"PA",
"Partner"
],
invoiceData.pa
);

setValue(
[
"ContractAccount",
"Contract Account",
"ContractAccountNumber"
],
invoiceData.contractAccount
);

setValue(
[
"Adresa",
"Address"
],
invoiceData.adresa
);

setValue(
[
"ActualizatLa",
"UpdatedAt",
"DataActualizare"
],
new Date()
);

if (!existing) {


setValue(
  [
    "CreatLa",
    "CreatedAt",
    "DataCreare"
  ],
  new Date()
);


}

sheet
.getRange(
rowNumber,
1,
1,
values.length
)
.setValues(
[values]
);

Logger.log(
"Factură salvată în Sheet."
);

Logger.log(
"Rând: " +
rowNumber
);

Logger.log(
"Număr: " +
invoiceData.numarFactura
);

Logger.log(
"Proprietate: " +
invoiceData.proprietate
);

Logger.log(
"File ID: " +
invoiceData.fileId
);

return {


created:
  !existing,

updated:
  !!existing,

rowNumber:
  rowNumber


};
}

/* ============================================================

* DATA
* ============================================================
  */

/**

* Returnează perioada implicită de import.
*
* Ultimele 365 zile.
  */
  function getEngieImportPeriod_() {

const end =
new Date();

const start =
new Date();

start.setDate(
start.getDate() -
365
);

return {


startDate:
  Utilities.formatDate(
    start,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  ),

endDate:
  Utilities.formatDate(
    end,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  )


};
}

/* ============================================================

* MAPARE PROPRIETATE
* ============================================================
  */

/**

* Construiește mapa PA -> proprietate.
  */
  function getEngieConfiguredPropertyMap_() {

if (
typeof CONFIG === "undefined" ||
!CONFIG.CLIENT_CODE_MAP
) {


return {};


}

return (
CONFIG.CLIENT_CODE_MAP[
"ENGIE"
] ||
{}
);
}

/**

* Determină proprietatea.
*
* Prioritate:
*
* 1. CLIENT_CODE_MAP după PA
* 2. alias ENGIE
* 3. ENGIE - Necunoscuta
     */
     function resolveEngieProperty_(
     place
     ) {

const map =
getEngieConfiguredPropertyMap_();

if (
place &&
place.pa &&
map[
place.pa
]
) {


return map[
  place.pa
];


}

if (
place &&
place.alias
) {


return place.alias;


}

return "ENGIE - Necunoscuta";
}

/* ============================================================

* IMPORT PRINCIPAL
* ============================================================
  */

/**

* IMPORTĂ TOATE FACTURILE ENGIE.
  */
  function importInvoicesDirectFromEngie() {

Logger.log(
"========================================"
);

Logger.log(
"IMPORT FACTURI ENGIE -> GOOGLE DRIVE"
);

Logger.log(
"========================================"
);

/* ----------------------------------------------------------

* 1. CREDENȚIALE
* ---

*/

if (
typeof CONFIG === "undefined" ||
!CONFIG.ENGIE_API
) {


throw new Error(
  "CONFIG.ENGIE_API nu există."
);


}

const email =
CONFIG.ENGIE_API.EMAIL;

const password =
CONFIG.ENGIE_API.PASSWORD;

if (
!email ||
!password
) {


throw new Error(
  "Lipsesc credențialele ENGIE."
);


}

/* ----------------------------------------------------------

* 2. DRIVE
* ---

*/

if (
typeof CONFIG === "undefined" ||
!CONFIG.DRIVE
) {


throw new Error(
  "CONFIG.DRIVE nu există."
);


}

const rootFolderId =
String(
CONFIG.DRIVE.ROOT_FOLDER_ID ||
""
).trim();

if (!rootFolderId) {


throw new Error(
  "CONFIG.DRIVE.ROOT_FOLDER_ID este gol."
);


}

Logger.log(
"ENGIE DRIVE ROOT FOLDER ID: " +
rootFolderId
);

let rootFolder;

try {


rootFolder =
  DriveApp.getFolderById(
    rootFolderId
  );


} catch (err) {

Logger.log(
  "EROARE ACCES ROOT FOLDER:"
);

Logger.log(
  String(err)
);

throw new Error(
  "Nu pot accesa folderul ROOT ENGIE din Google Drive.\n\n" +
  "ROOT_FOLDER_ID: " +
  rootFolderId +
  "\n\n" +
  "Verifică ID-ul folderului și permisiunile contului " +
  "cu care rulează Apps Script."
);

}

Logger.log(
"DRIVE ROOT OK: " +
rootFolder.getName()
);

Logger.log(
"DRIVE ROOT URL: " +
rootFolder.getUrl()
);

/* ----------------------------------------------------------

* 3. LOGIN
* ---

*/

Logger.log(
"Login ENGIE: " +
email
);

const tokens =
loginToEngie(
email,
password
);

const token =
tokens.accessToken;

Logger.log(
"LOGIN OK"
);

Logger.log(
"Token: " +
token.substring(
0,
15
) +
"..."
);

/* ----------------------------------------------------------

* 4. LOCURI DE CONSUM
* ---

*/

Logger.log(
"Obțin locurile de consum ENGIE..."
);

const placesResponse =
getEngiePlacesOfConsumption(
token
);

const rawPlaces =
extractEngiePlaces_(
placesResponse
);

if (
!rawPlaces.length
) {


Logger.log(
  "Nu există locuri de consum ENGIE."
);

return {

  importate:
    0,

  existente:
    0,

  esuate:
    0,

  locatii:
    0
};


}

Logger.log(
"Locuri de consum găsite: " +
rawPlaces.length
);

/* ----------------------------------------------------------

* 5. PERIOADA
* ---

*/

const period =
getEngieImportPeriod_();

Logger.log(
"Perioada: " +
period.startDate +
" -> " +
period.endDate
);

/* ----------------------------------------------------------

* 6. STATISTICĂ
* ---

*/

const stats = {


locatii:
  rawPlaces.length,

locatiiOk:
  0,

locatiiError:
  0,

facturiGasite:
  0,

importate:
  0,

existente:
  0,

actualizate:
  0,

esuate:
  0


};

/* ----------------------------------------------------------

* 7. PARCURGEM LOCURILE
* ---

*/

rawPlaces.forEach(
function(
rawPlace,
index
) {


  Logger.log(
    "----------------------------------------"
  );

  Logger.log(
    "LOC " +
    (index + 1) +
    "/" +
    rawPlaces.length
  );


  const place =
    normalizeEngiePlace_(
      rawPlace
    );


  if (!place) {

    stats.locatiiError++;

    return;
  }


  const property =
    resolveEngieProperty_(
      place
    );


  Logger.log(
    "Proprietate: " +
    property
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


  /* ------------------------------------------------------
   * CONTRACT ACCOUNT
   * ------------------------------------------------------
   */

  if (
    place.contracts.length
  ) {

    place.contracts.forEach(
      function(contract) {

        Logger.log(
          "Contract account: " +
          contract.contractAccountNumber
        );
      }
    );

  } else {

    Logger.log(
      "Nu există contract_account_number."
    );
  }


  /* ------------------------------------------------------
   * VALIDARE PA + POC
   * ------------------------------------------------------
   */

  if (
    !place.pa ||
    !place.poc
  ) {

    Logger.log(
      "LOC INVALID: lipsește PA sau POC."
    );

    stats.locatiiError++;

    return;
  }


  /* ------------------------------------------------------
   * ISTORIC FACTURI
   * ------------------------------------------------------
   */

  let history;


  try {

    history =
      getEngieInvoiceHistory_(
        token,
        place.poc,
        place.pa,
        period.startDate,
        period.endDate
      );

  } catch (err) {

    Logger.log(
      "EROARE HISTORY: " +
      String(err)
    );

    stats.locatiiError++;

    return;
  }


  if (!history) {

    Logger.log(
      "Nu s-a putut obține istoricul."
    );

    stats.locatiiError++;

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


  stats.facturiGasite +=
    invoices.length;

  stats.locatiiOk++;


  /* ------------------------------------------------------
   * FACTURI
   * ------------------------------------------------------
   */

  invoices.forEach(
    function(
      invoice,
      invoiceIndex
    ) {

      try {

        const invoiceNumber =
          engieString_(
            invoice.invoice_number ||
            invoice.invoiceNumber ||
            invoice.number
          ) ||
          "necunoscut_" +
          (invoiceIndex + 1);


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


        Logger.log(
          "Factura: " +
          invoiceNumber
        );

        Logger.log(
          "Data: " +
          invoicedAt
        );

        Logger.log(
          "Scadenta: " +
          dueDate
        );

        Logger.log(
          "Total: " +
          total
        );

        Logger.log(
          "Download value: " +
          (
            downloadValue
              ? "DA"
              : "NU"
          )
        );


        /* ------------------------------------------------
         * FĂRĂ DOWNLOAD
         * ------------------------------------------------
         */

        if (!downloadValue) {

          Logger.log(
            "Factura fără informație de download: " +
            invoiceNumber
          );

          stats.esuate++;

          return;
        }


        /* ------------------------------------------------
         * NUME PDF
         * ------------------------------------------------
         */

        const dateName =
          engieSafeDate_(
            invoicedAt
          ) ||
          "data";


        const propertyName =
          engieSafeName_(
            property
          );


        const fileName =
          "Factura_ENGIE_" +
          engieSafeName_(
            invoiceNumber
          ) +
          "_" +
          dateName +
          "_" +
          propertyName;


        /* ------------------------------------------------
         * FOLDER
         * ------------------------------------------------
         */

        const propertyFolder =
          getEngiePropertyFolder_(
            rootFolder,
            property
          );


        /* ------------------------------------------------
         * 1. VERIFICARE DRIVE
         * ------------------------------------------------
         */

        let existingFile =
          findExistingEngieInvoice_(
            propertyFolder,
            fileName
          );


        /* ------------------------------------------------
         * 2. VERIFICARE SHEET
         * ------------------------------------------------
         */

        const invoiceData = {

          fileId:
            existingFile
              ? existingFile.getId()
              : "",

          proprietate:
            property,

          furnizor:
            "ENGIE",

          codClient:
            place.pa,

          numarFactura:
            invoiceNumber,

          perioada:
            (
              invoicedAt ||
              ""
            ) +
            " - " +
            (
              dueDate ||
              ""
            ),

          dataEmitere:
            invoicedAt,

          dataScadenta:
            dueDate,

          suma:
            total,

          moneda:
            "RON",

          status:
            "Descarcat direct din ENGIE API",

          linkDrive:
            existingFile
              ? existingFile.getUrl()
              : "",

          textOcr:
            "[Descărcare directă ENGIE API - Fără OCR]",

          poc:
            place.poc,

          pa:
            place.pa,

          contractAccount:
            place.contracts.length
              ? place.contracts[0]
                  .contractAccountNumber
              : "",

          adresa:
            place.addressInline
        };


        const sheet =
          getEngieInvoicesSheet_();


        const existingSheet =
          findExistingEngieInvoiceRow_(
            sheet,
            invoiceData
          );


        /* ------------------------------------------------
         * 3. DRIVE EXISTĂ
         * ------------------------------------------------
         */

        if (existingFile) {

          Logger.log(
            "DRIVE: FACTURA EXISTĂ DEJA:"
          );

          Logger.log(
            existingFile.getName()
          );


          stats.existente++;


          if (existingSheet) {

            Logger.log(
              "SHEET: factura există deja."
            );


            /*
             * Verificăm dacă FileId-ul din Sheet
             * este valid.
             */
            const sheetFileIdColumn =
              findEngieColumn_(
                existingSheet.headers,
                [
                  "FileId",
                  "File ID",
                  "DriveFileId"
                ]
              );


            if (
              sheetFileIdColumn
            ) {

              const sheetFileId =
                existingSheet.row[
                  sheetFileIdColumn - 1
                ];


              if (
                !engieSameValue_(
                  sheetFileId,
                  existingFile.getId()
                )
              ) {

                Logger.log(
                  "SHEET: FileId diferit. Actualizez rândul."
                );

                invoiceData.fileId =
                  existingFile.getId();

                invoiceData.linkDrive =
                  existingFile.getUrl();


                const updated =
                  saveInvoiceRow_(
                    invoiceData
                  );


                if (
                  updated.updated
                ) {

                  stats.actualizate++;
                }
              }
            }


            return;
          }


          /*
           * PDF există, Sheet-ul lipsește.
           */
          invoiceData.fileId =
            existingFile.getId();

          invoiceData.linkDrive =
            existingFile.getUrl();


          const savedExisting =
            saveInvoiceRow_(
              invoiceData
            );


          if (
            savedExisting.created
          ) {

            Logger.log(
              "SHEET: rând creat pentru PDF existent."
            );
          }


          return;
        }


        /* ------------------------------------------------
         * 4. EXISTĂ ÎN SHEET DAR NU ÎN DRIVE
         * ------------------------------------------------
         */

        if (existingSheet) {

          Logger.log(
            "SHEET: factura există, dar PDF-ul nu există în Drive."
          );

          Logger.log(
            "Se va încerca din nou download-ul."
          );

          stats.actualizate++;
        }


        /* ------------------------------------------------
         * 5. DOWNLOAD
         * ------------------------------------------------
         */

        Logger.log(
          "Download PDF..."
        );


        const blob =
          downloadEngieInvoicePdf_(
            token,
            downloadValue,
            fileName
          );


        /* ------------------------------------------------
         * 6. SAVE DRIVE
         * ------------------------------------------------
         */

        const saved =
          saveEngiePdfToDrive_(
            blob,
            rootFolder,
            property,
            fileName
          );


        const fileId =
          saved.fileId;


        existingFile =
          saved.file;


        Logger.log(
          "SALVAT DRIVE: " +
          fileId
        );


        /* ------------------------------------------------
         * 7. SHEET
         * ------------------------------------------------
         */

        invoiceData.fileId =
          fileId;

        invoiceData.linkDrive =
          existingFile.getUrl();


        const sheetResult =
          saveInvoiceRow_(
            invoiceData
          );


        if (
          sheetResult.created
        ) {

          Logger.log(
            "SHEET: FACTURĂ ADAUGATĂ."
          );

          stats.importate++;

        } else {

          Logger.log(
            "SHEET: FACTURĂ ACTUALIZATĂ."
          );

          stats.actualizate++;
        }


      } catch (err) {

        Logger.log(
          "EROARE FACTURA " +
          invoiceIndex +
          ": " +
          err
        );

        Logger.log(
          err.stack ||
          ""
        );

        stats.esuate++;
      }

    }
  );

}


);

/* ----------------------------------------------------------

* 8. REZULTAT
* ---

*/

Logger.log(
"========================================"
);

Logger.log(
"REZULTAT IMPORT ENGIE"
);

Logger.log(
"========================================"
);

Logger.log(
"Locații: " +
stats.locatii
);

Logger.log(
"Locații OK: " +
stats.locatiiOk
);

Logger.log(
"Locații eroare: " +
stats.locatiiError
);

Logger.log(
"Facturi găsite: " +
stats.facturiGasite
);

Logger.log(
"Facturi importate: " +
stats.importate
);

Logger.log(
"Facturi existente: " +
stats.existente
);

Logger.log(
"Facturi actualizate: " +
stats.actualizate
);

Logger.log(
"Facturi cu eroare: " +
stats.esuate
);

Logger.log(
"========================================"
);

return stats;
}

/* ============================================================

* TEST LOGIN
* ============================================================
  */

function testEngieConnection() {

  Logger.log("========================================");
  Logger.log("TEST ENGIE LOGIN - DEBUG JWT");
  Logger.log("========================================");

  const email =
    CONFIG.ENGIE_API.EMAIL;

  const password =
    CONFIG.ENGIE_API.PASSWORD;

  const url =
    ENGIE_BASE_URL_ +
    "v1/login";

  const options = {

    method: "post",

    headers:
      getEngieHeaders_(),

    contentType:
      "application/x-www-form-urlencoded",

    payload: {
      username: email,
      password: password
    },

    muteHttpExceptions: true

  };

  const response =
    UrlFetchApp.fetch(
      url,
      options
    );

  const code =
    response.getResponseCode();

  const text =
    response.getContentText();

  Logger.log(
    "LOGIN HTTP: " +
    code
  );

  Logger.log(
    "RESPONSE:"
  );

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (err) {

    Logger.log(
      "Răspunsul nu este JSON:"
    );

    Logger.log(
      text.substring(0, 3000)
    );

    throw err;
  }

  /*
   * NU afișăm tokenul complet.
   */

  const data =
    json &&
    json.data &&
    typeof json.data === "object"
      ? json.data
      : json;

  Logger.log(
    "TOP LEVEL KEYS:"
  );

  Logger.log(
    JSON.stringify(
      Object.keys(json),
      null,
      2
    )
  );

  Logger.log(
    "DATA KEYS:"
  );

  Logger.log(
    JSON.stringify(
      Object.keys(data),
      null,
      2
    )
  );

  Logger.log(
    "TOKEN EXISTS: " +
    !!data.token
  );

  Logger.log(
    "ACCESS_TOKEN EXISTS: " +
    !!data.access_token
  );

  Logger.log(
    "REFRESH_TOKEN EXISTS: " +
    !!data.refresh_token
  );

  Logger.log(
    "ID_TOKEN EXISTS: " +
    !!data.id_token
  );

  const token =
    data.token ||
    data.access_token ||
    "";

  if (!token) {

    throw new Error(
      "Nu există token în răspuns."
    );

  }

  Logger.log(
    "TOKEN LENGTH: " +
    String(token).length
  );

  Logger.log(
    "TOKEN START: " +
    String(token).substring(0, 30)
  );

  Logger.log(
    "TOKEN END: " +
    String(token).substring(
      Math.max(
        0,
        String(token).length - 20
      )
    )
  );

  /*
   * Decodăm DOAR header + payload JWT.
   * Nu afișăm semnătura.
   */

  const parts =
    String(token).split(".");

  Logger.log(
    "JWT PARTS: " +
    parts.length
  );

  if (parts.length === 3) {

    try {

      const header =
        JSON.parse(
          Utilities
            .newBlob(
              Utilities
                .base64DecodeWebSafe(
                  parts[0]
                )
            )
            .getDataAsString()
        );

      Logger.log(
        "JWT HEADER:"
      );

      Logger.log(
        JSON.stringify(
          header,
          null,
          2
        )
      );

    } catch (err) {

      Logger.log(
        "Nu pot decoda JWT header."
      );

    }

    try {

      const payload =
        JSON.parse(
          Utilities
            .newBlob(
              Utilities
                .base64DecodeWebSafe(
                  parts[1]
                )
            )
            .getDataAsString()
        );

      /*
       * Eliminăm câmpuri care pot conține
       * informații sensibile.
       */

      const safePayload = {};

      [
        "iss",
        "sub",
        "aud",
        "exp",
        "iat",
        "nbf",
        "scope",
        "scp",
        "azp",
        "client_id",
        "clientId",
        "token_type"
      ].forEach(
        function(key) {

          if (
            payload[key] !== undefined
          ) {

            safePayload[key] =
              payload[key];

          }

        }
      );

      Logger.log(
        "JWT SAFE PAYLOAD:"
      );

      Logger.log(
        JSON.stringify(
          safePayload,
          null,
          2
        )
      );

    } catch (err) {

      Logger.log(
        "Nu pot decoda JWT payload."
      );

    }

  } else {

    Logger.log(
      "Tokenul NU are format JWT standard."
    );

  }

  Logger.log(
    "========================================"
  );

  Logger.log(
    "TEST LOGIN DEBUG TERMINAT"
  );

  Logger.log(
    "========================================"
  );
}

/* ============================================================

* TEST PLACES OF CONSUMPTION
* ============================================================
  */

function testEngiePlacesOfConsumption() {

Logger.log(
"========================================"
);

Logger.log(
"TEST ENGIE - PLACES OF CONSUMPTION"
);

Logger.log(
"========================================"
);

if (
typeof CONFIG === "undefined" ||
!CONFIG.ENGIE_API
) {


throw new Error(
  "CONFIG.ENGIE_API nu există."
);


}

const tokens =
loginToEngie(
CONFIG.ENGIE_API.EMAIL,
CONFIG.ENGIE_API.PASSWORD
);

Logger.log(
"LOGIN OK"
);

const response =
getEngiePlacesOfConsumption(
tokens.accessToken
);

const places =
extractEngiePlaces_(
response
);

Logger.log(
"========================================"
);

Logger.log(
"LOCAȚII GĂSITE: " +
places.length
);

Logger.log(
"========================================"
);

places.forEach(
function(
rawPlace,
index
) {


  const place =
    normalizeEngiePlace_(
      rawPlace
    );


  Logger.log(
    "----------------------------------------"
  );

  Logger.log(
    "LOC: " +
    (index + 1)
  );

  Logger.log(
    "Alias: " +
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


  place.contracts.forEach(
    function(contract) {

      Logger.log(
        "Contract account: " +
        contract.contractAccountNumber
      );
    }
  );

}


);

Logger.log(
"========================================"
);
}

/* ============================================================

* TEST ISTORIC FACTURI
* ============================================================
  */

function testEngieInvoiceHistory() {

Logger.log(
"========================================"
);

Logger.log(
"TEST ENGIE - ISTORIC FACTURI"
);

Logger.log(
"========================================"
);

if (
typeof CONFIG === "undefined" ||
!CONFIG.ENGIE_API
) {


throw new Error(
  "CONFIG.ENGIE_API nu există."
);


}

const tokens =
loginToEngie(
CONFIG.ENGIE_API.EMAIL,
CONFIG.ENGIE_API.PASSWORD
);

const response =
getEngiePlacesOfConsumption(
tokens.accessToken
);

const places =
extractEngiePlaces_(
response
);

const period =
getEngieImportPeriod_();

places.forEach(
function(
rawPlace,
index
) {


  const place =
    normalizeEngiePlace_(
      rawPlace
    );


  Logger.log(
    "----------------------------------------"
  );

  Logger.log(
    "LOC " +
    (index + 1) +
    ": " +
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


  if (
    !place.pa ||
    !place.poc
  ) {

    Logger.log(
      "SKIP: PA sau POC lipsă."
    );

    return;
  }


  const history =
    getEngieInvoiceHistory_(
      tokens.accessToken,
      place.poc,
      place.pa,
      period.startDate,
      period.endDate
    );


  const invoices =
    extractEngieInvoices_(
      history
    );


  Logger.log(
    "FACTURI: " +
    invoices.length
  );


  invoices.forEach(
    function(invoice) {

      Logger.log(
        "Factura: " +
        (
          invoice.invoice_number ||
          invoice.invoiceNumber ||
          invoice.number ||
          "?"
        )
      );


      Logger.log(
        "Data: " +
        (
          invoice.invoiced_at ||
          invoice.invoice_date ||
          invoice.invoiceDate ||
          ""
        )
      );


      Logger.log(
        "Total: " +
        (
          invoice.total !== undefined
            ? invoice.total
            : (
                invoice.amount !== undefined
                  ? invoice.amount
                  : ""
              )
        )
      );


      Logger.log(
        "Download value: " +
        (
          getEngieInvoiceDownloadValue_(
            invoice
          ) ||
          "LIPSEȘTE"
        )
      );

    }
  );

}


);

Logger.log(
"========================================"
);

Logger.log(
"TEST TERMINAT"
);

Logger.log(
"========================================"
);
}

/* ============================================================

* TEST IMPORT COMPLET
* ============================================================
  */

function testEngieFullImport() {

Logger.log(
"========================================"
);

Logger.log(
"TEST IMPORT COMPLET ENGIE"
);

Logger.log(
"========================================"
);

const result =
importInvoicesDirectFromEngie();

Logger.log(
"========================================"
);

Logger.log(
"REZULTAT:"
);

Logger.log(
JSON.stringify(
result,
null,
2
)
);

Logger.log(
"========================================"
);
}

/* ============================================================

* TEST HISTORY DIN PLACES
* ============================================================
  */

function testEngieInvoiceHistoryFromPlaces() {

Logger.log(
"========================================"
);

Logger.log(
"TEST ENGIE - ISTORIC FACTURI"
);

Logger.log(
"========================================"
);

if (
typeof CONFIG === "undefined" ||
!CONFIG.ENGIE_API
) {


throw new Error(
  "CONFIG.ENGIE_API nu există."
);


}

const email =
CONFIG.ENGIE_API.EMAIL;

const password =
CONFIG.ENGIE_API.PASSWORD;

if (
!email ||
!password
) {


throw new Error(
  "Lipsesc credențialele ENGIE."
);


}

const tokens =
loginToEngie(
email,
password
);

if (
!tokens ||
!tokens.accessToken
) {


throw new Error(
  "Login ENGIE fără access token."
);


}

Logger.log(
"LOGIN OK"
);

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

if (
!rawPlaces.length
) {


throw new Error(
  "ENGIE nu a returnat locuri de consum."
);


}

const period =
getEngieImportPeriod_();

Logger.log(
"Perioada: " +
period.startDate +
" -> " +
period.endDate
);

rawPlaces.forEach(
function(
rawPlace,
index
) {


  Logger.log("");

  Logger.log(
    "----------------------------------------"
  );

  Logger.log(
    "LOC " +
    (index + 1) +
    "/" +
    rawPlaces.length
  );

  Logger.log(
    "----------------------------------------"
  );


  const place =
    normalizeEngiePlace_(
      rawPlace
    );


  if (!place) {

    Logger.log(
      "SKIP: loc invalid."
    );

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


  if (
    place.contracts.length
  ) {

    place.contracts.forEach(
      function(contract) {

        Logger.log(
          "Contract: " +
          contract.contractAccountNumber
        );
      }
    );

  } else {

    Logger.log(
      "Contract: LIPSEȘTE"
    );
  }


  if (
    !place.pa ||
    !place.poc
  ) {

    Logger.log(
      "SKIP: PA sau POC lipsă."
    );

    return;
  }


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


    Logger.log(
      "ISTORIC OK"
    );


    const invoices =
      extractEngieInvoices_(
        history
      );


    Logger.log(
      "FACTURI IDENTIFICATE: " +
      invoices.length
    );


    invoices.forEach(
      function(
        invoice,
        invoiceIndex
      ) {

        const invoiceNumber =
          engieString_(
            invoice.invoice_number ||
            invoice.invoiceNumber ||
            invoice.number
          );


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


        Logger.log("");

        Logger.log(
          "FACTURA #" +
          (invoiceIndex + 1)
        );

        Logger.log(
          "Număr: " +
          invoiceNumber
        );

        Logger.log(
          "Emisă: " +
          invoicedAt
        );

        Logger.log(
          "Scadență: " +
          dueDate
        );

        Logger.log(
          "Total: " +
          total
        );

        Logger.log(
          "Download value: " +
          (
            downloadValue
              ? "DA"
              : "NU"
          )
        );

        Logger.log(
          "Division: " +
          (
            invoice.division ||
            ""
          )
        );

        Logger.log(
          "Consumption: " +
          (
            invoice.energy_consumption ||
            ""
          )
        );

        Logger.log(
          "Quantity: " +
          (
            invoice.quantity !== undefined
              ? invoice.quantity
              : ""
          )
        );

        Logger.log(
          "Unpaid: " +
          (
            invoice.unpaid !== undefined
              ? invoice.unpaid
              : ""
          )
        );
      }
    );

  } catch (err) {

    Logger.log(
      "EROARE ISTORIC: " +
      err
    );
  }
}


);

Logger.log("");

Logger.log(
"========================================"
);

Logger.log(
"TEST TERMINAT"
);

Logger.log(
"========================================"
);
}

/* ============================================================

* TEST DOWNLOAD PDF - O SINGURĂ FACTURĂ
* ============================================================
  */

function testEngieInvoicePdfDownload() {

Logger.log(
"========================================"
);

Logger.log(
"TEST ENGIE - DOWNLOAD PDF"
);

Logger.log(
"========================================"
);

if (
typeof CONFIG === "undefined" ||
!CONFIG.ENGIE_API
) {


throw new Error(
  "CONFIG.ENGIE_API nu există."
);


}

const email =
CONFIG.ENGIE_API.EMAIL;

const password =
CONFIG.ENGIE_API.PASSWORD;

if (
!email ||
!password
) {


throw new Error(
  "Lipsesc credențialele ENGIE."
);


}

Logger.log(
"Login ENGIE: " +
email
);

const tokens =
loginToEngie(
email,
password
);

if (
!tokens ||
!tokens.accessToken
) {


throw new Error(
  "Login ENGIE fără access token."
);


}

Logger.log(
"LOGIN OK"
);

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

if (
!rawPlaces.length
) {


throw new Error(
  "ENGIE nu a returnat locuri de consum."
);


}

let selectedPlace =
null;

for (
let i = 0;
i < rawPlaces.length;
i++
) {


const place =
  normalizeEngiePlace_(
    rawPlaces[i]
  );


if (
  place &&
  place.pa &&
  place.poc
) {

  selectedPlace =
    place;

  break;
}


}

if (!selectedPlace) {


throw new Error(
  "Nu am găsit niciun loc valid cu PA + POC."
);


}

Logger.log("");

Logger.log(
"----------------------------------------"
);

Logger.log(
"LOC SELECTAT"
);

Logger.log(
"----------------------------------------"
);

Logger.log(
"Proprietate: " +
selectedPlace.alias
);

Logger.log(
"PA: " +
selectedPlace.pa
);

Logger.log(
"POC: " +
selectedPlace.poc
);

Logger.log(
"Adresă: " +
selectedPlace.addressInline
);

const period =
getEngieImportPeriod_();

Logger.log(
"Perioada: " +
period.startDate +
" -> " +
period.endDate
);

const history =
getEngieInvoiceHistory_(
tokens.accessToken,
selectedPlace.poc,
selectedPlace.pa,
period.startDate,
period.endDate
);

if (!history) {


throw new Error(
  "Istoricul ENGIE este gol."
);


}


if (
!invoices.length
) {


throw new Error(
  "Nu există facturi pentru locul selectat."
);


}

let selectedInvoice =
null;

let selectedDownloadValue =
"";

for (
let i = 0;
i < invoices.length;
i++
) {


const invoice =
  invoices[i];


const downloadValue =
  getEngieInvoiceDownloadValue_(
    invoice
  );


if (downloadValue) {

  selectedInvoice =
    invoice;

  selectedDownloadValue =
    downloadValue;

  break;
}


}

if (
!selectedInvoice ||
!selectedDownloadValue
) {


throw new Error(
  "Nicio factură nu are informație de download."
);


}

const invoiceNumber =
engieString_(
selectedInvoice.invoice_number ||
selectedInvoice.invoiceNumber ||
selectedInvoice.number
);

const invoicedAt =
engieString_(
selectedInvoice.invoiced_at ||
selectedInvoice.invoice_date ||
selectedInvoice.invoiceDate
);

const dueDate =
engieString_(
selectedInvoice.due_date ||
selectedInvoice.dueDate
);

const total =
selectedInvoice.total !== undefined
? selectedInvoice.total
: (
selectedInvoice.amount !== undefined
? selectedInvoice.amount
: ""
);

Logger.log(
"Număr factură: " +
invoiceNumber
);

Logger.log(
"Data emitere: " +
invoicedAt
);

Logger.log(
"Scadență: " +
dueDate
);

Logger.log(
"Total: " +
total
);

Logger.log(
"Download value: " +
selectedDownloadValue
);

const fileName =
"TEST_ENGIE_" +
engieSafeName_(
invoiceNumber ||
"factura"
) +
"*" +
engieSafeDate_(
invoicedAt
);

Logger.log(
"Nume PDF: " +
fileName +
".pdf"
);

Logger.log(
"Încep download PDF..."
);

const blob =
downloadEngieInvoicePdf_(
tokens.accessToken,
selectedDownloadValue,
fileName
);

if (!blob) {


throw new Error(
  "ENGIE nu a returnat blob."
);


}

const bytes =
blob.getBytes();

Logger.log(
"Nume: " +
blob.getName()
);

Logger.log(
"Content-Type: " +
blob.getContentType()
);

Logger.log(
"Dimensiune: " +
bytes.length +
" bytes"
);

if (
bytes.length < 4 ||
bytes[0] !== 37 ||
bytes[1] !== 80 ||
bytes[2] !== 68 ||
bytes[3] !== 70
) {


throw new Error(
  "Fișierul descărcat NU începe cu %PDF."
);


}

Logger.log(
"PDF VALID: %PDF"
);

Logger.log(
"========================================"
);

Logger.log(
"DOWNLOAD PDF REUȘIT"
);

Logger.log(
"========================================"
);
}

/* ============================================================

* TEST DRIVE
* ============================================================
  */

function testEngieDriveAccess() {

Logger.log(
"========================================"
);

Logger.log(
"TEST ENGIE DRIVE ACCESS"
);

Logger.log(
"========================================"
);

if (
typeof CONFIG === "undefined" ||
!CONFIG.DRIVE
) {


throw new Error(
  "CONFIG.DRIVE nu există."
);


}

const folderId =
String(
CONFIG.DRIVE.ROOT_FOLDER_ID ||
""
).trim();

Logger.log(
"ROOT_FOLDER_ID: " +
folderId
);

if (!folderId) {


throw new Error(
  "ROOT_FOLDER_ID este gol."
);


}

let folder;

try {


folder =
  DriveApp.getFolderById(
    folderId
  );


} catch (err) {


Logger.log(
  "DriveApp ERROR:"
);

Logger.log(
  String(err)
);

throw err;


}

Logger.log(
"Folder găsit: " +
folder.getName()
);

Logger.log(
"Folder ID: " +
folder.getId()
);

Logger.log(
"Folder URL: " +
folder.getUrl()
);

Logger.log(
"========================================"
);

Logger.log(
"DRIVE ACCESS OK"
);

Logger.log(
"========================================"
);
}

/* ============================================================

* TEST SHEET
* ============================================================
  */

function testEngieInvoicesSheet() {

Logger.log(
"========================================"
);

Logger.log(
"TEST ENGIE SHEET FACTURI"
);

Logger.log(
"========================================"
);

const sheet =
getEngieInvoicesSheet_();

Logger.log(
"Spreadsheet: " +
sheet
.getParent()
.getName()
);

Logger.log(
"Spreadsheet ID: " +
sheet
.getParent()
.getId()
);

Logger.log(
"Sheet: " +
sheet.getName()
);

Logger.log(
"Rows: " +
sheet.getLastRow()
);

Logger.log(
"Columns: " +
sheet.getLastColumn()
);

Logger.log(
"========================================"
);

Logger.log(
"TEST OK"
);

Logger.log(
"========================================"
);
}

/* ============================================================

* TEST COMPLET COMPONENTE
* ============================================================
  */

function testEngieAllComponents() {

Logger.log(
"========================================"
);

Logger.log(
"TEST ENGIE - TOATE COMPONENTELE"
);

Logger.log(
"========================================"
);
function testEngiePlacesJwtDebug() {

  Logger.log("========================================");
  Logger.log("TEST ENGIE - JWT -> PLACES DEBUG");
  Logger.log("========================================");

  const email =
    CONFIG.ENGIE_API.EMAIL;

  const password =
    CONFIG.ENGIE_API.PASSWORD;

  const tokens =
    loginToEngie(
      email,
      password
    );

  const token =
    tokens.accessToken;

  if (!token) {
    throw new Error(
      "Nu există access token."
    );
  }

  Logger.log(
    "LOGIN OK"
  );

  Logger.log(
    "JWT length: " +
    String(token).length
  );

  const url =
    ENGIE_BASE_URL_ +
    "v1/placesofconsumption";

  Logger.log(
    "URL:"
  );

  Logger.log(
    url
  );

  /*
   * Construim manual headerele.
   */

  const headers = {

    "Accept":
      "application/json",

    "Authorization":
      "Bearer " + token,

    "source":
      "android",

    "App-Version":
      "2.1.15",

    "App-Build":
      "181",

    "OS-Version":
      "13",

    "OS-Platform":
      "Android",

    "Device-Type":
      "phone",

    "Device-Manufacturer":
      "Google",

    "Device-Model":
      "Pixel 7 Pro",

    "Screen-Height":
      "2400",

    "Screen-Width":
      "1080",

    "Device-Id":
      "f7d7301c-6d84-4860-9154-0824b2bb74b9",

    "User-Agent":
      "MyENGIE/2.1.15(181) Dalvik/2.1.0 " +
      "(Linux; U; Android 13; Pixel 7 Pro Build/TQ2A.230305.008.C1)"

  };

  Logger.log(
    "HEADERS:"
  );

  /*
   * Nu afișăm Authorization.
   */

  const safeHeaders =
    Object.assign(
      {},
      headers
    );

  safeHeaders.Authorization =
    "Bearer <JWT>";

  Logger.log(
    JSON.stringify(
      safeHeaders,
      null,
      2
    )
  );

  Logger.log(
    "TRIMIT REQUEST..."
  );

  const response =
    UrlFetchApp.fetch(
      url,
      {
        method:
          "get",

        headers:
          headers,

        muteHttpExceptions:
          true,

        followRedirects:
          true
      }
    );

  const code =
    response.getResponseCode();

  const responseHeaders =
    response.getAllHeaders();

  const text =
    response.getContentText();

  Logger.log(
    "HTTP CODE: " +
    code
  );

  Logger.log(
    "RESPONSE HEADERS:"
  );

  Logger.log(
    JSON.stringify(
      responseHeaders,
      null,
      2
    )
  );

  Logger.log(
    "RESPONSE:"
  );

  Logger.log(
    text.substring(
      0,
      5000
    )
  );

  Logger.log(
    "========================================"
  );

  if (code === 200) {

    Logger.log(
      "PLACES OF CONSUMPTION OK"
    );

  } else {

    Logger.log(
      "PLACES OF CONSUMPTION FAILED"
    );

  }

  Logger.log(
    "========================================"
  );
}

function testEngieConnection() {

  Logger.log("========================================");
  Logger.log("TEST 1 - ENGIE LOGIN");
  Logger.log("========================================");

  if (
    typeof CONFIG === "undefined" ||
    !CONFIG.ENGIE_API
  ) {
    throw new Error("CONFIG.ENGIE_API nu există.");
  }

  const email = CONFIG.ENGIE_API.EMAIL;
  const password = CONFIG.ENGIE_API.PASSWORD;

  Logger.log("EMAIL: " + email);
  Logger.log("PASSWORD: configurată = " + (!!password));

  if (!email || !password) {
    throw new Error("Lipsesc credențialele ENGIE.");
  }

  const url =
    ENGIE_BASE_URL_ +
    "v1/login";

  Logger.log("URL:");
  Logger.log(url);

  const payload = {
    username: email,
    password: password
  };

  const options = {

    method: "post",

    headers: getEngieHeaders_(),

    contentType:
      "application/x-www-form-urlencoded",

    payload: payload,

    muteHttpExceptions: true

  };

  Logger.log("Trimit request LOGIN...");

  const response =
    UrlFetchApp.fetch(
      url,
      options
    );

  const code =
    response.getResponseCode();

  const text =
    response.getContentText();

  Logger.log("HTTP CODE: " + code);

  Logger.log("CONTENT TYPE: " +
    response.getHeaders()["Content-Type"]);

  Logger.log("RESPONSE:");

  Logger.log(
    text.substring(
      0,
      5000
    )
  );

  Logger.log("========================================");

  if (code < 200 || code >= 300) {

    throw new Error(
      "LOGIN ENGIE a eșuat. HTTP " +
      code
    );

  }

  let json;

  try {

    json =
      JSON.parse(text);

  } catch (err) {

    throw new Error(
      "LOGIN a răspuns cu HTTP " +
      code +
      ", dar răspunsul NU este JSON."
    );

  }

  Logger.log("JSON LOGIN:");

  Logger.log(
    JSON.stringify(
      json,
      null,
      2
    )
  );

  const data =
    json &&
    json.data &&
    typeof json.data === "object"
      ? json.data
      : json;

  const token =
    data.token ||
    data.access_token;

  if (!token) {

    throw new Error(
      "LOGIN HTTP OK, dar NU există token."
    );

  }

  Logger.log("LOGIN OK.");
  Logger.log(
    "TOKEN PRIMELE 20 CARACTERE: " +
    String(token).substring(0, 20)
  );

  Logger.log("========================================");
}

testEngieInvoiceHistoryFromPlaces();

Logger.log(
"HISTORY OK"
);

testEngieDriveAccess();

Logger.log(
"DRIVE OK"
);

Logger.log(
"SHEET OK"
);

Logger.log(
"========================================"
);

Logger.log(
"TOATE TESTELE COMPONENTELOR AU FOST EXECUTATE"
);

Logger.log(
"========================================"
);
}


  Logger.log("========================================");
  Logger.log("TEST ENGIE SHEET FACTURI");
  Logger.log("========================================");
  function testEngieHistorySinglePlace() {

  Logger.log("========================================");
  Logger.log("TEST ENGIE - HISTORY O SINGURĂ LOCAȚIE");
  Logger.log("========================================");

  if (
    typeof CONFIG === "undefined" ||
    !CONFIG.ENGIE_API
  ) {
    throw new Error("CONFIG.ENGIE_API nu există.");
  }

  // 1. LOGIN
  const tokens =
    loginToEngie(
      CONFIG.ENGIE_API.EMAIL,
      CONFIG.ENGIE_API.PASSWORD
    );

  if (!tokens || !tokens.accessToken) {
    throw new Error("Login ENGIE fără access token.");
  }

  Logger.log("LOGIN OK");

  // 2. PLACES
  const placesResponse =
    getEngiePlacesOfConsumption(
      tokens.accessToken
    );

  const rawPlaces =
    extractEngiePlaces_(
      placesResponse
    );

  if (!rawPlaces.length) {
    throw new Error(
      "ENGIE nu a returnat locuri de consum."
    );
  }

  // 3. PRIMA LOCAȚIE VALIDĂ
  let selectedPlace = null;

  for (
    let i = 0;
    i < rawPlaces.length;
    i++
  ) {

    const place =
      normalizeEngiePlace_(
        rawPlaces[i]
      );

    if (
      place &&
      place.pa &&
      place.poc
    ) {
      selectedPlace = place;
      break;
    }
  }

  if (!selectedPlace) {
    throw new Error(
      "Nu există nicio locație cu PA + POC."
    );
  }

  Logger.log("----------------------------------------");
  Logger.log("LOCAȚIE SELECTATĂ");
  Logger.log("----------------------------------------");

  Logger.log(
    "Alias: " +
    selectedPlace.alias
  );

  Logger.log(
    "PA: " +
    selectedPlace.pa
  );

  Logger.log(
    "POC: " +
    selectedPlace.poc
  );

  Logger.log(
    "Adresă: " +
    selectedPlace.addressInline
  );

  if (
    selectedPlace.contracts &&
    selectedPlace.contracts.length
  ) {

    selectedPlace.contracts.forEach(
      function(contract) {

        Logger.log(
          "Contract account: " +
          contract.contractAccountNumber
        );

      }
    );

  }

  // 4. PERIOADA
  const period =
    getEngieImportPeriod_();

  Logger.log("----------------------------------------");
  Logger.log("PERIOADA");
  Logger.log("----------------------------------------");

  Logger.log(
    "Start: " +
    period.startDate
  );

  Logger.log(
    "End: " +
    period.endDate
  );

  // 5. HISTORY
  Logger.log("----------------------------------------");
  Logger.log("REQUEST HISTORY");
  Logger.log("----------------------------------------");

  const history =
    getEngieInvoiceHistory_(
      tokens.accessToken,
      selectedPlace.poc,
      selectedPlace.pa,
      period.startDate,
      period.endDate
    );

  if (!history) {
    throw new Error(
      "History a returnat răspuns gol."
    );
  }

  Logger.log("HISTORY HTTP OK");

  // 6. AFIȘĂM STRUCTURA REALĂ
  Logger.log("----------------------------------------");
  Logger.log("HISTORY RAW");
  Logger.log("----------------------------------------");

  Logger.log(
    JSON.stringify(
      history,
      null,
      2
    ).substring(
      0,
      20000
    )
  );

  // 7. EXTRAGEM FACTURILE
  const invoices =
    extractEngieInvoices_(
      history
    );

  Logger.log("----------------------------------------");
  Logger.log(
    "FACTURI IDENTIFICATE: " +
    invoices.length
  );
  Logger.log("----------------------------------------");

  invoices.forEach(
    function(invoice, index) {

      Logger.log("");
      Logger.log(
        "FACTURA #" +
        (index + 1)
      );

      Logger.log(
        JSON.stringify(
          invoice,
          null,
          2
        )
      );

    }
  );

  Logger.log("----------------------------------------");
  Logger.log("TEST HISTORY TERMINAT");
  Logger.log("----------------------------------------");
}