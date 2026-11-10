#!/usr/bin/env python3
"""Verify this static site and keep durable release records in a separate branch."""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

REPOSITORY = 'leiSHOW/leiSHOW.github.io'
SITE_URL = 'https://leishow.github.io/'
RECORD_BRANCH = 'deployment-records'
WORKFLOW = 'verify-pages.yml'
REQUIRED = ['index.html', 'blog/index.html', 'habit/index.html', 'resume/index.html',
            'show/index.html', 'show/iotidr/index.html', 'show/multiuav/index.html',
            'blog/2022/11/30/hello-world/index.html',
            'blog/1970/01/01/hello-world/index.html',
            'blog/tags/C/index.html', 'blog/tags/c/index.html']


class ReleaseError(RuntimeError):
    pass


class GitHub:
    def api(self, path, method='GET', data=None, optional=False):
        command = ['gh', 'api', f'repos/{REPOSITORY}/{path}', '--method', method]
        if data is not None:
            command.extend(['--input', '-'])
        result = subprocess.run(command, input=json.dumps(data) if data is not None else None,
                                capture_output=True, text=True, timeout=45)
        if result.returncode:
            if optional and 'HTTP 404' in result.stderr:
                return None
            raise ReleaseError(f'GitHub API {path}: {result.stderr.strip()}')
        return json.loads(result.stdout) if result.stdout.strip() else None

    def record(self, name='latest', ref=RECORD_BRANCH):
        path = 'latest.json' if name == 'latest' else f'releases/{valid_sha(name)}.json'
        item = self.api(f'contents/{path}?ref={quote(ref, safe="")}', optional=True)
        return json.loads(base64.b64decode(item['content'])) if item else None

    def head(self):
        return self.api('git/ref/heads/master')['object']['sha']


def valid_sha(value):
    if not re.fullmatch('[0-9a-f]{40}', value):
        raise ReleaseError('需要完整的 40 位 Git 提交编号。')
    return value


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def manifest(root):
    paths = git(root, 'ls-files', '-z').split('\0')
    result = {}
    for name in paths:
        if name != 'index.html' and not name.startswith(('blog/', 'habit/', 'resume/', 'show/')):
            continue
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ReleaseError(f'成品必须是普通文件：{name}')
        result[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    missing = set(REQUIRED) - result.keys()
    if missing:
        raise ReleaseError(f'成品缺少已有网址：{sorted(missing)}')
    return dict(sorted(result.items()))


def require_current(api, sha):
    if api.head() != sha:
        raise ReleaseError('master 已有更新，本次旧版本不能标记为当前上线成功。请检查最新发布。')


def wait_for_pages(api, sha, deadline, interval=15):
    while True:
        require_current(api, sha)
        build = api.api('pages/builds/latest', optional=True)
        if build and build.get('commit') == sha:
            if build.get('status') == 'built':
                return build
            if build.get('status') == 'errored':
                raise ReleaseError(f'GitHub Pages 部署失败：{build.get("error")}')
        if time.monotonic() >= deadline:
            raise ReleaseError('等待 GitHub Pages 部署本次提交超时。')
        print('等待 GitHub Pages 部署本次提交……', flush=True)
        time.sleep(interval)


def check_file(item, sha, attempt):
    path, expected = item
    route = path[:-10] if path == 'index.html' or path.endswith('/index.html') else path
    url = SITE_URL + quote(route, safe='/') + f'?release={sha}&attempt={attempt}'
    request = Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'LeiSHOW-release-verification'})
    try:
        with urlopen(request, timeout=15) as response:
            actual = hashlib.sha256(response.read()).hexdigest()
            return {'path': path, 'status': response.status, 'expected': expected,
                    'actual': actual, 'matches': response.status == 200 and actual == expected}
    except Exception as error:
        return {'path': path, 'matches': False, 'error': str(error)}


def verify_live(api, sha, files, deadline, report, save, interval=15):
    pending = dict(files)
    results = {}
    attempt = 0
    while pending:
        require_current(api, sha)
        attempt += 1
        with ThreadPoolExecutor(max_workers=8) as executor:
            checked = executor.map(lambda item: check_file(item, sha, attempt), pending.items())
            results.update((item['path'], item) for item in checked)
        report['checks'] = [results[path] for path in sorted(results)]
        pending = {path: files[path] for path in results if not results[path]['matches']}
        save()
        print(f'线上文件一致：{len(files) - len(pending)}/{len(files)}', flush=True)
        if not pending:
            require_current(api, sha)
            return
        if time.monotonic() >= deadline:
            raise ReleaseError(f'线上内容未更新或无法访问：{", ".join(sorted(pending))}')
        time.sleep(interval)


def write_report(path, report):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def verify(args, api):
    sha = valid_sha(args.sha)
    report = {'repository': REPOSITORY, 'pages_commit': sha, 'site_url': SITE_URL,
              'status': 'checking', 'checks': []}
    save = lambda: write_report(args.report, report)
    save()
    try:
        if git(args.root, 'rev-parse', 'HEAD') != sha:
            raise ReleaseError('检出的成品提交与要验证的提交不一致。')
        if git(args.root, 'status', '--porcelain', '--untracked-files=no'):
            raise ReleaseError('检出的成品存在修改，不能用来验证线上版本。')
        report['files'] = manifest(args.root)
        report['pages_tree'] = git(args.root, 'rev-parse', 'HEAD^{tree}')
        build = wait_for_pages(api, sha, time.monotonic() + args.timeout)
        report['pages_build'] = {'commit': build['commit'], 'status': build['status'],
                                 'updated_at': build.get('updated_at')}
        verify_live(api, sha, report['files'], time.monotonic() + 300, report, save)
        report['status'] = 'verified'
        report['verified_at'] = datetime.now(timezone.utc).isoformat()
        run_id = os.environ.get('GITHUB_RUN_ID')
        report['run_url'] = f'https://github.com/{REPOSITORY}/actions/runs/{run_id}' if run_id else None
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        raise
    finally:
        save()


def record_release(api, report):
    sha = valid_sha(report['pages_commit'])
    if report.get('repository') != REPOSITORY or report.get('status') != 'verified':
        raise ReleaseError('只有线上验收通过的版本才能写入成功记录。')
    files = report.get('files', {})
    checks = {check['path']: check for check in report.get('checks', [])}
    if not files or set(checks) != set(files) or any(
            not check.get('matches') or check.get('actual') != files[path]
            for path, check in checks.items()):
        raise ReleaseError('验收记录不完整或存在文件不一致。')
    require_current(api, sha)
    ref = api.api(f'git/ref/heads/{RECORD_BRANCH}', optional=True)
    parent = ref['object']['sha'] if ref else None
    latest = api.record(ref=parent) if parent else None
    if parent and not latest:
        raise ReleaseError('发布记录分支缺少 latest.json，请先修复记录。')
    if latest and latest['pages_commit'] == sha:
        return latest
    record = dict(report, previous_verified_commit=latest['pages_commit'] if latest else None)
    tree_data = {'tree': [{'path': path, 'mode': '100644', 'type': 'blob',
                          'content': json.dumps(record, ensure_ascii=False, indent=2) + '\n'}
                         for path in ['latest.json', f'releases/{sha}.json']]}
    if parent:
        tree_data['base_tree'] = api.api(f'git/commits/{parent}')['tree']['sha']
    tree = api.api('git/trees', 'POST', tree_data)
    commit = api.api('git/commits', 'POST', {'message': f'Verified Pages release {sha}',
                                          'tree': tree['sha'], 'parents': [parent] if parent else []})
    require_current(api, sha)
    if parent:
        api.api(f'git/refs/heads/{RECORD_BRANCH}', 'PATCH', {'sha': commit['sha'], 'force': False})
    else:
        api.api('git/refs', 'POST', {'ref': f'refs/heads/{RECORD_BRANCH}', 'sha': commit['sha']})
    return record


def summary(record):
    previous = record.get('previous_verified_commit') or '首次登记，无更早的验收记录'
    message = (f'上线验收通过：{record["pages_commit"]}\n'
               f'已核验 {len(record["files"])} 个线上文件；上一可恢复版本：{previous}\n')
    print(message, flush=True)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as stream:
            stream.write(f'## 上线验收通过\n\n- 网站：{SITE_URL}\n'
                         f'- 本次提交：`{record["pages_commit"]}`\n'
                         f'- 线上内容一致：{len(record["files"])} 个文件\n'
                         f'- 上一可恢复版本：`{previous}`\n'
                         f'- [长期发布记录](https://github.com/{REPOSITORY}/blob/{RECORD_BRANCH}/latest.json)\n')


def wait_for_verification(api, sha, timeout=1500, output=None, interval=10):
    valid_sha(sha)
    deadline = time.monotonic() + timeout
    shown = None
    while True:
        response = api.api(f'actions/workflows/{WORKFLOW}/runs?head_sha={sha}&per_page=20', optional=True)
        runs = [run for run in (response or {}).get('workflow_runs', []) if run['head_sha'] == sha]
        if runs:
            run = max(runs, key=lambda item: item['id'])
            if shown != (run['id'], run['status']):
                print(f'GitHub 上线验收：{run["status"]} {run["html_url"]}', flush=True)
                shown = run['id'], run['status']
            if run['status'] == 'completed':
                if run['conclusion'] != 'success':
                    raise ReleaseError(f'文件已上传，但上线验收未通过（{run["conclusion"]}）。查看 {run["html_url"]}')
                record = api.record(sha)
                if not record or record.get('status') != 'verified' or record['pages_commit'] != sha:
                    raise ReleaseError('Actions 已结束，但缺少本次提交的成功记录。')
                if output:
                    write_report(output, record)
                summary(record)
                return record
        if time.monotonic() >= deadline:
            raise ReleaseError('文件已上传，但等待 Actions 上线验收超时。可用 wait 命令继续查询。')
        time.sleep(interval)


def rollback_target(api, target):
    latest = api.record()
    if not latest:
        raise ReleaseError('尚无已验收版本可供恢复。')
    if target == 'previous':
        target = (latest['pages_commit'] if api.head() != latest['pages_commit']
                  else latest.get('previous_verified_commit'))
        if not target:
            raise ReleaseError('当前是首个已验收版本，尚无上一版本。')
    record = api.record(valid_sha(target))
    if not record or record.get('status') != 'verified' or record.get('pages_commit') != target:
        raise ReleaseError('所选提交没有成功验收记录，不能作为自动恢复目标。')
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    check = commands.add_parser('verify')
    check.add_argument('--sha', required=True)
    check.add_argument('--root', type=Path, required=True)
    check.add_argument('--report', type=Path, required=True)
    check.add_argument('--timeout', type=int, default=900)
    record = commands.add_parser('record')
    record.add_argument('--report', type=Path, required=True)
    wait = commands.add_parser('wait')
    wait.add_argument('--sha', required=True)
    wait.add_argument('--output', type=Path)
    wait.add_argument('--timeout', type=int, default=1500)
    rollback = commands.add_parser('rollback-target')
    rollback.add_argument('target', nargs='?', default='previous')
    args = parser.parse_args()
    api = GitHub()
    if args.command == 'verify':
        verify(args, api)
    elif args.command == 'record':
        summary(record_release(api, json.loads(args.report.read_text())))
    elif args.command == 'wait':
        wait_for_verification(api, args.sha, args.timeout, args.output)
    else:
        print(rollback_target(api, args.target))


if __name__ == '__main__':
    try:
        main()
    except (ReleaseError, subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
