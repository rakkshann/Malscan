/*
  MalScan YARA Ruleset — common_threats.yar
  Covers: EICAR, PowerShell obfuscation, document exploits,
          PE packers, RATs, banking trojans, Indian threat context.
*/

// ── EICAR Test File ───────────────────────────────────────────────────────────

rule EICAR_Test_File {
    meta:
        description = "EICAR standard antivirus test file"
        severity    = "informational"
    strings:
        $eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    condition:
        $eicar
}

// ── PowerShell Obfuscation ────────────────────────────────────────────────────

rule PowerShell_EncodedCommand {
    meta:
        description = "PowerShell -EncodedCommand or -enc flag — commonly used to hide malicious scripts"
        severity    = "high"
    strings:
        $enc1 = "-EncodedCommand" nocase
        $enc2 = " -enc " nocase
        $enc3 = " -e " nocase
        $b64  = /[A-Za-z0-9+\/]{100,}={0,2}/
    condition:
        ($enc1 or $enc2 or $enc3) and $b64
}

rule PowerShell_DownloadCradle {
    meta:
        description = "PowerShell download-and-execute cradle — malware delivery technique"
        severity    = "critical"
    strings:
        $dl1 = "DownloadString" nocase
        $dl2 = "DownloadFile" nocase
        $dl3 = "WebClient" nocase
        $dl4 = "Invoke-Expression" nocase
        $dl5 = "IEX(" nocase
        $dl6 = "Net.WebClient" nocase
    condition:
        2 of ($dl*)
}

rule PowerShell_AMSI_Bypass {
    meta:
        description = "Attempt to disable AMSI (Windows antimalware interface)"
        severity    = "critical"
    strings:
        $amsi1 = "amsiInitFailed" nocase
        $amsi2 = "AmsiScanBuffer" nocase
        $amsi3 = "[Ref].Assembly.GetType" nocase
        $amsi4 = "System.Management.Automation.AmsiUtils" nocase
    condition:
        any of ($amsi*)
}

// ── Executable in Document ────────────────────────────────────────────────────

rule PE_In_Document {
    meta:
        description = "Windows executable (MZ/PE header) embedded inside a document or archive"
        severity    = "high"
    strings:
        $mz   = { 4D 5A }
        $pe   = { 50 45 00 00 }
        $pdf  = "%PDF"
        $zip  = { 50 4B 03 04 }
    condition:
        ($mz at 0) and $pe and not ($pdf at 0) and not ($zip at 0)
}

rule Base64_Encoded_PE {
    meta:
        description = "Base64-encoded Windows executable — common obfuscation for malware dropper"
        severity    = "high"
    strings:
        // MZ header base64-encoded: TVo = base64("MZ")
        $b64_mz1 = "TVqQAAMAAAA" nocase
        $b64_mz2 = "TVpAAA" nocase
        $b64_mz3 = "TVo" nocase
    condition:
        any of ($b64_mz*)
}

// ── Document Exploits ─────────────────────────────────────────────────────────

rule PDF_JavaScript_Exploit {
    meta:
        description = "PDF with JavaScript that uses known exploit patterns"
        severity    = "critical"
    strings:
        $js1 = "/JavaScript"
        $js2 = "/JS "
        $ev1 = "eval("   nocase
        $ev2 = "unescape" nocase
        $ev3 = "String.fromCharCode" nocase
    condition:
        ($js1 or $js2) and any of ($ev*)
}

rule PDF_AutoAction {
    meta:
        description = "PDF with automatic action that triggers without user interaction"
        severity    = "high"
    strings:
        $aa1 = "/OpenAction"
        $aa2 = "/AA "
        $aa3 = "/Launch"
    condition:
        any of ($aa*)
}

rule Office_AutoOpen_Macro {
    meta:
        description = "Office document with auto-executing macro (AutoOpen/Document_Open)"
        severity    = "critical"
    strings:
        $auto1 = "AutoOpen"        nocase
        $auto2 = "Document_Open"   nocase
        $auto3 = "Workbook_Open"   nocase
        $auto4 = "Auto_Open"       nocase
        $shell = "Shell("          nocase
        $wscr  = "WScript"         nocase
        $cobj  = "CreateObject"    nocase
    condition:
        any of ($auto*) and any of ($shell, $wscr, $cobj)
}

rule Office_DDE_Exploit {
    meta:
        description = "Office DDE field injection — executes commands without macros"
        severity    = "critical"
    strings:
        $dde1 = "DDEAUTO" nocase
        $dde2 = "DDE("    nocase
        $cmd  = "cmd"     nocase
        $ps   = "powershell" nocase
    condition:
        ($dde1 or $dde2) and ($cmd or $ps)
}

// ── Suspicious Network Activity ───────────────────────────────────────────────

rule Hardcoded_TOR_Onion {
    meta:
        description = "Hardcoded .onion address — C2 communication over TOR"
        severity    = "high"
    strings:
        $onion = /[a-z2-7]{16,56}\.onion/ nocase
    condition:
        $onion
}

rule Suspicious_IP_C2 {
    meta:
        description = "Multiple hardcoded IP addresses — potential C2 infrastructure"
        severity    = "medium"
    strings:
        $ip = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/
    condition:
        #ip > 10
}

// ── RAT / Remote Access Trojans ───────────────────────────────────────────────

rule Generic_RAT_Strings {
    meta:
        description = "Generic remote access trojan capability strings"
        severity    = "high"
    strings:
        $screen  = "screenshot"      nocase
        $keylog  = "keylogger"       nocase
        $webcam  = "webcam"          nocase
        $rdp     = "RemoteDesktop"   nocase
        $upload  = "upload_file"     nocase
        $dload   = "download_file"   nocase
        $reverse = "reverse_shell"   nocase
        $cmd     = "execute_command" nocase
    condition:
        3 of them
}

rule Njrat_Indicators {
    meta:
        description = "njRAT / Bladabindi — common in targeted attacks against Indian organisations"
        severity    = "critical"
    strings:
        $str1 = "njrat"        nocase
        $str2 = "Bladabindi"   nocase
        $str3 = "HvncPlugin"   nocase
        $str4 = "Microsoft\\Windows NT\\CurrentVersion\\Run" nocase
        $reg  = "\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" nocase
    condition:
        any of ($str*) or ($reg and 1 of ($str*))
}

rule AsyncRAT_Indicators {
    meta:
        description = "AsyncRAT — remote access trojan delivered via phishing documents"
        severity    = "critical"
    strings:
        $s1 = "AsyncRAT"      nocase
        $s2 = "HRZN"          nocase
        $s3 = "AES_decrypt"   nocase
        $s4 = "GetInstallPath" nocase
    condition:
        2 of them
}

// ── Banking Trojans (India-specific context) ──────────────────────────────────

rule Drinik_Banking_Trojan {
    meta:
        description = "Drinik Android banking trojan — targets Indian bank customers"
        severity    = "critical"
    strings:
        $str1 = "iAssist"          nocase
        $str2 = "drinikapk"        nocase
        $str3 = "incometax.gov"    nocase
        $str4 = "income_tax"       nocase
        $sbi  = "sbi"              nocase
        $acc  = "accessibilityservice" nocase
    condition:
        ($str1 or $str2) or ($str3 and $acc) or ($sbi and $acc and $str4)
}

rule FakeCalls_Banking_App {
    meta:
        description = "FakeCalls Android malware — impersonates bank customer care in India"
        severity    = "critical"
    strings:
        $hana  = "hanaBankServiceCode" nocase
        $call  = "FakeCall"            nocase
        $bank  = "bankCallService"     nocase
        $hdfc  = "hdfcbank"            nocase
        $icici = "icicibank"           nocase
        $axis  = "axisbank"            nocase
    condition:
        $hana or $call or $bank or ($hdfc and $axis)
}

rule Generic_Banking_Overlay {
    meta:
        description = "Generic banking overlay trojan indicators"
        severity    = "high"
    strings:
        $overlay1 = "android.permission.BIND_ACCESSIBILITY_SERVICE" nocase
        $overlay2 = "android.permission.SYSTEM_ALERT_WINDOW" nocase
        $overlay3 = "TYPE_ACCESSIBILITY_OVERLAY" nocase
        $bank1    = "netbanking"  nocase
        $bank2    = "mobilebank"  nocase
        $bank3    = "UPI"
        $bank4    = "BHIM"
    condition:
        ($overlay1 and $overlay3) or ($overlay2 and ($bank1 or $bank2 or $bank3 or $bank4))
}

// ── Ransomware Indicators ─────────────────────────────────────────────────────

rule Generic_Ransomware_Note {
    meta:
        description = "Ransomware payment note string patterns"
        severity    = "critical"
    strings:
        $note1 = "your files have been encrypted" nocase
        $note2 = "pay to recover"                  nocase
        $note3 = "bitcoin"                          nocase
        $note4 = "decrypt your files"              nocase
        $note5 = "ransom"                           nocase
        $note6 = "HOW TO RESTORE"                  nocase
        $note7 = "ALL YOUR FILES"                   nocase
    condition:
        2 of them
}

rule File_Encryption_API {
    meta:
        description = "Use of Windows crypto APIs associated with ransomware"
        severity    = "high"
    strings:
        $enc1 = "CryptEncrypt"     nocase
        $enc2 = "BCryptEncrypt"    nocase
        $enc3 = "AES_set_encrypt_key" nocase
        $del1 = "DeleteFile"       nocase
        $del2 = "SHFileOperation"  nocase
    condition:
        any of ($enc*) and any of ($del*)
}

// ── Packer / Obfuscation Indicators ──────────────────────────────────────────

rule Suspicious_Section_Names {
    meta:
        description = "PE with known packer or protector section names"
        severity    = "medium"
    strings:
        $upx0  = "UPX0"
        $upx1  = "UPX1"
        $mpress = ".MPRESS"
        $aspack = "ASPACK"
        $petite = ".petite"
        $fsg    = ".FSG"
    condition:
        any of them
}
