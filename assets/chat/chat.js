/**
 * Chat del Buscador inteligente.
 *
 * - Conversa con POST /wp-json/bi/v1/chat enviando el estado de la conversación.
 * - Guarda el historial en localStorage por idioma/país (24 h), así al volver sigue donde quedó.
 * - Sin dependencias: JavaScript plano.
 */
( function () {
	const config = window.biChatConfig;
	const root = document.getElementById( 'bi-chat' );
	if ( ! config || ! root ) {
		return;
	}

	const ui = config.ui || {};
	const HISTORY_TTL = 24 * 60 * 60 * 1000;
	const MAX_ITEMS = 60;
	let state = {};
	let items = []; // Historial: { who: 'user'|'bot', data }.
	let busy = false;

	// ---------- Utilidades ----------

	function el( tag, className, text ) {
		const node = document.createElement( tag );
		if ( className ) {
			node.className = className;
		}
		if ( text ) {
			node.textContent = text;
		}
		return node;
	}

	function safeUrl( url ) {
		return /^https?:\/\//i.test( url || '' ) ? url : '#';
	}

	function load() {
		try {
			const saved = JSON.parse( window.localStorage.getItem( config.storageKey ) || 'null' );
			if ( saved && Date.now() - saved.savedAt < HISTORY_TTL ) {
				state = saved.state || {};
				items = saved.items || [];
			}
		} catch ( e ) {
			// Sin almacenamiento disponible: la conversación no se recuerda, pero funciona.
		}
	}

	function save() {
		try {
			window.localStorage.setItem( config.storageKey, JSON.stringify( { state: state, items: items.slice( -MAX_ITEMS ), savedAt: Date.now() } ) );
		} catch ( e ) {}
	}

	// ---------- Estructura ----------

	const header = el( 'div', 'bi-chat__header' );
	const identity = el( 'div', 'bi-chat__identity' );
	if ( config.assistant.avatar ) {
		const avatar = el( 'img', 'bi-chat__avatar' );
		avatar.src = config.assistant.avatar;
		avatar.alt = '';
		identity.appendChild( avatar );
	}
	if ( config.assistant.name ) {
		identity.appendChild( el( 'span', 'bi-chat__name', config.assistant.name ) );
	}
	const reset = el( 'button', 'bi-chat__reset' );
	reset.type = 'button';
	reset.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>';
	reset.appendChild( document.createTextNode( ui.new ) );
	header.append( identity, reset );

	const log = el( 'div', 'bi-chat__log' );
	log.setAttribute( 'role', 'log' );
	log.setAttribute( 'aria-live', 'polite' );

	const form = el( 'form', 'bi-chat__form' );
	const input = el( 'input', 'bi-chat__input' );
	input.type = 'text';
	input.maxLength = 300;
	input.placeholder = ui.placeholder;
	input.setAttribute( 'aria-label', ui.placeholder );
	input.autocomplete = 'off';
	const send = el( 'button', 'bi-chat__send' );
	send.type = 'submit';
	send.setAttribute( 'aria-label', ui.send );
	send.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';
	form.append( input, send );

	root.textContent = '';
	root.append( header, log, form );
	if ( ! config.assistant.name && ! config.assistant.avatar ) {
		root.classList.add( 'bi-chat--anonymous' );
	}

	// ---------- Mensajes ----------

	function bubble( who, text ) {
		const row = el( 'div', 'bi-msg bi-msg--' + who );
		row.dataset.who = who;
		if ( 'bot' === who && config.assistant.avatar ) {
			const avatar = el( 'img', 'bi-msg__avatar' );
			avatar.src = config.assistant.avatar;
			avatar.alt = '';
			row.appendChild( avatar );
		}
		row.appendChild( el( 'div', 'bi-msg__bubble', text ) );
		log.appendChild( row );
		return row;
	}

	function card( data ) {
		const link = el( 'a', 'bi-card' );
		link.href = safeUrl( data.url );
		if ( data.id ) {
			link.dataset.biId = data.id;
		}

		const media = el( 'div', 'bi-card__media' );
		if ( data.image ) {
			const img = el( 'img' );
			img.src = data.image;
			img.alt = data.title || '';
			img.loading = 'lazy';
			media.appendChild( img );
		} else {
			media.classList.add( 'bi-card__media--empty' );
		}
		( data.flags || [] ).slice( 0, 2 ).forEach( function ( flag ) {
			media.appendChild( el( 'span', 'bi-card__flag', flag ) );
		} );
		link.appendChild( media );

		const body = el( 'div', 'bi-card__body' );
		const meta = [ data.category, data.brand ].filter( Boolean ).join( ' · ' );
		if ( meta ) {
			body.appendChild( el( 'span', 'bi-card__meta', meta ) );
		}
		body.appendChild( el( 'strong', 'bi-card__title', data.title ) );
		if ( data.code ) {
			body.appendChild( el( 'span', 'bi-card__code', ( ui.code || '' ) + ': ' + data.code ) );
		}
		( data.specs || [] ).slice( 0, 2 ).forEach( function ( spec ) {
			body.appendChild( el( 'span', 'bi-card__spec', spec.label + ': ' + spec.value ) );
		} );
		if ( data.price ) {
			body.appendChild( el( 'span', 'bi-card__price', data.price ) );
		}
		link.appendChild( body );
		return link;
	}


	function places( list ) {
		if ( ! list || ! list.length ) {
			return;
		}
		const grid = el( 'div', 'bi-places' );
		list.forEach( function ( item ) {
			const a = el( 'a', 'bi-place' );
			a.href = safeUrl( item.url );
			const icon = el( 'span', 'bi-place__icon' );
			icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
			a.appendChild( icon );
			a.appendChild( el( 'strong', 'bi-place__title', item.title ) );
			if ( item.summary ) {
				a.appendChild( el( 'span', 'bi-place__summary', item.summary ) );
			}
			a.appendChild( el( 'span', 'bi-place__cta', ( ui.view_place || 'Ver' ) + ' →' ) );
			grid.appendChild( a );
		} );
		log.appendChild( grid );
	}

	// La frase exacta del sitio que responde (horario, teléfono, dato de la ficha).
	function quote( lines ) {
		if ( ! lines || ! lines.length ) {
			return;
		}
		const block = el( 'blockquote', 'bi-quote' );
		lines.forEach( function ( line ) {
			block.appendChild( el( 'p', 'bi-quote__line', line ) );
		} );
		log.appendChild( block );
	}

	// Dos productos lado a lado.
	function compare( data ) {
		if ( ! data || ! data.rows || ! data.rows.length ) {
			return;
		}
		const wrap = el( 'div', 'bi-compare' );
		const table = el( 'table', 'bi-compare__table' );
		const head = el( 'tr' );
		head.appendChild( el( 'th', 'bi-compare__corner' ) );
		data.columns.forEach( function ( title, index ) {
			const th = el( 'th' );
			const a = el( 'a', '', title );
			a.href = safeUrl( data.urls[ index ] );
			th.appendChild( a );
			head.appendChild( th );
		} );
		const thead = el( 'thead' );
		thead.appendChild( head );
		table.appendChild( thead );
		const body = el( 'tbody' );
		data.rows.forEach( function ( row ) {
			const tr = el( 'tr' );
			tr.appendChild( el( 'th', '', row[ 0 ] ) );
			tr.appendChild( el( 'td', '', row[ 1 ] ) );
			tr.appendChild( el( 'td', '', row[ 2 ] ) );
			body.appendChild( tr );
		} );
		table.appendChild( body );
		wrap.appendChild( table );
		log.appendChild( wrap );
	}

	function tagQuery( node, data ) {
		if ( data.clickq ) {
			node.dataset.biQ = data.clickq;
		}
	}

	function renderBot( data ) {
		if ( data.text ) {
			bubble( 'bot', data.text );
		}
		quote( data.quote );
		places( data.places );
		compare( data.compare );
		if ( data.cards && data.cards.length ) {
			const grid = el( 'div', 'bi-cards' );
			data.cards.forEach( function ( item ) {
				grid.appendChild( card( item ) );
			} );
			tagQuery( grid, data );
			log.appendChild( grid );
		}
		if ( data.extra && data.extra.cards && data.extra.cards.length ) {
			if ( data.extra.text ) {
				bubble( 'bot', data.extra.text );
			}
			const similar = el( 'div', 'bi-cards bi-cards--similar' );
			data.extra.cards.forEach( function ( item ) {
				similar.appendChild( card( item ) );
			} );
			tagQuery( similar, data );
			log.appendChild( similar );
		}
		if ( data.followup ) {
			bubble( 'bot', data.followup );
		}
		if ( data.links && data.links.length ) {
			const list = el( 'div', 'bi-links' );
			data.links.forEach( function ( item ) {
				const a = el( 'a', 'bi-link' );
				a.href = safeUrl( item.url );
				if ( item.id ) {
					a.dataset.biId = item.id;
				}
				a.appendChild( el( 'span', 'bi-link__title', item.title ) );
				if ( item.summary ) {
					a.appendChild( el( 'span', 'bi-link__summary', item.summary ) );
				}
				list.appendChild( a );
			} );
			tagQuery( list, data );
			log.appendChild( list );
		}
	}

	function renderChips( data ) {
		const old = log.querySelector( '.bi-chips' );
		if ( old ) {
			old.remove();
		}
		const chips = ( data.suggestions || [] ).slice( 0, 5 );
		if ( data.more && data.more_label ) {
			chips.unshift( data.more_label );
		}
		if ( ! chips.length ) {
			return;
		}
		const bar = el( 'div', 'bi-chips' );
		chips.forEach( function ( text, index ) {
			const chip = el( 'button', 'bi-chip' + ( 0 === index && data.more ? ' bi-chip--primary' : '' ), text );
			chip.type = 'button';
			chip.addEventListener( 'click', function () {
				ask( text );
			} );
			bar.appendChild( chip );
		} );
		log.appendChild( bar );
	}

	function renderAll() {
		log.style.scrollBehavior = 'auto';
		log.textContent = '';
		let last = null;
		items.forEach( function ( item ) {
			if ( 'user' === item.who ) {
				bubble( 'user', item.text );
			} else {
				renderBot( item.data );
				last = item.data;
			}
		} );
		if ( last ) {
			renderChips( last );
		}
		scrollDown();
		log.style.scrollBehavior = '';
	}

	function typing( show ) {
		const old = log.querySelector( '.bi-typing' );
		if ( old ) {
			old.remove();
		}
		if ( show ) {
			const row = el( 'div', 'bi-msg bi-msg--bot bi-typing' );
			const dots = el( 'div', 'bi-msg__bubble' );
			dots.setAttribute( 'aria-label', ui.typing );
			dots.innerHTML = '<span></span><span></span><span></span>';
			row.appendChild( dots );
			log.appendChild( row );
			scrollDown();
		}
	}

	function scrollDown() {
		log.scrollTop = log.scrollHeight;
	}

	// Con una respuesta larga (tarjetas), se muestra desde la pregunta: se lee de arriba hacia abajo.
	function scrollToQuestion( row ) {
		const target = row.offsetTop - 12; // El registro es position: relative.
		log.scrollTop = Math.min( target, log.scrollHeight );
	}

	// ---------- Conversación ----------

	function ask( message ) {
		message = ( message || '' ).trim();
		if ( ! message || busy ) {
			return;
		}
		busy = true;
		root.classList.add( 'is-busy' );
		const chips = log.querySelector( '.bi-chips' );
		if ( chips ) {
			chips.remove();
		}
		items.push( { who: 'user', text: message } );
		const question = bubble( 'user', message );
		typing( true );

		const headers = { 'Content-Type': 'application/json' };
		if ( config.nonce ) {
			headers[ 'X-WP-Nonce' ] = config.nonce;
		}
		fetch( config.endpoint, {
			method: 'POST',
			credentials: 'same-origin',
			headers: headers,
			body: JSON.stringify( { message: message, lang: config.lang, state: state } ),
		} )
			.then( function ( response ) {
				return response.json().then( function ( data ) {
					return { status: response.status, data: data };
				} );
			} )
			.then( function ( result ) {
				typing( false );
				if ( 200 !== result.status ) {
					bubble( 'bot', 429 === result.status ? ui.rate_limited : ui.error );
					return;
				}
				state = result.data.state || {};
				delete result.data.state;
				// Búsqueda que produjo estos resultados: si abre uno, el asistente aprende.
				result.data.clickq = state.q || message;
				items.push( { who: 'bot', data: result.data } );
				renderBot( result.data );
				renderChips( result.data );
				save();
			} )
			.catch( function () {
				typing( false );
				bubble( 'bot', ui.error );
			} )
			.finally( function () {
				busy = false;
				root.classList.remove( 'is-busy' );
				scrollToQuestion( question );
			} );
	}

	// Aprendizaje por clics: qué resultado abrió después de qué búsqueda (sin datos personales).
	log.addEventListener( 'click', function ( event ) {
		const link = event.target.closest( 'a[data-bi-id]' );
		const group = link ? link.closest( '[data-bi-q]' ) : null;
		if ( ! link || ! group || ! config.clickEndpoint ) {
			return;
		}
		try {
			fetch( config.clickEndpoint, {
				method: 'POST',
				credentials: 'same-origin',
				keepalive: true,
				headers: config.nonce ? { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce } : { 'Content-Type': 'application/json' },
				body: JSON.stringify( { q: group.dataset.biQ, id: Number( link.dataset.biId ), lang: config.lang } ),
			} ).catch( function () {} );
		} catch ( e ) {}
	} );

	form.addEventListener( 'submit', function ( event ) {
		event.preventDefault();
		const message = input.value;
		input.value = '';
		ask( message );
	} );

	reset.addEventListener( 'click', function () {
		state = {};
		items = [ { who: 'bot', data: config.initial } ];
		save();
		renderAll();
		input.focus();
	} );

	// ---------- Inicio ----------

	load();
	if ( ! items.length ) {
		items = [ { who: 'bot', data: config.initial } ];
	}
	renderAll();

	// Llegó desde el buscador del sitio: se pregunta directamente y se limpia la URL.
	if ( config.query ) {
		ask( config.query );
		try {
			const url = new URL( window.location.href );
			url.searchParams.delete( 'q' );
			window.history.replaceState( null, '', url.toString() );
		} catch ( e ) {}
	}
} )();
