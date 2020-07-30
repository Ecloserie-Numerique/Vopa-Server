$(document).ready(function () {
  /** Variables **/
  var socket = io()
  var is_admin = getCookie('is_admin')

  /** Check abilities **/
  socket.emit('is-admin', is_admin, function (role) {
    showView(role)
  })

  /** Adapts view by role **/
  function showView(role) {
    if (role === 'vopa-idle') {
      $('.login-admin').css('display', 'flex')
      return
    }

    $('.login-admin').remove()

    if (role === 'vopa-admin') {
      $('.is-admin').css('display', 'flex')
    }

    socket.emit('list-votes', function (votes) {
      renderVotes(votes.reverse())
    })
  }

  /** Admin login **/
  $('.login-form').submit(function (e) {
    e.preventDefault()
    let password = $('#login-password').val()
    socket.emit('verify-password', password, function (success) {
      if (success) {
        setCookie('is_admin', true, 1)
        $('.login-admin').remove()
        $('.is-admin').css('display', 'flex')
        socket.emit('list-votes', function (votes) {
          renderVotes(votes.reverse())
        })
      } else {
        eraseCookie('is_admin')
        iziToast.error({
          title: 'Erreur',
          message: 'Mot de passe incorrect',
          position: 'topCenter',
        })
      }
    })
  })

  /** Admin users update **/
  socket.on('update-users', function (users) {
    $('.connected-users').html(users)
    if (users < 2) {
      txt = 'utilisateur connecté.'
    } else {
      txt = 'utilisateurs connectés.'
    }
    $('.txt-users').text(txt)
  })

  /** Admin create vote **/
  $('.dashboard').submit(function (e) {
    e.preventDefault()
    vote_title = $('#vote-title').val()
    vote_duration = $('#vote-duration option:selected').val()
    vote = {
      title: vote_title,
      duration: vote_duration,
      created_at: 0,
      id: 0,
      votes: [],
    }
    socket.emit('create-vote', vote)
    $('.dashboard button').prop('disabled', true)
  })

  /** Admin delete votes */
  $('#display-results').submit(function (e) {
    e.preventDefault()

    $('#results table').empty()
    $('#results table').append(
      '<thead><tr><th>Vote</th><th>Très bien</th><th>Bien</th><th>Neutre</th><th>Mauvais</th><th>Très mauvais</th></tr></thead>'
    )

    socket.emit('ask-votes', function (votes) {
      votes.forEach(function (vote) {
        var tb = 0
        var b = 0
        var n = 0
        var m = 0
        var tm = 0

        var votes = vote.votes
        var total = votes.length
        votes.forEach(function (score) {
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

        $('#results table').append(
          '<tr><td>' +
            vote.title +
            '</td><td>' +
            tb +
            '</td><td>' +
            b +
            '</td><td>' +
            n +
            '</td><td>' +
            m +
            '</td><td>' +
            tm +
            '</td></tr>'
        )
      })
    })

    $('#results').css('display', 'flex')
  })

  /** Receive the list of votes **/
  socket.on('list-votes', function (votes) {
    $('.login-admin').remove()
    renderVotes(votes.reverse())
  })

  /** Renders votes on DOM **/
  function renderVotes(votes) {
    $('#votes-list').empty()
    $('#vote-template').tmpl(votes).appendTo('#votes-list')

    /** Timers **/
    votes.forEach((vote) => {
      attachListener(vote)
      time_end = vote.created_at + 60 * vote.duration
      var timer = setInterval(
        function (time_ref) {
          socket.emit('ask-time', function (time) {
            time_now = time
            delta = time_ref - time_now
            if (delta < 1) {
              refreshCircle(vote.id, 1, 'orangered', true)
              $('#vote-circle-' + vote.id)
                .next()
                .text('Fini.')
              clearInterval(timer)
              eraseCookie('vote_done' + vote.id)
              $('.dashboard button').prop('disabled', false)
              $('#vote').hide()
              if (is_admin) {
                saveVotes(vote.id)
              }
            } else {
              refreshCircle(
                vote.id,
                delta / (vote.duration * 60),
                'yellowgreen',
                false
              )
              $('#vote-circle-' + vote.id)
                .next()
                .text(formatTime(delta))
              $('.dashboard button').prop('disabled', true)
            }
          })
        },
        100,
        time_end
      )
    })
  }

  /** Attach listeners to votescards **/
  function attachListener(vote) {
    $('#vote-circle-' + vote.id)
      .parent()
      .click(function () {
        if (
          $('#vote-circle-' + vote.id)
            .next()
            .text() == 'Fini.'
        ) {
          /** Afficher résultat */
          socket.emit('get-votes', vote.id, function (votes) {
            $('#result-tb').css('display', 'flex')
            $('#result-b').css('display', 'flex')
            $('#result-n').css('display', 'flex')
            $('#result-m').css('display', 'flex')
            $('#result-tm').css('display', 'flex')

            var tb = 0
            var b = 0
            var n = 0
            var m = 0
            var tm = 0

            var total = votes.length
            votes.forEach(function (score) {
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
            var height = $('.result-graph').height()
            console.log(height)
            console.log(tb + ':' + b + ':' + n + ':' + m + ':' + tm)
            var tbpct = Math.floor((tb * 100) / total)
            var bpct = Math.floor((b * 100) / total)
            var npct = Math.floor((n * 100) / total)
            var mpct = Math.floor((m * 100) / total)
            var tmpct = Math.floor((tm * 100) / total)

            if (tb <= 0) $('#result-tb').hide()
            if (b <= 0) $('#result-b').hide()
            if (n <= 0) $('#result-n').hide()
            if (m <= 0) $('#result-m').hide()
            if (tm <= 0) $('#result-tm').hide()

            $('#result-tb')
              .height((height / total) * tb)
              .html('<p>Très bien (' + tbpct + '%)</p>')
            $('#result-b')
              .height((height / total) * b)
              .html('<p>Bien (' + bpct + '%)</p>')
            $('#result-n')
              .height((height / total) * n)
              .html('<p>Neutre (' + npct + '%)</p>')
            $('#result-m')
              .height((height / total) * m)
              .html('<p>Mauvais (' + mpct + '%)</p>')
            $('#result-tm')
              .height((height / total) * tm)
              .html('<p>Très mauvais (' + tmpct + '%)</p>')

            $('#result h1').text(vote.title)
            $('#result').css('display', 'flex')
          })
        } else {
          /**  Voter **/
          voted = getCookie('vote_done' + vote.id)
          if (voted) {
            iziToast.error({
              title: 'Erreur',
              message: 'Vous avez déjà voté.',
              position: 'topCenter',
            })
          } else {
            $('#vote h1').text(vote.title)
            $('#vote').css('display', 'flex')
            $('#submit-vote').submit(function (e) {
              e.preventDefault()
              submit = {
                value: $('input[name=vote-value]:checked').val(),
                id: vote.id,
              }
              socket.emit('submit-vote', submit)
              setCookie('vote_done' + vote.id, true, 1)
              $('#vote').hide()
              $('input[name=vote-value]').each(function () {
                $(this).prop('checked', false)
              })
              $('#submit-vote').off()
            })
          }
        }
      })
  }

  /** Close Results Button */
  $('.result-footer button').click(function () {
    $('#result').hide()
  })
  $('.results-footer button').click(function () {
    $('#results').hide()
  })

  /** Animate votes timers **/
  function refreshCircle(id, value, color, animation) {
    $('#vote-circle-' + id).circleProgress({
      startAngle: (3 * Math.PI) / 2,
      lineCap: 'round',
      thikness: 6,
      value: value,
      size: 80,
      fill: {
        color: color,
      },
      animation: animation,
    })
  }

  /** Return time in "0m0s" format */
  function formatTime(time) {
    if (time > 60) {
      minutes = Math.floor(time / 60)
      seconds = time - minutes * 60
      time = minutes + 'm' + seconds + 's'
    } else {
      time = time + 's'
    }
    return time
  }

  /** Admin Disconnect */
  $('#exit').click(function () {
    eraseCookie('is_admin')
    eraseCookie('user_voted')
    socket.emit('admin-exit')
  })

  /** Window Reload */
  socket.on('reload', function () {
    document.location.reload()
  })

  /** Cookies **/
  function setCookie(name, value, days) {
    var expires = ''
    if (days) {
      var date = new Date()
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
      expires = '; expires=' + date.toUTCString()
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/'
  }
  function getCookie(name) {
    var nameEQ = name + '='
    var ca = document.cookie.split(';')
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i]
      while (c.charAt(0) == ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length)
    }
    return null
  }
  function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;'
  }

  /** Save votes to file **/
  function saveVotes(id) {
    socket.emit('save-votes', id)
  }
})
