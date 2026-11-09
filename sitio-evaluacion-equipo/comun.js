// Funciones compartidas por index.html (autodiagnóstico) y panel.html.
window.Diag = (function () {
  'use strict';
  var cfg = window.DIAG_CONFIG || {};
  var DEMO = !cfg.API_URL;

  function api(action, data) {
    if (DEMO) return window.DemoAPI.llamar(action, data);
    var cuerpo = JSON.stringify(Object.assign({ action: action }, data || {}));
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita la verificación previa CORS
      body: cuerpo
    }).catch(function () {
      throw new Error('No hay conexión con el servidor. Revisa tu internet o la URL en config.js.');
    }).then(function (r) {
      return r.json().catch(function () {
        throw new Error('El servidor respondió algo inesperado. Revisa que la implementación tenga acceso "Cualquier persona".');
      });
    }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Error del servidor.');
      return j;
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  };
  var sesion = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  };

  var toastTimer;
  function toast(msg, error) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast' + (error ? ' error' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, error ? 6000 : 3000);
  }

  // Orden de bloques: primera aparición en preguntas abiertas y luego en reactivos.
  function ordenBloques(cat) {
    var orden = [];
    (cat.abiertas || []).concat(cat.competencias || []).forEach(function (x) {
      if (orden.indexOf(x.bloque) < 0) orden.push(x.bloque);
    });
    return orden;
  }

  // Escala segmentada con radios nativos. opciones: [{v, etiqueta, descripcion}]
  function escalaHTML(nombre, opciones, valor, extra) {
    extra = extra || {};
    var html = '<div class="seg' + (extra.compacta ? ' compacta' : '') + '" role="radiogroup" style="--n:' + (opciones.length + (extra.noObs ? 1 : 0)) + '">';
    opciones.forEach(function (o) {
      html += '<label title="' + esc(o.descripcion || o.etiqueta || '') + '"><input type="radio" name="' + esc(nombre) + '" value="' + esc(o.v) + '"' +
        (String(valor) === String(o.v) ? ' checked' : '') + '><span><b>' + esc(o.v) + '</b>' +
        (o.etiqueta && !extra.sinEtiqueta ? '<small>' + esc(o.etiqueta) + '</small>' : '') + '</span></label>';
    });
    if (extra.noObs) {
      html += '<label class="no-obs" title="No he tenido oportunidad de observarlo"><input type="radio" name="' + esc(nombre) + '" value="NO"' +
        (valor === 'NO' ? ' checked' : '') + '><span><b>N/O</b><small>No observado</small></span></label>';
    }
    html += '</div>';
    var a = opciones[0], z = opciones[opciones.length - 1];
    if (a && a.etiqueta && !extra.sinEtiqueta) {
      html += '<div class="extremos solo-movil"><span>' + esc(a.v + ' · ' + a.etiqueta) + '</span><span>' + esc(z.v + ' · ' + z.etiqueta) + '</span></div>';
    }
    return html;
  }

  function valorRadio(contenedor, nombre) {
    var el = contenedor.querySelector('input[name="' + cssEsc(nombre) + '"]:checked');
    return el ? el.value : '';
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }

  // Pregunta abierta / de opción (para autodiagnóstico y criterios de líder)
  function preguntaHTML(p, prefijo, valor, escalas) {
    var n = prefijo + p.id;
    var html = '';
    if (p.tipo === 'texto') {
      html = '<textarea name="' + n + '" rows="3">' + esc(valor || '') + '</textarea>';
    } else if (p.tipo === 'texto_corto') {
      html = '<input type="text" name="' + n + '" value="' + esc(valor || '') + '" maxlength="200">';
    } else if (p.tipo === 'opcion' || p.tipo === 'prioridad' || p.tipo === 'multiple') {
      var multiple = p.tipo === 'multiple';
      var sel = Array.isArray(valor) ? valor : String(valor || '').split(';').map(function (x) { return x.trim(); });
      var otraTexto = '';
      sel = sel.map(function (x) { var m = /^Otra:\s*(.*)$/i.exec(x); if (m) { otraTexto = m[1]; return 'Otra'; } return x; });
      var tieneOtra = p.opciones.indexOf('Otra') >= 0;
      html = '<div class="pills">' + p.opciones.map(function (o) {
        return '<label><input type="' + (multiple ? 'checkbox' : 'radio') + '" name="' + n + '" value="' + esc(o) + '"' + (sel.indexOf(o) >= 0 ? ' checked' : '') +
          (o === 'Otra' ? ' data-otra' : '') + '><span>' + esc(o) + '</span></label>';
      }).join('') + '</div>' +
        (tieneOtra ? '<input type="text" class="otra-txt" name="' + n + '__otra" maxlength="200" placeholder="Escribe cuál" aria-label="Otra, especifica" value="' + esc(otraTexto) + '"' + (sel.indexOf('Otra') >= 0 ? '' : ' hidden') + '>' : '') +
        (multiple ? '<p class="tenue" style="margin-top:4px">Puedes elegir varias.</p>' : '');
    } else if (p.tipo === 'escala10') {
      var ops = []; for (var i = 1; i <= 10; i++) ops.push({ v: i });
      html = escalaHTML(n, ops, valor, { compacta: true }) +
        (p.extremos.length ? '<div class="extremos"><span>1 · ' + esc(p.extremos[0]) + '</span><span>10 · ' + esc(p.extremos[1] || '') + '</span></div>' : '');
    } else if (p.tipo === 'escala5') {
      var e = (escalas && escalas['desempeño']) || [1, 2, 3, 4, 5].map(function (v) { return { v: v }; });
      html = escalaHTML(n, e, valor);
    }
    return '<div class="item" data-preg="' + esc(p.id) + '"><div class="preg">' + esc(p.pregunta) +
      (p.requerida ? '<span class="req" aria-hidden="true">*</span>' : '<span class="opc">opcional</span>') + '</div>' +
      (p.descripcion ? '<p class="desc">' + esc(p.descripcion) + '</p>' : '') + html + '</div>';
  }

  function leerPregunta(contenedor, p, prefijo) {
    var n = prefijo + p.id;
    if (p.tipo === 'texto' || p.tipo === 'texto_corto') {
      var el = contenedor.querySelector('[name="' + cssEsc(n) + '"]');
      return el ? el.value.trim() : '';
    }
    var otra = contenedor.querySelector('[name="' + cssEsc(n + '__otra') + '"]');
    var conOtra = function (x) { return x === 'Otra' && otra && otra.value.trim() ? 'Otra: ' + otra.value.trim() : x; };
    if (p.tipo === 'multiple') {
      return Array.prototype.map.call(contenedor.querySelectorAll('input[name="' + cssEsc(n) + '"]:checked'), function (x) { return conOtra(x.value); });
    }
    return conOtra(valorRadio(contenedor, n));
  }

  // Muestra el campo de texto cuando se elige "Otra".
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.name || (t.type !== 'radio' && t.type !== 'checkbox')) return;
    var caja = document.querySelector('[name="' + cssEsc(t.name + '__otra') + '"]');
    if (!caja) return;
    var marcada = document.querySelector('input[name="' + cssEsc(t.name) + '"][data-otra]:checked');
    caja.hidden = !marcada;
    if (marcada && t.hasAttribute('data-otra')) caja.focus();
  });

  function vacio(v) { return v === '' || v == null || (Array.isArray(v) && !v.length); }

  function fechaCorta(f) {
    if (!f) return '';
    var d = new Date(f);
    if (isNaN(d)) return String(f);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  return {
    DEMO: DEMO, api: api, esc: esc, store: store, sesion: sesion, toast: toast, ordenBloques: ordenBloques,
    escalaHTML: escalaHTML, valorRadio: valorRadio, preguntaHTML: preguntaHTML, leerPregunta: leerPregunta,
    vacio: vacio, fechaCorta: fechaCorta, cssEsc: cssEsc
  };
})();
