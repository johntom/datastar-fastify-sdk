@echo off
setlocal
echo Git: update main
echo ==================
echo.

echo [1/5] Refreshing README.md version block from .env (VERSION, VERSION_date, VERSION_mess)...
call npm run update-readme
if errorlevel 1 goto :error
echo.

echo [2/5] Switching to main branch...
git checkout main
if errorlevel 1 goto :error
echo.

echo [3/5] Pulling latest main from origin...
git pull origin main
if errorlevel 1 goto :error
echo.

echo [4/5] Staging changes...
git add -A
if errorlevel 1 goto :error
git diff --cached --quiet && (
  echo Nothing to commit - working tree clean. Skipping commit and push.
  goto :end
)
git status --short
echo.
set "MSG="
set /p "MSG=Commit message (leave blank to cancel): "
if not defined MSG (
  echo No message entered - nothing committed. Exiting.
  goto :end
)
git commit -m "%MSG%"
if errorlevel 1 goto :error
echo.

echo [5/5] Pushing main to origin...
git push origin main
if errorlevel 1 goto :error
echo.

echo Done - main updated and pushed.
goto :end

:error
echo.
echo *** A step failed (errorlevel %errorlevel%). Stopped - nothing further was run. ***

:end
endlocal
pause
