// tcp_server.rs - SERVIDOR TCP INDUSTRIAL PARA PLC SIEMENS S7-1500
// ============================================================================
// OTIMIZADO PARA: TSEND_C @ 2Hz, 1288 bytes/pacote, conexão direta via cabo
// ============================================================================
// FUNCIONALIDADES:
//   - Recepção e parsing binário (Word[65] + Int[65] + Real[257])
//   - Monitoramento de saúde por conexão (ConnectionHealth)
//   - Watchdog automático para conexões mortas
//   - Cache de últimos dados para consulta rápida
//   - Gestão de conexões (desconectar/bloquear/reconectar)
//   - Tratamento de reconexões e conexões duplicadas
//   - Logging para banco de dados SQLite
//   - Emissão de eventos via broadcast channel (plc-connected, tcp-stats, etc.)
//   - Modo somente recepção (TSEND_C não espera ACK)
// ============================================================================

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Weak};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::io::AsyncReadExt;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock};
use tokio::time::{sleep, timeout};
use serde::{Deserialize, Serialize};
use crate::database::Database;

// ============================================================================
// CONSTANTES - ESTRUTURA PLC UDT_TCP_Data
// ============================================================================

const WORD_COUNT: usize = 65;        // Word[0..64]
const INT_COUNT: usize = 65;         // Int[0..64]
const REAL_COUNT: usize = 257;       // Real[0..256]
const WORD_OFFSET: usize = 0;
const INT_OFFSET: usize = WORD_COUNT * 2;                // 130
const REAL_OFFSET: usize = INT_OFFSET + INT_COUNT * 2;   // 260
const EXPECTED_PACKET_SIZE: usize = REAL_OFFSET + REAL_COUNT * 4; // 1288

// Timeouts (otimizados para rede industrial com latência variável)
const READ_TIMEOUT_SECS: u64 = 15;
const INACTIVITY_TIMEOUT_SECS: u64 = 180;    // 3 minutos sem dados = morto
const FRAGMENT_WARN_SECS: u64 = 30;
const FRAGMENT_CLEAR_SECS: u64 = 90;
const WATCHDOG_INTERVAL_MS: u64 = 2000;      // Verificar a cada 2s
const MAX_ACCUMULATOR_SIZE: usize = EXPECTED_PACKET_SIZE * 3; // ~3.8KB

// ============================================================================
// ESTRUTURAS DE DADOS
// ============================================================================

/// Estado de saúde de uma conexão (uso interno, contém Instant)
#[derive(Debug, Clone)]
pub struct ConnectionHealth {
    pub ip: String,
    pub conn_id: u64,
    pub connected_at: Instant,
    pub last_data_received: Instant,
    pub total_bytes: u64,
    pub packet_count: u64,
    pub is_alive: bool,
    pub last_error: Option<String>,
    removal_in_progress: bool,
}

/// Versão serializável de ConnectionHealth (para retornar ao frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionHealthInfo {
    pub ip: String,
    pub conn_id: u64,
    pub connected_secs: u64,
    pub seconds_since_last_data: u64,
    pub total_bytes: u64,
    pub packet_count: u64,
    pub is_alive: bool,
    pub last_error: Option<String>,
}

impl ConnectionHealth {
    fn to_info(&self) -> ConnectionHealthInfo {
        ConnectionHealthInfo {
            ip: self.ip.clone(),
            conn_id: self.conn_id,
            connected_secs: self.connected_at.elapsed().as_secs(),
            seconds_since_last_data: self.last_data_received.elapsed().as_secs(),
            total_bytes: self.total_bytes,
            packet_count: self.packet_count,
            is_alive: self.is_alive,
            last_error: self.last_error.clone(),
        }
    }
}

/// Dados PLC parseados - enviado via broadcast channel para lib.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcData {
    pub timestamp: String,
    pub variables: HashMap<String, f64>,
}

/// Variável PLC individual (enriquecida com tipo e unidade)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcVariable {
    pub name: String,
    pub value: String,
    pub data_type: String,
    pub unit: Option<String>,
}

/// Pacote de dados PLC cacheado para consulta via API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcDataPacket {
    pub ip: String,
    pub timestamp: u64,
    pub size: usize,
    pub variables: Vec<PlcVariable>,
}

/// Estatísticas de conexão (retornável ao frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub active_connections: u64,
    pub total_connections: u64,
    pub last_data_time: u64,
    pub server_status: String,
    pub plc_status: String,
}

/// Resultado interno de cada conexão
enum ConnectionResult {
    Normal(u64),
    Timeout(String),
    Error(String),
    ServerStopped,
}

// ============================================================================
// TCP SERVER
// ============================================================================

#[derive(Clone)]
pub struct TcpServer {
    port: u16,
    tx: broadcast::Sender<PlcData>,
    is_running: Arc<AtomicBool>,
    active_connections: Arc<AtomicU64>,
    total_connection_count: Arc<AtomicU64>,
    last_data_time: Arc<AtomicU64>,
    database: Option<Weak<Database>>,
    // Gestão de conexões
    connected_clients: Arc<RwLock<Vec<String>>>,
    connection_handles: Arc<RwLock<HashMap<String, tokio::task::AbortHandle>>>,
    unique_plcs: Arc<RwLock<HashSet<String>>>,
    blacklisted_ips: Arc<RwLock<HashSet<String>>>,
    ip_to_id: Arc<RwLock<HashMap<String, u64>>>,
    bytes_received: Arc<RwLock<HashMap<String, u64>>>,
    // Cache de dados & saúde
    latest_data: Arc<RwLock<HashMap<String, PlcDataPacket>>>,
    connection_health: Arc<RwLock<HashMap<String, ConnectionHealth>>>,
}

impl TcpServer {
    pub fn new(port: u16) -> Self {
        let (tx, _) = broadcast::channel(1000);
        Self {
            port,
            tx,
            is_running: Arc::new(AtomicBool::new(false)),
            active_connections: Arc::new(AtomicU64::new(0)),
            total_connection_count: Arc::new(AtomicU64::new(0)),
            last_data_time: Arc::new(AtomicU64::new(0)),
            database: None,
            connected_clients: Arc::new(RwLock::new(Vec::new())),
            connection_handles: Arc::new(RwLock::new(HashMap::new())),
            unique_plcs: Arc::new(RwLock::new(HashSet::new())),
            blacklisted_ips: Arc::new(RwLock::new(HashSet::new())),
            ip_to_id: Arc::new(RwLock::new(HashMap::new())),
            bytes_received: Arc::new(RwLock::new(HashMap::new())),
            latest_data: Arc::new(RwLock::new(HashMap::new())),
            connection_health: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn set_database(&mut self, database: Weak<Database>) {
        self.database = Some(database);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<PlcData> {
        self.tx.subscribe()
    }

    // ====== Emissão de eventos (log) ======
    fn emit_event(&self, event: &str, _data: serde_json::Value) {
        // Eventos são informativos - PLC data vai pelo broadcast channel
        let _ = event; // silenciar warnings
    }

    // ====== Logging para banco de dados ======
    async fn log_to_db(&self, level: &str, category: &str, message: &str, details: &str) {
        if let Some(ref db_weak) = self.database {
            if let Some(db) = db_weak.upgrade() {
                let _ = db.add_system_log(level, category, message, details).await;
            }
        }
    }

    // ====================================================================
    // SERVIDOR PRINCIPAL - Accept loop
    // ====================================================================
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.is_running.store(true, Ordering::SeqCst);

        // Retry bind (caso instância anterior ainda esteja a fechar)
        let listener = {
            let mut attempts = 0;
            loop {
                match TcpListener::bind(format!("0.0.0.0:{}", self.port)).await {
                    Ok(l) => break l,
                    Err(e) if attempts < 10 => {
                        attempts += 1;
                        eprintln!("⏳ TCP porta {} ocupada, tentativa {}/10... ({})", self.port, attempts, e);
                        sleep(Duration::from_secs(2)).await;
                    }
                    Err(e) => return Err(e.into()),
                }
            }
        };

        println!("═══════════════════════════════════════════════════════════");
        println!("🚀 SERVIDOR TCP INICIADO NA PORTA {}", self.port);
        println!("═══════════════════════════════════════════════════════════");
        println!("⚡ Otimizado para PLC Siemens S7-1500 (TSEND_C @ 2Hz)");
        println!("📡 Modo: SOMENTE RECEPÇÃO (sem ACK)");
        println!("📦 Pacote esperado: {} bytes (Word[{}] + Int[{}] + Real[{}])",
            EXPECTED_PACKET_SIZE, WORD_COUNT, INT_COUNT, REAL_COUNT);
        println!("⏱️  Timeout leitura: {}s | Inatividade: {}s",
            READ_TIMEOUT_SECS, INACTIVITY_TIMEOUT_SECS);
        println!("═══════════════════════════════════════════════════════════");

        self.emit_event("tcp-server-started", serde_json::json!({
            "port": self.port,
            "expected_packet_size": EXPECTED_PACKET_SIZE
        }));

        self.log_to_db("info", "tcp",
            "Servidor TCP iniciado",
            &format!("Porta: {} | Pacote: {} bytes", self.port, EXPECTED_PACKET_SIZE)
        ).await;

        // Iniciar watchdog em background
        let watchdog_self = self.clone();
        tokio::spawn(async move { watchdog_self.run_watchdog().await; });

        let mut next_id = 1u64;

        // ── Accept loop ──
        while self.is_running.load(Ordering::SeqCst) {
            let accept_result = timeout(
                Duration::from_secs(1),
                listener.accept()
            ).await;

            match accept_result {
                Ok(Ok((socket, addr))) => {
                    let ip = addr.ip().to_string();

                    // ── Blacklist check ──
                    if self.blacklisted_ips.read().await.contains(&ip) {
                        println!("🚫 CONEXÃO RECUSADA: {} (bloqueado)", ip);
                        drop(socket);
                        continue;
                    }

                    // ── Conexão duplicada: matar anterior ──
                    if self.connection_handles.read().await.contains_key(&ip) {
                        println!("⚠️ CONEXÃO DUPLICADA: {} - Matando antiga!", ip);
                        if let Some(old_handle) = self.connection_handles.write().await.remove(&ip) {
                            old_handle.abort();
                            self.connection_health.write().await.remove(&ip);
                            sleep(Duration::from_millis(100)).await;
                        }
                    }

                    // ── Atribuir ID (manter mesmo para reconexões) ──
                    let conn_id = {
                        let mut id_map = self.ip_to_id.write().await;
                        if let Some(&existing_id) = id_map.get(&ip) {
                            println!("🔄 RECONEXÃO: {} (ID #{})", ip, existing_id);
                            existing_id
                        } else {
                            let new_id = next_id;
                            next_id += 1;
                            id_map.insert(ip.clone(), new_id);
                            println!("🆕 NOVA CONEXÃO: {} (ID #{})", ip, new_id);
                            new_id
                        }
                    };

                    // ── Registrar saúde ──
                    let now = Instant::now();
                    self.connection_health.write().await.insert(ip.clone(), ConnectionHealth {
                        ip: ip.clone(),
                        conn_id,
                        connected_at: now,
                        last_data_received: now,
                        total_bytes: 0,
                        packet_count: 0,
                        is_alive: true,
                        last_error: None,
                        removal_in_progress: false,
                    });

                    // ── Registrar cliente ──
                    self.connected_clients.write().await.push(ip.clone());
                    self.unique_plcs.write().await.insert(ip.clone());

                    let current_active = self.active_connections.fetch_add(1, Ordering::SeqCst) + 1;
                    self.total_connection_count.fetch_add(1, Ordering::SeqCst);
                    let total_unique = self.unique_plcs.read().await.len() as u64;

                    println!("✅ PLC CONECTADO: {} (ID: {}) | Ativos: {}", ip, conn_id, current_active);

                    // Eventos Tauri
                    self.emit_event("plc-connected", serde_json::json!({
                        "id": conn_id,
                        "ip": ip,
                        "address": addr.to_string()
                    }));

                    self.emit_event("tcp-stats", serde_json::json!({
                        "active_connections": current_active,
                        "total_connections": total_unique,
                        "server_status": "Rodando",
                        "plc_status": "Conectado"
                    }));

                    self.log_to_db("info", "plc",
                        &format!("PLC conectado: {} (ID #{})", ip, conn_id),
                        &format!("Endereço: {} | Ativos: {}", addr, current_active)
                    ).await;

                    // ── Spawn handler ──
                    let server = self.clone();
                    let ip_clone = ip.clone();

                    let connection_handle = tokio::spawn(async move {
                        let result = handle_client_connection(
                            socket, conn_id, ip_clone.clone(), &server
                        ).await;

                        // ── Cleanup após desconexão ──
                        let should_cleanup = {
                            let mut health = server.connection_health.write().await;
                            if let Some(h) = health.get_mut(&ip_clone) {
                                if !h.removal_in_progress {
                                    h.removal_in_progress = true;
                                    true
                                } else { false }
                            } else { false }
                        };

                        if should_cleanup {
                            match &result {
                                ConnectionResult::Normal(bytes) => {
                                    println!("📊 PLC {} desconectou normalmente. Total: {} bytes", ip_clone, bytes);
                                }
                                ConnectionResult::Timeout(reason) => {
                                    println!("⏰ PLC {} timeout: {}", ip_clone, reason);
                                    server.emit_event("tcp-connection-timeout", serde_json::json!({
                                        "ip": ip_clone, "id": conn_id, "reason": reason
                                    }));
                                }
                                ConnectionResult::Error(error) => {
                                    println!("❌ PLC {} erro: {}", ip_clone, error);
                                    server.log_to_db("error", "tcp",
                                        &format!("Erro na conexão PLC {}", ip_clone), error
                                    ).await;
                                    server.emit_event("tcp-connection-error", serde_json::json!({
                                        "ip": ip_clone, "id": conn_id, "error": error
                                    }));
                                }
                                ConnectionResult::ServerStopped => {
                                    println!("🛑 PLC {} - servidor parou", ip_clone);
                                }
                            }

                            // Remover dos registros
                            server.connected_clients.write().await.retain(|x| x != &ip_clone);
                            server.connection_handles.write().await.remove(&ip_clone);
                            server.connection_health.write().await.remove(&ip_clone);

                            let remaining = server.active_connections.fetch_sub(1, Ordering::SeqCst).saturating_sub(1);
                            let total_unique = server.unique_plcs.read().await.len() as u64;

                            println!("❌ PLC DESCONECTADO: {} | Ativos: {}", ip_clone, remaining);

                            server.emit_event("plc-disconnected", serde_json::json!({
                                "id": conn_id, "ip": ip_clone
                            }));

                            server.emit_event("tcp-stats", serde_json::json!({
                                "active_connections": remaining,
                                "total_connections": total_unique,
                                "server_status": "Rodando",
                                "plc_status": if remaining > 0 { "Conectado" } else { "Desconectado" }
                            }));

                            server.log_to_db("info", "plc",
                                &format!("PLC desconectado: {}", ip_clone),
                                &format!("ID: {} | Ativos restantes: {}", conn_id, remaining)
                            ).await;
                        }
                    });

                    // Registrar handle para poder abortar depois
                    self.connection_handles.write().await.insert(ip, connection_handle.abort_handle());
                }
                Ok(Err(e)) => {
                    eprintln!("❌ Erro ao aceitar conexão: {}", e);
                    self.log_to_db("error", "tcp", "Erro ao aceitar conexão TCP", &e.to_string()).await;
                    sleep(Duration::from_millis(100)).await;
                }
                Err(_) => {
                    // Accept timeout - continuar loop
                }
            }
        }

        println!("🛑 SERVIDOR TCP PARADO");
        Ok(())
    }

    // ====================================================================
    // WATCHDOG - Monitora conexões mortas e limpa recursos
    // ====================================================================
    async fn run_watchdog(&self) {
        println!("🐕 WATCHDOG INICIADO (intervalo: {}ms)", WATCHDOG_INTERVAL_MS);

        let mut interval = tokio::time::interval(Duration::from_millis(WATCHDOG_INTERVAL_MS));
        let mut iteration: u64 = 0;

        while self.is_running.load(Ordering::SeqCst) {
            interval.tick().await;
            iteration += 1;

            // ── Detectar conexões mortas ──
            let dead_ips = {
                let health = self.connection_health.read().await;
                health.iter()
                    .filter(|(_, h)| {
                        !h.removal_in_progress
                        && h.last_data_received.elapsed().as_secs() > INACTIVITY_TIMEOUT_SECS
                    })
                    .map(|(ip, h)| {
                        println!("🚨 WATCHDOG: {} MORTA! Sem dados há {}s (limite: {}s)",
                            ip, h.last_data_received.elapsed().as_secs(), INACTIVITY_TIMEOUT_SECS);
                        ip.clone()
                    })
                    .collect::<Vec<_>>()
            };

            // ── Emitir warnings para conexões lentas (a cada ~30s) ──
            if iteration % 15 == 0 {
                let health = self.connection_health.read().await;
                for (ip, h) in health.iter() {
                    if h.removal_in_progress { continue; }
                    let secs = h.last_data_received.elapsed().as_secs();
                    if secs > INACTIVITY_TIMEOUT_SECS / 2 && secs <= INACTIVITY_TIMEOUT_SECS {
                        println!("⚠️ WATCHDOG: {} LENTA! Sem dados há {}s", ip, secs);
                        self.emit_event("tcp-connection-slow", serde_json::json!({
                            "ip": ip, "id": h.conn_id, "seconds_since_data": secs
                        }));
                    }
                }
            }

            // ── Matar conexões mortas ──
            for ip in dead_ips {
                let should_remove = {
                    let mut health = self.connection_health.write().await;
                    if let Some(h) = health.get_mut(&ip) {
                        if !h.removal_in_progress {
                            h.removal_in_progress = true;

                            self.emit_event("tcp-connection-dead", serde_json::json!({
                                "ip": ip,
                                "id": h.conn_id,
                                "seconds_since_data": h.last_data_received.elapsed().as_secs(),
                                "total_bytes": h.total_bytes,
                                "packet_count": h.packet_count
                            }));

                            true
                        } else { false }
                    } else { false }
                };

                if should_remove {
                    println!("💀 WATCHDOG: Matando conexão morta: {}", ip);

                    // Usar timeout para evitar deadlock ao adquirir lock
                    match timeout(Duration::from_secs(5), self.connection_handles.write()).await {
                        Ok(mut handles) => {
                            if let Some(handle) = handles.remove(&ip) {
                                handle.abort();
                            }
                        }
                        Err(_) => {
                            println!("⚠️ WATCHDOG: Timeout ao adquirir lock para {}", ip);
                            continue;
                        }
                    }

                    self.connection_health.write().await.remove(&ip);
                    self.connected_clients.write().await.retain(|x| x != &ip);
                    self.active_connections.fetch_sub(1, Ordering::SeqCst);

                    self.log_to_db("warning", "plc",
                        &format!("Watchdog: conexão {} eliminada", ip),
                        &format!("Sem atividade há mais de {}s", INACTIVITY_TIMEOUT_SECS)
                    ).await;

                    // Emitir desconexão
                    self.emit_event("plc-disconnected", serde_json::json!({
                        "ip": ip, "reason": "watchdog_timeout"
                    }));
                }
            }

            // ── Estatísticas periódicas (~1 minuto) ──
            if iteration % 30 == 0 {
                let active = self.active_connections.load(Ordering::SeqCst);
                let cache_size = self.latest_data.read().await.len();
                let health_count = self.connection_health.read().await.len();
                let unique_count = self.unique_plcs.read().await.len();

                println!("📊 WATCHDOG: Ativos={} Cache={} Health={} PLCs_Únicos={}",
                    active, cache_size, health_count, unique_count);
            }

            // ── Limpar cache latest_data > 5min (~150 iterações) ──
            if iteration % 150 == 0 {
                let now_ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                let mut data = self.latest_data.write().await;
                let before = data.len();
                data.retain(|_, packet| (now_ts - packet.timestamp) < 300);
                let after = data.len();
                if before > after {
                    println!("🗑️ WATCHDOG: Limpou {} entradas de cache antigas", before - after);
                }
            }

            // ── Resetar bytes_received a cada 24h (~43200 iterações) ──
            if iteration % 43200 == 0 {
                self.bytes_received.write().await.clear();
                println!("🗑️ WATCHDOG: Reset diário de contadores de bytes");
            }
        }

        println!("🐕 WATCHDOG FINALIZADO");
    }

    // ====================================================================
    // PARAR SERVIDOR
    // ====================================================================
    pub async fn stop(&self) -> Result<String, String> {
        if !self.is_running.load(Ordering::SeqCst) {
            return Err("Servidor não está rodando".to_string());
        }

        println!("🛑 PARANDO SERVIDOR TCP...");
        self.is_running.store(false, Ordering::SeqCst);

        // Abortar todas as conexões ativas
        let mut handles = self.connection_handles.write().await;
        for (ip, handle) in handles.drain() {
            println!("💀 Matando conexão: {}", ip);
            handle.abort();
        }

        // Limpar estado
        self.connection_health.write().await.clear();
        self.active_connections.store(0, Ordering::SeqCst);
        self.connected_clients.write().await.clear();

        // Eventos
        self.emit_event("tcp-server-stopped", serde_json::json!({}));
        self.emit_event("tcp-stats", serde_json::json!({
            "active_connections": 0,
            "total_connections": self.unique_plcs.read().await.len(),
            "server_status": "Parado",
            "plc_status": "Desconectado"
        }));

        self.log_to_db("info", "tcp", "Servidor TCP parado", "").await;

        println!("✅ SERVIDOR TCP PARADO");
        Ok("Servidor TCP parado".to_string())
    }

    // ====================================================================
    // DESCONECTAR CLIENTE (com blacklist)
    // ====================================================================
    pub async fn disconnect_client(&self, client_ip: &str) -> Result<String, String> {
        println!("🔌 DESCONECTANDO: {}", client_ip);

        // Adicionar à blacklist para impedir reconexão
        self.blacklisted_ips.write().await.insert(client_ip.to_string());

        if let Some(handle) = self.connection_handles.write().await.remove(client_ip) {
            handle.abort();
            self.connection_health.write().await.remove(client_ip);
            self.connected_clients.write().await.retain(|ip| ip != client_ip);

            let remaining = self.active_connections.fetch_sub(1, Ordering::SeqCst).saturating_sub(1);
            let total_unique = self.unique_plcs.read().await.len() as u64;

            self.emit_event("plc-force-disconnected", serde_json::json!({
                "ip": client_ip, "blocked": true
            }));
            self.emit_event("tcp-stats", serde_json::json!({
                "active_connections": remaining,
                "total_connections": total_unique,
                "server_status": "Rodando",
                "plc_status": if remaining > 0 { "Conectado" } else { "Desconectado" }
            }));

            self.log_to_db("warning", "plc",
                &format!("PLC {} desconectado e bloqueado", client_ip), ""
            ).await;

            Ok(format!("PLC {} desconectado e bloqueado", client_ip))
        } else {
            Err(format!("PLC {} não encontrado nas conexões ativas", client_ip))
        }
    }

    // ====================================================================
    // PERMITIR RECONEXÃO (remover da blacklist)
    // ====================================================================
    pub async fn allow_reconnect(&self, client_ip: &str) -> Result<String, String> {
        if self.blacklisted_ips.write().await.remove(client_ip) {
            println!("✅ {} desbloqueado para reconexão", client_ip);
            self.log_to_db("info", "plc", &format!("PLC {} desbloqueado", client_ip), "").await;
            Ok(format!("PLC {} pode reconectar", client_ip))
        } else {
            Err(format!("PLC {} não estava bloqueado", client_ip))
        }
    }

    // ====================================================================
    // CONSULTAS - Estatísticas e dados
    // ====================================================================

    pub async fn get_connection_stats(&self) -> ConnectionStats {
        let active = self.active_connections.load(Ordering::SeqCst);
        let total_unique = self.unique_plcs.read().await.len() as u64;
        let last_time = self.last_data_time.load(Ordering::SeqCst);

        ConnectionStats {
            active_connections: active,
            total_connections: total_unique,
            last_data_time: last_time,
            server_status: if self.is_running.load(Ordering::SeqCst) {
                "Rodando".to_string()
            } else {
                "Parado".to_string()
            },
            plc_status: if active > 0 {
                "Conectado".to_string()
            } else {
                "Desconectado".to_string()
            },
        }
    }

    pub async fn get_connected_clients(&self) -> Vec<String> {
        self.connected_clients.read().await.clone()
    }

    pub async fn get_all_known_plcs(&self) -> Vec<(String, String)> {
        let connected = self.connected_clients.read().await;
        let blacklisted = self.blacklisted_ips.read().await;
        let unique = self.unique_plcs.read().await;

        unique.iter().map(|ip| {
            let status = if blacklisted.contains(ip) {
                "blocked"
            } else if connected.contains(ip) {
                "connected"
            } else {
                "disconnected"
            };
            (ip.clone(), status.to_string())
        }).collect()
    }

    pub async fn get_plc_data(&self, ip: &str) -> Option<PlcDataPacket> {
        self.latest_data.read().await.get(ip).cloned()
    }

    pub async fn get_all_plc_data(&self) -> HashMap<String, PlcDataPacket> {
        self.latest_data.read().await.clone()
    }

    pub async fn get_connection_health(&self) -> Vec<ConnectionHealthInfo> {
        self.connection_health.read().await.values()
            .map(|h| h.to_info())
            .collect()
    }

    pub async fn get_bytes_received(&self) -> HashMap<String, u64> {
        self.bytes_received.read().await.clone()
    }

    // ====================================================================
    // CONEXÃO ATIVA AO PLC (modo cliente com retry)
    // ====================================================================
    pub async fn connect_to_plc(
        &self,
        plc_ip: &str,
        plc_port: u16
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let server = self.clone();
        let plc_address = format!("{}:{}", plc_ip, plc_port);

        println!("🔄 Iniciando conexão com PLC em {}", plc_address);
        self.log_to_db("info", "plc",
            &format!("Tentando conectar ao PLC {}", plc_address), ""
        ).await;

        tokio::spawn(async move {
            let mut retry_count = 0u32;
            let mut backoff = Duration::from_secs(2);

            loop {
                if !server.is_running.load(Ordering::SeqCst) { break; }

                match timeout(Duration::from_secs(10), TcpStream::connect(&plc_address)).await {
                    Ok(Ok(socket)) => {
                        retry_count = 0;
                        backoff = Duration::from_secs(2);
                        println!("✅ Conectado ao PLC {}", plc_address);

                        let ip = plc_address.split(':').next().unwrap_or("unknown").to_string();

                        match handle_client_connection(socket, 0, ip, &server).await {
                            ConnectionResult::Normal(_) => {
                                println!("📡 Conexão com PLC encerrada normalmente");
                            }
                            ConnectionResult::Timeout(r) => {
                                println!("⏰ Timeout na conexão com PLC: {}", r);
                            }
                            ConnectionResult::Error(e) => {
                                eprintln!("❌ Erro na comunicação com PLC: {}", e);
                                server.log_to_db("error", "plc",
                                    "Erro na comunicação com PLC", &e
                                ).await;
                            }
                            ConnectionResult::ServerStopped => break,
                        }

                        println!("🔄 Reconectando ao PLC...");
                    }
                    Ok(Err(e)) => {
                        retry_count += 1;
                        if retry_count % 5 == 0 {
                            eprintln!("❌ Falha ao conectar PLC {} (tentativa {}): {}",
                                plc_address, retry_count, e);
                            server.log_to_db("error", "plc",
                                &format!("Falha conexão PLC (tentativa {})", retry_count),
                                &e.to_string()
                            ).await;
                        }
                    }
                    Err(_) => {
                        retry_count += 1;
                        if retry_count % 5 == 0 {
                            eprintln!("❌ Timeout ao conectar PLC {} (tentativa {})",
                                plc_address, retry_count);
                        }
                    }
                }

                // Backoff exponencial até 30 segundos
                sleep(backoff).await;
                if backoff < Duration::from_secs(30) {
                    backoff = std::cmp::min(backoff * 2, Duration::from_secs(30));
                }

                if retry_count > 0 && retry_count % 10 == 0 {
                    println!("💪 Tentativa #{} de reconexão com PLC - mantendo persistência",
                        retry_count);
                }
            }
        });

        Ok(())
    }
}

// ============================================================================
// HANDLER DE CONEXÃO - SEM ACK (TSEND_C não espera resposta)
// ============================================================================

async fn handle_client_connection(
    mut socket: TcpStream,
    conn_id: u64,
    ip: String,
    server: &TcpServer,
) -> ConnectionResult {
    // Configurar socket para baixa latência
    let _ = socket.set_nodelay(true);

    let mut buffer = vec![0u8; 8192];
    let mut accumulator: Vec<u8> = Vec::with_capacity(4096);

    let mut total_bytes = 0u64;
    let mut packet_count = 0u64;
    let mut last_valid_packet = Instant::now();
    let mut last_fragment_time = Instant::now();
    let mut last_stats_time = Instant::now();
    let mut bytes_since_stats = 0u64;
    let mut consecutive_timeouts = 0u32;
    let start_time = Instant::now();

    println!("🔗 Conexão #{} ({}) estabelecida - modo SOMENTE RECEPÇÃO", conn_id, ip);

    loop {
        // ── Verificar se servidor parou ──
        if !server.is_running.load(Ordering::SeqCst) {
            return ConnectionResult::ServerStopped;
        }

        // ── Verificar inatividade ──
        if last_valid_packet.elapsed().as_secs() > INACTIVITY_TIMEOUT_SECS {
            return ConnectionResult::Timeout(
                format!("Sem dados há {}s (timeout: {}s)",
                    last_valid_packet.elapsed().as_secs(), INACTIVITY_TIMEOUT_SECS)
            );
        }

        // ── Limpar fragmentos TCP antigos ──
        if !accumulator.is_empty() && last_fragment_time.elapsed().as_secs() > FRAGMENT_WARN_SECS {
            if last_fragment_time.elapsed().as_secs() > FRAGMENT_CLEAR_SECS {
                println!("🗑️ #{}: Limpando fragmentos antigos ({} bytes)", conn_id, accumulator.len());
                accumulator.clear();
                last_fragment_time = Instant::now();
            }
        }

        // ── Leitura com timeout ──
        match timeout(Duration::from_secs(READ_TIMEOUT_SECS), socket.read(&mut buffer)).await {
            Ok(Ok(0)) => {
                // Conexão fechada pelo PLC
                println!("📡 Conexão #{} encerrada pelo PLC", conn_id);
                return ConnectionResult::Normal(total_bytes);
            }
            Ok(Ok(n)) => {
                consecutive_timeouts = 0;
                total_bytes += n as u64;
                bytes_since_stats += n as u64;

                // Atualizar timestamp global
                let now_ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                server.last_data_time.store(now_ts, Ordering::SeqCst);

                // Atualizar bytes recebidos
                {
                    let mut bytes = server.bytes_received.write().await;
                    *bytes.entry(ip.clone()).or_insert(0) += n as u64;
                }

                // Atualizar saúde da conexão
                {
                    let mut health = server.connection_health.write().await;
                    if let Some(h) = health.get_mut(&ip) {
                        h.last_data_received = Instant::now();
                        h.total_bytes = total_bytes;
                        h.is_alive = true;
                    }
                }

                last_fragment_time = Instant::now();

                // Proteção contra overflow do accumulator
                if accumulator.len() + n > MAX_ACCUMULATOR_SIZE {
                    eprintln!("⚠️ #{}: Accumulator overflow ({} + {} bytes), limpando",
                        conn_id, accumulator.len(), n);
                    accumulator.clear();
                    continue;
                }

                accumulator.extend_from_slice(&buffer[..n]);

                // ── Processar pacotes completos (1288 bytes cada) ──
                while accumulator.len() >= EXPECTED_PACKET_SIZE {
                    let packet_data: Vec<u8> = accumulator.drain(..EXPECTED_PACKET_SIZE).collect();
                    packet_count += 1;
                    last_valid_packet = Instant::now();

                    // Atualizar contador de pacotes no health
                    {
                        let mut health = server.connection_health.write().await;
                        if let Some(h) = health.get_mut(&ip) {
                            h.packet_count = packet_count;
                        }
                    }

                    // Parsear dados binários PLC
                    match parse_plc_packet(&packet_data) {
                        Ok((plc_data, plc_variables)) => {
                            // Enviar via broadcast channel (lib.rs subscreve e emite "plc-data")
                            let _ = server.tx.send(plc_data);

                            // Cachear no latest_data para API queries
                            let packet = PlcDataPacket {
                                ip: ip.clone(),
                                timestamp: now_ts,
                                size: packet_data.len(),
                                variables: plc_variables,
                            };
                            server.latest_data.write().await.insert(ip.clone(), packet);
                        }
                        Err(e) => {
                            if packet_count <= 3 {
                                eprintln!("⚠️ #{} erro parsing pacote #{}: {}", conn_id, packet_count, e);
                            }
                        }
                    }
                }

                // ── Log quando está acumulando dados ──
                if !accumulator.is_empty() && packet_count == 0 && total_bytes == n as u64 {
                    println!("📦 #{}: Recebido {} bytes, esperando {} (acumulando...)",
                        conn_id, accumulator.len(), EXPECTED_PACKET_SIZE);
                }

                // ── Estatísticas periódicas (a cada 1s) ──
                if last_stats_time.elapsed().as_secs_f64() >= 1.0 {
                    let elapsed_secs = last_stats_time.elapsed().as_secs_f64();
                    let bytes_per_second = (bytes_since_stats as f64 / elapsed_secs) as u64;
                    let total_elapsed = start_time.elapsed().as_secs_f64();
                    let packets_per_second = if total_elapsed > 0.0 {
                        packet_count as f64 / total_elapsed
                    } else {
                        0.0
                    };
                    let avg_packet_size = if packet_count > 0 { total_bytes / packet_count } else { 0 };

                    server.emit_event("plc-data-stats", serde_json::json!({
                        "ip": ip,
                        "id": conn_id,
                        "bytesPerSecond": bytes_per_second,
                        "packets": packet_count,
                        "totalBytes": total_bytes,
                        "transferRate": format!("{:.2} KB/s", bytes_per_second as f64 / 1024.0),
                        "packetsPerSecond": packets_per_second as u64,
                        "avgPacketSize": avg_packet_size,
                        "connectionUptime": start_time.elapsed().as_secs()
                    }));

                    bytes_since_stats = 0;
                    last_stats_time = Instant::now();
                }

                // ── Log periódico de progresso (a cada 500 pacotes) ──
                if packet_count > 0 && packet_count % 500 == 0 {
                    let elapsed = start_time.elapsed().as_secs();
                    let rate = if elapsed > 0 { total_bytes / elapsed } else { 0 };
                    println!("📊 #{}: {} pacotes, {} bytes, {}s ativo, {} B/s",
                        conn_id, packet_count, total_bytes, elapsed, rate);
                }

                // 🚫 SEM ACK - TSEND_C NÃO ESPERA RESPOSTA
            }
            Ok(Err(e)) => {
                // Erro de I/O
                let err_msg = e.to_string();
                {
                    let mut health = server.connection_health.write().await;
                    if let Some(h) = health.get_mut(&ip) {
                        h.is_alive = false;
                        h.last_error = Some(err_msg.clone());
                    }
                }
                return ConnectionResult::Error(err_msg);
            }
            Err(_) => {
                // Timeout de leitura
                consecutive_timeouts += 1;
                if consecutive_timeouts >= 3 {
                    let reason = format!("{} timeouts consecutivos de {}s",
                        consecutive_timeouts, READ_TIMEOUT_SECS);
                    {
                        let mut health = server.connection_health.write().await;
                        if let Some(h) = health.get_mut(&ip) {
                            h.is_alive = false;
                            h.last_error = Some(reason.clone());
                        }
                    }
                    return ConnectionResult::Timeout(reason);
                }
                // 🚫 NÃO ENVIAR NADA - TSEND_C não espera resposta
            }
        }
    }
}

// ============================================================================
// PARSER PLC S7-1500 via TSEND_C
// ============================================================================
// Estrutura: UDT_TCP_Data
//   Word[0..64]  = 65 Words  (u16 big-endian) = 130 bytes  (offset 0)
//   Int[0..64]   = 65 Ints   (i16 big-endian) = 130 bytes  (offset 130)
//   Real[0..256] = 257 Reals (f32 big-endian) = 1028 bytes (offset 260)
//   TOTAL = 1288 bytes
// ============================================================================

fn parse_plc_packet(data: &[u8]) -> Result<(PlcData, Vec<PlcVariable>), String> {
    if data.len() < EXPECTED_PACKET_SIZE {
        return Err(format!(
            "Pacote incompleto: {} bytes (esperado {})",
            data.len(), EXPECTED_PACKET_SIZE
        ));
    }

    let mut variables = HashMap::with_capacity(WORD_COUNT + INT_COUNT + REAL_COUNT + 4);
    let mut plc_variables = Vec::with_capacity(WORD_COUNT + INT_COUNT + REAL_COUNT);

    // ── Parse Word[0..64] - u16 big-endian (130 bytes) ──
    for i in 0..WORD_COUNT {
        let offset = WORD_OFFSET + i * 2;
        let value = u16::from_be_bytes([data[offset], data[offset + 1]]);
        let name = format!("Word[{}]", i);
        variables.insert(name.clone(), value as f64);
        plc_variables.push(PlcVariable {
            name,
            value: value.to_string(),
            data_type: "Word".to_string(),
            unit: None,
        });
    }

    // ── Parse Int[0..64] - i16 big-endian (130 bytes) ──
    for i in 0..INT_COUNT {
        let offset = INT_OFFSET + i * 2;
        let value = i16::from_be_bytes([data[offset], data[offset + 1]]);
        let name = format!("Int[{}]", i);
        variables.insert(name.clone(), value as f64);
        plc_variables.push(PlcVariable {
            name,
            value: value.to_string(),
            data_type: "Int".to_string(),
            unit: None,
        });
    }

    // ── Parse Real[0..256] - f32 big-endian (1028 bytes) ──
    for i in 0..REAL_COUNT {
        let offset = REAL_OFFSET + i * 4;
        let value = f32::from_be_bytes([
            data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
        ]);
        let name = format!("Real[{}]", i);
        // Filtrar NaN e Infinito para segurança
        let safe_value = if value.is_finite() { value as f64 } else { 0.0 };
        variables.insert(name.clone(), safe_value);
        plc_variables.push(PlcVariable {
            name,
            value: if value.is_finite() { format!("{:.4}", value) } else { "0.0".to_string() },
            data_type: "Real".to_string(),
            unit: None,
        });
    }

    // ── Metadata ──
    variables.insert("_total_bytes".to_string(), data.len() as f64);
    variables.insert("_word_count".to_string(), WORD_COUNT as f64);
    variables.insert("_int_count".to_string(), INT_COUNT as f64);
    variables.insert("_real_count".to_string(), REAL_COUNT as f64);

    let plc_data = PlcData {
        timestamp: chrono::Utc::now().to_rfc3339(),
        variables,
    };

    Ok((plc_data, plc_variables))
}
