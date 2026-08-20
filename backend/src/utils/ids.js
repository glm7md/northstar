'use strict';

const crypto = require('crypto');

function makeId() {
  return crypto.randomUUID();
}

module.exports = { makeId };
