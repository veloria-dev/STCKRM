<?php
// NOTE: api.php connects to the database on its own and does NOT include this file.
// This file is only here in case some other script you have references it.
// You can safely delete it if nothing else uses it.

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$host = "sql113.infinityfree.com";
$user = "if0_42619504";
$pass = "E5YeO5CKlOk";
$db   = "if0_42619504_stockroom_db";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die("MySQL Error: " . $conn->connect_error);
}