@echo off
chcp 65001 >nul
echo ============================
echo    像素地牢 - 启动
echo ============================
echo.

:: 检查 Java
java -version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Java，请安装 JDK 17 或更高版本
    echo 下载地址: https://www.oracle.com/java/technologies/downloads/
    pause
    exit /b 1
)

set JAR=%~dp0dungeon-backend-1.0.0.jar

if not exist "%JAR%" (
    echo [错误] 未找到 dungeon-backend-1.0.0.jar
    echo 请确保本文件和 JAR 放在同一目录下
    pause
    exit /b 1
)

:: 检测端口是否占用
netstat -ano | findstr "0.0.0.0:8080" >nul
if %errorlevel% == 0 (
    echo [提示] 后端服务已在运行（端口 8080）
    goto open_browser
)

echo 正在启动服务...
javaw -jar "%JAR%"

echo 等待服务启动...
set /a RETRY=0
:wait_loop
timeout /t 1 /nobreak >nul
set /a RETRY+=1
if %RETRY% gtr 30 (
    echo [超时] 启动超时，请检查是否安装了 JDK 17+
    echo 日志位置: %%userprofile%%\dungeon_data\backend.log
    pause
    exit /b 1
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8080/' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 goto wait_loop

echo 服务启动成功！

:open_browser
echo 正在打开浏览器...
start http://localhost:8080

echo.
echo 游戏已启动！浏览器访问 http://localhost:8080 即可开始。
echo 关闭此窗口不会停止服务。
echo.
pause
