require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const chalk = require('chalk');

// Models
const Tree = require('./models/tree');
const treeObj = require('./objects/tree.json');

// Utils
const Result = require('./utils/result');
const Parallel = require('./utils/parallel');

// Config
const mongoPoolSize = parseInt(process.env.MONGO_POOL_SIZE);
const concurrency = parseInt(process.env.TEST_INSERT_CONCURRENCY);
const tests = process.env.TEST_RANGES.split(',').map(x => parseInt(x));

/**
 * Initialize test
 *
 * @param {String} key Test key.
 * @param {String} URI Mongo connection URI.
 */
async function InitTest(key, URI) {
  try {
    // Time
    const initTime = new Date().getTime();

    // Initialize.
    await createConnection(URI);
    console.log(chalk`{blue Start} collection drop`);
    await Tree.collection.drop();
    console.log(chalk`{green Finish} collection drop\n`);

    // Test each.
    for (const count of tests) {      
      const {idx, total} = getTotal(count, tests);

      console.log(chalk`{blue Start} test with ${total} documents`);

      // Create file results
      Result.init(`${key}-${total}`);

      const insert = await Performance(async () => await insertMany(count * idx, count), count);
      Result.saveResult(`insert-${count}`, insert);
  
      const find = await Performance(findAll);
      Result.saveResult(`find-${total}`, find);
  
      const findOrdered = await Performance(findAllOrdered);
      Result.saveResult(`find-ordered-${total}`, findOrdered);
  
      const findOrderedWithIndex = await Performance(findAllOrderedIndexed);
      Result.saveResult(`find-ordered-indexed-${total}`, findOrderedWithIndex);
  
      const findPopulate = await Performance(findPopulated);
      Result.saveResult(`find-populate-${total}`, findPopulate);
  
      const findSubdocs = await Performance(findBySubdocs);
      Result.saveResult(`find-subdocs-${total}`, findSubdocs);

      const findWithRegex = await Performance(findByRegex);
      Result.saveResult(`find-regex-${total}`, findWithRegex);

      const findWithAgg = await Performance(findByAgg);
      Result.saveResult(`find-agg-${total}`, findWithAgg);

      const findParallel = await Performance(findInParallel, 10000);
      Result.saveResult(`find-parallel-${total}`, findParallel);

      console.log(chalk`{green Finish} test with ${total} documents\n`);
    }

    const endTime = new Date().getTime();
    Result.saveResult(`all-tests`, {
      duration: (endTime - initTime) / 1000
    });

    console.log(chalk`{cyan Finish} all tests, waiting dispose...\n`);
  } catch (e) {
    console.log(chalk`{red Error} on running the task: \n`, e);
    process.exit(1);
  }
}

/**
 * Create mongo connection.
 *
 * @param {*} URI
 */
async function createConnection(URI) {
  const hasCert = !!process.env.MONGO_CERT;
  const options = { 
    useNewUrlParser: true, 
    useCreateIndex: true, 
    poolSize: mongoPoolSize
  };

  if (hasCert) {
    const certPath = path.join(__dirname, process.env.MONGO_CERT);
    options.ssl = true;
    options.sslValidate = false;
    options.sslCA = fs.readFileSync(certPath);
  }

  try {
    await mongoose.connect(URI, options);
    console.log(chalk`Mongo connected {green successfuly}\n`);
  } catch (e) {
    throw new Error(`Error on start connection with Mongo, URI: ${URI}, err: ${e}`);
  }
}

function getTotal(count, tests) {
  let idx = tests.indexOf(count);
  let total = 0;

  while (idx >= 0) {
    total += tests[idx];
    idx--;
  }

  return { idx, total };
}

/**
 * Insert many documents.
 *
 * @param {number} start Start index
 * @param {number} count End index
 * @param {string} [user='5cd99e130c21524ec39ab60f'] User for populate
 * @returns
 */
async function insertMany(start, count, user = process.env.USER_ID) {
  const par = Parallel.create(
    async (i) => {
      const tree = new Tree({
        ...treeObj,
        user,
        name: `teste-${start + i}`,
        time: new Date(),
        value: 1
      });
  
      await tree.save();
    }, 
    count, 
    concurrency
  );

  await par.waitFinish();

  return null;
}

/**
 * Find all documents.
 *
 * @returns
 */
async function findAll() {
  return await Tree.find().explain();
}

/**
 * Find all ordered.
 *
 * @returns
 */
async function findAllOrdered() {
  return await Tree.find().sort({ 'time': -1 }).explain();
}

/**
 * Find all ordered using index.
 *
 * @returns
 */
async function findAllOrderedIndexed() {
  return await Tree.find().sort({ 'createdAt': -1 }).explain();
}

/**
 * Find documents and populate
 *
 * @returns
 */
async function findPopulated() {
  return await Tree.find().populate('user').explain();
}

/**
 * Find by subdocs rule.
 *
 * @returns
 */
async function findBySubdocs() {
  return await Tree.find({
    'components': {
      $elemMatch: { type: 'four' }
    }
  }).explain();
}

/**
 * Find using text regex.
 *
 * @returns
 */
async function findByRegex() {
  return await Tree.find({
    'name': {
      $regex: 'test'
    }
  }).explain();
}

/**
 * Find using aggregation.
 *
 * @returns
 */
async function findByAgg() {
  return await Tree.aggregate([
    {
      $group : {
        _id : null,
        total : {
            $sum : "$value"
        }
      }
    }
  ]).explain();
}

/**
 * Find 10.000 in parallel.
 *
 * @returns
 */
async function findInParallel() {
  const p = Parallel.create(
    async (i) => {
      await Tree.find({
        name: {
          $regex: `test${i}`
        }
      }).explain();
    },
    1000,
    1000
  );

  await p.waitFinish();
  return null;
}

/**
 * Listen function performance.
 *
 * @param {Function} fn
 * @param {number} [req=1]
 * @returns
 */
async function Performance(fn, req = 1) {
  const initTime = new Date().getTime();
  const exec = fn();
  let result = exec;

  if (exec instanceof Promise) {
    result = await exec;    
  }

  const endTime = new Date().getTime();
  const duration = (endTime - initTime) / 1000;

  return {
    result,
    duration,
    req_per_sec: req / duration,
  };
}

InitTest(process.env.KEY, process.env.MONGO_URI);

