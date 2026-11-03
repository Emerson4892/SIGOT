import { prisma } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { administradorInicial } from '../src/config/adminInicial.js';
import { PERMISOS, ROLES, SLA_INICIAL, USUARIOS_DEMO } from '../src/config/rbac.js';
import { auditar } from '../src/services/trazabilidad.js';
import { hashContrasena } from '../src/utils/password.js';

async function sembrarAcceso() {
  for (const [codigo, modulo, descripcion] of PERMISOS) {
    await prisma.permiso.upsert({
      where: { codigo },
      update: { modulo, descripcion },
      create: { codigo, modulo, descripcion },
    });
  }
  const permisos = await prisma.permiso.findMany();
  const porCodigo = new Map(permisos.map((permiso) => [permiso.codigo, permiso.id]));

  for (const [codigo, nombre, descripcion, lista] of ROLES) {
    const rol = await prisma.rol.upsert({
      where: { codigo },
      update: { nombre, descripcion },
      create: { codigo, nombre, descripcion },
    });
    const actuales = await prisma.rolPermiso.count({ where: { rolId: rol.id } });
    if (actuales === 0) {
      await prisma.rolPermiso.createMany({
        data: lista.map((permiso) => ({ rolId: rol.id, permisoId: porCodigo.get(permiso) })),
      });
    }
  }
}

async function sembrarUsuarios() {
  if (!env.seedDemoUsers) return;
  const roles = await prisma.rol.findMany();
  const porCodigo = new Map(roles.map((rol) => [rol.codigo, rol.id]));
  for (const demo of USUARIOS_DEMO) {
    const contrasena = process.env[demo.env];
    if (!contrasena) continue;
    const existe = await prisma.usuario.findUnique({ where: { correo: demo.correo } });
    if (existe) continue;
    const usuario = await prisma.usuario.create({
      data: {
        correo: demo.correo,
        contrasenaHash: await hashContrasena(contrasena),
        nombre: demo.nombre,
        apellido: demo.apellido,
        debeCambiarClave: false,
        roles: { create: [{ rolId: porCodigo.get(demo.rol) }] },
      },
    });
    if (demo.tecnico) {
      await prisma.tecnico.create({
        data: { usuarioId: usuario.id, codigoEmpleado: 'TEC-DEMO-0001', especialidad: 'Campo' },
      });
    }
  }
}

async function sembrarAdministradorInicial() {
  const admin = administradorInicial();
  if (!admin) return;
  const total = await prisma.usuario.count();
  if (total > 0) {
    console.log('SIGOT: ya hay usuarios; no se vuelve a crear el administrador inicial.');
    return;
  }
  const rol = await prisma.rol.findUnique({ where: { codigo: 'ADMINISTRADOR' } });
  if (!rol) throw new Error('No existe el rol ADMINISTRADOR.');
  await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        correo: admin.correo,
        contrasenaHash: await hashContrasena(admin.contrasena),
        nombre: admin.nombre,
        apellido: admin.apellido,
        debeCambiarClave: true,
        roles: { create: [{ rolId: rol.id }] },
      },
    });
    await auditar(tx, {
      usuarioId: usuario.id,
      accion: 'CREAR_USUARIO',
      entidad: 'Usuario',
      entidadId: usuario.id,
      resultado: 'EXITO',
      detalle: { correo: usuario.correo, roles: ['ADMINISTRADOR'], origen: 'inicializacion' },
    });
  });
  console.log(`SIGOT: administrador inicial creado para ${admin.correo}. El primer acceso exige cambiar la contraseña.`);
}

async function sembrarCatalogos() {
  for (const politica of SLA_INICIAL) {
    const existe = await prisma.politicaSla.findUnique({ where: { prioridad: politica.prioridad } });
    if (!existe) await prisma.politicaSla.create({ data: politica });
  }
  const categoria = await prisma.categoriaRepuesto.findUnique({ where: { nombre: 'General' } });
  if (!categoria) {
    await prisma.categoriaRepuesto.create({ data: { nombre: 'General', descripcion: 'Categoría inicial de repuestos' } });
  }
  const plantilla = await prisma.plantillaChecklist.findFirst({ where: { nombre: 'Inspección general de activo' } });
  if (!plantilla) {
    await prisma.plantillaChecklist.create({
      data: {
        nombre: 'Inspección general de activo',
        descripcion: 'Actividades mínimas antes de solicitar el cierre.',
        items: {
          create: [
            { texto: 'Verificar el estado físico del activo', obligatorio: true, posicion: 1 },
            { texto: 'Verificar las condiciones de seguridad del área', obligatorio: true, posicion: 2 },
            { texto: 'Registrar lecturas o mediciones', obligatorio: false, posicion: 3 },
            { texto: 'Dejar el área de trabajo en orden', obligatorio: true, posicion: 4 },
          ],
        },
      },
    });
  }
  const configuraciones = [
    ['evidencia_minima', 1],
    ['checklist_obligatorio', true],
    ['nombre_sistema', 'SIGOT'],
  ];
  for (const [clave, valor] of configuraciones) {
    const existe = await prisma.configuracion.findUnique({ where: { clave } });
    if (!existe) await prisma.configuracion.create({ data: { clave, valor } });
  }
}

async function main() {
  await sembrarAcceso();
  await sembrarCatalogos();
  await sembrarUsuarios();
  await sembrarAdministradorInicial();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
