<?php
// Kopieer naar config.php en vul de codes in. config.php staat NIET in git.
// Een hash maak je met:  php -r 'echo password_hash("jouw-code", PASSWORD_DEFAULT), PHP_EOL;'
// of met:                 php tools/hash.php jouw-code
return [
    // Waar posts en foto's staan. Standaard één map BOVEN de webmap van het domein, dus niet
    // via internet bereikbaar, ook als de tool in een submap staat (bijv. vinchem.nl/contenttool/).
    // Plesk: /var/www/vhosts/<domein>/merkstudio-data
    // Lukt dat niet ("Kan de opslagmap niet maken"), gebruik dan __DIR__ . '/../data'
    // (afgeschermd met .htaccess, minder veilig).
    'data_dir' => dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2))) . '/merkstudio-data',

    // Toegangscode verplicht? Zet op false om de studio zonder code open te zetten:
    // dan kan iedereen die het adres kent posts maken, bekijken en verwijderen.
    'require_code' => true,

    // Toegangscode per merk (als hash). De sleutel is de mapnaam van het merk.
    'brands' => [
        'vinchem' => '$2y$10$VERVANG_DOOR_HASH',
    ],

    // Buffer (optioneel): posts als concept naar Buffer sturen.
    // api_key: Buffer > Settings > API (publish.buffer.com/settings/api), van het Buffer-account van het merk.
    // organization_id is optioneel: leeg = de eerste organisatie van het account. Zie docs/buffer.md.
    'buffer' => [
        // 'vinchem' => ['api_key' => 'PLAK_HIER_DE_SLEUTEL'],
    ],

    // Beheercode voor Patrick: werkt bij elk merk.
    'admin_hash' => '$2y$10$VERVANG_DOOR_HASH',
];
