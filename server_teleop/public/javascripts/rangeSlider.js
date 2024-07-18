var slider = document.getElementById("myRange");
var output = document.getElementById("rangeATM");
output.innerHTML = slider.value; // Display del valore
var valueSlider;

//Update del valore dello slider
slider.oninput = function() {
  output.innerHTML = this.value;
  valueSlider= this.value;
}

//Parte riguardante l'invio dei valori
document.addEventListener('click', function(e){
  if(e.target.getAttribute("name") =="buttonDirection"){
    myfunction(e.target.getAttribute("value"));
  }
});

function myfunction(value){
  socket.emit("direction" , valueSlider , value);
  disable(value);
}

function disable(v){
  var childDivs = document.getElementById('ciao').getElementsByTagName('button');
  for( i=0; i< childDivs.length; i++ )
  {
   if(!(childDivs[i].value == v)){
   	childDivs[i].setAttribute("disabled", "");
   }
  }
}

socket.on('enableButtons', () => {
  var childDivs = document.getElementById('ciao').getElementsByTagName('button');
  for( i=0; i< childDivs.length; i++ ) {
    childDivs[i].removeAttribute("disabled");
  }
});
