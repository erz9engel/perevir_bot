function logOut() {
    document.cookie = 'token=; Max-Age=0'
    window.location.href = "../";
}

function updateTexts() {
    const texts = document.getElementsByTagName('textarea');
    var textToUpdate = [];
    for (var i in texts) {
      if (texts[i].id && (texts[i].id.startsWith('u_') || texts[i].id.startsWith('e_'))) { //u_ - ukr, e_ - eng
        const lang = texts[i].id[0];
        const textName = texts[i].id.substring(2);

        const index = textToUpdate.findIndex((obj => obj.name == textName));
        if (index == -1) {
            const textObj = { name: textName };
            if (lang == 'u') textObj.ua = texts[i].value;
            else if (lang == 'e') textObj.en = texts[i].value;
            textToUpdate.push(textObj);
        } else {
            if (lang == 'u') textToUpdate[index].ua = texts[i].value;
            else if (lang == 'e') textToUpdate[index].en = texts[i].value;
        }
      }
    }
    
    fetch("../textsAPI/update", {
        method: "POST",
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(textToUpdate)
      }).then(res => {
        alert("Зміни збережено");
      });
}

function getLeaderboard() {
  
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;

  fetch("../leaderboardAPI/get?" + new URLSearchParams({
    from: from,
    to: to,
  }))
  .then(response => response.json())
  .then(res => {
    document.getElementById('leaderboard').innerHTML = '';
    var fakes = 0, trues = 0, semitrues = 0, nodatas = 0, rejects = 0, comments = 0, requests = 0;
    for (var i in res) {
      document.getElementById('leaderboard').innerHTML += '<tr> <td class="left-pad"> <h6 class="mb-0 text-sm">' + res[i].name + '</h6> <p class="text-xs text-secondary mb-0">id: '+ res[i].tgId +'</p> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].fakes +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].trues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].semitrues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].nodatas +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].rejects +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].comments +'</span> </td>  <td class="text-center"> <span class="font-weight-bold">'+ res[i].requests +'</span> </td> </tr>';
      fakes += parseInt(res[i].fakes);
      trues += parseInt(res[i].trues);
      semitrues += parseInt(res[i].semitrues);
      nodatas += parseInt(res[i].nodatas);
      rejects += parseInt(res[i].rejects);
      comments += parseInt(res[i].comments);
      requests += parseInt(res[i].requests);
    }
    document.getElementById('leaderboard').innerHTML += '<tr> <td class="left-pad"> <h6 class="mb-0">Всього: </h6></td> <td class="text-center"> <span class="font-weight-bold">'+ fakes +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ trues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ semitrues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ nodatas +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ rejects +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ comments +'</span> </td>  <td class="text-center"> <span class="font-weight-bold">'+ requests +'</span> </td> </tr>';
  })
  .catch((error) => {
    document.getElementById('leaderboard').innerHTML = '<tr><td class="text-center"> <span class="font-weight-bold">Немає даних</span> </td> </tr>';
  });
    
}

function getNewsletter() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const checkedMinNews = document.getElementById('checkedMinNews').value;
  const checkedMaxNews = document.getElementById('checkedMaxNews').value;
  const subscribed = document.getElementById('subscribed').checked;
  document.getElementById('users').innerHTML = 'Підрахунок...';

  fetch("../newsletterAPI/get?" + new URLSearchParams({
    from: from,
    to: to,
    checkedMinNews: checkedMinNews,
    checkedMaxNews: checkedMaxNews,
    subscribed: subscribed
  }))
  .then(response => response.json())
  .then(res => {
    document.getElementById('users').innerHTML = res.amount;
  })
  .catch((error) => {
    alert(error);
  });
}

function checkForm () {
  const message = document.getElementById('message').value;
  if (message == '') {
    document.getElementById('sendBtn').style.display = 'none';
  } else {
    document.getElementById('sendBtn').style.display = 'block';
  }
}

function runNewsletter() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const checkedMinNews = document.getElementById('checkedMinNews').value;
  const checkedMaxNews = document.getElementById('checkedMaxNews').value;
  const subscribed = document.getElementById('subscribed').checked;
  const message = document.getElementById('message').value;

  if (message == '') return alert('Повідомлення не може бути пустим');

  fetch("../newsletterAPI/send?" + new URLSearchParams({
    from: from,
    to: to,
    checkedMinNews: checkedMinNews,
    checkedMaxNews: checkedMaxNews,
    subscribed: subscribed,
    message: message
  }))
  .then(response => response.json())
  .then(res => {
    alert('Успішно запущено')
  })
  .catch((error) => {
    alert(error);
  });
}

function getSourcestats() {
  const orderBy = document.getElementById('orderBy').value;
  fetch("../sourcestatsAPI/get?" + new URLSearchParams({sort: orderBy}))
  .then(response => response.json())
  .then(res => {
    document.getElementById('sourcestats').innerHTML = '';
    for (var i in res) {
      document.getElementById('sourcestats').innerHTML += '<tr> <td class="text-center"> <span class="font-weight-bold"><a href="../channelrequests?channel_id='+ res[i].sourceTgId + '">' + res[i].sourceTgId +'</a></span> </td> <td class="text-center"> <span class="font-weight-bold"><a href="../channelrequests?channel_id='+ res[i].sourceTgId + '">'+ res[i].sourceName +'</a></span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].falseCount +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].trueCount +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].manipulationCount +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].noproofCount +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].rejectCount +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].totalRequests +'</span> </td> </tr>';
    }
  })
  .catch((error) => {
    document.getElementById('sourcestats').innerHTML = '<tr><td class="text-center"> <span class="font-weight-bold">Немає даних</span> </td> </tr>';
  });

}
