import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';
import { writeFile } from 'fs/promises';
import { DataConsistencyChecker } from './backend/db_checker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 添加 GPU 相关的启动选项，解决 GPU 进程崩溃问题
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');

function startBackend() {
  console.log('Backend execution has been migrated to Node.js.');
}

// 主进程缓存的 tableSettings，即使旧表单页面没有传入也能使用
let cachedTableSettings = {};

// 注册 IPC：前端主动保存 tableSettings到主进程
ipcMain.handle('save-table-settings', async (event, tableSettings) => {
  if (tableSettings && typeof tableSettings === 'object') {
    cachedTableSettings = tableSettings;
    console.log('[main] tableSettings cached, tables:', Object.keys(tableSettings));
  }
  return { ok: true };
});

// 注册 IPC 调用处理 JS 版本的数据校验
ipcMain.handle('run-node-check', async (event, requestPayload) => {
  try {
    let resourcesPath;
    if (app.isPackaged) {
      resourcesPath = process.resourcesPath;
    } else {
      resourcesPath = __dirname;
    }
    const configPath = path.join(resourcesPath, 'backend', 'config', 'config.json');
    const checker = new DataConsistencyChecker(configPath);

    // 如果 payload 里没有 tableSettings，用主进程缓存的干干
    if (!requestPayload.tableSettings || Object.keys(requestPayload.tableSettings).length === 0) {
      if (Object.keys(cachedTableSettings).length > 0) {
        console.log('[main] tableSettings missing in payload, using cached version');
        requestPayload = { ...requestPayload, tableSettings: cachedTableSettings };
      }
    } else {
      // 更新缓存
      cachedTableSettings = requestPayload.tableSettings;
    }

    return await checker.runCheck(requestPayload);
  } catch (err) {
    throw err;
  }
});

// 注册 IPC：保存文件（导出配置）
ipcMain.handle('save-file', async (event, { content, filename }) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: 'TOML 配置文件', extensions: ['toml'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (canceled || !filePath) {
      return { success: false, cancelled: true };
    }
    await writeFile(filePath, content, 'utf-8');
    console.log('[main] 配置已导出到:', filePath);
    return { success: true, filePath };
  } catch (err) {
    console.error('[main] save-file 失败:', err);
    return { success: false, error: err.message };
  }
});

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    title: '数据一致性自动化核对工具',
    icon: path.join(__dirname, 'public', 'icons', 'api_post256x256.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// 创建应用程序菜单，包含编辑功能
const createMenu = () => {
  const template = [
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { role: 'selectall', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forcereload', label: '强制重新加载' },
        { role: 'toggledevtools', label: '切换开发者工具' },
        { type: 'separator' },
        { role: 'resetzoom', label: '重置缩放' },
        { role: 'zoomin', label: '放大' },
        { role: 'zoomout', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

createMenu();

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', function () {
  stopBackend();
});