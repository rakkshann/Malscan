"""
analysis_engine/static_analyzer.py

Static file analysis:
  - IoC extraction (IPs, URLs, domains)
  - PE header analysis (entropy, imphash, suspicious sections)
  - Full-file entropy
  - Magic byte / true file type detection
  - Suspicious string pattern detection
"""

import re
import os
import math

# ── Magic byte signatures (true file type detection) ─────────────────────────

MAGIC_SIGNATURES = [
    (b"\x4D\x5A",                 "Windows Executable (PE/EXE/DLL)"),
    (b"\x7FELF",                  "ELF Executable (Linux/Android native)"),
    (b"\xCA\xFE\xBA\xBE",        "Java Class / Mach-O Universal Binary"),
    (b"\xFE\xED\xFA\xCE",        "Mach-O 32-bit Executable"),
    (b"\xFE\xED\xFA\xCF",        "Mach-O 64-bit Executable"),
    (b"\xD0\xCF\x11\xE0",        "Microsoft OLE2 Compound Document (DOC/XLS/PPT)"),
    (b"\x25\x50\x44\x46",        "PDF Document"),
    (b"\x50\x4B\x03\x04",        "ZIP Archive / Office Open XML / APK / JAR"),
    (b"\x52\x61\x72\x21",        "RAR Archive"),
    (b"\x37\x7A\xBC\xAF\x27\x1C", "7-Zip Archive"),
    (b"\x1F\x8B",                "GZIP Compressed"),
    (b"\x42\x5A\x68",            "BZIP2 Compressed"),
    (b"\x4D\x53\x43\x46",        "Microsoft Cabinet (CAB) File"),
    (b"\x49\x53\x63\x28",        "InstallShield CAB"),
    (b"\x23\x21",                "Script / Shebang (shell script, Python, etc.)"),
    (b"\xFF\xD8\xFF",            "JPEG Image"),
    (b"\x89PNG",                 "PNG Image"),
]

# ── Suspicious string patterns ────────────────────────────────────────────────

SUSPICIOUS_PATTERNS = [
    # PowerShell
    (rb"powershell\s+-[Ee][Nn][Cc]",   "PowerShell encoded command"),
    (rb"IEX\s*\(",                       "Invoke-Expression (IEX) call"),
    (rb"Invoke-Expression",              "Invoke-Expression call"),
    (rb"DownloadString\s*\(",            "WebClient.DownloadString — downloads and executes code"),
    (rb"DownloadFile\s*\(",              "WebClient.DownloadFile — downloads payload"),
    (rb"Net\.WebClient",                 "Net.WebClient usage — common in PowerShell droppers"),

    # Windows API abuse
    (rb"VirtualAlloc",                   "VirtualAlloc — allocates executable memory (shellcode)"),
    (rb"CreateRemoteThread",             "CreateRemoteThread — code injection into another process"),
    (rb"WriteProcessMemory",             "WriteProcessMemory — process injection"),
    (rb"SetWindowsHookEx",               "SetWindowsHookEx — keyboard hook (keylogger)"),
    (rb"NtUnmapViewOfSection",           "Process hollowing API"),
    (rb"RtlDecompressBuffer",            "RTL decompression — unpacking stage"),
    (rb"IsDebuggerPresent",              "Anti-debugging check"),
    (rb"CheckRemoteDebuggerPresent",     "Anti-debugging check"),
    (rb"VirtualProtect",                 "VirtualProtect — changes memory permissions (shellcode staging)"),

    # Persistence
    (rb"HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
     "Registry run key — common persistence mechanism"),
    (rb"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
     "Registry run key — persistence"),
    (rb"schtasks\s+/create",             "Scheduled task creation — persistence"),
    (rb"RegSetValueEx",                  "Registry value write — may establish persistence"),

    # Credential theft
    (rb"SAMSoftware\\Microsoft\\Windows NT\\CurrentVersion",
     "SAM registry access — credential dumping"),
    (rb"lsass\.exe",                     "LSASS process reference — credential dumping"),
    (rb"sekurlsa",                       "Mimikatz sekurlsa module — credential dumping"),
    (rb"mimikatz",                       "Mimikatz — credential theft tool"),

    # Network
    (rb"cmd\.exe\s+/[Cc]",              "cmd.exe /C — shell command execution"),
    (rb"wscript\.exe",                   "Windows Script Host execution"),
    (rb"cscript\.exe",                   "CScript.exe — script host"),
    (rb"mshta\.exe",                     "MSHTA — HTML Application host (often abused)"),
    (rb"regsvr32",                       "regsvr32 — can load remote scriptlets (Squiblydoo)"),
    (rb"certutil\s+-decode",             "certutil decode — used to unpack malware"),

    # Base64 large blobs (likely encoded payload)
    (rb"[A-Za-z0-9+/]{200,}={0,2}",    "Large base64 blob — possible encoded payload"),
]


def _file_entropy(data: bytes) -> float:
    """Shannon entropy of raw file bytes. Max is 8.0 (fully random/encrypted)."""
    if not data:
        return 0.0
    counts = [0] * 256
    for byte in data:
        counts[byte] += 1
    length = len(data)
    entropy = 0.0
    for c in counts:
        if c:
            p = c / length
            entropy -= p * math.log2(p)
    return round(entropy, 3)


def detect_file_type(file_path: str, data: bytes = None) -> dict:
    """
    Reads the first 16 bytes and matches against known magic signatures.
    Returns declared type from filename extension and detected type from bytes.
    Pass `data` to reuse already-read bytes instead of re-reading from disk.
    """
    result = {"magic_type": "Unknown", "extension": "", "type_mismatch": False}
    try:
        ext = os.path.splitext(file_path)[1].lower()
        result["extension"] = ext

        if data is not None:
            header = data[:16]
        else:
            with open(file_path, "rb") as f:
                header = f.read(16)

        for magic, type_name in MAGIC_SIGNATURES:
            if header[:len(magic)] == magic:
                result["magic_type"] = type_name
                break

        # Flag if a file claims to be an image/text but is actually an executable
        if result["magic_type"] in (
            "Windows Executable (PE/EXE/DLL)",
            "ELF Executable (Linux/Android native)",
            "Microsoft OLE2 Compound Document (DOC/XLS/PPT)",
        ):
            innocent_exts = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".txt", ".pdf", ".csv"}
            if ext in innocent_exts:
                result["type_mismatch"] = True

    except Exception as e:
        result["error"] = str(e)
    return result


def extract_iocs(file_path: str, data: bytes = None) -> dict:
    """
    Extracts IPs, URLs, and domains from raw file content.
    Pass `data` to reuse already-read bytes instead of re-reading from disk.
    """
    iocs = {"ips": set(), "domains": set(), "urls": set()}

    if data is None and not os.path.exists(file_path):
        return {k: list(v) for k, v in iocs.items()}

    ip_re  = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')
    url_re = re.compile(r'https?://[^\s\'"<>\]]+')

    try:
        if data is not None:
            content = data
        else:
            with open(file_path, "rb") as f:
                content = f.read()
        text = content.decode("utf-8", errors="ignore")

        for ip in ip_re.findall(text):
            iocs["ips"].add(ip)
        for url in url_re.findall(text):
            iocs["urls"].add(url)
    except Exception as e:
        print(f"Error extracting IoCs from {file_path}: {e}")

    return {k: list(v) for k, v in iocs.items()}


def analyze_suspicious_strings(file_path: str, data: bytes = None) -> dict:
    """
    Scans file bytes for suspicious API calls, persistence mechanisms,
    credential theft patterns, and encoded payloads.
    Pass `data` to reuse already-read bytes instead of re-reading from disk.
    """
    result = {"suspicious_strings": [], "matched_patterns": []}
    if data is None and not os.path.exists(file_path):
        return result

    try:
        if data is not None:
            content = data
        else:
            with open(file_path, "rb") as f:
                content = f.read()

        seen = set()
        for pattern, description in SUSPICIOUS_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE) and description not in seen:
                seen.add(description)
                result["suspicious_strings"].append(description)
                result["matched_patterns"].append(pattern.decode("latin-1", errors="ignore")[:40])
    except Exception as e:
        result["error"] = str(e)

    return result


def analyze_pe(file_path: str, data: bytes = None) -> dict:
    """
    Analyses Windows Executable (PE) metadata and anomalies.
    Pass `data` to reuse already-read bytes for entropy/type detection
    (pefile still parses from the path).
    """
    results = {
        "is_pe":               False,
        "imphash":             None,
        "suspicious_sections": [],
        "pe_sections":         [],
        "file_entropy":        0.0,
        "magic_type":          "Unknown",
        "type_mismatch":       False,
    }

    if data is None and not os.path.exists(file_path):
        return results

    # File entropy and type detection apply to ALL files, not just PE
    raw = data
    try:
        if raw is None:
            with open(file_path, "rb") as f:
                raw = f.read()
        results["file_entropy"] = _file_entropy(raw)
    except Exception:
        raw = None

    type_info = detect_file_type(file_path, data=raw)
    results["magic_type"]    = type_info.get("magic_type", "Unknown")
    results["type_mismatch"] = type_info.get("type_mismatch", False)

    try:
        import pefile
        pe = pefile.PE(file_path)
        results["is_pe"]    = True
        results["imphash"]  = pe.get_imphash()

        for section in pe.sections:
            name    = section.Name.decode("utf-8", errors="ignore").strip("\x00")
            entropy = round(section.get_entropy(), 3)
            results["pe_sections"].append({"name": name, "entropy": entropy})
            if entropy > 7.5:
                results["suspicious_sections"].append({
                    "name":   name,
                    "reason": f"High entropy ({entropy:.2f}) — suggests packing or encryption.",
                })

    except Exception:
        pass

    return results
