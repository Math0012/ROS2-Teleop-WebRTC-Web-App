const robot_port = document.getElementById('robotport').innerText;

const socketecho = io.connect(robot_port);
socket.on("speedsendrobot", (linear, angular) => {
  socketecho.emit("speedecho", linear, angular);
});


socket.on("cancelGoalFromServer" , () => {
	socketecho.emit("cancelGaolFromBr");
});

socket.on("directionrobot" , (arg1,arg2) => {
	socketecho.emit("directionecho" , arg1 , arg2);
});

socket.on("mapPosBroad" , (arg1,arg2) => {
	socketecho.emit("mapPosEcho" , arg1 , arg2);
});

socket.on("savemapsendrobot", () => {
  socketecho.emit("savemapecho");
});

socketecho.on("mapsendserver", (map ,pose) => {
  socket.emit("map", map , pose);
});

socketecho.on("savemapres_sendserver", (res) => {
  socket.emit("savemapres", res);
});


socketecho.on("feedbackFromLocal", (res) => {
	socket.emit("feedbackFromBroad", res);
});

socketecho.on("drawGPFromLocal", (x , y ) => {
	socket.emit("drawGPFromBroad", x , y);
});

socketecho.on("batterysendserver", (percentage, status) => {
  socket.emit("battery", percentage);
});

window.onunload = window.onbeforeunload = () => {
  socketecho.close();
};
