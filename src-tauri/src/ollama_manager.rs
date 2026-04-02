use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OllamaRuntimeStatus {
    NotStarted,
    Starting,
    Ready,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatusDetail {
    pub status: OllamaRuntimeStatus,
    pub ready: bool,
    pub message: String,
}

impl Default for OllamaStatusDetail {
    fn default() -> Self {
        Self {
            status: OllamaRuntimeStatus::NotStarted,
            ready: false,
            message: "Ollama가 아직 시작되지 않았습니다.".to_string(),
        }
    }
}

pub struct OllamaState {
    pub process: Mutex<Option<CommandChild>>,
    pub detail: Mutex<OllamaStatusDetail>,
}

async fn probe_ready(timeout_secs: u64) -> Result<bool, String> {
    let client = http_client(timeout_secs)?;
    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

fn http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .no_proxy()
        .build()
        .map_err(|e| format!("Ollama HTTP 클라이언트 생성 실패: {e}"))
}

fn set_status(state: &OllamaState, status: OllamaRuntimeStatus, message: impl Into<String>) {
    if let Ok(mut detail) = state.detail.lock() {
        detail.ready = status == OllamaRuntimeStatus::Ready;
        detail.status = status;
        detail.message = message.into();
    }
}

fn get_status(state: &OllamaState) -> OllamaStatusDetail {
    state.detail.lock().map(|detail| detail.clone()).unwrap_or_default()
}

pub async fn wait_until_ready(
    app: &tauri::AppHandle,
    attempts: usize,
    delay_ms: u64,
) -> Result<OllamaStatusDetail, String> {
    let client = http_client(3)?;

    for _ in 0..attempts {
        match client.get("http://localhost:11434/api/tags").send().await {
            Ok(response) if response.status().is_success() => {
                let state = app.state::<OllamaState>();
                set_status(
                    &state,
                    OllamaRuntimeStatus::Ready,
                    "Ollama가 준비되었습니다.",
                );
                return Ok(get_status(&state));
            }
            Ok(response) => {
                let state = app.state::<OllamaState>();
                set_status(
                    &state,
                    OllamaRuntimeStatus::Starting,
                    format!("Ollama 응답 대기 중 (HTTP {})", response.status()),
                );
            }
            Err(error) => {
                let state = app.state::<OllamaState>();
                set_status(
                    &state,
                    OllamaRuntimeStatus::Starting,
                    format!("Ollama 준비 대기 중: {error}"),
                );
            }
        }

        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
    }

    let state = app.state::<OllamaState>();
    let detail = get_status(&state);
    if detail.status == OllamaRuntimeStatus::Ready {
        return Ok(detail);
    }

    let message = "Ollama가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.";
    set_status(&state, OllamaRuntimeStatus::Failed, message);
    Err(message.to_string())
}

pub fn start_ollama(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<OllamaState>();

    if let Ok(process) = state.process.lock() {
        if process.is_some() {
            set_status(
                &state,
                OllamaRuntimeStatus::Starting,
                "Ollama가 이미 시작되어 준비를 기다리는 중입니다.",
            );
            return Ok(());
        }
    }

    set_status(
        &state,
        OllamaRuntimeStatus::Starting,
        "Ollama sidecar를 시작하는 중입니다.",
    );

    let sidecar = app
        .shell()
        .sidecar("ollama")
        .map_err(|e| format!("Ollama sidecar 생성 실패: {e}"))?;

    let (_rx, child) = sidecar
        .args(["serve"])
        .spawn()
        .map_err(|e| {
            set_status(
                &state,
                OllamaRuntimeStatus::Failed,
                format!("Ollama 실행 실패: {e}"),
            );
            format!("Ollama 실행 실패: {e}")
        })?;

    if let Ok(mut process) = state.process.lock() {
        *process = Some(child);
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = wait_until_ready(&app_handle, 30, 500).await;
    });

    log::info!("Ollama sidecar started");
    Ok(())
}

#[tauri::command]
pub async fn start_ollama_runtime(app: tauri::AppHandle) -> Result<OllamaStatusDetail, String> {
    if probe_ready(2).await? {
        let state = app.state::<OllamaState>();
        set_status(
            &state,
            OllamaRuntimeStatus::Ready,
            "이미 실행 중인 Ollama 서버를 감지했습니다.",
        );
        return Ok(get_status(&state));
    }

    start_ollama(&app)?;
    wait_until_ready(&app, 40, 500).await?;
    Ok(get_status(&app.state::<OllamaState>()))
}

#[tauri::command]
pub async fn get_ollama_status_detail(
    app: tauri::AppHandle,
    state: State<'_, OllamaState>,
) -> Result<OllamaStatusDetail, String> {
    if probe_ready(2).await? {
        set_status(
            &state,
            OllamaRuntimeStatus::Ready,
            "Ollama 서버가 준비되었습니다.",
        );
        return Ok(get_status(&state));
    }

    let detail = get_status(&state);
    if detail.status == OllamaRuntimeStatus::Ready {
        return Ok(detail);
    }

    if detail.status == OllamaRuntimeStatus::Starting {
        let _ = wait_until_ready(&app, 2, 250).await;
        return Ok(get_status(&state));
    }

    Ok(detail)
}

#[tauri::command]
pub async fn ensure_ollama_ready(
    app: tauri::AppHandle,
    state: State<'_, OllamaState>,
) -> Result<OllamaStatusDetail, String> {
    if probe_ready(2).await? {
        set_status(
            &state,
            OllamaRuntimeStatus::Ready,
            "Ollama 서버가 준비되었습니다.",
        );
        return Ok(get_status(&state));
    }

    let detail = get_status(&state);
    if matches!(
        detail.status,
        OllamaRuntimeStatus::NotStarted | OllamaRuntimeStatus::Failed
    ) {
        start_ollama(&app)?;
    }

    wait_until_ready(&app, 40, 500).await?;
    Ok(get_status(&state))
}

#[tauri::command]
pub async fn pull_model(model_name: String, app: tauri::AppHandle) -> Result<String, String> {
    wait_until_ready(&app, 30, 500).await?;

    let client = http_client(3600)?;
    let response = client
        .post("http://localhost:11434/api/pull")
        .json(&serde_json::json!({
            "name": model_name,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("모델 다운로드 요청 실패: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("모델 다운로드 실패: HTTP {}", response.status()));
    }

    let mut last_status = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("스트림 읽기 실패: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                let status = json
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("")
                    .to_string();

                let total = json.get("total").and_then(|v| v.as_u64()).unwrap_or(0);
                let completed = json
                    .get("completed")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);

                let progress = if total > 0 {
                    ((completed as f64 / total as f64) * 100.0) as u32
                } else {
                    0
                };

                let _ = app.emit(
                    "model-download-progress",
                    serde_json::json!({
                        "progress": progress,
                        "status": status,
                        "total": total,
                        "completed": completed,
                    }),
                );

                last_status = status;
            }
        }
    }

    if last_status == "success" {
        Ok(format!("모델 '{}' 다운로드 완료", model_name))
    } else {
        Ok(format!(
            "모델 '{}' 처리 완료 (상태: {})",
            model_name, last_status
        ))
    }
}

#[tauri::command]
pub async fn list_models(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    wait_until_ready(&app, 30, 500).await?;

    let client = http_client(10)?;
    let response = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("모델 목록 조회 실패: {e}"))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("응답 파싱 실패: {e}"))?;

    Ok(body
        .get("models")
        .and_then(|models| models.as_array())
        .map(|models| {
            models
                .iter()
                .filter_map(|model| {
                    model
                        .get("name")
                        .and_then(|name| name.as_str())
                        .map(|name| name.to_string())
                })
                .collect()
        })
        .unwrap_or_default())
}

#[tauri::command]
pub async fn delete_model(model_name: String, app: tauri::AppHandle) -> Result<String, String> {
    wait_until_ready(&app, 30, 500).await?;

    let client = http_client(30)?;
    let response = client
        .delete("http://localhost:11434/api/delete")
        .json(&serde_json::json!({ "name": model_name }))
        .send()
        .await
        .map_err(|e| format!("모델 삭제 실패: {e}"))?;

    if response.status().is_success() {
        Ok(format!("모델 '{}' 삭제 완료", model_name))
    } else {
        Err(format!("모델 삭제 실패: HTTP {}", response.status()))
    }
}

pub fn stop_ollama(state: &OllamaState) {
    if let Ok(mut process) = state.process.lock() {
        if let Some(child) = process.take() {
            let _ = child.kill();
            set_status(
                state,
                OllamaRuntimeStatus::NotStarted,
                "Ollama가 종료되었습니다.",
            );
            log::info!("Ollama process stopped");
        }
    }
}
