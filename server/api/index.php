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

if (!is_file(__DIR__ . '/config.php')) {
    // Nog niet ingesteld: luid melden, zodat de studio niet stilletjes in de browser gaat opslaan.
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['server' => true, 'setup' => true, 'error' => 'De server is nog niet ingesteld: api/config.php ontbreekt.']);
    exit;
}
$config = require __DIR__ . '/config.php';
$dataDir = rtrim($config['data_dir'] ?? (dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2))) . '/merkstudio-data'), '/');
// Ligt de data toch binnen de website? Dan in elk geval de map afschermen voor Apache.
$docRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: null;
if ($docRoot && str_starts_with($dataDir . '/', $docRoot . '/') && is_dir($dataDir) && !is_file("$dataDir/.htaccess")) {
    @file_put_contents("$dataDir/.htaccess", "Require all denied\n");
}

const MAX_JSON = 2_000_000;          // 2 MB per post (zonder foto)
const MAX_PHOTO = 12_000_000;        // 12 MB per foto
const ID_RE = '/^[a-z0-9-]{4,64}$/';
const BRAND_RE = '/^[a-z0-9-]{2,40}$/';

header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

session_name('merkstudio');
// Cookie alleen voor de map van de tool (bijv. /contenttool/), niet voor de rest van de site.
$toolPath = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'))), '/') . '/';
session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => $toolPath, 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
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

/** Zonder toegangscode ("require_code" => false in config.php) mag iedereen met het adres erin. */
function isOpen(): bool {
    global $config;
    return ($config['require_code'] ?? true) === false;
}

function requireAuth(string $brand): void {
    if (isOpen()) return;
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

/** Pad vanaf de domeinroot, zodat de foto werkt waar de tool ook staat (/contenttool/ of /contenttool/vinchem/). */
function photoUrl(string $brand, string $id, int $v): string {
    $api = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
    return "$api/?action=photo&brand=$brand&id=$id&v=$v";
}

/** Buffer-instellingen voor een merk uit config.php, of null als ze ontbreken. */
function bufferConfig(array $config, string $brand): ?array {
    $b = $config['buffer'][$brand] ?? null;
    if (!is_array($b) || empty($b['api_key'])) return null;
    $b['endpoint'] ??= 'https://api.buffer.com';
    if (empty($b['organization_id'])) {
        // Niet ingevuld: de eerste organisatie van het account gebruiken.
        $orgs = bufferCall($b['api_key'], 'query GetOrganizations { account { organizations { id name } } }', [], $b['endpoint'])['account']['organizations'] ?? [];
        if (!$orgs) throw new RuntimeException('Geen organisatie gevonden in dit Buffer-account.');
        $b['organization_id'] = $orgs[0]['id'];
    }
    return $b;
}

/** GraphQL-verzoek aan Buffer (https://api.buffer.com). Gooit RuntimeException met een leesbare melding. */
function bufferCall(string $key, string $query, array $variables, string $endpoint = 'https://api.buffer.com'): array {
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
        CURLOPT_POSTFIELDS => json_encode(['query' => $query, 'variables' => $variables ?: new stdClass()]),
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) throw new RuntimeException("Buffer niet bereikbaar: $err");
    $json = json_decode((string)$body, true);
    if ($code === 401) throw new RuntimeException('Buffer weigert de API-sleutel (401). Controleer api_key in config.php.');
    if ($code === 429) throw new RuntimeException('Te veel verzoeken aan Buffer. Probeer het over een kwartier opnieuw.');
    if (!empty($json['errors'])) throw new RuntimeException('Buffer: ' . ($json['errors'][0]['message'] ?? 'onbekende fout'));
    if ($code >= 400 || !isset($json['data'])) throw new RuntimeException("Buffer gaf een fout ($code).");
    return $json['data'];
}

/**
 * Afbeeldingen voor Buffer staan als gewone bestanden in exports/ naast de tool: een direct adres dat op .png eindigt,
 * zodat Buffer en Instagram ze zonder login kunnen ophalen. De naam is 32 willekeurige tekens; zoekmachines worden
 * geweerd via de .htaccess van de tool. Deze afbeeldingen komen toch op social media, dus ze zijn niet geheim.
 */
function exportDir(): string {
    $d = dirname(__DIR__) . '/exports';
    if (!is_dir($d) && !mkdir($d, 0755, true) && !is_dir($d)) fail(500, 'Kan de map exports niet maken.');
    if (!is_file("$d/index.html")) @file_put_contents("$d/index.html", ''); // geen bestandslijst tonen
    return $d;
}

function exportUrl(string $name): string {
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $tool = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'))), '/');
    return ($https ? 'https' : 'http') . "://$host$tool/exports/$name";
}

/** Fotobestanden in een map (zonder GLOB_BRACE, dat niet overal bestaat). */
function bankFiles(string $dir, string $pattern): array {
    return array_values(array_filter(glob("$dir/$pattern.*") ?: [], fn($f) => in_array(strtolower(pathinfo($f, PATHINFO_EXTENSION)), ['jpg', 'png', 'webp'], true)));
}

function bankUrl(string $brand, string $id): string {
    $api = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
    return "$api/?action=bank-photo&brand=$brand&id=$id";
}

/** Data-URL in de post wordt een los bestand + link; null wist het bestand; link naar een andere post wordt gekopieerd. */
function storePhoto(array &$doc, string $key, string $fileId, string $brand, string $dataDir): void {
    $src = $doc[$key]['src'] ?? null;
    $fotos = dir_for($dataDir, $brand, 'fotos');
    if (is_string($src) && str_starts_with($src, 'data:')) {
        if (!preg_match('#^data:image/(jpeg|png|webp);base64,#', $src)) fail(400, 'Alleen JPG, PNG of WebP.');
        $bin = base64_decode(substr($src, strpos($src, ',') + 1), true);
        if ($bin === false || strlen($bin) > MAX_PHOTO) fail(413, 'Foto te groot (max 12 MB).');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bin);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) fail(400, 'Dit is geen geldige foto.');
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime];
        foreach (glob("$fotos/$fileId.*") ?: [] as $old) @unlink($old);
        write_atomic("$fotos/$fileId.$ext", $bin);
        $doc[$key]['src'] = photoUrl($brand, $fileId, time());
    } elseif ($src === null) {
        foreach (glob("$fotos/$fileId.*") ?: [] as $old) @unlink($old);
    } elseif (is_string($src) && preg_match('/[?&]id=([a-z0-9-]{4,64})/', $src, $m) && $m[1] !== $fileId) {
        // Foto van een andere post (bijv. een kopie): bestand meekopiëren.
        $from = (glob("$fotos/{$m[1]}.*") ?: [])[0] ?? null;
        if ($from) {
            foreach (glob("$fotos/$fileId.*") ?: [] as $old) @unlink($old);
            copy($from, "$fotos/$fileId." . pathinfo($from, PATHINFO_EXTENSION));
            $doc[$key]['src'] = photoUrl($brand, $fileId, time());
        }
    }
}

$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];
if (!is_dir($dataDir)) mkdir($dataDir, 0750, true);

switch ($action) {
    case 'status': {
        $brand = (string)($_GET['brand'] ?? '');
        $known = preg_match(BRAND_RE, $brand) && isset($config['brands'][$brand]);
        out(200, ['server' => true, 'setup' => false, 'open' => isOpen(), 'brand' => $known ? $brand : null, 'loggedIn' => $known && (isOpen() || in_array($brand, $_SESSION['brands'] ?? [], true) || !empty($_SESSION['admin']))]);
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

        // Foto 1 wordt <id>.jpg, foto 2 wordt <id>-p2.jpg.
        storePhoto($doc, 'photo', $id, $brand, $dataDir);
        storePhoto($doc, 'photo2', "$id-p2", $brand, $dataDir);

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
        foreach ([...(glob(dir_for($dataDir, $brand, 'fotos') . "/$id.*") ?: []), ...(glob(dir_for($dataDir, $brand, 'fotos') . "/$id-p2.*") ?: [])] as $f) @unlink($f);
        out(200, ['ok' => true]);
    }

    // ---------- Fotobank: gedeelde voorraad foto's per merk (data/<merk>/fotobank/) ----------
    case 'bank-list': {
        $brand = brandParam($config);
        requireAuth($brand);
        $items = [];
        foreach (bankFiles(dir_for($dataDir, $brand, 'fotobank'), '*') as $f) {
            $id = pathinfo($f, PATHINFO_FILENAME);
            $meta = json_decode((string)@file_get_contents(dirname($f) . "/$id.json"), true) ?: [];
            $items[] = ['id' => $id, 'name' => (string)($meta['name'] ?? $id), 'added' => (string)($meta['added'] ?? gmdate('Y-m-d\TH:i:s\Z', filemtime($f))), 'src' => bankUrl($brand, $id)];
        }
        usort($items, fn($a, $b) => strcmp($b['added'], $a['added']));
        out(200, ['photos' => $items]);
    }

    case 'bank-upload': {
        if ($method !== 'POST') fail(405, 'Alleen POST.');
        $brand = brandParam($config);
        requireAuth($brand);
        $in = input();
        $src = (string)($in['src'] ?? '');
        if (!preg_match('#^data:image/(jpeg|png|webp);base64,#', $src)) fail(400, 'Alleen JPG, PNG of WebP.');
        $bin = base64_decode(substr($src, strpos($src, ',') + 1), true);
        if ($bin === false || strlen($bin) > MAX_PHOTO) fail(413, 'Foto te groot (max 12 MB).');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bin);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) fail(400, 'Dit is geen geldige foto.');
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime];
        $id = 'f' . bin2hex(random_bytes(6));
        $dir = dir_for($dataDir, $brand, 'fotobank');
        write_atomic("$dir/$id.$ext", $bin);
        $name = mb_substr(preg_replace('/[^\p{L}\p{N} ._-]/u', '', (string)($in['name'] ?? '')), 0, 80);
        $added = gmdate('Y-m-d\TH:i:s\Z');
        write_atomic("$dir/$id.json", json_encode(['name' => $name, 'added' => $added], JSON_UNESCAPED_UNICODE));
        out(200, ['photo' => ['id' => $id, 'name' => $name, 'added' => $added, 'src' => bankUrl($brand, $id)]]);
    }

    case 'bank-delete': {
        if ($method !== 'POST') fail(405, 'Alleen POST.');
        $brand = brandParam($config);
        requireAuth($brand);
        $id = (string)(input()['id'] ?? '');
        if (!preg_match(ID_RE, $id)) fail(400, 'Ongeldige foto.');
        foreach (glob(dir_for($dataDir, $brand, 'fotobank') . "/$id.*") ?: [] as $f) @unlink($f);
        out(200, ['ok' => true]);
    }

    case 'bank-photo': {
        $brand = brandParam($config);
        requireAuth($brand);
        $id = (string)($_GET['id'] ?? '');
        if (!preg_match(ID_RE, $id)) fail(400, 'Ongeldige foto.');
        $f = bankFiles(dir_for($dataDir, $brand, 'fotobank'), $id)[0] ?? null;
        if (!$f) fail(404, 'Foto niet gevonden.');
        header_remove('Cache-Control');
        header('Cache-Control: private, max-age=31536000, immutable');
        header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($f));
        header('Content-Length: ' . filesize($f));
        readfile($f);
        exit;
    }

    // ---------- Buffer: post als concept naar Buffer ----------
    case 'buffer-channels': {
        $brand = brandParam($config);
        requireAuth($brand);
        try { $b = bufferConfig($config, $brand); } catch (RuntimeException $e) { fail(502, $e->getMessage()); }
        if (!$b) out(200, ['configured' => false, 'channels' => []]);
        $res = bufferCall($b['api_key'], 'query GetChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName service type isLocked isDisconnected } }',
            ['organizationId' => $b['organization_id']], $b['endpoint']);
        $channels = array_values(array_filter($res['channels'] ?? [], fn($c) =>
            in_array($c['service'], ['instagram', 'facebook'], true) && !$c['isLocked'] && !$c['isDisconnected']));
        out(200, ['configured' => true, 'channels' => $channels]);
    }

    case 'buffer-send': {
        if ($method !== 'POST') fail(405, 'Alleen POST.');
        $brand = brandParam($config);
        requireAuth($brand);
        try { $b = bufferConfig($config, $brand); } catch (RuntimeException $e) { fail(502, $e->getMessage()); }
        if (!$b) fail(400, 'Buffer is nog niet ingesteld voor dit merk (config.php).');
        $in = input();
        $text = mb_substr((string)($in['caption'] ?? ''), 0, 2200);
        // 1. Afbeeldingen per formaat opslaan op een vast, onraadbaar adres (Buffer haalt ze op bij publiceren).
        $urls = [];
        foreach ((array)($in['images'] ?? []) as $format => $src) {
            if (!preg_match('/^[a-z0-9]{2,12}$/', (string)$format)) fail(400, 'Ongeldig formaat.');
            if (!is_string($src) || !str_starts_with($src, 'data:image/png;base64,')) fail(400, 'Afbeelding moet PNG zijn.');
            $bin = base64_decode(substr($src, 22), true);
            if ($bin === false || strlen($bin) > MAX_PHOTO) fail(413, 'Afbeelding te groot.');
            if ((new finfo(FILEINFO_MIME_TYPE))->buffer($bin) !== 'image/png') fail(400, 'Dit is geen PNG.');
            $name = bin2hex(random_bytes(16)) . '.png';
            write_atomic(exportDir() . "/$name", $bin);
            $urls[$format] = exportUrl($name);
        }
        // 2. Per gekozen kanaal en formaat een concept in Buffer.
        $results = [];
        foreach ((array)($in['targets'] ?? []) as $t) {
            $channelId = (string)($t['channelId'] ?? '');
            $service = (string)($t['service'] ?? '');
            $kind = ($t['kind'] ?? 'post') === 'story' ? 'story' : 'post';
            $format = (string)($t['format'] ?? '');
            if (!preg_match('/^[A-Za-z0-9]{6,40}$/', $channelId) || !isset($urls[$format])) { $results[] = ['ok' => false, 'error' => 'Ongeldig kanaal of formaat.']; continue; }
            $post = [
                'channelId' => $channelId,
                'text' => $text,
                'schedulingType' => ($t['notification'] ?? false) ? 'notification' : 'automatic',
                'mode' => 'addToQueue',
                'saveToDraft' => true,
                'assets' => [['image' => ['url' => $urls[$format]]]],
            ];
            if ($service === 'instagram') $post['metadata'] = ['instagram' => ['type' => $kind, 'shouldShareToFeed' => $kind === 'post']];
            if ($service === 'facebook') $post['metadata'] = ['facebook' => ['type' => $kind]];
            try {
                $res = bufferCall($b['api_key'], 'mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }', ['input' => $post], $b['endpoint']);
                $r = $res['createPost'] ?? [];
                $results[] = isset($r['post']['id']) ? ['ok' => true, 'postId' => $r['post']['id'], 'channelId' => $channelId, 'kind' => $kind]
                                                     : ['ok' => false, 'channelId' => $channelId, 'kind' => $kind, 'error' => (string)($r['message'] ?? 'Onbekende fout van Buffer.')];
            } catch (RuntimeException $e) {
                $results[] = ['ok' => false, 'channelId' => $channelId, 'kind' => $kind, 'error' => $e->getMessage()];
            }
        }
        out(200, ['results' => $results]);
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
