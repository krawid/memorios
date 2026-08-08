# Servidor de clasificaciones de Memorios

API mínima para las clasificaciones por modo. **Sin una sola dependencia de ejecución**: usa
`node:http` y `node:sqlite`, los dos incorporados en Node 24. Tampoco tiene paso de compilación
— Node 24 ejecuta TypeScript directamente quitando los tipos, así que `tsc` solo comprueba.

## Rutas

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/salud` | Comprobación de vida. Devuelve `{ ok: true }` |
| `POST` | `/puntuaciones` | Publica una puntuación. Cuerpo: `{ jugadorId, apodo, modo, rondas }` |
| `GET` | `/clasificacion/:modo` | Los 50 primeros de ese modo. Admite `?jugadorId=` (ver abajo) |

Modos válidos: `tranqui`, `chunguillo`, `nidecona`.

**`POST /puntuaciones` es idempotente y se queda siempre con la marca más alta.** La app reenvía
sus mejores puntuaciones cada vez que abre la clasificación, por si alguna se quedó sin subir
(sin cobertura, servidor caído). Recibir una repetida o más baja no estropea nada.

**`?jugadorId=` en la clasificación**: si ese jugador no sale entre los 50 primeros, la respuesta
incluye su puesto aparte en `propio`, para poder decirle "vas 55.º" en vez de dejarlo sin
ninguna referencia. Si ya sale en la lista, `propio` viene a `null`.

Los empates comparten puesto (1, 2, 2, 4), que es lo que la gente espera de una clasificación.

## Desarrollo

```bash
npm install          # solo dependencias de desarrollo (TypeScript y los tipos de Node)
npm run verificar    # tipos + tests
npm run iniciar      # arranca en el puerto 3000
```

Variables de entorno:

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3000` | Railway la fija sola |
| `RUTA_BD` | `./datos/memorios.db` | Ruta del fichero SQLite |

## Despliegue en Railway

1. Proyecto nuevo → desplegar desde el repositorio `krawid/memorios`.
2. **Ajustes del servicio → Root Directory: `servidor`**. Sin esto intentará construir la app de
   Expo, que es lo que hay en la raíz del repositorio.
3. **Añadir un volumen** y montarlo en `/datos`.
4. Variable de entorno: `RUTA_BD=/datos/memorios.db`.
5. Dominio: el `*.up.railway.app` que da Railway, o un subdominio propio tipo
   `memorios.krawid.es`.

> ⚠️ **El volumen del paso 3 no es opcional.** El sistema de archivos del contenedor es efímero:
> sin volumen, cada despliegue borra la clasificación entera **sin dar ningún error**. Un día
> descubres que la tabla está vacía y no hay nada en los registros que lo explique.

Comprobar que ha ido bien:

```bash
curl https://TU-DOMINIO/salud
```

## Lo que este servidor NO hace, y por qué

**No valida que las puntuaciones sean reales.** Se fía de lo que le manda la app. En partida
normal la secuencia sale de `Math.random` en el móvil y no queda registrada en ningún sitio, así
que el servidor no tiene con qué contrastarla. Se podría cambiar haciendo que las partidas en
solitario usen semilla (como ya hace Pásalo) y mandando los gestos para replicar la partida —
pero ni así se distingue a quien memoriza de quien apunta la secuencia en un papel, porque el
input no tiene límite de tiempo, que es un requisito de accesibilidad deliberado.

Para un grupo de amigos, fiarse es la decisión correcta. Si esto llegara a la App Store con gente
desconocida, habría que replantearlo.

**No hay cuentas ni contraseñas.** El `jugadorId` lo genera el móvil al azar la primera vez. Es
**opaco a propósito**: el servidor nunca supone qué hay dentro, así que el día que haya
*Sign in with Apple* basta con meter ahí el identificador de la cuenta y añadir una ruta que
fusione el dispositivo antiguo con la cuenta nueva. Nada más de aquí cambia.

**No hay copias de seguridad automáticas.** Es el precio de SQLite frente a Postgres. Si el
volumen se pierde, se pierde la clasificación.

**El límite de peticiones no es seguridad.** El repositorio es público y la dirección del
servidor se ve en el código de la app: cualquiera puede mandar puntuaciones a mano. El límite
(60 por minuto e IP) solo evita que un bucle accidental o un curioso llenen la tabla.
