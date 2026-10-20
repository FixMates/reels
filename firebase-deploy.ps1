param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId
)

$ErrorActionPreference = "Stop"
$Region = "us-west1"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Google Cloud CLI is required. Install it from https://cloud.google.com/sdk/docs/install and run 'gcloud auth login'."
}
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw "Firebase CLI is required. Install it with 'npm install -g firebase-tools' and run 'firebase login'."
}

$secret = gcloud secrets describe gemini-api-key --project $ProjectId --format="value(name)" 2>$null
if (-not $secret) {
  throw "Create the Secret Manager secret 'gemini-api-key' in project '$ProjectId' and grant the Cloud Run service identity Secret Manager Secret Accessor before deploying. Do not put the Gemini key in this script or in Git."
}

gcloud run deploy reels-api `
  --source . `
  --project $ProjectId `
  --region $Region `
  --allow-unauthenticated `
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" `
  --cpu 2 `
  --memory 4Gi `
  --timeout 3600 `
  --min 1 `
  --max 1 `
  --no-cpu-throttling
if ($LASTEXITCODE -ne 0) { throw "Cloud Run deployment failed." }

$apiUrl = gcloud run services describe reels-api --project $ProjectId --region $Region --format="value(status.url)"
if (-not $apiUrl) { throw "Could not resolve the deployed Cloud Run URL." }
$env:VITE_API_BASE = "$($apiUrl.TrimEnd('/'))/api"
firebase deploy --only hosting --project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Firebase Hosting deployment failed." }
Remove-Item Env:VITE_API_BASE -ErrorAction SilentlyContinue
