(function () {
  'use strict';
  const A=window.Arpes;
  const PALETTES={viridis:['#440154','#3b528b','#21918c','#5ec962','#fde725'],magma:['#000004','#51127c','#b73779','#fc8961','#fcfdbf'],plasma:['#0d0887','#7e03a8','#cc4778','#f89540','#f0f921'],coolwarm:['#3b4cc0','#8db0fe','#dddddd','#f4987a','#b40426'],turbo:['#30123b','#466be3','#1ae4b6','#a4fc3c','#f9ba38','#e3440a','#7a0403']};
  const translate=text=>window.I18n?.translate(text)||text;
  const format=value=>Math.abs(value)<1e-9?'0':Number(value.toPrecision(4)).toString();
  const tickStep=range=>{const power=10**Math.floor(Math.log10(range/5)),ratio=range/5/power;return (ratio<2?1:ratio<5?2:5)*power;};
  function color(palette,t){const colors=PALETTES[palette]||PALETTES.viridis,index=Math.max(0,Math.min(1,t))*(colors.length-1),i=Math.min(colors.length-2,Math.floor(index)),f=index-i;const rgb=hex=>[1,3,5].map(p=>parseInt(hex.slice(p,p+2),16));const a=rgb(colors[i]),b=rgb(colors[i+1]);return `rgb(${a.map((v,j)=>Math.round(v+(b[j]-v)*f)).join(',')})`;}
  const THEMES={
    dark:{background:'#09191f',muted:'#9ab8b6',grid:'#183038',zero:'#38545d',box:'#29424a',axis:'#8bbcb5',text:'#bbd5d1',gamma:'#e5f4ef',first:'#78e6cb',other:'#b699ef'},
    white:{background:'#ffffff',muted:'#4e6269',grid:'#e8edef',zero:'#b9c8cc',box:'#c6d2d7',axis:'#486c78',text:'#29444e',gamma:'#243d46',first:'#007d66',other:'#8550b2'}
  };
  const zoneColor=(center,white=false,allZones=true)=>THEMES[white?'white':'dark'][!allZones||A.norm(center)<1e-8?'first':'other'];
  class MomentumPlot {
    constructor(canvas,tooltip){
      this.canvas=canvas;this.tooltip=tooltip;this.context=canvas.getContext('2d');this.reset(false);this.data=null;this.projected=[];
      this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas.parentElement);
      let drag=null;
      canvas.addEventListener('contextmenu',event=>event.preventDefault());
      canvas.addEventListener('pointerdown',event=>{if(![0,2].includes(event.button))return;event.preventDefault();canvas.focus();drag={id:event.pointerId,pan:event.button===2,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);tooltip.hidden=true;});
      canvas.addEventListener('pointermove',event=>{
        if(drag){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;
          if(this.config?.dimension===3&&!drag.pan&&!event.shiftKey){this.azimuth+=dx*.009;this.elevation=Math.max(-Math.PI/2,Math.min(Math.PI/2,this.elevation+dy*.009));}else{this.panX+=dx;this.panY+=dy;}this.draw();
        }else this.hover(event);
      });
      const release=()=>{drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
      canvas.addEventListener('pointerleave',()=>{tooltip.hidden=true;});
      canvas.addEventListener('wheel',event=>{event.preventDefault();this.zoom=Math.max(.2,Math.min(15,this.zoom*Math.exp(-event.deltaY*.001)));tooltip.hidden=true;this.draw();},{passive:false});
      canvas.addEventListener('dblclick',()=>this.reset());
      canvas.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;event.preventDefault();
        if(event.key==='Home')return this.reset();
        if(['+','=','-'].includes(event.key))this.zoom=Math.max(.2,Math.min(15,this.zoom*(event.key==='-'?.8:1.25)));
        else {const x=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,y=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;if(this.config?.dimension===3){this.azimuth+=x*.12;this.elevation=Math.max(-1.5,Math.min(1.5,this.elevation+y*.12));}else{this.panX+=x*20;this.panY+=y*20;}}
        this.draw();
      });
    }
    reset(draw=true){this.zoom=1;this.panX=0;this.panY=0;this.azimuth=-.6;this.elevation=.45;if(draw)this.draw();}
    setView(view){this.reset(false);this.azimuth=view==='sideY'?Math.PI/2:0;this.elevation=view==='top'?Math.PI/2:0;this.tooltip.hidden=true;this.draw();}
    update(data,zone,config){if(this.config?.dimension!==config.dimension)this.reset(false);this.data=data;this.zone=zone;this.centers=A.zoneCenters(data,config.allZones);this.config={...config};this.tooltip.hidden=true;this.draw();}
    clear(){this.data=null;this.projected=[];this.tooltip.hidden=true;this.draw();}
    draw(){
      const canvas=this.canvas,ctx=this.context,rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,theme=THEMES[this.config?.whiteBackground?'white':'dark'];
      if(!w||!h)return;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle=theme.background;ctx.fillRect(0,0,w,h);
      if(!this.data){ctx.fillStyle=theme.muted;ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(translate('Enter valid settings to display the momentum map.'),w/2,h/2);return;}
      const c=this.config,dim=c.dimension,scales=A.displayScales(c),unit=scales.units[0],factor=scales.factors[0],yFactor=scales.factors[1];
      const all=[...this.data.points.map(p=>p.displayed),...(c.showBZ?this.centers.flatMap(center=>this.zone.vertices.map(v=>A.add(v,center))):[])];
      const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
      for(const p of all)for(let i=0;i<3;i++){minimum[i]=Math.min(minimum[i],p[i]);maximum[i]=Math.max(maximum[i],p[i]);}
      const center=minimum.map((v,i)=>(v+maximum[i])/2),span=maximum.map((v,i)=>Math.max(v-minimum[i],.01)),left=62,right=w-36,top=38,bottom=h-53;
      const rotate=v=>{const x=Math.cos(this.azimuth)*v[0]-Math.sin(this.azimuth)*v[1],y=Math.sin(this.azimuth)*v[0]+Math.cos(this.azimuth)*v[1];return [x,Math.sin(this.elevation)*y+Math.cos(this.elevation)*v[2],Math.cos(this.elevation)*y-Math.sin(this.elevation)*v[2]];};
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
      if(c.showBZ)for(const center of this.centers){
        if(dim===2){const face=this.zone.faces[0].map(v=>project(A.add(v,center)));ctx.beginPath();face.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fillStyle=zoneColor(center,c.whiteBackground,c.allZones)+'0b';ctx.fill();}
        for(const edge of this.zone.edges)line(project(A.add(edge[0],center)),project(A.add(edge[1],center)),zoneColor(center,c.whiteBackground,c.allZones),!c.allZones||A.norm(center)<1e-8?1.8:1.2);
      }
      const value=p=>c.colorBy==='scan'?p.scan:c.colorBy==='kz'?p.absolute[2]*scales.factors[2]:p.slit,values=this.data.points.map(value),lo=Math.min(...values),hi=Math.max(...values);
      this.projected=this.data.points.map((p,i)=>({screen:project(p.displayed),point:p,value:values[i]})).sort((a,b)=>b.screen[2]-a.screen[2]);
      const pointRadius=this.data.points.length>6000?1.4:dim===2?2.2:2.5;
      for(const p of this.projected){ctx.fillStyle=color(c.colorScale,hi===lo?.5:(p.value-lo)/(hi-lo));ctx.beginPath();ctx.arc(p.screen[0],p.screen[1],pointRadius,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      if(dim===3){
        for(let mask=0;mask<8;mask++)for(let i=0;i<3;i++)if(!(mask&(1<<i)))line(project(boxCorners[mask]),project(boxCorners[mask|(1<<i)]),theme.box,.7);
        for(let i=0;i<3;i++){
          const start=minimum.slice(),end=minimum.slice();end[i]=maximum[i];
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
      document.getElementById('firstZoneLabel').textContent=translate(c.allZones?'First BZ · Γ = 0':'Brillouin zone');document.getElementById('otherZoneLegend').hidden=!c.allZones;
      this.scales=scales;this.clip=dim===2?{left,right,top,bottom}:{left:0,right:w,top:0,bottom:h};
    }
    hover(event){
      if(!this.data||!this.clip)return;const rect=this.canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      if(x<this.clip.left||x>this.clip.right||y<this.clip.top||y>this.clip.bottom){this.tooltip.hidden=true;return;}
      let nearest=null,distance=81;
      for(const p of this.projected){const d=(p.screen[0]-x)**2+(p.screen[1]-y)**2;if(d<distance){distance=d;nearest=p;}}
      if(!nearest){this.tooltip.hidden=true;return;}
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
  window.ArpesPlot={MomentumPlot,cellSvg,format,zoneColor};
}());
