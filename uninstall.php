<?php
/**
 * Desinstalación: borra la tabla del índice y las opciones del plugin.
 * No toca ningún contenido del sitio.
 *
 * @package BuscadorInteligente
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}bi_index" );
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}bi_clicks" );

foreach ( array( 'bi_settings', 'bi_schema', 'bi_languages', 'bi_reindex_state', 'bi_db_version', 'bi_fulltext', 'bi_misses', 'bi_pages_created', 'bi_questions', 'bi_learned', 'bi_clicks_db_version', 'bi_doc_version' ) as $option ) {
	delete_option( $option );
}

// Vocabularios en caché.
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_bi\\_vocab\\_%' OR option_name LIKE '\\_transient\\_timeout\\_bi\\_vocab\\_%'" );

wp_clear_scheduled_hook( 'bi_discover' );
wp_clear_scheduled_hook( 'bi_reindex_batch' );
