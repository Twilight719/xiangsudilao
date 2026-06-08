@echo off
chcp 65001 >nul
echo 正在以调试模式启动后端...
echo.

set "LOG=%USERPROFILE%\dungeon_data\startup_debug.log"
echo === 启动调试 %DATE% %TIME% === > "%LOG%"

echo [1] 当前目录: %CD% >> "%LOG%"
echo [2] USERPROFILE: %USERPROFILE% >> "%LOG%"
echo [3] Java版本: >> "%LOG%"
java -version >> "%LOG%" 2>&1
echo [4] JAR路径: %~dp0backend\target\dungeon-backend-1.0.0.jar >> "%LOG%"

if not exist "%~dp0backend\target\dungeon-backend-1.0.0.jar" (
    echo [错误] JAR文件不存在 >> "%LOG%"
    echo JAR文件不存在！
    pause
    exit /b 1
)

cd /d "%~dp0backend\target"
echo [5] 启动前目录: %CD% >> "%LOG%"
echo [6] 正在启动 java... >> "%LOG%"

java -jar dungeon-backend-1.0.0.jar >> "%LOG%" 2>&1

echo [7] Java进程已退出，返回码: %ERRORLEVEL% >> "%LOG%"
echo.
echo 后端已停止。请查看日志文件：
echo %LOG%
echo.
pause
