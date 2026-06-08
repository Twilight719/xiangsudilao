@echo off
chcp 65001 >nul
echo ============================
echo    像素地牢 - 一键启动
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

set "JAR=%~dp0backend\target\dungeon-backend-1.0.0.jar"

if not exist "%JAR%" (
    echo [错误] 后端程序未找到: backend\target\dungeon-backend-1.0.0.jar
    echo 请先在终端执行: cd backend ^&^& mvnw clean package -DskipTests
    pause
    exit /b 1
)

:: 检测端口是否已被占用
netstat -ano | findstr "0.0.0.0:8080" >nul
if %errorlevel% == 0 (
    echo [提示] 后端服务已在运行
    goto open_game
)

echo 正在启动后端服务...

:: 先切到 JAR 所在目录，避免 start 命令处理中文路径
cd /d "%~dp0backend\target"

:: 使用完整路径启动 javaw（无窗口后台运行）
if exist "D:\java\bin\javaw.exe" (
    start "PD" /min D:\java\bin\javaw.exe -jar dungeon-backend-1.0.0.jar
) else (
    start "PD" /min javaw -jar dungeon-backend-1.0.0.jar
)

cd /d "%~dp0"

echo 等待后端就绪（约5-8秒）...
set /a RETRY=0
:wait_loop
timeout /t 2 /nobreak >nul
set /a RETRY+=1
if %RETRY% gtr 30 (
    echo [超时] 后端启动超时（已等待60秒）
    echo.
    echo 请尝试以下方法排查：
    echo 1. 打开终端执行: java -jar "%JAR%"
    echo 2. 查看报错信息
    echo 3. 查看日志: %%userprofile%%\dungeon_data\backend.log
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8080' -Method GET -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% == 0 goto backend_ready
goto wait_loop

:backend_ready
echo 后端启动成功！

:open_game
echo 正在打开游戏...
start http://localhost:8080

echo.
echo 游戏已启动，祝您游戏愉快！
echo.
echo 提示：
echo - 游戏页面: http://localhost:8080
echo - 后端日志: %%userprofile%%\dungeon_data\backend.log
echo - 关闭后端: 双击 stop-server.bat
echo.
timeout /t 3 /nobreak >nul
