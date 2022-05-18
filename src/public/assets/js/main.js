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