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

    // Test each.
    for (const count of tests) {      
      const {idx, total} = getTotal(count, tests);

      console.log(chalk`{blue Start} test with ${total} documents`);

      // Create file results
      Result.init(`${key}-${total}`);

      const find = await Performance(async () => await findAll(total));
      Result.saveResult(`find`, find);
  
      const findOrdered = await Performance(async () => await findAllOrdered(total));
      Result.saveResult(`find-ordered`, findOrdered);
  
      const findOrderedWithIndex = await Performance(async () => await findAllOrderedIndexed(total));
      Result.saveResult(`find-ordered`, findOrderedWithIndex);
  
      const findPopulate = await Performance(async () => await findPopulated(total));
      Result.saveResult(`find-populate`, findPopulate);
  
      const findSubdocs = await Performance(async () => await findBySubdocs(total));
      Result.saveResult(`find-subdocs`, findSubdocs);

      const findWithRegex = await Performance(async () => await findByRegex(total));
      Result.saveResult(`find-regex`, async () => await findWithRegex(total));

      const findWithAgg = await Performance(async () => await findByAgg(total));
      Result.saveResult(`find-agg`, findWithAgg);

      const findParallel = await Performance(async () => await findInParallel(total), 10000);
      Result.saveResult(`find-parallel`, findParallel);

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
function findAll(total) {
  let i = 0;
  return new Promise((res) => {
    Tree.find().limit(total).cursor().on('data', () => {
      i++;
      console.log(`processing: ${i}`)
    }).on('end', res);
  });
}

/**
 * Find all ordered.
 *
 * @returns
 */
function findAllOrdered(total) {
  return new Promise((res) => {
    Tree.find().limit(total).sort({ 'time': -1 }).cursor().on('data', () => console.log(`processing: ${total}`)).on('end', res);
  });
}

/**
 * Find all ordered using index.
 *
 * @returns
 */
function findAllOrderedIndexed(total) {
  return new Promise((res) => {
    Tree.find().limit(total).sort({ 'createdAt': -1 }).cursor().on('data', () => console.log(`processing: ${total}`)).on('end', res);
  });
}

/**
 * Find documents and populate
 *
 * @returns
 */
function findPopulated(total) {
  return new Promise((res) => {
    Tree.find().limit(total).populate('user').cursor().on('data', () => console.log(`processing: ${total}`)).on('end', res);
  });
}

/**
 * Find by subdocs rule.
 *
 * @returns
 */
function findBySubdocs(total) {
  return new Promise((res) => {
    Tree.find({
      'components': {
        $elemMatch: { type: 'four' }
      }
    }).limit(total).cursor().on('data', () => console.log(`processing: ${total}`)).on('end', res);
  });
}

/**
 * Find using text regex.
 *
 * @returns
 */
function findByRegex(total) {
  return new Promise((res) => {
    Tree.find({
      'name': {
        $regex: 'test'
      }
    }).limit(total).cursor().on('data', () => console.log(`processing: ${total}`)).on('end', res);
  });
}

/**
 * Find using aggregation.
 *
 * @returns
 */
async function findByAgg(total) {
  await Tree.aggregate().limit(total).group({
    _id : null,
    total : {
      $sum : "$value"
    }
  });
}

/**
 * Find 10.000 in parallel.
 *
 * @returns
 */
async function findInParallel(total) {
  const p = Parallel.create(
    (i) => {
      return new Promise((res) => {
        Tree.find({
          name: {
            $regex: `test`
          }
        }).limit(total).cursor().on('data', () => console.log(`processing: ${total}`)).on('end', res);
      });
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

