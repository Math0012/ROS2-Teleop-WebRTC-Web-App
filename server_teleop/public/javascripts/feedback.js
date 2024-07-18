//Mostra al cliente il feedback attuale dell'utente
socket.on('feedbackFromServer', (res) => {
	switch (res) {
		case 'Goal Accettato':
			document.getElementById('feedback').style.color = "#0DCAF0";
		  break;
		  case 'Goal Raggiunto':
			document.getElementById('feedback').style.color = "#32CD32";
		  break;
		  case 'Goal Fallito':
			document.getElementById('feedback').style.color = "#DC3545";
		  break;
		  case 'Goal Rifiutato':
			document.getElementById('feedback').style.color = "#800000";
		  break;
		  case 'Goal Cancellato':
			document.getElementById('feedback').style.color = "#FF8C00";
		  break;
		default:
			document.getElementById('feedback').style.color = "#000000";
	  }

    if(res == "Goal Accettato"){
		document.getElementById("cancelGoal").disabled = false;
	}
	if(res == "Goal Raggiunto" || res == "Goal Fallito" || res == "Goal Rifiutato" || res == "Goal Cancellato"){
		document.getElementById("cancelGoal").disabled = true;
	}
    document.getElementById('feedback').innerHTML=res;
});