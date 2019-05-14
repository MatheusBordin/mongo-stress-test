# mongo-stress-test
Execute mongo stress test

## tests
All tests are executed using mongo connection pool = 15.

- Insertion documents in parallel (concurrency = 25000).
- Find all documents.
- Find ordered by date (whitout index).
- Find all ordered by date (with index).
- Find populated (mongoose).
- Find by subdoc where clause.
- Find using text regex.
- Find with aggregation ($SUM).
- Find parallel (10.000).

## results
All results can be found in `/results` folder.

#### Schema
The format of results is JSON, your schema is:
```json
{
  "<test_key>": {
    "duration": "Number",
    "req_per_sec": "Number",
    "result": "[MongoDBExplain]"
  }
}
```

**duration** is the execution duration in seconds (Application level).
**req_per_sec** is the count of requests executed per seconds (Application level).
**result** is the explain object returned by MongoDB.

## execution
For execute the test, create your `.env` (use `.env-example` as schema) and run: 
```sh
node index.js
```
