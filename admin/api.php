<?php
/* =========================================================
   Admin API Endpoint
   Actions (requires active admin session):
   GET  ?action=settings           -> Returns SMTP & DB settings (password masked)
   POST ?action=settings           -> Saves SMTP & DB settings
   POST ?action=test_email         -> Sends a test email and returns full log
   GET  ?action=submissions        -> Returns contact submissions from database
   POST ?action=delete_submission  -> Deletes a submission by ID
   GET  ?action=export_csv         -> Exports all submissions to CSV download
   ========================================================= */

require_once __DIR__ . '/config.php';

// Ensure user is authenticated
if (empty($_SESSION['authed'])) {
    send_json(['error' => 'Not signed in.'], 401);
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---------------------------------------------------------
// GET SETTINGS
// ---------------------------------------------------------
if ($action === 'settings' && $method === 'GET') {
    $settings = load_settings();
    // Mask password before sending to frontend
    if (!empty($settings['smtp_pass'])) {
        $settings['smtp_pass'] = '********';
    }
    send_json(['settings' => $settings]);
}

// ---------------------------------------------------------
// POST SETTINGS
// ---------------------------------------------------------
if ($action === 'settings' && $method === 'POST') {
    $body = read_json_body();
    if (!is_array($body)) {
        send_json(['error' => 'Invalid request body.'], 400);
    }
    
    $currentSettings = load_settings();
    $newSettings = [];
    
    // Whitelist settings we accept
    $keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from_email', 'smtp_from_name', 'smtp_to_email'];
    foreach ($keys as $key) {
        $newSettings[$key] = isset($body[$key]) ? trim((string)$body[$key]) : '';
    }
    
    // If password is masked or empty, preserve the current password
    if ($newSettings['smtp_pass'] === '********' || $newSettings['smtp_pass'] === '') {
        $newSettings['smtp_pass'] = $currentSettings['smtp_pass'];
    }
    
    // Save to settings.json
    if (save_settings($newSettings)) {
        send_json(['ok' => true]);
    } else {
        send_json(['error' => 'Could not save settings. Please check directory permissions.'], 500);
    }
}

// ---------------------------------------------------------
// POST TEST EMAIL
// ---------------------------------------------------------
if ($action === 'test_email' && $method === 'POST') {
    $body = read_json_body();
    if (!is_array($body)) {
        send_json(['error' => 'Invalid request body.'], 400);
    }
    
    $currentSettings = load_settings();
    $testSettings = [];
    $keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from_email', 'smtp_from_name', 'smtp_to_email'];
    
    foreach ($keys as $key) {
        $testSettings[$key] = isset($body[$key]) ? trim((string)$body[$key]) : '';
    }
    
    if ($testSettings['smtp_pass'] === '********' || $testSettings['smtp_pass'] === '') {
        $testSettings['smtp_pass'] = $currentSettings['smtp_pass'];
    }
    
    if (empty($testSettings['smtp_host']) || empty($testSettings['smtp_port'])) {
        send_json(['error' => 'SMTP Host and Port are required to send a test email.'], 400);
    }
    
    $recipient = !empty($testSettings['smtp_to_email']) ? $testSettings['smtp_to_email'] : $testSettings['smtp_user'];
    if (empty($recipient)) {
        send_json(['error' => 'Recipient Email address is required.'], 400);
    }
    
    $mailer = new SmtpMailer($testSettings);
    $subject = "SMTP Verification Test";
    $htmlContent = "
    <div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #c2e7ff; background-color: #f1f8ff; border-radius: 8px; max-width: 600px;'>
        <h2 style='color: #0b57d0; margin-top: 0;'>SMTP Connection Verification</h2>
        <p>Congratulations! Your SMTP settings on the Eserve Infotech website are working correctly.</p>
        <hr style='border: none; border-top: 1px solid #c2e7ff; margin: 15px 0;'>
        <p style='font-size: 13px; color: #555;'><strong>Sent At:</strong> " . date('Y-m-d H:i:s T') . "</p>
        <p style='font-size: 13px; color: #555;'><strong>SMTP Host:</strong> " . htmlspecialchars($testSettings['smtp_host']) . ":" . $testSettings['smtp_port'] . "</p>
        <p style='font-size: 13px; color: #555;'><strong>Encryption:</strong> " . strtoupper($testSettings['smtp_secure']) . "</p>
    </div>";
    
    try {
        $mailer->send($recipient, $subject, $htmlContent);
        send_json([
            'ok'  => true,
            'log' => $mailer->log
        ]);
    } catch (Exception $e) {
        send_json([
            'error'   => 'SMTP send failed.',
            'message' => $e->getMessage(),
            'log'     => $mailer->log
        ], 500);
    }
}

// ---------------------------------------------------------
// GET SUBMISSIONS
// ---------------------------------------------------------
if ($action === 'submissions' && $method === 'GET') {
    $db = get_db_connection();
    try {
        $stmt = $db->query("SELECT * FROM submissions ORDER BY created_at DESC");
        $submissions = $stmt->fetchAll();
        send_json(['submissions' => $submissions]);
    } catch (PDOException $e) {
        send_json(['error' => 'Could not fetch submissions: ' . $e->getMessage()], 500);
    }
}

// ---------------------------------------------------------
// POST DELETE SUBMISSION
// ---------------------------------------------------------
if ($action === 'delete_submission' && $method === 'POST') {
    $body = read_json_body();
    $id = is_array($body) && isset($body['id']) ? (int)$body['id'] : 0;
    
    if ($id <= 0) {
        send_json(['error' => 'Invalid ID.'], 400);
    }
    
    $db = get_db_connection();
    try {
        $stmt = $db->prepare("DELETE FROM submissions WHERE id = ?");
        $stmt->execute([$id]);
        send_json(['ok' => true]);
    } catch (PDOException $e) {
        send_json(['error' => 'Could not delete submission: ' . $e->getMessage()], 500);
    }
}

// ---------------------------------------------------------
// GET EXPORT CSV
// ---------------------------------------------------------
if ($action === 'export_csv' && $method === 'GET') {
    $db = get_db_connection();
    try {
        $stmt = $db->query("SELECT created_at, name, email, company, service, budget, message FROM submissions ORDER BY created_at DESC");
        $rows = $stmt->fetchAll();
        
        $filename = "contact_submissions_" . date('Y-m-d_His') . ".csv";
        
        // Output headers for CSV download
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // Open output stream
        $out = fopen('php://output', 'w');
        
        // Excel UTF-8 compatibility (BOM)
        fwrite($out, "\xEF\xBB\xBF");
        
        // Write headers
        fputcsv($out, ['Date/Time', 'Name', 'Email', 'Company', 'Service', 'Budget', 'Message']);
        
        // Write rows
        foreach ($rows as $row) {
            fputcsv($out, [
                $row['created_at'],
                $row['name'],
                $row['email'],
                $row['company'],
                $row['service'],
                $row['budget'],
                $row['message']
            ]);
        }
        
        fclose($out);
        exit;
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: text/plain');
        exit('Could not export submissions: ' . $e->getMessage());
    }
}

send_json(['error' => 'Unknown action.'], 400);
