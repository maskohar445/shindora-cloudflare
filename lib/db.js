import { v4 as uuidv4 } from 'uuid'

// Global cache to persist connection across serverless invocations
let globalDbInstance = null

// Helper to get nested values like 'emailProviderCredentials.smtpPass'
function getNestedValue(obj, path) {
  if (!obj) return undefined;
  if (!path.includes('.')) {
    if (path === '_id' && obj._id === undefined) return obj.id;
    if (path === 'id' && obj.id === undefined) return obj._id;
    return obj[path];
  }
  const parts = path.split('.');
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

// MongoDB-like Collection implemented on top of D1 / SQLite / Turso
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
        const doc = JSON.parse(res.rows[0].data);
        if (matchQuery(doc, query)) {
          return doc;
        }
      }
      return null;
    }

    const res = await this.executeSql(`SELECT data FROM [${this.tableName}]`);
    for (const row of res.rows) {
      const doc = JSON.parse(row.data);
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
          const doc = JSON.parse(row.data);
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

// 1. Cloudflare D1 Native Binding Engine (Workers / Pages)
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

// 2. Cloudflare D1 Universal REST API Engine (Vercel / Node.js / Serverless / Docker)
class CloudflareD1RestEngine {
  constructor(accountId, databaseId, apiToken) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
    this.apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  }

  async execute({ sql, args = [] }) {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql,
        params: args
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudflare D1 REST API Error (${res.status}): ${errText}`);
    }
    const json = await res.json();
    if (!json.success && json.errors && json.errors.length > 0) {
      throw new Error(`Cloudflare D1 Query Error: ${json.errors[0]?.message || 'Unknown error'}`);
    }
    const resultObj = json.result?.[0] || {};
    return {
      rows: (resultObj.results || []).map(r => ({ ...r })),
      columns: (resultObj.meta?.columns || []),
      rowsAffected: resultObj.meta?.changes || 0
    };
  }
}

// 3. Pure Fetch-based Turso / LibSQL HTTP Pipeline Engine (Zero external dependencies)
class TursoHttpEngine {
  constructor(url, authToken) {
    let cleanUrl = String(url).trim().replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    this.pipelineUrl = `${cleanUrl}/v2/pipeline`;
    this.authToken = authToken;
  }

  async execute({ sql, args = [] }) {
    const res = await fetch(this.pipelineUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
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
  // 1. Direct D1 instance or context passed as parameter
  if (customEnv) {
    if (typeof customEnv.prepare === 'function') {
      return new UnifiedDbWrapper(new CloudflareD1BindingEngine(customEnv));
    }
    if (customEnv.DB && typeof customEnv.DB.prepare === 'function') {
      return new UnifiedDbWrapper(new CloudflareD1BindingEngine(customEnv.DB));
    }
    if (customEnv.env?.DB && typeof customEnv.env.DB.prepare === 'function') {
      return new UnifiedDbWrapper(new CloudflareD1BindingEngine(customEnv.env.DB));
    }
  }

  if (globalDbInstance) return globalDbInstance;

  // 2. Check for Cloudflare D1 Native Binding in global runtime contexts
  if (typeof globalThis !== 'undefined') {
    if (globalThis.DB && typeof globalThis.DB.prepare === 'function') {
      console.log("[DB Info]: Cloudflare D1 Native Binding detected (globalThis.DB).");
      globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(globalThis.DB));
      return globalDbInstance;
    }
    if (globalThis.__env__?.DB && typeof globalThis.__env__.DB.prepare === 'function') {
      console.log("[DB Info]: Cloudflare D1 Native Binding detected (globalThis.__env__.DB).");
      globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(globalThis.__env__.DB));
      return globalDbInstance;
    }
    if (globalThis.env?.DB && typeof globalThis.env.DB.prepare === 'function') {
      console.log("[DB Info]: Cloudflare D1 Native Binding detected (globalThis.env.DB).");
      globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(globalThis.env.DB));
      return globalDbInstance;
    }
  }

  if (typeof process !== 'undefined' && process.env?.DB && typeof process.env.DB.prepare === 'function') {
    console.log("[DB Info]: Cloudflare D1 Native Binding detected (process.env.DB).");
    globalDbInstance = new UnifiedDbWrapper(new CloudflareD1BindingEngine(process.env.DB));
    return globalDbInstance;
  }

  // 3. Check for Cloudflare D1 Universal REST API Environment Variables
  const cfAccountId = typeof process !== 'undefined' 
    ? (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.D1_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || "").trim() 
    : "";
  const cfDatabaseId = typeof process !== 'undefined' 
    ? (process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.D1_DATABASE_ID || process.env.CLOUDFLARE_DATABASE_ID || "").trim() 
    : "";
  const cfApiToken = typeof process !== 'undefined' 
    ? (process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_D1_API_TOKEN || process.env.D1_TOKEN || process.env.CF_API_TOKEN || "").trim() 
    : "";

  if (cfAccountId && cfDatabaseId && cfApiToken) {
    console.log(`[DB Info]: Cloudflare D1 Universal REST API Engine connected (Database ID: ${cfDatabaseId}).`);
    globalDbInstance = new UnifiedDbWrapper(new CloudflareD1RestEngine(cfAccountId, cfDatabaseId, cfApiToken));
    return globalDbInstance;
  }

  // 4. Check for Turso / Remote LibSQL Database (Pure HTTP Pipeline)
  const rawTursoUrl = typeof process !== 'undefined' 
    ? (process.env.TURSO_DATABASE_URL || process.env.SQLITE_URL || process.env.TURSO_URL) 
    : null;
  const tursoUrl = typeof rawTursoUrl === 'string' ? rawTursoUrl.trim() : null;
  const tursoAuthToken = typeof process !== 'undefined' 
    ? (process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DB_AUTH_TOKEN || process.env.SQLITE_AUTH_TOKEN || process.env.SQLITE_TOKEN || "").trim() 
    : "";

  if (tursoUrl && tursoUrl !== "") {
    console.log(`[DB Info]: Turso Database detected and connected via HTTP Pipeline: ${tursoUrl}`);
    globalDbInstance = new UnifiedDbWrapper(new TursoHttpEngine(tursoUrl, tursoAuthToken));
    return globalDbInstance;
  }

  // 5. Fallback to Local SQLite File (dynamically required in Node only, never bundled in workerd)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const g = typeof globalThis !== 'undefined' ? globalThis : {};
      const req = g['__non_webpack_require__'] || (typeof require !== 'undefined' ? require : null);
      if (req) {
        const clientMod = req('@libsql/client');
        if (clientMod && typeof clientMod.createClient === 'function') {
          const localClient = clientMod.createClient({ url: 'file:local_sqlite.db' });
          console.log("[DB Info]: Local SQLite fallback engine initialized (local_sqlite.db).");
          globalDbInstance = new UnifiedDbWrapper(localClient);
          return globalDbInstance;
        }
      }
    } catch (_) {
      // ignore in edge workerd runtime
    }
  }

  console.log("[DB Info]: Edge serverless runtime initialized with in-memory store.");
  const mockEngine = {
    execute: async () => ({ rows: [], columns: [], rowsAffected: 0 })
  };
  globalDbInstance = new UnifiedDbWrapper(mockEngine);
  return globalDbInstance;
}
