# L7 on Windows: install the NSIS bundle silently, launch the installed app,
# confirm it stays alive, uninstall silently, and confirm it is gone.
$ErrorActionPreference = "Stop"
$bundle = Join-Path $PSScriptRoot "..\release"

function Assert($cond, $msg) { if (-not $cond) { Write-Error "FAIL: $msg"; exit 1 } else { Write-Host "ok: $msg" } }

function Find-Installed {
  $roots = @("$env:LOCALAPPDATA\Programs", "$env:LOCALAPPDATA", "$env:ProgramFiles", "${env:ProgramFiles(x86)}")
  foreach ($r in $roots) {
    if (Test-Path $r) {
      $hit = Get-ChildItem -Path $r -Filter "corto.exe" -Recurse -ErrorAction SilentlyContinue -Depth 2 | Select-Object -First 1
      if ($hit) { return $hit.FullName }
    }
  }
  return $null
}

function Stop-Installed($dir) {
  # Electron starts helper processes (GPU, renderer); stop every process that
  # runs from the install folder, and nothing else.
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($dir, [StringComparison]::OrdinalIgnoreCase) } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

function Smoke-Launch($exe) {
  $markerPath = Join-Path ([System.IO.Path]::GetTempPath()) ('corto-smoke-' + [Guid]::NewGuid().ToString('N') + '.json')
  $previousMarker = $env:CORTO_SMOKE_OUTPUT
  try {
    $env:CORTO_SMOKE_OUTPUT = $markerPath
    $p = Start-Process -FilePath $exe -ArgumentList '--corto-smoke-test' -PassThru -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 60 -and -not (Test-Path -LiteralPath $markerPath); $attempt++) { Start-Sleep -Milliseconds 250 }
    Assert (Test-Path -LiteralPath $markerPath) 'installed renderer requested project storage and wrote readiness evidence'
    $report = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    Assert ($report.rendererReady -and $report.movieEncoded) 'installed renderer loaded and bundled FFmpeg encoded an MP4'
    Start-Sleep -Seconds 6
    Assert (-not $p.HasExited) 'installed main process remained alive for 6s'
  } finally {
    Stop-Installed (Split-Path $exe)
    $env:CORTO_SMOKE_OUTPUT = $previousMarker
    Remove-Item -LiteralPath $markerPath -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
}

$setup = Get-ChildItem "$bundle\*-setup.exe" | Select-Object -First 1
Assert ($null -ne $setup) "NSIS installer exists"
$proc = Start-Process -FilePath $setup.FullName -ArgumentList "/S" -Wait -PassThru -WindowStyle Hidden
Assert ($proc.ExitCode -eq 0) "NSIS silent install exit code 0"
$exe = Find-Installed
Assert ($null -ne $exe) "corto.exe found after NSIS install"
Smoke-Launch $exe
$uninst = Join-Path (Split-Path $exe) "Uninstall corto.exe"
Assert (Test-Path $uninst) "uninstaller present"
$proc = Start-Process -FilePath $uninst -ArgumentList "/S" -Wait -PassThru -WindowStyle Hidden
Assert ($proc.ExitCode -eq 0) "NSIS silent uninstall exit code 0"
# The NSIS uninstaller re-launches itself from a temp copy and returns at once;
# wait for the files to go rather than for the process.
for ($i = 0; $i -lt 30 -and (Test-Path $exe); $i++) { Start-Sleep -Seconds 1 }
Assert (-not (Test-Path $exe)) "corto.exe removed after NSIS uninstall"
Write-Host "installer tests passed (nsis)"
