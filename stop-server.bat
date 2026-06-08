@echo off
chcp 65001 >nul
echo ============================
echo    停止像素地牢服务
echo ============================
echo.

set KILLED=0

echo [1] 查找 javaw.exe 进程...
taskkill /f /im javaw.exe 2>nul
if %errorlevel% == 0 set KILLED=1

echo.
echo [2] 查找 java.exe 进程...
taskkill /f /im java.exe 2>nul
if %errorlevel% == 0 set KILLED=1

echo.
if %KILLED% == 1 (
    echo 进程已终止，检查端口状态...
    timeout /t 2 /nobreak >nul
) else (
    echo 未发现正在运行的 Java 进程。
)

:: 验证端口是否已释放
netstat -ano | findstr "0.0.0.0:8080" >nul
if %errorlevel% == 0 (
    echo.
    echo [警告] 端口 8080 仍被占用，可能有残留进程。
    echo 可以尝试在任务管理器中手动结束 Java 相关进程。
) else (
    echo 端口 8080 已释放，服务已关闭。
)

echo.
pause
