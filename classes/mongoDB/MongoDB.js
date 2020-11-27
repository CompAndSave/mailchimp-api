const MongoDBOps = require('mongodb-ops');
const connString = process.env.SANDBOX === "false" ? process.env.CONN_STRING : process.env.SANDBOX_CONN_STRING;

class MongoDB extends MongoDBOps {
  constructor(collectionName) {
    super(connString);
    this.collectionName = collectionName;
  }

  static async getDataByID(collectionName, id, site, projection) {
    let queryFilter = { _id:id };
    if (site) { queryFilter.site = site; }

    return Promise.resolve(await MongoDBOps.getData(collectionName, queryFilter, false, projection, undefined, undefined, undefined, connString));
  }

  async getDataByID(id, site, projection) { return Promise.resolve(await MongoDB.getDataByID(this.collectionName, id, site, projection)); }

  static async getDataBySku(collectionName, sku, site, projection) {
    let queryFilter = { sku:sku };
    if (site) { queryFilter.site = site; }

    return Promise.resolve(await MongoDBOps.getData(collectionName, queryFilter, false, projection, undefined, undefined, undefined, connString));
  }

  async getDataBySku(sku, site, projection) { return Promise.resolve(await MongoDB.getDataBySku(this.collectionName, sku, site, projection)); }

  static async getDataByPrinterId(collectionName, printerId, site, projection) {
    let queryFilter = { printerId:printerId };
    if (site) { queryFilter.site = site; }

    return Promise.resolve(await MongoDBOps.getData(collectionName, queryFilter, false, projection, undefined, undefined, undefined, connString));
  }

  async getDataByPrinterId(printerId, site, projection) { return Promise.resolve(await MongoDB.getDataByPrinterId(this.collectionName, printerId, site, projection)); }

  static async getAllData(collectionName, site, projection, sort, pagination) {
    let queryFilter = {};
    if (site) { queryFilter.site = site; }

    return Promise.resolve(await MongoDBOps.getData(collectionName, queryFilter, false, projection, sort, pagination, false, connString));
  }

  async getAllData(site, projection, sort, pagination) { return Promise.resolve(await MongoDB.getAllData(this.collectionName, site, projection, sort, pagination)); }

  static async insertOne(collectionName, doc) { return Promise.resolve(await MongoDBOps.writeData("insertOne", collectionName, doc, undefined, connString)); }
  async insertOne(doc) { return Promise.resolve(await super.writeData("insertOne", this.collectionName, doc)); }
  static async insertBulkOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("insertBulk", collectionName, docs, true, connString)); }
  async insertBulkOrdered(docs) { return Promise.resolve(await super.writeBulkData("insertBulk", this.collectionName, docs, true)); }
  static async insertBulkUnOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("insertBulk", collectionName, docs, false, connString)); }
  async insertBulkUnOrdered(docs) { return Promise.resolve(await super.writeBulkData("insertBulk", this.collectionName, docs, false)); }

  static async replaceOne(collectionName, doc, filter) { return Promise.resolve(await MongoDBOps.writeData("replaceOne", collectionName, doc, filter, connString)); }
  async replaceOne(doc, filter) { return Promise.resolve(await super.writeData("replaceOne", this.collectionName, doc, filter)); }
  static async replaceBulkOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("replaceBulk", collectionName, docs, true, connString)); }
  async replaceBulkOrdered(docs) { return Promise.resolve(await super.writeBulkData("replaceBulk", this.collectionName, docs, true)); }
  static async replaceBulkUnOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("replaceBulk", collectionName, docs, false, connString)); }
  async replaceBulkUnOrdered(docs) { return Promise.resolve(await super.writeBulkData("replaceBulk", this.collectionName, docs, false)); }

  static async updateOne(collectionName, doc, filter) { return Promise.resolve(await MongoDBOps.writeData("updateOne", collectionName, doc, filter, connString)); }
  async updateOne(doc, filter) { return Promise.resolve(await super.writeData("updateOne", this.collectionName, doc, filter)); }
  static async updateMany(collectionName, doc, filter) { return Promise.resolve(await MongoDBOps.writeData("updateMany", collectionName, doc, filter, connString)); }
  async updateMany(doc, filter) { return Promise.resolve(await super.writeData("updateMany", this.collectionName, doc, filter)); }
  static async updateBulkOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("updateBulk", collectionName, docs, true, connString)); }
  async updateBulkOrdered(docs) { return Promise.resolve(await super.writeBulkData("updateBulk", this.collectionName, docs, true)); }
  static async updateBulkUnOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("updateBulk", collectionName, docs, false, connString)); }
  async updateBulkUnOrdered(docs) { return Promise.resolve(await super.writeBulkData("updateBulk", this.collectionName, docs, false)); }

  static async allBulkOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("allBulk", collectionName, docs, true, connString)); }
  async allBulkOrdered(docs) { return Promise.resolve(await super.writeBulkData("allBulk", this.collectionName, docs, true)); }
  static async allBulkUnOrdered(collectionName, docs) { return Promise.resolve(await MongoDBOps.writeBulkData("allBulk", collectionName, docs, false, connString)); }
  async allBulkUnOrdered(docs) { return Promise.resolve(await super.writeBulkData("allBulk", this.collectionName, docs, false)); }
}

module.exports = MongoDB;