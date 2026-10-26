<?php
/**
 * Plugin Name:       Buscador Inteligente
 * Description:       Buscador conversacional para cualquier sitio WordPress. Descubre solo el contenido, los campos, los idiomas y los países (Polylang, WPML, ACF, WooCommerce, Elementor) y responde en lenguaje natural sin servicios externos.
 * Version:           2.0.0-dev
 * Requires at least: 5.9
 * Requires PHP:      7.4
 * Author:            Fer Santizo
 * Author URI:        https://github.com/Fer1605
 * Plugin URI:        https://github.com/Fer1605/plugin-buscador-inteligente
 * License:           GPL-2.0-or-later
 * Text Domain:       buscador-inteligente
 *
 * @package BuscadorInteligente
 */

defined( 'ABSPATH' ) || exit;

define( 'BI_VERSION', '2.0.0-dev.19' );
define( 'BI_FILE', __FILE__ );
define( 'BI_DIR', plugin_dir_path( __FILE__ ) );
define( 'BI_URL', plugin_dir_url( __FILE__ ) );

require_once BI_DIR . 'includes/class-bi-settings.php';
require_once BI_DIR . 'includes/text/class-bi-normalizer.php';
require_once BI_DIR . 'includes/i18n/class-bi-country-resolver.php';
require_once BI_DIR . 'includes/i18n/class-bi-language-adapter.php';
require_once BI_DIR . 'includes/i18n/class-bi-context.php';
require_once BI_DIR . 'includes/discovery/class-bi-field-classifier.php';
require_once BI_DIR . 'includes/discovery/class-bi-schema-discovery.php';
require_once BI_DIR . 'includes/index/class-bi-index-table.php';
require_once BI_DIR . 'includes/index/class-bi-elementor-text.php';
require_once BI_DIR . 'includes/index/class-bi-document-builder.php';
require_once BI_DIR . 'includes/index/class-bi-indexer.php';
require_once BI_DIR . 'includes/discovery/class-bi-json-paths.php';
require_once BI_DIR . 'includes/engine/class-bi-lexicon.php';
require_once BI_DIR . 'includes/engine/class-bi-query-analyzer.php';
require_once BI_DIR . 'includes/engine/class-bi-search.php';
require_once BI_DIR . 'includes/engine/class-bi-vocabulary.php';
require_once BI_DIR . 'includes/index/class-bi-index-repository.php';
require_once BI_DIR . 'includes/dialogue/class-bi-intent-classifier.php';
require_once BI_DIR . 'includes/engine/class-bi-extractor.php';
require_once BI_DIR . 'includes/dialogue/class-bi-tone.php';
require_once BI_DIR . 'includes/dialogue/class-bi-responder.php';
require_once BI_DIR . 'includes/dialogue/trait-bi-dialogue-products.php';
require_once BI_DIR . 'includes/dialogue/class-bi-dialogue.php';
require_once BI_DIR . 'includes/class-bi-appearance.php';
require_once BI_DIR . 'includes/class-bi-chat-page.php';
require_once BI_DIR . 'includes/class-bi-search-integration.php';
require_once BI_DIR . 'includes/class-bi-place-focus.php';
require_once BI_DIR . 'includes/class-bi-learning.php';
require_once BI_DIR . 'includes/api/class-bi-rest-controller.php';

/**
 * Contenedor del plugin: crea las piezas una sola vez y las conecta.
 */
final class BI_Plugin {

	/** @var BI_Plugin|null */
	private static $instance = null;

	/** @var BI_Language_Registry */
	public $languages;

	/** @var BI_Schema_Discovery */
	public $discovery;

	/** @var BI_Indexer */
	public $indexer;

	/** @var BI_Chat_Page */
	public $chat_page;

	/**
	 * @return BI_Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		// Después de que Polylang/WPML/ACF/WooCommerce cargaron.
		add_action( 'plugins_loaded', array( $this, 'boot' ), 20 );
	}

	/**
	 * Arranca las piezas.
	 */
	public function boot() {
		BI_Index_Table::maybe_install();

		$adapter         = BI_Language_Adapter::detect();
		$this->languages = new BI_Language_Registry( $adapter );
		$this->discovery = new BI_Schema_Discovery( $adapter );
		$this->indexer   = new BI_Indexer( $this->discovery, new BI_Document_Builder( $this->languages ) );
		BI_Learning::maybe_install();
		$this->maybe_reindex_after_update();

		$this->chat_page = new BI_Chat_Page( $this );
		new BI_REST_Controller( $this );
		new BI_Search_Integration( $this );
		new BI_Place_Focus();

		if ( is_admin() ) {
			require_once BI_DIR . 'includes/admin/class-bi-admin.php';
			new BI_Admin( $this );
		}
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			require_once BI_DIR . 'includes/class-bi-cli.php';
			WP_CLI::add_command( 'bi', new BI_CLI( $this ) );
		}
	}

	/**
	 * Si cambió la forma de indexar (una versión nueva guarda más datos), se reindexa en segundo
	 * plano, por lotes, sin detener el sitio. Cuesta una opción ya cargada en memoria.
	 */
	private function maybe_reindex_after_update() {
		if ( (int) get_option( 'bi_doc_version' ) === BI_Document_Builder::DOC_VERSION ) {
			return;
		}
		update_option( 'bi_doc_version', BI_Document_Builder::DOC_VERSION, true );
		if ( BI_Schema_Discovery::get_schema() ) {
			$this->indexer->start_full_reindex();
		}
	}

	/**
	 * Activación: crea la tabla y deja el descubrimiento programado en segundo plano.
	 * No recorre el sitio aquí para que activar sea instantáneo incluso en servidores lentos.
	 */
	public static function activate() {
		BI_Index_Table::install();
		BI_Learning::maybe_install();
		BI_Settings::install_defaults();
		BI_Indexer::schedule_discovery();
	}

	/**
	 * Desactivación: detiene las tareas programadas. Los datos se conservan.
	 */
	public static function deactivate() {
		wp_clear_scheduled_hook( BI_Indexer::CRON_DISCOVER );
		wp_clear_scheduled_hook( BI_Indexer::CRON_BATCH );
	}
}

register_activation_hook( __FILE__, array( 'BI_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'BI_Plugin', 'deactivate' ) );

BI_Plugin::instance();
