(function () {
  'use strict';
  const A=window.Arpes;
  const PALETTES={
    aurora:['#8ceaff','#9bf2ce','#d7f59a','#ffe59b','#ffb2bb'],pastel:['#b4c9ff','#cbb7f5','#f6b5d3','#ffd4aa','#fff3a6'],sunrise:['#bfb8ff','#f4b1dc','#ffbeaa','#ffe09e','#fff4bd'],seafoam:['#9ccfff','#94e8e0','#b9f0bc','#e1f6b0','#fff2bc'],icefirelight:['#8bcfff','#c1e8f4','#f2f3df','#ffcfac','#ff9b98'],lavender:['#aaaaff','#c5b6ff','#e3bdf4','#f7d0ed','#ffe5f1'],candy:['#96e5ff','#cbbaff','#ffadce','#ffc69c','#ffef9b'],
    spring:['#ff00ff','#ff40bf','#ff8080','#ffbf40','#ffff00'],summer:['#008066','#40a066','#80c066','#bfdf66','#ffff66'],autumn:['#ff0000','#ff4000','#ff8000','#ffbf00','#ffff00'],cool:['#00ffff','#40bfff','#8080ff','#bf40ff','#ff00ff'],
    viridis:['#440154','#3b528b','#21918c','#5ec962','#fde725'],magma:['#000004','#51127c','#b73779','#fc8961','#fcfdbf'],plasma:['#0d0887','#7e03a8','#cc4778','#f89540','#f0f921'],inferno:['#000004','#57106e','#bc3754','#f98e09','#fcffa4'],cividis:['#00224e','#434e6c','#7d7c78','#bcae6c','#fee838'],turbo:['#30123b','#466be3','#1ae4b6','#a4fc3c','#f9ba38','#e3440a','#7a0403'],
    blues:['#f7fbff','#c6dbef','#6baed6','#2171b5','#08306b'],greens:['#f7fcf5','#c7e9c0','#74c476','#238b45','#00441b'],reds:['#fff5f0','#fcbba1','#fb6a4a','#cb181d','#67000d'],purples:['#fcfbfd','#dadaeb','#9e9ac8','#6a51a3','#3f007d'],oranges:['#fff5eb','#fdd0a2','#fd8d3c','#d94801','#7f2704'],ylgnbu:['#ffffd9','#c7e9b4','#41b6c4','#225ea8','#081d58'],ylorrd:['#ffffcc','#fed976','#fd8d3c','#e31a1c','#800026'],ylgn:['#ffffe5','#d9f0a3','#78c679','#238443','#004529'],pubu:['#fff7fb','#d0d1e6','#74a9cf','#0570b0','#023858'],bugn:['#f7fcfd','#ccece6','#66c2a4','#238b45','#00441b'],greys:['#ffffff','#d9d9d9','#969696','#525252','#000000'],copper:['#000000','#50321f','#9f6440','#ef9660','#ffc77f'],
    coolwarm:['#3b4cc0','#8db0fe','#dddddd','#f4987a','#b40426'],spectral:['#9e0142','#f46d43','#fee08b','#ffffbf','#e6f598','#66c2a5','#5e4fa2'],rdylbu:['#a50026','#f46d43','#fee090','#ffffbf','#e0f3f8','#74add1','#313695'],rdylgn:['#a50026','#f46d43','#fee08b','#ffffbf','#d9ef8b','#66bd63','#006837'],rdbu:['#67001f','#d6604d','#f4a582','#f7f7f7','#92c5de','#4393c3','#053061'],piyg:['#8e0152','#de77ae','#f7f7f7','#7fbc41','#276419'],prgn:['#40004b','#9970ab','#f7f7f7','#5aae61','#00441b'],brbg:['#543005','#bf812d','#f5f5f5','#35978f','#003c30'],puor:['#7f3b08','#e08214','#f7f7f7','#8073ac','#2d004b'],
    rainbow:['#8000ff','#0000ff','#00bfff','#00ff80','#bfff00','#ff8000','#ff0000'],jet:['#000080','#0000ff','#00ffff','#ffff00','#ff0000','#800000'],hot:['#0b0000','#b00000','#ff5a00','#ffff00','#ffffff'],winter:['#0000ff','#0040df','#0080bf','#00bf9f','#00ff80'],ocean:['#008000','#004040','#000080','#0080bf','#ffffff'],terrain:['#333399','#0099cc','#00cc66','#ffff99','#996655','#ffffff'],twilight:['#e2d9e2','#6376ba','#321947','#2f1436','#b36151','#e2d9e2']
  };
  for(const name of ['viridis','plasma','turbo'])PALETTES[name+'light']=PALETTES[name].map(hex=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.45+255*.55).toString(16).padStart(2,'0')).join(''));
  const PALETTE_GROUPS=[
    ['Bright & pastel',['aurora','pastel','sunrise','seafoam','icefirelight','lavender','candy','viridislight','plasmalight','turbolight','spring','summer','autumn','cool']],
    ['Sequential',['viridis','magma','plasma','inferno','cividis','turbo','blues','greens','reds','purples','oranges','ylgnbu','ylorrd','ylgn','pubu','bugn','greys','copper']],
    ['Diverging',['coolwarm','spectral','rdylbu','rdylgn','rdbu','piyg','prgn','brbg','puor']],
    ['Multicolor & cyclic',['rainbow','jet','hot','winter','ocean','terrain','twilight']]
  ];
  const PALETTE_LABELS={pastel:'Pastel rainbow',icefirelight:'Ice–fire light',viridislight:'Viridis light',plasmalight:'Plasma light',turbolight:'Turbo light',coolwarm:'Cool–warm',ylgnbu:'YlGnBu',ylorrd:'YlOrRd',ylgn:'YlGn',pubu:'PuBu',bugn:'BuGn',rdylbu:'RdYlBu',rdylgn:'RdYlGn',rdbu:'RdBu',piyg:'PiYG',prgn:'PRGn',brbg:'BrBG',puor:'PuOr'};
  const paletteLabel=name=>PALETTE_LABELS[name]||name[0].toUpperCase()+name.slice(1);
  function cameraFrame(azimuth,elevation){
    const right=[Math.cos(azimuth),-Math.sin(azimuth),0],up=[Math.sin(elevation)*Math.sin(azimuth),Math.sin(elevation)*Math.cos(azimuth),Math.cos(elevation)];
    return {right,up,eye:A.cross(right,up)};
  }
  function backPanes(minimum,maximum,eye){
    return [0,1,2].map(axis=>{
      const side=eye[axis]>=0?minimum[axis]:maximum[axis],axes=[0,1,2].filter(i=>i!==axis);
      const vertices=[[0,0],[1,0],[1,1],[0,1]].map(bits=>{const p=minimum.slice();p[axis]=side;axes.forEach((i,j)=>{p[i]=bits[j]?maximum[i]:minimum[i];});return p;});
      return {axis,side,axes,vertices};
    });
  }
  const translate=text=>window.I18n?.translate(text)||text;
  const format=value=>Math.abs(value)<1e-9?'0':Number(value.toPrecision(4)).toString();
  const tickStep=range=>{const power=10**Math.floor(Math.log10(range/5)),ratio=range/5/power;return (ratio<2?1:ratio<5?2:5)*power;};
  function color(palette,t){const colors=PALETTES[palette]||PALETTES.viridis,index=Math.max(0,Math.min(1,t))*(colors.length-1),i=Math.min(colors.length-2,Math.floor(index)),f=index-i;const rgb=hex=>[1,3,5].map(p=>parseInt(hex.slice(p,p+2),16));const a=rgb(colors[i]),b=rgb(colors[i+1]);return `rgb(${a.map((v,j)=>Math.round(v+(b[j]-v)*f)).join(',')})`;}
  const THEMES={
    dark:{background:'#09191f',panes:['#11272f','#142d35','#193039'],paneGrid:'#28444d',muted:'#9ab8b6',grid:'#183038',zero:'#38545d',box:'#29424a',axis:'#8bbcb5',text:'#bbd5d1',gamma:'#e5f4ef',first:'#78e6cb',other:'#b699ef'},
    white:{background:'#ffffff',panes:['#edf1f5','#f1f4f7','#e6edf2'],paneGrid:'#d4dfe5',muted:'#4e6269',grid:'#e8edef',zero:'#b9c8cc',box:'#c6d2d7',axis:'#486c78',text:'#29444e',gamma:'#243d46',first:'#007d66',other:'#8550b2'}
  };
  const zoneColor=(center,white=false,primaryCenter=[0,0,0])=>THEMES[white?'white':'dark'][A.norm(A.sub(center,primaryCenter))<1e-8?'first':'other'];
  class MomentumPlot {
    constructor(canvas,tooltip,hairlines=null){
      this.canvas=canvas;this.tooltip=tooltip;this.hairlines=hairlines;this.context=canvas.getContext('2d');this.dragMode='pan';this.reset(false);this.data=null;this.projected=[];
      this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas.parentElement);
      let drag=null,pinch=null;const touches=new Map();
      const touchPoint=event=>({id:event.pointerId,x:event.clientX,y:event.clientY});
      const startPinch=()=>{const [a,b]=[...touches.values()],rect=canvas.getBoundingClientRect();pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2,zoom:this.zoom,panX:this.panX,panY:this.panY,ox:rect.left+rect.width/2+13,oy:rect.top+rect.height/2-7.5};drag=null;};
      canvas.addEventListener('contextmenu',event=>event.preventDefault());
      canvas.addEventListener('pointerdown',event=>{if(![0,2].includes(event.button))return;event.preventDefault();canvas.focus();canvas.setPointerCapture(event.pointerId);this.clearHover();if(event.pointerType==='touch'){touches.set(event.pointerId,touchPoint(event));if(touches.size>=2){startPinch();return;}}drag={id:event.pointerId,pan:event.button===2,x:event.clientX,y:event.clientY};});
      canvas.addEventListener('pointermove',event=>{
        if(touches.has(event.pointerId)){
          event.preventDefault();touches.set(event.pointerId,touchPoint(event));
          if(pinch&&touches.size>=2){const [a,b]=[...touches.values()],x=(a.x+b.x)/2,y=(a.y+b.y)/2;this.zoom=Math.max(.2,Math.min(15,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));const ratio=this.zoom/pinch.zoom;this.panX=x-pinch.ox-(pinch.x-pinch.ox-pinch.panX)*ratio;this.panY=y-pinch.oy-(pinch.y-pinch.oy-pinch.panY)*ratio;this.draw();return;}
        }
        if(drag&&drag.id===event.pointerId){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;
          if(drag.pan||event.shiftKey||this.dragMode==='pan'){this.panX+=dx;this.panY+=dy;this.draw();}
          else if(this.dragMode==='zoom')this.zoomBy(Math.exp(-dy*.012));
          else if(this.config?.dimension===3){this.azimuth+=dx*.009;this.elevation=Math.max(-Math.PI/2,Math.min(Math.PI/2,this.elevation+dy*.009));this.draw();}
        }else if(!touches.size&&!drag)this.hover(event);
      });
      const release=event=>{if(touches.delete(event.pointerId)){if(touches.size>=2){startPinch();return;}pinch=null;const remaining=[...touches.values()][0];drag=remaining?{...remaining,pan:true}:null;}else if(drag?.id===event.pointerId)drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
      canvas.addEventListener('pointerleave',()=>this.clearHover());
      canvas.addEventListener('wheel',event=>{event.preventDefault();this.zoomBy(Math.exp(-event.deltaY*.001));},{passive:false});
      canvas.addEventListener('dblclick',()=>this.reset());
      canvas.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;event.preventDefault();
        if(event.key==='Home')return this.reset();
        if(['+','=','-'].includes(event.key))this.zoom=Math.max(.2,Math.min(15,this.zoom*(event.key==='-'?.8:1.25)));
        else {const x=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,y=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;if(this.config?.dimension===3){this.azimuth+=x*.12;this.elevation=Math.max(-1.5,Math.min(1.5,this.elevation+y*.12));}else{this.panX+=x*20;this.panY+=y*20;}}
        this.draw();
      });
    }
    // Same viewing direction as the reference planner's eye = (1.5, 1.5, 1.5).
    reset(draw=true){this.zoom=1;this.panX=0;this.panY=0;this.azimuth=-3*Math.PI/4;this.elevation=Math.atan(1/Math.sqrt(2));this.clearHover();if(draw)this.draw();}
    zoomBy(factor){this.zoom=Math.max(.2,Math.min(15,this.zoom*factor));this.tooltip.hidden=true;this.draw();}
    setDragMode(mode){this.dragMode=mode==='rotate'&&this.config?.dimension!==3?'pan':mode;this.canvas.dataset.dragMode=this.dragMode;this.clearHover();}
    setView(view){this.reset(false);this.azimuth=view==='sideY'?Math.PI/2:0;this.elevation=view==='top'?Math.PI/2:0;this.tooltip.hidden=true;this.draw();}
    update(data,zone,config){if(this.config?.dimension!==config.dimension){this.reset(false);this.dragMode=config.dimension===3?'rotate':'pan';}this.data=data;this.zone=zone;this.centers=A.zoneCenters(data,config.allZones);this.config={...config};this.setDragMode(this.dragMode);this.tooltip.hidden=true;this.draw();}
    clear(){this.data=null;this.projected=[];this.tooltip.hidden=true;this.draw();}
    downloadPng(){
      if(!this.data)return;
      const rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=window.devicePixelRatio||1,theme=THEMES[this.config.whiteBackground?'white':'dark'];
      const output=document.createElement('canvas');output.width=this.canvas.width;output.height=Math.round((h+94)*dpr);
      const ctx=output.getContext('2d');ctx.scale(dpr,dpr);ctx.fillStyle=theme.background;ctx.fillRect(0,0,w,h+94);ctx.drawImage(this.canvas,0,30,w,h);
      ctx.fillStyle=theme.text;ctx.font='12px system-ui';ctx.fillText(`ARPES · ${this.config.dimension}D · hν = ${format(this.config.photonEnergy)} eV`,18,20);
      const left=60,right=w-60,y=h+45,gradient=ctx.createLinearGradient(left,0,right,0),colors=PALETTES[this.config.colorScale];
      colors.forEach((stop,i)=>gradient.addColorStop(i/(colors.length-1),stop));ctx.fillStyle=gradient;ctx.fillRect(left,y,right-left,9);
      ctx.fillStyle=theme.text;ctx.font='10px system-ui';ctx.textAlign='right';ctx.fillText(document.getElementById('colorMinimum').textContent,left-7,y+9);ctx.textAlign='left';ctx.fillText(document.getElementById('colorMaximum').textContent,right+7,y+9);
      ctx.textAlign='center';ctx.fillText(`${document.getElementById('colorLabel').textContent} · ${paletteLabel(this.config.colorScale)}`,w/2,y+27);
      output.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='arpes-momentum-map.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
    }
    draw(){
      this.clearHover();this.projection=null;
      const canvas=this.canvas,ctx=this.context,rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,theme=THEMES[this.config?.whiteBackground?'white':'dark'];
      if(!w||!h)return;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle=theme.background;ctx.fillRect(0,0,w,h);
      if(!this.data){ctx.fillStyle=theme.muted;ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(translate('Enter valid settings to display the momentum map.'),w/2,h/2);return;}
      const c=this.config,dim=c.dimension,scales=A.displayScales(c),unit=scales.units[0],factor=scales.factors[0],yFactor=scales.factors[1];
      const all=[...this.data.points.map(p=>p.displayed),...(c.showBZ?this.centers.flatMap(center=>this.zone.vertices.map(v=>A.add(v,center))):[])];
      const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
      for(const p of all)for(let i=0;i<3;i++){minimum[i]=Math.min(minimum[i],p[i]);maximum[i]=Math.max(maximum[i],p[i]);}
      const center=minimum.map((v,i)=>(v+maximum[i])/2),span=maximum.map((v,i)=>Math.max(v-minimum[i],.01)),left=62,right=w-36,top=38,bottom=h-53;
      const frame=cameraFrame(this.azimuth,this.elevation),rotate=v=>[A.dot(v,frame.right),A.dot(v,frame.up),-A.dot(v,frame.eye)];
      const boxCorners=Array.from({length:8},(_,mask)=>minimum.map((v,i)=>(mask&(1<<i)?maximum[i]:v)));
      const rotatedBounds=boxCorners.map(p=>rotate(A.sub(p,center)));
      const projectedSpan=[0,1].map(i=>Math.max(.01,Math.max(...rotatedBounds.map(p=>p[i]))-Math.min(...rotatedBounds.map(p=>p[i]))));
      const baseScale=dim===2?Math.min((right-left)/(span[0]*1.2),(bottom-top)/(span[1]*1.2)):Math.min((right-left)/(projectedSpan[0]*1.24),(bottom-top)/(projectedSpan[1]*1.24));
      const s=baseScale*this.zoom,ox=(left+right)/2+this.panX,oy=(top+bottom)/2+this.panY;
      const project=p=>{
        const v=A.sub(p,center);if(dim===2)return [ox+v[0]*s,oy-v[1]*s,0];
        const rotated=rotate(v);return [ox+rotated[0]*s,oy-rotated[1]*s,rotated[2]];
      };
      const line=(a,b,stroke,width=1)=>{ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();};
      if(dim===3){
        // Use only the three faces opposite the eye. Do not close the front of the box.
        for(const {axis,side,axes,vertices} of backPanes(minimum,maximum,frame.eye)){
          const face=vertices.map(project);
          const area=face.reduce((sum,p,i)=>{const next=face[(i+1)%face.length];return sum+p[0]*next[1]-next[0]*p[1];},0);
          if(Math.abs(area)<1)continue;
          ctx.beginPath();face.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=theme.panes[axis];ctx.fill();ctx.strokeStyle=theme.box;ctx.lineWidth=.7;ctx.stroke();
          for(const tickAxis of axes){
            const along=axes.find(i=>i!==tickAxis),axisFactor=scales.factors[tickAxis],step=tickStep(span[tickAxis]*axisFactor);
            for(let tick=Math.ceil(minimum[tickAxis]*axisFactor/step)*step;tick<=maximum[tickAxis]*axisFactor+step*.001;tick+=step){
              const start=minimum.slice();start[axis]=side;start[tickAxis]=tick/axisFactor;const end=start.slice();end[along]=maximum[along];line(project(start),project(end),theme.paneGrid,.7);
            }
          }
        }
      }
      ctx.font='11px system-ui';ctx.fillStyle=theme.muted;
      if(dim===2){
        const xMin=(left-ox)/s+center[0],xMax=(right-ox)/s+center[0],yMin=(oy-bottom)/s+center[1],yMax=(oy-top)/s+center[1],step=tickStep((xMax-xMin)*factor),yStep=tickStep((yMax-yMin)*yFactor);
        ctx.textAlign='center';
        for(let x=Math.ceil(xMin*factor/step)*step;x<=xMax*factor+step*.001;x+=step){const px=project([x/factor,0,0])[0];line([px,top],[px,bottom],Math.abs(x)<1e-9?theme.zero:theme.grid);ctx.fillText(format(x),px,bottom+20);}
        ctx.textAlign='right';
        for(let y=Math.ceil(yMin*yFactor/yStep)*yStep;y<=yMax*yFactor+yStep*.001;y+=yStep){const py=project([0,y/yFactor,0])[1];line([left,py],[right,py],Math.abs(y)<1e-9?theme.zero:theme.grid);ctx.fillText(format(y),left-10,py+4);}
        ctx.textAlign='center';ctx.fillText(`kₓ (${unit})`,(left+right)/2,h-10);ctx.save();ctx.translate(16,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText(`kᵧ (${scales.units[1]})`,0,0);ctx.restore();
      }
      ctx.save();ctx.beginPath();ctx.rect(dim===2?left:0,dim===2?top:0,dim===2?right-left:w,dim===2?bottom-top:h);ctx.clip();
      // Index projected edges by screen tile to keep dense, repeated-zone maps responsive.
      const zoneEdges=new Map(),edgeTileSize=32;
      // Draw the reference cell last to preserve green on shared boundaries.
      if(c.showBZ)for(const center of [...this.centers].reverse()){
        const primary=A.norm(A.sub(center,this.centers[0]))<1e-8,stroke=zoneColor(center,c.whiteBackground,this.centers[0]);
        if(dim===2){const face=this.zone.faces[0].map(v=>project(A.add(v,center)));ctx.beginPath();face.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fillStyle=stroke+'0b';ctx.fill();}
        for(const edge of this.zone.edges){
          const a=project(A.add(edge[0],center)),b=project(A.add(edge[1],center)),width=primary?1.8:1.2;
          line(a,b,stroke,width);
          if(dim===3){
            const edge={a,b,stroke,width},padding=4; // Maximum point radius plus half the edge width.
            const x0=Math.floor(Math.max(-padding,Math.min(a[0],b[0])-padding)/edgeTileSize),x1=Math.floor(Math.min(w+padding,Math.max(a[0],b[0])+padding)/edgeTileSize);
            const y0=Math.floor(Math.max(-padding,Math.min(a[1],b[1])-padding)/edgeTileSize),y1=Math.floor(Math.min(h+padding,Math.max(a[1],b[1])+padding)/edgeTileSize);
            for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
              const key=`${x},${y}`;if(!zoneEdges.has(key))zoneEdges.set(key,[]);zoneEdges.get(key).push(edge);
            }
          }
        }
      }
      const value=p=>c.colorBy==='scan'?p.scan:c.colorBy==='kz'?p.absolute[2]*scales.factors[2]:p.slit,values=this.data.points.map(value),lo=Math.min(...values),hi=Math.max(...values);
      this.projected=this.data.points.map((p,i)=>({screen:project(p.displayed),point:p,value:values[i],index:i})).sort((a,b)=>b.screen[2]-a.screen[2]);
      const pointRadius=this.data.points.length>6000?1.4:dim===2?2.2:2.5;
      for(const p of this.projected){
        ctx.fillStyle=color(c.colorScale,hi===lo?.5:(p.value-lo)/(hi-lo));ctx.beginPath();ctx.arc(p.screen[0],p.screen[1],pointRadius,0,Math.PI*2);ctx.fill();
        // Points are painted back to front. Restore only the portions of zone edges
        // nearer than this point, clipped to its disk so rear edges stay behind it.
        let clipped=false;
        const nearbyEdges=zoneEdges.get(`${Math.floor(p.screen[0]/edgeTileSize)},${Math.floor(p.screen[1]/edgeTileSize)}`)||[];
        for(const edge of nearbyEdges){
          let {a,b}=edge;const depth=p.screen[2]+1e-10,radius=pointRadius+edge.width/2;
          if(Math.min(a[2],b[2])>depth)continue;
          if(p.screen[0]<Math.min(a[0],b[0])-radius||p.screen[0]>Math.max(a[0],b[0])+radius||p.screen[1]<Math.min(a[1],b[1])-radius||p.screen[1]>Math.max(a[1],b[1])+radius)continue;
          if(Math.max(a[2],b[2])>depth){
            const t=(depth-a[2])/(b[2]-a[2]),intersection=a.map((v,i)=>v+(b[i]-v)*t);
            if(a[2]>depth)a=intersection;else b=intersection;
          }
          const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
          if(length2<1e-12)continue;
          const t=Math.max(0,Math.min(1,((p.screen[0]-a[0])*dx+(p.screen[1]-a[1])*dy)/length2));
          if((a[0]+t*dx-p.screen[0])**2+(a[1]+t*dy-p.screen[1])**2>radius*radius)continue;
          // The current path is still the point's circle until the first line.
          if(!clipped){ctx.save();ctx.clip();clipped=true;}
          line(a,b,edge.stroke,edge.width);
        }
        if(clipped)ctx.restore();
      }
      ctx.restore();
      if(dim===3){
        for(let i=0;i<3;i++){
          // Label silhouette edges of the back panes, not the hidden front corner.
          const fixed=[0,1,2].filter(j=>j!==i),candidates=[];
          for(let mask=0;mask<4;mask++){
            const start=minimum.slice();fixed.forEach((j,k)=>{start[j]=mask&(1<<k)?maximum[j]:minimum[j];});
            if(!fixed.some(j=>start[j]===(frame.eye[j]>=0?minimum[j]:maximum[j])))continue;
            const midpoint=start.slice();midpoint[i]=center[i];candidates.push({start,screen:project(midpoint)});
          }
          candidates.sort((a,b)=>i===2?a.screen[0]-b.screen[0]:b.screen[1]-a.screen[1]);
          const start=candidates[0].start,end=start.slice();end[i]=maximum[i];
          const screenStart=project(start),screenEnd=project(end);if(Math.hypot(screenEnd[0]-screenStart[0],screenEnd[1]-screenStart[1])<1)continue;
          line(project(start),project(end),theme.axis);const midpoint=start.map((v,j)=>(v+end[j])/2),label=project(midpoint);ctx.fillStyle=theme.text;ctx.textAlign='center';ctx.font='11px system-ui';ctx.fillText(`${['kₓ','kᵧ','kᶻ'][i]} (${scales.units[i]})`,label[0]+(i===2?-37:0),label[1]+(i===2?0:34));
          const axisFactor=scales.factors[i],step=tickStep(span[i]*axisFactor);
          for(let tick=Math.ceil(start[i]*axisFactor/step)*step;tick<=end[i]*axisFactor+step*.001;tick+=step){const p=start.slice();p[i]=tick/axisFactor;const screen=project(p);line([screen[0]-3,screen[1]],[screen[0]+3,screen[1]],theme.axis);ctx.font='10px system-ui';ctx.fillText(format(tick),screen[0]+(i===2?-13:0),screen[1]+(i===2?3:16));}
        }
      }
      if(c.showBZ)for(const center of this.centers){const gamma=project(center);if(gamma[0]>left&&gamma[0]<right&&gamma[1]>top&&gamma[1]<bottom){ctx.fillStyle=theme.gamma;ctx.textAlign='left';ctx.fillText('Γ',gamma[0]+7,gamma[1]-8);}}
      document.getElementById('colorMinimum').textContent=format(lo);document.getElementById('colorMaximum').textContent=format(hi);
      document.getElementById('colorLabel').textContent=c.colorBy==='kz'?`${translate('Unfolded kᶻ')} / ${scales.units[2]}`:`${translate(c.colorBy==='scan'?(c.scanMode==='polar'?'Polar / tilt angle':'Deflector angle'):'Slit angle')} / °`;
      document.getElementById('colorGradient').style.background=`linear-gradient(to right, ${PALETTES[c.colorScale].join(',')})`;
      document.getElementById('firstZoneKey').style.background=theme.first;document.getElementById('otherZoneKey').style.background=theme.other;
      document.getElementById('firstZoneLabel').textContent=translate('Brillouin zone');document.getElementById('otherZoneLegend').hidden=!c.allZones;
      this.scales=scales;this.clip=dim===2?{left,right,top,bottom}:{left:0,right:w,top:0,bottom:h};
      this.projection={project,minimum,maximum,frame,w,h};
    }
    clearHover(){
      this.hovered=null;this.tooltip.hidden=true;
      if(this.hairlines){this.hairlines.setAttribute('hidden','');this.hairlines.removeAttribute('data-point-index');if(this.hairlines.childElementCount)this.hairlines.replaceChildren();}
    }
    showHairlines(nearest){
      if(!this.hairlines||!this.projection)return;
      const {project,minimum,maximum,frame,w,h}=this.projection,{left,right,top,bottom}=this.clip,point=nearest.point.displayed,screen=nearest.screen,segments=[];
      if(this.config.dimension===2){
        segments.push({a:[left,screen[1]],b:[right,screen[1]],kind:'hover-projection'},{a:[screen[0],top],b:[screen[0],bottom],kind:'hover-projection'});
      }else{
        for(const {axis,side,axes} of backPanes(minimum,maximum,frame.eye)){
          if(Math.abs(frame.eye[axis])<1e-8)continue;
          const foot=point.slice();foot[axis]=side;
          segments.push({a:screen,b:project(foot),kind:'hover-spike'});
          for(const along of axes){const a=foot.slice(),b=foot.slice();a[along]=minimum[along];b[along]=maximum[along];segments.push({a:project(a),b:project(b),kind:'hover-projection'});}
        }
      }
      const stroke=this.config.whiteBackground?'#364a58':'#d7ebe5',clipId=this.hairlines.id+'Clip';
      this.hairlines.setAttribute('viewBox',`0 0 ${w} ${h}`);
      this.hairlines.innerHTML=`<defs><clipPath id="${clipId}"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs><g clip-path="url(#${clipId})" fill="none" stroke="${stroke}" stroke-width="1.2"><g stroke-dasharray="4 4">${segments.map(({a,b,kind})=>`<line class="${kind}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`).join('')}</g><circle cx="${screen[0]}" cy="${screen[1]}" r="5" stroke-width="1.8"/></g>`;
      this.hairlines.setAttribute('data-point-index',nearest.index);this.hairlines.removeAttribute('hidden');
    }
    hover(event){
      if(!this.data||!this.clip)return;const rect=this.canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      if(x<this.clip.left||x>this.clip.right||y<this.clip.top||y>this.clip.bottom){this.clearHover();return;}
      let nearest=null,distance=81;
      // Prefer the frontmost point when projected distances tie.
      for(let i=this.projected.length-1;i>=0;i--){const p=this.projected[i];if(p.screen[0]<this.clip.left||p.screen[0]>this.clip.right||p.screen[1]<this.clip.top||p.screen[1]>this.clip.bottom)continue;const d=(p.screen[0]-x)**2+(p.screen[1]-y)**2;if(d<distance){distance=d;nearest=p;}}
      if(!nearest){this.clearHover();return;}
      if(this.hovered?.point!==nearest.point){this.showHairlines(nearest);this.hovered=nearest;}
      const p=nearest.point,labels=['kₓ','kᵧ','kᶻ'];this.tooltip.textContent=p.displayed.slice(0,this.config.dimension).map((v,i)=>`${labels[i]} = ${format(v*this.scales.factors[i])} ${this.scales.units[i]}`).join('\n')+`\n${translate('Slit angle')}: ${format(p.slit)}°\n${translate(this.config.scanMode==='polar'?'Polar / tilt angle':'Deflector angle')}: ${format(p.scan)}°`;
      this.tooltip.hidden=false;this.tooltip.style.left=Math.max(8,Math.min(x+14,rect.width-this.tooltip.offsetWidth-8))+'px';this.tooltip.style.top=Math.max(8,Math.min(y+14,rect.height-this.tooltip.offsetHeight-8))+'px';
    }
  }
  function cellSvg(conventional,primitive,centering,dim=3,mini=false){
    const corners=basis=>Array.from({length:2**basis.length},(_,mask)=>A.combine(basis,basis.map((_,i)=>mask&(1<<i)?1:0)));
    const cc=corners(conventional.slice(0,dim)),pc=corners(primitive.slice(0,dim)),extra=[];
    if(centering==='C')extra.push(A.combine(conventional,[.5,.5,0]));
    if(centering==='C'&&dim===3)extra.push(A.combine(conventional,[.5,.5,1]));
    if(centering==='I')extra.push(A.combine(conventional,[.5,.5,.5]));
    if(centering==='F')for(let axis=0;axis<3;axis++)for(const side of [0,1]){const v=[.5,.5,.5];v[axis]=side;extra.push(A.combine(conventional,v));}
    if(centering==='R')extra.push(...[[2/3,1/3,1/3],[1/3,2/3,2/3]].map(v=>A.combine(conventional,v)));
    const raw=p=>dim===2?[p[0],-p[1]]:[.82*p[0]-.55*p[1],.3*p[0]+.42*p[1]-p[2]],all=[...cc,...pc].map(raw),min=[0,1].map(i=>Math.min(...all.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...all.map(p=>p[i]))),s=Math.min(370/Math.max(.1,max[0]-min[0]),215/Math.max(.1,max[1]-min[1]));
    const project=p=>{const r=raw(p);return [250+(r[0]-(max[0]+min[0])/2)*s,145+(r[1]-(max[1]+min[1])/2)*s];};
    let svg='';
    const edges=(points,color,width,dash='')=>{for(let mask=0;mask<points.length;mask++)for(let i=0;i<dim;i++)if(!(mask&(1<<i))){const a=project(points[mask]),b=project(points[mask|(1<<i)]);svg+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${width}" ${dash}/>`;}};
    edges(cc,'#71949e',2,'stroke-dasharray="5 4"');edges(pc,'#77e4c8',mini?4:2.8);
    for(const p of [...cc,...extra]){const v=project(p);svg+=`<circle cx="${v[0]}" cy="${v[1]}" r="${mini?6:4}" fill="#ffb45d"/>`;}
    if(!mini)primitive.forEach((p,i)=>{const v=project(p);svg+=`<text x="${v[0]+9}" y="${v[1]-8}" fill="#77e4c8" font-size="14">p${i+1}</text>`;});
    return svg;
  }
  window.ArpesPlot={MomentumPlot,cellSvg,format,zoneColor,PALETTES,PALETTE_GROUPS,paletteLabel,cameraFrame,backPanes};
}());
