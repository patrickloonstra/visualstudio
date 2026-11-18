<?php
// Kopieer naar config.php en vul de codes in. config.php staat NIET in git.
// Een hash maak je met:  php -r 'echo password_hash("jouw-code", PASSWORD_DEFAULT), PHP_EOL;'
// of met:                 php tools/hash.php jouw-code
return [
    // Waar posts en foto's staan. Standaard één map BOVEN de webmap van het subdomein,
    // dus niet via internet bereikbaar. (Plesk: /var/www/vhosts/<domein>/merkstudio-data)
    // Lukt dat niet, gebruik dan __DIR__ . '/../data' (afgeschermd met .htaccess, minder veilig).
    'data_dir' => dirname(__DIR__, 2) . '/merkstudio-data',

    // Toegangscode per merk (als hash). De sleutel is de mapnaam van het merk.
    'brands' => [
        'vinchem' => '$2y$10$VERVANG_DOOR_HASH',
    ],

    // Beheercode voor Patrick: werkt bij elk merk.
    'admin_hash' => '$2y$10$VERVANG_DOOR_HASH',
];
