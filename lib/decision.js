var jsonBody = require('body/json')
var { format, utcToZonedTime } = require('date-fns-tz')
var sendJson = require('send-data/json')

var redis = require('./redis')

module.exports = makeDecision

function makeDecision (req, res, opts, cb) {
  // TODO - validate incoming request body.
  jsonBody(req, function (err, visitor) {
    if (err) return cb(err)

    getTargets(function (err, targets) {
      if (err) return cb(err)

      // Get all traffic for each target
      redis.hgetall('traffic', function (err, traffic) {
        if (err) return cb(err)

        // Filter targets based on the conditions defined in readme
        var filteredTargets = filterTargets(visitor, targets, traffic)

        // Get the highest value target.
        var target = filteredTargets.sort(function (a, b) {
          return Number(b.value) - Number(a.value)
        })[0]

        if (!target) {
          res.writeHead(204)
          return res.end()
        }

        var currentTargetTraffic = targetTraffic(target.id, visitor.timestamp, traffic)
        var currentTrafficKey = trafficKey(target.id, visitor.timestamp)

        // Increment traffic for that target on that day.
        redis.hset('traffic', currentTrafficKey, currentTargetTraffic + 1)

        sendJson(req, res, { url: target.url })
      })
    })
  })
}

function getTargets (cb) {
  redis.keys('target:*', function (err, keys) {
    if (err) return cb(err)

    if (keys.length === 0) return cb(null, [])

    redis.mget(keys, function (err, targets) {
      if (err) return cb(err)

      var parsedTargets = targets.map(function (target) {
        return JSON.parse(target)
      })

      return cb(null, parsedTargets)
    })
  })
}

function filterTargets (visitor, targets, traffic) {
  var geoState = visitor.geoState
  var hour = format(utcToZonedTime(new Date(visitor.timestamp), 'UTC'), 'HH')

  var filteredTargets = targets.filter(function (target) {
    var isInValidHour = target.accept.hour.$in.includes(hour)
    var isInValidState = target.accept.geoState.$in.includes(geoState)

    var currentTargetTraffic = targetTraffic(target.id, visitor.timestamp, traffic)

    return isInValidHour && isInValidState && currentTargetTraffic < Number(target.maxAcceptsPerDay)
  })

  return filteredTargets
}

function targetTraffic (targetId, visitorTimestamp, traffic) {
  var currentTargetTrafficKey = trafficKey(targetId, visitorTimestamp)
  var currentTargetTraffic = 0
  if (traffic && traffic[currentTargetTrafficKey]) {
    currentTargetTraffic = Number(traffic[currentTargetTrafficKey])
  }

  return currentTargetTraffic
}

function trafficKey (targetId, visitorTimestamp) {
  var date = format(utcToZonedTime(new Date(visitorTimestamp), 'UTC'), 'MM-dd-yyyy')

  return `${targetId}:${date}`
}
