$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    function Search-Pattern($pattern, $path, $caseSensitive = $true) {
        if (Get-Command rg -ErrorAction SilentlyContinue) {
            if ($caseSensitive) { rg -n $pattern $path 2>$null }
            else { rg -n -i $pattern $path 2>$null }
        } else {
            $files = Get-ChildItem -Recurse -Path $path -File -ErrorAction SilentlyContinue
            $results = @()
            foreach ($f in $files) {
                $matches = Select-String -Path $f.FullName -Pattern $pattern -CaseSensitive:$caseSensitive
                foreach ($m in $matches) {
                    $results += "$($f.FullName):$($m.LineNumber):$($m.Line)"
                }
            }
            $results
        }
    }

    $violations = @(
        Search-Pattern 'from ["''](firebase|openai|.*(/data/|/presentation/))' 'functions/src/domain'
        Search-Pattern 'tournament|torneo|reputation|admob|play-services-ads|meritHold|philosopher|paywall' @('functions/src') $false
    )
    $violations = $violations | Where-Object { $_ -and $_.Trim() -ne "" }
    if ($violations.Count -gt 0) { throw ($violations -join "`n") }
    Write-Output 'Backend architecture boundaries and excluded systems: PASS'
} finally { Pop-Location }
