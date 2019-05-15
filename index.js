require('dotenv').config();
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

      const insert = await Performance(async () => await insertMany(count * idx, count));
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

    // Finish tests.
    await mongoose.disconnect();
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
  try {
    await mongoose.connect(URI, { useNewUrlParser: true, useCreateIndex: true, poolSize: mongoPoolSize });
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
async function insertMany(start, count, user = '5cd99e130c21524ec39ab60f') {
  const par = Parallel.create(
    async (i) => {
      console.log(`Index: ${i}`);
      const tree = new Tree({
        ...treeObj,
        user,
        name: `teste-${start + i}`,
        time: new Date(),
        value: start + i
      });
  
      await tree.save();
      console.log(`Finish: ${i}`);
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
  return await Tree.find().explain('executionStats');
}

/**
 * Find all ordered.
 *
 * @returns
 */
async function findAllOrdered() {
  return await Tree.find().sort({ 'time': -1 }).explain('executionStats');
}

/**
 * Find all ordered using index.
 *
 * @returns
 */
async function findAllOrderedIndexed() {
  return await Tree.find().sort({ 'createdAt': -1 }).explain('executionStats');
}

/**
 * Find documents and populate
 *
 * @returns
 */
async function findPopulated() {
  return await Tree.find().populate('user').explain('executionStats');
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
  }).explain('executionStats');
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
  }).explain('executionStats');
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
  ]).explain('executionStats');
}

/**
 * Find 10.000 in parallel.
 *
 * @returns
 */
async function findInParallel() {
  const processes = Array.from(new Array(10000), (item, index) => {
    return Tree.find().skip(index).limit(1);
  });

  await Promise.all(processes);
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

