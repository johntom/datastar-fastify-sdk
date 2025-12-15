@echo off
@REM Using Git Credential Manager (Recommended)
@REM Method 1: Clear stored credentials

@REM Open Control Panel → Credential Manager → Windows Credentials
@REM Look for entries starting with git:https://github.com
@REM Click each one and select Remove
@REM Next time you push/pull, you'll be prompted to sign in with the new account

@REM or 

@REM echo.
@REM git credential-manager erase https://github.com
@REM pause
echo.
git config --global user.name johntom
pause
echo.
git config --global user.email jrt@gtz.com
pause
echo.
git config user.name johntom
pause
echo.
git config  user.email jrt@gtz.com
pause
echo.

@REM acrisure
@REM jtomaselli