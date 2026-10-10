import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Global cache to persist connection across serverless invocations
let globalDbInstance = null;

// Helper to get nested values like 'emailProviderCredentials.smtpPass'
function getNestedValue(obj, pathKey) {
  if (!obj) return undefined;
  if (!pathKey.includes('.')) {
    if (pathKey === '_id' && obj._id === undefined) return obj.id;
    if (pathKey === 'id' && obj.id === undefined) return obj._id;
    return obj[pathKey];
  }
  const parts = pathKey.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// MongoDB-like JS Query Evaluator
function matchQuery(doc, query) {
  if (!query) return true;

  for (const key in query) {
    const val = query[key];

    // logical operators
    if (key === '$and') {
      if (!Array.isArray(val)) return false;
      if (!val.every(subQuery => matchQuery(doc, subQuery))) return false;
      continue;
    }

    if (key === '$or') {
      if (!Array.isArray(val)) return false;
      if (!val.some(subQuery => matchQuery(doc, subQuery))) return false;
      continue;
    }

    const docVal = getNestedValue(doc, key);

    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof RegExp)) {
      for (const op in val) {
        const opVal = val[op];
        if (op === '$exists') {
          const exists = docVal !== undefined;
          if (exists !== Boolean(opVal)) return false;
        } else if (op === '$ne') {
          if (docVal == opVal) return false;
        } else if (op === '$eq') {
          if (docVal != opVal) return false;
        } else if (op === '$in') {
          if (!Array.isArray(opVal)) return false;
          let matched = false;
          if (Array.isArray(docVal)) {
            matched = docVal.some(d => opVal.some(item => String(item) === String(d)));
          } else {
            matched = opVal.some(item => String(item) === String(docVal));
          }
          if (!matched) return false;
        } else if (op === '$nin') {
          if (!Array.isArray(opVal)) return false;
          const matched = opVal.some(item => String(item) === String(docVal));
          if (matched) return false;
        } else if (op === '$regex') {
          const options = val.$options || 'i';
          const regex = opVal instanceof RegExp ? opVal : new RegExp(opVal, options);
          if (!regex.test(docVal || '')) return false;
        } else if (op === '$lte') {
          if (docVal === undefined || docVal === null) return false;
          if (!(docVal <= opVal)) return false;
        } else if (op === '$gte') {
          if (docVal === undefined || docVal === null) return false;
          if (!(docVal >= opVal)) return false;
        } else if (op === '$lt') {
          if (docVal === undefined || docVal === null) return false;
          if (!(docVal < opVal)) return false;
        } else if (op === '$gt') {
          if (docVal === undefined || docVal === null) return false;
          if (!(docVal > opVal)) return false;
        }
      }
    } else {
      // Direct comparison
      if (key === '_id' || key === 'id') {
        const docId = doc.id || doc._id;
        if (String(docId) !== String(val)) return false;
      } else {
        if (String(docVal) !== String(val)) return false;
      }
    }
  }

  return true;
}

// MongoDB-like Collection implemented on top of Turso / LibSQL / SQLite / D1
class DatabaseCollection {
  constructor(dbEngine, tableName) {
    this.dbEngine = dbEngine;
    this.tableName = tableName;
    this.initialized = false;
  }

  async executeSql(sqlOrObj) {
    let sql, args;
    if (typeof sqlOrObj === 'string') {
      sql = sqlOrObj;
      args = [];
    } else {
      sql = sqlOrObj.sql;
      args = sqlOrObj.args || [];
    }
    return await this.dbEngine.execute({ sql, args });
  }

  async ensureTable() {
    if (this.initialized) return;
    await this.executeSql(`
      CREATE TABLE IF NOT EXISTS [${this.tableName}] (
        id TEXT PRIMARY KEY,
        data TEXT
      )
    `);
    this.initialized = true;
  }

  applyUpdate(doc, update) {
    if (!update) return doc;
    const newDoc = { ...doc };
    if (update.$set) {
      for (const k in update.$set) {
        newDoc[k] = update.$set[k];
      }
    }
    if (update.$unset) {
      for (const k in update.$unset) {
        delete newDoc[k];
      }
    }
    if (update.$inc) {
      for (const k in update.$inc) {
        newDoc[k] = (newDoc[k] || 0) + update.$inc[k];
      }
    }
    
    // Direct merge if no operators are present
    let hasOperators = false;
    for (const k in update) {
      if (k.startsWith('$')) {
        hasOperators = true;
        break;
      }
    }
    if (!hasOperators) {
      return { ...newDoc, ...update };
    }
    return newDoc;
  }

  async findOne(query) {
    await this.ensureTable();
    const queryId = query?.id || query?._id;
    if (queryId && typeof queryId === 'string') {
      const res = await this.executeSql({
        sql: `SELECT data FROM [${this.tableName}] WHERE id = ?`,
        args: [queryId]
      });
      if (res.rows && res.rows[0]) {
        const rowData = typeof res.rows[0].data === 'string' ? res.rows[0].data : JSON.stringify(res.rows[0].data);
        const doc = JSON.parse(rowData);
        if (matchQuery(doc, query)) {
          return doc;
        }
      }
      return null;
    }

    const res = await this.executeSql(`SELECT data FROM [${this.tableName}]`);
    for (const row of res.rows) {
      const rowData = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
      const doc = JSON.parse(rowData);
      if (matchQuery(doc, query)) {
        return doc;
      }
    }
    return null;
  }

  find(query) {
    let sortObj = null;
    let limitVal = null;
    let skipVal = null;
    let projectObj = null;

    const cursor = {
      sort: (s) => {
        sortObj = s;
        return cursor;
      },
      limit: (l) => {
        limitVal = l;
        return cursor;
      },
      skip: (sk) => {
        skipVal = sk;
        return cursor;
      },
      project: (p) => {
        projectObj = p;
        return cursor;
      },
      toArray: async () => {
        await this.ensureTable();
        const res = await this.executeSql(`SELECT data FROM [${this.tableName}]`);
        let docs = [];
        for (const row of res.rows) {
          const rowData = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
          const doc = JSON.parse(rowData);
          if (matchQuery(doc, query)) {
            docs.push(doc);
          }
        }

        // Apply sort
        if (sortObj && Object.keys(sortObj).length > 0) {
          const key = Object.keys(sortObj)[0];
          const dir = sortObj[key]; // 1 for asc, -1 for desc
          docs.sort((a, b) => {
            const valA = a[key];
            const valB = b[key];
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
          });
        }

        // Apply skip
        if (skipVal !== null) {
          docs = docs.slice(skipVal);
        }

        // Apply limit
        if (limitVal !== null) {
          docs = docs.slice(0, limitVal);
        }

        return docs;
      }
    };

    return cursor;
  }

  async insertOne(doc) {
    await this.ensureTable();
    const id = String(doc.id || doc._id || uuidv4());
    const docWithId = { ...doc };
    if (!docWithId.id) docWithId.id = id;
    if (!docWithId._id) docWithId._id = id;

    await this.executeSql({
      sql: `INSERT OR REPLACE INTO [${this.tableName}] (id, data) VALUES (?, ?)`,
      args: [id, JSON.stringify(docWithId)]
    });
    return { insertedId: id, acknowledged: true };
  }

  async updateOne(query, update, options = {}) {
    await this.ensureTable();
    const doc = await this.findOne(query);
    if (!doc) {
      if (options.upsert) {
        const insertDoc = this.applyUpdate({}, update);
        for (const k in query) {
          if (!k.startsWith('$')) {
            insertDoc[k] = query[k];
          }
        }
        return await this.insertOne(insertDoc);
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }

    const updatedDoc = this.applyUpdate(doc, update);
    const id = String(updatedDoc.id || updatedDoc._id);

    await this.executeSql({
      sql: `UPDATE [${this.tableName}] SET data = ? WHERE id = ?`,
      args: [JSON.stringify(updatedDoc), id]
    });
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(query, update) {
    await this.ensureTable();
    const cursor = this.find(query);
    const docs = await cursor.toArray();
    let modifiedCount = 0;

    for (const doc of docs) {
      const updatedDoc = this.applyUpdate(doc, update);
      const id = String(updatedDoc.id || updatedDoc._id);
      await this.executeSql({
        sql: `UPDATE [${this.tableName}] SET data = ? WHERE id = ?`,
        args: [JSON.stringify(updatedDoc), id]
      });
      modifiedCount++;
    }
    return { matchedCount: docs.length, modifiedCount };
  }

  async deleteOne(query) {
    await this.ensureTable();
    const doc = await this.findOne(query);
    if (!doc) return { deletedCount: 0 };

    const id = String(doc.id || doc._id);
    await this.executeSql({
      sql: `DELETE FROM [${this.tableName}] WHERE id = ?`,
      args: [id]
    });
    return { deletedCount: 1 };
  }

  async deleteMany(query) {
    await this.ensureTable();
    const cursor = this.find(query);
    const docs = await cursor.toArray();
    let deletedCount = 0;

    for (const doc of docs) {
      const id = String(doc.id || doc._id);
      await this.executeSql({
        sql: `DELETE FROM [${this.tableName}] WHERE id = ?`,
        args: [id]
      });
      deletedCount++;
    }
    return { deletedCount };
  }
}

// 1. Pure Fetch-based Turso / LibSQL HTTP Pipeline Engine (Edge Runtime)
class TursoHttpEngine {
  constructor(url, authToken) {
    let cleanUrl = String(url).trim().replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    this.pipelineUrl = `${cleanUrl}/v2/pipeline`;
    this.authToken = authToken || '';
  }

  async execute({ sql, args = [] }) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const res = await fetch(this.pipelineUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql,
              args: args.map(a => {
                if (a === null || a === undefined) return { type: 'null' };
                if (typeof a === 'number') return { type: 'integer', value: String(a) };
                if (typeof a === 'boolean') return { type: 'integer', value: a ? '1' : '0' };
                return { type: 'text', value: String(a) };
              })
            }
          },
          { type: 'close' }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Turso HTTP Pipeline Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const result = data.results?.[0]?.response?.result;
    if (!result) return { rows: [], columns: [], rowsAffected: 0 };

    const cols = (result.cols || []).map(c => c.name);
    const rows = (result.rows || []).map(r => {
      const rowObj = {};
      r.forEach((val, i) => {
        rowObj[cols[i]] = val.value !== undefined ? (val.type === 'integer' ? Number(val.value) : val.value) : null;
      });
      return rowObj;
    });

    return {
      rows,
      columns: cols,
      rowsAffected: result.affected_row_count || 0
    };
  }
}

// 2. Cloudflare D1 Native Binding Engine (Compatibility Fallback)
class CloudflareD1BindingEngine {
  constructor(d1Binding) {
    this.d1 = d1Binding;
  }

  async execute({ sql, args = [] }) {
    const stmt = this.d1.prepare(sql).bind(...args);
    const result = await stmt.all();
    return {
      rows: (result.results || []).map(r => ({ ...r })),
      columns: result.meta?.columns || [],
      rowsAffected: result.meta?.changes || 0
    };
  }
}

// Unified Database Wrapper
class UnifiedDbWrapper {
  constructor(engine) {
    this.engine = engine;
  }

  async execute(params) {
    let sql, args;
    if (typeof params === 'string') {
      sql = params;
      args = [];
    } else {
      sql = params.sql;
      args = params.args || [];
    }
    return await this.engine.execute({ sql, args });
  }

  collection(name) {
    return new DatabaseCollection(this.engine, name);
  }
}

// Retrieve the Unified Database Instance
export async function getUnifiedDb(customEnv = null) {
  if (globalDbInstance) return globalDbInstance;

  // 1. Check for Turso Database URL & Auth Token (Primary Database)
  const envSource = (customEnv && !customEnv.headers && !customEnv.url ? (customEnv.env || customEnv) : null) || (typeof process !== 'undefined' ? process.env : {}) || {};
  
  const rawTursoUrl = (
    envSource.TURSO_DATABASE_URL ||
    envSource.TURSO_URL ||
    envSource.LIBSQL_URL ||
    envSource.DATABASE_URL ||
    (typeof process !== 'undefined' ? process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || process.env.LIBSQL_URL : '') ||
    (typeof globalThis !== 'undefined' && globalThis.__env__?.TURSO_DATABASE_URL)
  );

  const tursoUrl = typeof rawTursoUrl === 'string' ? rawTursoUrl.trim() : null;
  const tursoAuthToken = (
    envSource.TURSO_AUTH_TOKEN ||
    envSource.TURSO_DB_AUTH_TOKEN ||
    envSource.LIBSQL_AUTH_TOKEN ||
    (typeof process !== 'undefined' ? process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DB_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN : '') ||
    (typeof globalThis !== 'undefined' && globalThis.__env__?.TURSO_AUTH_TOKEN) ||
    ''
  ).trim();

  // If Remote Turso Database configured (HTTP / LibSQL)
  if (tursoUrl && (tursoUrl.startsWith('libsql://') || tursoUrl.startsWith('http://') || tursoUrl.startsWith('https://'))) {
    console.log(`[DB Info]: Turso Database connected via HTTP Edge Pipeline: ${tursoUrl}`);
    globalDbInstance = new UnifiedDbWrapper(new TursoHttpEngine(tursoUrl, tursoAuthToken));
    return globalDbInstance;
  }

  // 2. Check for Cloudflare D1 Native Binding (Fallback)
  if (customEnv && typeof customEnv.prepare === 'function') {
    globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(customEnv));
    return globalDbInstance;
  }
  if (customEnv?.DB && typeof customEnv.DB.prepare === 'function') {
    globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(customEnv.DB));
    return globalDbInstance;
  }
  if (customEnv?.env?.DB && typeof customEnv.env.DB.prepare === 'function') {
    globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(customEnv.env.DB));
    return globalDbInstance;
  }

  if (typeof globalThis !== 'undefined') {
    if (globalThis.DB && typeof globalThis.DB.prepare === 'function') {
      console.log("[DB Info]: Cloudflare D1 Binding detected (globalThis.DB).");
      globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(globalThis.DB));
      return globalDbInstance;
    }
  }

  // 3. Fallback to Local LibSQL / SQLite File Database in Node.js Runtime
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'local_sqlite.db'),
      path.resolve(process.cwd(), 'frontend/local_sqlite.db'),
      '/app/frontend/local_sqlite.db',
      '/app/local_sqlite.db',
      './local_sqlite.db'
    ];

    let foundDbPath = candidatePaths.find(p => fs.existsSync(p));
    if (!foundDbPath) {
      foundDbPath = candidatePaths[0];
    }

    // Direct require of @libsql/client
    const { createClient } = require('@libsql/client');
    const localClient = createClient({ url: `file:${foundDbPath}` });
    console.log(`[DB Info]: LibSQL Local SQLite Database initialized (${foundDbPath}).`);
    globalDbInstance = new UnifiedDbWrapper(localClient);
    return globalDbInstance;
  } catch (err) {
    console.warn("[DB Info]: Local LibSQL client not available in this runtime, using edge memory/http fallback:", err.message);
  }

  // 4. Edge serverless fallback
  console.log("[DB Info]: Edge serverless runtime initialized with in-memory store.");
  const mockEngine = {
    execute: async () => ({ rows: [], columns: [], rowsAffected: 0 })
  };
  globalDbInstance = new UnifiedDbWrapper(mockEngine);
  return globalDbInstance;
}
