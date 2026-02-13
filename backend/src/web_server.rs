// web_server.rs - Servidor HTTP REST + SSE + Video Streaming + Static Files
// Substitui completamente o Tauri como camada de comunicação com o frontend

use std::sync::Arc;
use std::convert::Infallible;
use axum::{
    Router, Json,
    extract::State,
    routing::{get, post},
    response::{sse::{Event, KeepAlive, Sse}, IntoResponse, Response},
    http::{StatusCode, HeaderMap, header},
    body::Body,
};
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tokio::sync::{Mutex, broadcast};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use futures::stream::Stream;

use crate::database::Database;
use crate::tcp_server::{TcpServer, PlcData, ConnectionStats};

// ============================================================================
// APP STATE
// ============================================================================

#[derive(Clone)]
pub struct AppState {
    pub database: Arc<Database>,
    pub tcp_server: Arc<Mutex<Option<Arc<TcpServer>>>>,
    pub plc_broadcast: broadcast::Sender<PlcData>,
}

// ============================================================================
// INVOKE PAYLOAD (compatível com o padrão Tauri invoke)
// ============================================================================

#[derive(serde::Deserialize)]
struct InvokePayload {
    command: String,
    #[serde(default)]
    args: serde_json::Value,
}

// ============================================================================
// ROUTER
// ============================================================================

pub async fn start(state: Arc<AppState>, port: u16) {
    let dist_path = std::env::var("DIST_PATH").unwrap_or_else(|_| "../dist".to_string());

    let api_routes = Router::new()
        .route("/api/invoke", post(handle_invoke))
        .route("/api/events/plc-data", get(handle_plc_sse))
        .route("/api/video/*path", get(handle_video))
        .with_state(state);

    // Fallback: serve frontend static files (SPA)
    let spa_fallback = ServeDir::new(&dist_path)
        .not_found_service(ServeFile::new(format!("{}/index.html", dist_path)));

    let app = Router::new()
        .merge(api_routes)
        .fallback_service(spa_fallback)
        .layer(CorsLayer::permissive());

    // Tentar bind com retry (caso instância anterior ainda esteja a fechar)
    let listener = {
        let mut attempts = 0;
        loop {
            match tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await {
                Ok(l) => break l,
                Err(e) if attempts < 5 => {
                    attempts += 1;
                    eprintln!("⏳ Porta {} ocupada, tentativa {}/5... ({})", port, attempts, e);
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
                Err(e) => {
                    eprintln!("❌ Falha ao iniciar na porta {}: {}", port, e);
                    std::process::exit(1);
                }
            }
        }
    };

    println!("═══════════════════════════════════════════════════════════");
    println!("🌐 SERVIDOR WEB INICIADO");
    println!("   Local:   http://127.0.0.1:{}", port);
    println!("   Rede:    http://0.0.0.0:{}", port);
    println!("   Admin:   http://<IP>:{}", port);
    println!("   Painel:  http://<IP>:{}/src/panel.html", port);
    println!("═══════════════════════════════════════════════════════════");

    axum::serve(listener, app).await.unwrap();
}

// ============================================================================
// GENERIC INVOKE HANDLER
// Mapeia 1:1 com os comandos Tauri existentes
// ============================================================================

async fn handle_invoke(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<InvokePayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let args = &payload.args;
    let db = &state.database;

    let result: Result<serde_json::Value, String> = match payload.command.as_str() {
        // ── VÍDEOS ──
        "get_all_videos" => {
            db.get_all_videos().await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "get_video" => {
            let id = args["id"].as_i64().unwrap_or(0);
            db.get_video(id).await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "add_video" => {
            let name = args["name"].as_str().unwrap_or("");
            let file_path = args["filePath"].as_str().unwrap_or("");
            let duration = args["duration"].as_i64().unwrap_or(30) as i32;
            let enabled = args["enabled"].as_bool().unwrap_or(true);
            let priority = args["priority"].as_i64().unwrap_or(50) as i32;
            let description = args["description"].as_str().unwrap_or("");
            db.add_video(name, file_path, duration, enabled, priority, description).await
                .map(|id| serde_json::json!(id))
                .map_err(|e| e.to_string())
        }
        "update_video" => {
            let id = args["id"].as_i64().unwrap_or(0);
            let name = args["name"].as_str().unwrap_or("");
            let file_path = args["filePath"].as_str().unwrap_or("");
            let duration = args["duration"].as_i64().unwrap_or(30) as i32;
            let enabled = args["enabled"].as_bool().unwrap_or(true);
            let priority = args["priority"].as_i64().unwrap_or(50) as i32;
            let description = args["description"].as_str().unwrap_or("");
            let display_order = args["displayOrder"].as_i64().unwrap_or(0) as i32;
            db.update_video(id, name, file_path, duration, enabled, priority, description, display_order).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }
        "delete_video" => {
            let id = args["id"].as_i64().unwrap_or(0);
            db.delete_video(id).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }
        "get_enabled_videos" => {
            db.get_enabled_videos().await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "reorder_video" => {
            let id = args["id"].as_i64().unwrap_or(0);
            let new_order = args["newOrder"].as_i64().unwrap_or(0) as i32;
            db.reorder_video(id, new_order).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }
        "clear_all_videos" => {
            db.clear_all_videos().await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }

        // ── BIT CONFIGS ──
        "get_all_bit_configs" => {
            db.get_all_bit_configs().await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "get_bit_config" => {
            let word_index = args["wordIndex"].as_i64().unwrap_or(0) as i32;
            let bit_index = args["bitIndex"].as_i64().unwrap_or(0) as i32;
            db.get_bit_config(word_index, bit_index).await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "add_bit_config" => {
            let wi = args["wordIndex"].as_i64().unwrap_or(0) as i32;
            let bi = args["bitIndex"].as_i64().unwrap_or(0) as i32;
            let name = args["name"].as_str().unwrap_or("");
            let message = args["message"].as_str().unwrap_or("");
            let message_off = args["messageOff"].as_str().unwrap_or("");
            let enabled = args["enabled"].as_bool().unwrap_or(true);
            let priority = args["priority"].as_i64().unwrap_or(0) as i32;
            let color = args["color"].as_str().unwrap_or("#ffffff");
            let font_size = args["fontSize"].as_i64().unwrap_or(48) as i32;
            let position = args["position"].as_str().unwrap_or("center");
            let font_family = args["fontFamily"].as_str().unwrap_or("Arial Black");
            let font_weight = args["fontWeight"].as_str().unwrap_or("bold");
            let text_shadow = args["textShadow"].as_bool().unwrap_or(true);
            let letter_spacing = args["letterSpacing"].as_i64().unwrap_or(2) as i32;
            let use_template = args["useTemplate"].as_bool().unwrap_or(false);
            let message_template = args["messageTemplate"].as_str().unwrap_or("");
            let action_type = args["actionType"].as_str().unwrap_or("text");
            let video_id = args["videoId"].as_i64();
            db.add_bit_config(wi, bi, name, message, message_off, enabled, priority, color, font_size, position, font_family, font_weight, text_shadow, letter_spacing, use_template, message_template, action_type, video_id).await
                .map(|id| serde_json::json!(id))
                .map_err(|e| e.to_string())
        }
        "update_bit_config" => {
            let wi = args["wordIndex"].as_i64().unwrap_or(0) as i32;
            let bi = args["bitIndex"].as_i64().unwrap_or(0) as i32;
            let name = args["name"].as_str().unwrap_or("");
            let message = args["message"].as_str().unwrap_or("");
            let message_off = args["messageOff"].as_str().unwrap_or("");
            let enabled = args["enabled"].as_bool().unwrap_or(true);
            let priority = args["priority"].as_i64().unwrap_or(0) as i32;
            let color = args["color"].as_str().unwrap_or("#ffffff");
            let font_size = args["fontSize"].as_i64().unwrap_or(48) as i32;
            let position = args["position"].as_str().unwrap_or("center");
            let font_family = args["fontFamily"].as_str().unwrap_or("Arial Black");
            let font_weight = args["fontWeight"].as_str().unwrap_or("bold");
            let text_shadow = args["textShadow"].as_bool().unwrap_or(true);
            let letter_spacing = args["letterSpacing"].as_i64().unwrap_or(2) as i32;
            let use_template = args["useTemplate"].as_bool().unwrap_or(false);
            let message_template = args["messageTemplate"].as_str().unwrap_or("");
            let action_type = args["actionType"].as_str().unwrap_or("text");
            let video_id = args["videoId"].as_i64();
            db.update_bit_config(wi, bi, name, message, message_off, enabled, priority, color, font_size, position, font_family, font_weight, text_shadow, letter_spacing, use_template, message_template, action_type, video_id).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }
        "delete_bit_config" => {
            let wi = args["wordIndex"].as_i64().unwrap_or(0) as i32;
            let bi = args["bitIndex"].as_i64().unwrap_or(0) as i32;
            db.delete_bit_config(wi, bi).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }

        // ── VIDEO CONTROL CONFIG ──
        "get_video_control_config" => {
            let word_index = db.get_display_config("video_control_word_index").await
                .unwrap_or(None)
                .and_then(|v| v.parse::<i32>().ok())
                .unwrap_or(5);
            let bit_index = db.get_display_config("video_control_bit_index").await
                .unwrap_or(None)
                .and_then(|v| v.parse::<i32>().ok())
                .unwrap_or(3);
            Ok(serde_json::json!([word_index, bit_index]))
        }
        "set_video_control_config" => {
            let wi = args["wordIndex"].as_i64().unwrap_or(5) as i32;
            let bi = args["bitIndex"].as_i64().unwrap_or(3) as i32;
            db.set_display_config("video_control_word_index", &wi.to_string(), "number").await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            db.set_display_config("video_control_bit_index", &bi.to_string(), "number").await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            Ok(serde_json::json!("OK"))
        }

        // ── TEXTOS ──
        "get_all_texts" => {
            db.get_all_texts().await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "update_text" => {
            let key = args["key"].as_str().unwrap_or("");
            let text = args["text"].as_str().unwrap_or("");
            db.update_text(key, text).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }

        // ── FASES ──
        "get_all_phases" => {
            db.get_all_phases().await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "get_phase" => {
            let phase_number = args["phaseNumber"].as_i64().unwrap_or(0) as i32;
            db.get_phase(phase_number).await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "update_phase" => {
            let phase_number = args["phaseNumber"].as_i64().unwrap_or(0) as i32;
            let title = args["title"].as_str().unwrap_or("");
            let description = args["description"].as_str().unwrap_or("");
            let color = args["color"].as_str().unwrap_or("#ffffff");
            db.update_phase(phase_number, title, description, color).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }

        // ── LOGS ──
        "get_recent_logs" => {
            let limit = args["limit"].as_i64().unwrap_or(100) as i32;
            db.get_recent_logs(limit).await
                .map(|v| serde_json::to_value(v).unwrap())
                .map_err(|e| e.to_string())
        }
        "add_system_log" => {
            let level = args["level"].as_str().unwrap_or("info");
            let category = args["category"].as_str().unwrap_or("ui");
            let message = args["message"].as_str().unwrap_or("");
            let details = args["details"].as_str().unwrap_or("");
            db.add_system_log(level, category, message, details).await
                .map(|id| serde_json::json!(id))
                .map_err(|e| e.to_string())
        }
        "clear_old_logs" => {
            let days = args["days"].as_i64().unwrap_or(30) as i32;
            db.clear_old_logs(days).await
                .map(|_| serde_json::json!("OK"))
                .map_err(|e| e.to_string())
        }

        // ── TCP / PLC ──
        "get_tcp_stats" => {
            let server_guard = state.tcp_server.lock().await;
            if let Some(server) = server_guard.as_ref() {
                let stats = server.get_connection_stats().await;
                Ok(serde_json::to_value(stats).unwrap())
            } else {
                Ok(serde_json::to_value(ConnectionStats {
                    active_connections: 0,
                    total_connections: 0,
                    last_data_time: 0,
                    server_status: "Parado".to_string(),
                    plc_status: "Desconectado".to_string(),
                }).unwrap())
            }
        }
        "get_connected_plcs" => {
            let server_guard = state.tcp_server.lock().await;
            if let Some(server) = server_guard.as_ref() {
                Ok(serde_json::to_value(server.get_connected_clients().await).unwrap())
            } else {
                Ok(serde_json::json!([]))
            }
        }
        "get_connection_health" => {
            let server_guard = state.tcp_server.lock().await;
            if let Some(server) = server_guard.as_ref() {
                Ok(serde_json::to_value(server.get_connection_health().await).unwrap())
            } else {
                Ok(serde_json::json!([]))
            }
        }
        "get_plc_latest_data" => {
            let ip = args["ip"].as_str().unwrap_or("");
            let server_guard = state.tcp_server.lock().await;
            if let Some(server) = server_guard.as_ref() {
                Ok(serde_json::to_value(server.get_plc_data(ip).await).unwrap())
            } else {
                Ok(serde_json::json!(null))
            }
        }
        "disconnect_plc" => {
            let ip = args["clientIp"].as_str().unwrap_or("");
            let server_guard = state.tcp_server.lock().await;
            if let Some(server) = server_guard.as_ref() {
                server.disconnect_client(ip).await
                    .map(|s| serde_json::json!(s))
                    .map_err(|e| e.to_string())
            } else {
                Err("Servidor TCP não está rodando".to_string())
            }
        }
        "allow_plc_reconnect" => {
            let ip = args["clientIp"].as_str().unwrap_or("");
            let server_guard = state.tcp_server.lock().await;
            if let Some(server) = server_guard.as_ref() {
                server.allow_reconnect(ip).await
                    .map(|s| serde_json::json!(s))
                    .map_err(|e| e.to_string())
            } else {
                Err("Servidor TCP não está rodando".to_string())
            }
        }

        // ── VIDEO SERVER PORT (agora é a porta do próprio web server) ──
        "get_video_server_port" => {
            // Vídeos são servidos pelo mesmo servidor web
            Ok(serde_json::json!(0))
        }

        // ── COMANDOS TAURI-ONLY (não aplicáveis em web) ──
        "open_panel_window" | "close_panel_window" | "init_database" | "get_file_path" => {
            Ok(serde_json::json!("OK"))
        }

        _ => Err(format!("Comando desconhecido: {}", payload.command)),
    };

    match result {
        Ok(value) => Ok(Json(value)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

// ============================================================================
// SSE - PLC DATA STREAM
// ============================================================================

async fn handle_plc_sse(
    State(state): State<Arc<AppState>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.plc_broadcast.subscribe();

    let stream = BroadcastStream::new(rx)
        .filter_map(|msg| {
            match msg {
                Ok(data) => {
                    let payload = serde_json::json!({ "message": data });
                    match Event::default().json_data(payload) {
                        Ok(event) => Some(Ok(event)),
                        Err(_) => None,
                    }
                }
                Err(_) => None,
            }
        });

    Sse::new(stream).keep_alive(KeepAlive::default())
}

// ============================================================================
// VIDEO FILE SERVING (com Range requests para streaming)
// ============================================================================

async fn handle_video(
    axum::extract::Path(path): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Response {
    // Reconstruir path absoluto (o path vem sem a / inicial)
    let file_path = format!("/{}", path);
    let file_path = std::path::Path::new(&file_path);

    if !file_path.exists() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    let file_size = match tokio::fs::metadata(file_path).await {
        Ok(m) => m.len(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Cannot read file").into_response(),
    };

    if file_size == 0 {
        return (StatusCode::NO_CONTENT, "Empty file").into_response();
    }

    let content_type = match file_path.extension().and_then(|e| e.to_str()) {
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mkv") => "video/x-matroska",
        Some("mov") => "video/quicktime",
        Some("avi") => "video/x-msvideo",
        Some("ogg") | Some("ogv") => "video/ogg",
        _ => "application/octet-stream",
    };

    // Parse Range header
    let range = headers.get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    if let Some(range_str) = range {
        // Range request - streaming parcial
        let range_str = range_str.strip_prefix("bytes=").unwrap_or(&range_str);
        let parts: Vec<&str> = range_str.splitn(2, '-').collect();
        let start: u64 = parts[0].parse().unwrap_or(0);
        let end: u64 = parts.get(1)
            .and_then(|v| if v.is_empty() { None } else { v.parse().ok() })
            .unwrap_or_else(|| (start + 2 * 1024 * 1024).min(file_size - 1)) // 2MB chunks
            .min(file_size - 1);
        let length = end - start + 1;

        let file_path_owned = file_path.to_path_buf();
        let stream = async_stream::stream! {
            use tokio::io::{AsyncReadExt, AsyncSeekExt};
            let mut file = match tokio::fs::File::open(&file_path_owned).await {
                Ok(f) => f,
                Err(_) => return,
            };
            let _ = file.seek(std::io::SeekFrom::Start(start)).await;
            let mut remaining = length;
            let mut buf = vec![0u8; 262144]; // 256KB chunks
            while remaining > 0 {
                let to_read = (remaining as usize).min(262144);
                let n = match file.read(&mut buf[..to_read]).await {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(_) => break,
                };
                yield Ok::<_, std::io::Error>(bytes::Bytes::copy_from_slice(&buf[..n]));
                remaining -= n as u64;
            }
        };

        Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, file_size))
            .header(header::CONTENT_LENGTH, length.to_string())
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from_stream(stream))
            .unwrap()
    } else {
        // Full file request
        let file_path_owned = file_path.to_path_buf();
        let stream = async_stream::stream! {
            use tokio::io::AsyncReadExt;
            let mut file = match tokio::fs::File::open(&file_path_owned).await {
                Ok(f) => f,
                Err(_) => return,
            };
            let mut buf = vec![0u8; 262144];
            loop {
                let n = match file.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(_) => break,
                };
                yield Ok::<_, std::io::Error>(bytes::Bytes::copy_from_slice(&buf[..n]));
            }
        };

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CONTENT_LENGTH, file_size.to_string())
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from_stream(stream))
            .unwrap()
    }
}
