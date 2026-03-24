use std::sync::Mutex;
use futures_util::StreamExt;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

pub struct OllamaState {
    pub process: Mutex<Option<CommandChild>>,
}

/// 앱 시작 시 Ollama sidecar 자동 시작
pub fn start_ollama(app: &tauri::AppHandle) -> Result<(), String> {
    let sidecar = app
        .shell()
        .sidecar("ollama")
        .map_err(|e| format!("Ollama sidecar 생성 실패: {}", e))?;

    let (_rx, child) = sidecar
        .args(["serve"])
        .spawn()
        .map_err(|e| format!("Ollama 시작 실패: {}", e))?;

    let state = app.state::<OllamaState>();
    if let Ok(mut proc) = state.process.lock() {
        *proc = Some(child);
    }

    log::info!("Ollama sidecar 시작됨");
    Ok(())
}

/// 모델 다운로드 (Ollama HTTP API 사용 - 스트리밍 진행률)
#[tauri::command]
pub async fn pull_model(model_name: String, app: tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {}", e))?;

    let response = client
        .post("http://localhost:11434/api/pull")
        .json(&serde_json::json!({
            "name": model_name,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("모델 다운로드 요청 실패: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "모델 다운로드 실패: HTTP {}",
            response.status()
        ));
    }

    let mut last_status = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("스트림 읽기 실패: {}", e))?;
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

                let total = json
                    .get("total")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
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
        Ok(format!("모델 '{}' 처리 완료 (상태: {})", model_name, last_status))
    }
}

/// 설치된 모델 목록 조회
#[tauri::command]
pub async fn list_models() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();

    let response = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("모델 목록 조회 실패: {}", e))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("응답 파싱 실패: {}", e))?;

    let models = body
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

/// 모델 삭제
#[tauri::command]
pub async fn delete_model(model_name: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    let response = client
        .delete("http://localhost:11434/api/delete")
        .json(&serde_json::json!({ "name": model_name }))
        .send()
        .await
        .map_err(|e| format!("모델 삭제 실패: {}", e))?;

    if response.status().is_success() {
        Ok(format!("모델 '{}' 삭제 완료", model_name))
    } else {
        Err(format!("모델 삭제 실패: HTTP {}", response.status()))
    }
}

/// 앱 종료 시 Ollama 프로세스 정리
pub fn stop_ollama(state: &OllamaState) {
    if let Ok(mut process) = state.process.lock() {
        if let Some(child) = process.take() {
            let _ = child.kill();
            log::info!("Ollama 프로세스 종료됨");
        }
    }
}
