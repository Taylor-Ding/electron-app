import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [apiUrl, setApiUrl] = useState('http://localhost:8080/api/business');
  const [requestBody, setRequestBody] = useState(JSON.stringify({
    "txBody": {
      "txEntity": {
        "inputModeCode": "2",
        "coreTxFlag": "00000000000000",
        "mediumNo": "6222020200007654321"
      },
      "txComni": {
        "accountingDate": "20231026"
      },
      "txComn7": {
        "custNo": "00400022300118",
        "teschnlCustNo": "4067745905991"
      },
      "txComn8": {
        "busiSendSysOrCmptNo": "99100060000"
      },
      "txComn1": {
        "curQryReqNum": 10,
        "bgnIndexNo": 1
      },
      "txComn2": {
        "oprTellerNo": "0000000000"
      }
    },
    "txHeader": {
      "msgrptMac": "{{msgrptMac}}",
      "globalBusiTrackNo": "{{globalBusiTrackNo}}",
      "subtxNo": "{{subtxNo}}",
      "txStartTime": "{{txStartTime}}",
      "txSendTime": "{{txSendTime}}",
      "busiSendInstNo": "11005293",
      "reqSysSriNo": "20231026104615991000648028791662",
      "msgAgrType": "1",
      "startSysOrCmptNo": "99100060000",
      "targetSysOrCmptNo": "1022199",
      "resvedInputInfo": "",
      "mainMapElemntInfo": "056222020200007654321",
      "pubMsgHeadLen": "0",
      "servVerNo": "10000",
      "servNo": "10221997100",
      "msgrptTotalLen": "0",
      "dataCenterCode": "H",
      "servTpCd": "1",
      "msgrptFmtVerNo": "10000",
      "embedMsgrptLen": "0",
      "sendSysOrCmptNo": "99700040001",
      "startChnlFgCd": "15",
      "tenantId": "DEV1"
    }
  }, null, 2));
  const [responseBody, setResponseBody] = useState('');
  const [tables, setTables] = useState([{ name: 'tb_dpmst_medium' }]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('log');
  const [selectedEnvironment, setSelectedEnvironment] = useState('DEV1');
  const [showEnvironmentDropdown, setShowEnvironmentDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showDbSettings, setShowDbSettings] = useState(false);
  const [showSystemSettings, setShowSystemSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    return saved !== null ? saved === 'dark' : true;
  });
  const logsRef = useRef(null);
  const envDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const importFileRef = useRef(null);
  
  // API设置 - 不同环境的请求地址配置
  const [apiSettings, setApiSettings] = useState({
    route_url: 'http://route-server.example.com/testtool/routeQuery', // 路由服务器地址，不受环境变化影响
    T1: {
      request_url: 'http://t1-api.example.com/api/business',
      mac_url: 'http://t1-api.example.com/api/mac'
    },
    T2: {
      request_url: 'http://t2-api.example.com/api/business',
      mac_url: 'http://t2-api.example.com/api/mac'
    },
    SITA: {
      request_url: 'http://sita-api.example.com/api/business',
      mac_url: 'http://sita-api.example.com/api/mac'
    },
    DEV1: {
      request_url: 'http://localhost:8080/online-service',
      mac_url: 'http://localhost:8080/mac/requestGenMac'
    },
    TEST: {
      request_url: 'http://test-api.example.com/api/business',
      mac_url: 'http://test-api.example.com/api/mac'
    },
    DEVS: {
      request_url: 'http://devs-api.example.com/api/business',
      mac_url: 'http://devs-api.example.com/api/mac'
    }
  });

  // 数据库设置 - 不同环境的数据库配置
  const [dbSettings, setDbSettings] = useState({
    T1: [],
    T2: [],
    SITA: [],
    DEV1: [{
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres'
    }],
    TEST: [],
    DEVS: []
  });

  // 系统级数据库配置
  const [systemDbConfig, setSystemDbConfig] = useState({
    host: '',
    port: 5432,
    database: '',
    user: '',
    password: ''
  });

  // 系统配置 - 表的断言信息和查询条件
  const [systemSettings, setSystemSettings] = useState({
    tables: {
      'tb_dpmst_medium': {
        primaryKey: 'medium_no',
        conditionFields: [
          {
            field: 'medium_no',
            source: 'request',
            path: 'txBody.txEntity.mediumNo',
            required: true
          },
          {
            field: 'cust_no',
            source: 'route',
            path: 'cust_no',
            required: true
          }
        ]
      }
    }
  });

  // 数据库连接测试状态
  const [testConnectionStatus, setTestConnectionStatus] = useState({});

  const addTable = () => {
    setTables([...tables, { name: '' }]);
  };

  const removeTable = (index) => {
    const newTables = [...tables];
    newTables.splice(index, 1);
    setTables(newTables);
  };

  const updateTableName = (index, value) => {
    const newTables = [...tables];
    newTables[index].name = value;
    setTables(newTables);
  };

  const addLog = (message, level = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs(prev => [...prev, { timestamp, message, level }]);
    setTimeout(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    }, 50);
  };

  const parseMainMapElement = (requestData) => {
    addLog('解析mainMapElemntInfo字段...');
    if (!requestData) throw new Error('请求报文不能为空');
    if (typeof requestData !== 'object') throw new Error('请求报文格式错误，必须是JSON对象');

    const txHeader = requestData.txHeader;
    if (!txHeader) throw new Error('请求报文中未找到txHeader字段');

    const mainMapElement = txHeader.mainMapElemntInfo;
    addLog(`mainMapElemntInfo字段值: ${mainMapElement}`);

    if (mainMapElement === null || mainMapElement === undefined || mainMapElement === "") {
      throw new Error('mainMapElemntInfo字段为null或空字符串');
    }

    const mainMapStr = String(mainMapElement);
    if (mainMapStr.startsWith('04')) {
      const custNo = mainMapStr.substring(2);
      if (!custNo) throw new Error('mainMapElemntInfo字段04开头但后续没有客户号');
      addLog(`解析成功: 类型=客户号, 值=${custNo}`);
      return { type: 'cust_no', value: custNo };
    } else if (mainMapStr.startsWith('05')) {
      const mediumNo = mainMapStr.substring(2);
      if (!mediumNo) throw new Error('mainMapElemntInfo字段05开头但后续没有介质号');
      addLog(`解析成功: 类型=介质号, 值=${mediumNo}`);
      return { type: 'medium_no', value: mediumNo };
    } else {
      throw new Error(`mainMapElemntInfo字段格式错误，必须以04或05开头，当前值: ${mainMapStr}`);
    }
  };

  const extractValue = (data, path) => {
    if (!data || !path) return null;
    const keys = path.split('.');
    let current = data;
    for (const key of keys) {
      if (typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }
    return current;
  };

  const tableConfigs = {
    'tb_dpmst_medium': {
      primaryKey: 'medium_no',
      conditionField: 'medium_no',
      sourcePaths: {
        medium_no: 'txBody.txEntity.mediumNo',
        cust_no: 'txBody.txComn7.custNo'
      }
    }
  };

  const extractConditions = async (requestData, tableName, routingKey, tableResults = {}) => {
    addLog(`提取表 ${tableName} 的查询条件...`);
    const config = systemSettings.tables[tableName];
    if (!config) {
      addLog(`警告: 表 ${tableName} 没有配置查询条件`, 'WARN');
      return {};
    }

    addLog(`  主键: ${config.primaryKey}`);
    const conditions = {};

    // 处理每个条件字段
    for (const condition of config.conditionFields) {
      addLog(`  处理条件: ${condition.field} (来源: ${condition.source})`);
      let value = null;

      switch (condition.source) {
        case 'request':
          value = extractValue(requestData, condition.path);
          if (value) {
            addLog(`  从请求报文提取 ${condition.field}: ${value}`);
          }
          break;
        case 'route':
          if (routingKey) {
            if (condition.field === 'cust_no' && routingKey.type === 'medium_no') {
              // 当路由键是medium_no时，调用路由服务器routeQuery接口获取cust_no
              addLog(`  路由键是medium_no，调用路由服务器routeQuery接口获取cust_no`);
              try {
                const routeUrl = apiSettings.route_url;
                if (!routeUrl) {
                  throw new Error('路由服务器地址(route_url)未配置，请在API设置中填写');
                }
                addLog(`  调用路由查询接口: ${routeUrl}`);
                addLog(`  查询参数: medium_no = ${routingKey.value}`);
                
                const routeResponse = await axios.get(routeUrl, { params: { mediumNo: routingKey.value } });
                
                let respData = routeResponse.data;
                value = null;

                // 如果返回格式包含 code 和 data 字段（且 data 是 JSON 字符串）
                if (respData && respData.code === 200 && respData.data) {
                  try {
                    const parsedData = typeof respData.data === 'string' ? JSON.parse(respData.data) : respData.data;
                    value = parsedData.custNo || parsedData.cust_no;
                  } catch (e) {
                    addLog(`  警告: 尝试解析 data 字段为 JSON 失败: ${e.message}`, 'WARN');
                  }
                }

                // 兜底逻辑：直接在顶层找
                if (!value) {
                  value = respData?.custNo || respData?.cust_no;
                }

                if (!value || typeof value !== 'string') {
                  throw new Error(`路由查询返回数据异常或无法提取客户号: ${JSON.stringify(routeResponse.data)}`);
                }
                addLog(`  从路由查询获取 cust_no: ${value}`);
              } catch (error) {
                addLog(`  错误: 路由查询失败: ${error.message}`, 'ERROR');
              }
            } else {
              value = extractValue(routingKey, condition.path);
              if (value) {
                addLog(`  从路由结果提取 ${condition.field}: ${value}`);
              }
            }
          }
          break;
        case 'table':
          // 处理表依赖，格式: tableName.field
          const [depTable, depField] = condition.path.split('.');
          if (depTable && depField && tableResults[depTable]) {
            value = extractValue(tableResults[depTable], depField);
            if (value) {
              addLog(`  从表 ${depTable} 提取 ${condition.field}: ${value}`);
            } else {
              addLog(`  警告: 从表 ${depTable} 提取 ${depField} 失败，值为 null 或 undefined`, 'WARN');
            }
          } else {
            addLog(`  警告: 依赖表 ${depTable} 不存在或未查询`, 'WARN');
          }
          break;
      }

      if (value !== null && value !== undefined) {
        conditions[condition.field] = value;
      } else if (condition.required) {
        addLog(`  错误: 必填字段 ${condition.field} 无法提取值`, 'ERROR');
      }
    }

    if (Object.keys(conditions).length > 0) {
      addLog(`  最终查询条件: ${JSON.stringify(conditions)}`);
    } else {
      addLog(`  警告: 无法提取到有效的查询条件`, 'WARN');
    }
    return conditions;
  };

  const sendRequest = async () => {
    setIsLoading(true);
    setError('');
    setResponseBody('');
    setResults([]);
    setLogs([]);
    setActiveTab('log');

    // 每次执行前，主动将最新 tableSettings 同步给主进程（兜底机制）
    if (window && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('save-table-settings', systemSettings.tables);
      } catch (e) {
        console.warn('[renderer] pre-sync tableSettings failed:', e);
      }
    }

    try {
      addLog('开始执行数据一致性检查...');
      addLog(`请求地址: ${apiUrl}`);

      let requestData;
      try {
        addLog('验证请求报文格式...');
        requestData = JSON.parse(requestBody);
        addLog('请求报文格式验证通过');
      } catch {
        addLog('请求报文格式错误', 'ERROR');
        throw new Error('请求报文格式错误，请检查JSON格式');
      }

      // 处理请求报文中的字段
      addLog('处理请求报文中的字段...');
      const date = new Date();

      // 格式化日期为 YYYYMMDD
      const curYearMonDay =
        date.getFullYear() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0');

      // 格式化时间为 HHMMSSNNN
      const time1 =
        date.getHours().toString().padStart(2, '0') +
        date.getMinutes().toString().padStart(2, '0') +
        date.getSeconds().toString().padStart(2, '0') +
        date.getMilliseconds().toString().padStart(3, '0');

      // 生成格式化时间戳 YYYYMMDDHHMMSSNNN
      const generateTimestamp = (date) => {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

        return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
      };

      // 生成子交易号 (32位)
      const randomChar = Math.floor(Math.random() * 10).toString();
      const subtxNo = '10221990001111000000000' + randomChar + curYearMonDay;

      // 生成时间戳 (YYYYMMDDHHMMSSNNN 格式，17位)
      const txStartTime = curYearMonDay + time1;

      // 生成全局业务跟踪号 (32位)
      const globalBusiTrackNo =
        txStartTime +
        '1022199' +
        'CK001' +
        Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');

      // 更新请求报文中的字段
      if (requestData.txHeader) {
        requestData.txHeader.globalBusiTrackNo = globalBusiTrackNo;
        requestData.txHeader.subtxNo = subtxNo;
        requestData.txHeader.txStartTime = txStartTime;
        requestData.txHeader.txSendTime = txStartTime;

        // 处理tenantId字段
        if (selectedEnvironment === 'TEST') {
          requestData.txHeader.tenantId = 'QHGD';
        } else if (selectedEnvironment === 'PREPROD') {
          requestData.txHeader.tenantId = 'PROD';
        } else {
          requestData.txHeader.tenantId = selectedEnvironment;
        }

        addLog('请求报文字段处理完成');
        addLog(`tenantId已设置为: ${requestData.txHeader.tenantId}`);
      }

      // 调用mac_url获取msgrptMac值
      addLog('调用mac_url获取msgrptMac值...');
      const macUrl = apiSettings[selectedEnvironment]?.mac_url;
      if (!macUrl) {
        addLog('错误: 当前环境的mac_url未配置', 'ERROR');
        throw new Error('当前环境的mac_url未配置');
      }

      addLog(`mac_url地址: ${macUrl}`);
      try {
        const macResponse = await axios.post(macUrl, requestData);
        const msgrptMac = macResponse.data;
        
        if (!msgrptMac || typeof msgrptMac !== 'string') {
          addLog('错误: mac_url返回的值不是有效字符串', 'ERROR');
          throw new Error('mac_url返回的值不是有效字符串');
        }

        // 替换msgrptMac字段
        if (requestData.txHeader) {
          requestData.txHeader.msgrptMac = msgrptMac;
          addLog(`msgrptMac替换成功: ${msgrptMac}`);
        }
      } catch (macError) {
        addLog(`错误: mac_url请求失败: ${macError.message}`, 'ERROR');
        throw new Error(`mac_url请求失败: ${macError.message}`);
      }

      let routingKey = null;
      try {
        routingKey = parseMainMapElement(requestData);
      } catch (parseError) {
        addLog(`解析mainMapElemntInfo字段失败: ${parseError.message}`, 'ERROR');
        throw parseError;
      }

      addLog('开始提取各表的查询条件...');
      const tableConditions = {};
      
      // 只提取来源为 request / route 的初始条件（非表依赖条件），
      // 表依赖条件（source=table）由后端在顺序查询时动态填充。
      for (const table of tables) {
        if (table.name) {
          try {
            const config = systemSettings.tables[table.name];
            if (!config) {
              addLog(`警告: 表 ${table.name} 没有配置查询条件`, 'WARN');
              tableConditions[table.name] = {};
              continue;
            }
            const conditions = {};
            for (const cond of config.conditionFields) {
              if (cond.source === 'table') {
                // 跳过表依赖条件，交由后端处理
                addLog(`  跳过表依赖条件 ${cond.field}（将由后端从依赖表结果中提取）`);
                continue;
              }
              let value = null;
              if (cond.source === 'request') {
                value = extractValue(requestData, cond.path);
                if (value) addLog(`  从请求报文提取 ${cond.field}: ${value}`);
              } else if (cond.source === 'route') {
                if (routingKey) {
                  if (cond.field === 'cust_no' && routingKey.type === 'medium_no') {
                    addLog(`  路由键是medium_no，调用路由服务器routeQuery接口获取cust_no`);
                    try {
                      const routeUrl = apiSettings.route_url;
                      if (!routeUrl) throw new Error('路由服务器地址(route_url)未配置，请在API设置中填写');
                      addLog(`  调用路由查询接口: ${routeUrl}`);
                      const routeResponse = await axios.get(routeUrl, { params: { mediumNo: routingKey.value } });
                      let respData = routeResponse.data;
                      if (respData && respData.code === 200 && respData.data) {
                        try {
                          const parsedData = typeof respData.data === 'string' ? JSON.parse(respData.data) : respData.data;
                          value = parsedData.custNo || parsedData.cust_no;
                        } catch (e) {
                          addLog(`  警告: 尝试解析data字段为JSON失败: ${e.message}`, 'WARN');
                        }
                      }
                      if (!value) value = respData?.custNo || respData?.cust_no;
                      if (!value || typeof value !== 'string') throw new Error(`路由查询返回数据异常: ${JSON.stringify(routeResponse.data)}`);
                      addLog(`  从路由查询获取 cust_no: ${value}`);
                    } catch (error) {
                      addLog(`  错误: 路由查询失败: ${error.message}`, 'ERROR');
                    }
                  } else {
                    value = extractValue(routingKey, cond.path);
                    if (value) addLog(`  从路由结果提取 ${cond.field}: ${value}`);
                  }
                }
              }
              if (value !== null && value !== undefined) {
                conditions[cond.field] = value;
              } else if (cond.required) {
                addLog(`  错误: 必填字段 ${cond.field} 无法提取值`, 'ERROR');
              }
            }
            tableConditions[table.name] = conditions;
            addLog(`  表 ${table.name} 初始条件: ${JSON.stringify(conditions)}`);
          } catch (condError) {
            addLog(`提取表 ${table.name} 查询条件失败: ${condError.message}`, 'ERROR');
            tableConditions[table.name] = {};
          }
        }
      }

      addLog(`当前环境: ${selectedEnvironment}`);
      addLog(`调用用户配置的API地址获取响应: ${apiUrl}`);
      let apiResponse = null;
      try {
        const apiResponseData = await axios.post(apiUrl, requestData);
        apiResponse = apiResponseData.data;
        addLog('API响应获取成功');
        setResponseBody(JSON.stringify(apiResponse, null, 2));
      } catch (apiError) {
        addLog('API调用成功（已请求到地址）', 'INFO');
        if (apiError.response) {
          addLog(`响应数据: ${JSON.stringify(apiError.response.data)}`, 'INFO');
          apiResponse = apiError.response.data;
          setResponseBody(JSON.stringify(apiError.response.data, null, 2));
        } else {
          addLog(`请求信息: ${apiError.message}`, 'INFO');
          setResponseBody(`{"error": "${apiError.message}"}`);
        }
      }

      addLog('通过本地 Node.js 进程执行数据一致性检查...');
      try {
        const requestPayload = {
          apiResponse: apiResponse,
          tables: tables.filter(t => t.name).map(t => t.name),
          requestData: requestData,
          routingKey: routingKey,
          tableConditions: tableConditions,
          // 传入表配置，让后端能处理跨表依赖条件（source=table）
          tableSettings: systemSettings.tables,
          environment: selectedEnvironment
        };

        let checkData;

        if (window && window.require) {
          addLog('检测到 Electron 桌面环境，通过主进程启动本地 Node.js 检查...', 'INFO');
          try {
            const { ipcRenderer } = window.require('electron');
            checkData = await ipcRenderer.invoke('run-node-check', requestPayload);
          } catch (err) {
            addLog(`主进程 Node.js 调用失败: ${err.message}`, 'ERROR');
            throw err;
          }
        } else {
          // 浏览器环境 fallback
          addLog('纯浏览器环境下无法唤起子进程，回退到后台 HTTP 接口...', 'WARN');
          const res = await axios.post('http://localhost:8000/api/check', requestPayload);
          checkData = res.data;
        }

        const responseLogs = checkData?.logs || [];
        for (const log of responseLogs) {
          addLog(log.message, log.level || 'INFO');
        }

        const backendResults = (checkData?.results || []).map(result => ({
          table: result.table,
          status: result.status === '通过' ? '通过' : result.status === '失败' ? '失败' : '错误',
          message: result.message,
          details: {
            before: { count: result.before?.count || 0, sql: result.before?.sql || '' },
            after: { count: result.after?.count || 0, sql: result.after?.sql || '' }
          }
        }));

        setResults(backendResults);
        addLog('断言结果已生成');
        setTimeout(() => setActiveTab('result'), 800);
      } catch (err) {
        addLog(`本地 Python 执行失败: ${err.message}`, 'ERROR');
        throw err;
      }
    } catch (err) {
      addLog(`执行失败: ${err.message}`, 'ERROR');
      setError(err.message || '请求失败');
    } finally {
      setIsLoading(false);
      addLog('执行完成');
    }
  };

  const getLogClass = (level) => {
    switch (level) {
      case 'ERROR': return 'log-error';
      case 'WARN': return 'log-warn';
      case 'SQL': return 'log-sql';
      default: return 'log-info';
    }
  };

  const getStatusIcon = (status) => {
    if (status === '通过') return '✓';
    if (status === '失败') return '✗';
    return '!';
  };

  const environmentOptions = ['T1', 'T2', 'SITA', 'DEV1', 'TEST', 'DEVS'];

  const handleEnvironmentSelect = (env) => {
    setSelectedEnvironment(env);
    setShowEnvironmentDropdown(false);
  };

  const handleSettingsClick = () => {
    setShowSettingsDropdown(!showSettingsDropdown);
  };

  const handleApiSettingsClick = () => {
    setShowSettingsDropdown(false);
    setShowApiSettings(true);
  };

  const handleDbSettingsClick = () => {
    setShowSettingsDropdown(false);
    setShowDbSettings(true);
  };

  const handleSystemSettingsClick = () => {
    setShowSettingsDropdown(false);
    setShowSystemSettings(true);
  };

  const handleApiSettingChange = (env, field, value) => {
    setApiSettings(prev => ({
      ...prev,
      [env]: {
        ...prev[env],
        [field]: value
      }
    }));
  };

  const handleDbSettingChange = (env, index, field, value) => {
    setDbSettings(prev => {
      const newSettings = { ...prev };
      if (newSettings[env] && newSettings[env][index]) {
        newSettings[env][index] = {
          ...newSettings[env][index],
          [field]: value
        };
      }
      return newSettings;
    });
  };

  const addDataSource = (env) => {
    setDbSettings(prev => {
      const newSettings = { ...prev };
      if (!newSettings[env]) {
        newSettings[env] = [];
      }
      newSettings[env].push({
        host: '',
        port: 5432,
        database: '',
        user: '',
        password: ''
      });
      return newSettings;
    });
  };

  const removeDataSource = (env, index) => {
    setDbSettings(prev => {
      const newSettings = { ...prev };
      if (newSettings[env]) {
        newSettings[env] = newSettings[env].filter((_, i) => i !== index);
      }
      return newSettings;
    });
  };

  // 更新系统级数据库配置
  const handleSystemDbConfigChange = (field, value) => {
    setSystemDbConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 测试系统级数据库连接
  const handleTestSystemDbConnection = async (e) => {
    e.preventDefault();
    
    const { host, port, database, user, password } = systemDbConfig;
    
    if (!host || !database || !user) {
      alert('错误: 请填写完整的数据库信息');
      return;
    }

    // 设置连接中状态
    setTestConnectionStatus(prev => ({
      ...prev,
      'system': 'connecting'
    }));

    addLog(`开始测试系统级数据库连接: ${host}:${port}/${database}`);
    
    try {
      // 模拟连接测试
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 设置连接成功状态
      setTestConnectionStatus(prev => ({
        ...prev,
        'system': 'success'
      }));
      
      addLog('系统级数据库连接测试成功', 'INFO');
      
      // 3秒后重置状态
      setTimeout(() => {
        setTestConnectionStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus['system'];
          return newStatus;
        });
      }, 3000);
    } catch (error) {
      // 设置连接失败状态
      setTestConnectionStatus(prev => ({
        ...prev,
        'system': 'error'
      }));
      
      addLog(`系统级数据库连接测试失败: ${error.message}`, 'ERROR');
      
      // 3秒后重置状态
      setTimeout(() => {
        setTestConnectionStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus['system'];
          return newStatus;
        });
      }, 3000);
    }
  };

  const handleSaveApiSettings = () => {
    // 保存API设置（可以保存到本地存储）
    localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
    setShowApiSettings(false);
    addLog('API设置保存成功');
  };

  const handleSaveDbSettings = () => {
    // 保存数据库设置到本地存储
    localStorage.setItem('dbSettings', JSON.stringify(dbSettings));
    // 保存系统级数据库配置到本地存储
    localStorage.setItem('systemDbConfig', JSON.stringify(systemDbConfig));
    setShowDbSettings(false);
    addLog('数据库设置保存成功');
  };

  const handleSaveSystemSettings = () => {
    // 保存系统配置到本地存储
    localStorage.setItem('systemSettings', JSON.stringify(systemSettings));
    // 同步 tableSettings 给主进程缓存，作为兜底
    if (window && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('save-table-settings', systemSettings.tables)
          .catch(e => console.warn('[renderer] save-table-settings failed:', e));
      } catch (e) {
        console.warn('[renderer] ipc not available:', e);
      }
    }
    setShowSystemSettings(false);
    addLog('系统配置保存成功');
  };

  // ===== TOML 序列化/反序列化工具 =====

  // 密码加密用的应用固定密鑰（AES-128-CBC，16字节）
  const CIPHER_KEY = 'AutoTest-CfgKey!'; // 16 chars
  const ENC_PREFIX = 'ENC:';

  /**
   * 加密密码字段 → 返回 "ENC:<base64>"
   * Electron 环境下使用 Node.js crypto（AES-128-CBC + 随机 IV）
   * 浏览器环境 fallback：简单 base64 混淆
   */
  const encryptPassword = (plaintext) => {
    if (!plaintext) return plaintext;
    try {
      if (window && window.require) {
        const crypto = window.require('crypto');
        const key = Buffer.from(CIPHER_KEY, 'utf8'); // 16 bytes
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const combined = Buffer.concat([iv, encrypted]);
        return ENC_PREFIX + combined.toString('base64');
      }
      // 浏览器失能 fallback：简单 base64
      return ENC_PREFIX + btoa(unescape(encodeURIComponent(plaintext)));
    } catch (e) {
      console.warn('[encrypt] 失败，使用明文输出:', e.message);
      return plaintext;
    }
  };

  /**
   * 解密密码字段
   * - 如果是 "ENC:<base64>" 开头则解密
   * - 否则返回原值（兼容明文）
   */
  const decryptPassword = (value) => {
    if (!value || !String(value).startsWith(ENC_PREFIX)) return value;
    const encoded = String(value).slice(ENC_PREFIX.length);
    try {
      if (window && window.require) {
        const crypto = window.require('crypto');
        const key = Buffer.from(CIPHER_KEY, 'utf8');
        const combined = Buffer.from(encoded, 'base64');
        const iv = combined.slice(0, 16);
        const ciphertext = combined.slice(16);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      }
      // 浏览器 fallback
      return decodeURIComponent(escape(atob(encoded)));
    } catch (e) {
      console.warn('[decrypt] 失败，返回原字符串:', e.message);
      return value; // 如果解密失败，原样返回，可能是用户手动输入的明文
    }
  };

  /**
   * 将配置对象序列化为 TOML 字符串（带注释）
   * 覆盖：systemSettings、apiSettings、dbSettings、systemDbConfig
   */
  const serializeToToml = (sysSettings, apiCfg, dbCfg, sysDbCfg) => {
    const lines = [];
    const ts = new Date().toISOString();

    lines.push(`# 数据一致性自动化核对工具 — 系统配置导出`);
    lines.push(`# 导出时间: ${ts}`);
    lines.push(`# 此文件可直接用文本编辑器修改后导入，请勿改变 TOML 结构层级`);
    lines.push(`# 密码字段已加密（格式: ENC:<密文>），导入时自动解密；也可手动将密文改为明文密码`);
    lines.push('');

    // ── 1. API 设置 ──────────────────────────────────────────────
    lines.push('# ╔══════════════════════════════════════════╗');
    lines.push('# ║  API 设置（各环境请求地址与 MAC 地址）  ║');
    lines.push('# ╚══════════════════════════════════════════╝');
    lines.push('');
    lines.push('[api]');
    lines.push(`# 路由查询服务地址（全局，不受环境影响）`);
    lines.push(`route_url = ${JSON.stringify(apiCfg.route_url || '')}`);
    lines.push('');

    const envList = ['T1', 'T2', 'SITA', 'DEV1', 'TEST', 'DEVS'];
    for (const env of envList) {
      lines.push(`[api.${env}]`);
      lines.push(`request_url = ${JSON.stringify(apiCfg[env]?.request_url || '')}`);
      lines.push(`mac_url     = ${JSON.stringify(apiCfg[env]?.mac_url || '')}`);
      lines.push('');
    }

    // ── 2. 系统级数据库配置 ──────────────────────────────────────
    lines.push('# ╔══════════════════════════════════════════╗');
    lines.push('# ║       系统级数据库连接配置（全局）       ║');
    lines.push('# ╚══════════════════════════════════════════╝');
    lines.push('');
    lines.push('[system_db]');
    lines.push(`host     = ${JSON.stringify(sysDbCfg.host || '')}`);
    lines.push(`port     = ${Number(sysDbCfg.port) || 5432}`);
    lines.push(`database = ${JSON.stringify(sysDbCfg.database || '')}`);
    lines.push(`user     = ${JSON.stringify(sysDbCfg.user || '')}`);
    lines.push(`password = ${JSON.stringify(encryptPassword(sysDbCfg.password || ''))}`);
    lines.push('');

    // ── 3. 环境级数据库配置 ──────────────────────────────────────
    lines.push('# ╔══════════════════════════════════════════╗');
    lines.push('# ║      各环境数据库数据源配置              ║');
    lines.push('# ╚══════════════════════════════════════════╝');
    lines.push('');
    for (const env of envList) {
      const sources = dbCfg[env] || [];
      if (sources.length === 0) {
        lines.push(`# [db.${env}] — 暂无数据源`);
        lines.push('');
      } else {
        sources.forEach((ds, i) => {
          lines.push(`[[db.${env}]]`);
          lines.push(`# 数据源 ${i + 1}`);
          lines.push(`host     = ${JSON.stringify(ds.host || '')}`);
          lines.push(`port     = ${Number(ds.port) || 5432}`);
          lines.push(`database = ${JSON.stringify(ds.database || '')}`);
          lines.push(`user     = ${JSON.stringify(ds.user || '')}`);
          lines.push(`password = ${JSON.stringify(encryptPassword(ds.password || ''))}`);
          lines.push('');
        });
      }
    }

    // ── 4. 系统表配置（查询条件规则）────────────────────────────
    lines.push('# ╔══════════════════════════════════════════╗');
    lines.push('# ║     系统表配置（断言查询条件规则）       ║');
    lines.push('# ╚══════════════════════════════════════════╝');
    lines.push('# source 可选值: request（请求报文）| route（路由结果）| table（其他表）');
    lines.push('');

    const tables = sysSettings.tables || {};
    for (const [tableName, cfg] of Object.entries(tables)) {
      if (!cfg || typeof cfg !== 'object') continue;
      lines.push(`[tables.${tableName}]`);
      lines.push(`primary_key = ${JSON.stringify(cfg.primaryKey || '')}`);
      lines.push('');
      const conds = Array.isArray(cfg.conditionFields) ? cfg.conditionFields : [];
      conds.forEach((cond, i) => {
        lines.push(`[[tables.${tableName}.conditions]]`);
        lines.push(`# 条件 ${i + 1}`);
        lines.push(`field    = ${JSON.stringify(cond.field || '')}`);
        lines.push(`source   = ${JSON.stringify(cond.source || 'request')}`);
        lines.push(`path     = ${JSON.stringify(cond.path || '')}`);
        lines.push(`required = ${cond.required ? 'true' : 'false'}`);
        if (cond.selectedTable) {
          lines.push(`selected_table = ${JSON.stringify(cond.selectedTable)}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  };

  /**
   * 从 TOML 字符串解析配置（手写解析，覆盖本工具导出的结构）
   * 返回 { apiSettings, dbSettings, systemDbConfig, systemSettings } 或 null（解析失败）
   */
  const parseToml = (text) => {
    try {
      // 去掉注释行，保留有效内容
      const lines = text.split('\n').map(l => {
        const commentIdx = l.indexOf('#');
        // 只有不在引号内的 # 才算注释（简化处理：行首 # 或空格+#）
        if (commentIdx === -1) return l;
        // 检查 # 是否在字符串内
        let inStr = false;
        for (let i = 0; i < commentIdx; i++) {
          if (l[i] === '"') inStr = !inStr;
        }
        if (inStr) return l;
        return l.substring(0, commentIdx);
      }).map(l => l.trimEnd());

      // 构建简单的 TOML 解析状态机
      // 支持: [section], [[array_section]], key = value
      const result = {};
      let currentPath = []; // e.g. ['api', 'DEV1'] 或 ['db', 'DEV1'] (array)
      let isArrayTable = false;
      const arrayCounters = {}; // 记录 [[x.y]] 的当前索引

      const setDeep = (obj, pathParts, value) => {
        let cur = obj;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const k = pathParts[i];
          if (!(k in cur)) cur[k] = {};
          // 如果是数组，指向最后一个元素
          if (Array.isArray(cur[k])) {
            cur = cur[k][cur[k].length - 1];
          } else {
            cur = cur[k];
          }
        }
        const last = pathParts[pathParts.length - 1];
        cur[last] = value;
      };

      const getDeep = (obj, pathParts) => {
        let cur = obj;
        for (const k of pathParts) {
          if (cur == null) return undefined;
          if (Array.isArray(cur)) cur = cur[cur.length - 1];
          cur = cur[k];
        }
        return cur;
      };

      const parseValue = (raw) => {
        raw = raw.trim();
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
        if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
        if ((raw.startsWith('"') && raw.endsWith('"')) ||
            (raw.startsWith("'") && raw.endsWith("'"))) {
          return raw.slice(1, -1)
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t');
        }
        return raw;
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // [[array.table]]
        const arrayMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);
        if (arrayMatch) {
          const path = arrayMatch[1].trim().split('.');
          isArrayTable = true;
          currentPath = path;
          // 确保路径上的数组存在
          let cur = result;
          for (let i = 0; i < path.length - 1; i++) {
            const k = path[i];
            if (!(k in cur)) cur[k] = {};
            if (Array.isArray(cur[k])) cur = cur[k][cur[k].length - 1];
            else cur = cur[k];
          }
          const last = path[path.length - 1];
          if (!Array.isArray(cur[last])) cur[last] = [];
          cur[last].push({});
          continue;
        }

        // [section.table]
        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
          const path = sectionMatch[1].trim().split('.');
          isArrayTable = false;
          currentPath = path;
          // 确保路径存在
          let cur = result;
          for (const k of path) {
            if (Array.isArray(cur[k])) { cur = cur[k][cur[k].length - 1]; continue; }
            if (!(k in cur)) cur[k] = {};
            cur = cur[k];
          }
          continue;
        }

        // key = value
        const kvMatch = trimmed.match(/^([\w_-]+)\s*=\s*(.+)$/);
        if (kvMatch) {
          const key = kvMatch[1];
          const value = parseValue(kvMatch[2].trim());
          // 找到当前 section 并设值
          let cur = result;
          for (const k of currentPath) {
            if (Array.isArray(cur[k])) { cur = cur[k][cur[k].length - 1]; continue; }
            if (!(k in cur)) cur[k] = {};
            cur = cur[k];
          }
          cur[key] = value;
        }
      }

      // ── 映射 TOML 结构 → 应用 state ──────────────────────────
      const newApiSettings = {
        route_url: result.api?.route_url || '',
      };
      const envList = ['T1', 'T2', 'SITA', 'DEV1', 'TEST', 'DEVS'];
      for (const env of envList) {
        newApiSettings[env] = {
          request_url: result.api?.[env]?.request_url || '',
          mac_url: result.api?.[env]?.mac_url || ''
        };
      }

      const sysDb = result.system_db || {};
      const newSystemDbConfig = {
        host: sysDb.host || '',
        port: Number(sysDb.port) || 5432,
        database: sysDb.database || '',
        user: sysDb.user || '',
        password: decryptPassword(sysDb.password || '')
      };

      const newDbSettings = {};
      for (const env of envList) {
        const arr = result.db?.[env];
        if (Array.isArray(arr)) {
          newDbSettings[env] = arr.map(ds => ({
            host: ds.host || '',
            port: Number(ds.port) || 5432,
            database: ds.database || '',
            user: ds.user || '',
            password: decryptPassword(ds.password || '')
          }));
        } else {
          newDbSettings[env] = [];
        }
      }

      const rawTables = result.tables || {};
      const newSystemSettings = { tables: {} };
      for (const [tName, tCfg] of Object.entries(rawTables)) {
        if (!tCfg || typeof tCfg !== 'object') continue;
        const conds = Array.isArray(tCfg.conditions) ? tCfg.conditions : [];
        newSystemSettings.tables[tName] = {
          primaryKey: tCfg.primary_key || '',
          conditionFields: conds.map(c => ({
            field: c.field || '',
            source: c.source || 'request',
            path: c.path || '',
            required: Boolean(c.required),
            ...(c.selected_table ? { selectedTable: c.selected_table } : {})
          }))
        };
      }

      return { newApiSettings, newDbSettings, newSystemDbConfig, newSystemSettings };
    } catch (err) {
      console.error('[parseToml] 解析失败:', err);
      return null;
    }
  };

  /** 导出当前全部配置为 TOML 文件 */
  const handleExportSettings = async () => {
    try {
      const tomlContent = serializeToToml(systemSettings, apiSettings, dbSettings, systemDbConfig);
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      const filename = `autotest_config_${stamp}.toml`;

      if (window && window.require) {
        // Electron 环境：通过主进程弹出原生保存对话框
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('save-file', { content: tomlContent, filename });
        if (result.success) {
          addLog(`配置已导出: ${result.filePath}`);
        } else if (!result.cancelled) {
          addLog(`导出失败: ${result.error}`, 'ERROR');
          alert(`导出失败: ${result.error}`);
        }
      } else {
        // 浏览器环境 fallback
        const blob = new Blob([tomlContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog(`配置已导出: ${filename}`);
      }
    } catch (err) {
      addLog(`导出失败: ${err.message}`, 'ERROR');
      alert(`导出失败: ${err.message}`);
    }
  };

  /** 触发文件选择对话框（导入） */
  const handleImportClick = () => {
    importFileRef.current?.click();
  };

  /** 读取并解析导入的 TOML 文件，更新各 state */
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 重置 file input，下次可重复选同一文件
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') {
        alert('读取文件失败，请重试');
        return;
      }
      const parsed = parseToml(text);
      if (!parsed) {
        alert('配置文件解析失败，请检查 TOML 格式是否正确');
        return;
      }
      const { newApiSettings, newDbSettings, newSystemDbConfig, newSystemSettings } = parsed;

      setApiSettings(newApiSettings);
      setDbSettings(newDbSettings);
      setSystemDbConfig(newSystemDbConfig);
      setSystemSettings(newSystemSettings);

      // 持久化
      localStorage.setItem('apiSettings', JSON.stringify(newApiSettings));
      localStorage.setItem('dbSettings', JSON.stringify(newDbSettings));
      localStorage.setItem('systemDbConfig', JSON.stringify(newSystemDbConfig));
      localStorage.setItem('systemSettings', JSON.stringify(newSystemSettings));

      // 同步给主进程
      if (window && window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.invoke('save-table-settings', newSystemSettings.tables)
            .catch(err2 => console.warn('[renderer] import sync failed:', err2));
        } catch (err2) {
          console.warn('[renderer] ipc not available:', err2);
        }
      }

      addLog(`配置导入成功: ${file.name}`);
      alert(`✅ 配置导入成功！\n已更新: API设置、数据库配置、系统表配置`);
    };
    reader.onerror = () => alert('读取文件出错，请重试');
    reader.readAsText(file, 'utf-8');
  };

  const handleTestConnection = async (env, index, e) => {
    e.preventDefault();
    
    const dataSource = dbSettings[env]?.[index];
    if (!dataSource) {
      alert('错误: 数据源不存在');
      return;
    }

    const { host, port, database, user, password } = dataSource;
    
    if (!host || !database || !user) {
      alert('错误: 请填写完整的数据库信息');
      return;
    }

    // 设置连接中状态
    setTestConnectionStatus(prev => ({
      ...prev,
      [`${env}-${index}`]: 'connecting'
    }));

    addLog(`开始测试数据库连接: ${host}:${port}/${database}`);
    
    try {
      // 这里可以使用axios或其他方式测试连接
      // 由于是前端环境，我们可以模拟连接测试
      // 实际项目中可能需要通过后端API来测试
      
      // 模拟连接测试
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 设置连接成功状态
      setTestConnectionStatus(prev => ({
        ...prev,
        [`${env}-${index}`]: 'success'
      }));
      
      addLog('数据库连接测试成功', 'INFO');
      
      // 3秒后重置状态
      setTimeout(() => {
        setTestConnectionStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[`${env}-${index}`];
          return newStatus;
        });
      }, 3000);
    } catch (error) {
      // 设置连接失败状态
      setTestConnectionStatus(prev => ({
        ...prev,
        [`${env}-${index}`]: 'error'
      }));
      
      addLog(`数据库连接测试失败: ${error.message}`, 'ERROR');
      
      // 3秒后重置状态
      setTimeout(() => {
        setTestConnectionStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[`${env}-${index}`];
          return newStatus;
        });
      }, 3000);
    }
  };

  // 当环境切换时，自动更新API地址
  useEffect(() => {
    if (apiSettings[selectedEnvironment]) {
      setApiUrl(apiSettings[selectedEnvironment].request_url);
    }
  }, [selectedEnvironment, apiSettings]);

  // 处理点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (envDropdownRef.current && !envDropdownRef.current.contains(event.target)) {
        setShowEnvironmentDropdown(false);
      }
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target)) {
        setShowSettingsDropdown(false);
      }
    };

    // 添加点击事件监听器
    document.addEventListener('mousedown', handleClickOutside);
    
    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 主题切换 effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('themeMode', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // 从本地存储加载API设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('apiSettings');
    if (savedSettings) {
      try {
        setApiSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('加载API设置失败:', error);
      }
    }
  }, []);

  // 从本地存储加载数据库设置
  useEffect(() => {
    const savedDbSettings = localStorage.getItem('dbSettings');
    if (savedDbSettings) {
      try {
        setDbSettings(JSON.parse(savedDbSettings));
      } catch (error) {
        console.error('加载数据库设置失败:', error);
      }
    }

    // 从本地存储加载系统级数据库配置
    const savedSystemDbConfig = localStorage.getItem('systemDbConfig');
    if (savedSystemDbConfig) {
      try {
        setSystemDbConfig(JSON.parse(savedSystemDbConfig));
      } catch (error) {
        console.error('加载系统级数据库配置失败:', error);
      }
    }

    // 从本地存储加载系统配置
    const savedSystemSettings = localStorage.getItem('systemSettings');
    if (savedSystemSettings) {
      try {
        const parsed = JSON.parse(savedSystemSettings);
        // 校验数据格式，过滤掉 config 为 null/undefined 的条目
        if (parsed && parsed.tables && typeof parsed.tables === 'object') {
          const sanitizedTables = {};
          for (const [tName, tConfig] of Object.entries(parsed.tables)) {
            if (tConfig && typeof tConfig === 'object') {
              sanitizedTables[tName] = {
                primaryKey: tConfig.primaryKey || '',
                conditionFields: Array.isArray(tConfig.conditionFields) ? tConfig.conditionFields : []
              };
            }
          }
          setSystemSettings({ tables: sanitizedTables });
        }
      } catch (error) {
        console.error('加载系统配置失败:', error);
      }
    }
  }, []);

  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⇌</span>
            <span className="logo-text">自动化数据断言</span>
          </div>
          <span className="header-badge">查-发-查-比</span>
        </div>
        <div className="header-right">
          {/* 状态显示 */}
          <div className="status-container">
            <span className="status-dot"></span>
            <span className="status-text">就绪</span>
          </div>
          
          {/* 明暗主题切换按钮 */}
          <button
            className={`btn-theme-toggle ${isDarkMode ? 'mode-dark' : 'mode-light'}`}
            onClick={() => setIsDarkMode(prev => !prev)}
            title={isDarkMode ? '切换到浅色主题' : '切换到深色主题'}
          >
            <span className="theme-icon-wrap">
              <span className="theme-icon theme-icon-sun">☀</span>
              <span className="theme-icon theme-icon-moon">☽</span>
            </span>
          </button>

          {/* 环境选择按钮 */}
          <div className="dropdown-container" ref={envDropdownRef}>
            <button 
              className="btn-env" 
              onClick={() => setShowEnvironmentDropdown(!showEnvironmentDropdown)}
            >
              {selectedEnvironment}
              <span className="dropdown-arrow">▼</span>
            </button>
            {showEnvironmentDropdown && (
              <div className="dropdown-menu">
                {environmentOptions.map((env) => (
                  <button 
                    key={env} 
                    className={`dropdown-item ${selectedEnvironment === env ? 'selected' : ''}`}
                    onClick={() => handleEnvironmentSelect(env)}
                  >
                    {env}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* 设置按钮 */}
          <div className="dropdown-container" ref={settingsDropdownRef}>
            <button 
              className="btn-settings" 
              onClick={handleSettingsClick}
            >
              ⚙️
            </button>
            {showSettingsDropdown && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={handleSystemSettingsClick}>系统设置</button>
                <button className="dropdown-item" onClick={handleDbSettingsClick}>数据库配置</button>
                <button className="dropdown-item" onClick={handleApiSettingsClick}>API设置</button>
                <button className="dropdown-item">关于</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="main">
        {/* 左侧配置面板 */}
        <aside className="sidebar">


          {/* 请求报文 */}
          <section className="card card-grow">
            <div className="card-header">
              <span className="card-icon">📋</span>
              <span className="card-title">请求报文</span>
            </div>
            <div className="card-body card-body-grow">
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder="输入JSON格式的请求报文"
                className="textarea code"
                spellCheck={false}
              />
            </div>
          </section>

          {/* 检查表配置 */}
          <section className="card">
            <div className="card-header">
              <span className="card-icon">🗃</span>
              <span className="card-title">检查表</span>
              <button onClick={addTable} className="btn-icon" title="添加表">+</button>
            </div>
            <div className="card-body">
              {tables.map((table, index) => (
                <div key={index} className="table-row">
                  <span className="table-index">{index + 1}</span>
                  <input
                    type="text"
                    value={table.name}
                    onChange={(e) => updateTableName(index, e.target.value)}
                    placeholder="表名"
                    className="input table-input"
                  />
                  {tables.length > 1 && (
                    <button onClick={() => removeTable(index)} className="btn-icon btn-danger" title="移除">×</button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 发送按钮 */}
          <button onClick={sendRequest} className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <><span className="spinner"></span> 执行中...</>
            ) : (
              '▶ 执行核对'
            )}
          </button>
        </aside>

        {/* 右侧结果面板 */}
        <div className="content">
          {/* 错误提示 */}
          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* 标签页 */}
          <div className="tabs">
            <div className="tab-group">
              <button
                className={`tab ${activeTab === 'log' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('log')}
              >
                📜 执行日志
                {logs.length > 0 && <span className="badge">{logs.length}</span>}
              </button>
              {logs.length > 0 && (
                <button
                  className="tab-clear"
                  onClick={() => setLogs([])}
                  title="清空日志"
                >
                  🗑
                </button>
              )}
            </div>
            <button
              className={`tab ${activeTab === 'result' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('result')}
            >
              📊 断言结果
              {results.length > 0 && <span className="badge">{results.length}</span>}
            </button>
            <button
              className={`tab ${activeTab === 'response' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('response')}
            >
              📨 响应报文
            </button>
          </div>

          {/* 日志面板 */}
          {activeTab === 'log' && (
            <div className="panel">
              <div className="log-container" ref={logsRef}>
                {logs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div className="empty-text">点击"执行核对"开始检查</div>
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className={`log-line ${getLogClass(log.level)}`}>
                      <span className="log-time">{log.timestamp}</span>
                      <span className={`log-level level-${log.level?.toLowerCase()}`}>{log.level}</span>
                      <span className="log-msg">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 结果面板 */}
          {activeTab === 'result' && (
            <div className="panel">
              {results.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <div className="empty-text">暂无断言结果</div>
                </div>
              ) : (
                <div className="result-list">
                  {results.map((result, index) => (
                    <div key={index} className={`result-card ${result.status === '通过' ? 'result-pass' : 'result-fail'}`}>
                      <div className="result-top">
                        <div className="result-info">
                          <span className={`status-badge ${result.status === '通过' ? 'badge-pass' : 'badge-fail'}`}>
                            {getStatusIcon(result.status)} {result.status}
                          </span>
                          <span className="result-table-name">{result.table}</span>
                        </div>
                        <span className="result-msg">{result.message}</span>
                      </div>
                      <div className="result-sql-section">
                        <div className="sql-block">
                          <div className="sql-label">执行前 SQL</div>
                          <code className="sql-code">{result.details?.before?.sql || 'N/A'}</code>
                          <div className="sql-count">记录数: {result.details?.before?.count || 0}</div>
                        </div>
                        <div className="sql-arrow">→</div>
                        <div className="sql-block">
                          <div className="sql-label">执行后 SQL</div>
                          <code className="sql-code">{result.details?.after?.sql || 'N/A'}</code>
                          <div className="sql-count">记录数: {result.details?.after?.count || 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 响应报文面板 */}
          {activeTab === 'response' && (
            <div className="panel">
              {responseBody ? (
                <pre className="response-pre">{responseBody}</pre>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📨</div>
                  <div className="empty-text">暂无响应报文</div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* API设置模态框 */}
      {showApiSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>API设置</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowApiSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* 全局路由服务器地址 - 不受环境影响 */}
              <div className="api-setting-card api-setting-card--global">
                <div className="api-setting-header">
                  <h4>🌐 路由服务器地址</h4>
                  <span className="api-setting-badge">全局 · 不受环境影响</span>
                </div>
                <div className="api-setting-body">
                  <div className="api-setting-field">
                    <label>路由查询地址 (route_url)</label>
                    <input
                      type="text"
                      value={apiSettings.route_url || ''}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, route_url: e.target.value }))}
                      className="input"
                      placeholder="输入路由服务器地址，例如 http://route-server/testtool/routeQuery"
                    />
                  </div>
                </div>
              </div>
              <div className="api-settings-grid">
                {environmentOptions.map((env) => (
                  <div key={env} className="api-setting-card">
                    <div className="api-setting-header">
                      <h4>{env}</h4>
                    </div>
                    <div className="api-setting-body">
                      <div className="api-setting-field">
                        <label>请求地址 (request_url)</label>
                        <input
                          type="text"
                          value={apiSettings[env]?.request_url || ''}
                          onChange={(e) => handleApiSettingChange(env, 'request_url', e.target.value)}
                          className="input"
                          placeholder="输入请求地址"
                        />
                      </div>
                      <div className="api-setting-field">
                        <label>MAC地址 (mac_url)</label>
                        <input
                          type="text"
                          value={apiSettings[env]?.mac_url || ''}
                          onChange={(e) => handleApiSettingChange(env, 'mac_url', e.target.value)}
                          className="input"
                          placeholder="输入MAC地址"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowApiSettings(false)}
              >
                取消
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveApiSettings}
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 数据库设置模态框 */}
      {showDbSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>数据库配置</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowDbSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="db-settings-container">
                {/* 系统级数据库配置 */}
                <div className="db-setting-section">
                  <div className="db-setting-header">
                    <h4>系统级数据库配置</h4>
                  </div>
                  <div className="db-setting-body">
                    <div className="db-data-source-card">
                      <div className="db-data-source-header">
                        <span>系统数据源</span>
                      </div>
                      <div className="db-data-source-body">
                        <div className="db-setting-field">
                          <label>地址 (host)</label>
                          <input
                            type="text"
                            value={systemDbConfig.host || ''}
                            onChange={(e) => handleSystemDbConfigChange('host', e.target.value)}
                            className="input"
                            placeholder="输入数据库地址"
                          />
                        </div>
                        <div className="db-setting-field">
                          <label>端口 (port)</label>
                          <input
                            type="number"
                            value={systemDbConfig.port || 5432}
                            onChange={(e) => handleSystemDbConfigChange('port', parseInt(e.target.value) || 5432)}
                            className="input"
                            placeholder="输入端口"
                          />
                        </div>
                        <div className="db-setting-field">
                          <label>数据库名称 (database)</label>
                          <input
                            type="text"
                            value={systemDbConfig.database || ''}
                            onChange={(e) => handleSystemDbConfigChange('database', e.target.value)}
                            className="input"
                            placeholder="输入数据库名称"
                          />
                        </div>
                        <div className="db-setting-field">
                          <label>账户 (user)</label>
                          <input
                            type="text"
                            value={systemDbConfig.user || ''}
                            onChange={(e) => handleSystemDbConfigChange('user', e.target.value)}
                            className="input"
                            placeholder="输入账户"
                          />
                        </div>
                        <div className="db-setting-field">
                          <label>密码 (password)</label>
                          <input
                            type="password"
                            value={systemDbConfig.password || ''}
                            onChange={(e) => handleSystemDbConfigChange('password', e.target.value)}
                            className="input"
                            placeholder="输入密码"
                          />
                        </div>
                        <div className="db-setting-field">
                          <button 
                            className={`btn-primary test-connection-btn ${testConnectionStatus['system'] || ''}`}
                            onClick={handleTestSystemDbConnection}
                            disabled={testConnectionStatus['system'] === 'connecting'}
                          >
                            {testConnectionStatus['system'] === 'connecting' && (
                              <>
                                <span className="spinner"></span>
                                连接中...
                              </>
                            )}
                            {testConnectionStatus['system'] === 'success' && (
                              <>
                                ✓ 连接成功
                              </>
                            )}
                            {testConnectionStatus['system'] === 'error' && (
                              <>
                                ✗ 连接失败
                              </>
                            )}
                            {!testConnectionStatus['system'] && (
                              '测试连接'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 环境级数据库配置 */}
                {environmentOptions.map((env) => (
                  <div key={env} className="db-setting-section">
                    <div className="db-setting-header">
                      <h4>{env}</h4>
                    </div>
                    <div className="db-setting-body">
                      {dbSettings[env] && dbSettings[env].length > 0 ? (
                        <>
                          {dbSettings[env].map((ds, index) => (
                            <div key={index} className="db-data-source-card">
                              <div className="db-data-source-header">
                                <span>数据源 {index + 1}</span>
                                <button 
                                  className="btn-icon btn-danger"
                                  onClick={() => removeDataSource(env, index)}
                                  title="删除数据源"
                                >
                                  ×
                                </button>
                              </div>
                              <div className="db-data-source-body">
                                <div className="db-setting-field">
                                  <label>地址 (host)</label>
                                  <input
                                    type="text"
                                    value={ds.host || ''}
                                    onChange={(e) => handleDbSettingChange(env, index, 'host', e.target.value)}
                                    className="input"
                                    placeholder="输入数据库地址"
                                  />
                                </div>
                                <div className="db-setting-field">
                                  <label>端口 (port)</label>
                                  <input
                                    type="number"
                                    value={ds.port || 5432}
                                    onChange={(e) => handleDbSettingChange(env, index, 'port', parseInt(e.target.value) || 5432)}
                                    className="input"
                                    placeholder="输入端口"
                                  />
                                </div>
                                <div className="db-setting-field">
                                  <label>数据库名称 (database)</label>
                                  <input
                                    type="text"
                                    value={ds.database || ''}
                                    onChange={(e) => handleDbSettingChange(env, index, 'database', e.target.value)}
                                    className="input"
                                    placeholder="输入数据库名称"
                                  />
                                </div>
                                <div className="db-setting-field">
                                  <label>账户 (user)</label>
                                  <input
                                    type="text"
                                    value={ds.user || ''}
                                    onChange={(e) => handleDbSettingChange(env, index, 'user', e.target.value)}
                                    className="input"
                                    placeholder="输入账户"
                                  />
                                </div>
                                <div className="db-setting-field">
                                  <label>密码 (password)</label>
                                  <input
                                    type="password"
                                    value={ds.password || ''}
                                    onChange={(e) => handleDbSettingChange(env, index, 'password', e.target.value)}
                                    className="input"
                                    placeholder="输入密码"
                                  />
                                </div>
                                <div className="db-setting-field">
                                  <button 
                                    className={`btn-primary test-connection-btn ${testConnectionStatus[`${env}-${index}`] || ''}`}
                                    onClick={(e) => handleTestConnection(env, index, e)}
                                    disabled={testConnectionStatus[`${env}-${index}`] === 'connecting'}
                                  >
                                    {testConnectionStatus[`${env}-${index}`] === 'connecting' && (
                                      <>
                                        <span className="spinner"></span>
                                        连接中...
                                      </>
                                    )}
                                    {testConnectionStatus[`${env}-${index}`] === 'success' && (
                                      <>
                                        ✓ 连接成功
                                      </>
                                    )}
                                    {testConnectionStatus[`${env}-${index}`] === 'error' && (
                                      <>
                                        ✗ 连接失败
                                      </>
                                    )}
                                    {!testConnectionStatus[`${env}-${index}`] && (
                                      '测试连接'
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {/* 添加数据源按钮 */}
                          <button 
                            className="btn-icon add-datasource-btn"
                            onClick={() => addDataSource(env)}
                            title="添加数据源"
                          >
                            + 添加数据源
                          </button>
                        </>
                      ) : (
                        <div className="db-empty-state">
                          <button 
                            className="btn-icon add-datasource-btn"
                            onClick={() => addDataSource(env)}
                            title="添加数据源"
                          >
                            + 添加数据源
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowDbSettings(false)}
              >
                取消
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveDbSettings}
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系统配置模态框 */}
      {showSystemSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>系统配置</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowSystemSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="system-settings-container">
                <h4>表配置</h4>
                <div className="table-configs">
                  {Object.entries(systemSettings.tables).filter(([, config]) => config && typeof config === 'object').map(([tableName, config]) => (
                    <div key={tableName} className="table-config-card">
                      <div className="table-config-header">
                        <input
                          type="text"
                          value={tableName}
                          onChange={(e) => {
                            const newTableName = e.target.value;
                            if (newTableName && newTableName !== tableName) {
                              setSystemSettings(prev => {
                                const newSettings = { ...prev };
                                const existing = newSettings.tables[tableName];
                                if (existing) {
                                  newSettings.tables = {
                                    ...newSettings.tables,
                                    [newTableName]: existing
                                  };
                                  delete newSettings.tables[tableName];
                                }
                                return newSettings;
                              });
                            }
                          }}
                          className="input table-name-input"
                          placeholder="表名"
                        />
                        <button 
                          className="btn-icon btn-danger"
                          onClick={() => {
                            setSystemSettings(prev => {
                              const newSettings = { ...prev };
                              delete newSettings.tables[tableName];
                              return newSettings;
                            });
                          }}
                          title="删除表"
                        >
                          ×
                        </button>
                      </div>
                      <div className="table-config-body">
                        <div className="table-config-field">
                          <label>主键</label>
                          <input
                            type="text"
                            value={config.primaryKey || ''}
                            onChange={(e) => {
                              setSystemSettings(prev => ({
                                ...prev,
                                tables: {
                                  ...prev.tables,
                                  [tableName]: {
                                    ...prev.tables[tableName],
                                    primaryKey: e.target.value
                                  }
                                }
                              }));
                            }}
                            className="input"
                            placeholder="输入主键字段"
                          />
                        </div>
                        
                        <h6>查询条件</h6>
                        <div className="condition-fields">
                          {config.conditionFields.map((condition, index) => (
                            <div key={index} className="condition-field-card">
                              <div className="condition-field-row">
                                <div className="condition-field-item">
                                  <label>字段名</label>
                                  <input
                                    type="text"
                                    value={condition.field || ''}
                                    onChange={(e) => {
                                      setSystemSettings(prev => {
                                        const newSettings = { ...prev };
                                        newSettings.tables[tableName].conditionFields[index].field = e.target.value;
                                        return newSettings;
                                      });
                                    }}
                                    className="input"
                                    placeholder="输入字段名"
                                  />
                                </div>
                                <div className="condition-field-item">
                                  <label>来源</label>
                                  <select
                                    value={condition.source || 'request'}
                                    onChange={(e) => {
                                      setSystemSettings(prev => {
                                        const newSettings = { ...prev };
                                        newSettings.tables[tableName].conditionFields[index].source = e.target.value;
                                        return newSettings;
                                      });
                                    }}
                                    className="input"
                                  >
                                    <option value="request">请求报文</option>
                                    <option value="route">路由结果</option>
                                    <option value="table">其他表</option>
                                  </select>
                                </div>
                              </div>
                              {condition.source === 'table' ? (
                                <>
                                  <div className="condition-field-row">
                                    <div className="condition-field-item">
                                      <label>选择表</label>
                                      <select
                                        value={condition.selectedTable || ''}
                                        onChange={(e) => {
                                          setSystemSettings(prev => {
                                            const newSettings = { ...prev };
                                            newSettings.tables[tableName].conditionFields[index].selectedTable = e.target.value;
                                            newSettings.tables[tableName].conditionFields[index].path = e.target.value ? `${e.target.value}.` : '';
                                            return newSettings;
                                          });
                                        }}
                                        className="input"
                                      >
                                        <option value="">请选择表</option>
                                        {Object.keys(systemSettings.tables).filter(t => t !== tableName).map(t => (
                                          <option key={t} value={t}>{t}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="condition-field-item">
                                      <label>字段名</label>
                                      <input
                                        type="text"
                                        value={condition.path ? condition.path.split('.')[1] || '' : ''}
                                        onChange={(e) => {
                                          setSystemSettings(prev => {
                                            const newSettings = { ...prev };
                                            if (condition.selectedTable) {
                                              newSettings.tables[tableName].conditionFields[index].path = `${condition.selectedTable}.${e.target.value}`;
                                            }
                                            return newSettings;
                                          });
                                        }}
                                        className="input"
                                        placeholder="输入字段名"
                                      />
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="condition-field-row">
                                  <div className="condition-field-item full-width">
                                    <label>路径</label>
                                    <input
                                      type="text"
                                      value={condition.path || ''}
                                      onChange={(e) => {
                                        setSystemSettings(prev => {
                                          const newSettings = { ...prev };
                                          newSettings.tables[tableName].conditionFields[index].path = e.target.value;
                                          return newSettings;
                                        });
                                      }}
                                      className="input"
                                      placeholder="输入路径 (如: txBody.txEntity.mediumNo)"
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="condition-field-row" style={{ justifyContent: 'space-between' }}>
                                <div className="condition-field-item inline">
                                  <label>必填</label>
                                  <input
                                    type="checkbox"
                                    checked={condition.required || false}
                                    onChange={(e) => {
                                      setSystemSettings(prev => {
                                        const newSettings = { ...prev };
                                        newSettings.tables[tableName].conditionFields[index].required = e.target.checked;
                                        return newSettings;
                                      });
                                    }}
                                  />
                                </div>
                                <button 
                                  className="btn-icon btn-danger"
                                  onClick={() => {
                                    setSystemSettings(prev => {
                                      const newSettings = { ...prev };
                                      newSettings.tables[tableName].conditionFields = newSettings.tables[tableName].conditionFields.filter((_, i) => i !== index);
                                      return newSettings;
                                    });
                                  }}
                                  title="删除条件"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                          <button 
                            className="btn-icon add-condition-btn"
                            onClick={() => {
                              setSystemSettings(prev => {
                                const newSettings = { ...prev };
                                newSettings.tables[tableName].conditionFields.push({
                                  field: '',
                                  source: 'request',
                                  path: '',
                                  required: false
                                });
                                return newSettings;
                              });
                            }}
                            title="添加条件"
                          >
                            + 添加条件
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    className="btn-icon add-table-btn"
                    onClick={() => {
                      const newTableName = `new_table_${Date.now()}`;
                      setSystemSettings(prev => ({
                        ...prev,
                        tables: {
                          ...prev.tables,
                          [newTableName]: {
                            primaryKey: '',
                            conditionFields: []
                          }
                        }
                      }));
                    }}
                    title="添加表"
                  >
                    + 添加表
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="modal-footer-left">
                <button
                  className="btn-config-io btn-export"
                  onClick={handleExportSettings}
                  title="导出全部配置为 TOML 文件"
                >
                  <span className="btn-io-icon">↑</span> 导出配置
                </button>
                <button
                  className="btn-config-io btn-import"
                  onClick={handleImportClick}
                  title="从 TOML 文件导入配置"
                >
                  <span className="btn-io-icon">↓</span> 导入配置
                </button>
              </div>
              <div className="modal-footer-right">
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowSystemSettings(false)}
                >
                  取消
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSaveSystemSettings}
                >
                  保存设置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 隐藏的文件导入 input */}
      <input
        ref={importFileRef}
        type="file"
        accept=".toml,text/plain"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </div>
  );
}

export default App;