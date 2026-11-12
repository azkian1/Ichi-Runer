// Cosmetic boost exhaust. Geometry, materials and particles are allocated once.
// The world scrolls toward +Z; recorded emitter positions follow the same scroll.
export function createBoostArt(THREE,scene){
  const HISTORY=52,STRANDS=6,PARTICLES=144,INTERVAL=1/45,LIFE=1.12;
  const root=new THREE.Group();root.name='Elemental boost trail';root.visible=false;scene.add(root);
  const hx=new Float32Array(HISTORY),hy=new Float32Array(HISTORY),hz=new Float32Array(HISTORY),ha=new Float32Array(HISTORY),he=new Float32Array(HISTORY);
  const palettes={plain:[0x54cfff,0xd5f8ff],lightning:[0xa76aff,0xf1e5ff],water:[0x087fe8,0x61edff],fire:[0xff3f0b,0xffd15b],wind:[0x40eab9,0xd2fff0],darkness:[0x7922d0,0xd28aff]};
  const modes={plain:0,lightning:1,water:2,fire:3,wind:4,darkness:5};
  const ribbonPositions=new Float32Array(HISTORY*STRANDS*6),ribbonEnergy=new Float32Array(HISTORY*STRANDS*2),ribbonUV=new Float32Array(HISTORY*STRANDS*4),indices=[];
  for(let s=0;s<STRANDS;s++)for(let j=0;j<HISTORY;j++){const v=(s*HISTORY+j)*2;ribbonUV[v*2]=0;ribbonUV[v*2+1]=j/(HISTORY-1);ribbonUV[v*2+2]=1;ribbonUV[v*2+3]=j/(HISTORY-1);if(j<HISTORY-1)indices.push(v,v+1,v+2,v+1,v+3,v+2);}
  function attribute(array,size){const a=new THREE.BufferAttribute(array,size);a.setUsage(THREE.DynamicDrawUsage);return a;}
  const ribbons=new THREE.BufferGeometry();ribbons.setAttribute('position',attribute(ribbonPositions,3));ribbons.setAttribute('aEnergy',attribute(ribbonEnergy,1));ribbons.setAttribute('uv',new THREE.BufferAttribute(ribbonUV,2));ribbons.setIndex(indices);
  const ribbonVertex=`attribute float aEnergy;varying vec2 vUv;varying float vEnergy;void main(){vUv=uv;vEnergy=aEnergy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const ribbonFragment=`uniform vec3 uColor,uEdge;uniform float uTime,uMode,uCore;varying vec2 vUv;varying float vEnergy;void main(){float across=abs(vUv.x*2.0-1.0);float edge=pow(max(0.0,1.0-across),mix(1.4,10.0,uCore));float pulse=0.86+0.14*sin(vUv.y*25.0-uTime*12.0);if(uMode>0.5&&uMode<1.5)pulse=0.68+0.32*step(0.1,sin(vUv.y*91.0-uTime*34.0));if(uMode>2.5&&uMode<3.5)pulse*=0.72+0.28*sin(vUv.y*40.0-uTime*18.0);vec3 c=mix(uColor,uEdge,uCore*0.67+(1.0-vUv.y)*0.16);float a=edge*vEnergy*pulse*mix(0.23,0.78,uCore);if(a<0.003)discard;gl_FragColor=vec4(c,a);
  #include <colorspace_fragment>
  }`;
  function ribbonMaterial(core){return new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(palettes.plain[0])},uEdge:{value:new THREE.Color(palettes.plain[1])},uTime:{value:0},uMode:{value:0},uCore:{value:core}},vertexShader:ribbonVertex,fragmentShader:ribbonFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});}
  const haloMaterial=ribbonMaterial(0),coreMaterial=ribbonMaterial(1),halo=new THREE.Mesh(ribbons,haloMaterial),core=new THREE.Mesh(ribbons,coreMaterial);
  halo.name='Boost flowing ribbons';core.name='Boost luminous filaments';halo.frustumCulled=core.frustumCulled=false;halo.renderOrder=4;core.renderOrder=5;root.add(halo,core);
  const linePositions=new Float32Array(3*22*6),lineEnergy=new Float32Array(3*22*2),lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',attribute(linePositions,3));lineGeometry.setAttribute('aEnergy',attribute(lineEnergy,1));
  const lineMaterial=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(palettes.plain[1])}},vertexShader:`attribute float aEnergy;varying float vEnergy;void main(){vEnergy=aEnergy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform vec3 uColor;varying float vEnergy;void main(){if(vEnergy<0.003)discard;gl_FragColor=vec4(uColor,vEnergy*0.8);
  #include <colorspace_fragment>
  }`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const bolts=new THREE.LineSegments(lineGeometry,lineMaterial);bolts.name='Boost electrical sparks';bolts.frustumCulled=false;bolts.renderOrder=6;root.add(bolts);
  const pp=new Float32Array(PARTICLES*3),pv=new Float32Array(PARTICLES*3),pa=new Float32Array(PARTICLES),pl=new Float32Array(PARTICLES),pe=new Float32Array(PARTICLES),ps=new Float32Array(PARTICLES),pr=new Float32Array(PARTICLES),particleEnergy=new Float32Array(PARTICLES);
  const particles=new THREE.BufferGeometry();particles.setAttribute('position',attribute(pp,3));particles.setAttribute('aEnergy',attribute(particleEnergy,1));particles.setAttribute('aSize',attribute(ps,1));particles.setAttribute('aSeed',attribute(pr,1));
  const particleMaterial=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(palettes.plain[0])},uEdge:{value:new THREE.Color(palettes.plain[1])},uTime:{value:0},uMode:{value:0}},vertexShader:`attribute float aEnergy,aSize,aSeed;uniform float uMode;varying float vEnergy,vSeed;void main(){vEnergy=aEnergy;vSeed=aSeed;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;float size=aSize*640.0/max(1.0,-p.z);gl_PointSize=uMode>4.5?clamp(size,16.0,44.0):clamp(size,0.0,94.0);}`,fragmentShader:`uniform vec3 uColor,uEdge;uniform float uTime,uMode;varying float vEnergy,vSeed;void main(){vec2 q=gl_PointCoord*2.0-1.0;float r=length(q);float a=pow(max(0.0,1.0-r),2.0);vec3 c=mix(uColor,uEdge,0.4);if(uMode>4.5){float cloud=0.72+0.18*sin(q.x*8.0+vSeed*31.0+uTime)+0.1*sin(q.y*11.0-vSeed*17.0);a=pow(max(0.0,1.0-r),0.9)*cloud;c=mix(vec3(0.025,0.008,0.055),uColor,smoothstep(0.05,0.9,r)*0.78);}else if(uMode>2.5&&uMode<3.5){q.y=(q.y+0.12)*0.75;a=pow(max(0.0,1.0-length(q)),2.1);c=mix(uColor,uEdge,max(0.0,1.0-r));}else if(uMode>1.5&&uMode<2.5){a=max(a*0.7,exp(-pow((r-0.67)*10.0,2.0))*0.5);}else if(uMode>3.5&&uMode<4.5){a*=0.6;}a*=vEnergy;if(a<0.004)discard;gl_FragColor=vec4(c,a);
  #include <colorspace_fragment>
  }`,transparent:true,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false});
  const motes=new THREE.Points(particles,particleMaterial);motes.name='Boost pooled elemental particles';motes.frustumCulled=false;motes.renderOrder=7;root.add(motes);
  let historyCount=0,head=-1,sampleClock=0,emission=0,particleHead=0,intensity=0,lastX=0,lastY=0,lastZ=4,initialized=false,currentElement='',mode=0,clock=0,liveParticles=0,liveSamples=0,seed=1977;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function school(element){currentElement=palettes[element]?element:'plain';mode=modes[currentElement];const p=palettes[currentElement];for(const m of[haloMaterial,coreMaterial,particleMaterial]){m.uniforms.uColor.value.setHex(p[0]);m.uniforms.uEdge.value.setHex(p[1]);m.uniforms.uMode.value=mode;}lineMaterial.uniforms.uColor.value.setHex(p[1]);}
  function clear(){historyCount=0;head=-1;sampleClock=emission=intensity=liveParticles=liveSamples=0;initialized=false;he.fill(0);pe.fill(0);ribbonEnergy.fill(0);lineEnergy.fill(0);particleEnergy.fill(0);root.visible=false;}
  function update(dt,{active=false,strength=0,element='plain',x=0,y=0,z=4,speed=15,elapsed=0,reducedMotion=false}={}){
    dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;if(dt===0)return;
    x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;z=Number.isFinite(z)?z:4;speed=Number.isFinite(speed)?Math.max(0,speed):15;
    if(currentElement!==element)school(element);clock=Number.isFinite(elapsed)?elapsed:clock+dt;
    const target=active?Math.max(0,Math.min(1,Number.isFinite(strength)?strength:0)):0;intensity+=(target-intensity)*(1-Math.exp(-dt*(active?16:5.5)));
    if(!active&&intensity<.002&&liveSamples===0&&liveParticles===0){root.visible=false;initialized=false;return;}
    if(!initialized){lastX=x;lastY=y;lastZ=z;initialized=true;}
    const scroll=speed*dt;liveSamples=0;
    for(let j=0;j<historyCount;j++){const i=(head-j+HISTORY)%HISTORY;hz[i]+=scroll;ha[i]+=dt;if(ha[i]<LIFE&&he[i]>.005)liveSamples++;}
    sampleClock+=dt;
    while(sampleClock>=INTERVAL){sampleClock-=INTERVAL;const fraction=Math.max(0,Math.min(1,1-sampleClock/dt));head=(head+1)%HISTORY;hx[head]=lastX+(x-lastX)*fraction;hy[head]=lastY+(y-lastY)*fraction;hz[head]=lastZ+(z-lastZ)*fraction+speed*sampleClock;ha[head]=sampleClock;he[head]=active?intensity:0;historyCount=Math.min(HISTORY,historyCount+1);if(he[head]>.005)liveSamples++;}
    lastX=x;lastY=y;lastZ=z;const movement=reducedMotion?.35:1;
    for(let s=0;s<STRANDS;s++){
      let tailX=x,tailY=y,tailZ=z;
      for(let j=0;j<HISTORY;j++){
      const i=(head-j+HISTORY)%HISTORY,valid=j<historyCount&&ha[i]<LIFE,age=valid?ha[i]/LIFE:1,side=s%2?1:-1,pair=s>>1,phase=age*8+s*1.9+clock*(mode===4?2.3:1.1)*movement;
      let ox=side*(.27+pair*.15),oy=.32+pair*.22,width=.08;
      if(mode===1){const jag=Math.sin(Math.floor(age*30)*17.4+s*9+Math.floor(clock*20)*3.1);ox+=jag*(.05+age*.13)*movement;oy+=jag*.09*movement;width=.048;}
      else if(mode===2){ox+=Math.sin(phase)*.18*movement;oy+=Math.cos(phase)*.16*movement;width=.14;}
      else if(mode===3){ox+=Math.sin(phase*1.7)*age*.17*movement;oy+=age*.45+Math.sin(phase)*.09*movement;width=.13*(1-age*.4);}
      else if(mode===4){ox=Math.cos(phase)*(.36+pair*.13+age*.3);oy=.58+Math.sin(phase)*(.22+age*.14)*movement;width=.041;}
      else if(mode===5){ox+=Math.sin(phase)*.14*movement;oy+=age*.22+Math.cos(phase)*.1*movement;width=.13;}
      else{ox+=Math.sin(phase)*.055*movement;oy+=Math.cos(phase)*.055*movement;}
      const taper=(.3+.7*Math.sin(Math.PI*(.12+age*.82)))*(1-age*.52),a=valid?he[i]*Math.pow(1-age,1.35)*(reducedMotion?.7:1):0,angle=pair*.65+Math.sin(phase*.4)*.45,cx=valid?Math.cos(angle)*width*taper:0,cy=valid?Math.sin(angle)*width*taper:0;
      const v=(s*HISTORY+j)*2,p=v*3,px=valid?hx[i]+ox:tailX,py=valid?hy[i]+oy:tailY,pz=valid?hz[i]+.55+pair*.08:tailZ;
      if(valid){tailX=px;tailY=py;tailZ=pz;}
      ribbonPositions[p]=px-cx;ribbonPositions[p+1]=py-cy;ribbonPositions[p+2]=pz;ribbonPositions[p+3]=px+cx;ribbonPositions[p+4]=py+cy;ribbonPositions[p+5]=pz;ribbonEnergy[v]=ribbonEnergy[v+1]=a;
      }
    }
    bolts.visible=mode===1||mode===0;
    if(bolts.visible)for(let s=0;s<3;s++)for(let j=0;j<22;j++)for(let end=0;end<2;end++){
      const n=j+end,k=Math.min(historyCount-1,Math.round(n/22*(HISTORY-1))),i=(head-Math.max(0,k)+HISTORY)%HISTORY,p=((s*22+j)*2+end)*3,a=historyCount>0&&ha[i]<LIFE?he[i]*Math.pow(1-ha[i]/LIFE,1.5):0,jag=Math.sin(n*17+s*2+Math.floor(clock*24))*movement;
      linePositions[p]=(a>0?hx[i]:x)+(s-1)*.4+jag*(mode===1?.12:.03);linePositions[p+1]=(a>0?hy[i]:y)+.5+s*.18+jag*.08;linePositions[p+2]=(a>0?hz[i]:z)+.6;lineEnergy[p/3]=a*(mode===1?1:.3);
    }
    emission+=active?dt*intensity*(reducedMotion?26:96):0;
    while(emission>=1){emission--;const i=particleHead++%PARTICLES,p=i*3,a=random()*Math.PI*2,r=.12+random()*.32;pp[p]=x+Math.cos(a)*r;pp[p+1]=y+.3+random()*.65;pp[p+2]=z+.55+random()*.3;pv[p]=Math.cos(a)*(.3+random()*.5);pv[p+1]=mode===3?.5+random()*1.1:mode===5?.3+random()*.4:(random()-.4)*.6;pv[p+2]=1+random()*2;pa[i]=0;pl[i]=mode===5?.62+random()*.4:.35+random()*.45;pe[i]=intensity;ps[i]=mode===5?.48+random()*.42:mode===2?.07+random()*.12:mode===3?.1+random()*.12:.035+random()*.065;pr[i]=random();}
    liveParticles=0;
    for(let i=0;i<PARTICLES;i++){pa[i]+=dt;const p=i*3,t=pl[i]>0?pa[i]/pl[i]:1;if(t>=1||pe[i]<.005){particleEnergy[i]=0;continue;}liveParticles++;pp[p]+=pv[p]*dt;pp[p+1]+=pv[p+1]*dt;pp[p+2]+=scroll+pv[p+2]*dt;if(mode===4)pp[p]+=Math.sin(clock*7+pr[i]*19)*dt*.45*movement;particleEnergy[i]=pe[i]*Math.sin(Math.PI*Math.min(1,t*1.15))*Math.pow(1-t,.65);}
    root.visible=liveSamples>0||liveParticles>0;ribbons.attributes.position.needsUpdate=ribbons.attributes.aEnergy.needsUpdate=true;particles.attributes.position.needsUpdate=particles.attributes.aEnergy.needsUpdate=particles.attributes.aSize.needsUpdate=particles.attributes.aSeed.needsUpdate=true;
    if(bolts.visible)lineGeometry.attributes.position.needsUpdate=lineGeometry.attributes.aEnergy.needsUpdate=true;
    haloMaterial.uniforms.uTime.value=coreMaterial.uniforms.uTime.value=particleMaterial.uniforms.uTime.value=clock;
  }
  return {update,clear,get count(){return root.visible?liveSamples+liveParticles:0;},get strength(){return intensity;}};
}
