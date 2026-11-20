const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/equiprent_db';

let db = null;
let client = null;

// Resilient In-Memory Storage for smooth offline testing / demo fallback
const inMemoryCollections = {
  users: [],
  equipment: [],
  favorites: [],
  bookings: [],
  payments: [],
  reviews: []
};

class MemoryCollection {
  constructor(name) {
    this.name = name;
  }

  get items() {
    return inMemoryCollections[this.name] || [];
  }

  set items(val) {
    inMemoryCollections[this.name] = val;
  }

  async find(query = {}) {
    let filtered = this.items.filter(item => {
      for (const [key, val] of Object.entries(query)) {
        if (key === '_id') {
          if (String(item._id) !== String(val)) return false;
        } else if (val && typeof val === 'object' && val.$in) {
          if (!val.$in.includes(item[key])) return false;
        } else if (val && typeof val === 'object' && val.$regex) {
          const reg = new RegExp(val.$regex, val.$options || '');
          if (!reg.test(item[key] || '')) return false;
        } else if (val && typeof val === 'object' && (val.$gte !== undefined || val.$lte !== undefined)) {
          const num = Number(item[key]);
          if (val.$gte !== undefined && num < Number(val.$gte)) return false;
          if (val.$lte !== undefined && num > Number(val.$lte)) return false;
        } else if (val && typeof val === 'object' && val.$gt !== undefined) {
          const num = Number(item[key]);
          if (num <= Number(val.$gt)) return false;
        } else if (item[key] !== val) {
          return false;
        }
      }
      return true;
    });

    let sortFn = null;
    let limitVal = null;
    let skipVal = 0;

    const cursor = {
      sort(criteria) {
        sortFn = criteria;
        return cursor;
      },
      skip(s) {
        skipVal = s;
        return cursor;
      },
      limit(l) {
        limitVal = l;
        return cursor;
      },
      async toArray() {
        let result = [...filtered];
        if (sortFn) {
          const [key, dir] = Object.entries(sortFn)[0];
          result.sort((a, b) => {
            if (dir === -1) return (b[key] > a[key] ? 1 : -1);
            return (a[key] > b[key] ? 1 : -1);
          });
        }
        if (skipVal) {
          result = result.slice(skipVal);
        }
        if (limitVal) {
          result = result.slice(0, limitVal);
        }
        return result;
      },
      async countDocuments() {
        return filtered.length;
      }
    };
    return cursor;
  }

  async findOne(query = {}) {
    const list = await (await this.find(query)).toArray();
    return list[0] || null;
  }

  async insertOne(doc) {
    const newDoc = {
      _id: doc._id || new ObjectId().toString(),
      createdAt: new Date().toISOString(),
      ...doc
    };
    this.items.push(newDoc);
    return { insertedId: newDoc._id, acknowledged: true };
  }

  async insertMany(docs) {
    const inserted = docs.map(doc => ({
      _id: doc._id || new ObjectId().toString(),
      createdAt: new Date().toISOString(),
      ...doc
    }));
    this.items.push(...inserted);
    return { insertedCount: inserted.length, insertedIds: inserted.map(d => d._id), acknowledged: true };
  }

  async updateOne(filter, update) {
    const item = await this.findOne(filter);
    if (!item) return { matchedCount: 0, modifiedCount: 0 };

    if (update.$set) {
      Object.assign(item, update.$set, { updatedAt: new Date().toISOString() });
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        item[k] = (Number(item[k]) || 0) + Number(v);
      }
    }
    return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
  }

  async deleteOne(filter) {
    const prevLen = this.items.length;
    this.items = this.items.filter(item => {
      for (const [key, val] of Object.entries(filter)) {
        if (key === '_id' && String(item._id) === String(val)) return false;
        if (item[key] === val) return false;
      }
      return true;
    });
    const deletedCount = prevLen - this.items.length;
    return { deletedCount, acknowledged: true };
  }

  async countDocuments(query = {}) {
    const list = await (await this.find(query)).toArray();
    return list.length;
  }
}

async function connectDB() {
  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 2500
    });
    await client.connect();
    db = client.db();
    console.log(' Successfully connected to MongoDB database!');
  } catch (err) {
    console.warn('⚠️ MongoDB connection could not be established or timed out:', err.message);
    console.log(' Switched to In-Memory Resilient DB Mode for seamless local execution.');
    db = {
      collection: (name) => new MemoryCollection(name)
    };
  }
  return db;
}

function getDB() {
  if (!db) {
    return {
      collection: (name) => new MemoryCollection(name)
    };
  }
  return db;
}

module.exports = { connectDB, getDB, ObjectId };
