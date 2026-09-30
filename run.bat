@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  Google Flow Generative Dashboard
echo  --------------------------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado no PATH.
  exit /b 1
)

if not exist "node_modules\playwright" (
  echo [INFO] Dependencias nao encontradas. Instalando...
  call npm install
  if errorlevel 1 exit /b 1
)

set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles%\Chromium\Application\chromium.exe"
  "%ProgramFiles(x86)%\Chromium\Application\chromium.exe"
  "%LocalAppData%\Chromium\Application\chromium.exe"
) do (
  if not defined CHROME if exist "%%~P" set "CHROME=%%~P"
)

if not defined CHROME (
  for /f "delims=" %%P in ('where chrome 2^>nul') do (
    if not defined CHROME set "CHROME=%%P"
  )
)

if not defined CHROME (
  for /f "delims=" %%P in ('where chromium 2^>nul') do (
    if not defined CHROME set "CHROME=%%P"
  )
)

if defined CHROME (
  echo [OK] Navegador encontrado:
  echo      !CHROME!
  echo.
  set "FLOW_BROWSER_EXECUTABLE=!CHROME!"
) else (
  echo [ERRO] Chrome/Chromium nao encontrado.
  echo [ERRO] Instale o Google Chrome ou Chromium e execute novamente.
  echo.
  exit /b 1
)

set "COMMAND=%~1"
if not defined COMMAND set "COMMAND=open"

set "FORWARDED=%*"
if not "%~1"=="" set "FORWARDED=!FORWARDED:*%1 =!"

echo [INFO] Executando: npm run %COMMAND% -- !FORWARDED!
echo.
call npm run %COMMAND% -- !FORWARDED!
exit /b %errorlevel%
