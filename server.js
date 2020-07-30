/** Required **/
var express = require('express')
var sassMiddleware = require('node-sass-middleware')
var path = require('path')
var app = express()
var http = require('http').createServer(app)
var io = require('socket.io')(http)
var dotenv = require('dotenv').config({ path: __dirname + '/.env' })
var md5 = require('js-md5')

/** Environment variables **/
const port = process.env.PORT || 3000
const admin_password = process.env.ADMIN_PASSWORD

/** Application variables **/
var admin = ''
var users = []
var votes = []
var id = 0

/** Sass compiler **/
app.use(
  '/css',
  sassMiddleware({
    /* options */
    src: path.join(__dirname, 'public/css'),
    dest: path.join(__dirname, 'public/css'),
    outputStyle: 'compressed',
  })
)

/** Vendors **/
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist'))
app.use(
  '/jquery-templates',
  express.static(__dirname + '/node_modules/jquery-templates')
)
app.use(
  '/jquery-circle-progress',
  express.static(__dirname + '/node_modules/jquery-circle-progress/dist')
)
app.use('/izitoast', express.static(__dirname + '/node_modules/izitoast/dist'))
app.use(express.static(__dirname + '/public'))

/** Router **/
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

/** WebSockets **/
io.on('connection', function (socket) {
  /** Update Users on Connect / Disconnect **/
  users.push(socket.id)
  io.emit('update-users', users.length - 1)

  socket.on('disconnect', function () {
    index = users.indexOf(socket.id)
    users.splice(index, 1)
    io.emit('update-users', users.length - 1)
  })

  /** Admin verification **/
  socket.on('verify-password', function (password, callback) {
    hash_password = md5(password)
    if (hash_password == admin_password) {
      admin = socket.id
      callback(true)
    } else {
      admin = ''
      callback(false)
    }
  })

  /** Admin create vote **/
  socket.on('create-vote', function (vote) {
    vote.id = id
    vote.created_at = Math.round(new Date().getTime() / 1000)
    vote.votes = []
    votes.push(vote)
    id++
    io.emit('list-votes', votes)
  })
  socket.on('ask-time', function (callback) {
    return callback(Math.round(new Date().getTime() / 1000))
  })
  /** Admin delete votes **/
  socket.on('delete-votes', function () {
    id = 0
    votes = []
    io.emit('list-votes', votes)
  })

  /** Return votes list **/
  socket.on('list-votes', function () {
    io.emit('list-votes', votes)
  })
  socket.on('ask-votes', function (callback) {
    return callback(votes)
  })

  /** Vote is bumitted **/
  socket.on('submit-vote', function (submit) {
    index = votes.findIndex((vote) => vote.id == submit.id)
    vote = votes[index]
    vote.votes.push(submit.value)
  })

  /** Returns values of vote (vote.votes[]) **/
  socket.on('get-votes', function (id, callback) {
    index = votes.findIndex((vote) => vote.id == id)
    vote = votes[index]
    callback(vote.votes)
  })

  /** Check abilities **/
  socket.on('is-admin', function (is_admin, callback) {
    if (is_admin) {
      admin = is_admin
      callback('vopa-admin')
    } else {
      if (admin != '') {
        callback('vopa-user')
      }
      callback('vopa-idle')
    }
  })

  /** Admin quit button **/
  socket.on('admin-exit', function () {
    admin = ''
    io.emit('reload')
  })

  /** Saves votes to file **/
  socket.on('save-votes', function (vote_id) {
    if (vote_id !== id - 1) {
      return
    }

    var votes_tosave = []
    votes.forEach(function (vote) {
      var tb = 0
      var b = 0
      var n = 0
      var m = 0
      var tm = 0
      var total = 0

      scores = vote.votes
      total = scores.length
      scores.forEach(function (score) {
        switch (score) {
          case 'tb':
            tb++
            break
          case 'b':
            b++
            break
          case 'n':
            n++
            break
          case 'm':
            m++
            break
          case 'tm':
            tm++
            break
        }
      })

      tbpct = Math.floor((tb * 100) / total)
      bpct = Math.floor((b * 100) / total)
      npct = Math.floor((n * 100) / total)
      mpct = Math.floor((m * 100) / total)
      tmpct = Math.floor((tm * 100) / total)

      vote_to_save = {
        titre: vote.title,
        tres_bien: tbpct,
        bien: bpct,
        neutre: npct,
        mauvais: mpct,
        tres_mauvais: tmpct,
      }
      votes_tosave.push(vote_to_save)
    })

    var fs = require('fs')
    fs.writeFile(
      path.join(__dirname, '/') + 'votes.json',
      JSON.stringify(votes_tosave),
      function (err) {
        if (err) throw err
        console.log('File saved.')
      }
    )
  })
})

/** Http server **/
http.listen(port, function () {
  console.log(`Listening on *:${port}`)
})
