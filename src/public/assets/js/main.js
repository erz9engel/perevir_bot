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