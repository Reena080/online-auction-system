const { MongoClient } = require('mongodb');
const env = require('./env');

let client = null;
let db = null;
let auditCollection = null;
let isConnected = false;

// In-memory fallback collection for when MongoDB server is not running or during standalone unit testing
const inMemoryAuditLogs = [];

const inMemoryCollection = {
  async insertOne(doc) {
    const record = { ...doc, _id: `mem_${Date.now()}_${Math.random()}` };
    inMemoryAuditLogs.push(record);
    return { acknowledged: true, insertedId: record._id };
  },
  async find(query = {}) {
    let filtered = inMemoryAuditLogs;
    if (query.event) {
      filtered = filtered.filter(item => item.event === query.event);
    }
    if (query.auctionId) {
      filtered = filtered.filter(item => item.auctionId === query.auctionId);
    }
    if (query.userId) {
      filtered = filtered.filter(item => item.userId === query.userId);
    }
    return {
      sort: () => ({
        toArray: async () => [...filtered].reverse()
      }),
      toArray: async () => [...filtered]
    };
  },
  async countDocuments(query = {}) {
    const docs = await this.find(query);
    const arr = await docs.toArray();
    return arr.length;
  }
};

async function connectMongo() {
  if (client) return db;

  try {
    client = new MongoClient(env.MONGO_URI, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000
    });

    await client.connect();
    db = client.db();
    auditCollection = db.collection('audit_logs');
    isConnected = true;
    console.log('[MONGODB] Connected successfully for audit logging.');
    return db;
  } catch (error) {
    isConnected = false;
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[MONGODB] Notice: MongoDB server not reachable (${error.message}). Using resilient audit log fallback.`);
    }
    return null;
  }
}

function getAuditCollection() {
  if (auditCollection && isConnected) {
    return auditCollection;
  }
  return inMemoryCollection;
}

function setAuditCollection(customCollection) {
  auditCollection = customCollection;
  isConnected = true;
}

function getInMemoryAuditLogs() {
  return inMemoryAuditLogs;
}

function clearInMemoryAuditLogs() {
  inMemoryAuditLogs.length = 0;
}

async function closeMongo() {
  if (client) {
    try {
      await client.close();
    } catch (e) {
      // ignore
    }
    client = null;
    db = null;
    auditCollection = null;
    isConnected = false;
  }
}

module.exports = {
  connectMongo,
  getAuditCollection,
  setAuditCollection,
  getInMemoryAuditLogs,
  clearInMemoryAuditLogs,
  closeMongo
};
