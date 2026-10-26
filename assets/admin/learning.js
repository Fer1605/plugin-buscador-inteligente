/**
 * Pestaña Aprendizaje: elegir qué contenido responde una pregunta.
 * Busca en el índice por nombre (endpoint de administrador) y guarda hasta 3 elegidos.
 */
( function () {
	const config = window.biLearning;
	if ( ! config ) {
		return;
	}

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

	document.querySelectorAll( '.bi-teach__search' ).forEach( function ( input ) {
		const form = input.closest( 'form' );
		const results = form.querySelector( '.bi-teach__results' );
		const chosen = form.querySelector( '.bi-teach__chosen' );
		const ids = form.querySelector( '.bi-teach__ids' );
		const save = form.querySelector( '.bi-teach__save' );
		const picked = new Map();
		let timer = 0;

		function sync() {
			ids.value = Array.from( picked.keys() ).join( ',' );
			save.disabled = 0 === picked.size;
			chosen.textContent = '';
			picked.forEach( function ( item, id ) {
				const li = el( 'li', 'bi-teach__item bi-teach__item--chosen' );
				li.appendChild( el( 'span', '', item.title ) );
				li.appendChild( el( 'span', 'bi-tag bi-tag--soft', item.type ) );
				const remove = el( 'button', 'button-link bi-link-danger', 'Quitar' );
				remove.type = 'button';
				remove.addEventListener( 'click', function () {
					picked.delete( id );
					sync();
				} );
				li.appendChild( remove );
				chosen.appendChild( li );
			} );
		}

		function search() {
			const text = input.value.trim();
			results.textContent = '';
			if ( text.length < 2 ) {
				return;
			}
			const url = config.endpoint + '?lang=' + encodeURIComponent( input.dataset.lang ) + '&q=' + encodeURIComponent( text );
			fetch( url, { credentials: 'same-origin', headers: { 'X-WP-Nonce': config.nonce } } )
				.then( function ( response ) {
					return response.json();
				} )
				.then( function ( list ) {
					results.textContent = '';
					if ( ! Array.isArray( list ) || ! list.length ) {
						results.appendChild( el( 'li', 'bi-teach__none', 'No encontré contenido con ese nombre.' ) );
						return;
					}
					list.forEach( function ( item ) {
						const li = el( 'li', 'bi-teach__item' );
						const pick = el( 'button', 'button-link', item.title );
						pick.type = 'button';
						pick.addEventListener( 'click', function () {
							if ( picked.size < 3 ) {
								picked.set( item.id, item );
								sync();
							}
							results.textContent = '';
							input.value = '';
						} );
						li.appendChild( pick );
						li.appendChild( el( 'span', 'bi-tag bi-tag--soft', item.type ) );
						results.appendChild( li );
					} );
				} )
				.catch( function () {
					results.textContent = '';
				} );
		}

		input.addEventListener( 'input', function () {
			window.clearTimeout( timer );
			timer = window.setTimeout( search, 300 );
		} );
		input.addEventListener( 'keydown', function ( event ) {
			if ( 'Enter' === event.key ) {
				event.preventDefault();
			}
		} );
	} );
} )();
