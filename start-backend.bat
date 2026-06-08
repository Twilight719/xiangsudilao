@echo off
chcp 65001 >nul
echo 正在启动像素地牢后端服务...
echo.

java -version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Java，请安装 JDK 17 或更高版本
    echo 下载地址: https://www.oracle.com/java/technologies/downloads/
    pause
    exit /b 1
)

set JAR="%~dp0backend\target\dungeon-backend-1.0.0.jar"

if not exist %JAR% (
    echo [错误] 后端程序未找到: backend\target\dungeon-backend-1.0.0.jar
    echo 请先在 VS Code 中运行 Maven 构建项目
    pause
    exit /b 1
)

:: 检测端口是否被占用（兼容中文系统，不依赖 LISTENING/监听 字样）
netstat -ano | findstr "0.0.0.0:8080" >nul
if %errorlevel% == 0 (
    echo [提示] 后端服务已经在运行（端口 8080 已被占用）
    echo 无需重复启动，直接打开 frontend\index.html 即可游戏
    pause
    exit /b 0
)

echo 正在启动后端，日志保存在 backend\logs\backend.log ...
if not exist "%~dp0backend\logs" mkdir "%~dp0backend\logs"

java -jar %JAR% > "%~dp0backend\logs\backend.log" 2>&1

if %errorlevel% neq 0 (
    echo.
    echo [错误] 后端启动失败，请查看 backend\logs\backend.log
    type "%~dp0backend\logs\backend.log"
    pause
)
