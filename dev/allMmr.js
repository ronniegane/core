const async = require('async');
const db = require('../store/db');
const utility = require('../util/utility');
const queries = require('../store/queries');
const config = require('../config');

const { generateJob, getData } = utility;
const retrieverArr = config.RETRIEVER_HOST.split(',');
let count = 0;
const args = process.argv.slice(2);
const startId = Number(args[0]) || 0;
db.select('account_id')
  .from('players')
  .where('account_id', '>', startId)
  .orderByRaw(startId ? 'account_id asc' : 'random()')
  .asCallback((err, players) => {
    if (err) {
      process.exit(1);
    }
    async.eachLimit(players, 5, (p, cb) => {
      const job = {
        data: generateJob('mmr', {
          account_id: p.account_id,
          url: retrieverArr.map(r => `http://${r}?key=${config.RETRIEVER_SECRET}&account_id=${p.account_id}`)[p.account_id % retrieverArr.length],
        }),
      };
      getData({
        url: job.data.url,
        noRetry: true,
      }, (err, data) => {
        if (err) {
          console.error(err);
        }
        count += 1;
        console.log(count, p.account_id);
        if (data && (data.solo_competitive_rank || data.competitive_rank)) {
          console.log(data);
          data.account_id = job.data.payload.account_id;
          data.match_id = job.data.payload.match_id;
          data.time = new Date();
          queries.insertPlayerRating(db, data, cb);
        } else {
          cb();
        }
      });
    }, (err) => {
      console.log(err);
      process.exit(Number(err));
    });
  });
