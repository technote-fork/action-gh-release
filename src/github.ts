import {Context} from '@actions/github/lib/context';
import {Octokit} from '@technote-space/github-action-helper/dist/types';
import {PaginateInterface} from '@octokit/plugin-paginate-rest';
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types';
import {
  ReposListReleaseAssetsResponseData,
  ReposUploadReleaseAssetResponseData,
  ReposListReleasesResponseData,
} from '@octokit/types/dist-types/generated/Endpoints';
import {Config} from './util';
import {lstatSync, readFileSync} from 'fs';
import {getType} from 'mime';
import {basename} from 'path';

export interface ReleaseAsset {
  name: string;
  mime: string;
  size: number;
  file: string;
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
  }): Promise<Release>;

  createRelease(params: {
    owner: string;
    repo: string;
    'tag_name': string;
    name: string;
    body: string | undefined;
    draft: boolean | undefined;
    prerelease: boolean | undefined;
  }): Promise<Release>;

  allReleases(params: {
    owner: string;
    repo: string;
  }): Promise<Release[]>;
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
   * @return {Promise<{ data: Release }>} release
   */
  async getReleaseByTag(params: {
    owner: string;
    repo: string;
    tag: string;
  }): Promise<Release> {
    return (await (this.octokit as RestEndpointMethods).repos.getReleaseByTag(params)).data;
  }

  /**
   * @param {object} params params
   * @return {Promise<{ data: Release }>} release
   */
  async createRelease(params: {
    owner: string;
    repo: string;
    'tag_name': string;
    name: string;
    body?: string | undefined;
    draft?: boolean | undefined;
    prerelease?: boolean | undefined;
  }): Promise<Release> {
    return (await (this.octokit as RestEndpointMethods).repos.createRelease(params)).data;
  }

  /**
   * @param {object} params params
   * @return {Promise<Release[]>} releases
   */
  async allReleases(params: {
    owner: string;
    repo: string;
  }): Promise<Release[]> {
    return (await (this.octokit.paginate as PaginateInterface)(
      (this.octokit as RestEndpointMethods).repos.listReleases,
      params,
    )).map(item => item as ReposListReleasesResponseData[number]);
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
    file: readFileSync(path).toString(),
  };
};

export const upload = async(
  octokit: Octokit,
  context: Context,
  release: Release,
  path: string,
): Promise<ReposUploadReleaseAssetResponseData> => {
  const {name, size, mime, file} = asset(path);
  console.log(`⬆️ Uploading ${name}...`);

  const assets: ReposListReleaseAssetsResponseData = await (octokit.paginate as PaginateInterface)(
    (octokit as RestEndpointMethods).repos.listReleaseAssets,
    {
      ...context.repo,
      'release_id': release.id,
    },
  );

  const duplicated = assets.find(assets => assets.name === name);
  if (duplicated) {
    await (octokit as RestEndpointMethods).repos.deleteReleaseAsset({
      ...context.repo,
      'asset_id': duplicated.id,
    });
  }

  return (await (octokit as RestEndpointMethods).repos.uploadReleaseAsset({
    ...context.repo,
    baseUrl: release.upload_url.replace(/\/repos\/.+$/, ''),
    'release_id': release.id,
    name,
    data: file,
    headers: {
      'content-length': size,
      'content-type': mime,
    },
  })).data;
};

export const release = async(
  config: Config,
  context: Context,
  releaser: Releaser,
): Promise<Release> => {
  const [owner, repo] = config.github_repository.split('/');
  const tag           = config.github_ref.replace('refs/tags/', '');
  try {
    return await releaser.getReleaseByTag({
      owner,
      repo,
      tag,
    });
  } catch (error) {
    // eslint-disable-next-line no-magic-numbers
    if (error.status === 404) {
      try {
        const name       = config.input_name || tag;
        const body       = config.input_body;
        const prerelease = config.input_prerelease;
        console.log(`👩‍🏭 Creating new Octokit release for tag ${tag}...`);
        return await releaser.createRelease({
          owner,
          repo,
          'tag_name': tag,
          name,
          body,
          draft: false,
          prerelease,
        });
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
