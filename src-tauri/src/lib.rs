mod commands;
mod ollama_manager;

use commands::rag::RagState;
use ollama_manager::OllamaState;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

const META_DB_FILE: &str = "index.db";
const AUTOSAVE_DB_FILE: &str = "autosave.db";
const LEGACY_DB_FILE: &str = "lol_esports_manager.db";

fn known_database_files() -> Vec<String> {
    let mut files = vec![
        META_DB_FILE.to_string(),
        AUTOSAVE_DB_FILE.to_string(),
        LEGACY_DB_FILE.to_string(),
    ];
    for slot in 1..=10 {
        files.push(format!("slot_{}.db", slot));
    }
    files
}

fn game_database_files(file_name: &str) -> Vec<String> {
    vec![
        file_name.to_string(),
        format!("{}-wal", file_name),
        format!("{}-shm", file_name),
    ]
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    Ok(data_dir)
}

fn build_migrations() -> Vec<Migration> {
    vec![
        Migration { version: 1, description: "create initial tables", sql: include_str!("../migrations/001_initial.sql"), kind: MigrationKind::Up },
        Migration { version: 2, description: "add division column to players", sql: include_str!("../migrations/002_add_division.sql"), kind: MigrationKind::Up },
        Migration { version: 3, description: "create champions and patch tables", sql: include_str!("../migrations/003_champions.sql"), kind: MigrationKind::Up },
        Migration { version: 4, description: "add daily calendar and condition tables", sql: include_str!("../migrations/004_daily_calendar.sql"), kind: MigrationKind::Up },
        Migration { version: 5, description: "add performance indexes", sql: include_str!("../migrations/005_add_indexes.sql"), kind: MigrationKind::Up },
        Migration { version: 6, description: "create player traits table", sql: include_str!("../migrations/006_player_traits.sql"), kind: MigrationKind::Up },
        Migration { version: 7, description: "create team finance log table", sql: include_str!("../migrations/007_team_finances.sql"), kind: MigrationKind::Up },
        Migration { version: 8, description: "add playoff columns to matches", sql: include_str!("../migrations/008_playoff.sql"), kind: MigrationKind::Up },
        Migration { version: 9, description: "create transfer offers table", sql: include_str!("../migrations/009_transfer_market.sql"), kind: MigrationKind::Up },
        Migration { version: 10, description: "create tournaments tables", sql: include_str!("../migrations/010_tournaments.sql"), kind: MigrationKind::Up },
        Migration { version: 11, description: "create sponsors table", sql: include_str!("../migrations/011_sponsors.sql"), kind: MigrationKind::Up },
        Migration { version: 12, description: "create player relations table", sql: include_str!("../migrations/012_player_relations.sql"), kind: MigrationKind::Up },
        Migration { version: 13, description: "add swiss records and fearless draft", sql: include_str!("../migrations/013_tournament_expansion.sql"), kind: MigrationKind::Up },
        Migration { version: 14, description: "create player game stats table", sql: include_str!("../migrations/014_player_game_stats.sql"), kind: MigrationKind::Up },
        Migration { version: 15, description: "add play style column to teams", sql: include_str!("../migrations/015_team_play_style.sql"), kind: MigrationKind::Up },
        Migration { version: 16, description: "scouting system", sql: include_str!("../migrations/016_scouting.sql"), kind: MigrationKind::Up },
        Migration { version: 17, description: "training system", sql: include_str!("../migrations/017_training.sql"), kind: MigrationKind::Up },
        Migration { version: 18, description: "staff system", sql: include_str!("../migrations/018_staff.sql"), kind: MigrationKind::Up },
        Migration { version: 19, description: "board expectations", sql: include_str!("../migrations/019_board_expectations.sql"), kind: MigrationKind::Up },
        Migration { version: 20, description: "tactics system", sql: include_str!("../migrations/020_tactics.sql"), kind: MigrationKind::Up },
        Migration { version: 21, description: "awards system", sql: include_str!("../migrations/021_awards.sql"), kind: MigrationKind::Up },
        Migration { version: 22, description: "create academy and rookie draft tables", sql: include_str!("../migrations/022_academy.sql"), kind: MigrationKind::Up },
        Migration { version: 23, description: "create news articles table", sql: include_str!("../migrations/023_news_system.sql"), kind: MigrationKind::Up },
        Migration { version: 24, description: "player complaints", sql: include_str!("../migrations/024_player_complaints.sql"), kind: MigrationKind::Up },
        Migration { version: 25, description: "save slots", sql: include_str!("../migrations/025_save_slots.sql"), kind: MigrationKind::Up },
        Migration { version: 26, description: "records system", sql: include_str!("../migrations/026_records.sql"), kind: MigrationKind::Up },
        Migration { version: 27, description: "facilities system", sql: include_str!("../migrations/027_facilities.sql"), kind: MigrationKind::Up },
        Migration { version: 28, description: "staff free agent support", sql: include_str!("../migrations/028_staff_fa.sql"), kind: MigrationKind::Up },
        Migration { version: 29, description: "social reactions system", sql: include_str!("../migrations/029_social_reactions.sql"), kind: MigrationKind::Up },
        Migration { version: 30, description: "rivalry system", sql: include_str!("../migrations/030_rivalry.sql"), kind: MigrationKind::Up },
        Migration { version: 31, description: "create manager profiles table", sql: include_str!("../migrations/031_manager_profile.sql"), kind: MigrationKind::Up },
        Migration { version: 32, description: "injuries system", sql: include_str!("../migrations/032_injuries.sql"), kind: MigrationKind::Up },
        Migration { version: 33, description: "retirement system", sql: include_str!("../migrations/033_retirement.sql"), kind: MigrationKind::Up },
        Migration { version: 34, description: "create offseason state table", sql: include_str!("../migrations/034_offseason.sql"), kind: MigrationKind::Up },
        Migration { version: 35, description: "create player goals table", sql: include_str!("../migrations/035_player_goals.sql"), kind: MigrationKind::Up },
        Migration { version: 36, description: "create player agents table", sql: include_str!("../migrations/036_agents.sql"), kind: MigrationKind::Up },
        Migration { version: 37, description: "create league nationality rules table", sql: include_str!("../migrations/037_nationality_rules.sql"), kind: MigrationKind::Up },
        Migration { version: 38, description: "team talks system", sql: include_str!("../migrations/038_team_talks.sql"), kind: MigrationKind::Up },
        Migration { version: 39, description: "promises system", sql: include_str!("../migrations/039_promises.sql"), kind: MigrationKind::Up },
        Migration { version: 40, description: "board requests", sql: include_str!("../migrations/040_board_requests.sql"), kind: MigrationKind::Up },
        Migration { version: 41, description: "buyout personality inbox", sql: include_str!("../migrations/041_buyout_personality_inbox.sql"), kind: MigrationKind::Up },
        Migration { version: 42, description: "mentoring system", sql: include_str!("../migrations/042_mentoring.sql"), kind: MigrationKind::Up },
        Migration { version: 43, description: "ownership system", sql: include_str!("../migrations/043_ownership.sql"), kind: MigrationKind::Up },
        Migration { version: 44, description: "contract clauses", sql: include_str!("../migrations/044_contract_clauses.sql"), kind: MigrationKind::Up },
        Migration { version: 45, description: "career chemistry form history", sql: include_str!("../migrations/045_career_chemistry_form.sql"), kind: MigrationKind::Up },
        Migration { version: 46, description: "lol esports systems", sql: include_str!("../migrations/046_lol_esports_systems.sql"), kind: MigrationKind::Up },
        Migration { version: 47, description: "advanced systems", sql: include_str!("../migrations/047_advanced_systems.sql"), kind: MigrationKind::Up },
        Migration { version: 48, description: "contract negotiations", sql: include_str!("../migrations/048_contract_negotiations.sql"), kind: MigrationKind::Up },
        Migration { version: 49, description: "missing tables fix", sql: include_str!("../migrations/049_missing_tables.sql"), kind: MigrationKind::Up },
        Migration { version: 50, description: "create achievements table", sql: include_str!("../migrations/050_achievements.sql"), kind: MigrationKind::Up },
        Migration { version: 51, description: "add rng seed to save metadata", sql: include_str!("../migrations/051_rng_seed.sql"), kind: MigrationKind::Up },
        Migration { version: 52, description: "add secondary position to players", sql: include_str!("../migrations/052_secondary_position.sql"), kind: MigrationKind::Up },
        Migration { version: 53, description: "add philosophy and nationality to staff", sql: include_str!("../migrations/053_staff_philosophy_nationality.sql"), kind: MigrationKind::Up },
        Migration { version: 54, description: "add training activity column", sql: include_str!("../migrations/054_training_activity.sql"), kind: MigrationKind::Up },
        Migration { version: 55, description: "add manager interventions", sql: include_str!("../migrations/055_manager_interventions.sql"), kind: MigrationKind::Up },
        Migration { version: 56, description: "add manager philosophy columns", sql: include_str!("../migrations/056_manager_philosophy.sql"), kind: MigrationKind::Up },
        Migration { version: 57, description: "add staff role preference columns", sql: include_str!("../migrations/057_staff_role_preferences.sql"), kind: MigrationKind::Up },
        Migration { version: 58, description: "add save db file metadata", sql: include_str!("../migrations/058_save_db_files.sql"), kind: MigrationKind::Up },
        Migration { version: 59, description: "detach save metadata foreign keys", sql: include_str!("../migrations/059_save_metadata_detach_foreign_keys.sql"), kind: MigrationKind::Up },
        Migration { version: 60, description: "phase 2 system depth", sql: include_str!("../migrations/060_phase2_system_depth.sql"), kind: MigrationKind::Up },
        Migration { version: 61, description: "release depth systems", sql: include_str!("../migrations/061_release_depth.sql"), kind: MigrationKind::Up },
        Migration { version: 62, description: "persist news narrative tags", sql: include_str!("../migrations/062_news_narrative_tags.sql"), kind: MigrationKind::Up },
    ]
}

fn delete_database_files(base_dir: &Path, file_name: &str) -> Result<(), String> {
    for file in game_database_files(file_name) {
        let path = base_dir.join(file);
        if path.exists() {
            let mut last_error: Option<String> = None;
            let mut removed = false;

            for attempt in 0..4 {
                match fs::remove_file(&path) {
                    Ok(_) => {
                        removed = true;
                        break;
                    }
                    Err(err) => {
                        last_error = Some(err.to_string());
                        if attempt == 3 {
                            break;
                        }
                        thread::sleep(Duration::from_millis(100 * (attempt + 1) as u64));
                    }
                }
            }

            if !removed && path.exists() {
                return Err(last_error.unwrap_or_else(|| format!("failed to delete {:?}", path)));
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn mark_db_for_reset(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    fs::write(data_dir.join("db_reset_marker"), "reset").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn copy_game_database_files(
    app: tauri::AppHandle,
    source_file_name: String,
    target_file_name: String,
) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    let source_path = data_dir.join(&source_file_name);

    if !source_path.exists() {
        return Err(format!("source DB does not exist: {}", source_file_name));
    }

    delete_database_files(&data_dir, &target_file_name)?;
    fs::copy(&source_path, data_dir.join(&target_file_name)).map_err(|e| e.to_string())?;

    let source_wal = data_dir.join(format!("{}-wal", source_file_name));
    if source_wal.exists() {
        fs::copy(&source_wal, data_dir.join(format!("{}-wal", target_file_name))).map_err(|e| e.to_string())?;
    }

    let source_shm = data_dir.join(format!("{}-shm", source_file_name));
    if source_shm.exists() {
        fs::copy(&source_shm, data_dir.join(format!("{}-shm", target_file_name))).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn delete_game_database_files(app: tauri::AppHandle, file_name: String) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    delete_database_files(&data_dir, &file_name)
}

#[tauri::command]
fn game_database_exists(app: tauri::AppHandle, file_name: String) -> Result<bool, String> {
    let data_dir = app_data_dir(&app)?;
    Ok(data_dir.join(file_name).exists())
}

fn check_db_reset_marker() {
    let app_data = if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("com.lolesportsmanager.app"))
    } else if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join("Library/Application Support/com.lolesportsmanager.app"))
    } else {
        std::env::var("XDG_DATA_HOME")
            .or_else(|_| std::env::var("HOME").map(|h| format!("{}/.local/share", h)))
            .ok()
            .map(|p| PathBuf::from(p).join("com.lolesportsmanager.app"))
    };

    if let Some(dir) = app_data {
        let marker = dir.join("db_reset_marker");
        if marker.exists() {
            eprintln!("[DB] reset marker detected. clearing database files.");
            for file_name in known_database_files() {
                let _ = delete_database_files(&dir, &file_name);
            }
            let _ = fs::remove_file(marker);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    check_db_reset_marker();

    let mut sql_builder = tauri_plugin_sql::Builder::default();
    for file_name in known_database_files() {
        sql_builder = sql_builder.add_migrations(&format!("sqlite:{}", file_name), build_migrations());
    }

    tauri::Builder::default()
        .plugin(sql_builder.build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(OllamaState {
            process: Mutex::new(None),
            detail: Mutex::new(Default::default()),
        })
        .manage(RagState::default())
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("app local data dir not found")
                .join("salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::llm::check_ollama_status,
            commands::llm::chat_with_llm,
            commands::llm::chat_with_openai,
            commands::llm::chat_with_claude,
            commands::llm::chat_with_gemini,
            commands::llm::chat_with_grok,
            commands::rag::initialize_rag,
            commands::rag::search_knowledge,
            commands::rag::get_rag_status,
            ollama_manager::get_ollama_status_detail,
            ollama_manager::ensure_ollama_ready,
            ollama_manager::start_ollama_runtime,
            ollama_manager::pull_model,
            ollama_manager::list_models,
            ollama_manager::delete_model,
            mark_db_for_reset,
            copy_game_database_files,
            delete_game_database_files,
            game_database_exists,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<OllamaState>() {
                    ollama_manager::stop_ollama(&state);
                }
            }
        });
}
