<?php
/* =========================================================
   Admin config — paths, password storage, session bootstrap.
   The actual password hash lives in /admin/data/password.hash
   so we never rewrite PHP code on password change.
   ========================================================= */

// Resolve paths
$ADMIN_DIR    = __DIR__;
$DATA_DIR     = $ADMIN_DIR . '/data';
$PW_FILE      = $DATA_DIR . '/password.hash';
$CONTENT_PATH = realpath($ADMIN_DIR . '/..') . '/content.json';
$BACKUP_DIR   = $ADMIN_DIR . '/backups';

// Default password (only used the first time, until the team changes it)
const DEFAULT_PASSWORD = 'eserve2026';

// Make sure data + backup dirs exist
if (!is_dir($DATA_DIR))   @mkdir($DATA_DIR, 0755, true);
if (!is_dir($BACKUP_DIR)) @mkdir($BACKUP_DIR, 0755, true);

// Bootstrap password.hash if missing — seed with default
if (!file_exists($PW_FILE)) {
    @file_put_contents($PW_FILE, password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT));
}

// Helpers
function load_password_hash() {
    global $PW_FILE;
    $h = @file_get_contents($PW_FILE);
    return $h ? trim($h) : '';
}
function save_password_hash($plain) {
    global $PW_FILE;
    return @file_put_contents($PW_FILE, password_hash($plain, PASSWORD_DEFAULT)) !== false;
}
function send_json($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function read_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return null;
    return json_decode($raw, true);
}

// Session — secure, same-site
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// =========================================================
// SQLite Database Helper
// =========================================================
function get_db_connection() {
    global $DATA_DIR;
    $db_file = $DATA_DIR . '/contact_submissions.sqlite';
    try {
        $db = new PDO("sqlite:" . $db_file);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // Create table if not exists
        $db->exec("CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            company TEXT,
            service TEXT,
            budget TEXT,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
        return $db;
    } catch (PDOException $e) {
        send_json(['error' => 'Database connection failed: ' . $e->getMessage()], 500);
    }
}

// =========================================================
// Settings Load/Save (Stored securely in blocked /data/ folder)
// =========================================================
$SETTINGS_FILE = $DATA_DIR . '/settings.json';

function load_settings() {
    global $SETTINGS_FILE;
    $defaults = [
        'smtp_host'       => '',
        'smtp_port'       => '',
        'smtp_user'       => '',
        'smtp_pass'       => '',
        'smtp_secure'     => 'tls', // ssl, tls, none
        'smtp_from_email' => '',
        'smtp_from_name'  => 'Eserve Contact Form',
        'smtp_to_email'   => '',
    ];
    if (!file_exists($SETTINGS_FILE)) {
        return $defaults;
    }
    $raw = @file_get_contents($SETTINGS_FILE);
    if (!$raw) return $defaults;
    $parsed = json_decode($raw, true);
    return is_array($parsed) ? array_merge($defaults, $parsed) : $defaults;
}

function save_settings($settings) {
    global $SETTINGS_FILE;
    $json = json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    return @file_put_contents($SETTINGS_FILE, $json) !== false;
}

// =========================================================
// Custom Socket-Based SMTP Mailer (Pure PHP, zero external dependencies)
// =========================================================
class SmtpMailer {
    private $settings;
    public $log = [];

    public function __construct($settings) {
        $this->settings = $settings;
    }

    private function log($msg) {
        $this->log[] = $msg;
    }

    public function send($to, $subject, $messageHtml) {
        $host = $this->settings['smtp_host'] ?? '';
        $port = (int)($this->settings['smtp_port'] ?? 587);
        $user = $this->settings['smtp_user'] ?? '';
        $pass = $this->settings['smtp_pass'] ?? '';
        $secure = strtolower($this->settings['smtp_secure'] ?? 'tls');
        $fromEmail = $this->settings['smtp_from_email'] ?? '';
        $fromName = $this->settings['smtp_from_name'] ?? 'Eserve Contact Form';

        if (empty($host) || empty($port)) {
            throw new Exception("SMTP Host and Port are not configured.");
        }

        $socketHost = $host;
        if ($secure === 'ssl') {
            $socketHost = 'ssl://' . $host;
        }

        $this->log("Connecting to $socketHost:$port...");
        $socket = @stream_socket_client(
            "$socketHost:$port",
            $errno,
            $errstr,
            10,
            STREAM_CLIENT_CONNECT,
            stream_context_create([
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                ]
            ])
        );

        if (!$socket) {
            throw new Exception("Connection failed: $errstr ($errno)");
        }

        try {
            $this->readResponse($socket, '220');

            // Send EHLO
            $this->sendCommand($socket, "EHLO localhost", '250');

            // Handle STARTTLS
            if ($secure === 'tls') {
                $this->sendCommand($socket, "STARTTLS", '220');
                
                $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                    $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
                }
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                    $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
                }

                $this->log("Enabling TLS encryption...");
                if (!@stream_socket_enable_crypto($socket, true, $cryptoMethod)) {
                    throw new Exception("Failed to enable STARTTLS encryption on socket.");
                }

                // Send EHLO again after STARTTLS
                $this->sendCommand($socket, "EHLO localhost", '250');
            }

            // Auth Login
            if (!empty($user)) {
                $this->sendCommand($socket, "AUTH LOGIN", '334');
                $this->sendCommand($socket, base64_encode($user), '334');
                $this->sendCommand($socket, base64_encode($pass), '235');
            }

            // Mail From
            $this->sendCommand($socket, "MAIL FROM: <$fromEmail>", '250');

            // Rcpt To
            $this->sendCommand($socket, "RCPT TO: <$to>", ['250', '251']);

            // Data
            $this->sendCommand($socket, "DATA", '354');

            // Construct MIME message
            $boundary = "----=_Part_" . md5(uniqid(rand(), true));
            $headers = [
                "MIME-Version: 1.0",
                "Content-Type: multipart/alternative; boundary=\"$boundary\"",
                "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$fromEmail>",
                "To: <$to>",
                "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
                "Date: " . date('r'),
                "Message-ID: <" . uniqid('', true) . "@" . ($host ?: 'localhost') . ">",
                "X-Mailer: EserveMailer/1.0"
            ];

            $textMessage = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $messageHtml));

            $body = "";
            foreach ($headers as $h) {
                $body .= $h . "\r\n";
            }
            $body .= "\r\n";
            
            $body .= "--$boundary\r\n";
            $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
            $body .= $textMessage . "\r\n\r\n";
            
            $body .= "--$boundary\r\n";
            $body .= "Content-Type: text/html; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
            $body .= $messageHtml . "\r\n\r\n";
            $body .= "--$boundary--\r\n";

            // Escape single dots on line
            $body = preg_replace('/^\./m', '..', $body);
            
            // SMTP message body must end with \r\n.\r\n
            $this->sendCommand($socket, $body . "\r\n.", '250');

            // Quit
            $this->sendCommand($socket, "QUIT", '221');
            
            fclose($socket);
            $this->log("Email sent successfully!");
            return true;
        } catch (Exception $e) {
            fclose($socket);
            $this->log("Error: " . $e->getMessage());
            throw $e;
        }
    }

    private function sendCommand($socket, $cmd, $expectedCode) {
        // Obfuscate sensitive commands in logs
        if (strpos($cmd, 'AUTH') === 0) {
            $this->log("C: AUTH LOGIN");
        } else if (preg_match('/^[a-zA-Z0-9=+\/]{15,}$/', $cmd)) {
            $this->log("C: ****** (base64 token)");
        } else {
            $this->log("C: " . substr($cmd, 0, 100));
        }
        fwrite($socket, $cmd . "\r\n");
        return $this->readResponse($socket, $expectedCode);
    }

    private function readResponse($socket, $expectedCode) {
        $response = "";
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') {
                break;
            }
        }
        $this->log("S: " . trim($response));
        $code = substr($response, 0, 3);
        
        $expectedCodes = is_array($expectedCode) ? $expectedCode : [$expectedCode];
        if (!in_array($code, $expectedCodes)) {
            throw new Exception("Expected code " . implode('/', $expectedCodes) . ", received: " . $response);
        }
        return $response;
    }
}
