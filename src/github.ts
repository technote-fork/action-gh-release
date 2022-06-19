import type { Context } from '@actions/github/lib/context';
import type { Octokit } from '@technote-space/github-action-helper/dist/types';
import type { components } from '@octokit/openapi-types';
import type { Config } from './util';
import { releaseBody } from './util';
import { lstatSync, readFileSync } from 'fs';
import { getType } from 'mime';
import { basename } from 'path';

type ReposListReleaseAssetsResponseData = components['schemas']['release-asset'];
type ReposUploadReleaseAssetResponseData = components['schemas']['release-asset'];
type ReposListReleasesResponseData = components['schemas']['release'];
type ReposCreateReleaseResponseData = components['schemas']['release'];
type ReposUpdateReleaseResponseData = components['schemas']['release'];
type ReposGetReleaseByTagResponseData = components['schemas']['release'];

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
  }): Promise<ReposGetReleaseByTagResponseData>;

  createRelease(params: {
    owner: string;
    repo: string;
    'tag_name': string;
    name: string;
    body: string | undefined;
    draft: boolean | undefined;
    prerelease: boolean | undefined;
  }): Promise<ReposCreateReleaseResponseData>;

  updateRelease(params: {
    owner: string;
    repo: string;
    'release_id': number;
    'tag_name': string;
    'target_commitish': string;
    name: string;
    body: string | undefined;
    draft: boolean | undefined;
    prerelease: boolean | undefined;
  }): Promise<ReposUpdateReleaseResponseData>;

  allReleases(params: {
    owner: string;
    repo: string;
  }): Promise<Array<ReposListReleasesResponseData>>;
}

/**
 * GitHubReleaser
 */
export class GitHubReleaser implements Releaser {
  octokit: Octokit;

  /**
   * @param {Octokit} octokit octokit
   */
  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  /**
   * @param {object} params params
   * @return {Promise<ReposGetReleaseByTagResponseData>} release
   */
  async getReleaseByTag(params: {
    owner: string;
    repo: string;
    tag: string;
  }): Promise<ReposGetReleaseByTagResponseData> {
    return (await this.octokit.rest.repos.getReleaseByTag(params)).data;
  }

  /**
   * @param {object} params params
   * @return {Promise<ReposCreateReleaseResponseData>} release
   */
  async createRelease(params: {
    owner: string;
    repo: string;
    'tag_name': string;
    name: string;
    body?: string | undefined;
    draft?: boolean | undefined;
    prerelease?: boolean | undefined;
  }): Promise<ReposCreateReleaseResponseData> {
    return (await this.octokit.rest.repos.createRelease(params)).data;
  }

  /**
   * @param {object} params params
   * @return {Promise<ReposUpdateReleaseResponseData>} release
   */
  async updateRelease(params: {
    owner: string;
    repo: string;
    'release_id': number;
    'tag_name': string;
    'target_commitish': string;
    name: string;
    body: string | undefined;
    draft: boolean | undefined;
    prerelease: boolean | undefined;
  }): Promise<ReposUpdateReleaseResponseData> {
    return (await this.octokit.rest.repos.updateRelease(params)).data;
  }

  /**
   * @param {object} params params
   * @return {Promise<Array<ReposListReleasesResponseData>>} releases
   */
  async allReleases(params: {
    owner: string;
    repo: string;
  }): Promise<Array<ReposListReleasesResponseData>> {
    return (await this.octokit.paginate(
      this.octokit.rest.repos.listReleases,
      params,
    )).map(item => item as ReposListReleasesResponseData);
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
): Promise<ReposUploadReleaseAssetResponseData> => {
  const { name, size, mime, file } = asset(path);
  console.log(`⬆️ Uploading ${name}...`);

  const assets: Array<ReposListReleaseAssetsResponseData> = await octokit.paginate(
    octokit.rest.repos.listReleaseAssets,
    {
      ...context.repo,
      'release_id': release.id,
    },
  );

  const duplicated = assets.find(assets => assets.name === name);
  if (duplicated) {
    await octokit.rest.repos.deleteReleaseAsset({
      ...context.repo,
      'asset_id': duplicated.id,
    });
  }

  return (await octokit.rest.repos.uploadReleaseAsset({
    ...context.repo,
    baseUrl: release.upload_url.replace(/\/repos\/.+$/, ''),
    'release_id': release.id,
    name,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    data: file,
    headers: {
      'content-length': size,
      'content-type': mime,
    },
  })).data;
};

const getRelease = async(tag: string, config: Config, context: Context, releaser: Releaser): Promise<ReposListReleasesResponseData | ReposGetReleaseByTagResponseData> => {
  // you can't get a an existing draft by tag
  // so we must find one in the list of all releases
  const releases = await releaser.allReleases({
    ...context.repo,
  });
  const release  = releases.find(release => release.tag_name === tag);
  if (release) {
    return release;
  }

  return releaser.getReleaseByTag({
    ...context.repo,
    tag,
  });
};

export const release = async(
  config: Config,
  context: Context,
  releaser: Releaser,
): Promise<Release> => {
  const tag = config.github_ref.replace('refs/tags/', '');
  try {
    const release = await getRelease(tag, config, context, releaser);
    if (config.input_update_draft_flag && config.input_update_draft_mode !== release.draft) {
      return await releaser.updateRelease({
        ...context.repo,
        'release_id': release.id,
        'tag_name': tag,
        'target_commitish': release.target_commitish,
        name: config.input_name || tag,
        body: `${release.body}\n${releaseBody(config)}`,
        draft: config.input_update_draft_mode,
        prerelease: config.input_prerelease,
      });
    }

    return release;
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line no-magic-numbers
    if (error.status === 404) {
      try {
        console.log(`👩‍🏭 Creating new Octokit release for tag ${tag}...`);
        return await releaser.createRelease({
          ...context.repo,
          'tag_name': tag,
          name: config.input_name || tag,
          body: releaseBody(config),
          draft: config.input_draft,
          prerelease: config.input_prerelease,
        });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
