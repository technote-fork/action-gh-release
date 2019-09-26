import { context, GitHub } from '@actions/github';
import { Response, ReposUploadReleaseAssetResponse } from '@octokit/rest';
import { Config } from './util';
import { lstatSync, readFileSync } from 'fs';
import { getType } from 'mime';
import { basename } from 'path';

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
	github: GitHub;

	/**
	 * @param {GitHub} github github
	 */
	constructor(github: GitHub) {
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
	gh: GitHub,
	release: Release,
	path: string,
): Promise<Response<ReposUploadReleaseAssetResponse>> => {
	const {name, size, mime, file} = asset(path);
	console.log(`⬆️ Uploading ${name}...`);

	const assets = await gh.repos.listAssetsForRelease({
		...context.repo,
		'release_id': release.id,
	});
	const duplicated = assets.data.find(assets => assets.name === name);
	if (duplicated) {
		await gh.repos.deleteReleaseAsset({
			...context.repo,
			'asset_id': duplicated.id,
		});
	}

	return await gh.repos.uploadReleaseAsset({
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
	releaser: Releaser,
): Promise<Release> => {
	const [owner, repo] = config.github_repository.split('/');
	const tag = config.github_ref.replace('refs/tags/', '');
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
				const name = config.input_name || tag;
				const body = config.input_body;
				const draft = config.input_draft;
				const prerelease = config.input_prerelease;
				console.log(`👩‍🏭 Creating new GitHub release for tag ${tag}...`);
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
					`⚠️ GitHub release failed with status: ${error.status}, retrying...`,
				);
				return await release(config, releaser);
			}
		} else {
			console.log(
				`⚠️ Unexpected error fetching GitHub release for tag ${config.github_ref}: ${error}`,
			);
			throw error;
		}
	}
};
