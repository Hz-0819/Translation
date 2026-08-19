# 纸上词间部署包

该目录包含完整网页、API、PostgreSQL、MinIO 私有文件存储和离线英汉词典。服务器只需安装 Docker Engine 与 Docker Compose v2。

## 1. 设置访问地址

打开 `.env`，将以下两项中的 `localhost` 换成服务器公网 IP：

```env
APP_ORIGIN=http://服务器IP:8080
STORAGE_ORIGIN=http://服务器IP:9000
```

其余密码由打包脚本随机生成，无需再次修改。请妥善备份 `.env`。

## 2. 启动

在本目录执行：

```bash
docker compose up -d --build
```

首次构建通常需要数分钟。数据库迁移会自动执行。启动后访问 `APP_ORIGIN`。

查看状态和日志：

```bash
docker compose ps
docker compose logs -f api web
```

停止服务（保留全部数据）：

```bash
docker compose down
```

## 3. 端口与防火墙

- `8080`：网页入口
- `9000`：文件上传与下载，必须能被用户设备访问
- `9001`：MinIO 管理台，仅绑定服务器本机，不对公网开放
- PostgreSQL 和 API 不直接暴露到公网

若使用云服务器，请在安全组中放行网页端口和存储端口。

## 4. 域名与 HTTPS

正式运营时建议准备两个 HTTPS 地址，例如：

- `https://app.example.com` → 本机 `8080`
- `https://storage.example.com` → 本机 `9000`

然后将 `.env` 更新为对应地址，将 `COOKIE_SECURE=true`，再重新执行 `docker compose up -d`。两个地址必须与浏览器实际访问地址完全一致，否则登录 Cookie、跨域上传或签名校验会失败。

## 5. 数据备份

业务数据保存在 Docker 卷 `paperlingo-production_postgres-data` 与 `paperlingo-production_minio-data` 中。升级前应同时备份数据库、对象存储卷和 `.env`。不要使用 `docker compose down -v`，该命令会删除全部持久化数据。

## 6. 更新版本

用新版部署包覆盖源码文件，但保留原 `.env`，然后执行：

```bash
docker compose up -d --build
```

迁移容器会自动应用新增数据库迁移。
