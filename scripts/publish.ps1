param([string]$m = 'Update')
$ErrorActionPreference = 'Stop'
git add -A
git commit -m $m
git push
