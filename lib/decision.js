var redis = require('./redis')
var jsonBody = require('body/json')
var { format, utcToZonedTime } = require('date-fns-tz')
const sendJson = require('send-data/json')

module.exports = makeDecision

function getTargets (cb) {
  redis.keys('target:*', function (keyError, keys) {
    if (keyError) return cb(keyError)

    if (keys.length === 0) return cb(null, [])

    redis.mget(keys, function (targetsError, targets) {
      if (targetsError) return cb(targetsError)

      var parsedTargets = targets.map(function (target) {
        return JSON.parse(target)
      })

      return cb(null, parsedTargets)
    })
  })
}

function filterTargets (visitor, targets, traffic) {
  var geoState = visitor.geoState
  var date = format(utcToZonedTime(new Date(visitor.timestamp), 'UTC'), 'MM-dd-yyyy')
  var hour = format(utcToZonedTime(new Date(visitor.timestamp), 'UTC'), 'HH')

  var filteredTargets = targets.filter(function (target) {
    var isInValidHour = target.accept.hour.$in.includes(hour)
    var isInValidState = target.accept.geoState.$in.includes(geoState)

    // Filter targets based on traffic (can be accepted or not)
    var trafficKey = `${target.id}:${date}`
    var currentTargetTraffic = 0
    if (traffic && traffic[trafficKey]) {
      currentTargetTraffic = Number(traffic[trafficKey])
    }
    // Attach current traffic so we can update hash later.
    target.currentTrafficKey = trafficKey
    target.currentTraffic = currentTargetTraffic

    return isInValidHour && isInValidState && currentTargetTraffic < Number(target.maxAcceptsPerDay)
  })

  return filteredTargets
}

function makeDecision (req, res, opts, cb) {
  // TODO - validate incoming request body.
  jsonBody(req, function (parsingError, payload) {
    if (parsingError) return cb(parsingError)

    getTargets(function (error, targets) {
      if (error) return cb(error)

      // Get all traffic for each target
      redis.hgetall('traffic', function (trafficError, traffic) {
        if (trafficError) return cb(trafficError)

        // Filter targets based on the conditions defined in readme
        var filteredTargets = filterTargets(payload, targets, traffic)

        // Get the highest value target.
        var target = filteredTargets.sort(function (a, b) {
          return Number(b.value) - Number(a.value)
        })[0]

        if (!target) {
          res.writeHead(204)
          return res.end()
        }

        // Increment traffic for that target on that day.
        redis.hset('traffic', target.currentTrafficKey, target.currentTraffic + 1)

        sendJson(req, res, { url: target.url })
      })
    })
  })
}
