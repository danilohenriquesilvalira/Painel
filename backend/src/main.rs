// PLC Backend Server - EDP Industrial
// Servidor standalone: REST API + SSE + Video Streaming + PLC TCP

mod database;
mod tcp_server;
mod web_server;

use std::sync::Arc;
use tokio::sync::{Mutex, broadcast};
use database::Database;
use tcp_server::TcpServer;
use tcp_server::PlcData;

const WEB_PORT: u16 = 3001;
const TCP_PORT: u16 = 8502;

#[tokio::main]
async fn main() {
    println!("═══════════════════════════════════════════════════════════");
    println!("  PLC Backend Server - EDP Industrial");
    println!("═══════════════════════════════════════════════════════════");

    // ── 1. Inicializar banco de dados ──
    let db_dir = std::env::var("DB_DIR").unwrap_or_else(|_| "./data".to_string());
    let db_path = format!("{}/plc_config.db", db_dir);

    // Criar diretório se não existir
    if let Err(e) = std::fs::create_dir_all(&db_dir) {
        eprintln!("Erro ao criar diretório {}: {}", db_dir, e);
        std::process::exit(1);
    }

    // Criar ficheiro vazio se não existir
    if !std::path::Path::new(&db_path).exists() {
        if let Err(e) = std::fs::File::create(&db_path) {
            eprintln!("Erro ao criar ficheiro DB: {}", e);
            std::process::exit(1);
        }
    }

    let db_url = format!("sqlite://{}?mode=rwc", db_path);
    println!("📁 Base de dados: {}", db_path);

    let db = match Database::new(&db_url).await {
        Ok(db) => {
            println!("✅ Base de dados inicializada");
            Arc::new(db)
        }
        Err(e) => {
            eprintln!("❌ Erro ao inicializar base de dados: {:?}", e);
            std::process::exit(1);
        }
    };

    // Log de inicialização
    let _ = db.add_system_log("info", "database", "Sistema iniciado", &format!("DB: {}", db_path)).await;

    // ── 2. Criar broadcast channel para PLC data ──
    let (plc_tx, _) = broadcast::channel::<PlcData>(1000);

    // ── 3. Iniciar TCP server para PLC ──
    let tcp_port = std::env::var("TCP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(TCP_PORT);

    let mut tcp_server = TcpServer::new(tcp_port);
    tcp_server.set_database(Arc::downgrade(&db));
    let tcp_server = Arc::new(tcp_server);

    let tcp_clone = tcp_server.clone();
    tokio::spawn(async move {
        if let Err(e) = tcp_clone.start().await {
            eprintln!("❌ Erro TCP server: {:?}", e);
        }
    });

    // Forward PLC data do TCP server para o broadcast channel (para SSE)
    let mut rx = tcp_server.subscribe();
    let plc_tx_clone = plc_tx.clone();
    tokio::spawn(async move {
        while let Ok(data) = rx.recv().await {
            let _ = plc_tx_clone.send(data);
        }
    });

    let _ = db.add_system_log("info", "tcp", "Servidor TCP iniciado", &format!("Porta: {}", tcp_port)).await;

    // ── 4. Criar app state partilhado ──
    let state = Arc::new(web_server::AppState {
        database: db,
        tcp_server: Arc::new(Mutex::new(Some(tcp_server))),
        plc_broadcast: plc_tx,
    });

    // ── 5. Iniciar web server (bloqueia aqui) ──
    let web_port = std::env::var("WEB_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(WEB_PORT);

    web_server::start(state, web_port).await;
}
