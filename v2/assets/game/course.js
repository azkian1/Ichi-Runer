import { createSurfaceLibrary } from './surfaces.js';
// Original procedural course art for Ichi's Blade. No external models or textures.
// Dimensions are in the same world units as the runner; feet/resting surfaces are y=0.
export function createCourseAssets(THREE) {
  const geometries = new Map(), materials = new Map();
  const g = (key, build) => { if (!geometries.has(key)) geometries.set(key, build()); return geometries.get(key); };
  const mat = (key, color, extra={}) => { if (!materials.has(key)) materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.85,...extra})); return materials.get(key); };
  const stone=mat('stone',0x4b5663), stoneDark=mat('stone-dark',0x293640), stoneEdge=mat('stone-edge',0x6b777b), moss=mat('moss',0x344b45), wood=mat('wood',0x433734), woodCut=mat('wood-cut',0x8e7460), red=mat('red',0x783b45), rope=mat('rope',0x948467), iron=mat('iron',0x2a3540,{metalness:.58,roughness:.39}), rust=mat('rust',0x6b4a42,{metalness:.32}), gold=mat('gold',0xb19764,{metalness:.45,roughness:.45}), paper=mat('paper',0xb9b4a1,{side:THREE.DoubleSide}), black=mat('abyss',0x080f18), turquoise=mat('turquoise',0x5cbbb9,{emissive:0x207f8a,emissiveIntensity:.55}), purple=mat('crystal',0x665b97,{metalness:.35,roughness:.2,emissive:0x332b6b,emissiveIntensity:.55});
  const surfaces=createSurfaceLibrary(THREE);
  for(const [m,kind,rx,ry,n] of [[stone,'stone',1.7,1.7,.85],[stoneDark,'stone',2,2,.8],[stoneEdge,'stone',1,1,.6],[wood,'bark',1,3,.9],[woodCut,'wood',1,2,.6],[red,'wood',1,2,.5],[rope,'rope',1,5,.7],[moss,'ground',2,2,.6],[iron,'metal',1,2,.35],[rust,'metal',2,2,.45],[paper,'cloth',1,1,.25]])surfaces.apply(m,kind,{repeatX:rx,repeatY:ry,normal:n});
  const box=g('box',()=>new THREE.BoxGeometry(1,1,1));
  const cylinder=g('cylinder',()=>new THREE.CylinderGeometry(1,1,1,12));
  const tapered=g('tapered',()=>new THREE.CylinderGeometry(.72,1,1,12));
  const sphere=g('sphere',()=>new THREE.IcosahedronGeometry(1,2));
  const cone=g('cone',()=>new THREE.ConeGeometry(1,1,10));
  const torus=g('torus',()=>new THREE.TorusGeometry(1,.06,5,20));
  function mesh(parent,geo,material,x=0,y=0,z=0,sx=1,sy=1,sz=1) {
    const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function group(parent,x=0,y=0,z=0) {const p=new THREE.Group();p.position.set(x,y,z);parent.add(p);return p;}
  function rod(parent,a,b,r,material=wood){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);const m=mesh(parent,cylinder,material,...p.add(q).multiplyScalar(.5).toArray(),r,d.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
  function curve(parent,points,r,material=rope,key=''){
    const geometry=key?g(key,()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),16,r,6,false)):new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),16,r,6,false);
    const m=mesh(parent,geometry,material);if(!key)m.userData.courseOwnedGeometry=true;return m;
  }
  function crack(parent,points,color=0x182733){
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    const material=g('line-mat-'+color,()=>new THREE.LineBasicMaterial({color}));
    const line=new THREE.Line(geometry,material);line.userData.courseOwnedGeometry=true;parent.add(line);return line;
  }
  function roughRock(key='rough',detail=1){return g(key,()=>{
    const geo=new THREE.SphereGeometry(1,24+detail*4,16+detail*2),p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.11*Math.sin(x*15.13+y*11.1+z*8.7)+.055*Math.cos(x*34-z*17);p.setXYZ(i,x*n,y*n,z*n);}
    geo.computeVertexNormals();return geo;
  });}
  function roof(parent,y,width,depth){
    const geo=g(`roof-${width}-${depth}`,()=>{
      const positions=[],indices=[],nx=18,nz=5;
      for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
        const u=i/nx*2-1,v=j/nz*2-1;
        positions.push(u*width*.5, .48*(1-Math.abs(u))+.18*Math.pow(Math.abs(u),5)+.1*Math.pow(Math.abs(v),4),v*depth*.5);
      }
      for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const uv=[];for(let v=0;v<positions.length;v+=3)uv.push(positions[v]/width+.5,positions[v+2]/depth+.5);geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
    });
    const r=group(parent,0,y,0);mesh(r,geo,iron);
    for(const z of [-depth*.5,depth*.5])curve(r,[[-width*.5,.18,z],[-width*.25,.29,z],[0,.49,z],[width*.25,.29,z],[width*.5,.18,z]],.045,iron,`eave-${width}-${depth}-${z}`);
    for(let x=-width*.43;x<=width*.44;x+=width/11)rod(r,[x,.51*(1-Math.abs(x/(width*.5))),-depth*.49],[x,.51*(1-Math.abs(x/(width*.5))),depth*.49],.025,stoneDark);
    return r;
  }
  function binding(parent,x,y,z,axis='y',radius=.17){
    for(let n=0;n<3;n++){const ring=mesh(parent,torus,rope,x,y+(axis==='y'?(n-1)*.06:0),z,radius,radius,radius);if(axis==='y')ring.rotation.x=Math.PI/2;else {ring.position.x+=(n-1)*.055;ring.rotation.y=Math.PI/2;}}
  }
  function charm(parent,x,y,z){
    const p=mesh(parent,box,paper,x,y,z,.14,.37,.018);p.rotation.z=.13;
    for(let i=0;i<3;i++)mesh(parent,box,red,x+(i%2)*.03,y+.08-i*.07,z+.012,.07,.023,.005).rotation.z=-.2;
  }
  function chips(parent,count=5,seed=1){
    for(let i=0;i<count;i++){const a=(i*2.399+seed),s=.08+(i%3)*.035;mesh(parent,roughRock(),i%3===0?moss:stoneDark,Math.sin(a)*1.03,.045+(i%2)*.03,Math.cos(a)*.55,s,.055,s*1.2).rotation.y=a;}
  }
  function log(parent,a,b,r=.16,cutEnds=true){
    rod(parent,a,b,r,wood);
    const d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
    if(cutEnds)for(const p of [a,b]){const cap=mesh(parent,cylinder,woodCut,...p,r*.9,.012,r*.9);cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);}
    // Thin bark ridges break cylindrical silhouettes and catch moonlight.
    for(let n=0;n<3;n++){
      const theta=n*Math.PI*2/3,offset=[Math.cos(theta)*r*.93,Math.sin(theta)*r*.93,0];
      if(Math.abs(d.x)>.7)rod(parent,[a[0],a[1]+offset[0],a[2]+offset[1]],[b[0],b[1]+offset[0],b[2]+offset[1]],.018,woodCut);
    }
  }
  function obstacleMeta(object,kind,height,halfWidth=1.1,halfDepth=.6,extra={}){object.name='course · '+kind;object.userData={...object.userData,kind,span:1,height,halfWidth,halfDepth,...extra};return object;}

  // One broad escarpment, not repeated lane-sized rocks. The superellipsoid keeps
  // its high crest across the middle lanes and has a naturally closed, eroded rim.
  function longRock(span){return g('joined-granite-'+span,()=>{
    const geo=new THREE.SphereGeometry(1,40+span*8,24),a=geo.attributes.position,w=span*1.4-.15;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i),xx=Math.sign(x)*Math.pow(Math.abs(x),.54),n=Math.sin(xx*13.8+z*8.2+y*6.3);
      a.setXYZ(i,xx*w*(1+.018*n),.1+(y+1)*1.26*(1+.045*Math.sin(xx*9.1+z*3.2)),z*.79*(1+.08*n));
    }
    geo.computeVertexNormals();return geo;
  });}
  function joinedBase(parent,span,material=stoneDark){
    const w=span*2.8-.3;
    mesh(parent,box,material,0,.12,0,w,.25,1.1);
    // One continuous broken lip and weathered seam tie the whole composition.
    rod(parent,[-w*.49,.16,.56],[w*.49,.16,.56],.065,stoneEdge);
    for(let i=0;i<span*3+1;i++){
      const x=(i/(span*3)-.5)*(w-.16),s=.13+(i%3)*.025;
      mesh(parent,roughRock(),i%3===0?moss:stoneDark,x,.12,Math.sin(i*2.17)*.35,s,.15,.2).rotation.y=i*1.71;
    }
  }
  function crystalShard(parent,x,z,height,lean,side=0){
    const c=group(parent,x,.17,z);c.rotation.z=lean;c.rotation.x=side;
    const shaft=g('joined-hex-shaft',()=>new THREE.CylinderGeometry(.18,.32,1,6));
    mesh(c,shaft,purple,0,height*.44,0,1,height*.88,1);
    mesh(c,cone,purple,0,height*.98,0,.18,height*.22,.18);
    rod(c,[-.11,.12,.27],[-.07,height*.86,.16],.013,turquoise);
  }
  function buildJoinedObstacle(kind,span){
    const p=new THREE.Group(),w=span*2.8-.3;
    joinedBase(p,span);
    if(kind==='rock'){
      mesh(p,longRock(span),stone);
      for(let i=0;i<span+2;i++){
        const x=(i/(span+1)-.5)*w*.85;
        mesh(p,roughRock('rock-buttress',1),i%2?stoneDark:moss,x,.32,.46,.42+.08*(i%2),.35,.33).rotation.y=i*1.8;
      }
      const points=[];for(let i=0;i<=span*4;i++){const x=(i/(span*4)-.5)*w*.84;points.push([x,1.12+.15*Math.sin(i*1.71),.76+.03*Math.cos(i)]);}crack(p,points);
      for(const side of [-1,1])crack(p,[[side*w*.26,2.3,.31],[side*w*.2,1.9,.59],[side*w*.25,1.28,.77],[side*w*.17,.68,.8]]);
      curve(p,[[-w*.45,.77,.57],[0,.54,.89],[w*.45,.82,.56]],.032,rope,'joined-rock-rope-'+span);
      charm(p,-w*.14,1.04,.82);charm(p,w*.29,.69,.81);
      return obstacleMeta(p,kind,2.9,w/2,.93,{span});
    }
    if(kind==='crystal'){
      mesh(p,longRock(span),stoneDark,0,-.025,0,1,.15,.96);
      // A connected mineral vein and diagonally branching crown span the base.
      const veinPoints=[[-w*.47,.28,.22],[-w*.2,.43,-.1],[w*.12,.28,.25],[w*.45,.36,.05]];
      curve(p,veinPoints,.085,purple,'joined-crystal-vein-'+span);
      curve(p,veinPoints.map(([x,y,z])=>[x,y+.035,z+.06]),.018,turquoise,'joined-crystal-core-'+span);
      for(let i=0;i<span*3+1;i++){
        const t=i/(span*3),x=(t-.5)*w*.82,z=Math.sin(i*2.39)*.27,h=1.35+.92*Math.pow(Math.sin((t*.8+.1)*Math.PI),2)+.16*Math.cos(i*1.8);
        crystalShard(p,x,z,h,Math.sin(i*1.31)*.19,Math.cos(i*1.7)*.1);
      }
      for(const side of [-1,1])crystalShard(p,side*w*.32,.23,1.12,-side*.68,.05);
      return obstacleMeta(p,kind,2.9,w/2,.95,{span});
    }
    const count=span*6-1,spacing=(w-.34)/(count-1);
    for(let row=0;row<2;row++)for(let i=0;i<count;i++){
      const x=-w*.5+.17+i*spacing,z=row*.56-.28,h=.69+((i+row)%3)*.075;
      mesh(p,cone,iron,x,.12+h*.5,z,.095,h,.095).rotation.z=Math.sin(i*1.3)*.065;
      mesh(p,torus,rust,x,.16,z,.12,.12,.12).rotation.x=Math.PI/2;
    }
    for(const z of [-.59,.59]){rod(p,[-w*.5,.2,z],[w*.5,.2,z],.05,red);rod(p,[-w*.48,.27,z],[w*.48,.27,z],.018,iron);}
    for(const x of [-w*.43,0,w*.43])mesh(p,box,rust,x,.26,0,.09,.035,1.12);
    return obstacleMeta(p,kind,.95,w/2,.62,{span});
  }

  const trapFrameTemplates=new Map();
  const bladeHulls=new WeakMap();
  function bladeHull(geometry){
    if(!bladeHulls.has(geometry)){
      const position=geometry.attributes.position,unique=new Map();
      for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i);unique.set(x+':'+y,[x,y]);}
      const points=[...unique.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const lower=[],upper=[];
      for(const point of points){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],point)<=0)lower.pop();lower.push(point);}
      for(let i=points.length-1;i>=0;i--){const point=points[i];while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],point)<=0)upper.pop();upper.push(point);}
      lower.pop();upper.pop();bladeHulls.set(geometry,lower.concat(upper));
    }
    return bladeHulls.get(geometry);
  }
  function trapFrame(kind){
    if(!trapFrameTemplates.has(kind)){
      const frame=new THREE.Group(),top=kind==='pendulum'?3.85:3.15;
      for(const side of [-1,1]){
        const x=side*1.68;
        mesh(frame,tapered,stoneDark,x,.2,0,.25,.4,.4);
        rod(frame,[x,.22,0],[x,top,0],.115,red);
        for(const z of [-.36,.36])rod(frame,[x,0,z],[x,1.12,0],.055,iron);
        for(const y of [.5,top-.32])binding(frame,x,y,0,'y',.13);
        mesh(frame,box,iron,x,top-.15,.12,.31,.31,.08);
        for(const y of [top-.25,top-.05])mesh(frame,sphere,gold,x,y,.18,.036,.036,.026);
      }
      log(frame,[-1.88,top,0],[1.88,top,0],.14);
      rod(frame,[-1.67,top-.08,-.15],[1.67,top-.08,-.15],.055,iron);
      for(const side of [-1,1])rod(frame,[side*1.68,top-.65,0],[side*1.07,top,0],.065,iron);
      mesh(frame,box,gold,0,top+.02,.16,.37,.26,.03);
      charm(frame,-1.66,1.85,.15);charm(frame,1.68,2.23,.15);
      // The frame is static and harmless; only the separately attached blade is
      // used by contactBounds below. Batch its joinery once for every trap kind.
      trapFrameTemplates.set(kind,bakeStaticObstacle(frame));
    }
    return trapFrameTemplates.get(kind).clone(true);
  }
  function sawGeometry(){return g('moving-saw-disc',()=>{
    const shape=new THREE.Shape(),teeth=24;
    for(let i=0;i<teeth*2;i++){
      const angle=i/(teeth*2)*Math.PI*2,r=i%2?.49:.62,x=Math.cos(angle)*r,y=Math.sin(angle)*r;
      if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    shape.closePath();const hole=new THREE.Path();hole.absarc(0,0,.075,0,Math.PI*2,true);shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelThickness:.012,bevelSize:.009,bevelSegments:1});
  });}
  function setBladeContact(object){
    const data=object.userData,blade=data.contactBlade;
    if(data.contactRadius){
      // A rotating circular saw has a circular cutting envelope. Rotating its
      // square bounding box would falsely grow its collider by sqrt(2).
      const x=data.contactJoint.position.x,y=data.contactJoint.position.y,r=data.contactRadius;
      data.contactBounds.min.set(x-r,y-r,-.02);data.contactBounds.max.set(x+r,y+r,.09);
      data.contactOffsetX=x;data.contactY=y-r;data.height=y+r;data.halfWidth=r;return;
    }
    // Only two local transforms are involved. Reuse the box/matrix per object;
    // no scene traversal or temporary allocations in the animation loop.
    data.contactJoint.updateMatrix();blade.updateMatrix();
    data.contactMatrix.multiplyMatrices(data.contactJoint.matrix,blade.matrix);
    // Rotating the original rectangle would include empty corners beyond the
    // curved axe. Its cached XY convex hull gives the exact projected bounds.
    const b=data.contactBounds,e=data.contactMatrix.elements;b.min.set(Infinity,Infinity,blade.geometry.boundingBox.min.z);b.max.set(-Infinity,-Infinity,blade.geometry.boundingBox.max.z);
    for(const point of data.contactHull){
      const x=e[0]*point[0]+e[4]*point[1]+e[12],y=e[1]*point[0]+e[5]*point[1]+e[13];
      b.min.x=Math.min(b.min.x,x);b.max.x=Math.max(b.max.x,x);b.min.y=Math.min(b.min.y,y);b.max.y=Math.max(b.max.y,y);
    }
    data.contactOffsetX=(b.min.x+b.max.x)*.5;data.contactY=b.min.y;data.height=b.max.y;data.halfWidth=(b.max.x-b.min.x)*.5;
  }
  function buildMovingTrap(kind){
    const p=new THREE.Group();p.add(trapFrame(kind));
    const joint=group(p,0,kind==='pendulum'?3.84:1.43,0);
    let blade;
    if(kind==='pendulum'){
      rod(joint,[0,0,0],[0,-2.17,0],.045,iron);
      for(let i=0;i<7;i++){
        const link=mesh(joint,torus,i%2?rust:iron,0,-.21-i*.22,0,.075,.11,.075);link.rotation.y=i%2?Math.PI/2:0;
      }
      const shape=new THREE.Shape();shape.moveTo(-.49,-2.01);shape.quadraticCurveTo(-.56,-2.71,0,-2.87);shape.quadraticCurveTo(.56,-2.71,.49,-2.01);shape.lineTo(.21,-2.18);shape.lineTo(0,-1.96);shape.lineTo(-.21,-2.18);shape.closePath();
      const geometry=g('compact-pendulum-axe',()=>new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelThickness:.022,bevelSize:.022,bevelSegments:2}));
      blade=mesh(joint,geometry,iron);
      mesh(joint,torus,gold,0,-2.16,.1,.115,.115,.115);
      curve(joint,[[-.49,-2.09,.095],[-.36,-2.61,.095],[0,-2.81,.095],[.36,-2.61,.095],[.49,-2.09,.095]],.016,turquoise,'compact-axe-cutting-edge');
      mesh(p,torus,rust,0,3.84,.06,.18,.18,.18);
    }else{
      rod(p,[-1.39,2.4,-.1],[1.39,2.4,-.1],.075,iron);
      rod(joint,[0,.93,-.12],[0,0,-.12],.06,iron);
      mesh(joint,box,rust,0,.88,-.1,.32,.27,.28);
      blade=mesh(joint,sawGeometry(),iron);
      mesh(joint,cylinder,gold,0,0,.11,.13,.13,.13).rotation.x=Math.PI/2;
      const rim=mesh(joint,torus,rust,0,0,.084,.37,.37,.37);rim.rotation.z=.15;
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5;rod(joint,[Math.cos(a)*.19,Math.sin(a)*.19,.092],[Math.cos(a+.22)*.42,Math.sin(a+.22)*.42,.092],.018,stoneDark);
      }
    }
    if(!blade.geometry.boundingBox)blade.geometry.computeBoundingBox();
    obstacleMeta(p,kind,2.1,.6,kind==='pendulum'?.32:.34,{moving:true,contactOffsetX:0,contactY:.7,motionPeriod:kind==='pendulum'?3.8:3.6,contactJoint:joint,contactBlade:blade,contactMatrix:new THREE.Matrix4(),contactBounds:new THREE.Box3()});
    if(kind==='sawGate'){
      const positions=blade.geometry.attributes.position;let radius=0;
      for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getY(i)));
      p.userData.contactRadius=radius;
    }else p.userData.contactHull=bladeHull(blade.geometry);
    animateObstacle(p,kind,0);return p;
  }

  function buildObstacle(kind,span=1){
    if(span>1&&['rock','crystal','spikes'].includes(kind))return buildJoinedObstacle(kind,span);
    if(kind==='pendulum'||kind==='sawGate')return buildMovingTrap(kind);
    const p=new THREE.Group();
    if(kind==='barricade'){
      for(const x of [-.89,.89]){
        log(p,[x,0,0],[x+(x>0?.07:-.05),1.16,0],.12);
        mesh(p,cone,woodCut,x,1.22,0,.12,.23,.12).rotation.z=x*.15;
        binding(p,x,.62,.01,'y',.145);
      }
      log(p,[-1.04,.34,.07],[1.03,.48,.07],.12);
      log(p,[-1.05,.85,.06],[.88,.74,.06],.13);
      rod(p,[-.8,.16,.15],[.72,1.04,.15],.065,red);binding(p,-.7,.4,.09,'x',.14);charm(p,.3,.67,.21);chips(p,4);
      return obstacleMeta(p,kind,1.05,1.14,.34,{breakable:true,hp:1});
    }
    if(kind==='shrine'){
      mesh(p,tapered,stoneDark,0,.12,0,.94,.25,.75);mesh(p,cylinder,stoneEdge,0,.3,0,.8,.12,.64);
      for(const x of [-.56,.56])for(const z of [-.44,.44])rod(p,[x,.36,z],[x,1.65,z],.075,red);
      mesh(p,box,wood,0,.95,-.38,1.16,1.05,.18);mesh(p,box,wood,0,.48,0,1.34,.11,.96);
      for(const x of [-.35,.35])mesh(p,box,woodCut,x,.96,.4,.04,1.05,.05);
      mesh(p,box,black,0,1.07,.04,.7,.89,.12);mesh(p,box,turquoise,0,1.13,.12,.35,.48,.045);
      roof(p,1.55,2.12,1.55);rod(p,[0,2.03,-.65],[0,2.03,.65],.065,red);
      for(const z of [-.68,.68])mesh(p,cone,gold,0,2.1,z,.07,.24,.07);
      curve(p,[[-.68,1.5,.62],[0,1.35,.7],[.68,1.5,.62]],.032,rope,'shrine-sacred-rope');
      for(const x of [-.36,.06,.4])charm(p,x,1.1,.69);chips(p,4,3);
      return obstacleMeta(p,kind,2.25,1.12,.82,{breakable:true,hp:2});
    }
    if(kind==='rock'){
      mesh(p,roughRock('granite',2),stone,0,1.2,0,1,1.48,.88).rotation.set(.03,.32,.12);
      mesh(p,roughRock(),stoneDark,-.55,.35,.33,.5,.39,.46);mesh(p,roughRock(),moss,.52,.4,.41,.45,.27,.37);
      crack(p,[[.11,2.39,.45],[.04,2.03,.74],[.29,1.69,.86],[.1,1.28,.91],[.3,.99,.85]]);
      crack(p,[[.04,2.03,.75],[-.3,1.88,.82],[-.43,1.53,.89]]);
      charm(p,-.29,1.43,.91);binding(p,0,1.01,0,'y',.88);chips(p,6);
      return obstacleMeta(p,kind,2.9,1.14,.93);
    }
    if(kind==='pit'){
      mesh(p,box,black,0,.025,0,2.5,.025,3.3);
      for(let n=0;n<12;n++){
        const side=n%2?-1:1,z=-1.6+(n>>1)*.63;
        mesh(p,roughRock(),stoneDark,side*1.2,.045,z,.16,.13,.23).rotation.y=n;
      }
      for(const z of [-1.62,1.62]){mesh(p,box,stone,0,.035,z,2.4,.08,.18).rotation.y=z*.018;crack(p,[[-1,.09,z-.02],[-.25,.09,z+.04],[.13,.09,z-.03],[1,.09,z+.03]]);}
      for(let i=0;i<3;i++)rod(p,[-.75+i*.67,-.1,-1.4],[-.9+i*.7,-1.4,-.9],.025,wood);
      return obstacleMeta(p,kind,.45,1.25,1.65,{gap:true});
    }
    if(kind==='fallenTree'){
      log(p,[-1.15,.45,-.16],[1.1,.54,.13],.39);
      log(p,[-.48,.5,0],[-.13,1.02,.08],.12);log(p,[.39,.52,0],[.81,.86,-.31],.1);
      mesh(p,roughRock(),moss,-.47,.8,-.05,.4,.12,.27);binding(p,.83,.5,.12,'x',.41);chips(p,4,4);
      return obstacleMeta(p,kind,1.04,1.2,.61,{breakable:true,hp:1});
    }
    if(kind==='spikes'){
      const positions=[];
      for(let row=0;row<2;row++)for(let i=0;i<5;i++)positions.push([(i-2)*.44,.42,row*.57-.285,.095,.7+(i%2)*.16,.095]);
      for(const t of positions){const s=mesh(p,cone,iron,...t);s.rotation.z=(t[0]>.1?-.07:.07);mesh(p,torus,rust,t[0],.1,t[2],.13,.13,.13).rotation.x=Math.PI/2;}
      mesh(p,box,stoneDark,0,.04,0,2.3,.1,1.12);for(const z of [-.61,.61])rod(p,[-1.13,.16,z],[1.13,.16,z],.045,red);
      return obstacleMeta(p,kind,.95,1.15,.62);
    }
    if(kind==='arch'){
      for(const side of [-1,1]){
        const x=side*1.09;mesh(p,tapered,stoneDark,x,.2,0,.22,.4,.35);rod(p,[x,.25,0],[x,2.22,0],.14,red);binding(p,x,1.4,0,'y',.16);
      }
      log(p,[-1.28,1.83,0],[1.28,1.83,0],.26);log(p,[-1.18,2.26,0],[1.18,2.26,0],.13);mesh(p,box,gold,0,1.87,.27,.35,.4,.02);
      for(const x of [-.7,0,.7])charm(p,x,1.33,.14);
      return obstacleMeta(p,kind,2.45,1.3,.34,{overhead:true,clearance:1.15,beamBottom:1.55,beamTop:2.12});
    }
    if(kind==='cart'){
      const wheels=[];
      for(const x of [-.78,.78])for(const z of [-.54,.54]){
        const w=mesh(p,torus,wood,x,.4,z,.38,.38,.38);w.rotation.y=Math.PI/2;wheels.push(w);
        for(let n=0;n<3;n++){const a=n*Math.PI/3;rod(p,[x,.4-Math.cos(a)*.31,z-Math.sin(a)*.31],[x,.4+Math.cos(a)*.31,z+Math.sin(a)*.31],.025,iron);}
      }
      for(let n=0;n<5;n++)mesh(p,box,wood,0,.71,(n-2)*.24,1.65,.14,.21).rotation.z=(n%2?1:-1)*.012;
      for(const x of [-.76,.76])rod(p,[x,.7,-.75],[x,.7,1.35],.045,wood);for(const z of [-.65,.65])rod(p,[-.74,1.07,z],[.74,1.07,z],.06,red);
      for(let n=0;n<3;n++)mesh(p,roughRock(),n===0?woodCut:wood,-.38+n*.37,.98,0,.32,.37,.41).rotation.y=n*2;
      binding(p,.49,.98,0,'y',.26);p.userData.wheels=wheels;
      return obstacleMeta(p,kind,1.37,1.2,1.34,{breakable:true,hp:1});
    }
    if(kind==='blades'){
      for(const x of [-1.07,1.07])rod(p,[x,0,0],[x,3.1,0],.11,stoneDark);
      rod(p,[-1.2,3.07,0],[1.2,3.07,0],.1,wood);const pivot=group(p,0,3.03,0);
      rod(pivot,[0,0,0],[0,-1.31,0],.032,iron);
      const shape=new THREE.Shape();shape.moveTo(-.62,-1.19);shape.quadraticCurveTo(-.43,-2.25,0,-2.37);shape.quadraticCurveTo(.43,-2.25,.62,-1.19);shape.lineTo(.25,-1.4);shape.lineTo(0,-1.12);shape.lineTo(-.25,-1.4);shape.closePath();
      const bladeGeo=g('pendulum-blade',()=>new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.017,bevelSize:.018,bevelSegments:2}));mesh(pivot,bladeGeo,iron);mesh(pivot,torus,gold,0,-1.42,.08,.16,.16,.16);
      curve(pivot,[[-.59,-1.22,.075],[-.35,-2.09,.075],[0,-2.31,.075],[.35,-2.09,.075],[.59,-1.22,.075]],.016,turquoise,'blade-edge');p.userData.pivot=pivot;
      return obstacleMeta(p,kind,3.2,1.23,.33,{moving:true});
    }
    if(kind==='bell'){
      const bellGeo=g('bell-lathe',()=>new THREE.LatheGeometry([[.01,.05],[.44,.08],[.56,.19],[.58,.28],[.49,.4],[.45,1.2],[.27,1.58],[.06,1.68]].map(([x,y])=>new THREE.Vector2(x,y)),24));
      mesh(p,cylinder,stoneDark,0,.13,0,.86,.26,.78);mesh(p,bellGeo,iron,0,.25,0,1.32,1.32,1.32);
      for(const y of [.59,.75,1.6]){const ring=mesh(p,torus,rust,0,y,0,.61,.61,.61);ring.rotation.x=Math.PI/2;}
      for(let n=0;n<12;n++){const a=n*Math.PI/6;mesh(p,sphere,rust,Math.sin(a)*.58,1.3,Math.cos(a)*.58,.052,.052,.052);}
      mesh(p,torus,gold,0,2.47,0,.18,.24,.18);charm(p,.18,1.12,.63);chips(p,5,8);
      return obstacleMeta(p,kind,2.75,1.02,.95);
    }
    if(kind==='crystal'){
      for(let n=0;n<5;n++){
        const a=n*2.399,s=n===0?1:.58,x=Math.sin(a)*(n===0?0:.46),z=Math.cos(a)*(n===0?0:.38);
        const c=group(p,x,0,z);c.rotation.z=n===0?.1:Math.sin(a)*.24;
        const geometry=g('hex-crystal',()=>new THREE.CylinderGeometry(.22,.46,1.9,6,1,false));mesh(c,geometry,purple,0,1.12*s,0,s,s,s);mesh(c,cone,purple,0,2.28*s,0,.223*s,.42*s,.223*s);
        rod(c,[-.12*s,.37*s,.34*s],[-.08*s,1.9*s,.2*s],.014,turquoise);
      }
      mesh(p,roughRock(),stoneDark,0,.13,0,.98,.23,.83);chips(p,5,6);
      return obstacleMeta(p,kind,2.9,1.12,.95);
    }
    return obstacleMeta(p,kind,1);
  }

  // Bake static parts into one geometry for each material. A dense three-lane pattern
  // keeps all the sculpted detail while avoiding dozens of draw calls per obstacle.
  const obstacleTemplates=new Map();
  const rockDamageTemplates=new Map();
  let rockCrackMaterials=null;
  function makeRockDamageOverlay(template,span){
    if(!rockCrackMaterials){
      const size=32,pixels=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=(y*size+x)*4,u=x/(size-1)*2-1,v=y/(size-1);
        pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.pow(Math.max(0,1-Math.abs(u)),1.6)*Math.pow(Math.sin(v*Math.PI),.25)*255);
      }
      const map=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);map.minFilter=map.magFilter=THREE.LinearFilter;map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;
      const create=(color,opacity)=>new THREE.MeshBasicMaterial({color,opacity,map,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
      rockCrackMaterials={core:create(0x91ecff,.97),glow:create(0x1c9de4,.43)};
    }
    if(!rockDamageTemplates.has(span)){
      template.updateMatrixWorld(true);
      const halfWidth=template.userData.halfWidth,surfaces=template.children.filter(node=>node.isMesh&&[stone,stoneDark,moss].includes(node.material));
      const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3(0,0,-1),hits=[];
      const project=(x,y)=>{origin.set(x,y,3);ray.set(origin,direction);hits.length=0;ray.intersectObjects(surfaces,false,hits);return hits.length?hits[0].point.z+.035:.83;};
      const paths=[],main=[],segments=30+span*8;
      for(let i=0;i<=segments;i++){
        const t=i/segments,x=(t-.5)*halfWidth*1.48+Math.sin(i*2.11)*.022,y=1.97-t*1.18+Math.sin(i*2.53)*.035;
        main.push([x,y,project(x,y)]);
      }
      paths.push(main);
      for(let fork=0;fork<3+span;fork++){
        const index=Math.round((fork+1)/(4+span)*segments),start=main[index],side=fork%2?1:-1,path=[];
        for(let i=0;i<=7;i++){
          const t=i/7,x=start[0]+side*t*(.16+span*.055)+Math.sin(i*2.2)*.012,y=start[1]+side*t*(.23+(fork%2)*.12);
          path.push([x,y,project(x,y)]);
        }
        paths.push(path);
      }
      const ribbon=width=>{
        const positions=[],uvs=[],indices=[];
        for(let branch=0;branch<paths.length;branch++){
          const path=paths[branch],base=positions.length/3;
          for(let i=0;i<path.length;i++){
            const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],length=Math.hypot(b[0]-a[0],b[1]-a[1])||1,sideX=-(b[1]-a[1])/length,sideY=(b[0]-a[0])/length,t=i/(path.length-1),w=width*(branch?(.66*(1-t)+.12):(.65+.35*Math.sin(t*Math.PI)));
            for(const sign of [-1,1]){positions.push(path[i][0]+sideX*w*sign,path[i][1]+sideY*w*sign,path[i][2]+(width>.03?.004:0));uvs.push((sign+1)/2,t);}
            if(i<path.length-1){const q=base+i*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
          }
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
      };
      rockDamageTemplates.set(span,{core:ribbon(.018),glow:ribbon(.072)});
    }
    const geometries=rockDamageTemplates.get(span),overlay=new THREE.Group();overlay.name='Rock water damage · diagonal fracture';overlay.visible=false;overlay.userData.rockDamageOverlay=true;
    for(const key of ['glow','core']){
      const crack=new THREE.Mesh(geometries[key],rockCrackMaterials[key]);crack.userData.courseCachedGeometry=true;crack.userData.rockDamageOverlay=true;crack.castShadow=false;crack.receiveShadow=false;overlay.add(crack);
    }
    return overlay;
  }
  function setRockDamage(object,level=0){
    if(object?.userData?.kind!=='rock'||!object.userData.rockDamageOverlay)return false;
    object.userData.rockDamageLevel=Number(level)>=1?1:0;object.userData.rockDamageOverlay.visible=object.userData.rockDamageLevel===1;return true;
  }
  function bakeStaticObstacle(source){
    source.updateMatrixWorld(true);
    const result=new THREE.Group();result.name=source.name;result.userData={...source.userData};
    const batches=new Map(),lineBatches=new Map(),vector=new THREE.Vector3(),normal=new THREE.Vector3();
    let originalMeshes=0;
    source.traverse(node=>{
      if(node.isMesh){
        originalMeshes++;
        const key=node.material.uuid;
        if(!batches.has(key))batches.set(key,{material:node.material,items:[],vertices:0,castShadow:false,receiveShadow:false});
        const batch=batches.get(key),count=node.geometry.index?.count??node.geometry.attributes.position.count;
        batch.items.push({geometry:node.geometry,matrix:node.matrixWorld.clone()});batch.vertices+=count;
        batch.castShadow ||= node.castShadow;batch.receiveShadow ||= node.receiveShadow;
      }else if(node.isLine){
        const key=node.material.uuid;
        if(!lineBatches.has(key))lineBatches.set(key,{material:node.material,positions:[]});
        const target=lineBatches.get(key).positions,attribute=node.geometry.attributes.position;
        for(let i=0;i<attribute.count-1;i++)for(const vertex of[i,i+1]){vector.fromBufferAttribute(attribute,vertex).applyMatrix4(node.matrixWorld);target.push(vector.x,vector.y,vector.z);}
      }
    });
    for(const batch of batches.values()){
      const positions=new Float32Array(batch.vertices*3),normals=new Float32Array(batch.vertices*3),uvs=new Float32Array(batch.vertices*2);let cursor=0;
      for(const item of batch.items){
        const {geometry,matrix}=item,index=geometry.index,position=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,nm=new THREE.Matrix3().getNormalMatrix(matrix),count=index?.count??position.count;
        for(let i=0;i<count;i++){
          const id=index?index.getX(i):i;
          vector.fromBufferAttribute(position,id).applyMatrix4(matrix);positions.set([vector.x,vector.y,vector.z],cursor*3);
          if(n)normal.fromBufferAttribute(n,id).applyNormalMatrix(nm);else normal.set(0,1,0);normals.set([normal.x,normal.y,normal.z],cursor*3);
          uvs[cursor*2]=uv?uv.getX(id):0;uvs[cursor*2+1]=uv?uv.getY(id):0;cursor++;
        }
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const object=new THREE.Mesh(geometry,batch.material);object.castShadow=batch.castShadow;object.receiveShadow=batch.receiveShadow;object.userData.courseCachedGeometry=true;result.add(object);
    }
    for(const batch of lineBatches.values()){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));const object=new THREE.LineSegments(geometry,batch.material);object.userData.courseCachedGeometry=true;result.add(object);
    }
    // Unique construction-only crack/tube buffers are no longer needed after baking.
    source.traverse(node=>{if(node.userData.courseOwnedGeometry)node.geometry?.dispose();});
    result.userData.originalMeshCount=originalMeshes;result.userData.bakedStatic=true;return result;
  }
  function makeObstacle(kind,{span=1}={}){
    const width=['rock','crystal','spikes'].includes(kind)?Math.min(3,Math.max(1,Math.round(Number(span)||1))):1,key=kind+':'+width;
    // These retain live joint references for wheels and the swinging pendulum.
    if(kind==='cart'||kind==='blades'||kind==='pendulum'||kind==='sawGate')return buildObstacle(kind);
    if(!obstacleTemplates.has(key))obstacleTemplates.set(key,bakeStaticObstacle(buildObstacle(kind,width)));
    const template=obstacleTemplates.get(key),object=template.clone(true);
    // Attach only after baking and cloning. Hidden damage overlays are never
    // included in the pristine shared rock prototype or any material batch.
    if(kind==='rock'){const overlay=makeRockDamageOverlay(template,width);object.add(overlay);object.userData.rockDamageOverlay=overlay;object.userData.rockDamageLevel=0;}
    return object;
  }

  // A sculpted bank drops into the gorge; its irregular face replaces a box wall.
  function cliff(parent,z,direction,width=10.5){
    const geo=g(`cliff-${width}-${direction}`,()=>{
      const positions=[],indices=[],nx=14,ny=4;
      for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
        const x=(i/nx-.5)*width,y=-j*2.1;
        positions.push(x,y,direction*(Math.sin(i*2.73+j*1.4)*.22+j*.16));
      }
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,b,c,b,d,c);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
    });
    const face=mesh(parent,geo,stoneDark,0,0,z);face.material=mat('cliff-double',0x25343f,{side:THREE.DoubleSide});
    for(let i=0;i<8;i++){
      const x=(i-3.5)*1.43;const r=mesh(parent,roughRock(),i%3===0?moss:stone,x,-.16,z-direction*.24,.81,.34,.59);r.rotation.y=i*1.7;
      if(i%2===0)rod(parent,[x,-.6,z],[x+.2,-2.3-(i%3)*.3,z+direction*.5],.027,wood);
    }
  }
  function ridgeGeometry(length,height=1.1){return g(`ridge-${length}-${height}`,()=>{
    const positions=[],uvs=[],indices=[],nx=8,nz=24;
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const z=(j/nz-.5)*length,edge=Math.sin(Math.PI*j/nz),y=Math.pow(edge,2)*height;
      positions.push((i/nx-.5)*10.5,y,z);uvs.push(i/nx*3,j/nz*5);
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  });}
  function roadSlabGeometry(width,length,seed){return g(`broken-slab-${width}-${length}-${seed}`,()=>{
    const positions=[],uvs=[],indices=[],perimeter=[];
    // The top is an exact rectangle matching its support. Damage stays below
    // y=0, so neither invisible holes nor unsupported decorative top edges occur.
    for(const [x,z] of [[-width/2,-length/2],[width/2,-length/2],[width/2,length/2],[-width/2,length/2]]){positions.push(x,0,z);uvs.push(x/2,z/2);}
    indices.push(0,2,1,0,3,2);
    for(let side=0;side<4;side++)for(let i=0;i<6;i++){
      const t=i/6,corners=[[-width/2,-length/2],[width/2,-length/2],[width/2,length/2],[-width/2,length/2]],a=corners[side],b=corners[(side+1)%4];
      perimeter.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
    for(let i=0;i<perimeter.length;i++){
      const a=perimeter[i],b=perimeter[(i+1)%perimeter.length],j=positions.length/3,depth=.36+.18*(.5+.5*Math.sin(i*3.31+seed));
      positions.push(a[0],0,a[1],b[0],0,b[1],a[0]*.94,-depth,a[1]*.985,b[0]*.94,-.43-.08*Math.cos(i+seed),b[1]*.985);
      uvs.push(i*.35,0,(i+1)*.35,0,i*.35,.45,(i+1)*.35,.45);indices.push(j,j+1,j+2,j+1,j+3,j+2);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  });}
  function brokenRoad(parent,length,supports){
    const apronLength=1.8,step=(length-2.4)/5,lanes=[-1,0,1,0,-1];
    const slabs=[{z:length/2-.6,halfLength:apronLength/2,lane:0,halfWidth:5.25,height:0}];
    for(let i=0;i<5;i++)slabs.push({z:length/2-1.2-(i+.5)*step,halfLength:step/2+.65,lane:lanes[i],halfWidth:1.19,height:0});
    slabs.push({z:-length/2+.6,halfLength:apronLength/2,lane:0,halfWidth:5.25,height:0});
    for(let i=0;i<slabs.length;i++){
      const s=slabs[i],x=s.lane*2.8,w=s.halfWidth*2,L=s.halfLength*2;
      mesh(parent,roadSlabGeometry(w,L,i),i===0||i===slabs.length-1?stoneDark:stone,x,0,s.z);
      // Cut joints and moss follow the floor but never obscure its true boundary.
      for(const side of [-1,1]){
        rod(parent,[x+side*(w*.5-.035),-.035,s.z-L*.46],[x+side*(w*.5-.035),-.035,s.z+L*.46],.025,stoneEdge);
        for(let n=0;n<2;n++){
          const z=s.z+(n?1:-1)*L*.27;
          rod(parent,[x+side*w*.43,-.32,z],[x+side*(w*.38+.16),-1.02-.17*(i%3),z+.32],.023,iron);
        }
      }
      if(i>0&&i<slabs.length-1){
        mesh(parent,roughRock('road-support'),stoneDark,x,-1.24,s.z,w*.34,.99,L*.26).rotation.y=i*.16;
        for(const side of [-1,1])rod(parent,[x+side*w*.42,-.29,s.z+L*.28],[x+side*.36,-1.8,s.z],.11,stoneDark);
        const seam=[];for(let n=0;n<5;n++)seam.push([x+(n/4-.5)*w*.94,.008,s.z+.12*Math.sin(n*2.7+i)]);crack(parent,seam);
        mesh(parent,roughRock(),moss,x+w*.3,-.035,s.z-L*.25,.21,.045,L*.15).rotation.y=i;
      }
      supports.push({...s});
    }
    parent.userData.routeLanes=[...lanes];parent.userData.sectionOverlap=1.3;
  }
  function buildTerrain(kind,{length=16,ropeLane=0}={}){
    const p=new THREE.Group();p.name='terrain · '+kind;
    const L=Math.max(8,length),supports=[];
    p.userData={kind,length:L,gapLength:kind==='ridge'?0:L,supports};
    if(kind==='ridge'){
      const height=1.1;mesh(p,ridgeGeometry(L,height),stone);p.userData.heightProfile='ridge';p.userData.height=height;
      for(const x of [-5.16,5.16]){
        const points=[];for(let n=0;n<=16;n++){const z=(n/16-.5)*L;points.push([x,.12+Math.pow(Math.sin(Math.PI*n/16),2)*height,z]);}
        curve(p,points,.08,stoneEdge,`ridge-edge-${L}-${x}`);
      }
      for(let n=1;n<12;n++){
        const z=(n/12-.5)*L,y=Math.pow(Math.sin(Math.PI*n/12),2)*height;
        crack(p,[[-5.12,y+.006,z],[-1.7,y+.006,z+.05],[1.7,y+.006,z-.04],[5.12,y+.006,z]]);
      }
      supports.push({z:0,halfLength:L/2,lane:0,halfWidth:5.25,height:0});
      return p;
    }
    cliff(p,-L/2,1);cliff(p,L/2,-1);
    const abyss=mesh(p,box,black,0,-7.9,0,12,.02,L+1);abyss.castShadow=false;
    if(kind==='brokenRoad'){
      brokenRoad(p,L,supports);
    }else if(kind==='rope'){
      const x=ropeLane*2.8;
      for(const side of [-1,1])for(const z of [-L/2-.5,L/2+.5]){
        log(p,[x+side*.65,0,z],[x+side*.65,1.42,z],.085);binding(p,x+side*.65,1.1,z,'y',.11);
      }
      for(const side of [-1,1]){
        curve(p,[[x+side*.63,1.18,-L/2-.5],[x+side*.66,.83,0],[x+side*.63,1.18,L/2+.5]],.045,rope,`rope-hand-${L}-${ropeLane}-${side}`);
        curve(p,[[x+side*.085,.08,-L/2-.15],[x+side*.085,-.1,0],[x+side*.085,.08,L/2+.15]],.105,rope,`rope-foot-${L}-${ropeLane}-${side}`);
      }
      for(let i=0;i<12;i++){
        const t=(i+.5)/12,z=(t-.5)*L,sag=-Math.sin(Math.PI*t)*.12;
        // Short lateral knots give a single-rope traversal a readable walking line.
        rod(p,[x-.21,sag+.03,z],[x+.21,sag+.03,z],.038,woodCut);
        if(i%2===0)for(const side of [-1,1])rod(p,[x+side*.62,1.16-Math.sin(Math.PI*t)*.32,z],[x+side*.16,sag,z],.019,rope);
      }
      supports.push({z:0,halfLength:L/2+.45,lane:ropeLane,halfWidth:.42,height:0});
      p.userData.ropeLane=ropeLane;p.userData.ropeWidth=.84;
    }else if(kind==='stepping'){
      const steps=[{z:L*.3,lane:-1},{z:0,lane:0},{z:-L*.3,lane:1}];
      for(let i=0;i<steps.length;i++){
        const step=steps[i],x=step.lane*2.8,halfLength=1.6;
        mesh(p,roughRock(),stoneDark,x,-2.15,step.z,1.25,2.1,1.75).rotation.y=i*.4;
        mesh(p,cylinder,stone,x,-.08,step.z,1.13,.2,1.62);
        mesh(p,cylinder,moss,x-.18,.028,step.z+.17,.56,.018,.75);
        supports.push({z:step.z,halfLength,lane:step.lane,halfWidth:1.05,height:0});
        for(const side of [-1,1])mesh(p,sphere,turquoise,x+side*.82,.1,step.z,.06,.06,.06);
      }
    }
    // Weathered hazard ropes at the banks warn of the absent road well before a jump.
    for(const z of [-L/2-.18,L/2+.18])for(const x of [-4.9,4.9]){
      log(p,[x,0,z],[x,.85,z],.055);mesh(p,torus,gold,x,.72,z,.1,.1,.1);
    }
    return p;
  }
  const terrainTemplates=new Map();
  function makeTerrain(kind,{length=16,ropeLane=0}={}){
    const normalizedLength=Math.max(8,length),key=kind+':'+normalizedLength+':'+ropeLane;
    if(!terrainTemplates.has(key)){
      const template=bakeStaticObstacle(buildTerrain(kind,{length:normalizedLength,ropeLane}));
      template.userData.bakedTerrain=true;terrainTemplates.set(key,template);
    }
    return terrainTemplates.get(key).clone(true);
  }
  function animateObstacle(object,kind,elapsed){
    if(kind==='blades'&&object.userData.pivot)object.userData.pivot.rotation.z=Math.sin(elapsed*2.5)*.43;
    if(kind==='cart'&&object.userData.wheels)for(const wheel of object.userData.wheels)wheel.rotation.x=elapsed*3;
    if(kind==='crystal')object.rotation.y=Math.sin(elapsed*.6)*(object.userData.span>1?.004:.018);
    if(kind==='pendulum'&&object.userData.contactJoint){
      object.userData.contactJoint.rotation.z=Math.sin(elapsed*Math.PI*2/3.8)*.29;
      setBladeContact(object);
    }
    if(kind==='sawGate'&&object.userData.contactJoint){
      const phase=elapsed*Math.PI*2/3.6,joint=object.userData.contactJoint;
      joint.position.x=Math.sin(phase)*.72;joint.position.y=1.48+Math.cos(phase)*.16;
      object.userData.contactBlade.rotation.z=elapsed*5.5;setBladeContact(object);
    }
  }
  function dispose(object){object.traverse(node=>{if(node.userData.courseOwnedGeometry)node.geometry?.dispose();});}
  return {makeObstacle,makeTerrain,animateObstacle,setRockDamage,dispose};
}
