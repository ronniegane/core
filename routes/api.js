const express = require('express');
const playerFields = require('./playerFields');
const filterDeps = require('../util/filterDeps');
const config = require('../config');
const spec = require('./spec');
const cacheFunctions = require('../store/cacheFunctions');

const api = new express.Router();
const { subkeys } = playerFields;

const admins = config.ADMIN_ACCOUNT_IDS.split(',').map(e => Number(e));

// Player caches middleware
api.use('/players/:account_id/:info?', (req, res, cb) => {
  // Check cache
  if (!Object.keys(req.query).length && req.params.info) {
    return cacheFunctions.read({
      key: req.params.info,
      account_id: req.params.account_id,
    }, (err, result) => {
      if (err) {
        console.error(err);
      }
      if (result) {
        // console.log('[READCACHEHIT] %s', req.originalUrl);
        try {
          return res.json(JSON.parse(result));
        } catch (e) {
          console.error(e);
          return cb();
        }
      }
      // console.log('[READCACHEMISS] %s', req.originalUrl);
      return cb();
    });
  }
  return cb();
});

// Player endpoints middleware
api.use('/players/:account_id/:info?', (req, res, cb) => {
  if (Number.isNaN(Number(req.params.account_id))) {
    return cb('invalid account_id');
  }
  req.originalQuery = JSON.parse(JSON.stringify(req.query));
  // Enable significance filter by default, disable it if 0 is passed
  if (req.query.significant === '0') {
    delete req.query.significant;
  } else {
    req.query.significant = 1;
  }
  let filterCols = [];
  Object.keys(req.query).forEach((key) => {
    // numberify and arrayify everything in query
    req.query[key] = [].concat(req.query[key]).map(e => (Number.isNaN(Number(e)) ? e : Number(e)));
    // build array of required projections due to filters
    filterCols = filterCols.concat(filterDeps[key] || []);
  });
  req.queryObj = {
    project: ['match_id', 'player_slot', 'radiant_win'].concat(filterCols).concat((req.query.sort || []).filter(f => subkeys[f])),
    filter: req.query || {},
    sort: req.query.sort,
    limit: Number(req.query.limit),
    offset: Number(req.query.offset),
    having: Number(req.query.having),
  };
  return cb();
});

// Admin endpoints middleware
api.use('/admin*', (req, res, cb) => {
  if (req.user && admins.includes(req.user.account_id)) {
    return cb();
  }

  return res.status(403).json({
    error: 'Access Denied',
  });
});

// API spec
api.get('/', (req, res) => {
  res.json(spec);
});

// API endpoints
Object.keys(spec.paths).forEach((path) => {
  Object.keys(spec.paths[path]).forEach((verb) => {
    const {
      route,
      func,
    } = spec.paths[path][verb];
    api[verb](route(), func);
  });
});

module.exports = api;
