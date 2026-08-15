[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$failures = New-Object System.Collections.Generic.List[string]
$phaseDirectory = $PSScriptRoot
$planDirectory = Split-Path -Parent $phaseDirectory

$requiredFiles = @(
    'baseline-db.html',
    'db-preflight.sql',
    'run-db-preflight.ps1',
    'adr-001-question-taxonomy.html',
    'adr-002-remove-question-set.html',
    'adr-003-cognitive-review.html',
    'adr-004-allocation-rounding.html',
    'adr-005-audience-dsl.html',
    'adr-006-random-snapshot.html',
    'glossary-permissions.html',
    'worked-scenarios.html',
    'baselines\evaluation-db-preflight-20260813-020552.txt',
    'baselines\evaluation-db-preflight-20260813-020552.sha256'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $phaseDirectory $relativePath))) {
        $failures.Add("Thiếu file: $relativePath")
    }
}

$adrFiles = Get-ChildItem -LiteralPath $phaseDirectory -Filter 'adr-*.html' -File
if ($adrFiles.Count -ne 6) {
    $failures.Add("Cần đúng 6 ADR, hiện có $($adrFiles.Count)")
}
foreach ($adr in $adrFiles) {
    $raw = Get-Content -LiteralPath $adr.FullName -Raw
    if ($raw -notmatch 'ADR-\d{3} · Accepted · 13/08/2026') {
        $failures.Add("ADR chưa Accepted hoặc thiếu ngày: $($adr.Name)")
    }
}

$baselinePath = Join-Path $phaseDirectory 'baselines\evaluation-db-preflight-20260813-020552.txt'
$manifestPath = Join-Path $phaseDirectory 'baselines\evaluation-db-preflight-20260813-020552.sha256'
if ((Test-Path -LiteralPath $baselinePath) -and (Test-Path -LiteralPath $manifestPath)) {
    $actualHash = (Get-FileHash -LiteralPath $baselinePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $expectedHash = ((Get-Content -LiteralPath $manifestPath -Raw).Trim().Split(' ')[0]).ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
        $failures.Add("Baseline hash sai: expected=$expectedHash actual=$actualHash")
    }
}

$sqlPath = Join-Path $phaseDirectory 'db-preflight.sql'
if (Test-Path -LiteralPath $sqlPath) {
    $sql = Get-Content -LiteralPath $sqlPath -Raw
    if ($sql -notmatch 'BEGIN TRANSACTION READ ONLY') {
        $failures.Add('DB preflight không mở transaction READ ONLY')
    }
    if ($sql -match '(?im)^\s*(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE)\b') {
        $failures.Add('DB preflight chứa động từ có thể ghi hoặc đổi schema')
    }
}

$allHtml = Get-ChildItem -LiteralPath $planDirectory -Filter '*.html' -File -Recurse
foreach ($html in $allHtml) {
    $raw = Get-Content -LiteralPath $html.FullName -Raw
    if ([regex]::Matches($raw, '<h1\b').Count -ne 1) {
        $failures.Add("Sai số lượng h1: $($html.FullName)")
    }
    if ([regex]::Matches($raw, '<section\b').Count -ne [regex]::Matches($raw, '</section>').Count) {
        $failures.Add("Section không cân bằng: $($html.FullName)")
    }
    foreach ($match in [regex]::Matches($raw, '(?:href|src)="([^"]+)"')) {
        $reference = $match.Groups[1].Value
        if ($reference -match '^(https?:|mailto:)') { continue }
        if ($reference.StartsWith('#')) {
            $anchor = [regex]::Escape($reference.Substring(1))
            if ($raw -notmatch "id=`"$anchor`"") {
                $failures.Add("Anchor hỏng trong $($html.Name): $reference")
            }
            continue
        }
        $target = $reference.Split('#')[0]
        if (-not (Test-Path -LiteralPath (Join-Path $html.DirectoryName $target))) {
            $failures.Add("Link hỏng trong $($html.Name): $reference")
        }
    }
}

$phaseMain = Get-Content -LiteralPath (Join-Path $planDirectory 'phase-00-domain-decisions.html') -Raw
$flowMatch = [regex]::Match($phaseMain, '<div class="flow">([\s\S]*?)</div>')
if (-not $flowMatch.Success) {
    $failures.Add('Không tìm thấy sequence flow Phase 0')
}
elseif ($flowMatch.Groups[1].Value -match '(?i)QuestionSet|Bộ câu hỏi|purpose|mục đích') {
    $failures.Add('Sequence flow Phase 0 vẫn chứa QuestionSet hoặc mục đích kiểm tra')
}

$scenarios = Get-Content -LiteralPath (Join-Path $phaseDirectory 'worked-scenarios.html') -Raw
foreach ($scenario in @('Kịch bản 1 — Toàn bệnh viện', 'Kịch bản 2 — Thâm niên dưới 3 năm', 'Kịch bản 3 — Không đạt một lĩnh vực')) {
    if ($scenarios -notmatch [regex]::Escape($scenario)) {
        $failures.Add("Thiếu mô phỏng: $scenario")
    }
}

$secretPattern = '(?i)(DB_PASSWORD\s*=|JWT_SECRET\s*=|R2_SECRET_KEY\s*=|MAIL_PASSWORD\s*=)'
Get-ChildItem -LiteralPath $phaseDirectory -File -Recurse | ForEach-Object {
    if ($_.Extension -in @('.html', '.txt', '.sql', '.ps1', '.sha256')) {
        if ((Get-Content -LiteralPath $_.FullName -Raw) -match $secretPattern) {
            $failures.Add("Có biểu thức secret trong hồ sơ: $($_.FullName)")
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Error ("Phase 0 verification failed:`n- " + ($failures -join "`n- "))
    exit 1
}

Write-Output "PHASE_00_VERIFIED html=$($allHtml.Count) adr=$($adrFiles.Count) baseline_sha256=valid links=valid sql=read-only secrets=clean scenarios=3"
