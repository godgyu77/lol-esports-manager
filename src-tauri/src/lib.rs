mod commands;

use tauri_plugin_sql::{Migration, MigrationKind};

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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:lol_esports_manager.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::llm::check_ollama_status,
            commands::llm::chat_with_llm,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
