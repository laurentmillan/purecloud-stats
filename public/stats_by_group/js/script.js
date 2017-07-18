/*
  Code proposé par Laurent Millan - Genesys
*/

var redirectUrl = window.location.href;

//Login
var pureCloudSession = purecloud.platform.PureCloudSession({
  strategy: 'implicit',
  clientId: '',
  redirectUrl: window.location.href,
  environment: 'mypurecloud.ie'
});

var routingapi = new purecloud.platform.RoutingApi(pureCloudSession);
var groupsapi = new purecloud.platform.GroupsApi(pureCloudSession);
var usersapi = new purecloud.platform.UsersApi(pureCloudSession);

// Liste des utilisateurs du groupe sélectionné
var _userList = [];
// Liste des queues sur lesquelles portera la requête
var _queueList = [];

$(document).ready(function() {
  // Sur sélection d'un nouveau groupe
  $('#groups').change(function(){
    $('#message').addClass('hidden');
    $('#selectedObjects').removeClass('hidden');

    // Obtient la liste des groupes
    getListOfQueues($('#groups').val(), function(res){
      $('#usersWatched').empty();
      _userList = res.userList;
      // Afficher les utilisateurs sous forme de bulle avec leur photo
      res.userList.forEach(function(user){
        $('#usersWatched').append('<img class="img-circle" style="width: 48px;margin-right: 8px;" src="'+user.images[0].imageUri+'">');
      })

      $('#queuesWatched').empty();
      _queueList = res.queueList;
      // Afficher la liste des queues sous forme de label
      res.queueList.forEach(function(queue){
        $('#queuesWatched').append('<span class="label label-success">'+queue.name+'</span> ');
      })
    })
  });

  // Clic sur le bouton Go
  $('#go').click(function(){
    // Lance les requêtes analytics
    analyticsRequest({userList: _userList, queueList: _queueList});;
  });

  // Donne l'intervale à partir d'une date > 1er du mois, Dernier du mois
  function getLastMonthIntervalString(start){
    start.set({hour:0,minute:0,second:0,millisecond:0});
    start = start.startOf('month');
    var end = start.clone().add(1, 'months');
    return start.toISOString() + "/" + end.toISOString();
  }

  // Donne l'intervale à partir d'une date > lundi de la semaine, dimanche de la même semaine
  function getLastWeekIntervalString(start){
    start.set({hour:0,minute:0,second:0,millisecond:0});
    start = start.startOf('isoWeek');
    var end = start.clone().add(7, 'days');
    return start.toISOString() + "/" + end.toISOString();
  }

  // Donne l'intervale à partir d'une date > 00:00 à 23:59:59
  function getDayIntervalString(start){
    start.set({hour:0,minute:0,second:0,millisecond:0});
    var end = start.clone();
    end.add(1, 'days');
    end.set({hour:0,minute:0,second:0,millisecond:0});
    return start.toISOString() + "/" + end.toISOString();
  }

  // Obtient la liste des queues (les queues dont les utilisateurs sont membres) à partir d'un groupId
  function getListOfQueues(groupId, callback){
    var userList = [];

    // obtient les membres du groupe
    groupsapi.getGroupIdMembers(groupId, 100, 1, "ASC")
    .then(function(data) {
      userList = data.entities;

      var queueList = [];
      var userListIt=0;
      // Obtient les queuessur lesquelles le membre est activé
      userList.forEach(function(user){
        usersapi.getUserIdQueues(user.id, 100, 1, true) // true pour les users joined uniquement
        .then(function(data) {
          data.entities.forEach(function(queue){
            queueList.push(queue);
          });
          userListIt++;
          if(userListIt == userList.length){
            // Filtre les doublons lorsque la liste a été passée en revue
            queueList = _.uniqBy(queueList, 'id');

            // Appelle la fonction de callabck
            if(callback)
              callback({
                userList: userList,
                queueList: queueList
              });
          }
        })
        .catch(function(error) {
          console.log('There was a failure calling getUserQueues');
          console.error(error);
        });
      });

    })
    .catch(function(error) {
    	console.log('There was a failure calling getGroupMembers');
      console.error(error);
    });
  }

  // Login dans PureCloud
  pureCloudSession.login()
  .then(function() {

    // Obtient la liste des groupes de l'Org PureCloud
    groupsapi.getGroups(100, 1, 'ASC')
    .then(function(data) {
      data.entities.forEach(function(data){
        // Affiche les groupes dans la page Web
        $('#groups').append('<option value="'+data.id+'">'+data.name+'</option>\n');
      });
    })
    .catch(function(error) {
      console.log('There was a failure calling getGroups');
      console.error(error);
    });

  });

  // Exécute les 3 requêtes analytics
  var analyticsRequest = function(opt){
    var filterQueuePredicates = opt.queueList.map(function(el){
      return {
        "type": "dimension",
        "dimension": "queueId",
        "operator": "matches",
        "value": el.id
      }
    });

    // Donne le bon filtre PureCloud à partir d'un intervale et d'une granularité donnés
    var queryObjectByDate = function(interval, granularity){
      return {
        "interval": interval,
        "granularity": granularity,
        "groupBy": [],
        "filter": {
          "type": "or",
          "clauses": [
            {
              "type": "or",
              "predicates": filterQueuePredicates
            }
          ]
        },
        "metrics": [
          "nOffered",
          "tAcd",
          "tAbandon",
          "tAnswered",
          "tHandle",
          "tTalk",
          "nOverSla",
          "oServiceLevel"
        ]
      }
    };

    var analyticsapi = new purecloud.platform.AnalyticsApi(pureCloudSession);
    var selectedDay = $("#datetimepicker").data("DateTimePicker").date();
    // Requête pour l'intervale de la journée choisie
    var reqDay = queryObjectByDate(getDayIntervalString(selectedDay.clone()), "PT15M");
    // Requête pour l'intervale de la semaine choisie
    var reqWeek = queryObjectByDate(getLastWeekIntervalString(selectedDay.clone()));
    // Requête pour l'intervale du mois choisi
    var reqMonth = queryObjectByDate(getLastMonthIntervalString(selectedDay.clone()));

    // Créé un tableau des créneaux sur lesquels on souhaite afficher les données (ici par 15m)
    var tStart = selectedDay.clone().set({hour:7,minute:0,second:0,millisecond:0});
    var tEnd = selectedDay.clone().set({hour:20,minute:0,second:0,millisecond:0});
    var creneaux = [];
    var t = tStart.clone();
    do{
      creneaux.push(t);
      var t = t.clone().add(15, 'minutes')
    }while(t.isBefore(tEnd));

    // Header du tableau des résultats
    $('#dataTable').html("<tr> \
      <th>Quand</th> \
      <th>Présentés</th> \
      <th>Traités</th> \
      <th>Abandonnés</th> \
      <th>TA Moy</th> \
      <th>TA Max</th> \
      <th>DT Moy</th> \
      <th>DT Max</th> \
    </tr>");

    // Analytics for the month
    analyticsapi.postConversationsAggregatesQuery(reqMonth).then(function(queryResult){
      console.log(queryResult);
      // Ne présente que les données pour le média voix
      var voiceData = queryResult.results.find(function(res){
        return res.group.mediaType == "voice";
      });

      // Il n'y a qu'un seul intervalle
      var data = voiceData.data[0];

      // Fonction pour faciliter l'accès aux indicateurs.
      data.getMetric = function(attr){
        return this.metrics.find(function(metric){return metric.metric == attr});
      }

      var nOffered = data.getMetric("nOffered");
      var tHandle = data.getMetric("tHandle");
      var tAcd = data.getMetric("tAcd");
      var tAbandon = data.getMetric("tAbandon");
      var tTalk = data.getMetric("tTalk");

      $('#dataTable').append('<tr style="background-color:#AAAAAA"> \
          <td>'+ selectedDay.format("MMMM") +'</td> \
          <td>'+(nOffered?nOffered.stats.count:0)+'</td> \
          <td>'+(tHandle?tHandle.stats.count:0)+'</td> \
          <td>'+(tAbandon?tAbandon.stats.count:0)+'</td> \
          <td>'+(tAcd?(moment.utc(tAcd.stats.sum/tAcd.stats.count).format("mm:ss")):0)+'</td> \
          <td>'+(tAcd?(moment.utc(tAcd.stats.max).format("mm:ss")):0)+'</td> \
          <td>'+(tTalk?(moment.utc(tTalk.stats.sum/tTalk.stats.count).format("mm:ss")):0)+'</td> \
          <td>'+(tTalk?(moment.utc(tTalk.stats.max).format("mm:ss")):0)+'</td> \
        </tr>');


      anayticsForWeek();
    });

    // Analytics for the week
    var anayticsForWeek = function(){
      analyticsapi.postConversationsAggregatesQuery(reqWeek).then(function(queryResult){
      console.log(queryResult);
      // Ne présente que les données pour le média voix
      var voiceData = queryResult.results.find(function(res){
        return res.group.mediaType == "voice";
      });

      // Il n'y a qu'un seul intervalle
      var data = voiceData.data[0];

      // Fonction pour faciliter l'accès aux indicateurs.
      data.getMetric = function(attr){
        return this.metrics.find(function(metric){return metric.metric == attr});
      }

      var nOffered = data.getMetric("nOffered");
      var tHandle = data.getMetric("tHandle");
      var tAcd = data.getMetric("tAcd");
      var tAbandon = data.getMetric("tAbandon");
      var tTalk = data.getMetric("tTalk");

      $('#dataTable').append('<tr style="background-color:#CCCCCC"> \
          <td>semaine</td> \
          <td>'+(nOffered?nOffered.stats.count:0)+'</td> \
          <td>'+(tHandle?tHandle.stats.count:0)+'</td> \
          <td>'+(tAbandon?tAbandon.stats.count:0)+'</td> \
          <td>'+(tAcd?(moment.utc(tAcd.stats.sum/tAcd.stats.count).format("mm:ss")):0)+'</td> \
          <td>'+(tAcd?(moment.utc(tAcd.stats.max).format("mm:ss")):0)+'</td> \
          <td>'+(tTalk?(moment.utc(tTalk.stats.sum/tTalk.stats.count).format("mm:ss")):0)+'</td> \
          <td>'+(tTalk?(moment.utc(tTalk.stats.max).format("mm:ss")):0)+'</td> \
        </tr>');

      anayticsForDay();
    });
    }

    // Analytics for the day
    var anayticsForDay = function(){
      analyticsapi.postConversationsAggregatesQuery(reqDay).then(function(queryResult){
      console.log(queryResult);
      // Ne présente que les données pour le média voix
      var voiceData = queryResult.results.find(function(res){
        return res.group.mediaType == "voice";
      });

      // Parcours de chaque créneau prédéfini
      creneaux.forEach(function(c){
        var dataForCreneau = voiceData.data.find(function(d){
      		return d.interval.split("/")[0] == c.toISOString();
      	});

      	if(dataForCreneau){
          // Si le créneau a des données
          // Fonction pour faciliter l'accès aux indicateurs.
          dataForCreneau.getMetric = function(attr){
            return this.metrics.find(function(metric){return metric.metric == attr});
          }

          var nOffered = dataForCreneau.getMetric("nOffered");
          var tHandle = dataForCreneau.getMetric("tHandle");
          var tAcd = dataForCreneau.getMetric("tAcd");
          var tAbandon = dataForCreneau.getMetric("tAbandon");
          var tTalk = dataForCreneau.getMetric("tTalk");

          $('#dataTable').append('<tr> \
              <td>'+ c.format("HH:mm") +'</td> \
              <td>'+(nOffered?nOffered.stats.count:0)+'</td> \
              <td>'+(tHandle?tHandle.stats.count:0)+'</td> \
              <td>'+(tAbandon?tAbandon.stats.count:0)+'</td> \
              <td>'+(tAcd?(moment.utc(tAcd.stats.sum/tAcd.stats.count).format("mm:ss")):0)+'</td> \
              <td>'+(tAcd?(moment.utc(tAcd.stats.max).format("mm:ss")):0)+'</td> \
              <td>'+(tTalk?(moment.utc(tTalk.stats.sum/tTalk.stats.count).format("mm:ss")):0)+'</td> \
              <td>'+(tTalk?(moment.utc(tTalk.stats.max).format("mm:ss")):0)+'</td> \
            </tr>');
      	}else{
          // S'il n'y avait pas de donnée pour ce créneau
          $('#dataTable').append('<tr> \
              <td>'+ c.format("HH:mm") +'</td> \
              <td>0</td> \
              <td>0</td> \
              <td>0</td> \
              <td>N/A</td> \
              <td>N/A</td> \
              <td>N/A</td> \
              <td>N/A</td> \
            </tr>')
        }
      });
    });
    }

  }
});
