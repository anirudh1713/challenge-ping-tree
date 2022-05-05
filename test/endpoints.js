process.env.NODE_ENV = 'test'
var TARGET_ID
var TARGET = {
  url: 'http://example.com',
  value: '0.50',
  maxAcceptsPerDay: '10',
  accept: {
    geoState: {
      $in: [
        'ca',
        'ny'
      ]
    },
    hour: {
      $in: [
        '13',
        '14',
        '15'
      ]
    }
  }
}

var test = require('ava')
var servertest = require('servertest')

var server = require('../lib/server')

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('createTarget', function (t) {
  var url = '/api/targets'
  var options = { encoding: 'json', method: 'POST' }
  var body = TARGET

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(body))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    // For later use in other APIs
    TARGET_ID = res.body.id

    t.is(res.statusCode, 201, 'correct statusCode')
    // remove id as its autogenerated and won't be available to us in advance.
    delete res.body.id
    t.deepEqual(res.body, body, 'values should match')
    t.end()
  }
})

test.serial.cb('getTargets', function (t) {
  var url = '/api/targets'
  var options = { encoding: 'json' }

  servertest(server(), url, options, onResponse)

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    // Remove id from each target before matching
    res.body.forEach(function (target) {
      delete target.id
    })
    t.deepEqual(res.body, [TARGET], 'values should match')
    t.end()
  }
})

test.serial.cb('getTargetById', function (t) {
  var url = `/api/target/${TARGET_ID}`
  var options = { encoding: 'json' }

  servertest(server(), url, options, onResponse)

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    // Remove id from target before comparing
    delete res.body.id
    t.deepEqual(res.body, TARGET, 'values should match')
    t.end()
  }
})

test.serial.cb('updateTarget', function (t) {
  var url = `/api/target/${TARGET_ID}`
  var options = { encoding: 'json', method: 'POST' }
  var body = { ...TARGET, url: 'http://example-udpated.com', maxAcceptsPerDay: '55' }

  servertest(server(), url, options, onResponse)
    .end(JSON.stringify(body))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    // Remove id from target before comparing
    delete res.body.id
    t.deepEqual(res.body, body, 'values should match')
    t.end()
  }
})
