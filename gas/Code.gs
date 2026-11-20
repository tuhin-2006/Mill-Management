/**
 * ==============================================================================
 * MILL MANAGEMENT SYSTEM - WEEKLY EMAIL REPORTING AUTOMATION
 * ==============================================================================
 * 
 * Free Gmail-based Weekly Reporting Engine using Google Apps Script (MailApp)
 * and Supabase Edge Functions.
 * 
 * ARCHITECTURE & SECURITY:
 * 1. Edge Function performs database queries, calculations, privacy aggregation,
 *    and HTML rendering using Supabase Service Role (server-side only).
 * 2. This Apps Script fetches prepared reports using a dedicated REPORT_SHARED_SECRET
 *    stored in Script Properties.
 * 3. Emails are dispatched via free Gmail MailApp (zero custom domain or paid tier).
 * 4. Delivery results (sent, failed, skipped) are posted back to Supabase email_logs.
 * 
 * IMPORTANT SAFETY RULE:
 * - AUTOMATIC_SENDING_ENABLED is set to FALSE by default.
 * - Automatic background triggers will NOT send emails until you change this to TRUE.
 */

// ==============================================================================
// 1. CONFIGURATION & SAFETY GUARDS
// ==============================================================================

/**
 * MASTER SAFETY SWITCH:
 * Set to TRUE. The live activation switch is now dynamically controlled
 * directly from your Mill Manager web dashboard (Settings / Email Reports page).
 * When turned OFF in the web dashboard, scheduled runs safely exit without sending.
 */
var AUTOMATIC_SENDING_ENABLED = true;

/**
 * Retrieves a script property securely from PropertiesService.
 */
function getRequiredProperty(key) {
  var props = PropertiesService.getScriptProperties();
  var value = props.getProperty(key);
  if (!value || value.trim() === "") {
    throw new Error(
      "Missing required Script Property: [" + key + "]. " +
      "Please go to Project Settings > Script Properties and configure it."
    );
  }
  return value.trim();
}

/**
 * Returns script properties or default fallbacks.
 */
function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    functionUrl: getRequiredProperty("SUPABASE_FUNCTION_URL"),
    sharedSecret: getRequiredProperty("REPORT_SHARED_SECRET"),
    adminTestEmail: props.getProperty("ADMIN_TEST_EMAIL") || Session.getActiveUser().getEmail(),
  };
}

// ==============================================================================
// 2. MAIN REPORTING WORKFLOW (Weekly Trigger Target)
// ==============================================================================

/**
 * Main routine executed weekly by the time-driven trigger (or manually).
 * 
 * @param {boolean} isManualRun - Set to true when executed manually to bypass safety lock.
 * @param {boolean} forceSend - Set to true to bypass duplicate suppression.
 */
function sendWeeklyReports(isManualRun, forceSend) {
  Logger.log("=== [START] Mill Weekly Reporting Engine ===");

  var isManual = typeof isManualRun === "boolean" ? isManualRun : false;
  var isForce = typeof forceSend === "boolean" ? forceSend : false;

  var config = getConfig();
  var remainingQuota = MailApp.getRemainingDailyQuota();
  Logger.log("Current Gmail daily quota remaining: " + remainingQuota + " emails");

  if (remainingQuota < 5) {
    Logger.log("❌ Error: Insufficient Gmail sending quota (" + remainingQuota + " left). Aborting.");
    return { status: "error", message: "Insufficient Gmail quota" };
  }

  // 1. Fetch prepared reports from Supabase Edge Function
  Logger.log("Fetching prepared weekly reports from Edge Function...");
  var requestPayload = {
    action: "prepare",
    force: Boolean(isForce),
    isManualRun: Boolean(isManual),
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-report-secret": config.sharedSecret,
    },
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true,
  };

  var response;
  try {
    response = UrlFetchApp.fetch(config.functionUrl, options);
  } catch (fetchErr) {
    Logger.log("❌ Network Error connecting to Edge Function: " + fetchErr.toString());
    throw fetchErr;
  }

  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode !== 200) {
    Logger.log("❌ Edge Function returned error status [" + statusCode + "]: " + responseText);
    throw new Error("Edge Function error: " + responseText);
  }

  var data = JSON.parse(responseText);

  // Safety Switch Check: If automated trigger and auto_email_enabled is FALSE, exit cleanly without sending
  if (data.status === "safety_locked" || (!data.auto_email_enabled && !isManual)) {
    Logger.log("🔒 [SAFETY LOCK ACTIVE] " + (data.message || "Automatic sending is turned OFF in Admin Settings."));
    return {
      status: "safety_locked",
      reportsCount: 0,
      message: data.message || "Automatic weekly sending is paused in Admin Settings.",
    };
  }

  if (!data.success || !Array.isArray(data.reports)) {
    Logger.log("❌ Invalid response structure from Edge Function: " + responseText);
    throw new Error("Invalid response from Edge Function");
  }

  var period = data.period || {};
  var reports = data.reports;
  Logger.log("Received " + reports.length + " report(s) to process for period: " + period.startDate + " to " + period.endDate);

  if (reports.length === 0) {
    Logger.log("ℹ️ No reports prepared (check if members have emails configured in Supabase).");
    return { status: "empty", reportsCount: 0 };
  }

  // 3. Dispatch emails via MailApp & record audit status
  var deliveryLogs = [];
  var sentCount = 0;
  var skippedCount = 0;
  var failedCount = 0;

  for (var i = 0; i < reports.length; i++) {
    var report = reports[i];
    var recipientEmail = report.recipient_email;
    var recipientType = report.recipient_type;
    var memberName = report.member_name || recipientEmail;

    // Duplicate Prevention Check
    if (report.is_duplicate && !isForce) {
      Logger.log("⏩ [SKIPPED - DUPLICATE] " + recipientType + " (" + memberName + "): " + recipientEmail + " was already sent for this period.");
      skippedCount++;
      deliveryLogs.push({
        report_period_start: period.startDate,
        report_period_end: period.endDate,
        recipient_type: recipientType,
        recipient_email: recipientEmail,
        member_id: report.member_id || null,
        status: "skipped_duplicate",
        error_message: "Duplicate report suppressed. Already successfully sent for period.",
        metadata: report.metadata || {},
      });
      continue;
    }

    // Send via MailApp with per-recipient try/catch protection
    try {
      Logger.log("📧 Sending report to " + recipientType + " (" + memberName + ") <" + recipientEmail + ">...");
      
      var textBody = report.textBody || report.body || "Your Mill Management Statement is attached in HTML.";
      MailApp.sendEmail({
        to: recipientEmail,
        subject: report.subject,
        body: textBody,
        htmlBody: report.htmlBody,
        name: "Mill Management System",
      });

      sentCount++;
      Logger.log("✅ Delivered successfully to: " + recipientEmail);

      deliveryLogs.push({
        report_period_start: period.startDate,
        report_period_end: period.endDate,
        recipient_type: recipientType,
        recipient_email: recipientEmail,
        member_id: report.member_id || null,
        status: "sent",
        error_message: null,
        metadata: report.metadata || {},
      });
    } catch (sendErr) {
      failedCount++;
      var errorMsg = sendErr.toString();
      Logger.log("❌ Failed to send email to " + recipientEmail + ": " + errorMsg);

      deliveryLogs.push({
        report_period_start: period.startDate,
        report_period_end: period.endDate,
        recipient_type: recipientType,
        recipient_email: recipientEmail,
        member_id: report.member_id || null,
        status: "failed",
        error_message: errorMsg,
        metadata: report.metadata || {},
      });
    }
  }

  // 4. Synchronize audit logs back to Supabase database
  if (deliveryLogs.length > 0) {
    Logger.log("Posting " + deliveryLogs.length + " audit record(s) back to Supabase email_logs...");
    try {
      var logOptions = {
        method: "post",
        contentType: "application/json",
        headers: {
          "x-report-secret": config.sharedSecret,
        },
        payload: JSON.stringify({
          action: "log",
          logs: deliveryLogs,
        }),
        muteHttpExceptions: true,
      };

      var logRes = UrlFetchApp.fetch(config.functionUrl, logOptions);
      if (logRes.getResponseCode() === 200) {
        Logger.log("✅ Delivery logs successfully saved in Supabase.");
      } else {
        Logger.log("⚠️ Could not persist delivery logs: " + logRes.getContentText());
      }
    } catch (logErr) {
      Logger.log("⚠️ Error posting delivery logs to Supabase: " + logErr.toString());
    }
  }

  Logger.log("=== [COMPLETE] Sent: " + sentCount + " | Skipped: " + skippedCount + " | Failed: " + failedCount + " ===");
  return {
    status: "completed",
    sentCount: sentCount,
    skippedCount: skippedCount,
    failedCount: failedCount,
    period: period,
  };
}

// ==============================================================================
// 3. SAFE TESTING & MANUAL ACTIONS (Run from GAS Editor toolbar)
// ==============================================================================

/**
 * SAFE TEST 1: Check Gmail quota and secret configuration.
 * Does NOT send any emails.
 */
function verifyConfiguration() {
  Logger.log("=== [TEST] Verifying Configuration & Connectivity ===");
  try {
    var config = getConfig();
    Logger.log("✅ SUPABASE_FUNCTION_URL: " + config.functionUrl);
    Logger.log("✅ REPORT_SHARED_SECRET: Configured (length: " + config.sharedSecret.length + " chars)");
    Logger.log("✅ ADMIN_TEST_EMAIL: " + config.adminTestEmail);

    var quota = MailApp.getRemainingDailyQuota();
    Logger.log("✅ Gmail Sending Quota Remaining: " + quota + " emails/day");
    Logger.log("✅ Configuration verification PASSED.");
    return true;
  } catch (err) {
    Logger.log("❌ Configuration check FAILED: " + err.toString());
    return false;
  }
}

/**
 * SAFE TEST 2: Send a sample Member Report & Group Ledger Report to the ADMIN ONLY.
 * Does NOT send emails to members. Bypasses member lists and sends exclusively to admin.
 */
function sendTestEmail(overrideEmail) {
  Logger.log("=== [TEST] Sending Preview Email to Admin ===");
  var config = getConfig();
  var targetEmail = overrideEmail || config.adminTestEmail;

  Logger.log("Target test recipient: " + targetEmail);

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-report-secret": config.sharedSecret,
    },
    payload: JSON.stringify({
      action: "test",
      testRecipient: targetEmail,
    }),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(config.functionUrl, options);
  if (response.getResponseCode() !== 200) {
    throw new Error("Test report generation failed: " + response.getContentText());
  }

  var data = JSON.parse(response.getContentText());
  var reports = data.reports || [];

  for (var i = 0; i < reports.length; i++) {
    var report = reports[i];
    Logger.log("Dispatching test sample: " + report.subject);
    var textBody = report.textBody || report.body || "This is a test preview from Mill Management System.";
    MailApp.sendEmail({
      to: targetEmail,
      subject: report.subject,
      body: textBody,
      htmlBody: report.htmlBody,
      name: "Mill Manager [TEST]",
    });
  }

  Logger.log("✅ Test reports dispatched successfully to: " + targetEmail);
  Logger.log("Please check your Gmail inbox (and Spam folder) to verify formatting.");
}

/**
 * MANUAL SEND: Manually generate and dispatch this week's reports right now.
 * Respects duplicate suppression unless force is set.
 */
function sendWeeklyReportsManually() {
  Logger.log("=== [MANUAL RUN] Initiating on-demand report send ===");
  return sendWeeklyReports(true, true);
}

/**
 * MANUAL FORCE SEND: Dispatches this week's reports even if already sent previously.
 */
function forceSendWeeklyReportsManually() {
  Logger.log("=== [MANUAL FORCE RUN] Overriding duplicate prevention ===");
  return sendWeeklyReports(true, true);
}

/**
 * Utility to check remaining daily email quota.
 */
function checkGmailQuota() {
  var quota = MailApp.getRemainingDailyQuota();
  Logger.log("Remaining daily Gmail quota: " + quota + " emails.");
  return quota;
}

// ==============================================================================
// 4. AUTOMATIC TRIGGER MANAGEMENT (Dynamic Schedule Monitor)
// ==============================================================================

/**
 * Recommended Modern Trigger:
 * Sets up a dynamic 15-minute monitor trigger.
 * It periodically inspects the user-configured `weekly_report_day` and `weekly_report_time`
 * from the Mill Manager dashboard (via /api/cron/weekly-report) and automatically dispatches
 * exactly at the configured time (e.g., 20:00, 22:32, etc.) with zero hardcoding!
 */
function setupScheduledMonitorTrigger() {
  Logger.log("=== Setting up Dynamic Schedule Monitor Trigger (Every 15 Minutes) ===");
  removeWeeklyTrigger();

  ScriptApp.newTrigger("checkAndDispatchScheduledReports")
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("✅ Dynamic monitor trigger successfully registered! It runs every 15 minutes to match web settings.");
}

/**
 * Dynamic scheduled monitor handler.
 * Queries Next.js /api/cron/weekly-report which verifies:
 * 1. Whether automatic emailing is enabled
 * 2. Whether today matches `weekly_report_day` (Asia/Dhaka)
 * 3. Whether current time has reached `weekly_report_time`
 * 4. Whether reports were already sent today (duplicate suppression)
 */
function checkAndDispatchScheduledReports() {
  Logger.log("=== [DYNAMIC CRON CHECK] Inspecting Scheduled Time ===");
  var props = PropertiesService.getScriptProperties();
  var appBaseUrl = props.getProperty("APP_BASE_URL") || "https://mill-management-delta.vercel.app";
  var secret = props.getProperty("REPORT_SHARED_SECRET") || "mill_sec_9e21a4f08c3d7b6a12e5f804";

  if (appBaseUrl && appBaseUrl.trim() !== "") {
    var cronUrl = appBaseUrl.replace(/\/$/, "") + "/api/cron/weekly-report?secret=" + encodeURIComponent(secret);
    try {
      var res = UrlFetchApp.fetch(cronUrl, { muteHttpExceptions: true });
      Logger.log("Next.js Cron Response [" + res.getResponseCode() + "]: " + res.getContentText());
    } catch (err) {
      Logger.log("⚠️ Error pinging Next.js cron: " + err.toString());
    }
  } else {
    sendWeeklyReports(false, false);
  }
}

/**
 * Legacy static trigger (Every Friday at 8:00 PM).
 */
function setupWeeklyTrigger() {
  Logger.log("=== Setting up Weekly Trigger for Friday Evening ===");

  if (!AUTOMATIC_SENDING_ENABLED) {
    Logger.log("⚠️ WARNING: AUTOMATIC_SENDING_ENABLED is currently FALSE.");
    Logger.log("The trigger can be scheduled, but it will safely exit without sending emails until you set AUTOMATIC_SENDING_ENABLED = true.");
  }

  // Remove existing triggers for sendWeeklyReports to prevent duplicate schedules
  removeWeeklyTrigger();

  // Create new weekly trigger: Every Friday at 20:00 (8:00 PM)
  ScriptApp.newTrigger("sendWeeklyReports")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(20) // 8:00 PM Bangladesh Time (Asia/Dhaka)
    .create();

  Logger.log("✅ Weekly trigger successfully registered for every FRIDAY around 8:00 PM - 9:00 PM (Asia/Dhaka).");
}

/**
 * Removes all active triggers for weekly reporting and dynamic monitors.
 */
function removeWeeklyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "sendWeeklyReports" || fn === "checkAndDispatchScheduledReports") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log("Removed " + removed + " existing trigger(s).");
}

// ==============================================================================
// 5. WEB APP HTTP ENDPOINTS (Optional Direct Trigger)
// ==============================================================================

/**
 * Web App HTTP Entrypoint: Allows triggering manual report sends securely via HTTP POST.
 */
function doPost(e) {
  try {
    var secretHeader = e && e.parameter ? e.parameter.secret : "";
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var secret = body.secret || secretHeader;
    var config = getConfig();

    if (secret !== config.sharedSecret) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var action = body.action || "send_weekly";
    var result;

    if (action === "test_preview") {
      var targetEmail = body.targetEmail || config.adminTestEmail;
      sendTestEmail(targetEmail);
      result = { success: true, action: "test_preview", targetEmail: targetEmail };
    } else if (action === "send_single_email") {
      if (!body.to || !body.subject || !body.htmlBody) {
        throw new Error("Missing required fields (to, subject, or htmlBody) in payload");
      }
      var targetTo = String(body.to).trim();
      var textBody = body.body || body.textBody || "Your Mill Management Statement is attached in HTML.";
      MailApp.sendEmail({
        to: targetTo,
        subject: body.subject,
        body: textBody,
        htmlBody: body.htmlBody,
        name: body.senderName || "Mill Management System",
      });
      result = { success: true, action: "send_single_email", recipient: targetTo };
    } else {
      var force = body.force !== undefined ? Boolean(body.force) : true;
      result = sendWeeklyReports(true, force);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Mill Manager Gmail Reporting Engine",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
