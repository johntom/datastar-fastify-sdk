@echo off==========
echo Git Branch Management Script
echo =============================
echo.

echo Step 1: Creating and switching to test branch...
git branch -M test
pause

echo.
echo Step 2: Switching to test branch...
git checkout test
pause

echo.
echo Step 3: Adding all changes to staging...
git add .
pause

echo.
echo Step 4: Committing changes...
git commit -m "new version to test branch bla bla"
pause

echo.
echo Step 5: Pushing test branch to origin...
git push -u origin test
pause

echo.
echo Step 6: Switching back to main branch...
git checkout main
pause

echo.
echo Step 7: Pulling latest changes from main...
git pull origin main
pause

echo.
echo Step 8: Merging test branch into main...
git merge test
pause

echo.
echo Step 9: Pushing updated main branch...
git push origin main
pause

echo.
echo Step 10: Deleting local test branch...
git branch -d test
pause

echo.
echo Step 11: Deleting remote test branch...
git push origin --delete test
pause

echo.
echo Git workflow completed successfully!
echo Press any key to exit...
pause >nul
