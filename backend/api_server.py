import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
from decimal import Decimal

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

from utils.hash_utils import CustNoShardingUtil
from utils.message_parser import MessageParser

app = FastAPI(title="DataConsistencyAPI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CheckRequest(BaseModel):
    apiResponse: Optional[Dict[str, Any]] = None
    tables: List[str]
    requestData: Dict[str, Any]
    routingKey: Optional[Dict[str, str]] = None
    tableConditions: Optional[Dict[str, Dict[str, Any]]] = None
    tableSettings: Optional[Dict[str, Any]] = None
    environment: Optional[str] = None

class CheckResponse(BaseModel):
    success: bool
    logs: List[Dict[str, str]]
    results: List[Dict[str, Any]]
    error: Optional[str] = None

def load_db_config():
    config_file = os.path.join(os.path.dirname(__file__), "config", "config.json")
    with open(config_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_db_connection(db_name):
    config = load_db_config()
    db_config = config['databases'][db_name]
    return psycopg2.connect(
        host=db_config['host'],
        port=db_config['port'],
        user=db_config['user'],
        password=db_config['password'],
        database=db_name
    )

def calculate_routing(value, environment=None, base_name='tb_dpmst_medium'):
    total = 8
    if environment and environment.upper() in ["T1", "T2", "SITA"]:
        total = 16
    h = CustNoShardingUtil.calculate_hash(value, total)
    db_index = (h - 1) // 2 + 1
    db_name = f"dcdpdb{db_index}"
    suffix = f"{h:04d}"
    return db_name, f"{base_name}_{suffix}", h

def build_where_clause(conditions):
    if not conditions:
        return "1=1"
    parts = [f"{k} = '{v}'" for k, v in conditions.items()]
    return " AND ".join(parts)

def convert_obj(obj):
    if isinstance(obj, dict):
        return {k: convert_obj(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def resolve_deps(table_name, base_conditions, table_settings, cache, add_log):
    conditions = dict(base_conditions)
    cfg = (table_settings or {}).get(table_name, {})
    add_log(f"  [resolve_deps] table={table_name}, conditionFields count={len(cfg.get('conditionFields', []))}, cache tables={list(cache.keys())}")
    for cond in cfg.get('conditionFields', []):
        if cond.get('source') != 'table':
            continue
        parts = (cond.get('path') or '').split('.')
        add_log(f"  [resolve_deps] processing source=table: field={cond.get('field')}, path={cond.get('path')}, parts={parts}")
        if len(parts) >= 2 and parts[0] and parts[1]:
            dep_table = parts[0]
            dep_field = '.'.join(parts[1:])  # 支持字段名中含点的情况
            if dep_table in cache:
                val = cache[dep_table].get(dep_field)
                if val is not None:
                    conditions[cond['field']] = str(val)
                    add_log(f"  dep: {cond['field']} = {val} (from {dep_table}.{dep_field})")
                else:
                    available = list(cache[dep_table].keys())
                    add_log(f"  warn: {dep_table}.{dep_field} is null, available fields: {available}", "WARNING")
            else:
                add_log(f"  warn: dep table {dep_table} not in cache, cache has: {list(cache.keys())}", "WARNING")
        else:
            add_log(f"  warn: invalid path format '{cond.get('path')}', expected 'tableName.fieldName'", "WARNING")
    return conditions

def run_query(table_name, conditions, environment, add_log):
    routing_val = conditions.get("cust_no") or list(conditions.values())[0]
    db_name, phys_table, h = calculate_routing(routing_val, environment, table_name)
    add_log(f"route: {db_name}.{phys_table} (hash={h})")
    where = build_where_clause(conditions)
    sql_q = f'SELECT * FROM "{phys_table}" WHERE {where}'
    add_log(sql_q, "SQL")
    add_log(f"conditions: {json.dumps(conditions)}")
    try:
        conn = get_db_connection(db_name)
        add_log(f"connected: {db_name}")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql_q)
            rows = cur.fetchall()
        conn.close()
        converted = [convert_obj(dict(r)) for r in rows]
        add_log(f"rows: {len(converted)}")
        if converted:
            add_log(json.dumps(converted[0], ensure_ascii=False, cls=CustomJSONEncoder)[:500])
        return sql_q, converted, None
    except Exception as e:
        add_log(f"query error: {e}", "ERROR")
        return sql_q, [], str(e)

@app.post("/api/check", response_model=CheckResponse)
async def check_data_consistency(request: CheckRequest):
    logs = []
    def add_log(msg, lvl="INFO"):
        logs.append({"timestamp": datetime.now().isoformat(), "level": lvl, "message": msg})

    try:
        add_log("start check...")

        try:
            ri = MessageParser.parse_main_map_element(request.requestData, add_log)
            add_log(f"routing key: type={ri['type']} value={ri['value']}")
        except Exception as e:
            add_log(f"parse error: {e}", "ERROR")
            raise HTTPException(status_code=400, detail=str(e))

        tc = request.tableConditions or {}
        ts = request.tableSettings or {}

        add_log("=== before query ===")
        before_data = {}
        before_cache = {}
        for tname in request.tables:
            if not tname:
                continue
            add_log(f"table: {tname}")
            base = dict(tc.get(tname, {}))
            add_log(f"  tableSettings has '{tname}': {'yes' if tname in ts else 'no'}, tableConditions base: {json.dumps(base)}")
            conds = resolve_deps(tname, base, ts, before_cache, add_log)
            if not conds:
                add_log(f"no conditions for {tname}, skip", "WARNING")
                continue
            sql_q, rows, err = run_query(tname, conds, request.environment, add_log)
            if err:
                before_data[tname] = {"sql": sql_q, "error": err}
            else:
                before_data[tname] = {"sql": sql_q, "count": len(rows), "data": rows}
                if rows:
                    before_cache[tname] = rows[0]

        if request.apiResponse:
            add_log("api response provided")
        else:
            add_log("no api response")

        add_log("=== after query ===")
        after_data = {}
        after_cache = {}
        for tname in request.tables:
            if not tname:
                continue
            base = dict(tc.get(tname, {}))
            conds = resolve_deps(tname, base, ts, after_cache, add_log)
            if not conds:
                continue
            sql_q, rows, err = run_query(tname, conds, request.environment, add_log)
            if err:
                after_data[tname] = {"sql": sql_q, "error": err}
            else:
                after_data[tname] = {"sql": sql_q, "count": len(rows), "data": rows}
                if rows:
                    after_cache[tname] = rows[0]

        add_log("=== compare ===")
        results = []
        for tname in request.tables:
            if not tname:
                continue
            b = before_data.get(tname, {})
            a = after_data.get(tname, {})
            if "error" in b or "error" in a:
                results.append({"table": tname, "status": "error", "message": b.get("error") or a.get("error"), "before": b, "after": a, "diff": None})
                continue
            if b.get("count", 0) == a.get("count", 0) and b.get("data") == a.get("data"):
                results.append({"table": tname, "status": "pass", "message": "consistent", "before": b, "after": a, "diff": None})
            else:
                results.append({"table": tname, "status": "fail", "message": "inconsistent", "before": b, "after": a, "diff": {"count_changed": True}})

        add_log("done")
        return CheckResponse(success=True, logs=logs, results=results)

    except HTTPException:
        raise
    except Exception as e:
        add_log(f"fatal: {e}", "ERROR")
        return CheckResponse(success=False, logs=logs, results=[], error=str(e))

@app.get("/")
async def root():
    return {"message": "DataConsistencyAPI"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
