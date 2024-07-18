////////////////////////////////
//PARTE PER LA BATTERIA

socket.on('batteryecho', (percentage, status) => {
	if(percentage==-1){
	 document.getElementById('batterypercentage').innerHTML='Batteria rimanente: Sconosciuta';
	}
	else{
	 document.getElementById('batterypercentage').innerHTML='Batteria rimanente: '+percentage+'%';
	}
   });
   ///////////////////////////////
   
   ///////////////////////////////
   //PARTE PER SALVARE LA MAPPA
   document.getElementById("savebutton").addEventListener("click", reqsavemap);
   
   function reqsavemap(){
	 socket.emit('savemap');
	 document.getElementById('savemapresult').style.display="block";
	 document.getElementById('savemapresult').innerHTML="Salvataggio mappa in corso...";
   }
   
   socket.on('savemapresecho', (res) => {
	   document.getElementById('savemapresult').innerHTML=res;
   });
   ///////////////////////////////
   
   let scaleFactor=3;
   var imgGlobal;
   var goalFlag = false;
   var x;
   var y;

   socket.on('mapecho', (imgMes , poseAtm) => {
	   imgGlobal = imgMes;
	   if(imgMes!=0){
		   //Tolgo il fatto di mostrare che non ci sia la mappa
		   document.getElementById('waitingmap').style.display="none";
		   //Value scale factor (quello dentro il box)
		   scaleFactor = document.getElementById("scalefactor").value;
		   //Mi riferisco a mapimage definito dentro <canvas>
		   let can = document.getElementById("mapimage");
		   can.width = imgMes.info.width/4;
		   can.height = imgMes.info.height/4;
		   //Creo oggetto di tipo CanvasRenderingContext2D, dove poter disegnare
		   var ctx = can.getContext("2d");
		   
		   //Definisco un image data con i dati generati sopra 		
		   var palette = ctx.getImageData(0,0,imgMes.info.width , imgMes.info.height);
		   
		   palette.data.set(new Uint8ClampedArray(imgMes.data));
		   //disegna i dati dall'oggetto ImageData specificato nell'area di disegno
		   ctx.putImageData(palette,0,0);
   
		   //Serve per andare a disegnare l'immagine in una scala diversa
		   let scaledCanvas=document.getElementById("scaledmap");
		   let scaledContext=scaledCanvas.getContext('2d');
		   scaledCanvas.width=can.width;
		   scaledCanvas.height=can.height;
		   scaledContext.imageSmoothingEnabled = false;
		   //scaledContext.scale(scaleFactor, scaleFactor);
		   scaledContext.drawImage(can,0,0);
		   
		   //Parte riguardante il calcolo della freccia raffigurante la posizione attuale del robot
		   let px = ((poseAtm.pose.pose.position.x - imgMes.info.origin.position.x) / imgMes.info.resolution)/4;
		   let py = ((poseAtm.pose.pose.position.y - imgMes.info.origin.position.y) / imgMes.info.resolution)/4;

		      
		   if(goalFlag){
			let gx = ((x - imgMes.info.origin.position.x) / imgMes.info.resolution)/4;
			let gy = ((y - imgMes.info.origin.position.y) / imgMes.info.resolution)/4;
			
			scaledContext.beginPath();
			
			scaledContext.arc(gx, gy, 2, 0, 2 * Math.PI);
			scaledContext.fill();
			
			scaledContext.stroke(); 
		   }

		   scaledContext.translate(px,py);
   
		   const orientation = poseAtm.pose.pose.orientation;
		   const siny_cosp =
			 2 * (orientation.w * orientation.z + orientation.x * orientation.y);
		   const cosy_cosp =
			 1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z);
		   const theta = Math.atan2(siny_cosp, cosy_cosp);
		   scaledContext.rotate(theta + Math.PI / 2);
		   scaledContext.beginPath();
	 
		   scaledContext.moveTo(0, -8);
		   scaledContext.lineTo(6, +8);
		   scaledContext.lineTo(0, 1);
		   scaledContext.lineTo(-6, +8);
		   scaledContext.lineTo(0, -8);
		   scaledContext.closePath();
		   scaledContext.fill();

		   let modalCanvas = document.getElementById("imageMap");
		   let modalContext = modalCanvas.getContext('2d');
		   modalCanvas.width=scaledCanvas.width * scaleFactor;
		   modalCanvas.height=scaledCanvas.height * scaleFactor;
		   modalContext.imageSmoothingEnabled = false;
   
		   modalContext.scale(scaleFactor, scaleFactor);
		   modalContext.drawImage(scaledCanvas, 0, 0);
   
	   }
	   else{
		   document.getElementById('waitingmap').innerHTML="Mappa non disponibile";
		   document.getElementById("scaledmap").style.display="none";
		   document.getElementById("savebutton").style.display="none";
		   document.getElementById("scalefactor").style.display="none";
		   document.getElementById("scalinginstructions").style.display="none";
	   }
   });
   
   let canvasEl = document.getElementById("scaledmap");
   
   //Al click della mappa piccola si mostra la parte grande in un modal
   canvasEl.addEventListener("mousedown" , (e) => {
   
	   const myModal = new bootstrap.Modal(document.getElementById('myModal'));
	   myModal.show();
   
   });
   
   let modalC = document.getElementById("imageMap");
   
   //Al click del modal si genera
   modalC.addEventListener("mousedown" , (e) =>{
	getMousePosition(modalC , e);
   });
   
   //Prendere le coordinate del punto che deve raggiugnere in base al click sulla mappa
   function getMousePosition(canvas , event) {
	   scaleFactor = document.getElementById("scalefactor").value;
	   let rect = canvas.getBoundingClientRect();
	   let x = (event.clientX - rect.left) / scaleFactor ;
	   let y = (event.clientY - rect.top) / scaleFactor;
   
	   
	   let resX = x*imgGlobal.info.resolution*4 + imgGlobal.info.origin.position.x ;
	   let resY = y*imgGlobal.info.resolution*4 + imgGlobal.info.origin.position.y ;
   
	   socket.emit("mapPosServer" , resX , resY);
   
   
   }

   
///Riceve in input la posa , prendo il canvas e disegno sopra il canvas la palla da raggiungere
socket.on('drawGPFromServer', (puntoX , puntoY) => {
	x = puntoX;
	y = puntoY;
	goalFlag = true;
});

socket.on("cancelGP" , () =>{
	goalFlag = false;
});