import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
/* global process */
import { writeFile } from 'fs/promises';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 添加 GPU 相关的启动选项，解决 GPU 进程崩溃问题
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const isDev = process.env.NODE_ENV === 'development';

// ─────────────────────────────────────────────
// 内联 hash_utils.js（避免打包后 ESM 跨文件 import 路径解析问题）
// ─────────────────────────────────────────────
class HashUtils {
  static C1_32 = -862048943;
  static C2_32 = 461845907;
  static R1_32 = 15;
  static R2_32 = 13;
  static M_32 = 5;
  static N_32 = -430675100;
  static DEFAULT_SEED = 104729;

  static hash32(data) {
    let buffer;
    if (typeof data === 'string') {
      buffer = Buffer.from(data, 'utf8');
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      throw new TypeError('data must be string or Buffer');
    }
    return HashUtils._hash32(buffer, 0, buffer.length, HashUtils.DEFAULT_SEED);
  }

  static _hash32(data, offset, length, seed) {
    let hash_val = seed | 0;
    const nblocks = length >> 2;
    let idx = 0;
    for (idx = 0; idx < nblocks; idx++) {
      const i = idx << 2;
      let k =
        (data[offset + i] & 0xff) |
        ((data[offset + i + 1] & 0xff) << 8) |
        ((data[offset + i + 2] & 0xff) << 16) |
        ((data[offset + i + 3] & 0xff) << 24);
      hash_val = HashUtils._mix32(k, hash_val);
    }
    idx = nblocks << 2;
    let k1 = 0;
    if (length - idx === 3) {
      k1 ^= data[offset + idx + 2] << 16;
      k1 ^= data[offset + idx + 1] << 8;
      hash_val = HashUtils._get_hash(data, offset, hash_val, idx, k1);
    } else if (length - idx === 2) {
      k1 ^= data[offset + idx + 1] << 8;
      hash_val = HashUtils._get_hash(data, offset, hash_val, idx, k1);
    } else if (length - idx === 1) {
      hash_val = HashUtils._get_hash(data, offset, hash_val, idx, k1);
    }
    return HashUtils._fmix32(length, hash_val);
  }

  static _get_hash(data, offset, hash_val, idx, k1) {
    k1 ^= data[offset + idx];
    k1 = Math.imul(k1, HashUtils.C1_32);
    k1 = HashUtils._rotate_left(k1, HashUtils.R1_32);
    k1 = Math.imul(k1, HashUtils.C2_32);
    hash_val ^= k1;
    return hash_val | 0;
  }

  static _mix32(k, hash_val) {
    k = Math.imul(k, HashUtils.C1_32);
    k = HashUtils._rotate_left(k, HashUtils.R1_32);
    k = Math.imul(k, HashUtils.C2_32);
    hash_val ^= k;
    let result =
      Math.imul(HashUtils._rotate_left(hash_val, HashUtils.R2_32), HashUtils.M_32) +
      HashUtils.N_32;
    return result | 0;
  }

  static _fmix32(length, hash_val) {
    hash_val ^= length;
    hash_val ^= hash_val >>> 16;
    hash_val = Math.imul(hash_val, -2048144789);
    hash_val ^= hash_val >>> 13;
    hash_val = Math.imul(hash_val, -1028477387);
    hash_val ^= hash_val >>> 16;
    return hash_val | 0;
  }

  static _rotate_left(x, n) {
    return (x << n) | (x >>> (32 - n));
  }
}

class CustNoShardingUtil {
  static calculate_hash(cust_no, total_sharding_table_number = 8) {
    let hash_key = HashUtils.hash32(cust_no);
    if (hash_key < 0) hash_key = Math.abs(hash_key);
    return (hash_key % total_sharding_table_number) + 1;
  }
}

// ─────────────────────────────────────────────
// 内联 db_checker.js
// ─────────────────────────────────────────────
class DataConsistencyChecker {
  constructor(configPath) {
    this.configPath = configPath;
    try {
      this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      this.config = { databases: {} };
      console.warn('Failed to load config.json:', err.message);
    }
  }

  getDbConfig(dbName) {
    return this.config.databases[dbName];
  }

  calculateRouting(custNoOrMedium, environment, baseName = 'tb_dpmst_medium') {
    let totalShardingTableNumber = 8;
    if (environment && ['T1', 'T2', 'SITA'].includes(environment.toUpperCase())) {
      totalShardingTableNumber = 16;
    }
    const hashResult = CustNoShardingUtil.calculate_hash(custNoOrMedium, totalShardingTableNumber);
    const dbIndex = Math.floor((hashResult - 1) / 2) + 1;
    const dbName = `dcdpdb${dbIndex}`;
    const tableSuffix = hashResult.toString().padStart(4, '0');
    return { dbName, tableNameWithSuffix: `${baseName}_${tableSuffix}`, hashResult, dbIndex };
  }

  quoteIdentifier(identifier, label = 'identifier') {
    if (typeof identifier !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid ${label}: ${identifier}`);
    }
    return `"${identifier}"`;
  }

  buildWhereClause(conditions) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { clause: '1=1', values: [] };
    }
    const values = [];
    const clause = Object.entries(conditions)
      .map(([k, v], index) => {
        values.push(v);
        return `${this.quoteIdentifier(k, 'column')} = $${index + 1}`;
      })
      .join(' AND ');
    return { clause, values };
  }

  async queryDatabase(dbIndex, environment, dbSettings, sqlQuery, values = [], dus = 'bdus') {
    if (!dbSettings || !dbSettings[environment]) {
      throw new Error(
        `配置错误: 当前环境 ${environment} 未配置任何数据源，请先在数据库配置中添加！`
      );
    }
    const allSources = dbSettings[environment];
    const filteredSources = allSources.filter((ds) => (ds.dus || 'bdus') === dus);
    if (filteredSources.length === 0) {
      throw new Error(
        `配置错误: 当前环境 ${environment} 未配置 [${dus}] 类型的数据源，请先在数据库配置中添加！`
      );
    }
    if (!filteredSources[dbIndex - 1]) {
      throw new Error(
        `配置错误: 当前环境 ${environment} 的 [${dus}] 数据源不足 (需要第 ${dbIndex} 个分片，当前共 ${filteredSources.length} 个)，请添加更多数据源！`
      );
    }
    const dbConfig = filteredSources[dbIndex - 1];

    // pg 使用动态 import，避免打包后 native module 路径解析问题
    const { default: pg } = await import('pg');
    const { Client } = pg;

    const client = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
    });
    await client.connect();
    try {
      const res = await client.query(sqlQuery, values);
      return res.rows;
    } finally {
      await client.end();
    }
  }

  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (
      typeof obj1 !== 'object' ||
      obj1 === null ||
      typeof obj2 !== 'object' ||
      obj2 === null
    )
      return false;
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;
    for (let key of keys1) {
      if (!keys2.includes(key) || !this.deepEqual(obj1[key], obj2[key])) return false;
    }
    return true;
  }

  async runCheck(request) {
    const logs = [];
    const addLog = (message, level = 'INFO') => {
      logs.push({ timestamp: new Date().toISOString(), level, message });
    };

    try {
      addLog('开始执行数据一致性检查 (Node.js)...');
      const {
        tables = [],
        tableConditions = {},
        tableSettings = {},
        environment = null,
      } = request;

      addLog('开始按顺序查询各表（支持跨表依赖）...');

      const beforeData = {};
      const tableResultsCache = {};

      for (const tableName of tables) {
        addLog(`处理表: ${tableName}`);
        const baseConditions = { ...(tableConditions[tableName] || {}) };
        const tableConfig = tableSettings[tableName];
        addLog(
          `  tableSettings中 ${tableName} 的配置: ${tableConfig ? JSON.stringify(tableConfig.conditionFields) : '(无配置)'}`
        );
        addLog(`  当前 tableResultsCache 的表: [${Object.keys(tableResultsCache).join(', ')}]`);
        if (tableConfig && tableConfig.conditionFields) {
          for (const cond of tableConfig.conditionFields) {
            if (cond.source !== 'table') continue;
            const parts = (cond.path || '').split('.');
            const depTable = parts[0];
            const depField = parts.slice(1).join('.');
            addLog(
              `  处理table依赖: field=${cond.field}, path=${cond.path}, depTable=${depTable}, depField=${depField}`
            );
            if (depTable && depField && tableResultsCache[depTable]) {
              const val = tableResultsCache[depTable][depField];
              if (val !== undefined && val !== null) {
                baseConditions[cond.field] = String(val);
                addLog(`  从表 ${depTable} 获取 ${cond.field} = ${val}`);
              } else {
                addLog(
                  `  警告: 依赖表 ${depTable} 中字段 ${depField} 不存在或为空，可用字段: [${Object.keys(tableResultsCache[depTable] || {}).join(', ')}]`,
                  'WARNING'
                );
              }
            } else {
              addLog(
                `  警告: 依赖表 ${depTable} 尚未查询或无结果缓存（缓存中有: [${Object.keys(tableResultsCache).join(', ')}]）`,
                'WARNING'
              );
            }
          }
        }

        if (Object.keys(baseConditions).length === 0) {
          addLog(`表 ${tableName} 没有查询条件，跳过查询`, 'WARNING');
          continue;
        }

        let routingValue = baseConditions.cust_no || baseConditions.zone_val;
        if (!routingValue) routingValue = Object.values(baseConditions)[0];

        const { dbName, tableNameWithSuffix, hashResult, dbIndex } = this.calculateRouting(
          routingValue,
          environment,
          tableName
        );
        const tableDus = tableSettings[tableName]?.dus || 'bdus';
        addLog(
          `路由到: 数据源 ${dbIndex} (${dbName}) . ${tableNameWithSuffix} (hash=${hashResult}) [DUS: ${tableDus}]`
        );

        const safeTableName = this.quoteIdentifier(tableNameWithSuffix, 'table');
        const { clause: whereClause, values } = this.buildWhereClause(baseConditions);
        const sqlQuery = `SELECT * FROM ${safeTableName} WHERE ${whereClause}`;

        let displaySqlQuery = sqlQuery;
        values.forEach((val, idx) => {
          const valStr = typeof val === 'string' ? `'${val}'` : val;
          displaySqlQuery = displaySqlQuery.replace(
            new RegExp(`\\$${idx + 1}(?!\\d)`, 'g'),
            valStr
          );
        });

        addLog(`SQL查询: ${displaySqlQuery}`, 'SQL');
        addLog(`查询条件: ${JSON.stringify(baseConditions)}`);

        try {
          addLog(`尝试连接到环境 ${environment} 的 [${tableDus}] 数据源 ${dbIndex}...`);
          const results = await this.queryDatabase(
            dbIndex,
            environment,
            request.dbSettings,
            sqlQuery,
            values,
            tableDus
          );
          addLog(`成功连接到 [${tableDus}] 数据源 ${dbIndex}`);
          beforeData[tableName] = { sql: displaySqlQuery, count: results.length, data: results };
          addLog(`查询到 ${results.length} 条记录`);
          if (results.length > 0) {
            tableResultsCache[tableName] = results[0];
            addLog(`缓存表 ${tableName} 的查询结果，供后续表依赖使用`);
          }
        } catch (e) {
          addLog(`查询失败: ${e.message}`, 'ERROR');
          throw e;
        }
      }

      if (request.apiResponse) {
        addLog('使用提供的API响应进行后续处理...');
      } else {
        addLog('未提供API响应，跳过接口调用');
      }

      const afterData = {};
      const afterResultsCache = {};

      for (const tableName of tables) {
        const baseConditions = { ...(tableConditions[tableName] || {}) };
        if (
          Object.keys(baseConditions).length === 0 &&
          !tableSettings[tableName]?.conditionFields?.some((c) => c.source === 'table')
        ) {
          continue;
        }

        const tableConfig = tableSettings[tableName];
        if (tableConfig && tableConfig.conditionFields) {
          for (const cond of tableConfig.conditionFields) {
            if (cond.source !== 'table') continue;
            const parts = (cond.path || '').split('.');
            const depTable = parts[0];
            const depField = parts.slice(1).join('.');
            if (depTable && depField && afterResultsCache[depTable]) {
              const val = afterResultsCache[depTable][depField];
              if (val !== undefined && val !== null) {
                baseConditions[cond.field] = String(val);
              }
            }
          }
        }

        if (Object.keys(baseConditions).length === 0) continue;

        let routingValue = baseConditions.cust_no || baseConditions.zone_val;
        if (!routingValue) routingValue = Object.values(baseConditions)[0];

        const tableDus = tableSettings[tableName]?.dus || 'bdus';
        const { dbName: _dbName, tableNameWithSuffix, dbIndex } = this.calculateRouting(
          routingValue,
          environment,
          tableName
        );
        const safeTableName = this.quoteIdentifier(tableNameWithSuffix, 'table');
        const { clause: whereClause, values } = this.buildWhereClause(baseConditions);
        const sqlQuery = `SELECT * FROM ${safeTableName} WHERE ${whereClause}`;

        let displaySqlQuery = sqlQuery;
        values.forEach((val, idx) => {
          const valStr = typeof val === 'string' ? `'${val}'` : val;
          displaySqlQuery = displaySqlQuery.replace(
            new RegExp(`\\$${idx + 1}(?!\\d)`, 'g'),
            valStr
          );
        });

        try {
          const results = await this.queryDatabase(
            dbIndex,
            environment,
            request.dbSettings,
            sqlQuery,
            values,
            tableDus
          );
          afterData[tableName] = { sql: displaySqlQuery, count: results.length, data: results };
          if (results.length > 0) afterResultsCache[tableName] = results[0];
        } catch (e) {
          addLog(`查询失败: ${e.message}`, 'ERROR');
          throw e;
        }
      }

      addLog('开始比对数据差异...');
      const resultsArray = [];

      for (const tableName of tables) {
        const before = beforeData[tableName] || {};
        const after = afterData[tableName] || {};
        if (before.error || after.error) {
          resultsArray.push({
            table: tableName,
            status: '错误',
            message: before.error || after.error,
            before,
            after,
            diff: null,
          });
          continue;
        }
        const beforeCount = before.count || 0;
        const afterCount = after.count || 0;
        if (beforeCount === afterCount && this.deepEqual(before.data, after.data)) {
          resultsArray.push({
            table: tableName,
            status: '通过',
            message: '数据一致性检查通过',
            before,
            after,
            diff: null,
          });
        } else {
          resultsArray.push({
            table: tableName,
            status: '失败',
            message: '数据不一致',
            before,
            after,
            diff: { count_changed: true },
          });
        }
      }

      addLog('数据一致性检查完成');
      return { success: true, logs, results: resultsArray };
    } catch (e) {
      addLog(`执行失败: ${e.message}`, 'ERROR');
      return { success: false, logs, results: [], error: e.message };
    }
  }
}

// ─────────────────────────────────────────────
// Electron 主进程逻辑
// ─────────────────────────────────────────────
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function startBackend() {
  console.log('Backend execution has been migrated to Node.js.');
}

let cachedTableSettings = {};
let backendProcess = null;

// 注册 IPC：前端主动保存 tableSettings 到主进程
ipcMain.handle('save-table-settings', async (event, tableSettings) => {
  if (isPlainObject(tableSettings)) {
    cachedTableSettings = tableSettings;
    console.log('[main] tableSettings cached, tables:', Object.keys(tableSettings));
    return { ok: true };
  }
  return { ok: false, error: 'Invalid table settings payload' };
});

// 注册 IPC：执行数据一致性校验
ipcMain.handle('run-node-check', async (event, requestPayload) => {
  if (!isPlainObject(requestPayload)) {
    throw new Error('Invalid request payload');
  }

  // backend 已内联，configPath 直接用 __dirname
  const configPath = path.join(__dirname, 'backend', 'config', 'config.json');
  const checker = new DataConsistencyChecker(configPath);
  let normalizedPayload = { ...requestPayload };

  if (
    !isPlainObject(normalizedPayload.tableSettings) ||
    Object.keys(normalizedPayload.tableSettings).length === 0
  ) {
    if (Object.keys(cachedTableSettings).length > 0) {
      console.log('[main] tableSettings missing in payload, using cached version');
      normalizedPayload = { ...normalizedPayload, tableSettings: cachedTableSettings };
    }
  } else {
    cachedTableSettings = normalizedPayload.tableSettings;
  }

  return await checker.runCheck(normalizedPayload);
});

// 注册 IPC：查询系统数据库（通用单次查询）
ipcMain.handle('query-system-db', async (event, { dbConfig, sql, values = [] }) => {
  if (!dbConfig || !sql) {
    throw new Error('缺少数据库配置或 SQL 语句');
  }
  const { default: pg } = await import('pg');
  const { Client } = pg;
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  try {
    const res = await client.query(sql, values);
    return { rows: res.rows };
  } finally {
    await client.end();
  }
});

// 注册 IPC：保存文件（导出配置）
ipcMain.handle('save-file', async (event, payload) => {
  try {
    const { content, filename } = payload ?? {};
    if (typeof content !== 'string' || typeof filename !== 'string') {
      return { success: false, error: 'Invalid save payload' };
    }
    const safeFilename = path.basename(filename);
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: safeFilename,
      filters: [
        { name: 'TOML 配置文件', extensions: ['toml'] },
        { name: '所有文件', extensions: ['*'] },
      ],
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
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      enableRemoteModule: false,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedPrefix = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(allowedPrefix)) {
      event.preventDefault();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
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
        { role: 'selectall', label: '全选' },
      ],
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
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
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
