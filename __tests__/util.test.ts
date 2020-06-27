/* eslint-disable no-magic-numbers */
import path from 'path';
import * as assert from 'assert';
import {isTag, paths, parseConfig, parseInputFiles, releaseBody} from '../src/util';

const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('parseInputFiles', () => {
  it('parses empty strings', () => {
    assert.deepStrictEqual(parseInputFiles(''), []);
  });
  it('parses comma-delimited strings', () => {
    assert.deepStrictEqual(parseInputFiles('foo,bar'), ['foo', 'bar']);
  });
  it('parses newline and comma-delimited (and then some)', () => {
    assert.deepStrictEqual(
      parseInputFiles('foo,bar\nbaz,boom,\n\ndoom,loom '),
      ['foo', 'bar', 'baz', 'boom', 'doom', 'loom'],
    );
  });
});
describe('parseConfig', () => {
  it('parses basic config', () => {
    assert.deepStrictEqual(parseConfig({}), {
      'github_ref': '',
      'input_body': undefined,
      'input_body_path': undefined,
      'input_prerelease': false,
      'input_create_draft_mode': false,
      'input_files': [],
      'input_name': undefined,
      'input_update_draft_flag': false,
      'input_update_draft_mode': false,
    });
  });
});
describe('isTag', () => {
  it('returns true for tags', async() => {
    assert.strictEqual(isTag('refs/tags/foo'), true);
  });
  it('returns false for other kinds of refs', async() => {
    assert.strictEqual(isTag('refs/heads/master'), false);
  });
});

describe('paths', () => {
  it('resolves files given a set of paths', async() => {
    assert.deepStrictEqual(paths([path.join(fixturesDir, 'data/**/*')]), [
      path.join(fixturesDir, 'data/body.txt'),
      path.join(fixturesDir, 'data/foo/bar.txt'),
    ]);
  });
});

describe('releaseBody', () => {
  it('should get release body', () => {
    expect(releaseBody(parseConfig({
      'INPUT_BODY': 'test',
    }))).toBe('test');
  });

  it('should get release body by file', () => {
    expect(releaseBody(parseConfig({
      'INPUT_BODY_PATH': path.join(fixturesDir, 'data/body.txt'),
    }))).toBe('body\n');
  });
});
