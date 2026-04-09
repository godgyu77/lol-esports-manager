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
  if (type === 'fix') return 'High';
  if (type === 'feat') return 'Medium';
  if (type === 'refactor') return 'Medium';
  if (type === 'test') return 'Low';
  return 'Low';
}

function taskAreaFromType(type) {
  if (type === 'fix') return 'Bugfix';
  if (type === 'feat') return 'Feature';
  if (type === 'refactor') return 'Refactor';
  if (type === 'test') return 'Test';
  return 'Maintenance';
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
  const titleValue = `Push: ${summary.messages[0] ?? GITHUB_SHA.slice(0, 7)}`;
  const compareUrl = payload.compare ?? shaUrl(GITHUB_SHA);
  const body = [
    `Repository: ${GITHUB_REPOSITORY}`,
    `Branch: ${GITHUB_REF_NAME || payload.ref || '-'}`,
    `Commits: ${commits.length}`,
    '',
    'Commit messages:',
    ...summary.messages.map((message) => `- ${message}`),
    '',
    'Changed files:',
    ...files.slice(0, 25).map((file) => `- ${file}`),
  ].join('\n');

  await createPage(
    DATABASES.devlog,
    {
      Name: title(titleValue),
      Type: select('Push'),
      Status: select('Logged'),
      Source: select('GitHub Actions'),
      Repository: richText(GITHUB_REPOSITORY),
      Branch: richText(GITHUB_REF_NAME || payload.ref || ''),
      Summary: richText(`${commits.length} commit(s), ${files.length} changed file(s)`),
      Tags: multiSelect(['push', ...summary.types]),
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
    `Action: ${action}`,
    `Repository: ${GITHUB_REPOSITORY}`,
    `Branch: ${pr.head?.ref ?? ''} -> ${pr.base?.ref ?? ''}`,
    `Author: ${pr.user?.login ?? 'unknown'}`,
    '',
    'Description:',
    pr.body?.trim() || '(no description)',
  ].join('\n');

  await createPage(
    DATABASES.devlog,
    {
      Name: title(titleLine),
      Type: select('Pull Request'),
      Status: select(pr.merged ? 'Merged' : 'Logged'),
      Source: select('GitHub Actions'),
      Repository: richText(GITHUB_REPOSITORY),
      Branch: richText(pr.head?.ref ?? ''),
      Summary: richText(`${action} PR event`),
      Tags: multiSelect(['pull_request', action, ...(pr.merged ? ['merged'] : []), ...labels]),
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
        Status: select('Todo'),
        Priority: select('Medium'),
        Area: select(taskAreaFromType(parseConventionalType(pr.title))),
        Source: select('GitHub PR'),
        Summary: richText(`Review and land PR #${pr.number}`),
        Tags: multiSelect(['github', 'pr', ...labels]),
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
    `Repository: ${GITHUB_REPOSITORY}`,
    `Tag: ${release.tag_name}`,
    `Name: ${release.name || release.tag_name}`,
    `Target: ${release.target_commitish || '-'}`,
    '',
    'Release notes:',
    release.body?.trim() || '(no release notes)',
  ].join('\n');

  await createPage(
    DATABASES.patchNotes,
    {
      Name: title(release.name || release.tag_name),
      Version: richText(release.tag_name),
      Status: select('Published'),
      Type: select('Release'),
      Repository: richText(GITHUB_REPOSITORY),
      Summary: richText(`Release ${release.tag_name} published`),
      Tags: multiSelect(['release', release.prerelease ? 'prerelease' : 'stable']),
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
  const firstHeading = content.split('\n').find((line) => line.startsWith('# ')) ?? '# LoL Esports Manager';
  const titleValue = firstHeading.replace(/^# /, '').trim();

  await createPage(
    DATABASES.projects,
    {
      Name: title(titleValue),
      Status: select('Active'),
      Type: select('Project Summary'),
      Repository: richText(GITHUB_REPOSITORY),
      Summary: richText('Seeded from repository automation setup'),
      Tags: multiSelect(['project', 'summary', 'seed']),
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
    `Repository: ${GITHUB_REPOSITORY}`,
    `Branch: ${GITHUB_REF_NAME || '-'}`,
    `Commit: ${shaShort}`,
    '',
    'This snapshot was created manually via workflow_dispatch.',
  ].join('\n');

  await createPage(
    DATABASES.devlog,
    {
      Name: title(`Manual snapshot ${shaShort}`),
      Type: select('Manual Snapshot'),
      Status: select('Logged'),
      Source: select('GitHub Actions'),
      Repository: richText(GITHUB_REPOSITORY),
      Branch: richText(GITHUB_REF_NAME || ''),
      Summary: richText('Manual dev-log snapshot from workflow_dispatch'),
      Tags: multiSelect(['manual', 'snapshot']),
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

  console.log(`No sync handler for event "${GITHUB_EVENT_NAME}" with mode "${MODE}".`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
