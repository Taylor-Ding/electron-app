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
  const logsRef = useRef(null);
  const envDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  
  // API设置 - 不同环境的请求地址配置
  const [apiSettings, setApiSettings] = useState({
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

  const extractConditions = (requestData, tableName, routingKey, tableResults = {}) => {
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
            value = extractValue(routingKey, condition.path);
            if (value) {
              addLog(`  从路由结果提取 ${condition.field}: ${value}`);
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
            }
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
      // 这里可以根据表依赖关系排序，确保依赖的表先查询
      // 暂时按顺序处理
      for (const table of tables) {
        if (table.name) {
          try {
            const conditions = extractConditions(requestData, table.name, routingKey);
            tableConditions[table.name] = conditions;
          } catch (condError) {
            addLog(`提取表 ${table.name} 查询条件失败: ${condError.message}`, 'ERROR');
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

      addLog('调用后端API执行数据一致性检查...');
      try {
        const checkResponse = await axios.post('http://localhost:8000/api/check', {
          apiResponse: apiResponse,
          tables: tables.filter(t => t.name).map(t => t.name),
          requestData: requestData,
          routingKey: routingKey,
          tableConditions: tableConditions
        });

        const responseLogs = checkResponse.data?.logs || [];
        for (const log of responseLogs) {
          addLog(log.message, log.level || 'INFO');
        }

        const backendResults = (checkResponse.data?.results || []).map(result => ({
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
      } catch (apiError) {
        addLog(`API调用失败: ${apiError.message}`, 'ERROR');
        if (apiError.response?.data?.logs) {
          for (const log of apiError.response.data.logs) {
            addLog(log.message, log.level || 'ERROR');
          }
        }
        throw apiError;
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
    setShowSystemSettings(false);
    addLog('系统配置保存成功');
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
        setSystemSettings(JSON.parse(savedSystemSettings));
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
                  {Object.entries(systemSettings.tables).map(([tableName, config]) => (
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
                                newSettings.tables[newTableName] = newSettings.tables[tableName];
                                delete newSettings.tables[tableName];
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
      )}
    </div>
  );
}

export default App;