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
 * Set to TRUE only after you have tested and approved automatic Friday scheduling.
 * While FALSE, automated triggers will log a safety notice and exit without sending.
 */
var AUTOMATIC_SENDING_ENABLED = false;

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

  // 1. Safety check for automatic trigger executions
  if (!isManualRun && !AUTOMATIC_SENDING_ENABLED) {
    Logger.log("⚠️ [SAFETY LOCK ACTIVE] AUTOMATIC_SENDING_ENABLED is set to FALSE.");
    Logger.log("No emails were dispatched. To enable automatic weekly sending, update AUTOMATIC_SENDING_ENABLED = true in Code.gs after your approval.");
    return {
      status: "blocked_by_safety_lock",
      message: "Automatic sending is disabled until administrator approval.",
    };
  }

  var config = getConfig();
  var remainingQuota = MailApp.getRemainingDailyQuota();
  Logger.log("Current Gmail daily quota remaining: " + remainingQuota + " emails");

  if (remainingQuota < 5) {
    Logger.log("❌ Error: Insufficient Gmail sending quota (" + remainingQuota + " left). Aborting.");
    return { status: "error", message: "Insufficient Gmail quota" };
  }

  // 2. Fetch prepared reports from Supabase Edge Function
  Logger.log("Fetching prepared weekly reports from Edge Function...");
  var requestPayload = {
    action: "prepare",
    force: Boolean(forceSend),
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
    if (report.is_duplicate && !forceSend) {
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
      
      MailApp.sendEmail({
        to: recipientEmail,
        subject: report.subject,
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
function sendTestEmail() {
  Logger.log("=== [TEST] Sending Preview Email to Admin ===");
  var config = getConfig();
  var targetEmail = config.adminTestEmail;

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
    MailApp.sendEmail({
      to: targetEmail,
      subject: report.subject,
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
  return sendWeeklyReports(true, false);
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
// 4. AUTOMATIC TRIGGER MANAGEMENT (Friday Evening Asia/Dhaka)
// ==============================================================================

/**
 * Sets up the weekly Friday evening installable trigger.
 * 
 * NOTE: As per Requirement 10, DO NOT run this function until you have approved
 * automatic sending and set AUTOMATIC_SENDING_ENABLED = true.
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
 * Removes all active triggers for sendWeeklyReports.
 */
function removeWeeklyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendWeeklyReports") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log("Removed " + removed + " existing trigger(s) for sendWeeklyReports.");
}
