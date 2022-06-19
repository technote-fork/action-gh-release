/* eslint-disable no-magic-numbers */
import * as assert from 'assert';
import path from 'path';
import { disableNetConnect, getOctokit, generateContext, getApiFixture } from '@technote-space/github-action-test-helper';
import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { mimeOrDefault, asset, upload, release, GitHubReleaser } from './github';
import { parseConfig } from './util';

const octokit     = getOctokit();
const context     = generateContext({
  event: 'push',
  ref: 'refs/tags/v1.2.3',
  sha: 'test-sha',
  owner: 'hello',
  repo: 'world',
});
const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('mimeOrDefault', () => {
  it('returns a specific mime for common path', async() => {
    assert.strictEqual(mimeOrDefault('foo.tar.gz'), 'application/gzip');
  });
  it('returns default mime for uncommon path', async() => {
    assert.strictEqual(mimeOrDefault('foo.uncommon'), 'application/octet-stream');
  });
});

describe('asset', () => {
  it('derives asset info from a path', async() => {
    const { name, mime, size, file } = asset(path.join(fixturesDir, 'data/foo/bar.txt'));
    assert.strictEqual(name, 'bar.txt');
    assert.strictEqual(mime, 'text/plain');
    assert.strictEqual(size, 10);
    assert.strictEqual(file.toString(), 'release me');
  });
});

describe('upload', () => {
  disableNetConnect(nock);

  it('should upload asset', async() => {
    nock('https://api.github.com')
      .get('/repos/hello/world/releases/123/assets')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.assets.list1'));
    nock('https://uploads.github.com')
      .post('/repos/hello/world/releases/123/assets?name=bar.txt')
      .reply(201, getApiFixture(fixturesDir, 'repos.releases.assets.create'));

    const response = await upload(octokit, context, {
      id: 123,
      'upload_url': 'https://uploads.github.com/repos/octocat/Hello-World/releases/1/assets{?name,label}',
      'html_url': '',
      'tag_name': '',
    }, path.join(fixturesDir, 'data/foo/bar.txt'));

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('url');
    expect(response).toHaveProperty('name');
  });

  it('should delete asset before upload asset if duplicated', async() => {
    nock('https://api.github.com')
      .get('/repos/hello/world/releases/123/assets')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.assets.list2'))
      .delete('/repos/hello/world/releases/assets/1')
      .reply(204);
    nock('https://uploads.github.com')
      .post('/repos/hello/world/releases/123/assets?name=bar.txt')
      .reply(201, getApiFixture(fixturesDir, 'repos.releases.assets.create'));

    const response = await upload(octokit, context, {
      id: 123,
      'upload_url': 'https://uploads.github.com/repos/octocat/Hello-World/releases/1/assets{?name,label}',
      'html_url': '',
      'tag_name': '',
    }, path.join(fixturesDir, 'data/foo/bar.txt'));

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('url');
    expect(response).toHaveProperty('name');
  });
});

describe('release', () => {
  disableNetConnect(nock);
  const releaser = new GitHubReleaser(octokit);

  it('should get draft release', async() => {
    nock('https://api.github.com')
      .get('/repos/hello/world/releases')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.list'));

    const response = await release(parseConfig({
      'GITHUB_REPOSITORY': 'hello/world',
      'GITHUB_REF': 'refs/tags/v1.0.0',
    }), context, releaser);

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('upload_url');
    expect(response).toHaveProperty('html_url');
    expect(response).toHaveProperty('tag_name');
  });

  it('should get release', async() => {
    nock('https://api.github.com')
      .get('/repos/hello/world/releases')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.list'))
      .get('/repos/hello/world/releases/tags/v1.2.3')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.tags.get.draft'));

    const response = await release(parseConfig({
      'INPUT_UPDATE_DRAFT_FLAG': 'true',
      'INPUT_UPDATE_DRAFT_MODE': 'true',
      'GITHUB_REPOSITORY': 'hello/world',
      'GITHUB_REF': 'refs/tags/v1.2.3',
    }), context, releaser);

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('upload_url');
    expect(response).toHaveProperty('html_url');
    expect(response).toHaveProperty('tag_name');
  });

  it('should update release', async() => {
    nock('https://api.github.com')
      .get('/repos/hello/world/releases')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.list'))
      .get('/repos/hello/world/releases/tags/v1.2.3')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.tags.get.draft'))
      .patch('/repos/hello/world/releases/1')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.update'));

    const response = await release(parseConfig({
      'INPUT_UPDATE_DRAFT_FLAG': 'true',
      'GITHUB_REPOSITORY': 'hello/world',
      'GITHUB_REF': 'refs/tags/v1.2.3',
    }), context, releaser);

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('upload_url');
    expect(response).toHaveProperty('html_url');
    expect(response).toHaveProperty('tag_name');
  });

  it('should create release', async() => {
    nock('https://api.github.com')
      .get('/repos/hello/world/releases')
      .reply(200, [])
      .get('/repos/hello/world/releases/tags/v1.2.3')
      .reply(404)
      .post('/repos/hello/world/releases')
      .reply(201, getApiFixture(fixturesDir, 'repos.releases.create'));

    const response = await release(parseConfig({
      'GITHUB_REPOSITORY': 'hello/world',
      'GITHUB_REF': 'refs/tags/v1.2.3',
    }), context, releaser);

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('upload_url');
    expect(response).toHaveProperty('html_url');
    expect(response).toHaveProperty('tag_name');
  });

  it('should retry to create release', async() => {
    nock('https://api.github.com')
      .persist()
      .get('/repos/hello/world/releases')
      .reply(200, []);
    nock('https://api.github.com')
      .get('/repos/hello/world/releases/tags/v1.2.3')
      .reply(404)
      .post('/repos/hello/world/releases')
      .reply(500)
      .get('/repos/hello/world/releases/tags/v1.2.3')
      .reply(200, getApiFixture(fixturesDir, 'repos.releases.tags.get'));

    const response = await release(parseConfig({
      'GITHUB_REPOSITORY': 'hello/world',
      'GITHUB_REF': 'refs/tags/v1.2.3',
    }), context, releaser);

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('upload_url');
    expect(response).toHaveProperty('html_url');
    expect(response).toHaveProperty('tag_name');
  });

  it('should throw error', async() => {
    nock('https://api.github.com')
      .get('/repos/hello/world/releases/tags/v1.2.3')
      .reply(500);

    await expect(release(parseConfig({
      'GITHUB_REPOSITORY': 'hello/world',
      'GITHUB_REF': 'refs/tags/v1.2.3',
    }), context, releaser)).rejects.toThrow();
  });
});

describe('GitHubReleaser', () => {
  disableNetConnect(nock);
  const releaser = new GitHubReleaser(octokit);

  describe('getReleaseByTag', () => {
    it('should get release', async() => {
      nock('https://api.github.com')
        .get('/repos/hello/world/releases/tags/v1.2.3')
        .reply(200, getApiFixture(fixturesDir, 'repos.releases.tags.get'));

      const release = await releaser.getReleaseByTag({
        ...context.repo,
        tag: 'v1.2.3',
      });

      expect(release).toHaveProperty('id');
      expect(release).toHaveProperty('upload_url');
      expect(release).toHaveProperty('html_url');
      expect(release).toHaveProperty('tag_name');
    });
  });

  describe('createRelease', () => {
    it('should create release', async() => {
      nock('https://api.github.com')
        .post('/repos/hello/world/releases')
        .reply(201, getApiFixture(fixturesDir, 'repos.releases.create'));

      const release = await releaser.createRelease({
        ...context.repo,
        'tag_name': 'v1.2.3',
        name: '',
      });

      expect(release).toHaveProperty('id');
      expect(release).toHaveProperty('upload_url');
      expect(release).toHaveProperty('html_url');
      expect(release).toHaveProperty('tag_name');
    });
  });

  describe('updateRelease', () => {
    it('should update release', async() => {
      nock('https://api.github.com')
        .patch('/repos/hello/world/releases/1')
        .reply(200, getApiFixture(fixturesDir, 'repos.releases.update'));

      const release = await releaser.updateRelease({
        ...context.repo,
        'tag_name': 'v1.2.3',
        'release_id': 1,
        'target_commitish': '',
        name: '',
        body: '',
        draft: true,
        prerelease: false,
      });

      expect(release).toHaveProperty('id');
      expect(release).toHaveProperty('upload_url');
      expect(release).toHaveProperty('html_url');
      expect(release).toHaveProperty('tag_name');
    });
  });

  describe('allReleases', () => {
    it('should get releases', async() => {
      nock('https://api.github.com')
        .get('/repos/hello/world/releases')
        .reply(200, getApiFixture(fixturesDir, 'repos.releases.list'));

      const releases = await releaser.allReleases({ ...context.repo });

      expect(releases).toHaveLength(3);
    });
  });
});
