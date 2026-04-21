import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 添加 GPU 相关的启动选项，解决 GPU 进程崩溃问题
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');

let backendProcess = null;

function startBackend() {
  // 在打包环境中，后端和虚拟环境在 extraResources 目录下
  let resourcesPath;
  if (app.isPackaged) {
    resourcesPath = process.resourcesPath;
  } else {
    resourcesPath = __dirname;
  }
  
  // 尝试多种Python路径
  const possiblePythonPaths = [];
  
  // 1. 首先尝试虚拟环境中的Python
  if (platform() === 'win32') {
    possiblePythonPaths.push(path.join(resourcesPath, '.venv', 'Scripts', 'python.exe'));
    possiblePythonPaths.push(path.join(__dirname, '.venv', 'Scripts', 'python.exe'));
  } else {
    possiblePythonPaths.push(path.join(resourcesPath, '.venv', 'bin', 'python'));
    possiblePythonPaths.push(path.join(__dirname, '.venv', 'bin', 'python'));
  }
  
  // 2. 然后尝试系统Python
  possiblePythonPaths.push('python3');
  possiblePythonPaths.push('python');
  
  const backendPath = path.join(resourcesPath, 'backend', 'api_server.py');
  const backendCwd = path.join(resourcesPath, 'backend');
  
  // 尝试找到可用的Python
  let pythonExec = null;
  for (const possiblePath of possiblePythonPaths) {
    try {
      console.log(`Trying Python: ${possiblePath}`);
      // 测试Python是否可用
      require('child_process').execFileSync(possiblePath, ['--version'], { stdio: 'ignore' });
      pythonExec = possiblePath;
      console.log(`Found working Python: ${pythonExec}`);
      break;
    } catch (error) {
      console.log(`Python path ${possiblePath} not working`);
    }
  }
  
  if (!pythonExec) {
    console.error('无法找到可用的Python解释器！');
    return;
  }
  
  console.log(`Starting backend with Python: ${pythonExec}`);
  console.log(`Backend script: ${backendPath}`);
  console.log(`Backend cwd: ${backendCwd}`);
  
  backendProcess = spawn(pythonExec, [backendPath], {
    cwd: backendCwd,
    stdio: 'inherit'
  });

  backendProcess.on('error', (error) => {
    console.error('启动后端服务失败:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log('后端服务退出，退出码:', code);
  });
}

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
    icon: path.join(__dirname, 'public', 'icons', 'api_post64x64.ico'),
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