import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import axios from 'axios';
import './App.css';
import LoginScreen from './components/LoginScreen.jsx';

function App() {
  const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null;
  const [authUser, setAuthUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const saved =
      window.sessionStorage.getItem('authSession') || window.sessionStorage.getItem('mockAuthUser');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authApiBaseUrl, setAuthApiBaseUrl] = useState(() => {
    if (typeof window === 'undefined') return 'http://localhost:8080/online-service';
    return localStorage.getItem('authApiBaseUrl') || 'http://localhost:8080/online-service';
  });
  const [captchaSrc, setCaptchaSrc] = useState('');
  const [captchaUuid, setCaptchaUuid] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [loginCaptchaCode, setLoginCaptchaCode] = useState('');
  const [apiUrl, setApiUrl] = useState('http://localhost:8080/online-service');
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
  const [tables, setTables] = useState([]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('log');
  const [selectedEnvironment, setSelectedEnvironment] = useState('DEV1');
  const [showDataModal, setShowDataModal] = useState(false);
  const [dataModalContent, setDataModalContent] = useState({ title: '', beforeSql: '', afterSql: '', beforeData: [], afterData: [] });
  const [showEnvironmentDropdown, setShowEnvironmentDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showDbSettings, setShowDbSettings] = useState(false);
  const [showSystemSettings, setShowSystemSettings] = useState(false);
  const [showDefaultTableSettings, setShowDefaultTableSettings] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [defaultTableSearchQuery, setDefaultTableSearchQuery] = useState('');
  const [defaultTableSettings, setDefaultTableSettings] = useState({ tables: {} });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    return saved !== null ? saved === 'dark' : true;
  });
  const [showJmxPicker, setShowJmxPicker] = useState(false);
  const [jmxRequests, setJmxRequests] = useState([]);
  const logsRef = useRef(null);
  const envDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const importFileRef = useRef(null);
  const jmxFileRef = useRef(null);
  // 用于在异步函数中访问最新 state
  const systemDbConfigRef = useRef(null);
  const apiSettingsRef = useRef(null);
  
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

  // API 状态指示器: 'idle' | 'loading' | 'success' | 'error'
  const [apiStatus, setApiStatus] = useState('idle');
  const [apiStatusMsg, setApiStatusMsg] = useState('就绪');

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

  const logIdRef = useRef(0);
  const addLog = (message, level = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const id = ++logIdRef.current;
    setLogs(prev => [...prev, { id, timestamp, message, level }]);
    setTimeout(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    }, 50);
  };

  const normalizeAuthPayload = (data) => {
    if (!data || typeof data !== 'object') return {};
    const nested = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : {};
    return { ...data, ...nested };
  };

  const fetchCaptcha = useCallback(async () => {
    const base = authApiBaseUrl.trim().replace(/\/$/, '');
    if (!base) {
      setCaptchaSrc('');
      setCaptchaUuid('');
      return;
    }
    setCaptchaLoading(true);
    setLoginError('');
    setLoginCaptchaCode('');
    try {
      const { data } = await axios.get(`${base}/captchaImage`, { timeout: 20000 });
      const p = normalizeAuthPayload(data);
      const enabled = p.captchaEnabled !== false;
      setCaptchaEnabled(enabled);
      if (!enabled) {
        setCaptchaUuid('');
        setCaptchaSrc('');
        return;
      }
      const uuid = p.uuid;
      const img = p.img;
      if (!uuid || img == null || String(img) === '') {
        throw new Error('验证码接口返回缺少 uuid 或 img');
      }
      const raw = String(img);
      const src = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
      setCaptchaUuid(uuid);
      setCaptchaSrc(src);
    } catch (e) {
      setCaptchaEnabled(true);
      setCaptchaSrc('');
      setCaptchaUuid('');
      const msg = e.response?.data?.msg || e.message || '获取验证码失败';
      setLoginError(String(msg));
    } finally {
      setCaptchaLoading(false);
    }
  }, [authApiBaseUrl]);

  useEffect(() => {
    localStorage.setItem('authApiBaseUrl', authApiBaseUrl);
  }, [authApiBaseUrl]);

  useEffect(() => {
    if (authUser) return;
    const t = window.setTimeout(() => {
      fetchCaptcha();
    }, 0);
    return () => window.clearTimeout(t);
  }, [authUser, authApiBaseUrl, fetchCaptcha]);

  const handleLogin = async ({ username, password, code, uuid }) => {
    setLoginError('');
    if (!username || !password) {
      setLoginError('请输入用户名和密码');
      return;
    }
    if (captchaEnabled && !code?.trim()) {
      setLoginError('请输入验证码');
      return;
    }
    if (captchaEnabled && !uuid) {
      setLoginError('验证码未就绪，请稍后或点击图片刷新');
      await fetchCaptcha();
      return;
    }

    const base = authApiBaseUrl.trim().replace(/\/$/, '');
    if (!base) {
      setLoginError('请填写认证服务根地址');
      return;
    }

    setIsAuthenticating(true);
    try {
      const { data } = await axios.post(
        `${base}/login`,
        {
          username,
          password,
          code: captchaEnabled ? code : '',
          uuid: captchaEnabled ? uuid : ''
        },
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'DESKTOP' }
        }
      );

      const p = normalizeAuthPayload(data);
      if (p.code !== 200) {
        setLoginError(p.msg || '登录失败');
        await fetchCaptcha();
        return;
      }

      const token = p.token ?? p.access_token;
      const refreshToken = p.refresh_token ?? p.refreshToken;
      if (!token) {
        setLoginError('登录成功但未返回访问令牌');
        await fetchCaptcha();
        return;
      }

      const user = {
        username,
        displayName: username,
        token,
        refreshToken: refreshToken || ''
      };
      setAuthUser(user);
      window.sessionStorage.setItem('authSession', JSON.stringify(user));
      window.sessionStorage.removeItem('mockAuthUser');
      // 登录成功后立即从系统数据库拉取 API 地址配置
      fetchApiSettingsFromDb();
    } catch (e) {
      const body = e.response?.data;
      const p = normalizeAuthPayload(body);
      const msg = p.msg || body?.message || e.message || '登录失败';
      setLoginError(String(msg));
      await fetchCaptcha();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    setLoginError('');
    setApiStatus('idle');
    setApiStatusMsg('就绪');
    window.sessionStorage.removeItem('mockAuthUser');
    window.sessionStorage.removeItem('authSession');
    setShowEnvironmentDropdown(false);
    setShowSettingsDropdown(false);
    setShowApiSettings(false);
    setShowDbSettings(false);
    setShowSystemSettings(false);
    setShowDefaultTableSettings(false);
  };

  /** 登录后从系统数据库自动拉取 API 地址配置 */
  const fetchApiSettingsFromDb = async () => {
    const latestDbConfig = systemDbConfigRef.current;
    if (!latestDbConfig?.host) {
      setApiStatus('error');
      setApiStatusMsg('未配置系统数据源，请先在「数据库配置」中添加系统数据源');
      return;
    }
    setApiStatus('loading');
    setApiStatusMsg('正在加载 API 地址...');
    try {
      const sql = 'SELECT tenant_id, gate_address, mac_address FROM tb_ts_request_gate';
      let rows;
      if (electronAPI?.querySystemDb) {
        const result = await electronAPI.querySystemDb({
          dbConfig: latestDbConfig,
          sql,
          values: []
        });
        rows = result.rows;
      } else {
        setApiStatus('error');
        setApiStatusMsg('非 Electron 环境，无法查询数据库');
        return;
      }

      if (!rows || rows.length === 0) {
        setApiStatus('error');
        setApiStatusMsg('获取 API 地址失败：表中无数据，请检查数据库配置');
        return;
      }

      const patch = {};
      for (const row of rows) {
        const env = String(row.tenant_id || '').trim();
        if (!env) continue;
        patch[env] = {
          request_url: row.gate_address || '',
          mac_url: row.mac_address || ''
        };
      }
      const merged = { ...(apiSettingsRef.current || {}), ...patch };
      setApiSettings(merged);
      localStorage.setItem('apiSettings', JSON.stringify(merged));

      setApiStatus('success');
      setApiStatusMsg('就绪');
    } catch (err) {
      console.error('[fetchApiSettingsFromDb] error:', err);
      setApiStatus('error');
      setApiStatusMsg(`获取 API 地址失败：${err.message}`);
    }
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
    let config = systemSettings.tables[tableName];
    if (!config) {
      config = defaultTableSettings.tables[tableName];
      if (config) {
        addLog(`提示: 表 ${tableName} 未自定义规则，使用默认配置规则`);
      } else {
        addLog(`警告: 表 ${tableName} 没有配置查询条件，也没有默认配置`, 'WARN');
        return {};
      }
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
          if (condition.field === 'cust_no' || condition.field === 'zone_val') {
            let mediumNoToQuery = null;
            if (condition.path) {
              mediumNoToQuery = extractValue(requestData, condition.path);
              if (mediumNoToQuery) {
                addLog(`  从报文路径 ${condition.path} 提取到介质号: ${mediumNoToQuery}`);
              } else {
                addLog(`  警告: 无法从报文路径 ${condition.path} 提取到介质号`, 'WARN');
              }
            }
            
            if (!mediumNoToQuery && routingKey && routingKey.type === 'medium_no') {
              mediumNoToQuery = routingKey.value;
              addLog(`  使用默认路由键提取介质号: ${mediumNoToQuery}`);
            }

            if (mediumNoToQuery) {
              addLog(`  调用路由服务器routeQuery接口获取cust_no`);
              try {
                const routeUrl = apiSettings.route_url;
                if (!routeUrl) {
                  throw new Error('路由服务器地址(route_url)未配置，请在API设置中填写');
                }
                addLog(`  调用路由查询接口: ${routeUrl}`);
                addLog(`  查询参数: mediumNo = ${mediumNoToQuery}`);
                
                const routeResponse = await axios.get(routeUrl, { params: { mediumNo: mediumNoToQuery }, headers: { env: selectedEnvironment, 'X-Client-Type': 'DESKTOP' } });
                
                let respData = routeResponse.data;
                value = null;

                if (respData && respData.code === 200 && respData.data) {
                  try {
                    const parsedData = typeof respData.data === 'string' ? JSON.parse(respData.data) : respData.data;
                    if (condition.field === 'cust_no') {
                      value = parsedData.custNo !== undefined ? parsedData.custNo : parsedData.cust_no;
                    } else if (condition.field === 'zone_val') {
                      value = parsedData.zoneVal !== undefined ? parsedData.zoneVal : (parsedData.zone_val !== undefined ? parsedData.zone_val : (parsedData.custNo !== undefined ? parsedData.custNo : parsedData.cust_no));
                    }
                  } catch (e) {
                    addLog(`  警告: 尝试解析 data 字段为 JSON 失败: ${e.message}`, 'WARN');
                  }
                }

                if (value === undefined || value === null) {
                  if (condition.field === 'cust_no') {
                    value = respData?.custNo !== undefined ? respData?.custNo : respData?.cust_no;
                  } else if (condition.field === 'zone_val') {
                    value = respData?.zoneVal !== undefined ? respData?.zoneVal : (respData?.zone_val !== undefined ? respData?.zone_val : (respData?.custNo !== undefined ? respData?.custNo : respData?.cust_no));
                  }
                }

                if (value !== undefined && value !== null) {
                  value = String(value);
                }

                if (!value || typeof value !== 'string') {
                  throw new Error(`路由查询返回数据异常或无法提取 ${condition.field}: ${JSON.stringify(routeResponse.data)}`);
                }
                addLog(`  从路由查询获取 ${condition.field}: ${value}`);
              } catch (error) {
                addLog(`  错误: 路由查询失败: ${error.message}`, 'ERROR');
              }
            } else {
              addLog(`  错误: 无法获取介质号，跳过路由查询`, 'ERROR');
            }
          } else {
            if (routingKey) {
              value = extractValue(routingKey, condition.path);
              if (value) {
                addLog(`  从路由结果提取 ${condition.field}: ${value}`);
              }
            }
          }
          break;
        case 'table': {
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
    if (electronAPI) {
      try {
        await electronAPI.saveTableSettings({ ...defaultTableSettings.tables, ...systemSettings.tables });
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

      // ---- 辅助：为报文生成并写入动态字段（时间戳、跟踪号、tenantId）----
      const applyDynamicFields = (data) => {
        const d = new Date();
        const ymd =
          d.getFullYear() +
          (d.getMonth() + 1).toString().padStart(2, '0') +
          d.getDate().toString().padStart(2, '0');
        const hms =
          d.getHours().toString().padStart(2, '0') +
          d.getMinutes().toString().padStart(2, '0') +
          d.getSeconds().toString().padStart(2, '0') +
          d.getMilliseconds().toString().padStart(3, '0');
        const ts = ymd + hms;
        const rnd = Math.floor(Math.random() * 10).toString();
        const subtx = '10221990001111000000000' + rnd + ymd;
        const trackNo =
          ts + '1022199CK001' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        if (data.txHeader) {
          data.txHeader.globalBusiTrackNo = trackNo;
          data.txHeader.subtxNo = subtx;
          data.txHeader.txStartTime = ts;
          data.txHeader.txSendTime = ts;
          if (selectedEnvironment === 'TEST') {
            data.txHeader.tenantId = 'QHGD';
          } else if (selectedEnvironment === 'PREPROD') {
            data.txHeader.tenantId = 'PROD';
          } else {
            data.txHeader.tenantId = selectedEnvironment;
          }
        }
        return { trackNo, subtx, ts };
      };

      // ---- 辅助：请求 MAC 并写回 txHeader.msgrptMac ----
      const applyMac = async (data, label) => {
        const macUrl = apiSettings[selectedEnvironment]?.mac_url;
        if (!macUrl) {
          addLog(`[${label}] mac_url未配置或为空，跳过MAC获取步骤`, 'INFO');
          return;
        }
        addLog(`[${label}] 调用mac_url获取msgrptMac值: ${macUrl}`);
        const macResponse = await axios.post(macUrl, data);
        const msgrptMac = macResponse.data;
        if (!msgrptMac || typeof msgrptMac !== 'string') {
          throw new Error(`[${label}] mac_url返回的值不是有效字符串`);
        }
        if (data.txHeader) {
          data.txHeader.msgrptMac = msgrptMac;
          addLog(`[${label}] msgrptMac替换成功: ${msgrptMac}`);
        }
      };

      // ================================================================
      // 【决策】根据用户是否配置检查表，选择预发送或直接流程
      // ================================================================
      const userConfiguredTables = tables.filter(t => t.name).map(t => t.name);
      let effectiveTables = [];

      if (userConfiguredTables.length > 0) {
        // 用户已配置检查表，直接使用，跳过预发送流程
        effectiveTables = userConfiguredTables;
        addLog(`用户已配置 ${effectiveTables.length} 个检查表，跳过预发送流程`);
        addLog(`检查表: ${effectiveTables.join(', ')}`);
      } else {
        // 用户未配置检查表，执行预发送获取目标表名
        addLog('未配置检查表，执行预发送流程获取目标表名...');

        // ================================================================
        // 【第一次发送】预发送报文（携带 txEmb，用于触发前置异常场景）
        // ================================================================
        addLog('--- 【预发送】构造携带 txEmb 的报文 ---');
        const preRequestData = JSON.parse(JSON.stringify(requestData));
        applyDynamicFields(preRequestData);
        preRequestData.txEmb = { afterException: 'YRC000035' };
        addLog(`[预发送] 动态字段已生成，globalBusiTrackNo=${preRequestData.txHeader?.globalBusiTrackNo}`);

        try {
          await applyMac(preRequestData, '预发送');
        } catch (macErr) {
          addLog(`[预发送] MAC获取失败: ${macErr.message}`, 'ERROR');
          throw new Error(`[预发送] MAC请求失败: ${macErr.message}`);
        }

        addLog(`[预发送] 发送报文到: ${apiUrl}`);
        let preApiResponse = null;
        try {
          const preResp = await axios.post(apiUrl, preRequestData);
          preApiResponse = preResp.data;
          addLog(`[预发送] 响应成功: ${JSON.stringify(preApiResponse)}`);
        } catch (preErr) {
          if (preErr.response) {
            preApiResponse = preErr.response.data;
            addLog(`[预发送] 响应数据（非2xx）: ${JSON.stringify(preApiResponse)}`, 'WARN');
          } else {
            addLog(`[预发送] 请求异常: ${preErr.message}`, 'WARN');
          }
        }
        addLog('--- 【预发送】完成 ---');

        // 【预发送结果校验】检查 servRespCd 是否符合预期
        const EXPECTED_SERV_RESP_CD = 'Y1022199RC000035';
        const actualServRespCd = preApiResponse?.txHeader?.servRespCd;

        if (actualServRespCd !== EXPECTED_SERV_RESP_CD) {
          addLog(`[预发送校验] servRespCd 不符合预期`, 'ERROR');
          addLog(`  预期值: ${EXPECTED_SERV_RESP_CD}`, 'ERROR');
          addLog(`  实际值: ${actualServRespCd ?? '(未返回)'}`, 'ERROR');
          addLog('预发送结果不符合预期，终止后续 SQL 查询与比对', 'ERROR');
          return;
        }
        addLog(`[预发送校验] servRespCd 符合预期: ${actualServRespCd} ✓`);

        // 调用 tranSqlQry 接口，根据预发送流水号查询对应 SQL
        const preGlo = preRequestData.txHeader?.globalBusiTrackNo;
        const routeOrigin = (() => { try { return new URL(apiSettings.route_url).origin; } catch { return ''; } })();
        const tranSqlQryUrl = `${routeOrigin}/testtool/tranSqlQry`;
        addLog(`[tranSqlQry] 查询接口: ${tranSqlQryUrl}`);
        addLog(`[tranSqlQry] 流水号 glo: ${preGlo}`);
        try {
          const tranResp = await axios.post(tranSqlQryUrl, { glo: preGlo }, { headers: { 'Content-Type': 'application/json;charset=UTF-8', 'X-Client-Type': 'DESKTOP' } });
          const tranData = tranResp.data;
          if (tranData?.code === 200 && tranData?.data) {
            let parsedSqlData;
            try {
              parsedSqlData = typeof tranData.data === 'string' ? JSON.parse(tranData.data) : tranData.data;
            } catch {
              addLog('[tranSqlQry] 解析响应 data 字段失败', 'WARN');
              parsedSqlData = {};
            }
            const sqlArray = parsedSqlData.sqlList || [];
            const splitIdx = sqlArray.findIndex(sql => sql.includes('COMPENSATION_SPLIT_LINE'));
            const normalSqls = splitIdx !== -1 ? sqlArray.slice(0, splitIdx) : sqlArray;

            const extractTableName = (sql) => {
              const s = sql.trim();
              const insertMatch = s.match(/^\s*INSERT\s+(?:INTO\s+)?([`"[\w.]+[\w`"\]]+)/i);
              if (insertMatch) return insertMatch[1].replace(/[`"[\]]/g, '').split('.').pop();
              const updateMatch = s.match(/^\s*UPDATE\s+([`"[\w.]+[\w`"\]]+)/i);
              if (updateMatch) return updateMatch[1].replace(/[`"[\]]/g, '').split('.').pop();
              const deleteMatch = s.match(/^\s*DELETE\s+FROM\s+([`"[\w.]+[\w`"\]]+)/i);
              if (deleteMatch) return deleteMatch[1].replace(/[`"[\]]/g, '').split('.').pop();
              const mergeMatch = s.match(/^\s*MERGE\s+INTO\s+([`"[\w.]+[\w`"\]]+)/i);
              if (mergeMatch) return mergeMatch[1].replace(/[`"[\]]/g, '').split('.').pop();
              return null;
            };
            // 去除分表号后缀，去重
            const stripShardSuffix = (name) => name.replace(/_\d+$/, '');
            const nonSelectSqls = normalSqls.filter(sql => !/^\s*SELECT\s/i.test(sql.trim()));
            const rawNames = nonSelectSqls.map(extractTableName).filter(Boolean);
            const strippedNames = [...new Set(rawNames.map(stripShardSuffix))];

            if (splitIdx !== -1) {
              addLog(`[tranSqlQry] 查询成功，正常SQL ${normalSqls.length} 条，补偿SQL ${sqlArray.length - splitIdx - 1} 条（已忽略）`);
            } else {
              addLog(`[tranSqlQry] 查询成功，共 ${normalSqls.length} 条正常SQL`);
            }

            if (strippedNames.length > 0) {
              addLog(`[tranSqlQry] 匹配到表名（共 ${strippedNames.length} 个）: ${strippedNames.join(', ')}`);
              effectiveTables = strippedNames;
            } else {
              addLog('[tranSqlQry] 正常SQL中未找到非SELECT语句', 'WARN');
            }
          } else {
            addLog(`[tranSqlQry] 查询失败: ${tranData?.msg || '未知错误'}`, 'WARN');
          }
        } catch (tranErr) {
          addLog(`[tranSqlQry] 接口调用失败: ${tranErr.message}`, 'ERROR');
        }

        if (effectiveTables.length === 0) {
          addLog('[tranSqlQry] 未能提取到任何有效检查表，将跳过 SQL 前后比对，仅执行正式报文发送', 'WARN');
        }
      }

      // ================================================================
      // 【正式发送前】为正式报文重新生成动态字段 + MAC（不含 txEmb）
      // ================================================================
      addLog('处理正式请求报文中的字段...');
      applyDynamicFields(requestData);
      addLog(`正式报文动态字段已生成，globalBusiTrackNo=${requestData.txHeader?.globalBusiTrackNo}`);
      addLog(`tenantId已设置为: ${requestData.txHeader?.tenantId}`);

      try {
        await applyMac(requestData, '正式发送');
      } catch (macErr) {
        addLog(`错误: mac_url请求失败: ${macErr.message}`, 'ERROR');
        throw new Error(`mac_url请求失败: ${macErr.message}`);
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
      const skippedTables = [];

      // 只提取来源为 request / route 的初始条件（非表依赖条件），
      // 表依赖条件（source=table）由后端在顺序查询时动态填充。
      for (const tableName of effectiveTables) {
        try {
          let config = systemSettings.tables[tableName];
          if (!config) config = defaultTableSettings.tables[tableName];
          if (!config) {
            addLog(`警告: 表 ${tableName} 没有配置查询条件，跳过该表的比对检查`, 'WARN');
            skippedTables.push(tableName);
            continue;
          }
          {
            const table = { name: tableName };
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
                if (cond.field === 'cust_no' || cond.field === 'zone_val') {
                  let mediumNoToQuery = null;
                  if (cond.path) {
                    mediumNoToQuery = extractValue(requestData, cond.path);
                    if (mediumNoToQuery) {
                      addLog(`  从报文路径 ${cond.path} 提取到介质号: ${mediumNoToQuery}`);
                    } else {
                      addLog(`  警告: 无法从报文路径 ${cond.path} 提取到介质号`, 'WARN');
                    }
                  }
                  
                  if (!mediumNoToQuery && routingKey && routingKey.type === 'medium_no') {
                    mediumNoToQuery = routingKey.value;
                    addLog(`  使用默认路由键提取介质号: ${mediumNoToQuery}`);
                  }

                  if (mediumNoToQuery) {
                    addLog(`  调用路由服务器routeQuery接口获取cust_no`);
                    try {
                      const routeUrl = apiSettings.route_url;
                      if (!routeUrl) throw new Error('路由服务器地址(route_url)未配置，请在API设置中填写');
                      addLog(`  调用路由查询接口: ${routeUrl}`);
                      const routeResponse = await axios.get(routeUrl, { params: { mediumNo: mediumNoToQuery }, headers: { env: selectedEnvironment, 'X-Client-Type': 'DESKTOP' } });
                      let respData = routeResponse.data;
                      if (respData && respData.code === 200 && respData.data) {
                        try {
                          const parsedData = typeof respData.data === 'string' ? JSON.parse(respData.data) : respData.data;
                          if (cond.field === 'cust_no') {
                            value = parsedData.custNo !== undefined ? parsedData.custNo : parsedData.cust_no;
                          } else if (cond.field === 'zone_val') {
                            value = parsedData.zoneVal !== undefined ? parsedData.zoneVal : (parsedData.zone_val !== undefined ? parsedData.zone_val : (parsedData.custNo !== undefined ? parsedData.custNo : parsedData.cust_no));
                          }
                        } catch (e) {
                          addLog(`  警告: 尝试解析data字段为JSON失败: ${e.message}`, 'WARN');
                        }
                      }
                      
                      if (value === undefined || value === null) {
                        if (cond.field === 'cust_no') {
                          value = respData?.custNo !== undefined ? respData?.custNo : respData?.cust_no;
                        } else if (cond.field === 'zone_val') {
                          value = respData?.zoneVal !== undefined ? respData?.zoneVal : (respData?.zone_val !== undefined ? respData?.zone_val : (respData?.custNo !== undefined ? respData?.custNo : respData?.cust_no));
                        }
                      }

                      if (value !== undefined && value !== null) {
                        value = String(value);
                      }

                      if (!value || typeof value !== 'string') throw new Error(`路由查询返回数据异常或无法提取 ${cond.field}: ${JSON.stringify(routeResponse.data)}`);
                      addLog(`  从路由查询获取 ${cond.field}: ${value}`);
                    } catch (error) {
                      addLog(`  错误: 路由查询失败: ${error.message}`, 'ERROR');
                    }
                  } else {
                    addLog(`  错误: 无法获取介质号，跳过路由查询`, 'ERROR');
                  }
                } else {
                  if (routingKey) {
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
            tableConditions[tableName] = conditions;
            addLog(`  表 ${tableName} 初始条件: ${JSON.stringify(conditions)}`);
          }
        } catch (condError) {
          addLog(`提取表 ${tableName} 查询条件失败: ${condError.message}`, 'ERROR');
          tableConditions[tableName] = {};
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

      // addLog('通过本地 Node.js 进程执行数据一致性检查...');
      const tablesToCheck = effectiveTables.filter(t => !skippedTables.includes(t));
      if (tablesToCheck.length === 0) {
        addLog('无需执行 SQL 比对：所有检查表均已跳过或未获取到有效表名', 'WARN');
        const skippedResults = skippedTables.map(tableName => ({
          table: tableName,
          status: '跳过',
          message: '未配置查询条件，已跳过比对检查',
          details: { before: { count: 0, sql: '', data: [] }, after: { count: 0, sql: '', data: [] } }
        }));
        if (skippedResults.length > 0) {
          setResults(skippedResults);
          setTimeout(() => setActiveTab('result'), 800);
        }
      } else {
      try {
        const requestPayload = {
          apiResponse: apiResponse,
          tables: tablesToCheck,
          requestData: requestData,
          routingKey: routingKey,
          tableConditions: tableConditions,
          // 传入表配置，让后端能处理跨表依赖条件（source=table）
          tableSettings: { ...defaultTableSettings.tables, ...systemSettings.tables },
          environment: selectedEnvironment,
          dbSettings: dbSettings
        };

        let checkData;

        if (electronAPI) {
          // addLog('检测到 桌面环境，通过主进程启动本地 Node.js 检查...', 'INFO');
          try {
            checkData = await electronAPI.runNodeCheck(requestPayload);
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

        // 后端执行失败时，日志已输出，直接中断，不跳转标签页
        if (!checkData?.success) {
          throw new Error(checkData?.error || '后端执行失败，请查看执行日志');
        }

        const backendResults = (checkData?.results || []).map(result => ({
          table: result.table,
          status: result.status === '通过' ? '通过' : result.status === '失败' ? '失败' : '错误',
          message: result.message,
          details: {
            before: { count: result.before?.count || 0, sql: result.before?.sql || '', data: result.before?.data || [] },
            after: { count: result.after?.count || 0, sql: result.after?.sql || '', data: result.after?.data || [] }
          }
        }));

        const skippedResults = skippedTables.map(tableName => ({
          table: tableName,
          status: '跳过',
          message: '未配置查询条件，已跳过比对检查',
          details: { before: { count: 0, sql: '', data: [] }, after: { count: 0, sql: '', data: [] } }
        }));

        setResults([...backendResults, ...skippedResults]);
        addLog('断言结果已生成');
        setTimeout(() => setActiveTab('result'), 800);
      } catch (err) {
        addLog(`数据库连接失败: ${err.message}`, 'ERROR');
        throw err;
      }
      }
    } catch (err) {
      addLog(`执行失败: ${err.message}`, 'ERROR');
      setError(err.message || '请求失败');
    } finally {
      setIsLoading(false);
      addLog('执行完成');
    }
  };

  const handleSqlClick = (tableName, details) => {
    if (!details) return;
    setDataModalContent({
      title: tableName,
      beforeSql: details.before?.sql || 'N/A',
      afterSql: details.after?.sql || 'N/A',
      beforeData: details.before?.data || [],
      afterData: details.after?.data || []
    });
    setShowDataModal(true);
  };

  const renderDataComparisonTable = () => {
    const { beforeData, afterData } = dataModalContent;
    const allKeys = new Set();
    const maxLen = Math.max(beforeData.length, afterData.length);
    if (maxLen === 0) return null;

    if (beforeData[0]) Object.keys(beforeData[0]).forEach(k => allKeys.add(k));
    if (afterData[0]) Object.keys(afterData[0]).forEach(k => allKeys.add(k));
    
    const fields = Array.from(allKeys);

    return (
      <div className="data-table-container" style={{ overflowX: 'auto', marginTop: '15px' }}>
        {Array.from({ length: maxLen }).map((_, idx) => (
          <div key={idx} style={{ marginBottom: '20px' }}>
            {maxLen > 1 && <h4 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>记录 {idx + 1}</h4>}
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-lighter)', textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text-secondary)', width: '20%' }}>字段名称</th>
                  <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-lighter)', textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text-secondary)', width: '40%' }}>执行前数据</th>
                  <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-lighter)', textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text-secondary)', width: '40%' }}>执行后数据</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(field => {
                  const bVal = beforeData[idx] ? beforeData[idx][field] : undefined;
                  const aVal = afterData[idx] ? afterData[idx][field] : undefined;
                  const isDiff = bVal !== aVal;
                  return (
                    <tr key={field} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isDiff ? 'rgba(255, 100, 100, 0.05)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '500', color: 'var(--text-primary)' }}>{field}</td>
                      <td style={{ padding: '10px 12px', wordBreak: 'break-all', color: isDiff ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {bVal === undefined ? '-' : bVal === null ? <span style={{ color: '#aaa', fontStyle: 'italic' }}>NULL</span> : String(bVal)}
                      </td>
                      <td style={{ padding: '10px 12px', wordBreak: 'break-all', color: isDiff ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {aVal === undefined ? '-' : aVal === null ? <span style={{ color: '#aaa', fontStyle: 'italic' }}>NULL</span> : String(aVal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
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
    if (status === '跳过') return '⊘';
    return '!';
  };

  const environmentOptions = ['T1', 'T2', 'SITA', 'DEV1', 'TEST', 'DEVS'];

  const handleEnvironmentSelect = (env) => {
    setSelectedEnvironment(env);
    if (apiSettings[env]) {
      setApiUrl(apiSettings[env].request_url);
    }
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

  const handleDefaultTableSettingsClick = () => {
    setShowSettingsDropdown(false);
    setShowDefaultTableSettings(true);
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
      const envArray = prev[env] ? [...prev[env]] : [];
      if (envArray[index]) {
        envArray[index] = {
          ...envArray[index],
          [field]: value
        };
      }
      return {
        ...prev,
        [env]: envArray
      };
    });
  };

  const addDataSource = (env) => {
    setDbSettings(prev => {
      const envArray = prev[env] ? [...prev[env]] : [];
      envArray.push({
        dus: 'bdus',
        host: '',
        port: 5432,
        database: '',
        user: '',
        password: ''
      });
      return {
        ...prev,
        [env]: envArray
      };
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
    if (electronAPI) {
      try {
        electronAPI.saveTableSettings(systemSettings.tables)
          .catch(e => console.warn('[renderer] save-table-settings failed:', e));
      } catch (e) {
        console.warn('[renderer] ipc not available:', e);
      }
    }
    setShowSystemSettings(false);
    addLog('系统配置保存成功');
  };

  const handleSaveDefaultTableSettings = () => {
    localStorage.setItem('defaultTableSettings', JSON.stringify(defaultTableSettings));
    if (electronAPI) {
      try {
        const mergedTables = { ...defaultTableSettings.tables, ...systemSettings.tables };
        electronAPI.saveTableSettings(mergedTables)
          .catch(e => console.warn('[renderer] save-table-settings failed:', e));
      } catch (e) {
        console.warn('[renderer] ipc not available:', e);
      }
    }
    setShowDefaultTableSettings(false);
    addLog('默认表配置保存成功');
  };

  // ===== TOML 序列化/反序列化工具 =====

  const ENC_PREFIX = 'ENC:';

  /**
   * 加密密码字段 → 返回 "ENC:<base64>"
   * Electron 环境下通过 preload 桥接使用 Node.js crypto（AES-128-CBC + 随机 IV）
   * 浏览器环境 fallback：简单 base64 混淆
   */
  const encryptPassword = (plaintext) => {
    if (!plaintext) return plaintext;
    try {
      if (electronAPI?.encryptText) {
        return ENC_PREFIX + electronAPI.encryptText(plaintext);
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
      if (electronAPI?.decryptText) {
        return electronAPI.decryptText(encoded);
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
  const serializeToToml = (sysSettings, defaultTabSettings, apiCfg, dbCfg, sysDbCfg) => {
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
          lines.push(`dus      = ${JSON.stringify(ds.dus || 'bdus')}`);
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
      if (cfg.chineseName) { lines.push(`chinese_name = ${JSON.stringify(cfg.chineseName)}`); }
      lines.push(`primary_key = ${JSON.stringify(cfg.primaryKey || '')}`);
      lines.push(`dus         = ${JSON.stringify(cfg.dus || 'bdus')}`);
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

    // ── 5. 默认表配置（未自定义规则时作为兜底）────────────────────────────
    lines.push('');
    lines.push('# ╔══════════════════════════════════════════╗');
    lines.push('# ║   默认表配置（未自定义规则时作为兜底）     ║');
    lines.push('# ╚══════════════════════════════════════════╝');
    lines.push('');

    const defaultTables = defaultTabSettings.tables || {};
    for (const [tableName, cfg] of Object.entries(defaultTables)) {
      if (!cfg || typeof cfg !== 'object') continue;
      lines.push(`[default_tables.${tableName}]`);
      if (cfg.chineseName) { lines.push(`chinese_name = ${JSON.stringify(cfg.chineseName)}`); }
      lines.push(`primary_key = ${JSON.stringify(cfg.primaryKey || '')}`);
      lines.push(`dus         = ${JSON.stringify(cfg.dus || 'bdus')}`);
      lines.push('');
      const conds = Array.isArray(cfg.conditionFields) ? cfg.conditionFields : [];
      conds.forEach((cond, i) => {
        lines.push(`[[default_tables.${tableName}.conditions]]`);
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
            dus: ds.dus || 'bdus',
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
          chineseName: tCfg.chinese_name || '',
          primaryKey: tCfg.primary_key || '',
          dus: tCfg.dus || 'bdus',
          conditionFields: conds.map(c => ({
            field: c.field || '',
            source: c.source || 'request',
            path: c.path || '',
            required: Boolean(c.required),
            ...(c.selected_table ? { selectedTable: c.selected_table } : {})
          }))
        };
      }

      const rawDefaultTables = result.default_tables || {};
      const newDefaultTableSettings = { tables: {} };
      for (const [tName, tCfg] of Object.entries(rawDefaultTables)) {
        if (!tCfg || typeof tCfg !== 'object') continue;
        const conds = Array.isArray(tCfg.conditions) ? tCfg.conditions : [];
        newDefaultTableSettings.tables[tName] = {
          chineseName: tCfg.chinese_name || '',
          primaryKey: tCfg.primary_key || '',
          dus: tCfg.dus || 'bdus',
          conditionFields: conds.map(c => ({
            field: c.field || '',
            source: c.source || 'request',
            path: c.path || '',
            required: Boolean(c.required),
            ...(c.selected_table ? { selectedTable: c.selected_table } : {})
          }))
        };
      }

      return { newApiSettings, newDbSettings, newSystemDbConfig, newSystemSettings, newDefaultTableSettings };
    } catch (err) {
      console.error('[parseToml] 解析失败:', err);
      return null;
    }
  };

  /** 导出当前全部配置为 TOML 文件 */
  const handleExportSettings = async (isDefault = false) => {
    try {
      const tomlContent = serializeToToml(systemSettings, defaultTableSettings, apiSettings, dbSettings, systemDbConfig);
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      const prefix = isDefault === true ? 'autotest_default_config' : 'autotest_config';
      const filename = `${prefix}_${stamp}.toml`;

      if (electronAPI) {
        // Electron 环境：通过主进程弹出原生保存对话框
        const result = await electronAPI.saveFile({ content: tomlContent, filename });
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
      const { newApiSettings, newDbSettings, newSystemDbConfig, newSystemSettings, newDefaultTableSettings } = parsed;

      setApiSettings(newApiSettings);
      setDbSettings(newDbSettings);
      setSystemDbConfig(newSystemDbConfig);
      setSystemSettings(newSystemSettings);
      if (newDefaultTableSettings) setDefaultTableSettings(newDefaultTableSettings);

      // 持久化
      localStorage.setItem('apiSettings', JSON.stringify(newApiSettings));
      localStorage.setItem('dbSettings', JSON.stringify(newDbSettings));
      localStorage.setItem('systemDbConfig', JSON.stringify(newSystemDbConfig));
      localStorage.setItem('systemSettings', JSON.stringify(newSystemSettings));
      if (newDefaultTableSettings) localStorage.setItem('defaultTableSettings', JSON.stringify(newDefaultTableSettings));

      // 同步给主进程
      if (electronAPI) {
        try {
          const mergedTables = { ...(newDefaultTableSettings?.tables || {}), ...newSystemSettings.tables };
          electronAPI.saveTableSettings(mergedTables)
            .catch(err2 => console.warn('[renderer] import sync failed:', err2));
        } catch (err2) {
          console.warn('[renderer] ipc not available:', err2);
        }
      }

      addLog(`配置导入成功: ${file.name}`);
      alert(`✅ 配置导入成功！\n已更新: API设置、数据库配置、系统表配置、默认表配置`);
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

  // ===== JMX 导入功能 =====

  /**
   * 解析 JMeter .jmx 文件（XML），提取所有 HTTP 请求的报文
   * 支持 postBodyRaw=true 的 JSON 请求体
   */
  const parseJmxFile = (xmlText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('文件不是有效的 XML/JMX 格式');

    const samplers = Array.from(doc.querySelectorAll('HTTPSamplerProxy'));
    if (samplers.length === 0) throw new Error('文件中未找到 HTTP 请求样本，请检查 JMX 文件');

    return samplers.map((sampler, idx) => {
      const getProp = (name, tag = 'stringProp') => {
        const el = sampler.querySelector(`${tag}[name="${name}"]`);
        return el ? el.textContent.trim() : '';
      };

      const testname = sampler.getAttribute('testname') || `请求 ${idx + 1}`;
      const protocol  = getProp('HTTPSampler.protocol') || 'http';
      const domain    = getProp('HTTPSampler.domain');
      const port      = getProp('HTTPSampler.port');
      const path      = getProp('HTTPSampler.path');
      const method    = getProp('HTTPSampler.method') || 'POST';
      const isRawBody = getProp('HTTPSampler.postBodyRaw', 'boolProp') === 'true';

      let body = '';
      if (isRawBody) {
        // Raw body 存放在 Arguments.arguments 下的第一个 elementProp 的 Argument.value 中
        const argValue = sampler.querySelector(
          'collectionProp[name="Arguments.arguments"] > elementProp > stringProp[name="Argument.value"]'
        );
        // 提取后先做基础清洗：去 BOM、统一换行、去首尾空白
        const raw = argValue ? argValue.textContent : '';
        body = raw
          .replace(/^\uFEFF/, '')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .trim();
      } else {
        // 键对形式的参数，尝试拼成 JSON
        const params = {};
        const argItems = sampler.querySelectorAll(
          'collectionProp[name="Arguments.arguments"] > elementProp'
        );
        argItems.forEach(item => {
          const nameEl  = item.querySelector('stringProp[name="Argument.name"]');
          const valueEl = item.querySelector('stringProp[name="Argument.value"]');
          if (nameEl && valueEl && nameEl.textContent.trim()) {
            params[nameEl.textContent.trim()] = valueEl.textContent.trim();
          }
        });
        if (Object.keys(params).length > 0) {
          try { body = JSON.stringify(params, null, 2); } catch { body = ''; }
        }
      }

      // 拼接 URL
      let url = '';
      if (domain) {
        const portPart = (port && port !== '80' && port !== '443') ? `:${port}` : '';
        url = `${protocol}://${domain}${portPart}${path}`;
      }

      return { testname, url, method, body };
    }).filter(r => r.body); // 过滤掉没有报文的请求
  };

  /** 文件选择后处理 */
  const handleJmxFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // 允许重复选择同一文件
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const requests = parseJmxFile(ev.target.result);
        if (requests.length === 0) {
          alert('未找到含有请求体的 HTTP 请求，请确认 JMX 中展开了「Post Body Data」');
          return;
        }
        if (requests.length === 1) {
          // 单个直接填充
          handleJmxRequestSelect(requests[0]);
        } else {
          // 多个弹出选择器
          setJmxRequests(requests);
          setShowJmxPicker(true);
        }
      } catch (err) {
        alert(`JMX 解析失败：${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  /** 选择报文后填充请求区 */
  /** 清洗并格式化 JMX 提取到的 body 文本 */
  const cleanJmxBody = (raw) => {
    if (!raw) return '';
    let s = String(raw);
    
    // 1. 去除 BOM 和统一换行
    s = s.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    s = s.trim();

    // 2. 尝试容错处理：去除导致 JSON.parse 失败的常见数组/对象末尾逗号
    const fixedForJson = s.replace(/,\s*([}\]])/g, '$1');

    try {
      // 3. 优先尝试标准 JSON 格式化（能完美解决同一属性换行的问题）
      return JSON.stringify(JSON.parse(fixedForJson), null, 2);
    } catch {
      // 4. 解析失败（存在 JMeter 变量等）：使用降级的伪 JSON 格式化器
      const lines = s.split('\n')
        .map(l => l.trim()) // 强制去除首尾空白（避免隐藏空白符导致空行存留）
        .filter(l => l !== ''); // 彻底干掉空行
        
      let indentLevel = 0;
      const formatted = [];
      
      for (const line of lines) {
        // 如果这行以关闭括号开头，先减少缩进
        if (line.match(/^[}\]]/)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }
        
        formatted.push('  '.repeat(indentLevel) + line);
        
        // 计算行内大括号、方括号带来的缩进变化
        const openCount = (line.match(/[{[]/g) || []).length;
        const closeCount = (line.match(/[}\]]/g) || []).length;
        indentLevel += (openCount - closeCount);
        indentLevel = Math.max(0, indentLevel);
      }
      
      return formatted.join('\n');
    }
  };

  /** 选择报文后填充请求区 */
  const handleJmxRequestSelect = (req) => {
    const cleaned = cleanJmxBody(req.body);
    setRequestBody(cleaned);
    setShowJmxPicker(false);
    addLog(`已导入 JMX 报文：${req.testname}`);
  };


  // 从本地存储加载API设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('apiSettings');
    if (savedSettings) {
      try {
        startTransition(() => {
          setApiSettings(JSON.parse(savedSettings));
        });
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
        startTransition(() => {
          setDbSettings(JSON.parse(savedDbSettings));
        });
      } catch (error) {
        console.error('加载数据库设置失败:', error);
      }
    }

    // 从本地存储加载系统级数据库配置
    const savedSystemDbConfig = localStorage.getItem('systemDbConfig');
    if (savedSystemDbConfig) {
      try {
        startTransition(() => {
          setSystemDbConfig(JSON.parse(savedSystemDbConfig));
        });
      } catch (error) {
        console.error('加载系统级数据库配置失败:', error);
      }
    }

    // 从本地存储加载系统配置
    const savedSystemSettings = localStorage.getItem('systemSettings');
    if (savedSystemSettings) {
      try {
        const parsed = JSON.parse(savedSystemSettings);
        if (parsed && parsed.tables && typeof parsed.tables === 'object') {
          const sanitizedTables = {};
          for (const [tName, tConfig] of Object.entries(parsed.tables)) {
            if (tConfig && typeof tConfig === 'object') {
              sanitizedTables[tName] = {
                chineseName: tConfig.chineseName || '',
                primaryKey: tConfig.primaryKey || '',
                conditionFields: Array.isArray(tConfig.conditionFields) ? tConfig.conditionFields : []
              };
            }
          }
          startTransition(() => {
            setSystemSettings({ tables: sanitizedTables });
          });
        }
      } catch (error) {
        console.error('加载系统配置失败:', error);
      }
    }

    // 从本地存储加载默认表配置
    const savedDefaultTableSettings = localStorage.getItem('defaultTableSettings');
    if (savedDefaultTableSettings) {
      try {
        const parsed = JSON.parse(savedDefaultTableSettings);
        if (parsed && parsed.tables && typeof parsed.tables === 'object') {
          const sanitizedTables = {};
          for (const [tName, tConfig] of Object.entries(parsed.tables)) {
            if (tConfig && typeof tConfig === 'object') {
              sanitizedTables[tName] = {
                chineseName: tConfig.chineseName || '',
                primaryKey: tConfig.primaryKey || '',
                conditionFields: Array.isArray(tConfig.conditionFields) ? tConfig.conditionFields : []
              };
            }
          }
          startTransition(() => {
            setDefaultTableSettings({ tables: sanitizedTables });
          });
        }
      } catch (error) {
        console.error('加载默认表配置失败:', error);
      }
    }
  }, []);

  // 保持 ref 与最新 state 同步（供异步函数使用）
  useEffect(() => { systemDbConfigRef.current = systemDbConfig; }, [systemDbConfig]);
  useEffect(() => { apiSettingsRef.current = apiSettings; }, [apiSettings]);

  // 应用启动时若已有登录态（sessionStorage 中有 authSession），自动加载 API 地址
  useEffect(() => {
    if (authUser && apiStatus === 'idle') {
      // 延迟一帧，确保 systemDbConfigRef 已同步
      const t = setTimeout(() => { fetchApiSettingsFromDb(); }, 200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  if (!authUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isAuthenticating={isAuthenticating}
        errorMessage={loginError}
        authApiBaseUrl={authApiBaseUrl}
        onAuthApiBaseUrlChange={setAuthApiBaseUrl}
        captchaSrc={captchaSrc}
        captchaUuid={captchaUuid}
        captchaLoading={captchaLoading}
        captchaEnabled={captchaEnabled}
        onRefreshCaptcha={fetchCaptcha}
        captchaCode={loginCaptchaCode}
        onCaptchaCodeChange={setLoginCaptchaCode}
      />
    );
  }

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
          <div className="user-chip">
            <span className="user-chip-label">当前用户</span>
            <span className="user-chip-name">{authUser.displayName}</span>
          </div>

          {/* 状态显示 */}
          <div
            className="status-container"
            title={apiStatus === 'error' ? apiStatusMsg : ''}
            style={{ cursor: apiStatus === 'error' ? 'pointer' : 'default' }}
            onClick={apiStatus === 'error' ? fetchApiSettingsFromDb : undefined}
          >
            <span className={`status-dot status-dot--${apiStatus}`}></span>
            <span className={`status-text ${apiStatus === 'error' ? 'status-text--error' : ''}`}>
              {apiStatus === 'loading' ? '加载中' : apiStatus === 'error' ? '连接失败' : '就绪'}
            </span>
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
                <button className="dropdown-item" onClick={handleDefaultTableSettingsClick}>默认表配置</button>
                <button className="dropdown-item" onClick={handleDbSettingsClick}>数据库配置</button>
                <button className="dropdown-item" onClick={handleApiSettingsClick}>API设置</button>
                <button className="dropdown-item">关于</button>
              </div>
            )}
          </div>

          <button className="btn-logout" onClick={handleLogout}>
            退出登录
          </button>
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
              <button
                className="btn-jmx-import"
                onClick={() => jmxFileRef.current?.click()}
                title="从 JMeter JMX 脚本导入报文"
              >
                <span className="btn-jmx-icon">⇣</span>
                JMX
              </button>
              <input
                ref={jmxFileRef}
                type="file"
                accept=".jmx,application/xml,text/xml"
                style={{ display: 'none' }}
                onChange={handleJmxFileSelect}
              />
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
                  <button onClick={() => removeTable(index)} className="btn-icon btn-danger" title="移除">×</button>
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
                    <div
                      key={log.id ?? index}
                      className={`log-line ${getLogClass(log.level)}`}
                      style={{ '--log-i': Math.min(index, 25) }}
                    >
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
                    <div key={index} className={`result-card ${result.status === '通过' ? 'result-pass' : result.status === '跳过' ? 'result-skip' : 'result-fail'}`}>
                      <div className="result-top">
                        <div className="result-info">
                          <span className={`status-badge ${result.status === '通过' ? 'badge-pass' : result.status === '跳过' ? 'badge-skip' : 'badge-fail'}`}>
                            {getStatusIcon(result.status)} {result.status}
                          </span>
                          <span className="result-table-name">{result.table}</span>
                        </div>
                        <span className="result-msg">{result.message}</span>
                      </div>
                      <div className="result-sql-section">
                        <div className="sql-block clickable-sql" onClick={() => handleSqlClick(result.table, result.details)} style={{ cursor: 'pointer' }} title="点击查看具体数据对比">
                          <div className="sql-label">执行前 SQL</div>
                          <code className="sql-code">{result.details?.before?.sql || 'N/A'}</code>
                          <div className="sql-count">记录数: {result.details?.before?.count || 0}</div>
                        </div>
                        <div className="sql-arrow">→</div>
                        <div className="sql-block clickable-sql" onClick={() => handleSqlClick(result.table, result.details)} style={{ cursor: 'pointer' }} title="点击查看具体数据对比">
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
                                <div className="db-data-source-header-left">
                                  <span>数据源 {index + 1}</span>
                                  <select
                                    value={ds.dus || 'bdus'}
                                    onChange={(e) => handleDbSettingChange(env, index, 'dus', e.target.value)}
                                    className="select-dus"
                                    title="选择数据源类型（DUS）"
                                  >
                                    <option value="bdus">bdus</option>
                                    <option value="bto">bto</option>
                                    <option value="cdus">cdus</option>
                                  </select>
                                </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0 }}>表配置</h4>
                  <input
                    type="text"
                    placeholder="模糊搜索表名或中文名..."
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    className="input search-input"
                    style={{ width: '250px' }}
                  />
                </div>
                <div className="table-configs">
                  {Object.entries(systemSettings.tables).filter(([tableName, config]) => {
                    if (!config || typeof config !== 'object') return false;
                    const query = tableSearchQuery.toLowerCase();
                    if (!query) return true;
                    const chineseName = config.chineseName || '';
                    return tableName.toLowerCase().includes(query) || chineseName.toLowerCase().includes(query);
                  }).map(([tableName, config]) => (
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
                          style={{ flex: 1 }}
                        />
                        <input
                          type="text"
                          value={config.chineseName || ''}
                          onChange={(e) => {
                            setSystemSettings(prev => ({
                              ...prev,
                              tables: {
                                ...prev.tables,
                                [tableName]: {
                                  ...prev.tables[tableName],
                                  chineseName: e.target.value
                                }
                              }
                            }));
                          }}
                          className="input table-chinese-input"
                          placeholder="中文名"
                          style={{ marginLeft: '10px', flex: 1 }}
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
                          <div className="pk-dus-row">
                            <div className="pk-field">
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
                            <div className="dus-field">
                              <label>DUS</label>
                              <select
                                value={config.dus || 'bdus'}
                                onChange={(e) => {
                                  setSystemSettings(prev => ({
                                    ...prev,
                                    tables: {
                                      ...prev.tables,
                                      [tableName]: {
                                        ...prev.tables[tableName],
                                        dus: e.target.value
                                      }
                                    }
                                  }));
                                }}
                                className="select-dus"
                              >
                                <option value="bdus">bdus</option>
                                <option value="bto">bto</option>
                                <option value="cdus">cdus</option>
                              </select>
                            </div>
                          </div>
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
                            chineseName: '',
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
                  onClick={() => handleExportSettings(false)}
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

      {/* 默认表配置模态框 */}
      {showDefaultTableSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingRight: '20px' }}>
                <h3 style={{ whiteSpace: 'nowrap', margin: 0 }}>默认表配置</h3>
                <div className="modal-subtitle" style={{ fontSize: '12px', color: '#888', lineHeight: '1.4', margin: 0 }}>
                  默认表配置为系统默认的表规则配置，不可修改，若不符合您的要求，请在<strong style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>系统配置</strong>中覆盖相应的表规则，系统会优先使用用户自定义规则
                </div>
              </div>
              <button 
                className="modal-close" 
                onClick={() => setShowDefaultTableSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="system-settings-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0 }}>表配置</h4>
                  <input
                    type="text"
                    placeholder="模糊搜索表名或中文名..."
                    value={defaultTableSearchQuery}
                    onChange={(e) => setDefaultTableSearchQuery(e.target.value)}
                    className="input search-input"
                    style={{ width: '250px' }}
                  />
                </div>
                <div className="table-configs">
                  {Object.entries(defaultTableSettings.tables).filter(([tableName, config]) => {
                    if (!config || typeof config !== 'object') return false;
                    const query = defaultTableSearchQuery.toLowerCase();
                    if (!query) return true;
                    const chineseName = config.chineseName || '';
                    return tableName.toLowerCase().includes(query) || chineseName.toLowerCase().includes(query);
                  }).map(([tableName, config]) => (
                    <div key={tableName} className="table-config-card">
                      <div className="table-config-header">
                        <input
                          type="text"
                          value={tableName}
                          onChange={(e) => {
                            const newTableName = e.target.value;
                            if (newTableName && newTableName !== tableName) {
                              setDefaultTableSettings(prev => {
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
                          style={{ flex: 1 }}
                        />
                        <input
                          type="text"
                          value={config.chineseName || ''}
                          onChange={(e) => {
                            setDefaultTableSettings(prev => ({
                              ...prev,
                              tables: {
                                ...prev.tables,
                                [tableName]: {
                                  ...prev.tables[tableName],
                                  chineseName: e.target.value
                                }
                              }
                            }));
                          }}
                          className="input table-chinese-input"
                          placeholder="中文名"
                          style={{ marginLeft: '10px', flex: 1 }}
                        />
                        <button 
                          className="btn-icon btn-danger"
                          onClick={() => {
                            setDefaultTableSettings(prev => {
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
                          <div className="pk-dus-row">
                            <div className="pk-field">
                              <label>主键</label>
                              <input
                                type="text"
                                value={config.primaryKey || ''}
                                onChange={(e) => {
                                  setDefaultTableSettings(prev => ({
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
                            <div className="dus-field">
                              <label>DUS</label>
                              <select
                                value={config.dus || 'bdus'}
                                onChange={(e) => {
                                  setDefaultTableSettings(prev => ({
                                    ...prev,
                                    tables: {
                                      ...prev.tables,
                                      [tableName]: {
                                        ...prev.tables[tableName],
                                        dus: e.target.value
                                      }
                                    }
                                  }));
                                }}
                                className="select-dus"
                              >
                                <option value="bdus">bdus</option>
                                <option value="bto">bto</option>
                                <option value="cdus">cdus</option>
                              </select>
                            </div>
                          </div>
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
                                      setDefaultTableSettings(prev => {
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
                                      setDefaultTableSettings(prev => {
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
                                          setDefaultTableSettings(prev => {
                                            const newSettings = { ...prev };
                                            newSettings.tables[tableName].conditionFields[index].selectedTable = e.target.value;
                                            newSettings.tables[tableName].conditionFields[index].path = e.target.value ? `${e.target.value}.` : '';
                                            return newSettings;
                                          });
                                        }}
                                        className="input"
                                      >
                                        <option value="">请选择表</option>
                                        {Object.keys(defaultTableSettings.tables).filter(t => t !== tableName).map(t => (
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
                                          setDefaultTableSettings(prev => {
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
                                        setDefaultTableSettings(prev => {
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
                                      setDefaultTableSettings(prev => {
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
                                    setDefaultTableSettings(prev => {
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
                              setDefaultTableSettings(prev => {
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
                      setDefaultTableSettings(prev => ({
                        ...prev,
                        tables: {
                          ...prev.tables,
                          [newTableName]: {
                            chineseName: '',
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
                  onClick={() => handleExportSettings(true)}
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
                  onClick={() => setShowDefaultTableSettings(false)}
                >
                  取消
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSaveDefaultTableSettings}
                >
                  保存设置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JMX 多报文选择器 Modal */}
      {showJmxPicker && (
        <div className="modal-overlay" onClick={() => setShowJmxPicker(false)}>
          <div className="modal-content jmx-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">📄</span>
              <span className="modal-title">选择 JMX 报文</span>
              <span className="modal-subtitle">检测到 {jmxRequests.length} 个 HTTP 请求，请选择要导入的报文</span>
              <button className="modal-close" onClick={() => setShowJmxPicker(false)}>×</button>
            </div>
            <div className="jmx-list">
              {jmxRequests.map((req, idx) => (
                <button
                  key={idx}
                  className="jmx-item"
                  onClick={() => handleJmxRequestSelect(req)}
                >
                  <div className="jmx-item-header">
                    <span className={`jmx-method-badge method-${req.method.toLowerCase()}`}>
                      {req.method}
                    </span>
                    <span className="jmx-item-name">{req.testname}</span>
                    <span className="jmx-item-index">#{idx + 1}</span>
                  </div>
                  {req.url && (
                    <div className="jmx-item-url">{req.url}</div>
                  )}
                  <div className="jmx-item-preview">
                    {req.body.slice(0, 120)}{req.body.length > 120 ? '...' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <input
        ref={importFileRef}
        type="file"
        accept=".toml,text/plain"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
      {/* SQL 数据对比模态框 */}
      {showDataModal && (
        <div className="modal-overlay">
          <div className="modal-content sql-data-modal" style={{ maxWidth: '85%', width: '1200px' }}>
            <div className="modal-header">
              <h3>{dataModalContent.title} - 数据对比明细</h3>
              <button className="btn-close" onClick={() => setShowDataModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '10px 20px' }}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div className="sql-statement" style={{ flex: 1, padding: '16px', backgroundColor: '#1e1e1e', borderRadius: '8px', border: '1px solid #333', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                  <div style={{ color: '#858585', marginBottom: '10px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>执行前 SQL 语句</div>
                  <code style={{ display: 'block', wordBreak: 'break-all', color: '#ce9178', fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '14px', lineHeight: '1.6' }}>{dataModalContent.beforeSql}</code>
                </div>
                <div className="sql-statement" style={{ flex: 1, padding: '16px', backgroundColor: '#1e1e1e', borderRadius: '8px', border: '1px solid #333', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                  <div style={{ color: '#858585', marginBottom: '10px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>执行后 SQL 语句</div>
                  <code style={{ display: 'block', wordBreak: 'break-all', color: '#ce9178', fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '14px', lineHeight: '1.6' }}>{dataModalContent.afterSql}</code>
                </div>
              </div>
              
              {dataModalContent.beforeData.length === 0 && dataModalContent.afterData.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-lighter)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>📭</div>
                  暂无查询数据
                </div>
              ) : (
                renderDataComparisonTable()
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', paddingTop: '15px', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn-secondary" onClick={() => setShowDataModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
