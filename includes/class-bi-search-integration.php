<?php
/**
 * Conexión con el buscador del sitio.
 *
 * Funciona con cualquier formulario de búsqueda de WordPress (el del tema, el widget de búsqueda
 * de Elementor, el de WooCommerce), porque todos envían el parámetro "s":
 *  - redirect: la búsqueda se envía a la página del chat del mismo idioma, con la consulta.
 *  - choice:   al enviar el formulario aparece una pequeña elección: asistente o resultados normales.
 *
 * Solo actúa para quien puede usar el buscador según el modo de visibilidad.
 *
 * @package BuscadorInteligente
 */

defined( 'ABSPATH' ) || exit;

class BI_Search_Integration {

	/** @var BI_Plugin */
	private $plugin;

	public function __construct( BI_Plugin $plugin ) {
		$this->plugin = $plugin;
		add_action( 'template_redirect', array( $this, 'maybe_redirect' ), 5 );
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue_choice' ) );
	}

	/**
	 * Modo automático: la página de resultados de búsqueda pasa a ser el chat.
	 */
	public function maybe_redirect() {
		if ( 'redirect' !== BI_Settings::search_mode() || ! is_search() || is_admin() || ! BI_Settings::current_user_can_use() ) {
			return;
		}
		// "?bi_skip=1" deja ver los resultados normales (lo usa el modo "elegir").
		if ( isset( $_GET['bi_skip'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$url = $this->chat_url();
		if ( '' === $url ) {
			return;
		}
		wp_safe_redirect( add_query_arg( 'q', rawurlencode( get_search_query( false ) ), $url ) );
		exit;
	}

	/**
	 * Modo "que el cliente elija": script que intercepta los formularios de búsqueda.
	 */
	public function maybe_enqueue_choice() {
		if ( 'choice' !== BI_Settings::search_mode() || ! BI_Settings::current_user_can_use() ) {
			return;
		}
		$url = $this->chat_url();
		if ( '' === $url ) {
			return;
		}
		$context = BI_Context::resolve( '', $this->plugin->languages );
		$ui      = BI_Lexicon::get( $context->language )->get_list( 'ui' );

		wp_enqueue_style( 'bi-chat', BI_URL . 'assets/chat/chat.css', array(), BI_VERSION );
		wp_enqueue_script( 'bi-search-choice', BI_URL . 'assets/chat/search-choice.js', array(), BI_VERSION, true );
		wp_localize_script(
			'bi-search-choice',
			'biSearchChoice',
			array(
				'chatUrl' => $url,
				'vars'    => BI_Appearance::css_variables(),
				'ui'      => array(
					'title'     => $ui['choice_title'],
					'assistant' => $ui['choice_assistant'],
					'search'    => $ui['choice_search'],
				),
			)
		);
	}

	/**
	 * Página del chat del idioma actual.
	 *
	 * @return string
	 */
	private function chat_url() {
		$context = BI_Context::resolve( '', $this->plugin->languages );
		return BI_Chat_Page::url_for_language( $context->lang );
	}
}
