# 数据一致性自动化核对工具

## 项目介绍
这是一个基于Electron的跨平台桌面应用，用于数据一致性检查。

## 功能特性
- 支持配置系统设置（系统配置
- 多环境API设置
- 数据库配置
- 数据一致性检查
- 支持多个检查表配置

## 技术栈
- 前端: React + Vite
- 后端: FastAPI + Python
- 桌面: Electron
- 数据库: PostgreSQL

## 快速开始
1. 克隆项目：
```bash
git clone https://github.com/Taylor-Ding/electron-app.git
cd electron-app
```

2. 安装前端依赖：
```bash
npm install
```

3. 创建Python虚拟环境并安装依赖：
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate  # Windows
pip install -r backend/requirements.txt
```

4. 开发模式运行：
```bash
npm run dev  # 启动前端开发服务器
npm run electron:dev  # 启动Electron
```

## 构建发布
项目使用GitHub Actions自动构建发布版本，支持多平台：
- macOS (x64 + arm64)
- Windows (x64)
- Linux (x64)

## 项目结构
```
electron-app/
├── backend/          # Python后端
├── src/             # React前端源代码
├── public/          # 静态资源
├── .github/        # GitHub配置
├── main.js         # Electron主进程
├── package.json    # 项目配置
```
