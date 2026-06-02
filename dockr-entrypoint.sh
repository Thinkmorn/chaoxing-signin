#!/bin/bash
set -e

# -------------------------------------------------------
# Paths
# -------------------------------------------------------
ENV_JSON="/app/env.json"
STORAGE_JSON="/app/configs/storage.json"
NAPCAT_CONFIG_DIR="/app/napcat/napcat/config"
NAPCAT_NODE_BIN="/app/napcat/node"

# -------------------------------------------------------
# Step 1: Verify & link env.json
# -------------------------------------------------------
if [ -f "$ENV_JSON" ]; then
    echo "[entrypoint] 找到 env.json"
    mkdir -p /app/packages/chaoxing-core/dist
    if [ ! -L /app/packages/chaoxing-core/dist/env.json ]; then
        ln -sf "$ENV_JSON" /app/packages/chaoxing-core/dist/env.json
    fi

    # Read NapCat QQ & password from env.json
    NAPCAT_QQ=$(node -e "const e=require('$ENV_JSON'); console.log(e.napcat?.qq || '')" 2>/dev/null || echo "")
    NAPCAT_PWD=$(node -e "const e=require('$ENV_JSON'); console.log(e.napcat?.password || '')" 2>/dev/null || echo "")

    if [ -z "$NAPCAT_QQ" ]; then
        echo "[entrypoint] 警告: env.json 中未设置 napcat.qq，QQ 机器人不会启动"
    else
        echo "[entrypoint] NapCat QQ: $NAPCAT_QQ"
        export NAPCAT_QQ
    fi

    if [ -n "$NAPCAT_PWD" ]; then
        export NAPCAT_QUICK_PASSWORD="$NAPCAT_PWD"
    fi
else
    echo "[entrypoint] 错误: 未找到 /app/env.json"
    echo "[entrypoint] 请挂载 env.json: -v /path/to/env.json:/app/env.json:ro"
    exit 1
fi

# -------------------------------------------------------
# Step 2: Verify & prepare storage.json
# -------------------------------------------------------
mkdir -p /app/packages/chaoxing-core/dist/configs

if [ -f "$STORAGE_JSON" ]; then
    echo "[entrypoint] 找到 storage.json"
    if [ ! -L /app/packages/chaoxing-core/dist/configs/storage.json ]; then
        ln -sf "$STORAGE_JSON" /app/packages/chaoxing-core/dist/configs/storage.json
    fi
else
    echo "[entrypoint] 注意: storage.json 不存在，将创建空文件"
    mkdir -p /app/configs
    echo '{ "users": [] }' > "$STORAGE_JSON"
    if [ ! -L /app/packages/chaoxing-core/dist/configs/storage.json ]; then
        ln -sf "$STORAGE_JSON" /app/packages/chaoxing-core/dist/configs/storage.json
    fi
fi

# -------------------------------------------------------
# Step 3: Generate NapCat OneBot config if QQ is set
# -------------------------------------------------------
if [ -n "$NAPCAT_QQ" ]; then
    mkdir -p "$NAPCAT_CONFIG_DIR"

    ONEBOT_CONFIG="$NAPCAT_CONFIG_DIR/onebot11_${NAPCAT_QQ}.json"
    if [ ! -f "$ONEBOT_CONFIG" ]; then
        echo "[entrypoint] 为 QQ $NAPCAT_QQ 生成 OneBot 配置..."
        node -e "
            const fs = require('fs');
            const cfg = {
                network: {
                    httpServers: [], httpSseServers: [], httpClients: [],
                    websocketServers: [{ name: 'ws-server', enable: true, port: 3001, heartInterval: 30000, token: '' }],
                    websocketClients: [], plugins: []
                },
                musicSignUrl: '', enableLocalFile2Url: false, parseMultMsg: false
            };
            fs.mkdirSync('$NAPCAT_CONFIG_DIR', { recursive: true });
            fs.writeFileSync('$ONEBOT_CONFIG', JSON.stringify(cfg, null, 2));
            console.log('已生成: $ONEBOT_CONFIG');
        "
    fi
fi

# -------------------------------------------------------
# Step 4: Verify NapCat binaries
# -------------------------------------------------------
if [ ! -f "$NAPCAT_NODE_BIN" ]; then
    echo "[entrypoint] 错误: 未找到 NapCat Node 二进制文件 ($NAPCAT_NODE_BIN)"
    echo "[entrypoint] NapCat 应在构建时已下载，请重新构建镜像"
    exit 1
fi

if [ ! -f "/app/napcat/index.js" ]; then
    echo "[entrypoint] 错误: 未找到 NapCat 入口 (/app/napcat/index.js)"
    exit 1
fi

# -------------------------------------------------------
# Step 5: Start
# -------------------------------------------------------
echo "[entrypoint] 正在启动超星签到系统..."
echo "[entrypoint] NapCat QQ: ${NAPCAT_QQ:-未设置}"
echo "[entrypoint] 账号数: $(node -e "const e=require('$ENV_JSON'); console.log((e.accounts||[]).length)" 2>/dev/null || echo 0)"

exec "$@"
