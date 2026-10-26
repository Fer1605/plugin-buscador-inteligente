<?php
/**
 * Ubicación marcada en la página del mapa.
 *
 * Las ubicaciones (sucursales, tiendas) casi nunca tienen una página propia con diseño: viven en una
 * página con el mapa y la lista de todas. El chat enlaza a esa página con ?bi_place={id} y aquí se carga
 * un script pequeño que busca esa ubicación en la lista, la resalta, la lleva a la vista y la activa
 * (el mapa se centra y abre su globo). No depende del plugin de mapas: busca por el ID y por el nombre.
 *
 * @package BuscadorInteligente
 */

defined( 'ABSPATH' ) || exit;

class BI_Place_Focus {

	const PARAM = 'bi_place';

	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Carga el script solo si la URL trae una ubicación válida.
	 */
	public function enqueue() {
		if ( empty( $_GET[ self::PARAM ] ) || 'off' === BI_Settings::mode() ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$post = get_post( absint( $_GET[ self::PARAM ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $post || 'publish' !== $post->post_status || ! in_array( $post->post_type, BI_REST_Controller::location_types(), true ) ) {
			return;
		}
		$palette = BI_Appearance::palette();

		wp_enqueue_script( 'bi-place-focus', BI_URL . 'assets/chat/place-focus.js', array(), BI_VERSION, true );
		wp_localize_script(
			'bi-place-focus',
			'biPlaceFocus',
			array(
				'id'    => (int) $post->ID,
				'title' => wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES ),
				'color' => $palette['primary']['value'],
			)
		);
	}
}
