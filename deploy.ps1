# Sonne Systems - one-shot deploy to GitHub Pages.
#
# ONE-TIME login (opens your own browser; your password/OTP are NEVER shared with anyone):
#     & "C:\Program Files\GitHub CLI\gh.exe" auth login --hostname github.com --git-protocol https --web
#
# Then, from this web\ folder:
#     ./deploy.ps1
#
# It creates 9aman-og/sonnesystems, pushes the site, and turns on GitHub Pages.
# Finally, point GoDaddy DNS using the records printed at the end.

$ErrorActionPreference = "Stop"
$gh    = "C:\Program Files\GitHub CLI\gh.exe"
$owner = "9aman-og"
$repo  = "sonnesystems"

& $gh auth status
if ($LASTEXITCODE -ne 0) { Write-Error "Run the gh auth login line at the top of this file first."; exit 1 }

git add -A
git commit -m "Update Sonne Systems site" 2>$null

# create + push (if the repo already exists, fall back to add-remote + push)
& $gh repo create "$owner/$repo" --public --source=. --remote=origin --push
if ($LASTEXITCODE -ne 0) {
  git remote remove origin 2>$null
  git remote add origin "https://github.com/$owner/$repo.git"
  git branch -M main
  git push -u origin main
}

# turn on Pages from main / root (ignore error if already enabled)
try { & $gh api -X POST "repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" | Out-Null } catch {}

Write-Host ""
Write-Host "Pushed. GitHub Pages is building." -ForegroundColor Green
Write-Host "Temporary URL: https://$owner.github.io/$repo/ (live in ~1 min)"
Write-Host ""
Write-Host "Now set these DNS records at GoDaddy for sonnesystems.com:" -ForegroundColor Cyan
Write-Host "  Type   Name   Value"
Write-Host "  A      @      185.199.108.153"
Write-Host "  A      @      185.199.109.153"
Write-Host "  A      @      185.199.110.153"
Write-Host "  A      @      185.199.111.153"
Write-Host "  CNAME  www    $owner.github.io"
Write-Host ""
Write-Host "After DNS propagates, enforce HTTPS with:"
Write-Host "  & `"$gh`" api -X PUT repos/$owner/$repo/pages -f https_enforced=true"
