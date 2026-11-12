// Lightning charge: an electric dart, a wound plasma cocoon and a pooled wake.
// Cosmetic only. Five draw calls; all GPU buffers are allocated at construction.
export function createChargeArt(THREE,scene){
  const HISTORY=32,STRANDS=4,BOLTS=9,SEGMENTS=18,PARTICLES=96,INTERVAL=1/60,LIFE=.38;
  const root=new THREE.Group(),body=new THREE.Group();root.name='Lightning charge';body.name='Electric dart cocoon';root.visible=false;root.add(body);scene.add(root);
  const violet=new THREE.Color(0xa76aff),hot=new THREE.Color(0xf0ddff);
  const dynamic=(array,size)=>{const a=new THREE.BufferAttribute(array,size);a.setUsage(THREE.DynamicDrawUsage);return a;};
  const uniforms=()=>({uEnergy:{value:0},uTime:{value:0},uMotion:{value:1},uColor:{value:violet.clone()},uHot:{value:hot.clone()}});
  const colorOutput='\n#include <colorspace_fragment>\n';

  const corePositions=[],coreColors=[];
  function coreTriangle(a,b,c,shade){
    for(const p of[a,b,c]){corePositions.push(...p);coreColors.push(.68+shade*.29,.4+shade*.43,1);}
  }
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=(i+1)*Math.PI/4,ra=i%2?.105:.205,rb=(i+1)%2?.105:.205;
    const p=[Math.cos(a)*ra,Math.sin(a)*ra,-.12],q=[Math.cos(b)*rb,Math.sin(b)*rb,-.12];
    coreTriangle([0,0,-1.45],p,q,i%2?.8:.4);
    coreTriangle([0,0,.72],q,p,i%2?.6:.95);
    if(i%2===0){const wing=[Math.cos(a)*.34,Math.sin(a)*.34,.3];coreTriangle([0,0,-.55],wing,[0,0,.67],.35);}
  }
  const coreGeometry=new THREE.BufferGeometry();coreGeometry.setAttribute('position',new THREE.Float32BufferAttribute(corePositions,3));coreGeometry.setAttribute('color',new THREE.Float32BufferAttribute(coreColors,3));
  const coreMaterial=new THREE.ShaderMaterial({uniforms:uniforms(),vertexShader:'attribute vec3 color;varying vec3 vColor;void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform float uEnergy;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,uEnergy*.96);${colorOutput}}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const core=new THREE.Mesh(coreGeometry,coreMaterial);core.name='Charge forward needle';body.add(core);

  const sheathPositions=[],sheathUV=[],sheathIndices=[];
  for(let s=0;s<5;s++)for(let j=0;j<=24;j++){
    const t=j/24,a=s*Math.PI*2/5+t*4,r=Math.pow(Math.sin(t*Math.PI),.7)*.36,width=.025+Math.sin(t*Math.PI)*.075,x=Math.cos(a)*r,y=Math.sin(a)*r*1.2,z=-1.2+t*2.15;
    const tx=-Math.sin(a)*width,ty=Math.cos(a)*width;
    sheathPositions.push(x-tx,y-ty,z,x+tx,y+ty,z);sheathUV.push(0,t,1,t);
    if(j<24){const v=(s*25+j)*2;sheathIndices.push(v,v+1,v+2,v+1,v+3,v+2);}
  }
  const sheathGeometry=new THREE.BufferGeometry();sheathGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sheathPositions,3));sheathGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(sheathUV,2));sheathGeometry.setIndex(sheathIndices);
  const sheathMaterial=new THREE.ShaderMaterial({uniforms:uniforms(),vertexShader:'uniform float uTime,uMotion;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.xy*=1.0+sin(uv.y*20.0+uTime*5.0*uMotion)*.055*uMotion;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',fragmentShader:`uniform vec3 uColor,uHot;uniform float uEnergy;varying vec2 vUv;void main(){float a=pow(max(0.0,1.0-abs(vUv.x*2.0-1.0)),1.3)*sin(vUv.y*3.14159265)*uEnergy*.36;if(a<.003)discard;gl_FragColor=vec4(mix(uHot,uColor,vUv.y*.8),a);${colorOutput}}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
  const sheath=new THREE.Mesh(sheathGeometry,sheathMaterial);sheath.name='Charge wound plasma';body.add(sheath);

  const boltPositions=new Float32Array(BOLTS*SEGMENTS*6),boltFade=new Float32Array(BOLTS*SEGMENTS*2);
  for(let s=0;s<BOLTS;s++)for(let j=0;j<SEGMENTS;j++)for(let end=0;end<2;end++)boltFade[(s*SEGMENTS+j)*2+end]=.22+.78*Math.sin((j+end)/SEGMENTS*Math.PI);
  const boltGeometry=new THREE.BufferGeometry();boltGeometry.setAttribute('position',dynamic(boltPositions,3));boltGeometry.setAttribute('aFade',new THREE.BufferAttribute(boltFade,1));
  const boltMaterial=new THREE.ShaderMaterial({uniforms:uniforms(),vertexShader:'attribute float aFade;varying float vFade;void main(){vFade=aFade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform vec3 uColor,uHot;uniform float uEnergy;varying float vFade;void main(){gl_FragColor=vec4(mix(uColor,uHot,vFade*.72),vFade*uEnergy*.9);${colorOutput}}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const bolts=new THREE.LineSegments(boltGeometry,boltMaterial);bolts.name='Charge winding discharges';body.add(bolts);

  const hx=new Float32Array(HISTORY),hy=new Float32Array(HISTORY),hz=new Float32Array(HISTORY),ha=new Float32Array(HISTORY),he=new Float32Array(HISTORY);
  const trailPositions=new Float32Array(HISTORY*STRANDS*6),trailEnergy=new Float32Array(HISTORY*STRANDS*2),trailUV=new Float32Array(HISTORY*STRANDS*4),trailIndices=[];
  for(let s=0;s<STRANDS;s++)for(let j=0;j<HISTORY;j++){const v=(s*HISTORY+j)*2;trailUV[v*2]=0;trailUV[v*2+1]=j/(HISTORY-1);trailUV[v*2+2]=1;trailUV[v*2+3]=j/(HISTORY-1);if(j<HISTORY-1)trailIndices.push(v,v+1,v+2,v+1,v+3,v+2);}
  const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',dynamic(trailPositions,3));trailGeometry.setAttribute('aEnergy',dynamic(trailEnergy,1));trailGeometry.setAttribute('uv',new THREE.BufferAttribute(trailUV,2));trailGeometry.setIndex(trailIndices);
  const trailMaterial=new THREE.ShaderMaterial({uniforms:uniforms(),vertexShader:'attribute float aEnergy;varying float vEnergy;varying vec2 vUv;void main(){vEnergy=aEnergy;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform vec3 uColor,uHot;varying float vEnergy;varying vec2 vUv;void main(){float a=pow(max(0.0,1.0-abs(vUv.x*2.0-1.0)),1.5)*vEnergy*.5;if(a<.003)discard;gl_FragColor=vec4(mix(uHot,uColor,min(1.0,vUv.y*2.0)),a);${colorOutput}}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
  const trail=new THREE.Mesh(trailGeometry,trailMaterial);trail.name='Charge recorded plasma wake';root.add(trail);

  const pp=new Float32Array(PARTICLES*3),pv=new Float32Array(PARTICLES*3),pa=new Float32Array(PARTICLES),pl=new Float32Array(PARTICLES),ps=new Float32Array(PARTICLES),pe=new Float32Array(PARTICLES),particleEnergy=new Float32Array(PARTICLES);
  const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',dynamic(pp,3));particleGeometry.setAttribute('aSize',dynamic(ps,1));particleGeometry.setAttribute('aEnergy',dynamic(particleEnergy,1));
  const particleMaterial=new THREE.ShaderMaterial({uniforms:uniforms(),vertexShader:'attribute float aSize,aEnergy;varying float vEnergy;void main(){vEnergy=aEnergy;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*640.0/max(1.0,-p.z),0.0,24.0);}',fragmentShader:`uniform vec3 uColor,uHot;varying float vEnergy;void main(){vec2 p=gl_PointCoord*2.0-1.0;float a=pow(max(0.0,1.0-abs(p.x)-abs(p.y)),1.3)*vEnergy;if(a<.004)discard;gl_FragColor=vec4(mix(uColor,uHot,.7),a);${colorOutput}}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const sparks=new THREE.Points(particleGeometry,particleMaterial);sparks.name='Charge pooled sparks';root.add(sparks);
  const drawable=[core,sheath,bolts,trail,sparks],mats=[coreMaterial,sheathMaterial,boltMaterial,trailMaterial,particleMaterial];
  for(let i=0;i<drawable.length;i++){drawable[i].frustumCulled=false;drawable[i].renderOrder=8+i;}

  let intensity=0,historyCount=0,head=-1,sampleClock=0,emission=0,particleHead=0,liveSamples=0,liveParticles=0,initialized=false,lastX=0,lastY=0,lastZ=4,clock=0,seed=8367;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function clear(){
    intensity=historyCount=sampleClock=emission=particleHead=liveSamples=liveParticles=0;head=-1;initialized=false;
    he.fill(0);pe.fill(0);trailEnergy.fill(0);particleEnergy.fill(0);root.visible=body.visible=false;
    for(let i=0;i<mats.length;i++)mats[i].uniforms.uEnergy.value=0;
  }
  function update(dt,{active=false,remaining=0,x=0,y=0,z=4,speed=30,elapsed=0,reducedMotion=false}={}){
    dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;if(dt===0)return;
    x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;z=Number.isFinite(z)?z:4;speed=Number.isFinite(speed)?Math.max(0,speed):30;
    clock=Number.isFinite(elapsed)?elapsed:clock+dt;
    intensity+=((active?1:0)-intensity)*(1-Math.exp(-dt*(active?24:18)));
    if(!active&&intensity<.002&&liveSamples===0&&liveParticles===0){root.visible=body.visible=false;initialized=false;return;}
    const motion=reducedMotion?.15:1,scroll=speed*dt;
    body.position.set(x,y+.95,z);body.visible=intensity>.003;core.rotation.z=clock*.8*motion;sheath.rotation.z=-clock*.35*motion;
    for(let i=0;i<mats.length;i++){mats[i].uniforms.uEnergy.value=intensity*(reducedMotion?.82:1);mats[i].uniforms.uTime.value=clock;mats[i].uniforms.uMotion.value=motion;}
    if(!initialized){lastX=x;lastY=y;lastZ=z;initialized=true;}
    liveSamples=0;
    for(let j=0;j<historyCount;j++){const i=(head-j+HISTORY)%HISTORY;hz[i]+=scroll;ha[i]+=dt;if(ha[i]<LIFE&&he[i]>.003)liveSamples++;}
    if(active){
      sampleClock+=dt;
      while(sampleClock>=INTERVAL){sampleClock-=INTERVAL;const f=Math.max(0,Math.min(1,1-sampleClock/dt));head=(head+1)%HISTORY;hx[head]=lastX+(x-lastX)*f;hy[head]=lastY+(y-lastY)*f+.95;hz[head]=lastZ+(z-lastZ)*f+.45+speed*sampleClock;ha[head]=sampleClock;he[head]=intensity;historyCount=Math.min(HISTORY,historyCount+1);liveSamples++;}
    }else sampleClock=0;
    lastX=x;lastY=y;lastZ=z;
    for(let s=0;s<STRANDS;s++){
      let lastGoodX=x,lastGoodY=y+.95,lastGoodZ=z+.45;
      for(let j=0;j<HISTORY;j++){
        const i=(head-j+HISTORY)%HISTORY,valid=j<historyCount&&ha[i]<LIFE,age=valid?ha[i]/LIFE:1;
        const phase=s*Math.PI/2+age*6,spread=.06+age*.1;
        if(valid){lastGoodX=hx[i]+Math.cos(phase)*spread*motion;lastGoodY=hy[i]+Math.sin(phase)*spread*motion;lastGoodZ=hz[i];}
        const width=valid?.075*Math.pow(1-age,.7):0,tx=Math.cos(s*Math.PI/2)*width,ty=Math.sin(s*Math.PI/2)*width;
        const v=(s*HISTORY+j)*2,p=v*3;
        trailPositions[p]=lastGoodX-tx;trailPositions[p+1]=lastGoodY-ty;trailPositions[p+2]=lastGoodZ;trailPositions[p+3]=lastGoodX+tx;trailPositions[p+4]=lastGoodY+ty;trailPositions[p+5]=lastGoodZ;
        const distanceFade=valid?Math.max(0,1-Math.max(0,lastGoodZ-z)/9):0;
        trailEnergy[v]=trailEnergy[v+1]=valid?he[i]*Math.pow(1-age,1.7)*distanceFade*(reducedMotion?.7:1):0;
      }
    }
    for(let s=0;s<BOLTS;s++)for(let j=0;j<SEGMENTS;j++)for(let end=0;end<2;end++){
      const t=(j+end)/SEGMENTS,envelope=Math.pow(Math.sin(t*Math.PI),.7),phase=s*Math.PI*2/BOLTS+t*4.7+clock*.65*motion;
      const jag=Math.sin((j+end)*1.7+s*2.4+clock*10*motion)*.075*motion,r=.13+envelope*(.4+jag),p=((s*SEGMENTS+j)*2+end)*3;
      boltPositions[p]=Math.cos(phase)*r;boltPositions[p+1]=Math.sin(phase)*r*1.15;boltPositions[p+2]=-1.2+t*2.2+jag*envelope*.25;
    }
    emission+=active?dt*intensity*(reducedMotion?32:104):0;
    while(emission>=1){
      emission--;const i=particleHead++%PARTICLES,p=i*3,a=random()*Math.PI*2,r=.16+random()*.26;
      pp[p]=x+Math.cos(a)*r;pp[p+1]=y+.95+Math.sin(a)*r;pp[p+2]=z+.05+random()*.8;
      pv[p]=Math.cos(a)*(.4+random()*.7);pv[p+1]=Math.sin(a)*(.4+random()*.7);pv[p+2]=1+random()*3;
      pa[i]=0;pl[i]=.18+random()*.22;ps[i]=.045+random()*.07;pe[i]=intensity;
    }
    liveParticles=0;
    for(let i=0;i<PARTICLES;i++){
      pa[i]+=dt;const p=i*3,t=pl[i]>0?pa[i]/pl[i]:1;
      if(t>=1||pe[i]<.003){particleEnergy[i]=0;continue;}
      liveParticles++;pp[p]+=pv[p]*dt;pp[p+1]+=pv[p+1]*dt;pp[p+2]+=scroll+pv[p+2]*dt;
      particleEnergy[i]=pe[i]*Math.pow(1-t,1.4)*Math.max(0,1-Math.max(0,pp[p+2]-z)/9);
    }
    trailGeometry.attributes.position.needsUpdate=trailGeometry.attributes.aEnergy.needsUpdate=true;boltGeometry.attributes.position.needsUpdate=true;
    particleGeometry.attributes.position.needsUpdate=particleGeometry.attributes.aEnergy.needsUpdate=particleGeometry.attributes.aSize.needsUpdate=true;
    trail.visible=liveSamples>0;sparks.visible=liveParticles>0;root.visible=body.visible||trail.visible||sparks.visible;
  }
  return{update,clear,get count(){return root.visible?(body.visible?1:0)+liveSamples+liveParticles:0;}};
}
