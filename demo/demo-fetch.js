(function () {
    'use strict';

    const DEMO_ENABLED = typeof window !== 'undefined' && window.DEMO_MODE === true;
    if (!DEMO_ENABLED) return;

    const PREFIX = (window.DEMO_STORAGE_PREFIX || 'crear_noticias_demo_');

    const k = {
        users: `${PREFIX}users`,
        sessions: `${PREFIX}sessions`,
        noticias: `${PREFIX}noticias`,
        eventos: `${PREFIX}eventos`,
        media: `${PREFIX}media`,
        seq: `${PREFIX}seq`,
    };

    const nowIso = () => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const y = d.getFullYear();
        const m = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hh = pad(d.getHours());
        const mm = pad(d.getMinutes());
        const ss = pad(d.getSeconds());
        return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    };

    const todayYmd = () => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const safeJsonParse = (raw, fallback) => {
        try {
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    };

    const load = (key, fallback) => {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        return safeJsonParse(raw, fallback);
    };

    const save = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    const initSeed = () => {
        const existingUsers = load(k.users, null);
        if (!existingUsers) {
            const seedUsers = [
                { id: 1, usuario: 'Director Demo', nombre: 'Director Demo', email: 'director@demo.com', password: '1234', rol: 'director', activo: 1, ciclo_lectivo: 2026 },
                { id: 2, usuario: 'Profesor Demo', nombre: 'Profesor Demo', email: 'profesor@demo.com', password: '1234', rol: 'profesor', activo: 1, ciclo_lectivo: 2026 },
                { id: 3, usuario: 'Alumno Demo', nombre: 'Alumno Demo', email: 'alumno@demo.com', password: '1234', rol: 'alumno', activo: 1, ciclo_lectivo: 2026 },
            ];
            save(k.users, seedUsers);
        }

        if (!load(k.sessions, null)) save(k.sessions, {});
        if (!load(k.noticias, null)) save(k.noticias, []);
        if (!load(k.eventos, null)) save(k.eventos, []);
        if (!load(k.media, null)) save(k.media, {});
        if (!load(k.seq, null)) save(k.seq, { noticias: 1, eventos: 1, media: 1 });

        // Seed básico de contenido
        const noticias = load(k.noticias, []);
        if (Array.isArray(noticias) && noticias.length === 0) {
            const seed = {
                id: 1,
                titulo: 'Bienvenido a la demo',
                contenido: 'Esta es una noticia de prueba creada en modo DEMO (localStorage).',
                media_items: [],
                imagen_url: null,
                video_url: null,
                created_date: todayYmd(),
                created_at: nowIso(),
                fecha_publicacion: todayYmd(),
                hora_publicacion: null,
                fecha_expiracion: null,
                activa: 1,
                autor_id: 1,
            };
            save(k.noticias, [seed]);
            const seq = load(k.seq, { noticias: 1, eventos: 1, media: 1 });
            seq.noticias = Math.max(seq.noticias, 2);
            save(k.seq, seq);
        }

        const eventos = load(k.eventos, []);
        if (Array.isArray(eventos) && eventos.length === 0) {
            const seed = {
                id: 1,
                titulo: 'Evento de prueba',
                descripcion: 'Este es un evento de prueba creado en modo DEMO (localStorage).',
                fecha_evento: todayYmd(),
                hora_evento: '14:00',
                lugar: 'Aula 1',
                media_items: [],
                imagen_url: null,
                video_url: null,
                created_date: todayYmd(),
                created_at: nowIso(),
                fecha_expiracion: null,
                activo: 1,
                autor_id: 2,
            };
            save(k.eventos, [seed]);
            const seq = load(k.seq, { noticias: 1, eventos: 1, media: 1 });
            seq.eventos = Math.max(seq.eventos, 2);
            save(k.seq, seq);
        }
    };

    initSeed();

    const randomToken = () => {
        const part = () => Math.random().toString(16).slice(2);
        return `${part()}${part()}${part()}`;
    };

    const getAuthHeader = (headers) => {
        if (!headers) return '';
        const get = (name) => {
            try {
                return headers.get(name);
            } catch (e) {
                return '';
            }
        };
        return (
            get('Authorization') ||
            get('authorization') ||
            get('X-Authorization') ||
            get('x-authorization') ||
            ''
        );
    };

    const tokenFromHeaders = (headers) => {
        const h = getAuthHeader(headers);
        const m = String(h || '').match(/Bearer\s+(.+)$/i);
        return m ? m[1] : '';
    };

    const currentSessionUser = (token) => {
        const sessions = load(k.sessions, {});
        const record = sessions && token ? sessions[token] : null;
        if (!record) return null;
        if (record.expira_en && new Date(record.expira_en).getTime() < Date.now()) return null;
        const users = load(k.users, []);
        return (users || []).find(u => Number(u.id) === Number(record.usuario_id)) || null;
    };

    const requireAuth = (headers) => {
        const token = tokenFromHeaders(headers);
        if (!token) {
            return { ok: false, status: 401, json: { error: 'Token no proporcionado' } };
        }
        const user = currentSessionUser(token);
        if (!user) {
            return { ok: false, status: 401, json: { error: 'Token inválido o expirado' } };
        }
        return { ok: true, user, token };
    };

    const isWriterRole = (rol) => {
        const r = String(rol || '').trim().toLowerCase();
        return r === 'director' || r === 'profesor' || r === 'alumno';
    };

    const jsonResponse = (body, status = 200) => {
        return new Response(JSON.stringify(body), {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    };

    const parseUrl = (input) => {
        const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
        return new URL(urlStr, window.location.origin);
    };

    const readJsonBody = async (input, init) => {
        try {
            if (input instanceof Request) {
                return await input.clone().json();
            }
            if (init && init.body) {
                if (typeof init.body === 'string') return safeJsonParse(init.body, null);
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    const fileToDataUrl = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    };

    const normalizePath = (pathname) => {
        // soporta /Crear-Noticias/api/... o /api/...
        const p = String(pathname || '');
        const idx = p.indexOf('/api/');
        if (idx >= 0) return p.slice(idx);
        return p;
    };

    const originalFetch = window.fetch.bind(window);

    window.fetch = async function demoFetch(input, init) {
        try {
            const url = parseUrl(input);
            const path = normalizePath(url.pathname);
            const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            const headers = (input instanceof Request) ? input.headers : new Headers((init && init.headers) || {});

            // Solo interceptar endpoints /api
            if (!path.startsWith('/api/')) {
                return originalFetch(input, init);
            }

            // AUTH
            if (path === '/api/auth/login.php' && method === 'POST') {
                const body = await readJsonBody(input, init);
                const email = String(body && body.email ? body.email : '').trim().toLowerCase();
                const password = String(body && body.password ? body.password : '');

                const users = load(k.users, []);
                const user = (users || []).find(u => String(u.email || '').trim().toLowerCase() === email);
                if (!user || String(user.password) !== password) {
                    return jsonResponse({ success: false, error: 'Credenciales incorrectas' }, 401);
                }
                if (!(user.activo === 1 || user.activo === true || user.activo === '1')) {
                    return jsonResponse({ success: false, error: 'Usuario inactivo' }, 403);
                }

                const token = randomToken();
                const exp = new Date(Date.now() + 1000 * 60 * 60 * 8); // 8h demo

                const sessions = load(k.sessions, {});
                sessions[token] = { usuario_id: user.id, expira_en: exp.toISOString() };
                save(k.sessions, sessions);

                return jsonResponse({
                    success: true,
                    token,
                    expira_en: exp.toISOString(),
                    usuario: {
                        id: user.id,
                        usuario: user.usuario,
                        nombre: user.nombre || user.usuario,
                        email: user.email,
                        rol: user.rol,
                        ciclo_lectivo: user.ciclo_lectivo,
                    }
                }, 200);
            }

            if (path === '/api/auth/check.php' && method === 'GET') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);

                const user = auth.user;
                return jsonResponse({
                    success: true,
                    usuario: {
                        id: user.id,
                        usuario: user.usuario,
                        nombre: user.nombre || user.usuario,
                        email: user.email,
                        rol: user.rol,
                        ciclo_lectivo: user.ciclo_lectivo,
                    }
                }, 200);
            }

            // MEDIA UPLOAD
            if (path === '/api/media/upload.php' && method === 'POST') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);

                let form;
                try {
                    if (input instanceof Request) {
                        form = await input.clone().formData();
                    } else if (init && init.body && typeof init.body.get === 'function') {
                        // unlikely
                        form = init.body;
                    } else {
                        form = await new Request(url.toString(), init).formData();
                    }
                } catch (e) {
                    return jsonResponse({ success: false, error: 'No se pudo leer el archivo (demo)' }, 400);
                }

                const file = form.get('file');
                if (!file || !(file instanceof Blob)) {
                    return jsonResponse({ success: false, error: 'Archivo no proporcionado' }, 400);
                }

                const seq = load(k.seq, { noticias: 1, eventos: 1, media: 1 });
                const id = seq.media || 1;
                seq.media = id + 1;
                save(k.seq, seq);

                const dataUrl = await fileToDataUrl(file);
                if (!dataUrl) {
                    return jsonResponse({ success: false, error: 'No se pudo procesar el archivo (demo)' }, 500);
                }

                const media = load(k.media, {});
                media[id] = {
                    id,
                    type: String(file.type || '').startsWith('video') ? 'video' : 'image',
                    name: file.name || `media_${id}`,
                    dataUrl,
                    created_at: nowIso(),
                };
                save(k.media, media);

                return jsonResponse({ success: true, url: dataUrl, type: media[id].type }, 200);
            }

            // USUARIOS
            if (path === '/api/usuarios/index.php' && method === 'GET') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (String(auth.user.rol || '').toLowerCase() !== 'director') {
                    return jsonResponse({ success: false, error: 'No autorizado' }, 403);
                }
                const users = load(k.users, []);
                const sanitized = (users || []).map(u => ({
                    id: u.id,
                    usuario: u.usuario,
                    nombre: u.nombre || u.usuario,
                    email: u.email,
                    rol: u.rol,
                    activo: u.activo,
                    ciclo_lectivo: u.ciclo_lectivo,
                }));
                return jsonResponse({ success: true, data: sanitized }, 200);
            }

            if (path === '/api/usuarios/create.php' && method === 'POST') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (String(auth.user.rol || '').toLowerCase() !== 'director') {
                    return jsonResponse({ success: false, error: 'No autorizado' }, 403);
                }
                const body = await readJsonBody(input, init);
                const usuario = String(body && body.usuario ? body.usuario : '').trim();
                const email = String(body && body.email ? body.email : '').trim().toLowerCase();
                const password = String(body && body.password ? body.password : '');
                const rol = String(body && body.rol ? body.rol : 'alumno').trim().toLowerCase();
                const ciclo_lectivo = body && body.ciclo_lectivo != null ? Number(body.ciclo_lectivo) : null;

                if (!usuario || !email || !password) {
                    return jsonResponse({ success: false, error: 'Completá usuario, correo y contraseña' }, 400);
                }

                const users = load(k.users, []);
                if ((users || []).some(u => String(u.email || '').trim().toLowerCase() === email)) {
                    return jsonResponse({ success: false, error: 'Ya existe un usuario con ese correo' }, 409);
                }

                const nextId = Math.max(0, ...(users || []).map(u => Number(u.id) || 0)) + 1;
                const newUser = {
                    id: nextId,
                    usuario,
                    nombre: usuario,
                    email,
                    password,
                    rol,
                    activo: 1,
                    ciclo_lectivo: Number.isFinite(ciclo_lectivo) ? ciclo_lectivo : null,
                };
                users.push(newUser);
                save(k.users, users);

                return jsonResponse({ success: true, data: { id: nextId } }, 200);
            }

            if (path === '/api/usuarios/delete.php' && method === 'POST') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (String(auth.user.rol || '').toLowerCase() !== 'director') {
                    return jsonResponse({ success: false, error: 'No autorizado' }, 403);
                }
                const body = await readJsonBody(input, init);
                const id = Number(body && body.id ? body.id : 0);
                if (!id) return jsonResponse({ success: false, error: 'ID inválido' }, 400);

                const users = load(k.users, []);
                const filtered = (users || []).filter(u => Number(u.id) !== id);
                save(k.users, filtered);

                return jsonResponse({ success: true }, 200);
            }

            if (path === '/api/usuarios/update_nombre.php' && method === 'PUT') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);

                const body = await readJsonBody(input, init);
                const nombre = String(body && body.nombre ? body.nombre : '').trim();
                if (!nombre) return jsonResponse({ success: false, error: 'Nombre inválido' }, 400);

                const users = load(k.users, []);
                const idx = (users || []).findIndex(u => Number(u.id) === Number(auth.user.id));
                if (idx < 0) return jsonResponse({ success: false, error: 'Usuario no encontrado' }, 404);

                users[idx] = {
                    ...users[idx],
                    nombre,
                    usuario: users[idx].usuario || nombre,
                };
                save(k.users, users);

                const updated = users[idx];
                return jsonResponse({
                    success: true,
                    usuario: {
                        id: updated.id,
                        usuario: updated.usuario,
                        nombre: updated.nombre || updated.usuario,
                        email: updated.email,
                        rol: updated.rol,
                        ciclo_lectivo: updated.ciclo_lectivo,
                    }
                }, 200);
            }

            const attachAutor = (item) => {
                const users = load(k.users, []);
                const autor = (users || []).find(u => Number(u.id) === Number(item.autor_id)) || null;
                return {
                    ...item,
                    autor: autor ? { nombre: autor.nombre || autor.usuario, rol: autor.rol } : { nombre: '', rol: '' }
                };
            };

            // NOTICIAS
            if (path === '/api/noticias/index.php' && method === 'GET') {
                const noticias = load(k.noticias, []);
                const visible = (Array.isArray(noticias) ? noticias : []).filter(n => {
                    const flag = (n.activa ?? n.activo);
                    const active = flag === true || flag === 1 || flag === '1';
                    if (!active) return false;
                    if (n.fecha_expiracion) {
                        try {
                            const exp = new Date(String(n.fecha_expiracion)).getTime();
                            if (Number.isFinite(exp) && exp < new Date(todayYmd()).getTime()) return false;
                        } catch (e) {}
                    }
                    return true;
                }).map(attachAutor);
                return jsonResponse(visible, 200);
            }

            if (path === '/api/noticias/mis.php' && method === 'GET') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);

                const noticias = load(k.noticias, []);
                const role = String(auth.user.rol || '').toLowerCase();
                const list = (Array.isArray(noticias) ? noticias : []).filter(n => {
                    if (role === 'director') return true;
                    return Number(n.autor_id) === Number(auth.user.id);
                }).map(attachAutor);
                return jsonResponse(list, 200);
            }

            if (path === '/api/noticias/create.php' && method === 'POST') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (!isWriterRole(auth.user.rol)) return jsonResponse({ error: 'No autorizado' }, 403);

                const body = await readJsonBody(input, init);
                if (!body || !body.titulo || !body.contenido) {
                    return jsonResponse({ success: false, error: 'Título y contenido son requeridos' }, 400);
                }

                const seq = load(k.seq, { noticias: 1, eventos: 1, media: 1 });
                const id = seq.noticias || 1;
                seq.noticias = id + 1;
                save(k.seq, seq);

                const fecha_expiracion = body.dias_visibilidad_enabled
                    ? (() => {
                        const days = Number(body.dias_visibilidad || 30);
                        const d = new Date();
                        d.setDate(d.getDate() + (Number.isFinite(days) ? days : 30));
                        const pad = (n) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    })()
                    : null;

                const item = {
                    id,
                    titulo: String(body.titulo).trim(),
                    contenido: String(body.contenido).trim(),
                    descripcion: String(body.contenido).trim(),
                    media_items: Array.isArray(body.media_items) ? body.media_items : [],
                    imagen_url: null,
                    video_url: null,
                    created_date: todayYmd(),
                    created_at: nowIso(),
                    fecha_publicacion: todayYmd(),
                    hora_publicacion: null,
                    fecha_expiracion,
                    activa: 1,
                    autor_id: auth.user.id,
                };

                const noticias = load(k.noticias, []);
                noticias.push(item);
                save(k.noticias, noticias);

                return jsonResponse({ success: true, data: attachAutor(item) }, 200);
            }

            if (path === '/api/noticias/update.php' && method === 'PUT') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (!isWriterRole(auth.user.rol)) return jsonResponse({ error: 'No autorizado' }, 403);

                const id = Number(url.searchParams.get('id') || 0);
                if (!id) return jsonResponse({ success: false, error: 'ID de noticia inválido' }, 400);

                const body = await readJsonBody(input, init);
                if (!body || !body.titulo || !body.contenido) {
                    return jsonResponse({ success: false, error: 'Título y contenido son requeridos' }, 400);
                }

                const noticias = load(k.noticias, []);
                const idx = (Array.isArray(noticias) ? noticias : []).findIndex(n => Number(n.id) === id);
                if (idx < 0) return jsonResponse({ success: false, error: 'Noticia no encontrada' }, 404);

                const existing = noticias[idx];
                if (String(auth.user.rol || '').toLowerCase() !== 'director' && Number(existing.autor_id) !== Number(auth.user.id)) {
                    return jsonResponse({ success: false, error: 'No autorizado' }, 403);
                }

                const fecha_expiracion = body.dias_visibilidad_enabled
                    ? (() => {
                        const days = Number(body.dias_visibilidad || 30);
                        const d = new Date();
                        d.setDate(d.getDate() + (Number.isFinite(days) ? days : 30));
                        const pad = (n) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    })()
                    : null;

                const updated = {
                    ...existing,
                    titulo: String(body.titulo).trim(),
                    contenido: String(body.contenido).trim(),
                    descripcion: String(body.contenido).trim(),
                    media_items: Array.isArray(body.media_items) ? body.media_items : [],
                    created_date: todayYmd(),
                    created_at: nowIso(),
                    fecha_publicacion: todayYmd(),
                    fecha_expiracion,
                };
                noticias[idx] = updated;
                save(k.noticias, noticias);

                return jsonResponse({ success: true, data: attachAutor(updated) }, 200);
            }

            if (path === '/api/noticias/delete.php' && method === 'DELETE') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (!isWriterRole(auth.user.rol)) return jsonResponse({ error: 'No autorizado' }, 403);

                const id = Number(url.searchParams.get('id') || 0);
                if (!id) return jsonResponse({ success: false, error: 'ID inválido' }, 400);

                const noticias = load(k.noticias, []);
                const existing = (Array.isArray(noticias) ? noticias : []).find(n => Number(n.id) === id);
                if (!existing) return jsonResponse({ success: false, error: 'Noticia no encontrada' }, 404);

                if (String(auth.user.rol || '').toLowerCase() !== 'director' && Number(existing.autor_id) !== Number(auth.user.id)) {
                    return jsonResponse({ success: false, error: 'No autorizado' }, 403);
                }

                const filtered = (Array.isArray(noticias) ? noticias : []).filter(n => Number(n.id) !== id);
                save(k.noticias, filtered);
                return jsonResponse({ success: true }, 200);
            }

            // EVENTOS
            if (path === '/api/eventos/index.php' && method === 'GET') {
                const eventos = load(k.eventos, []);
                const visible = (Array.isArray(eventos) ? eventos : []).filter(ev => {
                    const flag = (ev.activo ?? ev.activa);
                    const active = flag === true || flag === 1 || flag === '1';
                    if (!active) return false;
                    if (ev.fecha_expiracion) {
                        try {
                            const exp = new Date(String(ev.fecha_expiracion)).getTime();
                            if (Number.isFinite(exp) && exp < new Date(todayYmd()).getTime()) return false;
                        } catch (e) {}
                    }
                    return true;
                }).map(attachAutor);
                return jsonResponse(visible, 200);
            }

            if (path === '/api/eventos/mis.php' && method === 'GET') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);

                const eventos = load(k.eventos, []);
                const role = String(auth.user.rol || '').toLowerCase();
                const list = (Array.isArray(eventos) ? eventos : []).filter(ev => {
                    if (role === 'director') return true;
                    return Number(ev.autor_id) === Number(auth.user.id);
                }).map(attachAutor);
                return jsonResponse(list, 200);
            }

            if (path === '/api/eventos/create.php' && method === 'POST') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (!isWriterRole(auth.user.rol)) return jsonResponse({ error: 'No autorizado' }, 403);

                const body = await readJsonBody(input, init);
                if (!body || !body.titulo || !body.descripcion || !body.fecha_evento) {
                    return jsonResponse({ success: false, error: 'Título, descripción y fecha son requeridos' }, 400);
                }

                const seq = load(k.seq, { noticias: 1, eventos: 1, media: 1 });
                const id = seq.eventos || 1;
                seq.eventos = id + 1;
                save(k.seq, seq);

                const fecha_expiracion = body.dias_visibilidad_enabled
                    ? (() => {
                        const days = Number(body.dias_visibilidad || 30);
                        const d = new Date();
                        d.setDate(d.getDate() + (Number.isFinite(days) ? days : 30));
                        const pad = (n) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    })()
                    : null;

                const item = {
                    id,
                    titulo: String(body.titulo).trim(),
                    descripcion: String(body.descripcion).trim(),
                    fecha_evento: String(body.fecha_evento).trim(),
                    hora_evento: String(body.hora_evento || '').trim(),
                    lugar: String(body.lugar || '').trim(),
                    media_items: Array.isArray(body.media_items) ? body.media_items : [],
                    imagen_url: null,
                    video_url: null,
                    created_date: todayYmd(),
                    created_at: nowIso(),
                    fecha_expiracion,
                    activo: 1,
                    autor_id: auth.user.id,
                };

                const eventos = load(k.eventos, []);
                eventos.push(item);
                save(k.eventos, eventos);

                return jsonResponse({ success: true, data: attachAutor(item) }, 200);
            }

            if (path === '/api/eventos/update.php' && method === 'PUT') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (!isWriterRole(auth.user.rol)) return jsonResponse({ error: 'No autorizado' }, 403);

                const id = Number(url.searchParams.get('id') || 0);
                if (!id) return jsonResponse({ success: false, error: 'ID de evento inválido' }, 400);

                const body = await readJsonBody(input, init);
                if (!body || !body.titulo || !body.descripcion || !body.fecha_evento) {
                    return jsonResponse({ success: false, error: 'Título, descripción y fecha son requeridos' }, 400);
                }

                const eventos = load(k.eventos, []);
                const idx = (Array.isArray(eventos) ? eventos : []).findIndex(ev => Number(ev.id) === id);
                if (idx < 0) return jsonResponse({ success: false, error: 'Evento no encontrado' }, 404);

                const existing = eventos[idx];
                if (String(auth.user.rol || '').toLowerCase() !== 'director' && Number(existing.autor_id) !== Number(auth.user.id)) {
                    return jsonResponse({ success: false, error: 'No autorizado' }, 403);
                }

                const fecha_expiracion = body.dias_visibilidad_enabled
                    ? (() => {
                        const days = Number(body.dias_visibilidad || 30);
                        const d = new Date();
                        d.setDate(d.getDate() + (Number.isFinite(days) ? days : 30));
                        const pad = (n) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    })()
                    : null;

                const updated = {
                    ...existing,
                    titulo: String(body.titulo).trim(),
                    descripcion: String(body.descripcion).trim(),
                    fecha_evento: String(body.fecha_evento).trim(),
                    hora_evento: String(body.hora_evento || '').trim(),
                    lugar: String(body.lugar || '').trim(),
                    media_items: Array.isArray(body.media_items) ? body.media_items : [],
                    created_date: todayYmd(),
                    created_at: nowIso(),
                    fecha_expiracion,
                };

                eventos[idx] = updated;
                save(k.eventos, eventos);

                return jsonResponse({ success: true, data: attachAutor(updated) }, 200);
            }

            if (path === '/api/eventos/delete.php' && method === 'DELETE') {
                const auth = requireAuth(headers);
                if (!auth.ok) return jsonResponse(auth.json, auth.status);
                if (!isWriterRole(auth.user.rol)) return jsonResponse({ error: 'No autorizado' }, 403);

                const id = Number(url.searchParams.get('id') || 0);
                if (!id) return jsonResponse({ success: false, error: 'ID inválido' }, 400);

                const eventos = load(k.eventos, []);
                const existing = (Array.isArray(eventos) ? eventos : []).find(ev => Number(ev.id) === id);
                if (!existing) return jsonResponse({ success: false, error: 'Evento no encontrado' }, 404);

                if (String(auth.user.rol || '').toLowerCase() !== 'director' && Number(existing.autor_id) !== Number(auth.user.id)) {
                    return jsonResponse({ success: false, error: 'No autorizado' }, 403);
                }

                const filtered = (Array.isArray(eventos) ? eventos : []).filter(ev => Number(ev.id) !== id);
                save(k.eventos, filtered);
                return jsonResponse({ success: true }, 200);
            }

            // default: endpoint no implementado en demo
            return jsonResponse({ error: `Endpoint DEMO no implementado: ${path}` }, 404);
        } catch (e) {
            return new Response('', { status: 500 });
        }
    };

    window.DemoApi = {
        reset() {
            Object.values(k).forEach((key) => {
                try { localStorage.removeItem(key); } catch (e) {}
            });
            initSeed();
        }
    };
})();
