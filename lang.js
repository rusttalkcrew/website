(function(){
  // Languages come from the switcher buttons on each page. A saved or browser
  // language the page does not offer falls back to English without being saved.
  var root=document.documentElement,buttons=document.querySelectorAll('.lang button');
  var langs=Array.prototype.map.call(buttons,function(b){return b.dataset.set});
  function setLang(l,save){
    root.lang=l;
    buttons.forEach(function(b){b.classList.toggle('on',b.dataset.set===l)});
    if(save)try{localStorage.setItem('lang',l)}catch(e){}
  }
  var saved=null;try{saved=localStorage.getItem('lang')}catch(e){}
  var browser=(navigator.language||'en').toLowerCase().slice(0,2);
  setLang([saved,browser].filter(function(l){return langs.indexOf(l)>=0})[0]||'en',false);
  buttons.forEach(function(b){b.addEventListener('click',function(){setLang(b.dataset.set,true)})});
})();
