use crate::ollama_manager::{self, OllamaRuntimeStatus, OllamaState};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
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
        .no_proxy()
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성에 실패했습니다: {e}"))
}

#[tauri::command]
pub async fn check_ollama_status(
    app: tauri::AppHandle,
    state: State<'_, OllamaState>,
) -> Result<bool, String> {
    let detail = ollama_manager::get_ollama_status_detail(app, state).await?;
    Ok(detail.ready)
}

#[tauri::command]
pub async fn chat_with_llm(
    app: tauri::AppHandle,
    state: State<'_, OllamaState>,
    model: String,
    messages: Vec<LlmMessage>,
    format: Option<String>,
) -> Result<String, String> {
    let detail = ollama_manager::ensure_ollama_ready(app, state).await?;
    if detail.status != OllamaRuntimeStatus::Ready {
        return Err(detail.message);
    }

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
        .map_err(|e| format!("Ollama 연결 실패: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama 요청 실패 {status}: {err_text}"));
    }

    let result: OllamaChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Ollama 응답 파싱에 실패했습니다: {e}"))?;

    Ok(result.message.content)
}

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
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API 연결에 실패했습니다: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API 오류 {status}: {err_text}"));
    }

    let result: OpenAiResponse = response
        .json()
        .await
        .map_err(|e| format!("OpenAI 응답 파싱에 실패했습니다: {e}"))?;

    result
        .choices
        .and_then(|choices| choices.into_iter().next())
        .and_then(|choice| choice.message.content)
        .ok_or_else(|| "OpenAI API 응답이 비어 있거나 형식이 올바르지 않습니다.".to_string())
}

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

    let api_messages: Vec<serde_json::Value> = messages
        .into_iter()
        .filter(|message| message.role != "system")
        .map(|message| serde_json::json!({ "role": message.role, "content": message.content }))
        .collect();

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens.unwrap_or(1024),
        "messages": api_messages,
    });

    if let Some(system_prompt) = system_prompt {
        body["system"] = serde_json::Value::String(system_prompt);
    }

    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude API 연결에 실패했습니다: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Claude API 오류 {status}: {err_text}"));
    }

    let result: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Claude 응답 파싱에 실패했습니다: {e}"))?;

    result
        .content
        .and_then(|content| content.into_iter().next())
        .and_then(|block| block.text)
        .ok_or_else(|| "Claude API 응답이 비어 있거나 형식이 올바르지 않습니다.".to_string())
}

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

    let contents: Vec<serde_json::Value> = messages
        .into_iter()
        .filter(|message| message.role != "system")
        .map(|message| {
            serde_json::json!({
                "role": if message.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": message.content }]
            })
        })
        .collect();

    let mut body = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
        }
    });

    if let Some(system_prompt) = system_prompt {
        body["system_instruction"] = serde_json::json!({
            "parts": [{ "text": system_prompt }]
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
        .map_err(|e| format!("Gemini API 연결에 실패했습니다: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API 오류 {status}: {err_text}"));
    }

    let result: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Gemini 응답 파싱에 실패했습니다: {e}"))?;

    result
        .candidates
        .and_then(|candidates| candidates.into_iter().next())
        .and_then(|candidate| candidate.content)
        .and_then(|content| content.parts)
        .and_then(|parts| parts.into_iter().next())
        .and_then(|part| part.text)
        .ok_or_else(|| "Gemini API 응답이 비어 있거나 형식이 올바르지 않습니다.".to_string())
}

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
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Grok API 연결에 실패했습니다: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Grok API 오류 {status}: {err_text}"));
    }

    let result: OpenAiResponse = response
        .json()
        .await
        .map_err(|e| format!("Grok 응답 파싱에 실패했습니다: {e}"))?;

    result
        .choices
        .and_then(|choices| choices.into_iter().next())
        .and_then(|choice| choice.message.content)
        .ok_or_else(|| "Grok API 응답이 비어 있거나 형식이 올바르지 않습니다.".to_string())
}
