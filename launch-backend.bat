@echo off
chcp 65001 >nul
set JAR=%~dp0backend\target\dungeon-backend-1.0.0.jar
set LOGDIR=%~dp0backend\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo 后端启动中... > "%LOGDIR%\backend.log"
java -jar "%JAR%" >> "%LOGDIR%\backend.log" 2>&1
echo 后端已停止 >> "%LOGDIR%\backend.log"
