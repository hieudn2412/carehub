[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $BackupPath,
    [string] $DbHost = '127.0.0.1',
    [int] $Port = 5432,
    [string] $Username = 'postgres',
    [string] $AdminDatabase = 'postgres',
    [switch] $ConfirmTemporaryRestore
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $ConfirmTemporaryRestore) {
    throw 'Pass -ConfirmTemporaryRestore. The script creates and drops one explicitly named temporary database.'
}
if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
    throw "Backup not found: $BackupPath"
}

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$temporaryDatabase = "carehub_restore_verify_$stamp"
if ($temporaryDatabase -notmatch '^[a-z0-9_]+$') {
    throw 'Generated temporary database name is invalid.'
}

$baseArgs = @('-h', $DbHost, '-p', "$Port", '-U', $Username, '-v', 'ON_ERROR_STOP=1')
$restoreArgs = @('-h', $DbHost, '-p', "$Port", '-U', $Username, '-d', $temporaryDatabase, '--no-owner', '--exit-on-error', $BackupPath)
try {
    & psql @baseArgs '-d' $AdminDatabase '-c' "CREATE DATABASE $temporaryDatabase"
    if ($LASTEXITCODE -ne 0) { throw "CREATE DATABASE failed ($LASTEXITCODE)" }

    & pg_restore @restoreArgs
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed ($LASTEXITCODE)" }

    $sql = @'
SELECT 'questions' AS metric, COUNT(*)::text AS value FROM questions
UNION ALL SELECT 'question_categories', COUNT(*)::text FROM question_categories
UNION ALL SELECT 'professional_fields', COUNT(*)::text FROM professional_fields;
'@
    $sql | & psql @baseArgs '-d' $temporaryDatabase '-At' '-F' '|'
    if ($LASTEXITCODE -ne 0) { throw "Restore verification query failed ($LASTEXITCODE)" }
    Write-Host "Restore trial passed in temporary database: $temporaryDatabase"
}
finally {
    & psql @baseArgs '-d' $AdminDatabase '-c' "DROP DATABASE IF EXISTS $temporaryDatabase" *> $null
    Write-Host "Temporary database removed: $temporaryDatabase"
}
