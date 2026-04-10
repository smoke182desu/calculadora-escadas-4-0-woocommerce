<?php
/**
 * Plugin Name: CDS Lead Capture - Calculadora de Escadas
 * Plugin URI: https://cdsind.com.br
 * Description: Recebe leads do calculador de escadas, salva no banco e envia email com detalhes do projeto.
 * Version: 1.0.0
 * Author: CDS Industrial
 * Text Domain: cds-lead-capture
 */

if (!defined('ABSPATH')) exit;

// ============================================================
// 1. CRIAÇÃO DA TABELA NO BANCO AO ATIVAR O PLUGIN
// ============================================================
register_activation_hook(__FILE__, 'cds_lead_create_table');

function cds_lead_create_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'cds_leads';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        nome varchar(255) NOT NULL,
        email varchar(255) NOT NULL,
        telefone varchar(50) NOT NULL,
        tipo varchar(50) NOT NULL,
        config longtext,
        dims longtext,
        valor decimal(12,2) DEFAULT 0,
        ip varchar(100),
        user_agent text,
        criado_em datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);

    // Salvar email padrão para notificações
    if (!get_option('cds_lead_email')) {
        update_option('cds_lead_email', get_option('admin_email'));
    }
}

// ============================================================
// 2. REGISTRAR ENDPOINT DA API REST
// ============================================================
add_action('rest_api_init', function () {
    register_rest_route('cds/v1', '/lead', array(
        'methods'  => 'POST',
        'callback' => 'cds_lead_receive',
        'permission_callback' => '__return_true', // Público (o calculador chama sem autenticação)
    ));
});

function cds_lead_receive(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'cds_leads';

    // Pegar dados do body
    $nome     = sanitize_text_field($request->get_param('nome') ?? '');
    $email    = sanitize_email($request->get_param('email') ?? '');
    $telefone = sanitize_text_field($request->get_param('telefone') ?? '');
    $tipo     = sanitize_text_field($request->get_param('tipo') ?? '');
    $config   = $request->get_param('config') ?? '';
    $dims     = $request->get_param('dims') ?? '';
    $valor    = floatval($request->get_param('valor') ?? 0);

    // Validação mínima
    if (empty($nome) || empty($email) || empty($telefone)) {
        return new WP_REST_Response(array(
            'success' => false,
            'message' => 'Nome, email e telefone são obrigatórios.'
        ), 400);
    }

    // Salvar no banco
    $inserted = $wpdb->insert($table_name, array(
        'nome'       => $nome,
        'email'      => $email,
        'telefone'   => $telefone,
        'tipo'       => $tipo,
        'config'     => is_string($config) ? $config : json_encode($config),
        'dims'       => is_string($dims) ? $dims : json_encode($dims),
        'valor'      => $valor,
        'ip'         => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'criado_em'  => current_time('mysql'),
    ));

    if (!$inserted) {
        return new WP_REST_Response(array(
            'success' => false,
            'message' => 'Erro ao salvar lead.'
        ), 500);
    }

    // Enviar email
    $lead_id = $wpdb->insert_id;
    cds_lead_send_email($lead_id, $nome, $email, $telefone, $tipo, $config, $dims, $valor);

    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'Lead recebido com sucesso!',
        'id'      => $lead_id,
    ), 200);
}

// ============================================================
// 3. ENVIAR EMAIL COM DETALHES DO PROJETO
// ============================================================
function cds_lead_send_email($id, $nome, $email, $telefone, $tipo, $config_json, $dims_json, $valor) {
    $to = get_option('cds_lead_email', get_option('admin_email'));

    // Decodificar JSON
    $config = is_string($config_json) ? json_decode($config_json, true) : $config_json;
    $dims   = is_string($dims_json) ? json_decode($dims_json, true) : $dims_json;

    // Nomes dos tipos
    $tipo_labels = array(
        'straight' => 'Escada Reta',
        'landing'  => 'Escada com Patamar',
        'lshape'   => 'Escada em L',
        'spiral'   => 'Escada Caracol',
    );
    $tipo_nome = $tipo_labels[$tipo] ?? ucfirst($tipo);

    // Formatar valor
    $valor_fmt = 'R$ ' . number_format($valor, 2, ',', '.');

    // Montar especificações técnicas
    $specs = array();
    if (!empty($dims['H']))  $specs[] = "Altura total: {$dims['H']} mm";
    if (!empty($dims['D']))  $specs[] = "Diâmetro: {$dims['D']} mm";
    if (!empty($dims['L']))  $specs[] = "Comprimento: {$dims['L']} mm";
    if (!empty($dims['L1'])) $specs[] = "Lance 1: {$dims['L1']} mm";
    if (!empty($dims['L2'])) $specs[] = "Lance 2: {$dims['L2']} mm";
    if (!empty($dims['W']))  $specs[] = "Largura: {$dims['W']} mm";
    if (!empty($dims['tubeD'])) $specs[] = "Tubo central: {$dims['tubeD']}\"";

    if (!empty($config['steps'])) $specs[] = "Nº de degraus: {$config['steps']}";
    if (!empty($config['h']))     $specs[] = "Altura do espelho: " . round($config['h']) . " mm";
    if (!empty($config['p']))     $specs[] = "Profundidade pisada: " . round($config['p']) . " mm";
    if (!empty($config['treads'])) $specs[] = "Nº de pisadas: {$config['treads']}";

    if (!empty($config['comfort']['label'])) {
        $specs[] = "Conforto: {$config['comfort']['label']}";
    }
    if (!empty($config['blondel'])) {
        $specs[] = "Blondel (2h+p): " . round($config['blondel']) . " mm";
    }

    $specs_html = implode('<br>', array_map(function($s) {
        $parts = explode(': ', $s, 2);
        return "<strong>{$parts[0]}:</strong> {$parts[1]}";
    }, $specs));

    $data_hora = wp_date('d/m/Y \à\s H:i');

    // Assunto
    $subject = "🔔 Novo Projeto de Escada - {$tipo_nome} - {$nome}";

    // Corpo do email em HTML
    $body = "
    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
        
        <div style='background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 16px 16px 0 0;'>
            <h1 style='color: #ffffff; margin: 0; font-size: 24px;'>🏗️ Novo Projeto de Escada</h1>
            <p style='color: #93c5fd; margin: 8px 0 0 0; font-size: 14px;'>Recebido em {$data_hora}</p>
        </div>

        <div style='background: #ffffff; padding: 30px; border: 1px solid #e2e8f0;'>
            
            <!-- Dados do Cliente -->
            <div style='background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;'>
                <h2 style='color: #334155; font-size: 16px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;'>👤 Dados do Cliente</h2>
                <table style='width: 100%; border-collapse: collapse;'>
                    <tr>
                        <td style='padding: 6px 0; color: #64748b; font-size: 14px;'>Nome:</td>
                        <td style='padding: 6px 0; font-weight: bold; color: #1e293b; font-size: 14px;'>{$nome}</td>
                    </tr>
                    <tr>
                        <td style='padding: 6px 0; color: #64748b; font-size: 14px;'>Email:</td>
                        <td style='padding: 6px 0; font-weight: bold; color: #1e293b; font-size: 14px;'>
                            <a href='mailto:{$email}' style='color: #2563eb;'>{$email}</a>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 6px 0; color: #64748b; font-size: 14px;'>Telefone:</td>
                        <td style='padding: 6px 0; font-weight: bold; color: #1e293b; font-size: 14px;'>
                            <a href='https://wa.me/55{$telefone}' style='color: #16a34a;'>📱 {$telefone}</a>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Tipo e Valor -->
            <div style='background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #bfdbfe;'>
                <div style='display: flex; justify-content: space-between; align-items: center;'>
                    <div>
                        <p style='color: #64748b; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 1px;'>Modelo</p>
                        <p style='color: #1e293b; font-size: 20px; font-weight: bold; margin: 4px 0 0 0;'>{$tipo_nome}</p>
                    </div>
                    <div style='text-align: right;'>
                        <p style='color: #64748b; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 1px;'>Valor Estimado</p>
                        <p style='color: #16a34a; font-size: 28px; font-weight: bold; margin: 4px 0 0 0;'>{$valor_fmt}</p>
                    </div>
                </div>
            </div>

            <!-- Especificações Técnicas -->
            <div style='background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;'>
                <h2 style='color: #334155; font-size: 16px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;'>📐 Especificações Técnicas</h2>
                <div style='font-size: 14px; color: #475569; line-height: 1.8;'>
                    {$specs_html}
                </div>
            </div>

            <!-- JSON completo (para referência técnica) -->
            <details style='margin-top: 16px;'>
                <summary style='cursor: pointer; color: #94a3b8; font-size: 12px;'>📋 Ver dados brutos (JSON)</summary>
                <div style='background: #1e293b; color: #94a3b8; padding: 16px; border-radius: 8px; margin-top: 8px; font-family: monospace; font-size: 11px; word-break: break-all;'>
                    <strong style='color: #60a5fa;'>config:</strong> " . esc_html(is_string($config_json) ? $config_json : json_encode($config)) . "<br><br>
                    <strong style='color: #60a5fa;'>dims:</strong> " . esc_html(is_string($dims_json) ? $dims_json : json_encode($dims)) . "
                </div>
            </details>
        </div>

        <div style='background: #f1f5f9; padding: 20px; border-radius: 0 0 16px 16px; text-align: center; border: 1px solid #e2e8f0; border-top: none;'>
            <p style='color: #94a3b8; font-size: 12px; margin: 0;'>Lead #{$id} · CDS Industrial · Calculadora de Escadas</p>
        </div>
    </div>";

    // Headers para email HTML
    $headers = array(
        'Content-Type: text/html; charset=UTF-8',
        "Reply-To: {$nome} <{$email}>",
    );

    // Enviar
    wp_mail($to, $subject, $body, $headers);
}

// ============================================================
// 4. PÁGINA DE ADMIN — VER TODOS OS LEADS
// ============================================================
add_action('admin_menu', function () {
    add_menu_page(
        'Leads Escadas',
        'Leads Escadas',
        'manage_options',
        'cds-leads',
        'cds_lead_admin_page',
        'dashicons-clipboard',
        30
    );
    add_submenu_page(
        'cds-leads',
        'Configurações',
        'Configurações',
        'manage_options',
        'cds-leads-config',
        'cds_lead_config_page'
    );
});

// Página de configurações
function cds_lead_config_page() {
    if (isset($_POST['cds_lead_email_submit']) && check_admin_referer('cds_lead_email_save')) {
        $email = sanitize_email($_POST['cds_lead_email']);
        update_option('cds_lead_email', $email);
        echo '<div class="notice notice-success"><p>Email atualizado com sucesso!</p></div>';
    }
    $current_email = get_option('cds_lead_email', get_option('admin_email'));
    ?>
    <div class="wrap">
        <h1>⚙️ Configurações - Leads Escadas</h1>
        <form method="post">
            <?php wp_nonce_field('cds_lead_email_save'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="cds_lead_email">Email para notificações</label></th>
                    <td>
                        <input type="email" name="cds_lead_email" id="cds_lead_email" 
                               value="<?php echo esc_attr($current_email); ?>" 
                               class="regular-text" required>
                        <p class="description">Quando um cliente fizer um projeto no calculador, as especificações serão enviadas para este email.</p>
                    </td>
                </tr>
            </table>
            <input type="hidden" name="cds_lead_email_submit" value="1">
            <?php submit_button('Salvar Email'); ?>
        </form>
    </div>
    <?php
}

// Página de listagem de leads
function cds_lead_admin_page() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'cds_leads';

    // Verificar se a tabela existe
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
        cds_lead_create_table();
    }

    $leads = $wpdb->get_results("SELECT * FROM $table_name ORDER BY criado_em DESC LIMIT 100");

    $tipo_labels = array(
        'straight' => 'Reta',
        'landing'  => 'Patamar',
        'lshape'   => 'Em L',
        'spiral'   => 'Caracol',
    );
    ?>
    <div class="wrap">
        <h1>🏗️ Leads do Calculador de Escadas <span class="badge" style="background: #2563eb; color: white; padding: 2px 10px; border-radius: 20px; font-size: 14px;"><?php echo count($leads); ?></span></h1>
        
        <?php if (empty($leads)): ?>
            <div class="notice notice-info">
                <p>Nenhum lead recebido ainda. Quando alguém usar o calculador e preencher os dados, aparecerá aqui.</p>
            </div>
        <?php else: ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Telefone</th>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>Especificações</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($leads as $lead): 
                        $config = json_decode($lead->config, true);
                        $dims = json_decode($lead->dims, true);
                        $tipo_label = $tipo_labels[$lead->tipo] ?? ucfirst($lead->tipo);
                        
                        // Montar resumo das specs
                        $specs_parts = array();
                        if (!empty($dims['H'])) $specs_parts[] = "H:{$dims['H']}mm";
                        if (!empty($dims['D'])) $specs_parts[] = "Ø{$dims['D']}mm";
                        if (!empty($dims['L'])) $specs_parts[] = "L:{$dims['L']}mm";
                        if (!empty($dims['W'])) $specs_parts[] = "W:{$dims['W']}mm";
                        if (!empty($config['steps'])) $specs_parts[] = "{$config['steps']} degraus";
                        if (!empty($config['h'])) $specs_parts[] = "h:" . round($config['h']) . "mm";
                        if (!empty($config['p'])) $specs_parts[] = "p:" . round($config['p']) . "mm";
                    ?>
                    <tr>
                        <td><?php echo esc_html($lead->id); ?></td>
                        <td><strong><?php echo esc_html($lead->nome); ?></strong></td>
                        <td><a href="mailto:<?php echo esc_attr($lead->email); ?>"><?php echo esc_html($lead->email); ?></a></td>
                        <td><a href="https://wa.me/55<?php echo preg_replace('/[^0-9]/', '', $lead->telefone); ?>" target="_blank">📱 <?php echo esc_html($lead->telefone); ?></a></td>
                        <td><span style="background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 8px; font-weight: bold; font-size: 12px;"><?php echo esc_html($tipo_label); ?></span></td>
                        <td><strong style="color: #16a34a;">R$ <?php echo number_format($lead->valor, 2, ',', '.'); ?></strong></td>
                        <td style="font-size: 12px; color: #64748b;"><?php echo esc_html(implode(' · ', $specs_parts)); ?></td>
                        <td style="font-size: 12px;"><?php echo date_i18n('d/m/Y H:i', strtotime($lead->criado_em)); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    <?php
}

// ============================================================
// 5. PERMITIR CORS PARA O CALCULADOR (Vercel)
// ============================================================
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        $origin = get_http_origin();
        $allowed_origins = array(
            'https://calculadora-escadas-4-0-woocommerce.vercel.app',
            'https://cdsind.com.br',
            'https://www.cdsind.com.br',
            'http://localhost:5173',
            'http://localhost:3000',
        );
        
        if (in_array($origin, $allowed_origins) || empty($origin)) {
            header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
        } else {
            header('Access-Control-Allow-Origin: https://cdsind.com.br');
        }
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        return $value;
    });
}, 15);

// Handle preflight OPTIONS requests
add_action('init', function () {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
        $allowed_origins = array(
            'https://calculadora-escadas-4-0-woocommerce.vercel.app',
            'https://cdsind.com.br',
            'https://www.cdsind.com.br',
        );
        if (in_array($origin, $allowed_origins)) {
            header("Access-Control-Allow-Origin: $origin");
        }
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
        status_header(200);
        exit;
    }
});
