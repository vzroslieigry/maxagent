# Save the clipboard into the inbox (maxagent, Windows).
# Image (a screenshot) -> PNG; files copied in Explorer -> copies; text -> .md.
# Run it with -STA (needed for the clipboard):
#   powershell -NoProfile -STA -File save-clip.ps1 -Dir inbox -Name 2026-01-01-idea
# Prints the saved paths, one per line; nothing on the clipboard -> "empty" and exit code 2.
param(
  [Parameter(Mandatory = $true)][string]$Dir,
  [Parameter(Mandatory = $true)][string]$Name
)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$base = Join-Path (Resolve-Path $Dir) $Name
$saved = @()

if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  $png = "$base.png"
  $img.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
  $saved += $png
}
if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
  foreach ($f in [System.Windows.Forms.Clipboard]::GetFileDropList()) {
    $target = "$base-" + [System.IO.Path]::GetFileName($f)
    Copy-Item -LiteralPath $f -Destination $target -Recurse
    $saved += $target
  }
}
if (-not $saved -and [System.Windows.Forms.Clipboard]::ContainsText()) {
  $md = "$base.md"
  $text = [System.Windows.Forms.Clipboard]::GetText()
  [System.IO.File]::WriteAllText($md, $text + "`r`n", (New-Object System.Text.UTF8Encoding $false))
  $saved += $md
}

if (-not $saved) { 'empty'; exit 2 }
$saved
