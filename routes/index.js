var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const resHandler = require('../services/resHandler');

// GET /
router.get('/', asyncHandler(async (req, res, next) => {
  let resJSON = {
    test:"test done"
  };

  await resHandler.handleRes(req, res, next, 200, resJSON);
}));

module.exports = router;