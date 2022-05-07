var cuid = require('cuid')
var sendJson = require('send-data/json')
var jsonBody = require('body/json')

var redis = require('./redis')

module.exports = {
  create,
  getAll,
  getUnique,
  update
}

// * redis calls can be outsourced and reused by using a service layer.

function create (req, res, opts, cb) {
  // TODO - validate incoming request body.
  jsonBody(req, res, function (err, payload) {
    if (err) return cb(err)

    var targetId = cuid()
    var target = { id: targetId, ...payload }

    redis.set(`target:${targetId}`, JSON.stringify(target), function (err) {
      if (err) return cb(err)

      res.statusCode = 201
      sendJson(req, res, target)
    })
  })
}

function getAll (req, res, opts, cb) {
  redis.keys('target:*', function (err, keys) {
    if (err) return cb(err)

    if (keys.length === 0) return sendJson(req, res, [])

    redis.mget(keys, function (err, targets) {
      if (err) return cb(err)

      var parsedTargets = targets.map(function (target) {
        return JSON.parse(target)
      })

      sendJson(req, res, parsedTargets)
    })
  })
}

/**
 * Get target by id
 */
function getUnique (req, res, opts, cb) {
  var targetId = opts.params.id

  redis.get(`target:${targetId}`, function (err, target) {
    if (err) return cb(err)

    if (!target) {
      res.writeHead(204)
      return res.end()
    }

    var parsedTarget = JSON.parse(target)

    sendJson(req, res, parsedTarget)
  })
}

function update (req, res, opts, cb) {
  // TODO - validate incoming request body.
  var targetId = opts.params.id

  jsonBody(req, function (err, payload) {
    if (err) return cb(err)

    redis.get(`target:${targetId}`, function (err, target) {
      if (err) return cb(err)
      if (!target) {
        res.writeHead(204)
        return res.end()
      }

      var parsedTarget = JSON.parse(target)
      var updatedTarget = { ...parsedTarget, ...payload, id: targetId }

      redis.set(`target:${targetId}`, JSON.stringify(updatedTarget), function (err) {
        if (err) return cb(err)

        sendJson(req, res, updatedTarget)
      })
    })
  })
}
