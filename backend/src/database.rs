use sqlx::{Pool, Sqlite, SqlitePool, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextConfig {
    pub id: i64,
    pub key: String,
    pub text: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseConfig {
    pub id: i64,
    pub phase_number: i32,
    pub title: String,
    pub description: String,
    pub color: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayConfig {
    pub id: i64,
    pub key: String,
    pub value: String,
    pub data_type: String, // "text", "number", "boolean"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitConfig {
    pub id: i64,
    pub word_index: i32,      // 0-63 (qual WORD)
    pub bit_index: i32,       // 0-15 (qual bit na WORD)
    pub name: String,         // Nome descritivo do bit
    pub message: String,      // Mensagem a exibir quando bit = 1
    pub message_off: String,  // Mensagem a exibir quando bit = 0
    pub enabled: bool,        // Se o bit está ativo para monitoramento
    pub priority: i32,        // Prioridade de exibição (maior = mais importante)
    pub color: String,        // Cor para exibir (#hex)
    pub font_size: i32,       // Tamanho da fonte (em px)
    pub position: String,     // Posição na tela: 'center', 'top', 'bottom'
    pub font_family: String,  // Família da fonte para painel LED
    pub font_weight: String,  // Peso da fonte: 'normal', 'bold', 'black'
    pub text_shadow: bool,    // Ativar sombra no texto
    pub letter_spacing: i32,  // Espaçamento entre letras (px)
    pub use_template: bool,   // Se true, usa message_template com variáveis
    pub message_template: String, // Template com tags {Word[N]}
    pub action_type: String,  // "text" ou "video" - tipo de ação quando bit ativo
    pub video_id: Option<i64>, // ID do vídeo associado (quando action_type = "video")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemLog {
    pub id: i64,
    pub timestamp: String,    // Data/hora do evento
    pub level: String,        // "info", "warning", "error", "critical"
    pub category: String,     // "plc", "tcp", "database", "ui"
    pub message: String,      // Mensagem de log
    pub details: String,      // Detalhes adicionais (JSON, stack trace, etc)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoConfig {
    pub id: i64,
    pub name: String,         // Nome do vÃ­deo
    pub file_path: String,    // Caminho do arquivo
    pub duration: i32,        // DuraÃ§Ã£o em segundos
    pub enabled: bool,        // Se estÃ¡ ativo para exibiÃ§Ã£o
    pub priority: i32,        // Prioridade de exibiÃ§Ã£o
    pub description: String,  // DescriÃ§Ã£o do vÃ­deo
    pub display_order: i32,   // Ordem de exibiÃ§Ã£o
}

pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePool::connect(database_url).await?;
        
        // Criar tabelas
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS text_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                text TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS phase_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phase_number INTEGER UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#ffffff',
                enabled BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS display_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                data_type TEXT NOT NULL DEFAULT 'text',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS bit_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word_index INTEGER NOT NULL,
                bit_index INTEGER NOT NULL,
                name TEXT NOT NULL,
                message TEXT NOT NULL,
                message_off TEXT NOT NULL DEFAULT '',
                enabled BOOLEAN NOT NULL DEFAULT 1,
                priority INTEGER NOT NULL DEFAULT 0,
                color TEXT NOT NULL DEFAULT '#ffffff',
                font_size INTEGER NOT NULL DEFAULT 48,
                position TEXT NOT NULL DEFAULT 'center',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(word_index, bit_index)
            )
            "#,
        )
        .execute(&pool)
        .await?;

        // Migration: Adicionar novos campos para painel LED
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN font_family TEXT NOT NULL DEFAULT 'Arial Black'")
            .execute(&pool)
            .await
            .ok(); // Ignora erro se já existe
            
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN font_weight TEXT NOT NULL DEFAULT 'bold'")
            .execute(&pool)
            .await
            .ok();
            
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN text_shadow BOOLEAN NOT NULL DEFAULT 1")
            .execute(&pool)
            .await
            .ok();
            
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN letter_spacing INTEGER NOT NULL DEFAULT 2")
            .execute(&pool)
            .await
            .ok();

        // Migration: Adicionar campos para templates de variáveis
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN use_template BOOLEAN NOT NULL DEFAULT 0")
            .execute(&pool)
            .await
            .ok();
            
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN message_template TEXT NOT NULL DEFAULT ''")
            .execute(&pool)
            .await
            .ok();

        // Migration: Adicionar campos action_type e video_id para sistema unificado texto/vídeo
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN action_type TEXT NOT NULL DEFAULT 'text'")
            .execute(&pool)
            .await
            .ok();
            
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN video_id INTEGER DEFAULT NULL")
            .execute(&pool)
            .await
            .ok();

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS video_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                duration INTEGER NOT NULL DEFAULT 30,
                enabled BOOLEAN NOT NULL DEFAULT 1,
                priority INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT '',
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await?;

        // Create logs table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL,
                category TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await?;

        // Inserir dados padrão para as fases da eclusa
        let db = Database { pool };
        
        // Migração: Adicionar colunas font_size e position se não existirem
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN font_size INTEGER NOT NULL DEFAULT 48")
            .execute(&db.pool)
            .await
            .ok(); // Ignora erro se coluna já existe
        
        sqlx::query("ALTER TABLE bit_configs ADD COLUMN position TEXT NOT NULL DEFAULT 'center'")
            .execute(&db.pool)
            .await
            .ok(); // Ignora erro se coluna já existe
        
        // Migração: Adicionar coluna display_order se não existir
        sqlx::query("ALTER TABLE video_configs ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0")
            .execute(&db.pool)
            .await
            .ok(); // Ignora erro se coluna já existe
        
        db.insert_default_phases().await?;
        db.insert_default_texts().await?;
        db.insert_default_display_configs().await?;
        db.insert_default_bit_configs().await?;
        // NÃO inserir vídeos de exemplo - usuário quer começar vazio
        // db.insert_default_video_configs().await?;

        Ok(db)
    }

    async fn insert_default_phases(&self) -> Result<(), sqlx::Error> {
        let phases = vec![
            (1, "SEMÃFORO VERMELHO", "SEM ECLUSAGEM", "#ff0000"),
            (2, "SEMÃFORO VERMELHO", "EM PREPARAÃ‡ÃƒO", "#ff0000"),
            (3, "SEMÃFORO VERDE", "AUTORIZAÃ‡ÃƒO ENTRAR - SEM EXCESSO VELOCIDADE", "#00ff00"),
            (4, "SEMÃFORO VERDE", "AUTORIZAÃ‡ÃƒO ENTRAR - COM EXCESSO VELOCIDADE", "#ffff00"),
            (5, "SEMÃFORO VERMELHO", "APÃ“S ENTRADA DO BARCO - PORTA MONTANTE A FECHAR", "#ff0000"),
            (6, "ECLUSAGEM AUTOMÃTICA", "CICLO ECLUSAGEM AUTOMÃTICA MONTANTE", "#0000ff"),
        ];

        for (phase_number, title, description, color) in phases {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO phase_configs (phase_number, title, description, color)
                VALUES (?, ?, ?, ?)
                "#,
            )
            .bind(phase_number)
            .bind(title)
            .bind(description)
            .bind(color)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    async fn insert_default_texts(&self) -> Result<(), sqlx::Error> {
        let texts = vec![
            ("welcome", "Bem-vindos Ã  Eclusa de NavegaÃ§Ã£o"),
            ("speed_limit", "Velocidade MÃ¡xima: 5 km/h"),
            ("safety", "NavegaÃ§Ã£o Segura - Respeite as SinalizaÃ§Ãµes"),
            ("advertising_edp", "Publicidade EDP - Energia Limpa"),
        ];

        for (key, text) in texts {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO text_configs (key, text)
                VALUES (?, ?)
                "#,
            )
            .bind(key)
            .bind(text)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    async fn insert_default_display_configs(&self) -> Result<(), sqlx::Error> {
        let configs = vec![
            ("panel_title", "Eclusa de NavegaÃ§Ã£o - RÃ©gua Portugal", "text"),
            ("max_speed", "5.0", "number"),
            ("distance_units", "metros", "text"),
            ("speed_units", "km/h", "text"),
            ("show_advertising", "true", "boolean"),
            ("advertising_interval", "30", "number"),
            ("video_control_word_index", "5", "number"),  // Word do PLC que controla os vídeos
            ("video_control_bit_index", "3", "number"),   // Bit do PLC que controla os vídeos
        ];

        for (key, value, data_type) in configs {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO display_configs (key, value, data_type)
                VALUES (?, ?, ?)
                "#,
            )
            .bind(key)
            .bind(value)
            .bind(data_type)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    async fn insert_default_bit_configs(&self) -> Result<(), sqlx::Error> {
        let bits = vec![
            // WORD 0 - Estados principais da eclusa
            (0, 0, "ECLUSA_ATIVA", "ECLUSA EM OPERAÃ‡ÃƒO", "ECLUSA INATIVA", true, 100, "#00ff00"),
            (0, 1, "EMERGENCIA", "EMERGÃŠNCIA ATIVADA", "SISTEMA NORMAL", true, 200, "#ff0000"),
            (0, 2, "MANUTENCAO", "MODO MANUTENÃ‡ÃƒO", "MODO AUTOMÃTICO", true, 150, "#ffaa00"),
            (0, 3, "PORTA_MONTANTE_ABERTA", "PORTA MONTANTE ABERTA", "PORTA MONTANTE FECHADA", true, 80, "#00aaff"),
            (0, 4, "PORTA_JUSANTE_ABERTA", "PORTA JUSANTE ABERTA", "PORTA JUSANTE FECHADA", true, 80, "#00aaff"),
            
            // WORD 1 - Sensores de presenÃ§a
            (1, 0, "BARCO_PRESENTE_MONTANTE", "EMBARCAÃ‡ÃƒO DETECTADA - MONTANTE", "SEM EMBARCAÃ‡ÃƒO - MONTANTE", true, 90, "#ffff00"),
            (1, 1, "BARCO_PRESENTE_CALDEIRA", "EMBARCAÃ‡ÃƒO NA CALDEIRA", "CALDEIRA LIVRE", true, 95, "#ff8800"),
            (1, 2, "BARCO_PRESENTE_JUSANTE", "EMBARCAÃ‡ÃƒO DETECTADA - JUSANTE", "SEM EMBARCAÃ‡ÃƒO - JUSANTE", true, 90, "#ffff00"),
            
            // WORD 2 - Velocidades e seguranÃ§a
            (2, 0, "EXCESSO_VELOCIDADE_MONTANTE", "EXCESSO VELOCIDADE - MONTANTE", "VELOCIDADE NORMAL - MONTANTE", true, 120, "#ff4400"),
            (2, 1, "EXCESSO_VELOCIDADE_CALDEIRA", "EXCESSO VELOCIDADE - CALDEIRA", "VELOCIDADE NORMAL - CALDEIRA", true, 120, "#ff4400"),
            (2, 2, "SEMAFORO_VERMELHO", "SEMÃFORO VERMELHO - PARE", "SEMÃFORO LIVRE", true, 110, "#ff0000"),
            (2, 3, "SEMAFORO_VERDE", "SEMÃFORO VERDE - PROSSIGA", "SEMÃFORO BLOQUEADO", true, 110, "#00ff00"),
            
            // WORD 3 - Sistemas auxiliares
            (3, 0, "BOMBA_AGUA_LIGADA", "BOMBA D'ÃGUA ATIVADA", "BOMBA D'ÃGUA DESLIGADA", true, 60, "#0088ff"),
            (3, 1, "NIVEL_AGUA_ALTO", "NÃVEL D'ÃGUA ALTO", "NÃVEL D'ÃGUA BAIXO", true, 70, "#0044ff"),
            (3, 2, "ILUMINACAO_LIGADA", "ILUMINAÃ‡ÃƒO ATIVADA", "ILUMINAÃ‡ÃƒO DESLIGADA", true, 30, "#ffff88"),
        ];

        for (word_index, bit_index, name, message, message_off, enabled, priority, color) in bits {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO bit_configs (word_index, bit_index, name, message, message_off, enabled, priority, color, font_size, position)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 48, 'center')
                "#,
            )
            .bind(word_index)
            .bind(bit_index)
            .bind(name)
            .bind(message)
            .bind(message_off)
            .bind(enabled)
            .bind(priority)
            .bind(color)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    async fn insert_default_video_configs(&self) -> Result<(), sqlx::Error> {
        let videos = vec![
            ("Publicidade EDP Verde", "videos/edp_verde.mp4", 30, true, 10, "Energia renovÃ¡vel e sustentÃ¡vel da EDP"),
            ("SeguranÃ§a NavegaÃ§Ã£o", "videos/seguranca.mp4", 25, true, 20, "InstruÃ§Ãµes de seguranÃ§a para navegaÃ§Ã£o na eclusa"),
            ("Turismo RÃ©gua", "videos/turismo_regua.mp4", 45, true, 5, "PromoÃ§Ã£o turÃ­stica da regiÃ£o de RÃ©gua"),
        ];

        for (name, file_path, duration, enabled, priority, description) in videos {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO video_configs (name, file_path, duration, enabled, priority, description)
                VALUES (?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(name)
            .bind(file_path)
            .bind(duration)
            .bind(enabled)
            .bind(priority)
            .bind(description)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    // MÃ©todos para gerenciar textos
    pub async fn get_all_texts(&self) -> Result<Vec<TextConfig>, sqlx::Error> {
        let rows = sqlx::query("SELECT id, key, text, enabled FROM text_configs ORDER BY key")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows.into_iter().map(|row| TextConfig {
            id: row.get("id"),
            key: row.get("key"),
            text: row.get("text"),
            enabled: row.get::<i64, _>("enabled") != 0,
        }).collect())
    }

    pub async fn update_text(&self, key: &str, text: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE text_configs 
            SET text = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE key = ?
            "#,
        )
        .bind(text)
        .bind(key)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    // MÃ©todos para gerenciar fases
    pub async fn get_all_phases(&self) -> Result<Vec<PhaseConfig>, sqlx::Error> {
        let rows = sqlx::query("SELECT id, phase_number, title, description, color, enabled FROM phase_configs ORDER BY phase_number")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows.into_iter().map(|row| PhaseConfig {
            id: row.get("id"),
            phase_number: row.get("phase_number"),
            title: row.get("title"),
            description: row.get("description"),
            color: row.get("color"),
            enabled: row.get::<i64, _>("enabled") != 0,
        }).collect())
    }

    pub async fn get_phase(&self, phase_number: i32) -> Result<Option<PhaseConfig>, sqlx::Error> {
        let row = sqlx::query("SELECT id, phase_number, title, description, color, enabled FROM phase_configs WHERE phase_number = ?")
            .bind(phase_number)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|r| PhaseConfig {
            id: r.get("id"),
            phase_number: r.get("phase_number"),
            title: r.get("title"),
            description: r.get("description"),
            color: r.get("color"),
            enabled: r.get::<i64, _>("enabled") != 0,
        }))
    }

    pub async fn update_phase(&self, phase_number: i32, title: &str, description: &str, color: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE phase_configs 
            SET title = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE phase_number = ?
            "#,
        )
        .bind(title)
        .bind(description)
        .bind(color)
        .bind(phase_number)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    // MÃ©todos para configuraÃ§Ãµes de display
    pub async fn get_display_config(&self, key: &str) -> Result<Option<String>, sqlx::Error> {
        let result = sqlx::query("SELECT value FROM display_configs WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;

        Ok(result.map(|r| r.get("value")))
    }

    pub async fn set_display_config(&self, key: &str, value: &str, data_type: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO display_configs (key, value, data_type, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            "#,
        )
        .bind(key)
        .bind(value)
        .bind(data_type)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    pub async fn get_all_display_configs(&self) -> Result<Vec<DisplayConfig>, sqlx::Error> {
        let rows = sqlx::query("SELECT id, key, value, data_type FROM display_configs ORDER BY key")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows.into_iter().map(|row| DisplayConfig {
            id: row.get("id"),
            key: row.get("key"),
            value: row.get("value"),
            data_type: row.get("data_type"),
        }).collect())
    }

    // MÃ©todos para gerenciar configuraÃ§Ãµes de bits
    pub async fn get_all_bit_configs(&self) -> Result<Vec<BitConfig>, sqlx::Error> {
        let rows = sqlx::query("SELECT id, word_index, bit_index, name, message, message_off, enabled, priority, color, font_size, position, COALESCE(font_family, 'Arial Black') as font_family, COALESCE(font_weight, 'bold') as font_weight, COALESCE(text_shadow, 1) as text_shadow, COALESCE(letter_spacing, 2) as letter_spacing, COALESCE(use_template, 0) as use_template, COALESCE(message_template, '') as message_template, COALESCE(action_type, 'text') as action_type, video_id FROM bit_configs ORDER BY word_index, bit_index")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows.into_iter().map(|row| BitConfig {
            id: row.get("id"),
            word_index: row.get("word_index"),
            bit_index: row.get("bit_index"),
            name: row.get("name"),
            message: row.get("message"),
            message_off: row.get("message_off"),
            enabled: row.get::<i64, _>("enabled") != 0,
            priority: row.get("priority"),
            color: row.get("color"),
            font_size: row.get("font_size"),
            position: row.get("position"),
            font_family: row.get("font_family"),
            font_weight: row.get("font_weight"),
            text_shadow: row.get::<i64, _>("text_shadow") != 0,
            letter_spacing: row.get("letter_spacing"),
            use_template: row.get::<i64, _>("use_template") != 0,
            message_template: row.get("message_template"),
            action_type: row.get("action_type"),
            video_id: row.try_get::<i64, _>("video_id").ok(),
        }).collect())
    }

    pub async fn get_bit_config(&self, word_index: i32, bit_index: i32) -> Result<Option<BitConfig>, sqlx::Error> {
        let row = sqlx::query("SELECT id, word_index, bit_index, name, message, message_off, enabled, priority, color, font_size, position, COALESCE(font_family, 'Arial Black') as font_family, COALESCE(font_weight, 'bold') as font_weight, COALESCE(text_shadow, 1) as text_shadow, COALESCE(letter_spacing, 2) as letter_spacing, COALESCE(use_template, 0) as use_template, COALESCE(message_template, '') as message_template, COALESCE(action_type, 'text') as action_type, video_id FROM bit_configs WHERE word_index = ? AND bit_index = ?")
            .bind(word_index)
            .bind(bit_index)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|r| BitConfig {
            id: r.get("id"),
            word_index: r.get("word_index"),
            bit_index: r.get("bit_index"),
            name: r.get("name"),
            message: r.get("message"),
            message_off: r.get("message_off"),
            enabled: r.get::<i64, _>("enabled") != 0,
            priority: r.get("priority"),
            color: r.get("color"),
            font_size: r.get("font_size"),
            position: r.get("position"),
            font_family: r.get("font_family"),
            font_weight: r.get("font_weight"),
            text_shadow: r.get::<i64, _>("text_shadow") != 0,
            letter_spacing: r.get("letter_spacing"),
            use_template: r.get::<i64, _>("use_template") != 0,
            message_template: r.get("message_template"),
            action_type: r.get("action_type"),
            video_id: r.try_get::<i64, _>("video_id").ok(),
        }))
    }

    pub async fn add_bit_config(&self, word_index: i32, bit_index: i32, name: &str, message: &str, message_off: &str, enabled: bool, priority: i32, color: &str, font_size: i32, position: &str, font_family: &str, font_weight: &str, text_shadow: bool, letter_spacing: i32, use_template: bool, message_template: &str, action_type: &str, video_id: Option<i64>) -> Result<i64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            INSERT INTO bit_configs (word_index, bit_index, name, message, message_off, enabled, priority, color, font_size, position, font_family, font_weight, text_shadow, letter_spacing, use_template, message_template, action_type, video_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(word_index)
        .bind(bit_index)
        .bind(name)
        .bind(message)
        .bind(message_off)
        .bind(enabled as i64)
        .bind(priority)
        .bind(color)
        .bind(font_size)
        .bind(position)
        .bind(font_family)
        .bind(font_weight)
        .bind(text_shadow as i64)
        .bind(letter_spacing)
        .bind(use_template as i64)
        .bind(message_template)
        .bind(action_type)
        .bind(video_id)
        .execute(&self.pool)
        .await?;
        
        Ok(result.last_insert_rowid())
    }

    pub async fn update_bit_config(&self, word_index: i32, bit_index: i32, name: &str, message: &str, message_off: &str, enabled: bool, priority: i32, color: &str, font_size: i32, position: &str, font_family: &str, font_weight: &str, text_shadow: bool, letter_spacing: i32, use_template: bool, message_template: &str, action_type: &str, video_id: Option<i64>) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE bit_configs 
            SET name = ?, message = ?, message_off = ?, enabled = ?, priority = ?, color = ?, font_size = ?, position = ?, font_family = ?, font_weight = ?, text_shadow = ?, letter_spacing = ?, use_template = ?, message_template = ?, action_type = ?, video_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE word_index = ? AND bit_index = ?
            "#,
        )
        .bind(name)
        .bind(message)
        .bind(message_off)
        .bind(enabled as i64)
        .bind(priority)
        .bind(color)
        .bind(font_size)
        .bind(position)
        .bind(font_family)
        .bind(font_weight)
        .bind(text_shadow as i64)
        .bind(letter_spacing)
        .bind(use_template as i64)
        .bind(message_template)
        .bind(action_type)
        .bind(video_id)
        .bind(word_index)
        .bind(bit_index)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    pub async fn delete_bit_config(&self, word_index: i32, bit_index: i32) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM bit_configs WHERE word_index = ? AND bit_index = ?")
            .bind(word_index)
            .bind(bit_index)
            .execute(&self.pool)
            .await?;
        
        Ok(())
    }

    // MÃ©todo para processar dados PLC e retornar mensagens ativas baseadas nos bits
    pub async fn process_plc_bits(&self, word_data: &[u16]) -> Result<Vec<(BitConfig, bool)>, sqlx::Error> {
        let bit_configs = self.get_all_bit_configs().await?;
        let mut active_bits = Vec::new();

        for bit_config in bit_configs {
            if !bit_config.enabled || bit_config.word_index < 0 || bit_config.word_index >= word_data.len() as i32 {
                continue;
            }

            let word_value = word_data[bit_config.word_index as usize];
            let bit_value = (word_value >> bit_config.bit_index) & 1 == 1;
            
            active_bits.push((bit_config, bit_value));
        }

        // Ordenar por prioridade (maior prioridade primeiro)
        active_bits.sort_by(|a, b| b.0.priority.cmp(&a.0.priority));
        
        Ok(active_bits)
    }

    // MÃ©todos para gerenciar vÃ­deos
    pub async fn get_all_videos(&self) -> Result<Vec<VideoConfig>, sqlx::Error> {
        let rows = sqlx::query("SELECT id, name, file_path, duration, enabled, priority, description, COALESCE(display_order, 0) as display_order FROM video_configs ORDER BY display_order, priority DESC, name")
            .fetch_all(&self.pool)
            .await?;

        Ok(rows.into_iter().map(|row| VideoConfig {
            id: row.get("id"),
            name: row.get("name"),
            file_path: row.get("file_path"),
            duration: row.get("duration"),
            enabled: row.get::<i64, _>("enabled") != 0,
            priority: row.get("priority"),
            description: row.get("description"),
            display_order: row.get("display_order"),
        }).collect())
    }

    pub async fn get_video(&self, id: i64) -> Result<Option<VideoConfig>, sqlx::Error> {
        let row = sqlx::query("SELECT id, name, file_path, duration, enabled, priority, description, COALESCE(display_order, 0) as display_order FROM video_configs WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|r| VideoConfig {
            id: r.get("id"),
            name: r.get("name"),
            file_path: r.get("file_path"),
            duration: r.get("duration"),
            enabled: r.get::<i64, _>("enabled") != 0,
            priority: r.get("priority"),
            description: r.get("description"),
            display_order: r.get("display_order"),
        }))
    }

    pub async fn add_video(&self, name: &str, file_path: &str, duration: i32, enabled: bool, priority: i32, description: &str) -> Result<i64, sqlx::Error> {
        println!("🗄️ [DB] add_video: name='{}', file_path='{}', duration={}, enabled={}, priority={}, description='{}'", 
            name, file_path, duration, enabled, priority, description);
        
        // Obter o próximo display_order
        let next_order = sqlx::query("SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM video_configs")
            .fetch_one(&self.pool)
            .await?
            .get::<i32, _>("next_order");
        
        let result = sqlx::query(
            r#"
            INSERT INTO video_configs (name, file_path, duration, enabled, priority, description, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(name)
        .bind(file_path)
        .bind(duration)
        .bind(enabled as i64)
        .bind(priority)
        .bind(description)
        .bind(next_order)
        .execute(&self.pool)
        .await?;
        
        let id = result.last_insert_rowid();
        println!("✅ [DB] Vídeo inserido com ID: {} e ordem: {}", id, next_order);
        Ok(id)
    }

    pub async fn update_video(&self, id: i64, name: &str, file_path: &str, duration: i32, enabled: bool, priority: i32, description: &str, display_order: i32) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE video_configs 
            SET name = ?, file_path = ?, duration = ?, enabled = ?, priority = ?, description = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
            "#,
        )
        .bind(name)
        .bind(file_path)
        .bind(duration)
        .bind(enabled as i64)
        .bind(priority)
        .bind(description)
        .bind(display_order)
        .bind(id)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    pub async fn delete_video(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM video_configs WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        
        Ok(())
    }

    pub async fn get_enabled_videos(&self) -> Result<Vec<VideoConfig>, sqlx::Error> {
        println!("🎬 [DB] get_enabled_videos chamado");
        let rows = sqlx::query("SELECT id, name, file_path, duration, enabled, priority, description, COALESCE(display_order, 0) as display_order FROM video_configs WHERE enabled = 1 ORDER BY display_order, priority DESC, name")
            .fetch_all(&self.pool)
            .await?;

        let videos: Vec<VideoConfig> = rows.into_iter().map(|row| VideoConfig {
            id: row.get("id"),
            name: row.get("name"),
            file_path: row.get("file_path"),
            duration: row.get("duration"),
            enabled: row.get::<i64, _>("enabled") != 0,
            priority: row.get("priority"),
            description: row.get("description"),
            display_order: row.get("display_order"),
        }).collect();
        
        println!("✅ [DB] get_enabled_videos retornando {} vídeos", videos.len());
        for video in &videos {
            println!("   📹 [DB] - {} ({}s) - enabled: {}", video.name, video.duration, video.enabled);
        }
        
        Ok(videos)
    }

    pub async fn clear_all_videos(&self) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM video_configs")
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn reorder_video(&self, id: i64, new_order: i32) -> Result<(), sqlx::Error> {
        println!("🔄 [DB] Reordenando vídeo ID={} para ordem={}", id, new_order);
        
        sqlx::query(
            r#"
            UPDATE video_configs 
            SET display_order = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
            "#,
        )
        .bind(new_order)
        .bind(id)
        .execute(&self.pool)
        .await?;
        
        println!("✅ [DB] Vídeo reordenado com sucesso");
        Ok(())
    }

    // Função para verificar se os vídeos devem ser exibidos baseado no bit PLC
    pub async fn should_show_videos(&self, plc_data: &[u16]) -> Result<bool, sqlx::Error> {
        // Obter configurações do bit de controle
        let word_index = self.get_display_config("video_control_word_index").await?
            .and_then(|v| v.parse::<i32>().ok())
            .unwrap_or(5); // Default: Word[5]
            
        let bit_index = self.get_display_config("video_control_bit_index").await?
            .and_then(|v| v.parse::<i32>().ok())
            .unwrap_or(3); // Default: Bit 3
        
        // Verificar se o índice da word é válido
        if word_index < 0 || word_index as usize >= plc_data.len() {
            return Ok(false);
        }
        
        // Obter valor do bit
        let word_value = plc_data[word_index as usize];
        let bit_value = (word_value >> bit_index) & 1 == 1;
        
        Ok(bit_value)
    }

    // Função para obter vídeos habilitados para exibição
    pub async fn get_videos_for_display(&self, plc_data: &[u16]) -> Result<Vec<VideoConfig>, sqlx::Error> {
        if self.should_show_videos(plc_data).await? {
            self.get_enabled_videos().await
        } else {
            Ok(Vec::new())
        }
    }

    // ===== SISTEMA DE LOGS =====
    pub async fn add_system_log(
        &self, 
        level: &str, 
        category: &str, 
        message: &str, 
        details: &str
    ) -> Result<i64, sqlx::Error> {
        let timestamp = chrono::Utc::now().to_rfc3339();
        
        let result = sqlx::query(
            "INSERT INTO system_logs (timestamp, level, category, message, details) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&timestamp)
        .bind(level)
        .bind(category)
        .bind(message)
        .bind(details)
        .execute(&self.pool)
        .await?;
        
        Ok(result.last_insert_rowid())
    }

    pub async fn get_recent_logs(&self, limit: i32) -> Result<Vec<SystemLog>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM system_logs ORDER BY id DESC LIMIT ?")
            .bind(limit)
            .fetch_all(&self.pool)
            .await?;

        let mut logs = Vec::new();
        for row in rows {
            logs.push(SystemLog {
                id: row.get("id"),
                timestamp: row.get("timestamp"),
                level: row.get("level"),
                category: row.get("category"),
                message: row.get("message"),
                details: row.get("details"),
            });
        }

        Ok(logs)
    }

    pub async fn get_logs_by_level(&self, level: &str, limit: i32) -> Result<Vec<SystemLog>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM system_logs WHERE level = ? ORDER BY id DESC LIMIT ?")
            .bind(level)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?;

        let mut logs = Vec::new();
        for row in rows {
            logs.push(SystemLog {
                id: row.get("id"),
                timestamp: row.get("timestamp"),
                level: row.get("level"),
                category: row.get("category"),
                message: row.get("message"),
                details: row.get("details"),
            });
        }

        Ok(logs)
    }

    pub async fn clear_old_logs(&self, days: i32) -> Result<(), sqlx::Error> {
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let cutoff_str = cutoff.to_rfc3339();
        
        sqlx::query("DELETE FROM system_logs WHERE timestamp < ?")
            .bind(&cutoff_str)
            .execute(&self.pool)
            .await?;
            
        Ok(())
    }
}