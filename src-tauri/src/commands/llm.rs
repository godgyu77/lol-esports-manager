use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaChatResponse {
    pub message: LlmMessage,
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {}", e))
}

#[tauri::command]
pub async fn check_ollama_status() -> Result<bool, String> {
    let client = http_client()?;
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
    let client = http_client()?;

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

// ─────────────────────────────────────────
// OpenAI API (Rust 프록시)
// ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponse {
    choices: Option<Vec<OpenAiChoice>>,
}

#[tauri::command]
pub async fn chat_with_openai(
    api_key: String,
    endpoint: String,
    model: String,
    messages: Vec<LlmMessage>,
    format_json: bool,
) -> Result<String, String> {
    let client = http_client()?;

    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
    });

    if format_json {
        body["response_format"] = serde_json::json!({ "type": "json_object" });
    }

    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API 연결 실패: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error {}: {}", status, err_text));
    }

    let result: OpenAiResponse = response
        .json()
        .await
        .map_err(|e| format!("OpenAI 응답 파싱 실패: {}", e))?;

    result
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message.content)
        .ok_or_else(|| "OpenAI API returned empty or invalid response".to_string())
}

// ─────────────────────────────────────────
// Claude (Anthropic) API (Rust 프록시)
// ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ClaudeContentBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Option<Vec<ClaudeContentBlock>>,
}

#[tauri::command]
pub async fn chat_with_claude(
    api_key: String,
    endpoint: String,
    model: String,
    messages: Vec<LlmMessage>,
    system_prompt: Option<String>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let client = http_client()?;

    // Claude API는 messages에 system role을 넣지 않고 별도 system 필드 사용
    let api_messages: Vec<serde_json::Value> = messages
        .into_iter()
        .filter(|m| m.role != "system")
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens.unwrap_or(1024),
        "messages": api_messages,
    });

    if let Some(sys) = system_prompt {
        body["system"] = serde_json::Value::String(sys);
    }

    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude API 연결 실패: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Claude API error {}: {}", status, err_text));
    }

    let result: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Claude 응답 파싱 실패: {}", e))?;

    result
        .content
        .and_then(|c| c.into_iter().next())
        .and_then(|b| b.text)
        .ok_or_else(|| "Claude API returned empty or invalid response".to_string())
}

// ─────────────────────────────────────────
// Google Gemini API (Rust 프록시)
// ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GeminiPart {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiContent {
    parts: Option<Vec<GeminiPart>>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[tauri::command]
pub async fn chat_with_gemini(
    api_key: String,
    model: String,
    messages: Vec<LlmMessage>,
    system_prompt: Option<String>,
    format_json: bool,
) -> Result<String, String> {
    let client = http_client()?;

    // Gemini API: system은 system_instruction, 나머지는 contents
    let contents: Vec<serde_json::Value> = messages
        .into_iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": if m.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": m.content }]
            })
        })
        .collect();

    let mut body = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
        }
    });

    if let Some(sys) = system_prompt {
        body["system_instruction"] = serde_json::json!({
            "parts": [{ "text": sys }]
        });
    }

    if format_json {
        body["generationConfig"]["responseMimeType"] =
            serde_json::Value::String("application/json".to_string());
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini API 연결 실패: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error {}: {}", status, err_text));
    }

    let result: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Gemini 응답 파싱 실패: {}", e))?;

    result
        .candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|c| c.parts)
        .and_then(|p| p.into_iter().next())
        .and_then(|p| p.text)
        .ok_or_else(|| "Gemini API returned empty or invalid response".to_string())
}

// ─────────────────────────────────────────
// Grok (xAI) API (Rust 프록시) — OpenAI 호환
// ─────────────────────────────────────────

#[tauri::command]
pub async fn chat_with_grok(
    api_key: String,
    endpoint: String,
    model: String,
    messages: Vec<LlmMessage>,
    format_json: bool,
) -> Result<String, String> {
    let client = http_client()?;

    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
    });

    if format_json {
        body["response_format"] = serde_json::json!({ "type": "json_object" });
    }

    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Grok API 연결 실패: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Grok API error {}: {}", status, err_text));
    }

    // OpenAI 호환 응답 구조 재사용
    let result: OpenAiResponse = response
        .json()
        .await
        .map_err(|e| format!("Grok 응답 파싱 실패: {}", e))?;

    result
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message.content)
        .ok_or_else(|| "Grok API returned empty or invalid response".to_string())
}
