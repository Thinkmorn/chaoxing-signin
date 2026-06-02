@echo off
chcp 65001 >nul
echo ========================================
echo  超星签到系统 - Docker 构建脚本
echo ========================================
echo.

REM 检查 Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop
    echo 下载地址: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [1/3] 构建 Docker 镜像...
docker build -t chaoxing-signin:V1 .
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [完成] 镜像构建成功

echo.
echo [2/3] 创建数据目录...
if not exist data mkdir data
if not exist data\napcat mkdir data\napcat
if not exist data\storage.json echo {"users":[]} > data\storage.json
echo [完成]

echo.
echo [3/3] 准备启动...
echo ========================================
echo  启动命令:
echo    docker compose up -d
echo ========================================
echo.
echo  首次启动后查看日志获取 QQ 登录二维码:
echo    docker compose logs -f
echo.
echo  停止容器:
echo    docker compose down
echo ========================================

pause
