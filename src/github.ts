import {Context} from '@actions/github/lib/context';
import {Octokit} from '@octokit/rest';
import {Config} from './util';
import {lstatSync, readFileSync} from 'fs';
import {getType} from 'mime';
import {basename} from 'path';

export interface ReleaseAsset {
  name: string;
  mime: string;
  size: number;
  file: Buffer;
}

export interface Release {
  id: number;
  'upload_url': string;
  'html_url': string;
  'tag_name': string;
}

export interface Releaser {
  getReleaseByTag(params: {
    owner: string;
    repo: string;
    tag: string;
  }): Promise<{ data: Release }>;

  createRelease(params: {
    owner: string;
    repo: string;
    'tag_name': string;
    name: string;
    body: string | undefined;
    draft: boolean | undefined;
    prerelease: boolean | undefined;
  }): Promise<{ data: Release }>;

  allReleases(params: {
    owner: string;
    repo: string;
  }): AsyncIterableIterator<{ data: Release[] }>;
}

/**
 * GitHubReleaser
 */
export class GitHubReleaser implements Releaser {
  github: Octokit;

  /**
   * @param {Octokit} github github
   */
  constructor(github: Octokit) {
    this.github = github;
  }

  /**
   * @param {object} params params
   * @return {Promise<{ data: Release }>} release
   */
  getReleaseByTag(params: {
    owner: string;
    repo: string;
    tag: string;
  }): Promise<{ data: Release }> {
    return this.github.repos.getReleaseByTag(params);
  }

  /**
   * @param {object} params params
   * @return {Promise<{ data: Release }>} release
   */
  createRelease(params: {
    owner: string;
    repo: string;
    'tag_name': string;
    name: string;
    body: string | undefined;
    draft: boolean | undefined;
    prerelease: boolean | undefined;
  }): Promise<{ data: Release }> {
    return this.github.repos.createRelease(params);
  }

  /**
   * @param {object} params params
   * @return {AsyncIterableIterator<{ data: Release[] }>} releases
   */
  allReleases(params: {
    owner: string;
    repo: string;
  }): AsyncIterableIterator<{ data: Release[] }> {
    return this.github.paginate.iterator(
      this.github.repos.listReleases.endpoint.merge(params),
    );
  }
}

export const mimeOrDefault = (path: string): string => {
  return getType(path) || 'application/octet-stream';
};

export const asset = (path: string): ReleaseAsset => {
  return {
    name: basename(path),
    mime: mimeOrDefault(path),
    size: lstatSync(path).size,
    file: readFileSync(path),
  };
};

export const upload = async(
  octokit: Octokit,
  context: Context,
  release: Release,
  path: string,
): Promise<Octokit.Response<Octokit.ReposUploadReleaseAssetResponse>> => {
  const {name, size, mime, file} = asset(path);
  console.log(`⬆️ Uploading ${name}...`);

  const assets     = await octokit.repos.listAssetsForRelease({
    ...context.repo,
    'release_id': release.id,
  });
  const duplicated = assets.data.find(assets => assets.name === name);
  if (duplicated) {
    await octokit.repos.deleteReleaseAsset({
      ...context.repo,
      'asset_id': duplicated.id,
    });
  }

  return await octokit.repos.uploadReleaseAsset({
    url: release.upload_url,
    headers: {
      'content-length': size,
      'content-type': mime,
    },
    name,
    file,
  });
};

export const release = async(
  config: Config,
  context: Context,
  releaser: Releaser,
): Promise<Release> => {
  const [owner, repo] = config.github_repository.split('/');
  const tag           = config.github_ref.replace('refs/tags/', '');
  try {
    // you can't get a an existing draft by tag
    // so we must find one in the list of all releases
    if (config.input_draft) {
      for await (const response of releaser.allReleases({
        owner,
        repo,
      })) {
        const release = response.data.find(release => release.tag_name === tag);
        if (release) {
          return release;
        }
      }
    }
    const release = await releaser.getReleaseByTag({
      owner,
      repo,
      tag,
    });
    return release.data;
  } catch (error) {
    // eslint-disable-next-line no-magic-numbers
    if (error.status === 404) {
      try {
        const name       = config.input_name || tag;
        const body       = config.input_body;
        const draft      = config.input_draft;
        const prerelease = config.input_prerelease;
        console.log(`👩‍🏭 Creating new Octokit release for tag ${tag}...`);
        const release = await releaser.createRelease({
          owner,
          repo,
          'tag_name': tag,
          name,
          body,
          draft,
          prerelease,
        });
        return release.data;
      } catch (error) {
        // presume a race with competing metrix runs
        console.log(
          `⚠️ Octokit release failed with status: ${error.status}, retrying...`,
        );
        return await release(config, context, releaser);
      }
    } else {
      console.log(
        `⚠️ Unexpected error fetching Octokit release for tag ${config.github_ref}: ${error}`,
      );
      throw error;
    }
  }
};
