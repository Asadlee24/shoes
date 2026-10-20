# Procedural 3D illustrations based on the owner's loafer styles, not product scans.
import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name, colour, rough=.65, metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*colour,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*colour,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 return m
black=mat('Leather_black',(0.022,.024,.027),.60); suede=mat('Suede_taupe',(.16,.093,.054),.95)
sole_black=mat('Rubber_black',(.015,.017,.019),.73);sole_tan=mat('Rubber_tan',(.42,.24,.10),.85)
lining=mat('Tan_lining',(.28,.15,.065),.85);thread=mat('Stitch_taupe',(.47,.34,.22),.82);metal=mat('Dark_brass',(.17,.145,.10),.24,.85)
pts=[(.157,0),(.15,.032),(.12,.049),(.06,.054),(-.01,.044),(-.08,.039),(-.135,.037),(-.158,.021),(-.162,0),(-.157,-.023),(-.13,-.039),(-.07,-.036),(.005,-.043),(.075,-.052),(.13,-.044),(.15,-.028)]
def outline(t):
 u=(t%(2*math.pi))/(2*math.pi)*len(pts);i=int(u);f=u-i;p0=pts[(i-1)%16];p1=pts[i%16];p2=pts[(i+1)%16];p3=pts[(i+2)%16]
 return tuple(.5*((2*p1[k])+(-p0[k]+p2[k])*f+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*f*f+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*f*f*f) for k in [0,1])
N=128
def mesh(name,verts,faces,material,parent):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.parent=parent;ob.data.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 return ob
def loft(name,rings,material,parent,cap=False):
 verts=[v for ring in rings for v in ring]; faces=[]
 for j in range(len(rings)-1):
  for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 if cap:faces.extend([tuple(reversed(range(N))),tuple((len(rings)-1)*N+i for i in range(N))])
 return mesh(name,verts,faces,material,parent)
def line(name,coords,material,parent,r=.00065):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=2;s=cu.splines.new('POLY');s.points.add(len(coords)-1)
 for p,v in zip(s.points,coords):p.co=(*v,1)
 ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);ob.parent=parent;ob.data.materials.append(material);return ob
def make_shoe(name,offset,uppermat,solemat):
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);root.location.y=offset
 rings=[]
 for z,scale in [(0,.96),(.004,1.01),(.018,1.01),(.022,.96)]:rings.append([(*(v*scale for v in outline(i*2*math.pi/N)),z) for i in range(N)])
 loft(name+'_sole',rings,solemat,root,True)
 base=[];low=[];mid=[];shoulder=[];top=[];rim=[];inside=[];bottom=[]
 for i in range(N):
  t=i*2*math.pi/N;x,y=outline(t);front=max(0,min(1,(x+.04)/.18));z=.079-.028*front
  base.append((x*.96,y*.96,.021));low.append((x*.965,y*.96,.030));mid.append((x*.95,y*.94,z-.012));shoulder.append((x*.86,y*.84,z))
  ix=-.079+.073*math.cos(t);iy=.0305*math.sin(t);iz=.079-.011*max(0,math.cos(t))
  top.append((x*.86*.72+ix*.28,y*.84*.72+iy*.28,z*.72+iz*.28+.001));rim.append((ix,iy,iz));inside.append((ix*.985,iy*.94,iz-.002));bottom.append((-.079+.064*math.cos(t),.027*math.sin(t),.028))
 loft(name+'_upper',[base,low,mid,shoulder,top,rim],uppermat,root)
 loft(name+'_lining',[rim,inside,bottom],lining,root)
 mesh(name+'_insole',bottom,[tuple(range(N))],lining,root)
 line(name+'_collar',rim+[rim[0]],uppermat,root,.0013)
 seam=[]
 for j in range(100):
  t=-1.95+j*3.9/99;x,y=outline(t);front=max(0,min(1,(x+.04)/.18));seam.append((x*.85,y*.83,.080-.028*front))
 line(name+'_apron_seam',seam,uppermat,root,.0009)
 for j in range(0,98,2):
  coords=[(p[0],p[1],p[2]+.0009) for p in seam[j:j+2]];line(name+'_stitch_'+str(j),coords,thread if uppermat==suede else lining,root,.00025)
 # A curved saddle, with a central penny slot in the brown version.
 vs=[];fs=[];xs=[.005,.012,.022,.030];ys=[-.04,-.014,.014,.04]
 for x in xs:
  for y in ys:vs.append((x,y,.071+(.004*(1-(y/.043)**2))))
 for a in range(3):
  for b in range(3):
   if uppermat==suede and a==1 and b==1:continue
   fs.append((a*4+b,(a+1)*4+b,(a+1)*4+b+1,a*4+b+1))
 saddle=mesh(name+'_saddle',vs,fs,uppermat,root);mod=saddle.modifiers.new('Saddle thickness','SOLIDIFY');mod.thickness=.001
 if uppermat==black:
  for cy in [-.022,.022]:
   coords=[(.017+.0065*math.cos(t),cy+.012*math.sin(t),.078) for t in [j*2*math.pi/40 for j in range(41)]]
   line(name+'_bit_link_'+str(cy),coords,metal,root,.0018)
  line(name+'_bit_bar',[(.017,-.014,.079),(.017,.014,.079)],metal,root,.002)
 return root
make_shoe('HERO_BLACK',-.085,black,sole_black);make_shoe('HERO_SUEDE',.085,suede,sole_tan)
floor=mat('Floor',(.73,.73,.71),.9)
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.name='ENV_floor';bpy.context.object.data.materials.append(floor)
scene=bpy.context.scene
if scene.world is None: scene.world=bpy.data.worlds.new('World_studio')
scene.world.color=(.16,.16,.16)
def aim(ob,point):ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.55,-.7,.52));cam=bpy.context.object;cam.name='CAM_main';cam.data.type='ORTHO';cam.data.ortho_scale=.65;aim(cam,(0,0,.035));scene.camera=cam
for name,kind,loc,power,radius in [('LGT_key','POINT',(.2,-.3,.65),18,.32),('LGT_fill','POINT',(-.4,.2,.35),8,.32),('LGT_rim','POINT',(.3,.4,.4),15,.30)]:
 data=bpy.data.lights.new(name,kind);data.energy=power;data.shadow_soft_size=radius;ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
target=artifacts.file(name='loafers-front.png',media_type='image/png');scene.render.filepath=str(target.path);bpy.ops.render.render(write_still=True);target.publish()
result={'roots':['HERO_BLACK','HERO_SUEDE'],'objects':len(bpy.data.objects),'units':'metres','illustration':True}
