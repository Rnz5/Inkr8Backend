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
        Search-Pattern '^import (android\.|androidx\.|com\.google\.firebase|com\.inkr8\.data|com\.inkr8\.presentation)' 'domain/src/main'
        Search-Pattern '^import (com\.google\.firebase|com\.inkr8\.data|com\.inkr8\.di)' 'app/src/main/java/com/inkr8/presentation'
        Search-Pattern '^import com\.inkr8\.presentation' 'app/src/main/java/com/inkr8/data'
        Search-Pattern '^import (com\.google\.firebase|com\.inkr8\.data)|graph\.google\.' 'app/src/main/java/com/inkr8/MainActivity.kt'
        Search-Pattern '\bDraftRepository\b' 'app/src/main/java/com/inkr8/presentation'
        Search-Pattern 'GamePolicy\.(wordCount|validateWriting)\s*\(' 'app/src/main/java/com/inkr8/presentation/ui'
        Search-Pattern 'from ["''](firebase|openai|.*(/data/|/presentation/))' 'functions/src/domain'
        Search-Pattern 'tournament|torneo|reputation|admob|play-services-ads|meritHold|philosopher|paywall' @('app/src/main', 'functions/src', 'domain/src/main', 'gradle', 'app/build.gradle.kts') $false
    )
    $violations = $violations | Where-Object { $_ -and $_.Trim() -ne "" }
    if ($violations.Count -gt 0) { throw ($violations -join "`n") }
    Write-Output 'Architecture boundaries and excluded systems: PASS'
} finally { Pop-Location }
