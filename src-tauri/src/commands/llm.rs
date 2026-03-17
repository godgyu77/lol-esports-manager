use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmResponse {
    pub message: LlmMessage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaChatResponse {
    pub message: LlmMessage,
}

#[tauri::command]
pub async fn check_ollama_status() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn chat_with_llm(
    model: String,
    messages: Vec<LlmMessage>,
    format: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
    });

    if let Some(fmt) = format {
        body["format"] = serde_json::Value::String(fmt);
    }

    let response = client
        .post("http://localhost:11434/api/chat")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama 연결 실패: {}", e))?;

    let result: OllamaChatResponse = response
        .json()
        .await
        .map_err(|e| format!("응답 파싱 실패: {}", e))?;

    Ok(result.message.content)
}
