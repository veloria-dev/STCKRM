<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// --- LOCAL (XAMPP) database configuration ---
$host = "sql113.infinityfree.com";
$user = "if0_42619504";
$pass = "E5YeO5CKlOk";
$db   = "if0_42619504_stockroom_db";

// --- Gmail backup configuration ---
// 1. Go to https://myaccount.google.com/apppasswords (needs 2-Step Verification ON)
// 2. Create an "App Password" for "Mail" — Google gives you a 16-letter code.
// 3. Paste that code below as GMAIL_APP_PASSWORD (NOT your normal Gmail password).
// 4. BACKUP_TO_EMAIL is where the backup file gets sent — can be the same Gmail or any other address.
define('GMAIL_ADDRESS',      'youraccount@gmail.com');
define('GMAIL_APP_PASSWORD', 'xxxxxxxxxxxxxxxx');
define('BACKUP_TO_EMAIL',    'youraccount@gmail.com');   // fallback inbox; owners' own Google email is used when available

// --- Google sign-in (owners) ---
// Paste your OAuth "Web client" ID here (see GOOGLE_LOGIN_SETUP.md). It is public, not a secret.
define('GOOGLE_CLIENT_ID', "968700595187-0t2kba2l2nermoijoub4ceb18rir0dpo.apps.googleusercontent.com");

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}
function out($data){ echo json_encode($data,JSON_UNESCAPED_UNICODE); exit; }
function body(){ $raw=file_get_contents('php://input'); return $raw?json_decode($raw,true):[]; }
function today(){ return date('Y-m-d'); }
function ownerId(){ return (int)($_SESSION['owner_id']??0); }
function requireRole($role){ if(($_SESSION['role']??'')!==$role || ownerId()<=0){ http_response_code(401); out(['ok'=>false,'error'=>'Unauthorized']); } }

// Every owner (Google account) has their own staff code. Whoever logs in with that code
// is working inside THAT owner's data only.
function newStaffCode($pdo,$oid){
  $chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mix-ups
  do{
    $c=''; for($i=0;$i<9;$i++) $c.=$chars[random_int(0,strlen($chars)-1)];
    $q=$pdo->prepare("SELECT 1 FROM staff_codes WHERE code=?"); $q->execute([$c]);
  }while($q->fetch());
  $pdo->prepare("UPDATE staff_codes SET active=0 WHERE owner_id=?")->execute([$oid]);
  $pdo->prepare("INSERT INTO staff_codes(code,active,owner_id) VALUES(?,1,?)")->execute([$c,$oid]);
  return $c;
}
function currentStaffCode($pdo,$oid){
  $q=$pdo->prepare("SELECT code FROM staff_codes WHERE owner_id=? AND active=1 ORDER BY id DESC LIMIT 1"); $q->execute([$oid]); $r=$q->fetch();
  return $r?$r['code']:newStaffCode($pdo,$oid);
}
function verifyGoogleToken($idToken){
  if(GOOGLE_CLIENT_ID==='PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com') throw new Exception('Google sign-in is not set up yet — add GOOGLE_CLIENT_ID in api.php.');
  if(!$idToken) throw new Exception('Missing Google sign-in token.');
  $url='https://oauth2.googleapis.com/tokeninfo?id_token='.urlencode($idToken);
  $resp=null;
  if(function_exists('curl_init')){ $ch=curl_init($url); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10]); $resp=curl_exec($ch); curl_close($ch); }
  if(!$resp){ $resp=@file_get_contents($url,false,stream_context_create(['http'=>['timeout'=>10]])); } // fallback if cURL is blocked (some free hosts)
  if(!$resp) throw new Exception('Could not reach Google to verify your sign-in (no internet on this computer right now?).');
  $j=json_decode($resp,true);
  $verified=in_array(($j['email_verified']??false),[true,'true'],true);
  if(!is_array($j) || ($j['aud']??'')!==GOOGLE_CLIENT_ID || !in_array(($j['iss']??''),['accounts.google.com','https://accounts.google.com'],true) || !$verified || empty($j['email']) || empty($j['sub'])){
    http_response_code(401); throw new Exception('Google sign-in could not be verified.');
  }
  return $j;
}

function archiveDay($pdo,$date,$oid){
  $q=$pdo->prepare("SELECT COUNT(*) c FROM daily_reports WHERE report_date=? AND owner_id=?"); $q->execute([$date,$oid]); if((int)$q->fetch()['c']>0)return;
  $foods=$pdo->prepare("SELECT id,name,price,stock,type FROM foods WHERE owner_id=? ORDER BY name"); $foods->execute([$oid]); $foods=$foods->fetchAll();
  $subs=$pdo->prepare("SELECT staff_name,location,food_id,item_name,price,taken,returned,sold,sales,submitted_at FROM submissions WHERE report_date=? AND owner_id=? ORDER BY submitted_at"); $subs->execute([$date,$oid]); $subs=$subs->fetchAll();

  // Aggregate that day's submissions PER ITEM so the saved snapshot actually
  // remembers how much was taken/returned/sold/earned — not just the foods table.
  $agg=[];
  foreach($subs as $s){
    $key=$s['food_id'];
    if(!isset($agg[$key])) $agg[$key]=['taken'=>0,'returned'=>0,'sold'=>0,'sales'=>0];
    $agg[$key]['taken']+=(int)$s['taken'];
    $agg[$key]['returned']+=(int)$s['returned'];
    $agg[$key]['sold']+=(int)$s['sold'];
    $agg[$key]['sales']+=(float)$s['sales'];
  }
  $items=array_map(function($f) use ($agg){
    $a=$agg[$f['id']]??['taken'=>0,'returned'=>0,'sold'=>0,'sales'=>0];
    return [
      'name'=>$f['name'],'price'=>$f['price'],'stock'=>$f['stock'],'type'=>$f['type'],
      'taken'=>$a['taken'],'returned'=>$a['returned'],'sold'=>$a['sold'],'sales'=>$a['sales']
    ];
  },$foods);

  $sales=array_sum(array_map(fn($i)=>(float)$i['sales'],$items)); $sold=array_sum(array_map(fn($i)=>(int)$i['sold'],$items)); $stock=array_sum(array_map(fn($i)=>(int)$i['stock'],$items));
  $st=$pdo->prepare("INSERT INTO daily_reports(owner_id,report_date,totals_json,items_json,submissions_json) VALUES(?,?,?,?,?)");
  $st->execute([$oid,$date,json_encode(['sales'=>$sales,'sold'=>$sold,'stock'=>$stock]),json_encode($items),json_encode($subs)]);
}

// --- Automatic daily archiving (server-side, runs on every request, no button needed) ---
function ensureSettings($pdo){
  $pdo->exec("CREATE TABLE IF NOT EXISTS settings (k VARCHAR(64) PRIMARY KEY, v VARCHAR(64) NOT NULL)");
  // Per-owner preferences (shop name, etc.). utf8mb4 so names like "Aling Nena's Café 🍌" are fine.
  $pdo->exec("CREATE TABLE IF NOT EXISTS owner_settings (owner_id INT NOT NULL, k VARCHAR(64) NOT NULL, v VARCHAR(255) NOT NULL, PRIMARY KEY(owner_id,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
function lastKey($oid){ return 'last_archived_'.$oid; }
function getLastArchived($pdo,$oid){
  $st=$pdo->prepare("SELECT v FROM settings WHERE k=?"); $st->execute([lastKey($oid)]); $q=$st->fetch();
  if($q) return $q['v'];
  $d=today(); // brand-new owner: start archiving from today
  $st=$pdo->prepare("INSERT INTO settings(k,v) VALUES(?,?)"); $st->execute([lastKey($oid),$d]);
  return $d;
}
function setLastArchived($pdo,$oid,$d){
  $st=$pdo->prepare("INSERT INTO settings(k,v) VALUES(?,?) ON DUPLICATE KEY UPDATE v=?"); $st->execute([lastKey($oid),$d,$d]);
}
function autoArchive($pdo){
  ensureSettings($pdo);
  $owners=$pdo->query("SELECT id FROM users WHERE role='owner' AND active=1")->fetchAll();
  foreach($owners as $o){
    $oid=(int)$o['id']; $cursor=getLastArchived($pdo,$oid); $guard=0;
    while($cursor < today() && $guard<400){
      archiveDay($pdo,$cursor,$oid);
      $next=date('Y-m-d', strtotime($cursor.' +1 day'));
      setLastArchived($pdo,$oid,$next); // store the NEXT day to archive, so a finished day is never re-archived / re-emailed
      // Best-effort email of that day's backup. Never break the app if this fails.
      try{ emailBackup($pdo,$oid,"Stockroom auto-backup — $cursor"); }catch(Throwable $ignore){}
      $cursor=$next; $guard++;
    }
  }
}

// --- Full backup builder + Gmail SMTP sender (no external library needed) ---
function buildBackupJson($pdo,$oid){
  $q=function($sql) use($pdo,$oid){ $s=$pdo->prepare($sql); $s->execute([$oid]); return $s->fetchAll(); };
  $foods=$q("SELECT * FROM foods WHERE owner_id=? ORDER BY name");
  $submissions=$q("SELECT * FROM submissions WHERE owner_id=? ORDER BY report_date,submitted_at");
  $reports=$q("SELECT * FROM daily_reports WHERE owner_id=? ORDER BY report_date");
  return json_encode([
    'generated_at'=>date('c'),
    'foods'=>$foods,
    'submissions'=>$submissions,
    'daily_reports'=>$reports
  ], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
}
function smtpRead($socket){ $data=''; while(($str=fgets($socket,515))!==false){ $data.=$str; if(isset($str[3]) && $str[3]===' ') break; } return $data; }
function smtpCmd($socket,$cmd){ fwrite($socket,$cmd."\r\n"); return smtpRead($socket); }
function sendGmailEmail($toEmail,$subject,$bodyText,$attachmentName,$attachmentContent){
  if(GMAIL_ADDRESS==='youraccount@gmail.com' || GMAIL_APP_PASSWORD==='xxxxxxxxxxxxxxxx'){
    throw new Exception('Gmail backup is not configured yet — set GMAIL_ADDRESS and GMAIL_APP_PASSWORD at the top of api.php.');
  }
  $socket=@stream_socket_client('ssl://smtp.gmail.com:465',$errno,$errstr,15);
  if(!$socket) throw new Exception("Could not reach Gmail (no internet on this computer right now?): $errstr");
  smtpRead($socket);
  smtpCmd($socket,'EHLO localhost');
  smtpCmd($socket,'AUTH LOGIN');
  smtpCmd($socket, base64_encode(GMAIL_ADDRESS));
  $authResp = smtpCmd($socket, base64_encode(GMAIL_APP_PASSWORD));
  if(strpos($authResp,'235')===false){ fclose($socket); throw new Exception('Gmail login failed — check GMAIL_ADDRESS/GMAIL_APP_PASSWORD in api.php.'); }
  smtpCmd($socket,'MAIL FROM: <'.GMAIL_ADDRESS.'>');
  smtpCmd($socket,'RCPT TO: <'.$toEmail.'>');
  smtpCmd($socket,'DATA');
  $boundary='stockroom_'.md5(uniqid());
  $headers = "From: Stockroom <".GMAIL_ADDRESS.">\r\nTo: <$toEmail>\r\nSubject: $subject\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$boundary\"\r\n\r\n";
  $msg  = "--$boundary\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n$bodyText\r\n\r\n";
  $msg .= "--$boundary\r\nContent-Type: application/json; name=\"$attachmentName\"\r\nContent-Disposition: attachment; filename=\"$attachmentName\"\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($attachmentContent))."\r\n";
  $msg .= "--$boundary--\r\n";
  smtpCmd($socket, $headers.$msg."\r\n.");
  smtpCmd($socket,'QUIT');
  fclose($socket);
}
function emailBackup($pdo,$oid,$subject,$silent=false){
  $json=buildBackupJson($pdo,$oid);
  $st=$pdo->prepare("SELECT email FROM users WHERE id=?"); $st->execute([$oid]); $email=(string)($st->fetch()['email']??'');
  $to=(filter_var($email,FILTER_VALIDATE_EMAIL) && $email!=='admin@stockroom.com') ? $email : BACKUP_TO_EMAIL;
  $filename='stockroom_backup_'.today().'.json';
  sendGmailEmail($to,$subject,"Attached is your full Stockroom backup (foods, submissions, and daily reports) as of ".date('F j, Y g:i A').".",$filename,$json);
}

$action=$_GET['action']??'';
try{
  autoArchive($pdo);
  if($action==='bootstrap'){
    $oid=ownerId(); $role=$_SESSION['role']??null;
    $gid=(GOOGLE_CLIENT_ID==='PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com')?'':GOOGLE_CLIENT_ID;
    if(!$oid) out(['ok'=>true,'date'=>today(),'foods'=>[],'submissions'=>[],'reports'=>[],'role'=>null,'google_client_id'=>$gid]);
    $foods=$pdo->prepare("SELECT id,name,price,stock,type FROM foods WHERE active=1 AND owner_id=? ORDER BY name"); $foods->execute([$oid]); $foods=$foods->fetchAll();
    $subs=$pdo->prepare("SELECT id,staff_name staff,location,item_name item,type,taken,returned,sold,sales,TIME_FORMAT(submitted_at,'%h:%i %p') time FROM submissions WHERE report_date=? AND owner_id=? ORDER BY submitted_at DESC"); $subs->execute([today(),$oid]); $subs=$subs->fetchAll();
    $reports=$pdo->prepare("SELECT report_date,totals_json,submissions_json FROM daily_reports WHERE owner_id=? ORDER BY report_date DESC"); $reports->execute([$oid]); $reports=$reports->fetchAll();
    $reports=array_map(function($r){$t=json_decode($r['totals_json'],true)?:[];$s=json_decode($r['submissions_json'],true)?:[];return ['date'=>$r['report_date'],'totals'=>$t,'submissions'=>$s];},$reports);
    $res=['ok'=>true,'date'=>today(),'foods'=>$foods,'submissions'=>$subs,'reports'=>$reports,'role'=>$role,'google_client_id'=>$gid];
    if($role==='owner'){
      $res['staff_code']=currentStaffCode($pdo,$oid);
      $u=$pdo->prepare("SELECT email,name,google_id,password_hash FROM users WHERE id=?"); $u->execute([$oid]); $u=$u->fetch()?:[];
      $sn=$pdo->prepare("SELECT v FROM owner_settings WHERE owner_id=? AND k='shop_name'"); $sn->execute([$oid]); $sn=$sn->fetch();
      $res['owner']=['email'=>$u['email']??'','name'=>$u['name']??'','google'=>!empty($u['google_id']),'has_password'=>!empty($u['password_hash']),'shop_name'=>$sn?$sn['v']:''];
    }
    out($res);
  }
  if($action==='login'){
    $b=body(); $email=strtolower(trim($b['email']??'')); $password=$b['password']??'';
    $st=$pdo->prepare("SELECT id FROM users WHERE email=? AND password_hash=? AND role='owner' AND active=1"); $st->execute([$email,hash('sha256',$password)]);
    $u=$st->fetch();
    if(!$u){http_response_code(401);out(['ok'=>false,'error'=>'Incorrect owner email or password.']);}
    session_regenerate_id(true); $_SESSION['role']='owner'; $_SESSION['owner_id']=(int)$u['id']; out(['ok'=>true,'role'=>'owner']);
  }
  // Google sign-in AND sign-up in one step: existing owner -> logs in, new Google account -> owner account is created.
  if($action==='google_login'){
    $b=body(); $g=verifyGoogleToken($b['credential']??'');
    $email=strtolower($g['email']); $sub=$g['sub']; $name=$g['name']??$email;
    $st=$pdo->prepare("SELECT id,active FROM users WHERE role='owner' AND (google_id=? OR email=?) LIMIT 1"); $st->execute([$sub,$email]); $u=$st->fetch();
    $created=false;
    if($u && !(int)$u['active']){http_response_code(401);out(['ok'=>false,'error'=>'This account is disabled.']);}
    if(!$u){
      $st=$pdo->prepare("INSERT INTO users(email,password_hash,role,google_id,name) VALUES(?,NULL,'owner',?,?)"); $st->execute([$email,$sub,$name]);
      $oid=(int)$pdo->lastInsertId(); newStaffCode($pdo,$oid); $created=true;
    } else {
      $oid=(int)$u['id'];
      $st=$pdo->prepare("UPDATE users SET google_id=?,name=? WHERE id=?"); $st->execute([$sub,$name,$oid]);
    }
    session_regenerate_id(true); $_SESSION['role']='owner'; $_SESSION['owner_id']=$oid;
    out(['ok'=>true,'role'=>'owner','created'=>$created,'name'=>$name]);
  }
  if($action==='signup'){
    $b=body(); $email=strtolower(trim($b['email']??'')); $password=(string)($b['password']??'');
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)){http_response_code(400);out(['ok'=>false,'error'=>'Please enter a valid email address.']);}
    if(strlen($password)<8){http_response_code(400);out(['ok'=>false,'error'=>'Password must be at least 8 characters.']);}
    $st=$pdo->prepare("SELECT id FROM users WHERE email=?"); $st->execute([$email]);
    if($st->fetch()){http_response_code(409);out(['ok'=>false,'error'=>'An account with this email already exists. Please sign in instead.']);}
    $st=$pdo->prepare("INSERT INTO users(email,password_hash,role) VALUES(?,?,'owner')"); $st->execute([$email,hash('sha256',$password)]);
    $oid=(int)$pdo->lastInsertId(); newStaffCode($pdo,$oid);
    session_regenerate_id(true); $_SESSION['role']='owner'; $_SESSION['owner_id']=$oid;
    out(['ok'=>true,'role'=>'owner','created'=>true]);
  }
  if($action==='staff_login'){
    $b=body(); $code=strtoupper(trim($b['code']??'')); $st=$pdo->prepare("SELECT owner_id FROM staff_codes WHERE code=? AND active=1 AND owner_id IS NOT NULL"); $st->execute([$code]);
    $c=$st->fetch();
    if(!$c){http_response_code(401);out(['ok'=>false,'error'=>'That staff code is not valid.']);}
    session_regenerate_id(true); $_SESSION['role']='staff'; $_SESSION['owner_id']=(int)$c['owner_id']; out(['ok'=>true,'role'=>'staff']);
  }
  if($action==='new_code'){ requireRole('owner'); out(['ok'=>true,'code'=>newStaffCode($pdo,ownerId())]); }
  if($action==='save_shop'){
    requireRole('owner'); $b=body(); $n=trim((string)($b['name']??'')); $n=function_exists('mb_substr')?mb_substr($n,0,60):substr($n,0,60);
    $st=$pdo->prepare("INSERT INTO owner_settings(owner_id,k,v) VALUES(?,'shop_name',?) ON DUPLICATE KEY UPDATE v=?"); $st->execute([ownerId(),$n,$n]);
    out(['ok'=>true,'shop_name'=>$n]);
  }
  if($action==='change_password'){
    requireRole('owner'); $b=body(); $cur=(string)($b['current']??''); $new=(string)($b['new']??'');
    if(strlen($new)<8){http_response_code(400);out(['ok'=>false,'error'=>'New password must be at least 8 characters.']);}
    $st=$pdo->prepare("SELECT password_hash FROM users WHERE id=?"); $st->execute([ownerId()]); $row=$st->fetch();
    if(!empty($row['password_hash']) && !hash_equals($row['password_hash'],hash('sha256',$cur))){http_response_code(400);out(['ok'=>false,'error'=>'Current password is incorrect.']);}
    $st=$pdo->prepare("UPDATE users SET password_hash=? WHERE id=?"); $st->execute([hash('sha256',$new),ownerId()]);
    out(['ok'=>true]);
  }
  if($action==='logout'){ session_destroy(); out(['ok'=>true]); }
  if($action==='foods'){
    requireRole('owner'); $st=$pdo->prepare("SELECT id,name,price,stock,type FROM foods WHERE active=1 AND owner_id=? ORDER BY name"); $st->execute([ownerId()]); out(['ok'=>true,'foods'=>$st->fetchAll()]);
  }
  if($action==='save_food'){
    requireRole('owner'); $oid=ownerId(); $b=body(); $id=trim($b['id']??''); $name=trim($b['name']??''); $price=(float)($b['price']??0); $stock=(int)($b['stock']??0); $type=($b['type']??'food')==='drink'?'drink':'food';
    if($name===''||$price<0||$stock<0)out(['ok'=>false,'error'=>'Invalid food details.']);
    if($id){$st=$pdo->prepare("UPDATE foods SET name=?,price=?,stock=?,type=?,active=1 WHERE id=? AND owner_id=?");$st->execute([$name,$price,$stock,$type,$id,$oid]);}
    else {$id=bin2hex(random_bytes(8));$st=$pdo->prepare("INSERT INTO foods(id,name,price,stock,type,owner_id) VALUES(?,?,?,?,?,?)");$st->execute([$id,$name,$price,$stock,$type,$oid]);}
    out(['ok'=>true]);
  }
  if($action==='delete_food'){
    requireRole('owner'); $b=body(); $st=$pdo->prepare("UPDATE foods SET active=0 WHERE id=? AND owner_id=?");$st->execute([$b['id']??'',ownerId()]); out(['ok'=>true]);
  }
  if($action==='submit'){
    requireRole('staff'); $oid=ownerId(); $b=body(); $staff=trim($b['staff']??'');$loc=trim($b['location']??'');$id=$b['food_id']??'';$drink=!empty($b['drink']);$taken=(int)($b['taken']??0);$returned=(int)($b['returned']??0);$cups=(int)($b['cups']??0);
    if(!$staff||!$loc)out(['ok'=>false,'error'=>'Staff name and selling area are required.']);
    $pdo->beginTransaction();
    $st=$pdo->prepare("SELECT * FROM foods WHERE id=? AND active=1 AND owner_id=? FOR UPDATE");$st->execute([$id,$oid]);$food=$st->fetch(); if(!$food){$pdo->rollBack();out(['ok'=>false,'error'=>'Food is no longer available.']);}
    if($food['type']==='drink'){ $sold=$cups; $taken=$cups; $returned=0; } else { if($returned>$taken){$pdo->rollBack();out(['ok'=>false,'error'=>'Returned stock cannot be greater than stock taken.']);}$sold=$taken-$returned; }
    if($sold<0||$taken<0||$returned<0||$sold>(int)$food['stock']){$pdo->rollBack();out(['ok'=>false,'error'=>'Not enough stock available.']);}
    $st=$pdo->prepare("UPDATE foods SET stock=GREATEST(0, stock-?) WHERE id=? AND owner_id=?");$st->execute([$sold,$id,$oid]);
    $sales=$sold*(float)$food['price'];
    $st=$pdo->prepare("INSERT INTO submissions(owner_id,report_date,staff_name,location,food_id,item_name,price,type,taken,returned,sold,sales) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");$st->execute([$oid,today(),$staff,$loc,$id,$food['name'],$food['price'],$food['type'],$taken,$returned,$sold,$sales]);
    $pdo->commit();
    $newStockRow=$pdo->prepare("SELECT stock FROM foods WHERE id=?"); $newStockRow->execute([$id]); $newStock=(int)$newStockRow->fetch()['stock'];
    out(['ok'=>true,'sold'=>$sold,'sales'=>$sales,'remaining_stock'=>$newStock]);
  }
  if($action==='save_report'){
    requireRole('owner'); archiveDay($pdo,today(),ownerId()); out(['ok'=>true]);
  }
  if($action==='report'){
    requireRole('owner'); $date=$_GET['date']??today(); $st=$pdo->prepare("SELECT * FROM daily_reports WHERE report_date=? AND owner_id=?");$st->execute([$date,ownerId()]);$r=$st->fetch(); if(!$r)out(['ok'=>false,'error'=>'Report not found.']); out(['ok'=>true,'report'=>['date'=>$r['report_date'],'totals'=>json_decode($r['totals_json'],true),'items'=>json_decode($r['items_json'],true),'submissions'=>json_decode($r['submissions_json'],true)]]);
  }
  if($action==='backup_email'){
    requireRole('owner');
    emailBackup($pdo, ownerId(), 'Stockroom full backup — '.date('F j, Y g:i A'));
    out(['ok'=>true]);
  }
  http_response_code(404);out(['ok'=>false,'error'=>'Unknown action']);
}catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); http_response_code(500); out(['ok'=>false,'error'=>$e->getMessage()]); }