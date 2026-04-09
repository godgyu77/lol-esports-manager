import { readFile } from 'node:fs/promises';
import path from 'node:path';

const NOTION_VERSION = '2022-06-28';
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const GITHUB_EVENT_NAME = process.env.GITHUB_EVENT_NAME ?? 'manual';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY ?? 'unknown/repo';
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
const GITHUB_SHA = process.env.GITHUB_SHA ?? '';
const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME ?? '';
const MODE = process.env.NOTION_SYNC_MODE ?? process.argv[2] ?? 'event';

const DATABASES = {
  tasks: process.env.NOTION_TASKS_DATABASE_ID ?? '',
  devlog: process.env.NOTION_DEVLOG_DATABASE_ID ?? '',
  patchNotes: process.env.NOTION_PATCH_NOTES_DATABASE_ID ?? '',
  projects: process.env.NOTION_PROJECTS_DATABASE_ID ?? '',
};

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function truncate(text, limit = 1900) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function toPlainArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function uniq(values) {
  return [...new Set(values)];
}

function select(name) {
  return name ? { select: { name } } : undefined;
}

function multiSelect(names) {
  const items = uniq(names.filter(Boolean));
  return { multi_select: items.map((name) => ({ name })) };
}

function title(value) {
  return {
    title: [
      {
        text: {
          content: truncate(value, 200),
        },
      },
    ],
  };
}

function richText(value) {
  if (!value) return { rich_text: [] };
  return {
    rich_text: [
      {
        text: {
          content: truncate(value),
        },
      },
    ],
  };
}

function dateValue(start) {
  return start ? { date: { start } } : undefined;
}

function urlValue(url) {
  return url ? { url } : undefined;
}

function parseConventionalType(message) {
  const match = /^([a-z]+)(\(.+\))?!?:/i.exec(message.trim());
  return match?.[1]?.toLowerCase() ?? 'chore';
}

function taskPriorityFromType(type) {
  if (type === 'fix') return '높음';
  if (type === 'feat') return '중간';
  if (type === 'refactor') return '중간';
  if (type === 'test') return '낮음';
  return '낮음';
}

function taskAreaFromType(type) {
  if (type === 'fix') return '버그 수정';
  if (type === 'feat') return '기능 개발';
  if (type === 'refactor') return '리팩터링';
  if (type === 'test') return '테스트';
  return '유지보수';
}

function blocksFromMarkdown(markdown) {
  return truncate(markdown, 8000)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, 80)
    .map((line) => ({
      object: 'block',
      type: line.startsWith('- ') ? 'bulleted_list_item' : 'paragraph',
      [line.startsWith('- ') ? 'bulleted_list_item' : 'paragraph']: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: truncate(line.startsWith('- ') ? line.slice(2) : line, 1800),
            },
          },
        ],
      },
    }));
}

async function notionRequest(endpoint, method, body) {
  const token = process.env.NOTION_TOKEN;
  invariant(token, 'NOTION_TOKEN is required.');

  const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${method} ${endpoint} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function createPage(databaseId, properties, children = [], iconEmoji) {
  if (!databaseId) {
    console.log('Skipping createPage because database id is missing.');
    return null;
  }

  return notionRequest('pages', 'POST', {
    parent: { database_id: databaseId },
    icon: iconEmoji ? { type: 'emoji', emoji: iconEmoji } : undefined,
    properties,
    children,
  });
}

async function loadEventPayload() {
  if (!EVENT_PATH) return {};
  const raw = await readFile(EVENT_PATH, 'utf8');
  return JSON.parse(raw);
}

function commitSummary(commits) {
  const messages = toPlainArray(commits).map((commit) => commit.message?.split('\n')[0] ?? '').filter(Boolean);
  const types = uniq(messages.map(parseConventionalType));
  return {
    messages,
    types,
  };
}

function changedFilesFromPush(payload) {
  const commits = toPlainArray(payload.commits);
  return uniq(
    commits.flatMap((commit) => [
      ...toPlainArray(commit.added),
      ...toPlainArray(commit.modified),
      ...toPlainArray(commit.removed),
    ]),
  );
}

function repoUrl() {
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
}

function shaUrl(sha) {
  return sha ? `${repoUrl()}/commit/${sha}` : repoUrl();
}

async function syncPushEvent(payload) {
  const commits = toPlainArray(payload.commits);
  if (commits.length === 0) return;

  const summary = commitSummary(commits);
  const files = changedFilesFromPush(payload);
  const titleValue = `푸시 기록: ${summary.messages[0] ?? GITHUB_SHA.slice(0, 7)}`;
  const compareUrl = payload.compare ?? shaUrl(GITHUB_SHA);
  const body = [
    `저장소: ${GITHUB_REPOSITORY}`,
    `브랜치: ${GITHUB_REF_NAME || payload.ref || '-'}`,
    `커밋 수: ${commits.length}`,
    '',
    '이번 푸시에 포함된 커밋:',
    ...summary.messages.map((message) => `- ${message}`),
    '',
    '변경된 파일:',
    ...files.slice(0, 25).map((file) => `- ${file}`),
  ].join('\n');

  await createPage(
    DATABASES.devlog,
    {
      Name: title(titleValue),
      Type: select('푸시'),
      Status: select('기록됨'),
      Source: select('GitHub 자동화'),
      Repository: richText(GITHUB_REPOSITORY),
      Branch: richText(GITHUB_REF_NAME || payload.ref || ''),
      Summary: richText(`총 ${commits.length}개 커밋과 ${files.length}개 파일 변경이 감지되었습니다.`),
      Tags: multiSelect(['푸시', ...summary.types.map((type) => ({
        feat: '기능',
        fix: '수정',
        refactor: '리팩터링',
        test: '테스트',
        chore: '정리',
      }[type] ?? type))]),
      URL: urlValue(compareUrl),
      Date: dateValue(new Date().toISOString()),
    },
    blocksFromMarkdown(body),
    '🛠️',
  );
}

async function syncPullRequestEvent(payload) {
  const pr = payload.pull_request;
  if (!pr) return;

  const action = payload.action ?? 'updated';
  const labels = toPlainArray(pr.labels).map((label) => label.name).filter(Boolean);
  const titleLine = `PR #${pr.number}: ${pr.title}`;
  const body = [
    `이벤트: ${action}`,
    `저장소: ${GITHUB_REPOSITORY}`,
    `브랜치: ${pr.head?.ref ?? ''} -> ${pr.base?.ref ?? ''}`,
    `작성자: ${pr.user?.login ?? 'unknown'}`,
    '',
    'PR 설명:',
    pr.body?.trim() || '(설명이 없습니다)',
  ].join('\n');

  await createPage(
    DATABASES.devlog,
    {
      Name: title(titleLine),
      Type: select('풀 리퀘스트'),
      Status: select(pr.merged ? '병합됨' : '기록됨'),
      Source: select('GitHub 자동화'),
      Repository: richText(GITHUB_REPOSITORY),
      Branch: richText(pr.head?.ref ?? ''),
      Summary: richText(`PR #${pr.number}에서 ${action} 이벤트가 발생했습니다.`),
      Tags: multiSelect(['풀리퀘스트', action, ...(pr.merged ? ['병합'] : []), ...labels]),
      URL: urlValue(pr.html_url),
      Date: dateValue(new Date().toISOString()),
    },
    blocksFromMarkdown(body),
    '🔀',
  );

  if (action === 'opened') {
    await createPage(
      DATABASES.tasks,
      {
        Name: title(pr.title),
        Status: select('할 일'),
        Priority: select('중간'),
        Area: select(taskAreaFromType(parseConventionalType(pr.title))),
        Source: select('GitHub PR'),
        Summary: richText(`PR #${pr.number} 검토, 수정 반영, 병합 여부 판단이 필요한 작업입니다.`),
        Tags: multiSelect(['깃허브', 'PR', ...labels]),
        URL: urlValue(pr.html_url),
        Date: dateValue(new Date().toISOString()),
      },
      blocksFromMarkdown(body),
      '📋',
    );
  }
}

async function syncReleaseEvent(payload) {
  const release = payload.release;
  if (!release) return;

  const body = [
    `저장소: ${GITHUB_REPOSITORY}`,
    `태그: ${release.tag_name}`,
    `릴리스 이름: ${release.name || release.tag_name}`,
    `대상 브랜치/커밋: ${release.target_commitish || '-'}`,
    '',
    '릴리스 노트:',
    release.body?.trim() || '(릴리스 노트가 없습니다)',
  ].join('\n');

  await createPage(
    DATABASES.patchNotes,
    {
      Name: title(release.name || release.tag_name),
      Version: richText(release.tag_name),
      Status: select('배포됨'),
      Type: select('릴리스'),
      Repository: richText(GITHUB_REPOSITORY),
      Summary: richText(`${release.tag_name} 버전 릴리스가 발행되었습니다.`),
      Tags: multiSelect(['릴리스', release.prerelease ? '사전배포' : '정식배포']),
      URL: urlValue(release.html_url),
      Date: dateValue(release.published_at || new Date().toISOString()),
    },
    blocksFromMarkdown(body),
    '🚀',
  );
}

async function syncProjectSummary() {
  const summaryFile = path.join(process.cwd(), 'docs', 'operations', 'notion-project-description-seed-2026-04-09.md');
  const content = await readFile(summaryFile, 'utf8');
  const firstHeading = content.split('\n').find((line) => line.startsWith('# ')) ?? '# LoL Esports Manager 프로젝트 개요';
  const titleValue = firstHeading.replace(/^# /, '').trim();

  await createPage(
    DATABASES.projects,
    {
      Name: title(titleValue),
      Status: select('진행 중'),
      Type: select('프로젝트 개요'),
      Repository: richText(GITHUB_REPOSITORY),
      Summary: richText('현재 프로젝트 방향, 핵심 목표, 차별화 포인트를 자동 시드 문서 기준으로 정리한 항목입니다.'),
      Tags: multiSelect(['프로젝트', '개요', '시드']),
      URL: urlValue(repoUrl()),
      Date: dateValue(new Date().toISOString()),
    },
    blocksFromMarkdown(content),
    '🎮',
  );
}

async function syncManualSnapshot() {
  const shaShort = GITHUB_SHA ? GITHUB_SHA.slice(0, 7) : 'manual';
  const body = [
    `저장소: ${GITHUB_REPOSITORY}`,
    `브랜치: ${GITHUB_REF_NAME || '-'}`,
    `커밋: ${shaShort}`,
    '',
    '이 항목은 workflow_dispatch로 수동 실행해서 생성한 개발 로그 스냅샷입니다.',
  ].join('\n');

  await createPage(
    DATABASES.devlog,
    {
      Name: title(`수동 스냅샷 ${shaShort}`),
      Type: select('수동 스냅샷'),
      Status: select('기록됨'),
      Source: select('GitHub 자동화'),
      Repository: richText(GITHUB_REPOSITORY),
      Branch: richText(GITHUB_REF_NAME || ''),
      Summary: richText('워크플로 수동 실행으로 남긴 개발 로그 스냅샷입니다.'),
      Tags: multiSelect(['수동', '스냅샷']),
      URL: urlValue(shaUrl(GITHUB_SHA)),
      Date: dateValue(new Date().toISOString()),
    },
    blocksFromMarkdown(body),
    '🧾',
  );
}

async function main() {
  const payload = await loadEventPayload();

  if (MODE === 'project_summary') {
    await syncProjectSummary();
    return;
  }

  if (MODE === 'manual_snapshot') {
    await syncManualSnapshot();
    return;
  }

  if (GITHUB_EVENT_NAME === 'push') {
    await syncPushEvent(payload);
    return;
  }

  if (GITHUB_EVENT_NAME === 'pull_request') {
    await syncPullRequestEvent(payload);
    return;
  }

  if (GITHUB_EVENT_NAME === 'release') {
    await syncReleaseEvent(payload);
    return;
  }

  console.log(`이벤트 "${GITHUB_EVENT_NAME}"와 모드 "${MODE}"에 대한 동기화 핸들러가 없습니다.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
