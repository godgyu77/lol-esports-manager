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
            version: 31,
            description: "create manager profiles table",
            sql: include_str!("../migrations/031_manager_profile.sql"),
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
