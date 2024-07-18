require('dotenv').config();  //richiedo variabili settate nel file .env
const express = require("express");
const app = express(); //framework express come nel server

const EventEmitter = require('events');   //Utilizzato per la comunicazione 
const eventEmitter = new EventEmitter();

//per https
/*const fs = require('fs');
const https = require('https');
const options = {
 key: fs.readFileSync(process.env.HTTPS_KEY_PATH),
 cert: fs.readFileSync(process.env.HTTPS_CERT_PATH)
};
const server = https.createServer(options, app);*/ //creo il server https

const http = require('http');
const server = http.createServer(app);

const io = require("socket.io")(server, { //necessario impostare cors per permettere al server del robot di collegarsi al socket di signaling
  cors: { 
   // origin: '*', //questo permette al server di connettersi a socket di ogni origine, poi imposto nel listen in modo che solo localhost si può connettere al server e quindi alla socket
    origin: process.env.SERVER_TELEOP_IP //solo al server, deve essere proprio l'ip, non la pagina web
  }
}
); //connetto socRket

const port = Number(process.env.THIS_SERVER_PORT); //la porta

//ascolto solo su localhost
server.listen(port, 'localhost', () => console.log(`Server is running on port ${port}`));

/////Socket io per rclnodejs
let linear=0; //inizializzo le due variabili a zero,
let angular=0; //la prima è la velocità lineare, la seconda l'angolare
let mapmsg;//=0;
let batterypercentage=-1;

let flagMoveAlone=false;      //Utilizzata per scambiare da controllo manuale ad automatico
let intervallo;               //Variabile utilizzata per poi stoppare il setInterval
var distance = 0.0;           //Variabile utilizzata per riferirmi di quanto spostarmi
var direzione ;               //Variabile che contiene la direzione
var poseAtm ;                 //Variabile utilizzata per salvare la posizione attuale del robot
var cancellato = false;       //Utilizzato come flag per la parte riguardante il messaggio di cancellazione

const { exec } = require('child_process'); //richiedo per salvare la mappa

io.on('connection', socket => { //quando avviene una connessione, ascolto solo per due eventi. 
  // Qui non mi interessa verificare room del socket perché essendo solo su Localhost solo il client guidato da puppeteer può connettersi.
  socket.on("speedecho", (speedlinear, speedangular) => {
	  if(!flagMoveAlone){	
      eventEmitter.emit("feed" , "Movimento Manuale");
		  if(isNaN(speedlinear) || isNaN(speedangular)){
        console.log("input malformato");
      }
      else
      {
       linear = speedlinear, angular = speedangular;
      console.log("linear: %s, angular: %s", linear, angular);
      }
	  }else{
      eventEmitter.emit("feed" , "Movimento Autonomo attivo , attendere");
	  }
  });
    
  //Socket che gestisce l'input di cancellazione del goal
  socket.on("cancelGaolFromBr", () => {
		eventEmitter.emit("cancel");
	});

  //Parte riguardanta il cerchio di bottoni + slider
  //Arg1 rappresenta la distanza , mentre arg2 rappresenta la direzione
  socket.on("directionecho", (arg1, arg2) => {
    distance = Number(arg1);
    direzione = arg2;
    if(!flagMoveAlone){
      flagMoveAlone = true;
      clearInterval(intervallo);
      eventEmitter.emit('start');
    }
	});	

  //Parte riguardante la selezione dalla mappa
  //Arg1 = x , Arg2 = y
  socket.on("mapPosEcho", (arg1, arg2) => {
    let x = Number(arg1);
    let y = Number(arg2);
    //console.log("XXXX : " + x + " YYYYY: " + y); per il test vedere il risultato su console
    if(!flagMoveAlone){
      flagMoveAlone = true;
      clearInterval(intervallo);
      eventEmitter.emit('goToFromMap' , x , y);
    }
	});	

  eventEmitter.on("feed" , (res) =>{
    socket.emit("feedbackFromLocal" , res);
  });

  eventEmitter.on("goalPoint" , (x,y) =>{
    //mando via socket la posizione su cui devo disegnar eil punto di arrivo
    socket.emit("drawGPFromLocal" , x , y);
  });

  socket.on("savemapecho", () => {
    exec('ros2 run nav2_map_server map_saver_cli -f '+process.env.SAVE_MAP_NAMEANDPATH+' -t '+process.env.COSTMAP_TOPIC_NAME+' --ros-args --enclave '+process.env.SROS2_MAP_SAVER_ENCLAVE, (err, stdout, stderr) => {
      if (err) {     //invio errore al client 
        socket.emit("savemapres_sendserver", "Qualcosa è andato storto!");   
      } //essendo processo child condivide variabili sros2 del padre
      else {    // il risultato    
        socket.emit("savemapres_sendserver", "Mappa salvata con successo!");     
      } 
	  });
  });

  setInterval(function () {
    socket.emit('mapsendserver', mapmsg , poseAtm);
  }, 100);

   setInterval(function () {
        socket.emit('batterysendserver', batterypercentage);
}, 10000); //ogni 10 secondi perchè è inutile inviarlo in continuazione

  socket.on("disconnect", () => { //se puppeteer si chiude setto a zero le speed e fermo il robot
    linear=0;
    angular=0;
  });


});

//rclnodejs e comunicazione con ros2

const rclnodejs = require('rclnodejs'); // modulo per creare nodo ros2 e comunicare con sistema ros
const Nav = rclnodejs.require('nav2_msgs/action/NavigateToPose'); //Recupero la struttura del tipo dell'azione

const argv=['--ros-args', '--enclave', process.env.SROS2_RCLNODE_ENCLAVE_PATH]; //DA ABILITARE PER SROS2
rclnodejs.init(rclnodejs.Context.defaultContext(), argv).then(() => {
  const node = rclnodejs.createNode('rclnodemain'); //nodo chiamato rclnodemain
  const publisher = node.createPublisher(process.env.TELEOP_TYPE_MSG, process.env.TELEOP_TOPIC_NAME); //creo il publisher con tipo messaggio / nome topic
  
  //Vado a definire un nodo + action client al suo interno legato al tipo e all'azione specificata quua sotto
  const nodeAC = rclnodejs.createNode('action_client_node');
  let aClient = new rclnodejs.ActionClient(
    nodeAC,
    'nav2_msgs/action/NavigateToPose',
    '/navigate_to_pose'
  );
  
  //Vado a generare un nodo per prendere la posizione attuale
  const nodeAP = rclnodejs.createNode('actual_node_pose');
  /*
   * Il suo funzionamento è il seguente , eseguo in loop la funzione movement ( dato dal setInterval definito fuori dalla funzione)
   * nel momento in cui il local server riceve sulla socket legata al bottone per il movimento , setta il flagMoveAlone (boolean) 
   * a true e viene bloccato il movimento manuale, per evitare sovrascrizioni
   * */

  function movement(){
    if(!flagMoveAlone){
      publisher.publish({ //pubblico questo messaggio, composto da questi parametri
        linear: {
          x : linear, //valore passato dal client con comandi teleop
          y : 0.0,
          z : 0.0
        },
        angular: {
          x : 0.0,
          y : 0.0,
          z : angular //valore passato dal client con comandi teleop
        }
      });	 
    
    }
  }
	
  intervallo = setInterval(movement,25);  

  //Dentro CostmapTypeMsg = nav_msgs/msg/OccupancyGrid CostmapTopicName = /map 
  const subscribermap = node.createSubscription(process.env.COSTMAP_TYPE_MSG, process.env.COSTMAP_TOPIC_NAME, (map) => {
    mapmsg=map;
  });
  
  //Per la batteria
  const subscriberbattery = node.createSubscription(process.env.BATTERY_TYPE_MSG, process.env.BATTERY_TOPIC_NAME, (battery) => {
    batterypercentage = Math.floor(battery.percentage);
  });

  //Per la posizione attuale del robot
  const subpose = nodeAP.createSubscription(process.env.POSE_TYPE_MSG, process.env.POSE_TOPIC_NAME , (result) =>{
    poseAtm = result;
  });

  eventEmitter.on('start' , () =>{
    //Richiama la funzione per la navigazione autonoma e viene calcolata da eightDirection il punto da raggiungere
    goal(eightDirection(poseAtm));
  });
  
  //Richiama la funzione per la navigazione autonoma e viene generato il messaggio del punto da raggiugnere
  eventEmitter.on('goToFromMap' , (x , y) =>{
    goal(GOTO(x,y));
  });

  //Parte riguardante la navigazione autonoma del robot
	async function goal(posizione){
    //Vengono mandati i dati per disegnare il punto da raggiungere sulla mappa 
    eventEmitter.emit('goalPoint' , posizione.pose.position.x ,  posizione.pose.position.y);
		//Si genera un azione del tipo nav2_msgs/action/NavigateToPose 
		let goal_msg = new Nav.Goal();
		console.log(posizione);
		goal_msg.pose=posizione;
		goal_msg.behavior_tree = '';

		//Send goal del messaggio
		const goalHandle = await aClient.sendGoal(goal_msg);

		//Parte riguardante il feedback, accettato o rifiutato
		if(!goalHandle.isAccepted()){
      eventEmitter.emit("feed" , "Goal Rifiutato") ;
      flagMoveAlone = false;
      intervallo = setInterval(movement,25);
			return;
		}
		
    eventEmitter.emit("feed" ,  "Goal Accettato");
		
    //Parte riguardante la cancellazione del goal
    eventEmitter.on("cancel" , () =>{
      goalHandle.cancelGoal();
      cancellato = true;
    });

		//Si aspetteta la fine del goal
		const result = await goalHandle.getResult();
		
		//Output riguardante il risultato del messaggio
    if(!cancellato){
      if(goalHandle.isSucceeded()){
        eventEmitter.emit("feed" , "Goal Raggiunto");
      }else{
        eventEmitter.emit("feed" , "Goal Fallito");
      }
    }else{
      eventEmitter.emit("feed" , "Goal Cancellato");
      cancellato = false;
    }
		
		//Setto la variabile booleana a false , per poter ridare i comandi manuali e richiamo il setInterval definendo il 
		flagMoveAlone = false;
		intervallo = setInterval(movement,25);
		return;
	}
  
  //Parte riguardante il calcolo del punto da raggiungere (Slider+bottoni)
  function eightDirection(poseAtm){
    //Posizione attuale del robot
    var oldX = poseAtm.pose.pose.position.x;
    var oldY = poseAtm.pose.pose.position.y;
    //Definisco i radianti di ogni tasto
    var radDir = (
      direzione == 'up' ? 0 :
      direzione == 'leftUp' ? 0.785398 :
      direzione == 'left' ? 1.5708 :
      direzione == 'leftDown' ? 2.35619 :
      direzione == 'down' ? 3.14159 :
      direzione == 'rightDown' ? -2.35619 :
      direzione == 'rightUp' ? -0.785398 :
      -1.5708 
    );

    //Prendo l'orientamento sull'asse z
    var siny_cosp = 2 * (poseAtm.pose.pose.orientation.w * poseAtm.pose.pose.orientation.z + poseAtm.pose.pose.orientation.x * poseAtm.pose.pose.orientation.y );
    var cosy_cosp = 1 - 2 * (poseAtm.pose.pose.orientation.y * poseAtm.pose.pose.orientation.y + poseAtm.pose.pose.orientation.z * poseAtm.pose.pose.orientation.z );
  
    //Da quaternioni a radianti
    var radRobot = Math.atan2(siny_cosp, cosy_cosp);
    
    //Usato per rutoare il punto
    var rad = radRobot + radDir;
    
    //Posizione nuovo punto
    var newX = oldX + (distance * Math.cos(rad));
    var newY = oldY + (distance * Math.sin(rad));

    //Nuovo orientamento del robot
    var zNew = Math.sin(rad/2);
    
    //Definizione messaggio
    let miniStep = {
      header: {
        stamp: {
          sec : 0, 
                nanosec : 0
              },
        frame_id : "map"               
      },
      pose: {
        position: {
                x : newX,
                y : newY,
                z : 0
            },
            orientation: {
                x : poseAtm.pose.pose.orientation.x,
                y : poseAtm.pose.pose.orientation.y,
                z : zNew,
                w : poseAtm.pose.pose.orientation.w 
            }
      }
    }
    return miniStep;
  }

  //Definizione messaggio
  function GOTO(xIn,yIn){
    let p = {
      header: {
        stamp: {
          sec : 0, 
                nanosec : 0
              },
        frame_id : "map"               //tf_prefix+"/"+map_frame;
      },
      pose: {
        position: {
                x : xIn,
                y : yIn,
                z : 1.0
            },
            orientation: {
                x : 0.0,
                y : 0.0,
                z : 0.0,
                w : 1.0
            }
      }
    }

    return p;
  }

  //Nodo contenente l'action Client per la comunicazione del movimento 
  rclnodejs.spin(nodeAC); 
  rclnodejs.spin(nodeAP);
  rclnodejs.spin(node);    //spin continuo, serve solo se inserisco un subscriber nel codice!
});

const reader = require("readline-sync"); //ottengo nome user e password da linea di comando in maniera sincrona
///////// Parte di puppeteer per l'headless browser
const puppeteer = require ('puppeteer'); //modulo per l'headless browser
const { exit } = require('process');
//const { Client } = require('socket.io/dist/client'); LASCIARE VEDERE IN FUTURO
//const { useEffect } = require('react');
//const { addListener } = require('process');

(async () => {
  const browser = await puppeteer.launch({  //lancio puppeteer con argomenti
   headless: true,      //per testing
   args: [
   '--use-fake-ui-for-media-stream', //accetta in automatico di inviare stream cam
   //'--use-fake-device-for-media-stream',  //per testing
   '--ignore-certificate-errors', //solo per test, ignora i certificati di sicurezza self signed.
   //'enable-features=BlockInsecurePrivateNetworkRequests' //se non funziona quella sotto provare questa
   '--disable-features=BlockInsecurePrivateNetworkRequests' //per eliminare problemi di accesso a localhost che potrebbero comparire in futuro
   ]
  });
  const page = await browser.newPage(); //apro una nuova pagina del browser
  
  page.on('console', message => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`));
  page.on('pageerror', ({ message }) => console.log(message));
  page.on('requestfailed', request => console.log(`${request.failure().errorText} ${request.url()}`));

  await page.goto(process.env.SERVER_LOGIN_PAGE); //vado alla pagina del robot teleop che contiene webrtc e inizio
  do {
    console.log('Inserisci username e password del robot.');
    await page.type('#username', reader.question("Username: ",{ hideEchoBack: true }));  //inserisco username nel input tag con id #username
    await page.type('#password', reader.question("Password: ",{ hideEchoBack: true })); //inserisco password nel input tag con id #password
    await Promise.all([ //aspetto che una volta premuto il pulsante di login venga redirezionato
    page.click('#buttonlogin'),
    page.waitForNavigation({ waitUntil: 'networkidle0' })
  ]);
  } while (await page.$('#loginerror') !== null);
  console.log("Auth Ok");
  //await browser.close();
})();
