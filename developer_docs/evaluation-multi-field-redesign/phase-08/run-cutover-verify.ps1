[CmdletBinding()]
param(
    [string]$EnvFile = (Join-Path $PSScriptRoot '../../../carehub-backend/.env.properties'),
    [string]$DatabaseHost,
    [int]$Port = 5432,
    [string]$Database,
    [string]$Username,
    [string]$OutputDirectory,
    [int]$ConnectTimeoutSeconds = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-PropertiesFile {
    param([Parameter(Mandatory = $true)][string]$Path)

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
    if (-not $Username) { $Username = $properties['DB_USERNAME'] }
    if (-not $DatabaseHost -and $properties['DB_URL'] -match '^jdbc:postgresql://([^:/]+)(?::(\d+))?/([^?]+)') {
        $DatabaseHost = $matches[1]
        if ($matches[2]) { $Port = [int]$matches[2] }
        if (-not $Database) { $Database = $matches[3] }
    }
    if ($properties['DB_PASSWORD']) { $dbPassword = $properties['DB_PASSWORD'] }
}

if (-not $DatabaseHost -or -not $Database -or -not $Username) {
    throw 'Thiếu DatabaseHost, Database hoặc Username. Truyền -EnvFile hoặc các tham số kết nối.'
}
if ($ConnectTimeoutSeconds -lt 1 -or $ConnectTimeoutSeconds -gt 300) {
    throw 'ConnectTimeoutSeconds phải nằm trong khoảng 1..300.'
}

$psql = Get-Command psql -ErrorAction Stop
$scriptPath = Join-Path $PSScriptRoot 'verify-cutover.sql'
$previousPassword = $env:PGPASSWORD
$previousConnectTimeout = $env:PGCONNECT_TIMEOUT
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

try {
    if ($dbPassword) { $env:PGPASSWORD = $dbPassword }
    $env:PGCONNECT_TIMEOUT = "$ConnectTimeoutSeconds"

    $arguments = @(
        '-X', '-v', 'ON_ERROR_STOP=1',
        '-h', $DatabaseHost,
        '-p', "$Port",
        '-U', $Username,
        '-d', $Database,
        '-f', $scriptPath
    )
    # Native psql writes connection failures to stderr. Temporarily keep
    # PowerShell from converting that expected negative-path output into an
    # unhandled terminating error so the wrapper can print a deterministic
    # VERIFY_EXIT and restore the caller's error preference.
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $lines = & $psql.Source @arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    $body = ($lines -join "`n").TrimEnd() + "`n"

    if ($OutputDirectory) {
        $resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
        [System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
        $resultPath = Join-Path $resolvedOutput "remote-verify-$timestamp.txt"
        [System.IO.File]::WriteAllText($resultPath, $body, [System.Text.UTF8Encoding]::new($false))
        Write-Output "RESULT_FILE=$resultPath"
        Write-Output "RESULT_SHA256=$((Get-FileHash -Algorithm SHA256 -LiteralPath $resultPath).Hash.ToLowerInvariant())"
    }

    Write-Output "DATABASE_HOST=$DatabaseHost"
    Write-Output "DATABASE_PORT=$Port"
    Write-Output "DATABASE_NAME=$Database"
    Write-Output "VERIFY_EXIT=$exitCode"
    Write-Output $body
    if ($exitCode -ne 0) {
        throw "Cutover verification failed with exit code $exitCode. No remote mutation was attempted."
    }
}
finally {
    if ($null -eq $previousPassword) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        $env:PGPASSWORD = $previousPassword
    }
    if ($null -eq $previousConnectTimeout) {
        Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
    } else {
        $env:PGCONNECT_TIMEOUT = $previousConnectTimeout
    }
}
