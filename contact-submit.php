<?php
/* =========================================================
   Contact Form Submission Endpoint
   Accepts POST (JSON or Form Data) from the public contact form,
   validates input, saves to SQLite DB, and sends email notification.
   ========================================================= */

require_once __DIR__ . '/admin/config.php';

// Only allow POST requests
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    send_json(['error' => 'Method not allowed. Use POST.'], 405);
}

// Parse request data (supports JSON and regular forms)
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($contentType, 'application/json') !== false) {
    $input = json_decode(file_get_contents('php://input'), true);
} else {
    $input = $_POST;
}

if (!is_array($input)) {
    send_json(['error' => 'Invalid request body.'], 400);
}

// Sanitize and read fields
$name    = isset($input['name']) ? trim((string)$input['name']) : '';
$email   = isset($input['email']) ? trim((string)$input['email']) : '';
$company = isset($input['company']) ? trim((string)$input['company']) : '';
$service = isset($input['service']) ? trim((string)$input['service']) : '';
$budget  = isset($input['budget']) ? trim((string)$input['budget']) : '';
$message = isset($input['message']) ? trim((string)$input['message']) : '';

// Validation
if (empty($name)) {
    send_json(['error' => 'Your name is required.'], 400);
}
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    send_json(['error' => 'A valid email address is required.'], 400);
}
if (empty($message)) {
    send_json(['error' => 'Message content is required.'], 400);
}

// 1. Save to Database
$db = get_db_connection();
try {
    $stmt = $db->prepare("INSERT INTO submissions (name, email, company, service, budget, message) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$name, $email, $company, $service, $budget, $message]);
    $submissionId = $db->lastInsertId();
} catch (PDOException $e) {
    send_json(['error' => 'Failed to save submission: ' . $e->getMessage()], 500);
}

// 2. Send Email Notification via SMTP
$settings = load_settings();
$smtpConfigured = !empty($settings['smtp_host']) && !empty($settings['smtp_port']) && !empty($settings['smtp_to_email']);
$emailSent = false;
$emailError = null;

if ($smtpConfigured) {
    try {
        $mailer = new SmtpMailer($settings);
        
        $subject = "New Contact Submission from " . $name;
        $htmlContent = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
            <h2 style='color: #0b57d0; margin-top: 0;'>New Contact Form Submission</h2>
            <p style='font-size: 14px; color: #555;'>A new inquiry has been submitted from the Eserve Infotech website.</p>
            <hr style='border: none; border-top: 1px solid #eeeeee; margin: 20px 0;'>
            <table style='width: 100%; font-size: 14px; border-collapse: collapse;'>
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; width: 120px; color: #666;'>Name:</td>
                    <td style='padding: 8px 0; color: #111;'>" . htmlspecialchars($name) . "</td>
                </tr>
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; color: #666;'>Email:</td>
                    <td style='padding: 8px 0;'><a href='mailto:" . htmlspecialchars($email) . "' style='color: #0b57d0; text-decoration: none;'>" . htmlspecialchars($email) . "</a></td>
                </tr>
                " . (!empty($company) ? "
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; color: #666;'>Company:</td>
                    <td style='padding: 8px 0; color: #111;'>" . htmlspecialchars($company) . "</td>
                </tr>" : "") . "
                " . (!empty($service) ? "
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; color: #666;'>Service:</td>
                    <td style='padding: 8px 0; color: #111;'>" . htmlspecialchars($service) . "</td>
                </tr>" : "") . "
                " . (!empty($budget) ? "
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; color: #666;'>Budget:</td>
                    <td style='padding: 8px 0; color: #111;'>" . htmlspecialchars($budget) . "</td>
                </tr>" : "") . "
            </table>
            <hr style='border: none; border-top: 1px solid #eeeeee; margin: 20px 0;'>
            <div style='font-size: 14px; color: #333;'>
                <p style='font-weight: bold; margin-bottom: 8px; color: #666;'>Message:</p>
                <div style='background-color: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #0b57d0; white-space: pre-wrap; line-height: 1.5;'>" . htmlspecialchars($message) . "</div>
            </div>
            <hr style='border: none; border-top: 1px solid #eeeeee; margin: 20px 0;'>
            <p style='font-size: 11px; color: #999; margin-bottom: 0;'>This email was sent automatically by Eserve Infotech Website Backend.</p>
        </div>";
        
        $emailSent = $mailer->send($settings['smtp_to_email'], $subject, $htmlContent);
    } catch (Exception $e) {
        $emailError = $e->getMessage();
        error_log("SMTP Error: " . $emailError);
    }
}

// Return success (even if email failed, as long as it's saved in DB)
send_json([
    'success'      => true,
    'submissionId' => $submissionId,
    'emailSent'    => $emailSent,
    'emailError'   => $emailError
]);
