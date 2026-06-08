@echo off
chcp 65001 >nul
echo Testing startup... > "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
echo Current directory: %CD% >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
echo Java check: >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
java -version >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
echo ERRORLEVEL: %ERRORLEVEL% >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
echo JAR path: %~dp0backend\target\dungeon-backend-1.0.0.jar >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
if exist "%~dp0backend\target\dungeon-backend-1.0.0.jar" (
    echo JAR exists >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
) else (
    echo JAR NOT FOUND >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
)
echo Starting backend... >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
start "" /min java -jar "%~dp0backend\target\dungeon-backend-1.0.0.jar" >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
echo Done. >> "%USERPROFILE%\dungeon_data\test_startup.log" 2>&1
