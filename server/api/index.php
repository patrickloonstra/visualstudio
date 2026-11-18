<?php
/**
 * Merkstudio API: flat-file opslag voor posts en foto's. Geen database.
 *
 *   data/<merk>/posts/<id>.json   een post (PostDoc)
 *   data/<merk>/fotos/<id>.jpg    de foto van die post
 *
 * Inloggen met een toegangscode per merk (config.php). Alle verzoeken behalve
 * login en status vragen een ingelogde sessie voor dat merk.
 */
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
$dataDir = rtrim($config['data_dir'] ?? (__DIR__ . '/../data'), '/');

const MAX_JSON = 2_000_000;          // 2 MB per post (zonder foto)
const MAX_PHOTO = 12_000_000;        // 12 MB per foto
const ID_RE = '/^[a-z0-9-]{4,64}$/';
const BRAND_RE = '/^[a-z0-9-]{2,40}$/';

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

session_name('merkstudio');
session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
ini_set('session.gc_maxlifetime', (string)(60 * 60 * 24 * 30));
session_start();

function out(int $code, array $body): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $code, string $msg): never { out($code, ['error' => $msg]); }

function input(): array {
    $raw = file_get_contents('php://input', false, null, 0, MAX_PHOTO * 2);
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) fail(400, 'Ongeldige gegevens.');
    return $data;
}

function brandParam(array $config): string {
    $b = (string)($_GET['brand'] ?? '');
    if (!preg_match(BRAND_RE, $b) || !isset($config['brands'][$b])) fail(404, 'Onbekend merk.');
    return $b;
}

function requireAuth(string $brand): void {
    $ok = $_SESSION['brands'] ?? [];
    if (!in_array($brand, $ok, true) && empty($_SESSION['admin'])) fail(401, 'Log eerst in.');
}

function dir_for(string $dataDir, string $brand, string $kind): string {
    $d = "$dataDir/$brand/$kind";
    if (!is_dir($d) && !mkdir($d, 0750, true) && !is_dir($d)) fail(500, 'Kan de opslagmap niet maken.');
    return $d;
}

/** Atomair schrijven: eerst naar een tijdelijk bestand, dan hernoemen. */
function write_atomic(string $path, string $content): void {
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, $content, LOCK_EX) === false || !rename($tmp, $path)) {
        @unlink($tmp);
        fail(500, 'Opslaan mislukt.');
    }
}

/** Eenvoudige rem op inlogpogingen: max 10 per kwartier per IP. */
function throttle(string $dataDir): void {
    $f = "$dataDir/.logins.json";
    $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
    $now = time();
    $fh = fopen($f, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $log = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
    $log = array_filter(array_map(fn($ts) => array_values(array_filter($ts, fn($t) => $t > $now - 900)), $log));
    $tries = $log[$ip] ?? [];
    if (count($tries) >= 10) { flock($fh, LOCK_UN); fclose($fh); fail(429, 'Te veel pogingen. Probeer het over een kwartier opnieuw.'); }
    $log[$ip] = [...$tries, $now];
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($log));
    flock($fh, LOCK_UN); fclose($fh);
}

function photoUrl(string $brand, string $id, int $v): string {
    return "../api/?action=photo&brand=$brand&id=$id&v=$v";
}

$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];
if (!is_dir($dataDir)) mkdir($dataDir, 0750, true);

switch ($action) {
    case 'status': {
        $brand = (string)($_GET['brand'] ?? '');
        $known = preg_match(BRAND_RE, $brand) && isset($config['brands'][$brand]);
        out(200, ['server' => true, 'brand' => $known ? $brand : null, 'loggedIn' => $known && (in_array($brand, $_SESSION['brands'] ?? [], true) || !empty($_SESSION['admin']))]);
    }

    case 'login': {
        if ($method !== 'POST') fail(405, 'Alleen POST.');
        $brand = brandParam($config);
        throttle($dataDir);
        $code = (string)(input()['code'] ?? '');
        $isAdmin = !empty($config['admin_hash']) && password_verify($code, $config['admin_hash']);
        if (!$isAdmin && !password_verify($code, $config['brands'][$brand])) fail(401, 'Deze code klopt niet.');
        session_regenerate_id(true);
        $_SESSION['brands'] = array_values(array_unique([...($_SESSION['brands'] ?? []), $brand]));
        if ($isAdmin) $_SESSION['admin'] = true;
        out(200, ['ok' => true]);
    }

    case 'logout': {
        $_SESSION = [];
        session_destroy();
        out(200, ['ok' => true]);
    }

    case 'list': {
        $brand = brandParam($config);
        requireAuth($brand);
        $posts = [];
        foreach (glob(dir_for($dataDir, $brand, 'posts') . '/*.json') ?: [] as $f) {
            $doc = json_decode((string)file_get_contents($f), true);
            if (is_array($doc)) $posts[] = $doc;
        }
        usort($posts, fn($a, $b) => strcmp($b['updated'] ?? '', $a['updated'] ?? ''));
        out(200, ['posts' => $posts]);
    }

    case 'save': {
        if ($method !== 'POST') fail(405, 'Alleen POST.');
        $brand = brandParam($config);
        requireAuth($brand);
        $doc = input();
        $id = (string)($doc['id'] ?? '');
        if (!preg_match(ID_RE, $id) || !isset($doc['fields']) || !is_array($doc['fields'])) fail(400, 'Ongeldige post.');
        $doc['brand'] = $brand;
        $doc['updated'] = gmdate('Y-m-d\TH:i:s\Z');

        // Foto als data-URL meegestuurd: opslaan als los bestand en vervangen door een link.
        $src = $doc['photo']['src'] ?? null;
        if (is_string($src) && str_starts_with($src, 'data:')) {
            if (!preg_match('#^data:image/(jpeg|png|webp);base64,#', $src, $m)) fail(400, 'Alleen JPG, PNG of WebP.');
            $bin = base64_decode(substr($src, strpos($src, ',') + 1), true);
            if ($bin === false || strlen($bin) > MAX_PHOTO) fail(413, 'Foto te groot (max 12 MB).');
            $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bin);
            if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) fail(400, 'Dit is geen geldige foto.');
            $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime];
            $fotos = dir_for($dataDir, $brand, 'fotos');
            foreach (glob("$fotos/$id.*") ?: [] as $old) @unlink($old);
            write_atomic("$fotos/$id.$ext", $bin);
            $doc['photo']['src'] = photoUrl($brand, $id, time());
        } elseif ($src === null) {
            foreach (glob(dir_for($dataDir, $brand, 'fotos') . "/$id.*") ?: [] as $old) @unlink($old);
        } elseif (is_string($src) && !str_contains($src, "action=photo&brand=$brand&id=")) {
            // Foto van een andere post (bijv. een kopie): bestand meekopiëren.
            if (preg_match('/[?&]id=([a-z0-9-]{4,64})/', $src, $m)) {
                $fotos = dir_for($dataDir, $brand, 'fotos');
                $from = (glob("$fotos/{$m[1]}.*") ?: [])[0] ?? null;
                if ($from) {
                    copy($from, "$fotos/$id." . pathinfo($from, PATHINFO_EXTENSION));
                    $doc['photo']['src'] = photoUrl($brand, $id, time());
                }
            }
        }

        $json = json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if ($json === false || strlen($json) > MAX_JSON) fail(413, 'Post te groot.');
        write_atomic(dir_for($dataDir, $brand, 'posts') . "/$id.json", $json);
        out(200, ['post' => $doc]);
    }

    case 'delete': {
        if ($method !== 'POST') fail(405, 'Alleen POST.');
        $brand = brandParam($config);
        requireAuth($brand);
        $id = (string)(input()['id'] ?? '');
        if (!preg_match(ID_RE, $id)) fail(400, 'Ongeldige post.');
        @unlink(dir_for($dataDir, $brand, 'posts') . "/$id.json");
        foreach (glob(dir_for($dataDir, $brand, 'fotos') . "/$id.*") ?: [] as $f) @unlink($f);
        out(200, ['ok' => true]);
    }

    case 'photo': {
        $brand = brandParam($config);
        requireAuth($brand);
        $id = (string)($_GET['id'] ?? '');
        if (!preg_match(ID_RE, $id)) fail(400, 'Ongeldige foto.');
        $f = (glob(dir_for($dataDir, $brand, 'fotos') . "/$id.*") ?: [])[0] ?? null;
        if (!$f) fail(404, 'Foto niet gevonden.');
        header_remove('Cache-Control');
        header('Cache-Control: private, max-age=31536000, immutable');
        header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($f));
        header('Content-Length: ' . filesize($f));
        readfile($f);
        exit;
    }

    default:
        fail(404, 'Onbekende actie.');
}
