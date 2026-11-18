<?php
// Gebruik: php tools/hash.php <code>
if ($argc < 2) { fwrite(STDERR, "Gebruik: php tools/hash.php <code>\n"); exit(1); }
echo password_hash($argv[1], PASSWORD_DEFAULT), PHP_EOL;
