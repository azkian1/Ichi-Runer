// Original local boss-death art. Cosmetic only: no damage, actor scaling or removal.
export function createBossEffects(THREE,scene){
  const DURATION=4.8,colors={plain:0xe4bd78,lightning:0xa585ff,water:0x269fef,fire:0xff6827,wind:0x6df0b5,darkness:0x9b50dc};
  let death=null,pool=null;
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n)),smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

  function texture(kind){
    const size=96,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/(size-1),v=y/(size-1),r=Math.hypot(u*2-1,v*2-1);let alpha;
      if(kind==='stroke')alpha=Math.pow(Math.sin(u*Math.PI),.25)*Math.pow(Math.sin(v*Math.PI),2.1);
      else if(kind==='ring')alpha=Math.exp(-Math.pow((r-.72)*32,2))*(.7+.3*Math.sin(Math.atan2(v-.5,u-.5)*17+r*21));
      else alpha=Math.pow(Math.max(0,1-r),2.1);
      const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(clamp(alpha)*255);
    }
    const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);map.magFilter=map.minFilter=THREE.LinearFilter;map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;return map;
  }
  function ribbonGeometry(){
    const positions=[],uvs=[],indices=[];
    for(let j=0;j<7;j++)for(let i=0;i<=28;i++){
      const t=i/28,a=j*Math.PI*2/7+t*1.7,r=.12+t*.18,x=Math.cos(a)*r,y=t*1.3,z=Math.sin(a)*r,width=Math.pow(Math.sin(t*Math.PI),.65)*(.018+j%2*.006);
      positions.push(x-width,y,z,x+width,y,z);uvs.push(t,0,t,1);
      if(i<28){const q=(j*29+i)*2;indices.push(q,q+2,q+1,q+1,q+2,q+3);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  function shardGeometry(){
    const geometry=new THREE.BufferGeometry(),positions=[-.65,-.35,-.2,.72,-.25,-.12,.19,.7,-.08,-.65,-.35,.2,.72,-.25,.12,.19,.7,.08],indices=[0,2,1,3,4,5,0,1,3,1,4,3,1,2,4,2,5,4,2,0,5,0,3,5];
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  function makePool(){
    const group=new THREE.Group();group.name='Boss death · soul severance';group.renderOrder=4;
    const stroke=texture('stroke'),glow=texture('glow'),ring=texture('ring'),plane=new THREE.PlaneGeometry(1,1);
    const material=(color,map=stroke)=>new THREE.MeshBasicMaterial({color,map,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,toneMapped:false});
    const slash=new THREE.Group();slash.rotation.z=-.69;group.add(slash);
    const core=new THREE.Mesh(plane,material(colors.plain)),cutGlow=new THREE.Mesh(plane,material(colors.plain));slash.add(cutGlow,core);
    const shock=new THREE.Mesh(plane,material(colors.plain,ring));shock.rotation.x=-Math.PI/2;shock.position.y=.008;group.add(shock);
    const ribbons=new THREE.Mesh(ribbonGeometry(),material(colors.plain));group.add(ribbons);
    const makePoints=(count,size,color)=>{
      const geometry=new THREE.BufferGeometry(),positions=new Float32Array(count*3),vertexColors=new Float32Array(count*3);
      for(let i=0;i<count;i++){const shade=.6+hash(i+42)*.4;vertexColors.set([shade,shade,shade],i*3);}
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(vertexColors,3));geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
      const points=new THREE.Points(geometry,new THREE.PointsMaterial({color,map:glow,size,sizeAttenuation:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false,vertexColors:true}));points.frustumCulled=false;group.add(points);return points;
    };
    const souls=makePoints(84,.2,colors.plain),ash=makePoints(320,.08,0x9fabc0);
    const shards=new THREE.InstancedMesh(shardGeometry(),new THREE.MeshStandardMaterial({color:0x53606d,metalness:.56,roughness:.46,transparent:true,opacity:0,depthWrite:false}),48);shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);shards.frustumCulled=false;group.add(shards);
    const heart=new THREE.Sprite(new THREE.SpriteMaterial({color:colors.plain,map:glow,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false}));group.add(heart);
    group.traverse(node=>{node.castShadow=false;node.receiveShadow=false;});
    // A fixed eight-call pool is reused between worlds. clear() detaches it;
    // no temporary effect geometry, texture or material is allocated per frame.
    return{group,slash,core,cutGlow,shock,ribbons,souls,ash,shards,heart,dummy:new THREE.Object3D()};
  }

  const shaderHeader=`
varying vec3 vIchiBossDeathWorld;
uniform float uIchiBossDissolve;
uniform float uIchiBossCut;
uniform vec3 uIchiBossDeathColor;
uniform vec4 uIchiBossDeathBounds;
float ichiBossDeathField(vec3 worldPoint) {
  vec3 cell = floor(worldPoint * 9.0);
  float grain = fract(sin(dot(cell,vec3(12.9898,78.233,37.719))) * 43758.5453);
  float height = clamp((worldPoint.y-uIchiBossDeathBounds.y)/uIchiBossDeathBounds.w,0.0,1.0);
  return height * 0.48 + grain * 0.52;
}
`;
  const dissolveFragment=`
float ichiDeathField = ichiBossDeathField(vIchiBossDeathWorld);
float ichiDeathThreshold = uIchiBossDissolve * 1.12 - 0.06;
if (ichiDeathField < ichiDeathThreshold) discard;
`;
  const glowFragment=`
float ichiDeathEdge = (1.0-smoothstep(ichiDeathThreshold,ichiDeathThreshold+0.055,ichiDeathField))*step(0.001,uIchiBossDissolve);
float ichiDeathDiagonal = abs((vIchiBossDeathWorld.y-uIchiBossDeathBounds.y)/uIchiBossDeathBounds.w-0.53+(vIchiBossDeathWorld.x-uIchiBossDeathBounds.x)/uIchiBossDeathBounds.w*0.82);
float ichiDeathSeam = 1.0-smoothstep(0.006,0.022,ichiDeathDiagonal);
totalEmissiveRadiance += uIchiBossDeathColor * (ichiDeathEdge*1.25+ichiDeathSeam*uIchiBossCut*1.9);
`;
  function patchMaterial(material,uniforms,original=null,depth=false){
    const previous=original?.onBeforeCompile,previousKey=original?.customProgramCacheKey?.call(original)||'';
    material.onBeforeCompile=function(shader,renderer){
      previous?.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vIchiBossDeathWorld;').replace('#include <project_vertex>',`#include <project_vertex>
vec4 ichiBossDeathVertex = vec4(transformed,1.0);
#ifdef USE_BATCHING
  ichiBossDeathVertex = batchingMatrix * ichiBossDeathVertex;
#endif
#ifdef USE_INSTANCING
  ichiBossDeathVertex = instanceMatrix * ichiBossDeathVertex;
#endif
vIchiBossDeathWorld = (modelMatrix * ichiBossDeathVertex).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+shaderHeader).replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+dissolveFragment);
      if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+glowFragment);
    };
    material.customProgramCacheKey=()=>`ichi-boss-death-v1-${depth?'depth':'color'}:${previousKey}`;material.needsUpdate=true;return material;
  }

  function beginDeath(object,{element='plain',reducedMotion=false}={}){
    if(!object?.traverse)return false;clear();
    object.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(object),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const height=Number.isFinite(size.y)&&size.y>.01?size.y:8,color=new THREE.Color(colors[element]??colors.plain);
    if(!Number.isFinite(center.x+center.y+center.z))object.getWorldPosition(center);
    const bottom=Number.isFinite(box.min.y)?box.min.y:object.position.y;
    const uniforms={uIchiBossDissolve:{value:0},uIchiBossCut:{value:0},uIchiBossDeathColor:{value:color},uIchiBossDeathBounds:{value:new THREE.Vector4(center.x,bottom,center.z,height)}};
    const materials=new Map(),links=[],clones=[],depth=patchMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),uniforms,null,true);
    clones.push(depth);
    object.traverse(node=>{
      if(!node.material)return;
      const original=node.material;links.push({node,material:original,depth:node.customDepthMaterial});
      const clone=m=>{if(!materials.has(m)){const copy=patchMaterial(m.clone(),uniforms,m);materials.set(m,copy);clones.push(copy);}return materials.get(m);};
      node.material=Array.isArray(original)?original.map(clone):clone(original);if(node.isMesh)node.customDepthMaterial=depth;
    });
    pool??=makePool();const p=pool;p.group.position.set(center.x,bottom,center.z);p.group.scale.setScalar(height);p.group.visible=true;p.group.rotation.set(0,0,0);
    p.slash.position.set(0,.53,(Number.isFinite(box.max.z)?box.max.z-center.z:height*.15)/height+.012);
    p.souls.material.size=height*.036;p.ash.material.size=height*.012;
    for(const node of [p.core,p.cutGlow,p.shock,p.ribbons,p.souls,p.heart])node.material.color.copy(color);
    p.core.material.color.lerp(new THREE.Color(0xdfdfcf),.28);
    scene.add(p.group);
    death={object,age:0,uniforms,links,clones,reducedMotion:!!reducedMotion,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone(),visible:object.visible};
    object.visible=true;updateDeath(0,{reducedMotion});return true;
  }

  function updateDeath(dt,{reducedMotion=false}={}){
    if(!death)return;
    const d=death,p=pool;d.age=Math.min(DURATION,d.age+Math.max(0,Number.isFinite(dt)?dt:0));
    const age=d.age,quiet=d.reducedMotion||reducedMotion,brightness=quiet?.64:1;
    d.uniforms.uIchiBossDissolve.value=smooth((age-2)/1.6);
    d.uniforms.uIchiBossCut.value=smooth((age-.15)/.45)*(1-smooth((age-1.5)/.65))*(quiet?.65:1);
    if(age>=3.6)d.object.visible=false;
    const draw=smooth((age-.16)/.47),slashFade=1-smooth((age-.78)/.9);
    for(const [node,width,alpha] of [[p.core,.014,.93],[p.cutGlow,.064,.32]]){node.position.x=-.7+draw*.7;node.scale.set(Math.max(.0001,draw*1.4),width,1);node.material.opacity=draw*slashFade*alpha*brightness;}
    const burst=smooth((age-.85)/.36),ringTime=clamp((age-.95)/1.45),ringFade=1-smooth((age-1.45)/1.25);
    p.shock.scale.setScalar(.18+ringTime*2.4);p.shock.material.opacity=burst*ringFade*.72*brightness;
    p.ribbons.position.y=.28+Math.max(0,age-1.05)*.15;p.ribbons.rotation.y=(quiet?.12:.3)*Math.max(0,age-.9);p.ribbons.scale.set(1,.3+burst*.85,1);p.ribbons.material.opacity=burst*(1-smooth((age-2.25)/1.1))*.64*brightness;
    p.heart.position.set(0,.54,p.slash.position.z-.02);p.heart.scale.setScalar(.35+burst*.42);p.heart.material.opacity=burst*(1-smooth((age-1.4)/1.2))*.36*brightness;
    const soulArray=p.souls.geometry.attributes.position.array,ashArray=p.ash.geometry.attributes.position.array;
    for(let i=0;i<84;i++){
      const t=Math.max(0,age-.95-hash(i+2)*.3),a=i*2.399+t*(quiet?.4:.9),radius=.04+hash(i+7)*.24+t*.085;
      soulArray[i*3]=Math.cos(a)*radius;soulArray[i*3+1]=.28+hash(i+13)*.5+t*(.34+hash(i+19)*.6);soulArray[i*3+2]=Math.sin(a)*radius;
    }
    p.souls.geometry.attributes.position.needsUpdate=true;p.souls.material.opacity=burst*(1-smooth((age-3.3)/1.45))*.87*brightness;
    const ashTime=Math.max(0,age-2),ashStart=smooth(ashTime/.4);
    for(let i=0;i<320;i++){
      const t=Math.max(0,ashTime-hash(i+91)*.65),a=i*2.399+t*.34,radius=.035+hash(i+81)*.31;
      ashArray[i*3]=Math.cos(a)*radius+t*(hash(i+62)-.5)*.12;ashArray[i*3+1]=hash(i+23)*.97+t*(.16+hash(i+2)*.35);ashArray[i*3+2]=Math.sin(a)*radius+t*(hash(i+16)-.5)*.1;
    }
    p.ash.geometry.attributes.position.needsUpdate=true;p.ash.material.opacity=ashStart*(1-smooth((age-3.7)/1.1))*.74;
    const shardTime=Math.max(0,age-1.02),dummy=p.dummy;
    for(let i=0;i<48;i++){
      const a=i*2.399,speed=.16+hash(i+51)*.3,size=.016+hash(i+58)*.024;
      dummy.position.set(Math.cos(a)*(.12+shardTime*speed),Math.max(.025,.35+hash(i+65)*.4+shardTime*(.32+hash(i+66)*.3)-shardTime*shardTime*.53),Math.sin(a)*(.12+shardTime*speed));
      dummy.rotation.set(i+shardTime*(quiet?.4:2.3),i*1.8+shardTime,i*.6);dummy.scale.set(size,size*(.8+hash(i+59)),size*.65);dummy.updateMatrix();p.shards.setMatrixAt(i,dummy.matrix);
    }
    p.shards.instanceMatrix.needsUpdate=true;p.shards.material.opacity=smooth((age-1.02)/.12)*(1-smooth((age-3)/.9));
    if(age>=DURATION){p.group.visible=false;scene.remove(p.group);}
  }
  function clear(){
    if(!death){if(pool)scene.remove(pool.group);return;}
    const d=death;for(const link of d.links){link.node.material=link.material;link.node.customDepthMaterial=link.depth;}
    for(const material of d.clones)material.dispose();
    d.object.position.copy(d.position);d.object.quaternion.copy(d.quaternion);d.object.scale.copy(d.scale);d.object.visible=d.visible;
    scene.remove(pool.group);pool.group.visible=false;death=null;
  }
  return{beginDeath,updateDeath,clear,get deathAge(){return death?.age??0;},get active(){return !!death&&death.age<DURATION;}};
}
