const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'express-rate-limit') {
    return () => (_req, _res, next) => next();
  }
  return originalLoad.apply(this, arguments);
};

const admin = require('../webapp/server/node_modules/firebase-admin');
admin.apps = [];

require('../webapp/server/index.js');
