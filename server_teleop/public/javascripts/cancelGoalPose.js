//Parte per la cancellazione del goal (click bottone giallo)
document.getElementById("cancelGoal").addEventListener("click" , cancel);

function cancel(){
	socket.emit("cancelGoalFromScript");
}