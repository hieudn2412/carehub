[CmdletBinding()]
param(
    [string]$EnvFile,
    [string]$DatabaseHost,
    [int]$Port = 5432,
    [string]$Database,
    [string]$Username,
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

function Read-PropertiesFile {
    param([string]$Path)

    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $values[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    return $values
}

$dbPassword = $null
if ($EnvFile) {
    $resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
    $properties = Read-PropertiesFile -Path $resolvedEnvFile
    $dbPassword = $properties['DB_PASSWORD']

    if (-not $Username) {
        $Username = $properties['DB_USERNAME']
    }
    if ($properties['DB_URL'] -match '^jdbc:postgresql://([^:/]+)(?::(\d+))?/([^?]+)') {
        if (-not $DatabaseHost) { $DatabaseHost = $matches[1] }
        if ($matches[2]) { $Port = [int]$matches[2] }
        if (-not $Database) { $Database = $matches[3] }
    }
}

if (-not $DatabaseHost -or -not $Database -or -not $Username) {
    throw 'Thiếu DatabaseHost, Database hoặc Username. Có thể truyền -EnvFile để đọc DB_URL/DB_USERNAME.'
}

$psql = Get-Command psql -ErrorAction Stop
$scriptPath = Join-Path $PSScriptRoot 'db-preflight.sql'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$previousPassword = $env:PGPASSWORD

try {
    if ($dbPassword) {
        $env:PGPASSWORD = $dbPassword
    }

    $arguments = @(
        '-X', '-v', 'ON_ERROR_STOP=1',
        '-h', $DatabaseHost,
        '-p', $Port,
        '-U', $Username,
        '-d', $Database,
        '-f', $scriptPath
    )
    $lines = & $psql.Source @arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "DB preflight thất bại với exit code $LASTEXITCODE.`n$($lines -join [Environment]::NewLine)"
    }

    $body = ($lines -join "`n").TrimEnd() + "`n"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body))
        $hash = ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }

    Write-Output "PRECHECK_TIMESTAMP=$timestamp"
    Write-Output "DATABASE_HOST=$DatabaseHost"
    Write-Output "DATABASE_PORT=$Port"
    Write-Output "DATABASE_NAME=$Database"
    Write-Output "RESULT_SHA256=$hash"
    Write-Output '--- RESULT ---'
    Write-Output $body

    if ($OutputDirectory) {
        $resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
        [System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
        $resultPath = Join-Path $resolvedOutput "evaluation-db-preflight-$timestamp.txt"
        $manifestPath = Join-Path $resolvedOutput "evaluation-db-preflight-$timestamp.sha256"
        [System.IO.File]::WriteAllText($resultPath, $body, [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText(
            $manifestPath,
            "$hash  $([System.IO.Path]::GetFileName($resultPath))`n",
            [System.Text.UTF8Encoding]::new($false)
        )
        Write-Output "RESULT_FILE=$resultPath"
        Write-Output "HASH_FILE=$manifestPath"
    }
}
finally {
    if ($null -eq $previousPassword) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    else {
        $env:PGPASSWORD = $previousPassword
    }
}
