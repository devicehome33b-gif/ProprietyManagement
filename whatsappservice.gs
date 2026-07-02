/**
 * Serviciu WhatsApp - Integrare cu Twilio
 * Trimite notificări cu cheltuielile pe WhatsApp
 */

// Configurare Twilio (salvează-ți credențialele în PropertyService)
const TWILIO_CONFIG_KEYS = {
  ACCOUNT_SID: 'TWILIO_ACCOUNT_SID',
  AUTH_TOKEN: 'TWILIO_AUTH_TOKEN',
  FROM_NUMBER: 'TWILIO_FROM_NUMBER',
  TO_NUMBER: 'TWILIO_TO_NUMBER',
  AUTO_SEND: 'TWILIO_AUTO_SEND',
  AUTO_SEND_TIME: 'TWILIO_AUTO_SEND_TIME'
};

/**
 * Salvează configurare Twilio în PropertyService
 */
function saveTwilioConfig(accountSid, authToken, fromNumber, toNumber, autoSend, autoSendTime) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty(TWILIO_CONFIG_KEYS.ACCOUNT_SID, accountSid);
    userProperties.setProperty(TWILIO_CONFIG_KEYS.AUTH_TOKEN, authToken);
    userProperties.setProperty(TWILIO_CONFIG_KEYS.FROM_NUMBER, fromNumber);
    userProperties.setProperty(TWILIO_CONFIG_KEYS.TO_NUMBER, toNumber);
    userProperties.setProperty(TWILIO_CONFIG_KEYS.AUTO_SEND, autoSend ? 'true' : 'false');
    userProperties.setProperty(TWILIO_CONFIG_KEYS.AUTO_SEND_TIME, autoSendTime);
    
    Logger.log("Twilio config salvat cu succes");
    return { success: true, message: "Configurare salvată" };
  } catch (error) {
    Logger.log("Eroare salvare Twilio config: " + error.toString());
    throw new Error("Eroare la salvare configurare: " + error.message);
  }
}

/**
 * Obține configurare Twilio
 */
function getTwilioConfig() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    return {
      accountSid: userProperties.getProperty(TWILIO_CONFIG_KEYS.ACCOUNT_SID),
      authToken: userProperties.getProperty(TWILIO_CONFIG_KEYS.AUTH_TOKEN),
      fromNumber: userProperties.getProperty(TWILIO_CONFIG_KEYS.FROM_NUMBER),
      toNumber: userProperties.getProperty(TWILIO_CONFIG_KEYS.TO_NUMBER),
      autoSend: userProperties.getProperty(TWILIO_CONFIG_KEYS.AUTO_SEND) === 'true',
      autoSendTime: userProperties.getProperty(TWILIO_CONFIG_KEYS.AUTO_SEND_TIME)
    };
  } catch (error) {
    Logger.log("Eroare preluare Twilio config: " + error.toString());
    return null;
  }
}

/**
 * Trimite mesaj WhatsApp cu total cheltuieli
 */
function sendWhatsAppMessage(message) {
  try {
    const config = getTwilioConfig();
    
    if (!config || !config.accountSid || !config.authToken) {
      throw new Error("Configurare Twilio lipsește! Merge la Setări > WhatsApp.");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    
    const payload = {
      From: `whatsapp:${config.fromNumber}`,
      To: `whatsapp:${config.toNumber}`,
      Body: message
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(config.accountSid + ':' + config.authToken)
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 201) {
      Logger.log("Mesaj WhatsApp trimis cu succes: " + result.sid);
      return { success: true, messageSid: result.sid };
    } else {
      Logger.log("Eroare Twilio: " + response.getContentText());
      throw new Error("Twilio API error: " + result.message);
    }
  } catch (error) {
    Logger.log("Eroare trimitere WhatsApp: " + error.toString());
    throw new Error("Eroare la trimitere: " + error.message);
  }
}

/**
 * Genereaza mesaj cu rezumat zilnic al cheltuielilor
 */
function generateDailySummaryMessage() {
  try {
    const utilities = getUtilities();
    const invoices = getInvoices();
    const locationTotals = getTotalByLocation();

    let totalUtilities = 0;
    utilities.forEach(u => totalUtilities += parseFloat(u.valoare) || 0);

    let totalInvoices = 0;
    invoices.forEach(i => totalInvoices += parseFloat(i.valoare) || 0);

    const today = new Date().toLocaleDateString('ro-RO');
    
    let message = `📊 *Raport Zilnic Cheltuieli*\n`;
    message += `Data: ${today}\n\n`;
    
    message += `💰 *TOTALE*:\n`;
    message += `• Utilități: ${totalUtilities.toFixed(2)} RON\n`;
    message += `• Facturi: ${totalInvoices.toFixed(2)} RON\n`;
    message += `• TOTAL GENERAL: ${(totalUtilities + totalInvoices).toFixed(2)} RON\n\n`;

    message += `📍 *CHELTUIELI PER LOCAȚIE*:\n`;
    Object.keys(locationTotals).sort().forEach(loc => {
      message += `• ${loc}: ${locationTotals[loc].toFixed(2)} RON\n`;
    });

    message += `\n⏰ Generat automat de Property Manager`;

    return message;
  } catch (error) {
    Logger.log("Eroare generare mesaj: " + error.toString());
    return "Eroare la generarea raportului.";
  }
}

/**
 * Trimite raport zilnic
 */
function sendDailyReport() {
  try {
    const config = getTwilioConfig();
    
    if (!config || !config.autoSend) {
      Logger.log("Raportul zilnic este dezactivat");
      return;
    }

    const message = generateDailySummaryMessage();
    const result = sendWhatsAppMessage(message);
    
    Logger.log("Raport zilnic trimis cu succes");
    return result;
  } catch (error) {
    Logger.log("Eroare trimitere raport zilnic: " + error.toString());
  }
}

/**
 * Trimite notificare când se adaugă o nouă factură de utilitate
 */
function notifyNewUtility(utilityData) {
  try {
    const config = getTwilioConfig();
    
    if (!config || !config.accountSid) {
      Logger.log("Notificări WhatsApp dezactivate");
      return;
    }

    const date = new Date(utilityData.data_factura).toLocaleDateString('ro-RO');
    const message = `🔔 *Nouă Factură Utilitate*\n\n` +
      `📍 Locație: ${utilityData.locatie}\n` +
      `💧 Tip: ${utilityData.tip_utilitate}\n` +
      `💰 Valoare: ${parseFloat(utilityData.valoare).toFixed(2)} RON\n` +
      `📅 Data: ${date}\n` +
      `Perioada: ${utilityData.perioada}\n` +
      `Furnizor: ${utilityData.furnizor || 'N/A'}\n\n` +
      `Status: ${utilityData.status}`;

    return sendWhatsAppMessage(message);
  } catch (error) {
    Logger.log("Eroare notificare utilitate: " + error.toString());
    return null;
  }
}

/**
 * Testează conexiune Twilio
 */
function testTwilioConnection() {
  try {
    const config = getTwilioConfig();
    
    if (!config || !config.accountSid || !config.authToken) {
      return { success: false, message: "Configurare Twilio lipsește" };
    }

    const testMessage = "🧪 Test Conexiune Property Manager - Dacă primești acest mesaj, totul funcționează corect!";
    const result = sendWhatsAppMessage(testMessage);
    
    return { success: true, message: "Mesaj test trimis cu succes!", messageSid: result.messageSid };
  } catch (error) {
    Logger.log("Eroare test Twilio: " + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Programează trimiterea raportului zilnic
 */
function scheduleAutomaticDailyReport() {
  try {
    const config = getTwilioConfig();
    
    if (!config || !config.autoSend) {
      Logger.log("Raportul zilnic nu este activat");
      return;
    }

    // Șterge job-urile existente
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendDailyReport') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Crează nou trigger - zilnic la ora specificată
    const time = config.autoSendTime || '09:00';
    const [hour, minute] = time.split(':').map(Number);

    ScriptApp.newTrigger('sendDailyReport')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .inTimezone('Europe/Bucharest')
      .create();

    Logger.log(`Raport zilnic programat la ${time} (ora Bucureștiului)`);
    return { success: true, message: `Raport programat la ${time}` };
  } catch (error) {
    Logger.log("Eroare programare raport: " + error.toString());
    throw new Error("Eroare: " + error.message);
  }
}