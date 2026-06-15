/* ===== Blog shared JS: theme + photo-style PDF lightbox ===== */
(function(){
  const htmlEl=document.documentElement;
  htmlEl.setAttribute('data-theme',localStorage.getItem('theme')||'dark');
  const ts=document.getElementById('themeSwitch');
  if(ts)ts.addEventListener('click',()=>{const c=htmlEl.getAttribute('data-theme')==='dark'?'light':'dark';htmlEl.setAttribute('data-theme',c);localStorage.setItem('theme',c);});
})();

/* lazy pdf.js */
let pdfjsReady=null;
function loadPdfjs(){
  if(pdfjsReady)return pdfjsReady;
  pdfjsReady=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res(window.pdfjsLib);};
    s.onerror=()=>{pdfjsReady=null;rej(new Error('pdfjs failed'));};
    document.head.appendChild(s);
  });
  return pdfjsReady;
}
const _docCache={};
async function _getPdf(url){if(_docCache[url])return _docCache[url];const lib=await loadPdfjs();_docCache[url]=await lib.getDocument(url).promise;return _docCache[url];}

const lb=document.getElementById('lb');
if(lb){
  const lbStage=document.getElementById('lbStage'),lbScroll=document.getElementById('lbScroll'),
        lbTitle=document.getElementById('lbTitle'),lbDl=document.getElementById('lbDl');
  let lbZoom=false,lbToken=0,panMoved=false;
  function fitWidth(){return Math.min(900,innerWidth-48);}
  async function openLb(pdfUrl,title){
    const token=++lbToken;
    lbTitle.textContent=title||'Document';lbDl.href=pdfUrl;
    lbStage.innerHTML='';lbZoom=false;lbScroll.classList.remove('zoomed');lb.classList.remove('zoom-on');
    lbStage.style.width=fitWidth()+'px';
    lb.classList.add('open');lb.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    try{
      const doc=await _getPdf(pdfUrl);
      for(let p=1;p<=doc.numPages;p++){
        if(token!==lbToken)return;
        const page=await doc.getPage(p);if(token!==lbToken)return;
        const vp=page.getViewport({scale:1});const scale=(fitWidth()*2)/vp.width;const v2=page.getViewport({scale});
        const cv=document.createElement('canvas');cv.width=v2.width;cv.height=v2.height;lbStage.appendChild(cv);
        await page.render({canvasContext:cv.getContext('2d'),viewport:v2}).promise;
      }
    }catch(err){
      if(token!==lbToken)return;
      lbStage.innerHTML='<iframe src="'+pdfUrl+'#toolbar=0&navpanes=0" style="width:100%;height:80vh;border:none;border-radius:6px;background:#fff"></iframe>';
    }
  }
  function closeLb(){lbToken++;lb.classList.remove('open');lb.setAttribute('aria-hidden','true');document.body.style.overflow='';lbStage.innerHTML='';}
  window.openLb=openLb;
  document.getElementById('lbClose').addEventListener('click',closeLb);
  document.getElementById('lbBack').addEventListener('click',closeLb);
  addEventListener('keydown',e=>{if(e.key==='Escape'&&lb.classList.contains('open'))closeLb();});
  lbScroll.addEventListener('click',e=>{
    if(e.target.closest('.lb-top'))return;
    if(panMoved){panMoved=false;return;}
    const r=lbStage.getBoundingClientRect();
    if(e.clientX<r.left-60||e.clientX>r.right+60){closeLb();return;}
    const relX=(e.clientX-r.left)/r.width,relY=(e.clientY-r.top)/r.height;
    lbZoom=!lbZoom;lbStage.style.width=(lbZoom?fitWidth()*2.4:fitWidth())+'px';
    lbScroll.classList.toggle('zoomed',lbZoom);lb.classList.toggle('zoom-on',lbZoom);
    if(lbZoom)setTimeout(()=>{lbScroll.scrollLeft=relX*lbStage.scrollWidth-lbScroll.clientWidth/2;lbScroll.scrollTop=relY*lbStage.scrollHeight-lbScroll.clientHeight/2;},380);
  });
  let dragging=false,dsx=0,dsy=0,ssx=0,ssy=0;
  lbScroll.addEventListener('pointerdown',e=>{if(!lbZoom)return;dragging=true;panMoved=false;dsx=e.clientX;dsy=e.clientY;ssx=lbScroll.scrollLeft;ssy=lbScroll.scrollTop;lbScroll.classList.add('panning');lbScroll.setPointerCapture(e.pointerId);});
  lbScroll.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-dsx,dy=e.clientY-dsy;if(Math.abs(dx)+Math.abs(dy)>6)panMoved=true;lbScroll.scrollLeft=ssx-dx;lbScroll.scrollTop=ssy-dy;});
  ['pointerup','pointercancel'].forEach(ev=>lbScroll.addEventListener(ev,()=>{dragging=false;lbScroll.classList.remove('panning');}));
  // any element with data-pdf opens the viewer
  document.addEventListener('click',e=>{const t=e.target.closest('[data-pdf]');if(t){e.preventDefault();openLb(t.dataset.pdf,t.dataset.title||'Document');}});
}
