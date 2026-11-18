/* Converts existing and Alpine-generated Font Awesome <i> elements to lightweight SVG uses. */
(function(){
  'use strict';
  var aliases={'play-circle':'circle-play','sparkles':'wand-sparkles','wand-magic-sparkles':'wand-sparkles','user-circle':'user-circle'};
  var ignored=new Set(['solid','regular','spin','xs','sm','lg','xl','2x','3x','4x','5x','fw','inverse','ul','li','border','pull-left','pull-right','stack','stack-1x','stack-2x','beat','fade','bounce','flip','shake','pulse','spin-pulse']);
  function resolveIcon(el){
    var name='';
    el.classList.forEach(function(c){if(!name&&c.indexOf('fa-')===0&&!ignored.has(c.slice(3)))name=c.slice(3);});
    if(!name)return null;
    var regular=el.classList.contains('fa-regular')||el.classList.contains('far');
    if(regular&&['bookmark','circle','heart','star','calendar'].includes(name))name='regular-'+name;
    return aliases[name]||name;
  }
  function update(el){
    if(!(el instanceof Element)||!el.matches('i.fa-solid,i.fa-regular,i.fas,i.far'))return;
    var id=resolveIcon(el);if(!id)return;
    var svg=el.querySelector(':scope > svg.perde-icon-svg');
    if(!svg){
      svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('perde-icon-svg');
      svg.setAttribute('aria-hidden','true');
      svg.setAttribute('focusable','false');
      var use=document.createElementNS('http://www.w3.org/2000/svg','use');
      svg.appendChild(use);el.appendChild(svg);
    }
    var useNode=svg.firstElementChild;
    var href='./icons.svg?v=20261118-regular-v3#'+id;
    if(useNode.getAttribute('href')!==href)useNode.setAttribute('href',href);
  }
  function scan(root){
    if(root.nodeType!==1&&root.nodeType!==9)return;
    if(root.matches&&root.matches('i.fa-solid,i.fa-regular,i.fas,i.far'))update(root);
    if(root.querySelectorAll)root.querySelectorAll('i.fa-solid,i.fa-regular,i.fas,i.far').forEach(update);
  }
  scan(document);
  var observer=new MutationObserver(function(records){
    records.forEach(function(record){
      if(record.type==='attributes')update(record.target);
      else record.addedNodes.forEach(function(node){if(node.nodeType===1)scan(node);});
    });
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();
