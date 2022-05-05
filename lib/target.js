var cuid = require('cuid')
var sendJson = require('send-data/json')
var jsonBody = require('body/json')

var redis = require('./redis')

module.exports = {
  createTarget
}

function createTarget (req, res, opts, cb) {
  // TODO - validate incoming request body.
  jsonBody(req, res, function (err, payload) {
    if (err) return cb(err)

    var targetId = cuid()
    var target = { id: targetId, ...payload }

    redis.set(`target:${targetId}`, JSON.stringify(target), function (error) {
      if (error) return cb(error)

      res.statusCode = 201
      sendJson(req, res, target)
    })
  })
}
