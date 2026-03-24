mod commands;
mod ollama_manager;

use tauri_plugin_sql::{Migration, MigrationKind};
use ollama_manager::OllamaState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add division column to players",
            sql: include_str!("../migrations/002_add_division.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create champions and patch tables",
            sql: include_str!("../migrations/003_champions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add daily calendar and condition tables",
            sql: include_str!("../migrations/004_daily_calendar.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add performance indexes",
            sql: include_str!("../migrations/005_add_indexes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create player traits table",
            sql: include_str!("../migrations/006_player_traits.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create team finance log table",
            sql: include_str!("../migrations/007_team_finances.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add playoff columns to matches",
            sql: include_str!("../migrations/008_playoff.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "create transfer offers table",
            sql: include_str!("../migrations/009_transfer_market.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create tournaments tables",
            sql: include_str!("../migrations/010_tournaments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "create sponsors table",
            sql: include_str!("../migrations/011_sponsors.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create player relations table",
            sql: include_str!("../migrations/012_player_relations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add swiss records and fearless draft",
            sql: include_str!("../migrations/013_tournament_expansion.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "create player game stats table",
            sql: include_str!("../migrations/014_player_game_stats.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "add play style column to teams",
            sql: include_str!("../migrations/015_team_play_style.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "scouting system",
            sql: include_str!("../migrations/016_scouting.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "training system",
            sql: include_str!("../migrations/017_training.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "staff system",
            sql: include_str!("../migrations/018_staff.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "board expectations",
            sql: include_str!("../migrations/019_board_expectations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "tactics system",
            sql: include_str!("../migrations/020_tactics.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "awards system",
            sql: include_str!("../migrations/021_awards.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "create academy and rookie draft tables",
            sql: include_str!("../migrations/022_academy.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "create news articles table",
            sql: include_str!("../migrations/023_news_system.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "player complaints",
            sql: include_str!("../migrations/024_player_complaints.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 25,
            description: "save slots",
            sql: include_str!("../migrations/025_save_slots.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 26,
            description: "records system",
            sql: include_str!("../migrations/026_records.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 27,
            description: "facilities system",
            sql: include_str!("../migrations/027_facilities.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 28,
            description: "staff free agent support",
            sql: include_str!("../migrations/028_staff_fa.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 29,
            description: "social reactions system",
            sql: include_str!("../migrations/029_social_reactions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 30,
            description: "rivalry system",
            sql: include_str!("../migrations/030_rivalry.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 31,
            description: "create manager profiles table",
            sql: include_str!("../migrations/031_manager_profile.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 32,
            description: "injuries system",
            sql: include_str!("../migrations/032_injuries.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 33,
            description: "retirement system",
            sql: include_str!("../migrations/033_retirement.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 34,
            description: "create offseason state table",
            sql: include_str!("../migrations/034_offseason.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 35,
            description: "create player goals table",
            sql: include_str!("../migrations/035_player_goals.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 36,
            description: "create player agents table",
            sql: include_str!("../migrations/036_agents.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 37,
            description: "create league nationality rules table",
            sql: include_str!("../migrations/037_nationality_rules.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 38,
            description: "team talks system",
            sql: include_str!("../migrations/038_team_talks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 39,
            description: "promises system",
            sql: include_str!("../migrations/039_promises.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 40,
            description: "board requests",
            sql: include_str!("../migrations/040_board_requests.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 41,
            description: "buyout personality inbox",
            sql: include_str!("../migrations/041_buyout_personality_inbox.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 42,
            description: "mentoring system",
            sql: include_str!("../migrations/042_mentoring.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 43,
            description: "ownership system",
            sql: include_str!("../migrations/043_ownership.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 44,
            description: "contract clauses",
            sql: include_str!("../migrations/044_contract_clauses.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 45,
            description: "career chemistry form history",
            sql: include_str!("../migrations/045_career_chemistry_form.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 46,
            description: "lol esports systems",
            sql: include_str!("../migrations/046_lol_esports_systems.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 47,
            description: "advanced systems",
            sql: include_str!("../migrations/047_advanced_systems.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 48,
            description: "contract negotiations",
            sql: include_str!("../migrations/048_contract_negotiations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 49,
            description: "missing tables fix",
            sql: include_str!("../migrations/049_missing_tables.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:lol_esports_manager.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(OllamaState {
            process: Mutex::new(None),
        })
        .setup(|app| {
            // Ollama sidecar 자동 시작 시도 (실패해도 앱은 계속 실행)
            let handle = app.handle().clone();
            if let Err(e) = ollama_manager::start_ollama(&handle) {
                eprintln!("Ollama 자동 시작 실패 (수동 시작 필요): {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::llm::check_ollama_status,
            commands::llm::chat_with_llm,
            ollama_manager::pull_model,
            ollama_manager::list_models,
            ollama_manager::delete_model,
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
